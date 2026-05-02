const db = require('../config/database');
const { calculVentesMensuelles } = require('../utils/algorithms');

// Enregistrer une vente
const addVente = async (req, res) => {
    const { lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que le lot appartient à l'utilisateur
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE id = ? AND user_id = ?',
            [lot_id, userId]
        );

        if (lots.length === 0) {
            return res.status(403).json({ error: 'Lot non autorisé' });
        }

        const lot = lots[0];
        
        // Récupérer le total des morts
        const [morts] = await db.query(
            'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
            [lot_id]
        );
        const totalMorts = morts[0].total_morts || 0;
        
        // Récupérer le total des ventes déjà effectuées
        const [ventesExistantes] = await db.query(
            'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
            [lot_id]
        );
        const totalVendusActuel = ventesExistantes[0].total_vendus || 0;
        
        // Calculer le nombre restant
        const reste = lot.nombre_initial - totalMorts - totalVendusActuel;
        
        // Vérifier si la vente est possible
        if (nombre_vendu > reste) {
            return res.status(400).json({ 
                error: `Il ne reste que ${reste} volailles dans ce lot. Impossible de vendre ${nombre_vendu}.` 
            });
        }

        // Enregistrer la vente
        const [result] = await db.query(
            'INSERT INTO ventes (lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur) VALUES (?, ?, ?, ?, ?)',
            [lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur]
        );

        res.status(201).json({ 
            message: 'Vente enregistrée avec succès', 
            id: result.insertId,
            reste_apres_vente: reste - nombre_vendu
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la vente' });
    }
};

// Historique des ventes
const getAllVentes = async (req, res) => {
    const userId = req.userId;

    try {
        const [ventes] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ?
             ORDER BY v.date_vente DESC`,
            [userId]
        );

        // Calculer chiffre d'affaires total
        const caTotal = ventes.reduce((total, vente) => {
            return total + (vente.nombre_vendu * vente.prix_unitaire);
        }, 0);

        // Calculer ventes mensuelles
        const ventesMensuelles = calculVentesMensuelles(ventes);

        res.json({
            ventes,
            chiffre_affaires_total: caTotal,
            ventes_mensuelles: ventesMensuelles
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes' });
    }
};

// Récupérer les ventes d'un lot spécifique
const getVentesByLot = async (req, res) => {
    const { lot_id } = req.params;
    const userId = req.userId;

    try {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE id = ? AND user_id = ?',
            [lot_id, userId]
        );

        if (lots.length === 0) {
            return res.status(403).json({ error: 'Lot non autorisé' });
        }

        const [ventes] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE v.lot_id = ?
             ORDER BY v.date_vente DESC`,
            [lot_id]
        );

        res.json(ventes);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes du lot' });
    }
};

module.exports = { 
    addVente, 
    getAllVentes,
    getVentesByLot
};