const db = require('../config/database');
const { verifierStock } = require('../utils/algorithms');

// Ajouter stock
const addStock = async (req, res) => {
    const { type_aliment, quantite, unite, seuil_alerte, date_achat } = req.body;
    const userId = req.userId;

    try {
        const result = await db.query(
            `INSERT INTO stock_aliment (user_id, type_aliment, quantite, unite, seuil_alerte, date_achat) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [userId, type_aliment, quantite, unite || 'kg', seuil_alerte || 50, date_achat || new Date()]
        );

        res.status(201).json({ 
            message: 'Stock ajouté avec succès', 
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Erreur addStock:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du stock: ' + error.message });
    }
};

// Voir tout le stock
const getAllStock = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        const stock = result.rows;

        // Appliquer algorithme de vérification du stock (Algorithme 11.2)
        const stockAvecAlertes = stock.map(item => {
            const verification = verifierStock(item.quantite, item.seuil_alerte);
            return {
                ...item,
                alerte: verification.alerte,
                message_alerte: verification.message
            };
        });

        res.json(stockAvecAlertes);
    } catch (error) {
        console.error('Erreur getAllStock:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du stock: ' + error.message });
    }
};

// Modifier un stock
const updateStock = async (req, res) => {
    const { id } = req.params;
    const { type_aliment, quantite, unite, seuil_alerte } = req.body;
    const userId = req.userId;

    try {
        const result = await db.query(
            `UPDATE stock_aliment 
             SET type_aliment = $1, quantite = $2, unite = $3, seuil_alerte = $4 
             WHERE id = $5 AND user_id = $6`,
            [type_aliment, quantite, unite, seuil_alerte, id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        res.json({ message: 'Stock modifié avec succès' });
    } catch (error) {
        console.error('Erreur updateStock:', error);
        res.status(500).json({ error: 'Erreur lors de la modification du stock: ' + error.message });
    }
};

// Supprimer un stock
const deleteStock = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const result = await db.query(
            'DELETE FROM stock_aliment WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        res.json({ message: 'Stock supprimé avec succès' });
    } catch (error) {
        console.error('Erreur deleteStock:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du stock: ' + error.message });
    }
};

// Fonction supplémentaire : Consommer du stock
const consommerStock = async (req, res) => {
    const { id, quantite_consommee } = req.body;
    const userId = req.userId;

    try {
        // Récupérer le stock actuel
        const stockResult = await db.query(
            'SELECT quantite, unite FROM stock_aliment WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (stockResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        const stock = stockResult.rows[0];
        const nouvelleQuantite = stock.quantite - quantite_consommee;

        if (nouvelleQuantite < 0) {
            return res.status(400).json({ error: 'Quantité insuffisante en stock' });
        }

        const result = await db.query(
            'UPDATE stock_aliment SET quantite = $1 WHERE id = $2 AND user_id = $3',
            [nouvelleQuantite, id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        res.json({ 
            message: `${quantite_consommee} ${stock.unite} consommé(s) avec succès`,
            nouvelle_quantite: nouvelleQuantite
        });
    } catch (error) {
        console.error('Erreur consommerStock:', error);
        res.status(500).json({ error: 'Erreur lors de la consommation du stock: ' + error.message });
    }
};

// Fonction supplémentaire : Obtenir les alertes stock uniquement
const getAlertesStock = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT * FROM stock_aliment 
             WHERE user_id = $1 
             AND quantite <= seuil_alerte 
             ORDER BY (quantite / NULLIF(seuil_alerte, 0)) ASC`,
            [userId]
        );

        const alertes = result.rows.map(item => {
            const pourcentage = ((item.quantite / item.seuil_alerte) * 100).toFixed(0);
            return {
                ...item,
                alerte: true,
                niveau_alerte: pourcentage <= 50 ? 'critique' : 'attention',
                pourcentage_restant: pourcentage,
                message: `Stock ${item.type_aliment} : ${item.quantite} ${item.unite} restants (seuil: ${item.seuil_alerte} ${item.unite})`
            };
        });

        res.json(alertes);
    } catch (error) {
        console.error('Erreur getAlertesStock:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des alertes stock' });
    }
};

// Fonction supplémentaire : Statistiques du stock
const getStockStats = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_types,
                COALESCE(SUM(quantite), 0) as quantite_totale,
                COUNT(CASE WHEN quantite <= seuil_alerte THEN 1 END) as alertes_actives,
                COUNT(CASE WHEN quantite <= seuil_alerte * 0.5 THEN 1 END) as alertes_critiques
             FROM stock_aliment 
             WHERE user_id = $1`,
            [userId]
        );

        const stats = result.rows[0];
        
        res.json({
            total_types: parseInt(stats.total_types),
            quantite_totale: parseFloat(stats.quantite_totale),
            alertes_actives: parseInt(stats.alertes_actives),
            alertes_critiques: parseInt(stats.alertes_critiques),
            sante_stock: stats.alertes_critiques > 0 ? 'critique' : (stats.alertes_actives > 0 ? 'attention' : 'bon')
        });
    } catch (error) {
        console.error('Erreur getStockStats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
};

module.exports = { 
    addStock, 
    getAllStock, 
    updateStock, 
    deleteStock,
    consommerStock,
    getAlertesStock,
    getStockStats
};