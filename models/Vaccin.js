const db = require('../config/database');
const { genererAlertesVaccins } = require('../utils/algorithms');

class Vaccin {
    // Programmer un vaccin
    static async create(vaccinData) {
        const { lot_id, date_programmee, type_vaccin } = vaccinData;
        const [result] = await db.query(
            'INSERT INTO vaccinations (lot_id, date_programmee, type_vaccin) VALUES (?, ?, ?)',
            [lot_id, date_programmee, type_vaccin]
        );
        return result.insertId;
    }

    // Récupérer tous les vaccins d'un utilisateur
    static async findAllByUser(userId) {
        const [vaccins] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ?
             ORDER BY v.date_programmee DESC`,
            [userId]
        );
        return vaccins;
    }

    // Marquer un vaccin comme effectué
    static async marquerEffectue(id) {
        const [result] = await db.query(
            'UPDATE vaccinations SET statut="effectue", date_effectuee=CURDATE() WHERE id=? AND statut="programme"',
            [id]
        );
        return result.affectedRows > 0;
    }

    // Obtenir les alertes vaccins
    static async getAlertes(userId, joursAlerte = 3) {
        const [vaccins] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ? 
             AND v.statut = 'programme'
             AND v.date_programmee >= CURDATE()
             AND v.date_programmee <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
            [userId, joursAlerte]
        );
        return genererAlertesVaccins(vaccins, joursAlerte);
    }
}

module.exports = Vaccin;