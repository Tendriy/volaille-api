const db = require('../config/database');
const { calculVentesMensuelles } = require('../utils/algorithms');

class Vente {
    // Enregistrer une vente
    static async create(venteData) {
        const { lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur } = venteData;
        const [result] = await db.query(
            'INSERT INTO ventes (lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur) VALUES (?, ?, ?, ?, ?)',
            [lot_id, nombre_vendu, prix_unitaire, date_vente, acheteur || null]
        );
        return result.insertId;
    }

    // Récupérer toutes les ventes d'un utilisateur
    static async findAllByUser(userId) {
        const [ventes] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ?
             ORDER BY v.date_vente DESC`,
            [userId]
        );
        return ventes;
    }

    // Récupérer les ventes par lot
    static async findByLotId(lotId, userId = null) {
        let query = `
            SELECT v.*, l.nom_lot 
            FROM ventes v 
            JOIN lots l ON v.lot_id = l.id 
            WHERE v.lot_id = ?
        `;
        const params = [lotId];
        
        if (userId) {
            query += ' AND l.user_id = ?';
            params.push(userId);
        }
        
        query += ' ORDER BY v.date_vente DESC';
        
        const [ventes] = await db.query(query, params);
        return ventes;
    }

    // Récupérer le total des ventes d'un lot
    static async getTotalVendusByLotId(lotId) {
        const [result] = await db.query(
            'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
            [lotId]
        );
        return result[0].total_vendus || 0;
    }

    // Calculer le chiffre d'affaires total
    static async getChiffreAffairesTotal(userId) {
        const [result] = await db.query(
            `SELECT SUM(v.nombre_vendu * v.prix_unitaire) as total
             FROM ventes v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ?`,
            [userId]
        );
        return result[0].total || 0;
    }

    // Obtenir les statistiques complètes
    static async getStats(userId) {
        const ventes = await this.findAllByUser(userId);
        
        const caTotal = ventes.reduce((total, vente) => {
            return total + (vente.nombre_vendu * vente.prix_unitaire);
        }, 0);
        
        const ventesMensuelles = calculVentesMensuelles(ventes);
        
        return {
            ventes,
            chiffre_affaires_total: caTotal,
            ventes_mensuelles: ventesMensuelles
        };
    }
}

module.exports = Vente;