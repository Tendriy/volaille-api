const db = require('../config/database');

// Ajouter suivi quotidien
const addSuivi = async (req, res) => {
    const { lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations } = req.body;
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

        let totalConsommation = consommation_aliment || 0;
        let consommationsData = null;
        
        // Traiter les consommations multiples
        if (consommations) {
            let consommationsArray;
            
            if (typeof consommations === 'string') {
                consommationsData = consommations;
                try {
                    consommationsArray = JSON.parse(consommations);
                } catch(e) {
                    consommationsArray = [];
                }
            } else if (Array.isArray(consommations)) {
                consommationsData = JSON.stringify(consommations);
                consommationsArray = consommations;
            } else {
                consommationsArray = [];
            }
            
            if (consommationsArray.length > 0) {
                // Calculer le total
                totalConsommation = consommationsArray.reduce((sum, item) => {
                    let quantite = parseFloat(item.quantite) || 0;
                    if (item.unite === 'sac') quantite = quantite * 50;
                    return sum + quantite;
                }, 0);
                
                // Mettre à jour chaque stock
                for (let item of consommationsArray) {
                    if (!item.type_aliment || !item.quantite || item.quantite <= 0) continue;
                    
                    // Trouver le stock correspondant (le premier trouvé)
                    const stockResult = await db.query(
                        'SELECT * FROM stock_aliment WHERE user_id = $1 AND type_aliment = $2 ORDER BY created_at DESC LIMIT 1',
                        [userId, item.type_aliment]
                    );
                    
                    if (stockResult.rows.length === 0) {
                        return res.status(400).json({ error: `Aucun stock trouvé pour "${item.type_aliment}"` });
                    }
                    
                    const stock = stockResult.rows[0];
                    let quantite = parseFloat(item.quantite);
                    
                    // Convertir la consommation dans l'unité du stock
                    if (stock.unite === 'kg' && item.unite === 'sac') {
                        quantite = quantite * 50;
                    } else if (stock.unite === 'sac' && item.unite === 'kg') {
                        quantite = quantite / 50;
                    }
                    
                    // Vérifier si le stock est suffisant
                    if (parseFloat(stock.quantite) < quantite) {
                        return res.status(400).json({ 
                            error: `Stock insuffisant pour "${item.type_aliment}". Il reste ${stock.quantite} ${stock.unite}.` 
                        });
                    }
                    
                    // Mettre à jour le stock
                    const nouveauStock = parseFloat(stock.quantite) - quantite;
                    await db.query(
                        'UPDATE stock_aliment SET quantite = $1 WHERE id = $2',
                        [nouveauStock, stock.id]
                    );
                }
            }
        }

        // Insérer le suivi
        const result = await db.query(
            `INSERT INTO suivi_quotidien 
             (lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id`,
            [lot_id, date_suivi, temperature || null, totalConsommation, consommationsData, mortalite_jour || 0, observations || null]
        );

        res.status(201).json({ 
            message: 'Suivi ajouté avec succès', 
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Erreur addSuivi:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du suivi: ' + error.message });
    }
};

// Récupérer les suivis d'un lot
const getSuiviByLot = async (req, res) => {
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

        const suivisResult = await db.query(
            'SELECT * FROM suivi_quotidien WHERE lot_id = $1 ORDER BY date_suivi DESC',
            [lot_id]
        );

        // Traiter les consommations JSON pour l'affichage
        const suivis = suivisResult.rows.map(suivi => {
            if (suivi.consommations) {
                try {
                    suivi.consommations_parsed = JSON.parse(suivi.consommations);
                } catch(e) {
                    suivi.consommations_parsed = [];
                }
            }
            return suivi;
        });

        res.json(suivis);
    } catch (error) {
        console.error('Erreur getSuiviByLot:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du suivi: ' + error.message });
    }
};

