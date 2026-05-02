const db = require('../config/database');
const { calculVentesMensuelles } = require('../utils/algorithms');

// Enregistrer une vente
const addVente = async (req, res) => {
    const { lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que le lot appartient à l'utilisateur
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE id = $1 AND user_id = $2',
            [lot_id, userId]
        );

        if (lotsResult.rows.length === 0) {
            return res.status(403).json({ error: 'Lot non autorisé' });
        }

        const lot = lotsResult.rows[0];
        
        // Récupérer le total des morts
        const mortsResult = await db.query(
            'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
            [lot_id]
        );
        const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
        
        // Récupérer le total des ventes déjà effectuées
        const ventesExistantesResult = await db.query(
            'SELECT COALESCE(SUM(nombre_vendu), 0) as total_vendus FROM ventes WHERE lot_id = $1',
            [lot_id]
        );
        const totalVendusActuel = parseInt(ventesExistantesResult.rows[0].total_vendus) || 0;
        
        // Calculer le nombre restant
        const reste = lot.nombre_initial - totalMorts - totalVendusActuel;
        
        // Vérifier si la vente est possible
        if (nombre_vendu > reste) {
            return res.status(400).json({ 
                error: `Il ne reste que ${reste} volailles dans ce lot. Impossible de vendre ${nombre_vendu}.` 
            });
        }

        // Enregistrer la vente
        const result = await db.query(
            `INSERT INTO ventes (lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id`,
            [lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur || null]
        );

        res.status(201).json({ 
            message: 'Vente enregistrée avec succès', 
            id: result.rows[0].id,
            reste_apres_vente: reste - nombre_vendu
        });
    } catch (error) {
        console.error('Erreur addVente:', error);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la vente: ' + error.message });
    }
};

// Historique des ventes
const getAllVentes = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1
             ORDER BY v.date_vente DESC`,
            [userId]
        );

        const ventes = result.rows;

        // Calculer chiffre d'affaires total
        const caTotal = ventes.reduce((total, vente) => {
            return total + (vente.nombre_vendu * parseFloat(vente.prix_unitaire));
        }, 0);

        // Calculer ventes mensuelles
        const ventesMensuelles = calculVentesMensuelles(ventes);

        res.json({
            ventes,
            chiffre_affaires_total: caTotal,
            ventes_mensuelles: ventesMensuelles
        });
    } catch (error) {
        console.error('Erreur getAllVentes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes: ' + error.message });
    }
};

// Récupérer les ventes d'un lot spécifique
const getVentesByLot = async (req, res) => {
    const { lot_id } = req.params;
    const userId = req.userId;

    try {
        // Vérifier que le lot appartient à l'utilisateur
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE id = $1 AND user_id = $2',
            [lot_id, userId]
        );

        if (lotsResult.rows.length === 0) {
            return res.status(403).json({ error: 'Lot non autorisé' });
        }

        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE v.lot_id = $1
             ORDER BY v.date_vente DESC`,
            [lot_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur getVentesByLot:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes du lot: ' + error.message });
    }
};

// Fonction supplémentaire: Supprimer une vente
const deleteVente = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Vérifier que la vente appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT v.id FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE v.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vente non trouvée ou non autorisée' });
        }

        const result = await db.query(
            'DELETE FROM ventes WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vente non trouvée' });
        }

        res.json({ message: 'Vente supprimée avec succès' });
    } catch (error) {
        console.error('Erreur deleteVente:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la vente: ' + error.message });
    }
};

// Fonction supplémentaire: Modifier une vente
const updateVente = async (req, res) => {
    const { id } = req.params;
    const { nombre_vendu, prix_unitaire, date_vente, acheteur } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que la vente appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT v.id, v.lot_id, v.nombre_vendu as ancien_nombre
             FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE v.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vente non trouvée ou non autorisée' });
        }

        const vente = checkResult.rows[0];
        
        // Mettre à jour la vente
        const result = await db.query(
            `UPDATE ventes 
             SET nombre_vendu = $1, prix_unitaire = $2, date_vente = $3, acheteur = $4 
             WHERE id = $5`,
            [nombre_vendu, prix_unitaire, date_vente, acheteur, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vente non trouvée' });
        }

        res.json({ 
            message: 'Vente modifiée avec succès',
            ancien_nombre: vente.ancien_nombre,
            nouveau_nombre: nombre_vendu
        });
    } catch (error) {
        console.error('Erreur updateVente:', error);
        res.status(500).json({ error: 'Erreur lors de la modification de la vente: ' + error.message });
    }
};

