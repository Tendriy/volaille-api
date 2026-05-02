const db = require('../config/database');
const { verifierStock } = require('../utils/algorithms');

// Ajouter stock
const addStock = async (req, res) => {
    const { type_aliment, quantite, unite, seuil_alerte, date_achat } = req.body;
    const userId = req.userId;

    try {
        const [result] = await db.query(
            'INSERT INTO stock_aliment (user_id, type_aliment, quantite, unite, seuil_alerte, date_achat) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, type_aliment, quantite, unite || 'kg', seuil_alerte || 50, date_achat || new Date()]
        );

        res.status(201).json({ message: 'Stock ajouté avec succès', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout du stock' });
    }
};

// Voir tout le stock
const getAllStock = async (req, res) => {
    const userId = req.userId;

    try {
        const [stock] = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

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
        res.status(500).json({ error: 'Erreur lors de la récupération du stock' });
    }
};

// Modifier un stock
const updateStock = async (req, res) => {
    const { id } = req.params;
    const { type_aliment, quantite, unite, seuil_alerte } = req.body;
    const userId = req.userId;

    try {
        const [result] = await db.query(
            'UPDATE stock_aliment SET type_aliment=?, quantite=?, unite=?, seuil_alerte=? WHERE id=? AND user_id=?',
            [type_aliment, quantite, unite, seuil_alerte, id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        res.json({ message: 'Stock modifié avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la modification du stock' });
    }
};

// Supprimer un stock
const deleteStock = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const [result] = await db.query(
            'DELETE FROM stock_aliment WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Stock non trouvé' });
        }

        res.json({ message: 'Stock supprimé avec succès' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la suppression du stock' });
    }
};

module.exports = { addStock, getAllStock, updateStock, deleteStock };