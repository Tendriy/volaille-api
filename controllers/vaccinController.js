const db = require('../config/database');
const { genererAlertesVaccins } = require('../utils/algorithms');

// Programmer un vaccin
const addVaccin = async (req, res) => {
    const { lot_id, date_programmee, type_vaccin } = req.body;
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

        const [result] = await db.query(
            'INSERT INTO vaccinations (lot_id, date_programmee, type_vaccin) VALUES (?, ?, ?)',
            [lot_id, date_programmee, type_vaccin]
        );

        res.status(201).json({ message: 'Vaccin programmé avec succès', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la programmation du vaccin' });
    }
};

// Voir tous les vaccins
const getAllVaccins = async (req, res) => {
    const userId = req.userId;

    try {
        const [vaccins] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ?
             ORDER BY v.date_programmee DESC`,
            [userId]
        );

        res.json(vaccins);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des vaccins' });
    }
};

// Marquer vaccin comme effectué
const marquerEffectue = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            'UPDATE vaccinations SET statut="effectue", date_effectuee=CURDATE() WHERE id=?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vaccin non trouvé' });
        }

        res.json({ message: 'Vaccin marqué comme effectué' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du vaccin' });
    }
};

// Alertes vaccins (Algorithme 11.9)
const getAlertesVaccins = async (req, res) => {
    const userId = req.userId;

    try {
        const [vaccins] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ? AND v.statut = 'programme'
             AND v.date_programmee >= CURDATE()`,
            [userId]
        );

        const alertes = genererAlertesVaccins(vaccins, 3);
        res.json(alertes);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
    }
};

module.exports = { addVaccin, getAllVaccins, marquerEffectue, getAlertesVaccins };