const db = require('../config/database');

// Ajouter suivi quotidien
const addSuivi = async (req, res) => {
    const { lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations } = req.body;
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
                    const [stockItems] = await db.query(
                        'SELECT * FROM stock_aliment WHERE user_id = ? AND type_aliment = ? ORDER BY created_at DESC LIMIT 1',
                        [userId, item.type_aliment]
                    );
                    
                    if (stockItems.length === 0) {
                        return res.status(400).json({ error: `Aucun stock trouvé pour "${item.type_aliment}"` });
                    }
                    
                    const stock = stockItems[0];
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
                        'UPDATE stock_aliment SET quantite = ? WHERE id = ?',
                        [nouveauStock, stock.id]
                    );
                }
            }
        }

        // Insérer le suivi
        const [result] = await db.query(
            `INSERT INTO suivi_quotidien 
             (lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lot_id, date_suivi, temperature || null, totalConsommation, consommationsData, mortalite_jour || 0, observations || null]
        );

        res.status(201).json({ 
            message: 'Suivi ajouté avec succès', 
            id: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout du suivi: ' + error.message });
    }
};

// Récupérer les suivis d'un lot
const getSuiviByLot = async (req, res) => {
    const { lot_id } = req.params;
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

        const [suivis] = await db.query(
            'SELECT * FROM suivi_quotidien WHERE lot_id = ? ORDER BY date_suivi DESC',
            [lot_id]
        );

        res.json(suivis);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération du suivi' });
    }
};

// Modifier un suivi
const updateSuivi = async (req, res) => {
    const { id } = req.params;
    const { temperature, consommation_aliment, consommations, mortalite_jour, observations } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que le suivi appartient à l'utilisateur
        const [check] = await db.query(
            `SELECT s.id FROM suivi_quotidien s
             JOIN lots l ON s.lot_id = l.id
             WHERE s.id = ? AND l.user_id = ?`,
            [id, userId]
        );

        if (check.length === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé ou non autorisé' });
        }

        const [result] = await db.query(
            'UPDATE suivi_quotidien SET temperature=?, consommation_aliment=?, consommations=?, mortalite_jour=?, observations=? WHERE id=?',
            [temperature, consommation_aliment, consommations, mortalite_jour, observations, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Suivi non trouvé' });
        }

        res.json({ message: 'Suivi modifié avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la modification du suivi' });
    }
};

module.exports = { addSuivi, getSuiviByLot, updateSuivi };