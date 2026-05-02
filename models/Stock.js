const db = require('../config/database');
const { verifierStock } = require('../utils/algorithms');

class Stock {
    // Créer un stock
    static async create(stockData) {
        const { user_id, type_aliment, quantite, unite, seuil_alerte, date_achat } = stockData;
        const [result] = await db.query(
            'INSERT INTO stock_aliment (user_id, type_aliment, quantite, unite, seuil_alerte, date_achat) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, type_aliment, quantite, unite || 'kg', seuil_alerte || 50, date_achat || new Date()]
        );
        return result.insertId;
    }

    // Trouver tout le stock d'un utilisateur
    static async findAllByUser(userId) {
        const [stock] = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Ajouter les alertes
        return stock.map(item => ({
            ...item,
            ...verifierStock(item.quantite, item.seuil_alerte)
        }));
    }

    // Mettre à jour un stock
    static async update(id, userId, stockData) {
        const { type_aliment, quantite, unite, seuil_alerte } = stockData;
        const [result] = await db.query(
            'UPDATE stock_aliment SET type_aliment=?, quantite=?, unite=?, seuil_alerte=? WHERE id=? AND user_id=?',
            [type_aliment, quantite, unite, seuil_alerte, id, userId]
        );
        return result.affectedRows > 0;
    }

    // Supprimer un stock
    static async delete(id, userId) {
        const [result] = await db.query(
            'DELETE FROM stock_aliment WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    // Mettre à jour la quantité (après consommation)
    static async updateQuantity(id, userId, newQuantity) {
        const [result] = await db.query(
            'UPDATE stock_aliment SET quantite = ? WHERE id = ? AND user_id = ?',
            [newQuantity, id, userId]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Stock;