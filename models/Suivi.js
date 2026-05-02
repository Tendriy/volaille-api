const db = require('../config/database');

class Suivi {
    // Ajouter un suivi quotidien
    static async create(suiviData) {
        const { lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations } = suiviData;
        const result = await db.query(
            `INSERT INTO suivi_quotidien 
             (lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id`,
            [lot_id, date_suivi, temperature, consommation_aliment, consommations, mortalite_jour, observations]
        );
        return result.rows[0].id;
    }

    // Récupérer les suivis d'un lot
    static async findByLotId(lot_id, userId = null) {
        let query = `
            SELECT s.* 
            FROM suivi_quotidien s
            JOIN lots l ON s.lot_id = l.id
            WHERE s.lot_id = $1
        `;
        const params = [lot_id];
        
        if (userId) {
            query += ' AND l.user_id = $2';
            params.push(userId);
        }
        
        query += ' ORDER BY s.date_suivi DESC';
        
        const result = await db.query(query, params);
        const suivis = result.rows;
        
        // Ajouter le total des consommations pour affichage
        for (let suivi of suivis) {
            if (suivi.consommations) {
                try {
                    const consos = JSON.parse(suivi.consommations);
                    suivi.total_consommation = consos.reduce((sum, c) => sum + (parseFloat(c.quantite) || 0), 0);
                } catch(e) {
                    suivi.total_consommation = suivi.consommation_aliment || 0;
                }
            } else {
                suivi.total_consommation = suivi.consommation_aliment || 0;
            }
        }
        
        return suivis;
    }

    // Mettre à jour un suivi
    static async update(id, suiviData) {
        const { temperature, consommation_aliment, consommations, mortalite_jour, observations } = suiviData;
        const result = await db.query(
            `UPDATE suivi_quotidien 
             SET temperature = $1, consommation_aliment = $2, consommations = $3, mortalite_jour = $4, observations = $5 
             WHERE id = $6`,
            [temperature, consommation_aliment, consommations, mortalite_jour, observations, id]
        );
        return result.rowCount > 0;
    }

    // Vérifier si un suivi existe pour une date
    static async existsForDate(lot_id, date_suivi) {
        const result = await db.query(
            'SELECT id FROM suivi_quotidien WHERE lot_id = $1 AND date_suivi = $2',
            [lot_id, date_suivi]
        );
        return result.rows.length > 0;
    }

    // Obtenir les statistiques d'un lot
    static async getStatsByLotId(lot_id) {
        const result = await db.query(
            `SELECT 
                COALESCE(SUM(mortalite_jour), 0) as total_morts,
                COALESCE(AVG(temperature), 0) as temperature_moyenne,
                COALESCE(SUM(consommation_aliment), 0) as consommation_totale,
                COUNT(*) as nombre_jours
             FROM suivi_quotidien 
             WHERE lot_id = $1`,
            [lot_id]
        );
        return result.rows[0];
    }
}

module.exports = Suivi;