// Modifier un suivi
const updateSuivi = async (req, res) => {
    const { id } = req.params;
    const { temperature, consommation_aliment, consommations, mortalite_jour, observations } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que le suivi appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT s.id FROM suivi_quotidien s
             JOIN lots l ON s.lot_id = l.id
             WHERE s.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé ou non autorisé' });
        }

        const result = await db.query(
            `UPDATE suivi_quotidien 
             SET temperature = $1, consommation_aliment = $2, consommations = $3, mortalite_jour = $4, observations = $5 
             WHERE id = $6`,
            [temperature, consommation_aliment, consommations, mortalite_jour, observations, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé' });
        }

        res.json({ message: 'Suivi modifié avec succès' });
    } catch (error) {
        console.error('Erreur updateSuivi:', error);
        res.status(500).json({ error: 'Erreur lors de la modification du suivi: ' + error.message });
    }
};

// Supprimer un suivi
const deleteSuivi = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Vérifier que le suivi appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT s.id FROM suivi_quotidien s
             JOIN lots l ON s.lot_id = l.id
             WHERE s.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé ou non autorisé' });
        }

        const result = await db.query(
            'DELETE FROM suivi_quotidien WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé' });
        }

        res.json({ message: 'Suivi supprimé avec succès' });
    } catch (error) {
        console.error('Erreur deleteSuivi:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du suivi: ' + error.message });
    }
};

// Obtenir les statistiques de consommation d'un lot
const getStatsConsommation = async (req, res) => {
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

        const statsResult = await db.query(
            `SELECT 
                COALESCE(SUM(consommation_aliment), 0) as total_kg,
                COALESCE(AVG(consommation_aliment), 0) as moyenne_journaliere,
                MAX(consommation_aliment) as max_journalier,
                MIN(consommation_aliment) as min_journalier,
                COUNT(*) as nombre_jours
             FROM suivi_quotidien 
             WHERE lot_id = $1`,
            [lot_id]
        );

        const stats = statsResult.rows[0];
        
        res.json({
            total_consommation_kg: parseFloat(stats.total_kg),
            moyenne_journaliere_kg: parseFloat(stats.moyenne_journaliere),
            max_journalier_kg: parseFloat(stats.max_journalier) || 0,
            min_journalier_kg: parseFloat(stats.min_journalier) || 0,
            nombre_jours: parseInt(stats.nombre_jours)
        });
    } catch (error) {
        console.error('Erreur getStatsConsommation:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques: ' + error.message });
    }
};

// Obtenir le résumé des mortalités
const getResumeMortalite = async (req, res) => {
    const { lot_id } = req.params;
    const userId = req.userId;

    try {
        // Vérifier que le lot appartient à l'utilisateur
        const lotsResult = await db.query(
            'SELECT l.* FROM lots l WHERE l.id = $1 AND l.user_id = $2',
            [lot_id, userId]
        );

        if (lotsResult.rows.length === 0) {
            return res.status(403).json({ error: 'Lot non autorisé' });
        }

        const lot = lotsResult.rows[0];
        
        const statsResult = await db.query(
            `SELECT 
                COALESCE(SUM(mortalite_jour), 0) as total_morts,
                COALESCE(AVG(mortalite_jour), 0) as moyenne_journaliere,
                MAX(mortalite_jour) as max_journalier,
                COUNT(CASE WHEN mortalite_jour > 0 THEN 1 END) as jours_avec_mortalite
             FROM suivi_quotidien 
             WHERE lot_id = $1`,
            [lot_id]
        );

        const stats = statsResult.rows[0];
        const totalMorts = parseInt(stats.total_morts);
        
        res.json({
            total_morts: totalMorts,
            taux_mortalite: ((totalMorts / lot.nombre_initial) * 100).toFixed(2),
            moyenne_journaliere: parseFloat(stats.moyenne_journaliere),
            max_journalier: parseInt(stats.max_journalier) || 0,
            jours_avec_mortalite: parseInt(stats.jours_avec_mortalite),
            nombre_initial: lot.nombre_initial,
            nombre_restant: lot.nombre_initial - totalMorts
        });
    } catch (error) {
        console.error('Erreur getResumeMortalite:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du résumé: ' + error.message });
    }
};

module.exports = { 
    addSuivi, 
    getSuiviByLot, 
    updateSuivi,
    deleteSuivi,
    getStatsConsommation,
    getResumeMortalite
};