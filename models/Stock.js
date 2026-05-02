const db = require('../config/database');
const { verifierStock } = require('../utils/algorithms');

class Stock {
    // Créer un stock
    static async create(stockData) {
        const { user_id, type_aliment, quantite, unite, seuil_alerte, date_achat } = stockData;
        const result = await db.query(
            `INSERT INTO stock_aliment (user_id, type_aliment, quantite, unite, seuil_alerte, date_achat) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [user_id, type_aliment, quantite, unite || 'kg', seuil_alerte || 50, date_achat || new Date()]
        );
        return result.rows[0].id;
    }

    // Trouver tout le stock d'un utilisateur
    static async findAllByUser(userId) {
        const result = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        const stock = result.rows;

        // Ajouter les alertes
        return stock.map(item => ({
            ...item,
            ...verifierStock(item.quantite, item.seuil_alerte)
        }));
    }

    // Mettre à jour un stock
    static async update(id, userId, stockData) {
        const { type_aliment, quantite, unite, seuil_alerte } = stockData;
        const result = await db.query(
            `UPDATE stock_aliment 
             SET type_aliment = $1, quantite = $2, unite = $3, seuil_alerte = $4 
             WHERE id = $5 AND user_id = $6`,
            [type_aliment, quantite, unite, seuil_alerte, id, userId]
        );
        return result.rowCount > 0;
    }

    // Supprimer un stock
    static async delete(id, userId) {
        const result = await db.query(
            'DELETE FROM stock_aliment WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        return result.rowCount > 0;
    }

    // Mettre à jour la quantité (après consommation)
    static async updateQuantity(id, userId, newQuantity) {
        const result = await db.query(
            'UPDATE stock_aliment SET quantite = $1 WHERE id = $2 AND user_id = $3',
            [newQuantity, id, userId]
        );
        return result.rowCount > 0;
    }
}

module.exports = Stock;