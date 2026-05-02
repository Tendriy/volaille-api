const db = require('../config/database');
const { genererAlertesVaccins } = require('../utils/algorithms');

// Programmer un vaccin
const addVaccin = async (req, res) => {
    const { lot_id, date_programmee, type_vaccin } = req.body;
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

        const result = await db.query(
            `INSERT INTO vaccinations (lot_id, date_programmee, type_vaccin) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [lot_id, date_programmee, type_vaccin]
        );

        res.status(201).json({ 
            message: 'Vaccin programmé avec succès', 
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Erreur addVaccin:', error);
        res.status(500).json({ error: 'Erreur lors de la programmation du vaccin: ' + error.message });
    }
};

// Voir tous les vaccins
const getAllVaccins = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1
             ORDER BY v.date_programmee DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur getAllVaccins:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des vaccins: ' + error.message });
    }
};

// Marquer vaccin comme effectué
const marquerEffectue = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            `UPDATE vaccinations 
             SET statut = 'effectue', date_effectuee = CURRENT_DATE 
             WHERE id = $1 AND statut = 'programme'`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé ou déjà effectué' });
        }

        res.json({ message: 'Vaccin marqué comme effectué' });
    } catch (error) {
        console.error('Erreur marquerEffectue:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du vaccin: ' + error.message });
    }
};

// Alertes vaccins (Algorithme 11.9)
const getAlertesVaccins = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1 
             AND v.statut = 'programme'
             AND v.date_programmee >= CURRENT_DATE
             ORDER BY v.date_programmee ASC`,
            [userId]
        );

        const alertes = genererAlertesVaccins(result.rows, 3);
        res.json(alertes);
    } catch (error) {
        console.error('Erreur getAlertesVaccins:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des alertes: ' + error.message });
    }
};

// Fonction supplémentaire: Récupérer les vaccins par lot
const getVaccinsByLot = async (req, res) => {
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

        const result = await db.query(
            `SELECT * FROM vaccinations 
             WHERE lot_id = $1 
             ORDER BY date_programmee DESC`,
            [lot_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur getVaccinsByLot:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des vaccins du lot: ' + error.message });
    }
};

// Fonction supplémentaire: Modifier un vaccin
const updateVaccin = async (req, res) => {
    const { id } = req.params;
    const { date_programmee, type_vaccin } = req.body;
    const userId = req.userId;

    try {
        // Vérifier que le vaccin appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT v.id FROM vaccinations v
             JOIN lots l ON v.lot_id = l.id
             WHERE v.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé ou non autorisé' });
        }

        const result = await db.query(
            `UPDATE vaccinations 
             SET date_programmee = $1, type_vaccin = $2 
             WHERE id = $3`,
            [date_programmee, type_vaccin, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé' });
        }

        res.json({ message: 'Vaccin modifié avec succès' });
    } catch (error) {
        console.error('Erreur updateVaccin:', error);
        res.status(500).json({ error: 'Erreur lors de la modification du vaccin: ' + error.message });
    }
};

// Fonction supplémentaire: Supprimer un vaccin
const deleteVaccin = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Vérifier que le vaccin appartient à l'utilisateur
        const checkResult = await db.query(
            `SELECT v.id FROM vaccinations v
             JOIN lots l ON v.lot_id = l.id
             WHERE v.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé ou non autorisé' });
        }

        const result = await db.query(
            'DELETE FROM vaccinations WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé' });
        }

        res.json({ message: 'Vaccin supprimé avec succès' });
    } catch (error) {
        console.error('Erreur deleteVaccin:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du vaccin: ' + error.message });
    }
};

// Fonction supplémentaire: Statistiques des vaccins
const getStatsVaccins = async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_vaccins,
                COUNT(CASE WHEN statut = 'programme' THEN 1 END) as programme,
                COUNT(CASE WHEN statut = 'effectue' THEN 1 END) as effectue,
                COUNT(CASE WHEN statut = 'programme' AND date_programmee < CURRENT_DATE THEN 1 END) as retard,
                COUNT(CASE WHEN statut = 'programme' AND date_programmee >= CURRENT_DATE 
                    AND date_programmee <= CURRENT_DATE + INTERVAL '3 days' THEN 1 END) as prochains_jours
             FROM vaccinations v
             JOIN lots l ON v.lot_id = l.id
             WHERE l.user_id = $1`,
            [userId]
        );

        const stats = result.rows[0];
        
        res.json({
            total_vaccins: parseInt(stats.total_vaccins),
            programme: parseInt(stats.programme),
            effectue: parseInt(stats.effectue),
            retard: parseInt(stats.retard),
            prochains_jours: parseInt(stats.prochains_jours),
            taux_realisation: stats.total_vaccins > 0 
                ? ((stats.effectue / stats.total_vaccins) * 100).toFixed(1)
                : 0
        });
    } catch (error) {
        console.error('Erreur getStatsVaccins:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques: ' + error.message });
    }
};

module.exports = { 
    addVaccin, 
    getAllVaccins, 
    marquerEffectue, 
    getAlertesVaccins,
    getVaccinsByLot,
    updateVaccin,
    deleteVaccin,
    getStatsVaccins
};