// Fonction supplémentaire: Statistiques des ventes
const getStatsVentes = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_ventes,
                COALESCE(SUM(v.nombre_vendu), 0) as total_volailles,
                COALESCE(SUM(v.nombre_vendu * v.prix_unitaire), 0) as chiffre_affaires,
                COALESCE(AVG(v.prix_unitaire), 0) as prix_moyen,
                MAX(v.date_vente) as derniere_vente,
                MIN(v.date_vente) as premiere_vente
             FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE l.user_id = $1`,
            [userId]
        );

        const stats = result.rows[0];
        
        res.json({
            total_ventes: parseInt(stats.total_ventes),
            total_volailles: parseInt(stats.total_volailles),
            chiffre_affaires: parseFloat(stats.chiffre_affaires),
            prix_moyen: parseFloat(stats.prix_moyen),
            derniere_vente: stats.derniere_vente,
            premiere_vente: stats.premiere_vente,
            prix_moyen_par_volaille: stats.total_volailles > 0 
                ? (parseFloat(stats.chiffre_affaires) / stats.total_volailles).toFixed(2)
                : 0
        });
    } catch (error) {
        console.error('Erreur getStatsVentes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques: ' + error.message });
    }
};

// Fonction supplémentaire: Top acheteurs
const getTopAcheteurs = async (req, res) => {
    const userId = req.userId;
    const { limit = 5 } = req.query;

    try {
        const result = await db.query(
            `SELECT 
                v.acheteur,
                COUNT(*) as nombre_achats,
                COALESCE(SUM(v.nombre_vendu), 0) as total_volailles,
                COALESCE(SUM(v.nombre_vendu * v.prix_unitaire), 0) as montant_total,
                MAX(v.date_vente) as derniere_vente
             FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE l.user_id = $1
             AND v.acheteur IS NOT NULL
             AND v.acheteur != ''
             GROUP BY v.acheteur
             ORDER BY montant_total DESC
             LIMIT $2`,
            [userId, parseInt(limit)]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur getTopAcheteurs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des tops acheteurs: ' + error.message });
    }
};

// Fonction supplémentaire: Ventes par période
const getVentesByPeriode = async (req, res) => {
    const userId = req.userId;
    const { debut, fin } = req.query;

    try {
        let query = `
            SELECT 
                v.*, 
                l.nom_lot,
                v.nombre_vendu * v.prix_unitaire as montant
            FROM ventes v
            JOIN lots l ON v.lot_id = l.id
            WHERE l.user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2;

        if (debut) {
            query += ` AND v.date_vente >= $${paramIndex}`;
            params.push(debut);
            paramIndex++;
        }

        if (fin) {
            query += ` AND v.date_vente <= $${paramIndex}`;
            params.push(fin);
            paramIndex++;
        }

        query += ` ORDER BY v.date_vente DESC`;

        const result = await db.query(query, params);
        const ventes = result.rows;

        const caTotal = ventes.reduce((total, vente) => {
            return total + (vente.nombre_vendu * parseFloat(vente.prix_unitaire));
        }, 0);

        res.json({
            periode: { debut: debut || 'début', fin: fin || 'aujourd\'hui' },
            total_ventes: ventes.length,
            total_volailles: ventes.reduce((sum, v) => sum + v.nombre_vendu, 0),
            chiffre_affaires: caTotal,
            ventes: ventes
        });
    } catch (error) {
        console.error('Erreur getVentesByPeriode:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes par période: ' + error.message });
    }
};

module.exports = { 
    addVente, 
    getAllVentes,
    getVentesByLot,
    deleteVente,
    updateVente,
    getStatsVentes,
    getTopAcheteurs,
    getVentesByPeriode
};