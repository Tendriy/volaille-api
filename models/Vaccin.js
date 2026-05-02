const db = require('../config/database');
const { genererAlertesVaccins } = require('../utils/algorithms');

class Vaccin {
    // Programmer un vaccin
    static async create(vaccinData) {
        const { lot_id, date_programmee, type_vaccin } = vaccinData;
        const result = await db.query(
            `INSERT INTO vaccinations (lot_id, date_programmee, type_vaccin) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [lot_id, date_programmee, type_vaccin]
        );
        return result.rows[0].id;
    }

    // Récupérer tous les vaccins d'un utilisateur
    static async findAllByUser(userId) {
        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1 
             ORDER BY v.date_programmee DESC`,
            [userId]
        );
        return result.rows;
    }

    // Marquer un vaccin comme effectué
    static async marquerEffectue(id) {
        const result = await db.query(
            `UPDATE vaccinations 
             SET statut = 'effectue', date_effectuee = CURRENT_DATE 
             WHERE id = $1 AND statut = 'programme'`,
            [id]
        );
        return result.rowCount > 0;
    }

    // Obtenir les alertes vaccins
    static async getAlertes(userId, joursAlerte = 3) {
        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1 
             AND v.statut = 'programme'
             AND v.date_programmee >= CURRENT_DATE
             AND v.date_programmee <= CURRENT_DATE + ($2 || ' days')::INTERVAL`,
            [userId, joursAlerte]
        );
        return genererAlertesVaccins(result.rows, joursAlerte);
    }
}

module.exports = Vaccin;