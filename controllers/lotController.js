const db = require('../config/database');
const { calculTauxMortalite, calculerAge, rechercherLots } = require('../utils/algorithms');

// Ajouter un lot (avec vérification des doublons - VERSION CORRIGÉE)
const addLot = async (req, res) => {
    const { nom_lot, race, fournisseur, nombre_initial, date_arrivee } = req.body;
    const userId = req.userId;

    console.log('=== addLot DEBUG ===');
    console.log('Données reçues:', { nom_lot, race, fournisseur, nombre_initial, date_arrivee });

    try {
        // Vérifier si un lot actif avec le même nom existe déjà
        const existingResult = await db.query(
            `SELECT * FROM lots 
             WHERE user_id = $1 
             AND nom_lot = $2 
             AND statut = 'actif'`,
            [userId, nom_lot]
        );

        const existingLots = existingResult.rows;
        console.log('Lots existants avec ce nom:', existingLots.length);

        if (existingLots.length > 0) {
            // Vérifier si la race existe déjà
            const sameRace = existingLots.find(lot => lot.race === race);
            
            if (sameRace) {
                // Même nom et même race - addition
                const ancienneQuantite = parseInt(sameRace.nombre_initial);
                const nouvelleQuantite = ancienneQuantite + parseInt(nombre_initial);
                
                await db.query(
                    `UPDATE lots 
                     SET nombre_initial = $1, 
                         fournisseur = $2,
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $3 AND user_id = $4`,
                    [nouvelleQuantite, fournisseur || sameRace.fournisseur, sameRace.id, userId]
                );
                
                return res.status(200).json({ 
                    message: `✅ ${nombre_initial} ${race} ajoutés au lot "${nom_lot}". Nouveau total : ${nouvelleQuantite}`,
                    id: sameRace.id,
                    updated: true
                });
            } else {
                // Même nom mais race différente - REFUSER
                const racesExistantes = existingLots.map(lot => `"${lot.race}"`).join(', ');
                return res.status(409).json({ 
                    error: `❌ REFUSÉ ! Le lot "${nom_lot}" existe déjà avec la(les) race(s) : ${racesExistantes}. Vous ne pouvez PAS ajouter une nouvelle race "${race}". Utilisez un nom de lot différent.`
                });
            }
        }
        
        // Aucun lot avec ce nom - création OK
        const result = await db.query(
            `INSERT INTO lots 
             (user_id, nom_lot, race, fournisseur, nombre_initial, date_arrivee, statut, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, 'actif', CURRENT_TIMESTAMP)
             RETURNING id`,
            [userId, nom_lot, race, fournisseur || null, nombre_initial, date_arrivee]
        );

        res.status(201).json({ 
            message: 'Lot ajouté avec succès',
            id: result.rows[0].id,
            updated: false
        });
    } catch (error) {
        console.error('Erreur addLot:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du lot: ' + error.message });
    }
};

// Récupérer tous les lots
const getAllLots = async (req, res) => {
    const userId = req.userId;

    try {
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        const lots = lotsResult.rows;

        for (let lot of lots) {
            const mortsResult = await db.query(
                'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
                [lot.id]
            );
            const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
            
            const ventesResult = await db.query(
                'SELECT COALESCE(SUM(nombre_vendu), 0) as total_vendus FROM ventes WHERE lot_id = $1',
                [lot.id]
            );
            const totalVendus = parseInt(ventesResult.rows[0].total_vendus) || 0;
            
            const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
            
            lot.total_morts = totalMorts;
            lot.total_vendus = totalVendus;
            lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
            lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
            lot.age = calculerAge(lot.date_arrivee);
        }

        res.json(lots);
    } catch (error) {
        console.error('Erreur getAllLots:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des lots' });
    }
};

// Récupérer un lot par ID
const getLotById = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (lotsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        const lot = lotsResult.rows[0];
        
        const mortsResult = await db.query(
            'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
            [id]
        );
        const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
        
        const ventesResult = await db.query(
            'SELECT COALESCE(SUM(nombre_vendu), 0) as total_vendus FROM ventes WHERE lot_id = $1',
            [id]
        );
        const totalVendus = parseInt(ventesResult.rows[0].total_vendus) || 0;
        
        const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
        
        lot.total_morts = totalMorts;
        lot.total_vendus = totalVendus;
        lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
        lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
        lot.age = calculerAge(lot.date_arrivee);

        res.json(lot);
    } catch (error) {
        console.error('Erreur getLotById:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du lot' });
    }
};

