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
        const [existingLots] = await db.query(
            `SELECT * FROM lots 
             WHERE user_id = ? 
             AND nom_lot = ? 
             AND statut = 'actif'`,
            [userId, nom_lot]
        );

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
                     SET nombre_initial = ?, 
                         fournisseur = ?,
                         updated_at = NOW() 
                     WHERE id = ? AND user_id = ?`,
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
        const [result] = await db.query(
            `INSERT INTO lots 
             (user_id, nom_lot, race, fournisseur, nombre_initial, date_arrivee, statut, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, 'actif', NOW())`,
            [userId, nom_lot, race, fournisseur || null, nombre_initial, date_arrivee]
        );

        res.status(201).json({ 
            message: 'Lot ajouté avec succès',
            id: result.insertId,
            updated: false
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout du lot: ' + error.message });
    }
};

// Le reste des fonctions...
const getAllLots = async (req, res) => {
    const userId = req.userId;

    try {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        for (let lot of lots) {
            const [morts] = await db.query(
                'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
                [lot.id]
            );
            const totalMorts = morts[0].total_morts || 0;
            
            const [ventes] = await db.query(
                'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
                [lot.id]
            );
            const totalVendus = ventes[0].total_vendus || 0;
            
            const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
            
            lot.total_morts = totalMorts;
            lot.total_vendus = totalVendus;
            lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
            lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
            lot.age = calculerAge(lot.date_arrivee);
        }

        res.json(lots);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des lots' });
    }
};

const getLotById = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (lots.length === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        const lot = lots[0];
        
        const [morts] = await db.query(
            'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
            [id]
        );
        const totalMorts = morts[0].total_morts || 0;
        
        const [ventes] = await db.query(
            'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
            [id]
        );
        const totalVendus = ventes[0].total_vendus || 0;
        
        const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
        
        lot.total_morts = totalMorts;
        lot.total_vendus = totalVendus;
        lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
        lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
        lot.age = calculerAge(lot.date_arrivee);

        res.json(lot);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération du lot' });
    }
};

const updateLot = async (req, res) => {
    const { id } = req.params;
    const { nom_lot, race, fournisseur, nombre_initial, statut } = req.body;
    const userId = req.userId;

    try {
        const [result] = await db.query(
            'UPDATE lots SET nom_lot=?, race=?, fournisseur=?, nombre_initial=?, statut=? WHERE id=? AND user_id=?',
            [nom_lot, race, fournisseur, nombre_initial, statut, id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        res.json({ message: 'Lot modifié avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la modification du lot' });
    }
};

const deleteLot = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        await db.query('DELETE FROM suivi_quotidien WHERE lot_id = ?', [id]);
        await db.query('DELETE FROM ventes WHERE lot_id = ?', [id]);
        await db.query('DELETE FROM vaccinations WHERE lot_id = ?', [id]);
        
        const [result] = await db.query(
            'DELETE FROM lots WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lot non trouvé' });
        }

        res.json({ message: 'Lot supprimé avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la suppression du lot' });
    }
};

const cloturerLot = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const [result] = await db.query(
            'UPDATE lots SET statut="cloture" WHERE id=? AND user_id=? AND statut="actif"',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lot non trouvé ou déjà clôturé' });
        }

        res.json({ message: 'Lot clôturé avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la clôture du lot' });
    }
};

const searchLots = async (req, res) => {
    const { q } = req.query;
    const userId = req.userId;

    try {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ?',
            [userId]
        );

        const resultats = rechercherLots(lots, q);
        res.json(resultats);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
};

const fusionnerTousLesLotsDoublons = async (req, res) => {
    const userId = req.userId;

    try {
        const [doublons] = await db.query(
            `SELECT nom_lot, race, COUNT(*) as count, 
                    GROUP_CONCAT(id) as ids, 
                    SUM(nombre_initial) as total
             FROM lots 
             WHERE user_id = ? AND statut = 'actif'
             GROUP BY nom_lot, race
             HAVING COUNT(*) > 1`,
            [userId]
        );

        if (doublons.length === 0) {
            return res.json({ message: 'Aucun lot en double trouvé' });
        }

        const resultats = [];

        for (let groupe of doublons) {
            const ids = groupe.ids.split(',').map(Number);
            const premierId = Math.min(...ids);
            
            await db.query(
                `UPDATE lots SET nombre_initial = ? WHERE id = ?`,
                [groupe.total, premierId]
            );
            
            for (let id of ids) {
                if (id !== premierId) {
                    await db.query(`DELETE FROM lots WHERE id = ?`, [id]);
                }
            }
            
            resultats.push({
                nom_lot: groupe.nom_lot,
                race: groupe.race,
                total: groupe.total
            });
        }

        res.json({ 
            message: `${doublons.length} groupe(s) fusionné(s)`,
            fusionnes: resultats 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la fusion' });
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