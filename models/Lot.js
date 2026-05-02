const db = require('../config/database');
const { calculTauxMortalite, calculerAge } = require('../utils/algorithms');
const Suivi = require('./Suivi');
const Vaccin = require('./Vaccin');
const Vente = require('./Vente');

class Lot {
    // Créer un lot
    static async create(lotData) {
        const { user_id, nom_lot, race, fournisseur, nombre_initial, date_arrivee } = lotData;
        const [result] = await db.query(
            'INSERT INTO lots (user_id, nom_lot, race, fournisseur, nombre_initial, date_arrivee) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, nom_lot, race, fournisseur, nombre_initial, date_arrivee]
        );
        return result.insertId;
    }

    // Trouver tous les lots d'un utilisateur avec calculs complets
    static async findAllByUser(userId) {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Ajouter les calculs pour chaque lot
        for (let lot of lots) {
            // Récupérer les statistiques de suivi
            const stats = await Suivi.getStatsByLotId(lot.id);
            const totalMorts = stats.total_morts || 0;
            
            // Récupérer le total des ventes
            const totalVendus = await Vente.getTotalVendusByLotId(lot.id);
            
            // Calculer le nombre restant
            const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
            
            lot.total_morts = totalMorts;
            lot.total_vendus = totalVendus;
            lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
            lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
            lot.age = calculerAge(lot.date_arrivee);
            lot.consommation_totale = stats.consommation_totale || 0;
        }

        return lots;
    }

    // Trouver un lot par ID
    static async findById(id, userId) {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (lots.length === 0) return null;

        const lot = lots[0];
        const stats = await Suivi.getStatsByLotId(lot.id);
        const totalMorts = stats.total_morts || 0;
        const totalVendus = await Vente.getTotalVendusByLotId(lot.id);
        const nombreRestant = lot.nombre_initial - totalMorts - totalVendus;
        
        lot.total_morts = totalMorts;
        lot.total_vendus = totalVendus;
        lot.nombre_restant = nombreRestant > 0 ? nombreRestant : 0;
        lot.taux_mortalite = calculTauxMortalite(lot.nombre_initial, totalMorts);
        lot.age = calculerAge(lot.date_arrivee);
        lot.consommation_totale = stats.consommation_totale || 0;

        return lot;
    }

    // Trouver un lot avec toutes ses données (suivis, vaccins, ventes)
    static async findCompleteById(id, userId) {
        const lot = await this.findById(id, userId);
        if (!lot) return null;

        const suivis = await Suivi.findByLotId(id, userId);
        const vaccins = await Vaccin.findByLotId(id, userId);
        const ventes = await Vente.findByLotId(id, userId);

        return {
            ...lot,
            suivis,
            vaccins,
            ventes
        };
    }

    // Mettre à jour un lot
    static async update(id, userId, lotData) {
        const { nom_lot, race, fournisseur, nombre_initial, statut } = lotData;
        const [result] = await db.query(
            'UPDATE lots SET nom_lot=?, race=?, fournisseur=?, nombre_initial=?, statut=? WHERE id=? AND user_id=?',
            [nom_lot, race, fournisseur, nombre_initial, statut, id, userId]
        );
        return result.affectedRows > 0;
    }

    // Supprimer un lot
    static async delete(id, userId) {
        const [result] = await db.query(
            'DELETE FROM lots WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    // Clôturer un lot
    static async cloturer(id, userId) {
        const [result] = await db.query(
            'UPDATE lots SET statut="cloture" WHERE id=? AND user_id=? AND statut="actif"',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    // Obtenir les lots actifs d'un utilisateur
    static async findActiveByUser(userId) {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ? AND statut = "actif" ORDER BY created_at DESC',
            [userId]
        );

        for (let lot of lots) {
            lot.age = calculerAge(lot.date_arrivee);
        }

        return lots;
    }

    // Compter les lots actifs d'un utilisateur
    static async countActive(userId) {
        const [result] = await db.query(
            'SELECT COUNT(*) as count FROM lots WHERE user_id = ? AND statut = "actif"',
            [userId]
        );
        return result[0].count;
    }

    // Compter le nombre total de volailles actives
    static async countTotalVolailles(userId) {
        const lots = await this.findAllByUser(userId);
        
        let total = 0;
        for (let lot of lots) {
            if (lot.statut === 'actif' && lot.nombre_restant > 0) {
                total += lot.nombre_restant;
            }
        }
        
        return total;
    }
}

module.exports = Lot;