// Mettre à jour un lot
const updateLot = async (req, res) => {
    const { id } = req.params;
    const { nom_lot, race, fournisseur, nombre_initial, statut } = req.body;
    const userId = req.userId;

    try {
        const result = await db.query(
            `UPDATE lots 
             SET nom_lot = $1, race = $2, fournisseur = $3, nombre_initial = $4, statut = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 AND user_id = $7`,
            [nom_lot, race, fournisseur, nombre_initial, statut, id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        res.json({ message: 'Lot modifié avec succès' });
    } catch (error) {
        console.error('Erreur updateLot:', error);
        res.status(500).json({ error: 'Erreur lors de la modification du lot' });
    }
};

// Supprimer un lot
const deleteLot = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Supprimer d'abord les enregistrements liés (ou utiliser ON DELETE CASCADE)
        await db.query('DELETE FROM suivi_quotidien WHERE lot_id = $1', [id]);
        await db.query('DELETE FROM ventes WHERE lot_id = $1', [id]);
        await db.query('DELETE FROM vaccinations WHERE lot_id = $1', [id]);
        
        const result = await db.query(
            'DELETE FROM lots WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        res.json({ message: 'Lot supprimé avec succès' });
    } catch (error) {
        console.error('Erreur deleteLot:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du lot' });
    }
};

// Clôturer un lot
const cloturerLot = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const result = await db.query(
            `UPDATE lots 
             SET statut = 'cloture', updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND user_id = $2 AND statut = 'actif'`,
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lot non trouvé ou déjà clôturé' });
        }

        res.json({ message: 'Lot clôturé avec succès' });
    } catch (error) {
        console.error('Erreur cloturerLot:', error);
        res.status(500).json({ error: 'Erreur lors de la clôture du lot' });
    }
};

// Rechercher des lots
const searchLots = async (req, res) => {
    const { q } = req.query;
    const userId = req.userId;

    try {
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE user_id = $1',
            [userId]
        );
        const lots = lotsResult.rows;

        const resultats = rechercherLots(lots, q);
        res.json(resultats);
    } catch (error) {
        console.error('Erreur searchLots:', error);
        res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
};

// Fusionner tous les lots en double
const fusionnerTousLesLotsDoublons = async (req, res) => {
    const userId = req.userId;

    try {
        // Pour PostgreSQL, on utilise STRING_AGG au lieu de GROUP_CONCAT
        const doublonsResult = await db.query(
            `SELECT nom_lot, race, COUNT(*) as count, 
                    STRING_AGG(id::text, ',' ORDER BY id) as ids, 
                    SUM(nombre_initial) as total
             FROM lots 
             WHERE user_id = $1 AND statut = 'actif'
             GROUP BY nom_lot, race
             HAVING COUNT(*) > 1`,
            [userId]
        );

        const doublons = doublonsResult.rows;

        if (doublons.length === 0) {
            return res.json({ message: 'Aucun lot en double trouvé' });
        }

        const resultats = [];

        for (let groupe of doublons) {
            const ids = groupe.ids.split(',').map(Number);
            const premierId = Math.min(...ids);
            
            await db.query(
                `UPDATE lots SET nombre_initial = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [groupe.total, premierId]
            );
            
            for (let id of ids) {
                if (id !== premierId) {
                    // Supprimer d'abord les enregistrements liés
                    await db.query(`DELETE FROM suivi_quotidien WHERE lot_id = $1`, [id]);
                    await db.query(`DELETE FROM ventes WHERE lot_id = $1`, [id]);
                    await db.query(`DELETE FROM vaccinations WHERE lot_id = $1`, [id]);
                    await db.query(`DELETE FROM lots WHERE id = $1`, [id]);
                }
            }
            
            resultats.push({
                nom_lot: groupe.nom_lot,
                race: groupe.race,
                total: parseInt(groupe.total)
            });
        }

        res.json({ 
            message: `${doublons.length} groupe(s) fusionné(s)`,
            fusionnes: resultats 
        });
    } catch (error) {
        console.error('Erreur fusion:', error);
        res.status(500).json({ error: 'Erreur lors de la fusion: ' + error.message });
    }
};

module.exports = {
    addLot,
    getAllLots,
    getLotById,
    updateLot,
    deleteLot,
    cloturerLot,
    searchLots,
    fusionnerTousLesLotsDoublons
};