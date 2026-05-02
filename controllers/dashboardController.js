const db = require('../config/database');
const Lot = require('../models/Lot');
const Stock = require('../models/Stock');
const Vaccin = require('../models/Vaccin');

// Récupérer toutes les données du tableau de bord
const getDashboardData = async (req, res) => {
    const userId = req.userId;

    try {
        // 1. Récupérer tous les lots
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ?',
            [userId]
        );

        // 2. Compter les lots actifs
        const lotsActifs = lots.filter(lot => lot.statut === 'actif').length;

        // 3. Calculer le nombre total de volailles vivantes
        let totalVolailles = 0;
        for (const lot of lots) {
            if (lot.statut === 'actif') {
                const [morts] = await db.query(
                    'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
                    [lot.id]
                );
                const [ventes] = await db.query(
                    'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
                    [lot.id]
                );
                
                const totalMorts = morts[0].total_morts || 0;
                const totalVendus = ventes[0].total_vendus || 0;
                const restant = lot.nombre_initial - totalMorts - totalVendus;
                
                if (restant > 0) {
                    totalVolailles += restant;
                }
            }
        }

        // 4. Compter les alertes stock
        const [stock] = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = ?',
            [userId]
        );
        let alertesStock = 0;
        for (const item of stock) {
            if (item.quantite <= item.seuil_alerte) {
                alertesStock++;
            }
        }

        // 5. Compter les vaccins programmés
        const [vaccins] = await db.query(
            `SELECT v.* FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ? AND v.statut = 'programme' 
             AND v.date_programmee >= CURDATE()`,
            [userId]
        );
        const vaccinsProgrammes = vaccins.length;

        // 6. Retourner les données
        res.json({
            lots_actifs: lotsActifs,
            total_volailles: totalVolailles,
            alertes_stock: alertesStock,
            vaccins_programmes: vaccinsProgrammes
        });

    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des données du tableau de bord' });
    }
};

// Récupérer les lots récents (5 derniers)
const getRecentLots = async (req, res) => {
    const userId = req.userId;

    try {
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId]
        );

        for (let lot of lots) {
            const [morts] = await db.query(
                'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
                [lot.id]
            );
            const totalMorts = morts[0].total_morts || 0;
            lot.taux_mortalite = ((totalMorts / lot.nombre_initial) * 100).toFixed(2);
            
            const arrivee = new Date(lot.date_arrivee);
            const aujourdhui = new Date();
            const diffTime = Math.abs(aujourdhui - arrivee);
            lot.age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        res.json(lots);

    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des lots récents' });
    }
};

// Récupérer les alertes (stock + vaccins)
const getAlertes = async (req, res) => {
    const userId = req.userId;

    try {
        const [stock] = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = ?',
            [userId]
        );
        
        const alertesStock = stock.filter(item => item.quantite <= item.seuil_alerte).map(item => ({
            ...item,
            alerte: true,
            message_alerte: item.quantite <= item.seuil_alerte ? "ATTENTION : Stock faible" : "Stock suffisant"
        }));

        const [vaccins] = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = ? 
             AND v.statut = 'programme'
             AND v.date_programmee >= CURDATE()
             AND v.date_programmee <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)`,
            [userId]
        );

        const aujourdhui = new Date();
        const alertesVaccins = vaccins.map(vaccin => {
            const dateProgrammee = new Date(vaccin.date_programmee);
            const diffJours = Math.ceil((dateProgrammee - aujourdhui) / (1000 * 60 * 60 * 24));
            return {
                ...vaccin,
                message: `Vaccin ${vaccin.type_vaccin} dans ${diffJours} jour${diffJours > 1 ? 's' : ''}`
            };
        });

        res.json({
            alertesStock,
            alertesVaccins
        });

    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
    }
};

// Récupérer les ventes mensuelles
const getVentesMensuelles = async (req, res) => {
    const userId = req.userId;

    try {
        const [ventes] = await db.query(
            `SELECT v.* FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE l.user_id = ?
             ORDER BY v.date_vente`,
            [userId]
        );

        const ventesParMois = {};
        let chiffreAffairesTotal = 0;

        for (const vente of ventes) {
            const date = new Date(vente.date_vente);
            const mois = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const montant = vente.nombre_vendu * parseFloat(vente.prix_unitaire);
            
            if (!ventesParMois[mois]) {
                ventesParMois[mois] = 0;
            }
            ventesParMois[mois] += montant;
            chiffreAffairesTotal += montant;
        }

        res.json({
            ventes_mensuelles: ventesParMois,
            chiffre_affaires_total: chiffreAffairesTotal
        });

    } catch (error) {
        console.error('Erreur ventes mensuelles:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des ventes mensuelles' });
    }
};

// Récupérer le taux de mortalité mensuel
const getMortaliteMensuelle = async (req, res) => {
    const userId = req.userId;

    try {
        // Récupérer tous les lots
        const [lots] = await db.query(
            'SELECT * FROM lots WHERE user_id = ?',
            [userId]
        );

        const mortaliteParMois = {};

        for (const lot of lots) {
            // Récupérer les mortalités par mois
            const [mortalites] = await db.query(
                `SELECT 
                    DATE_FORMAT(date_suivi, '%Y-%m') as mois,
                    SUM(mortalite_jour) as total_morts
                 FROM suivi_quotidien
                 WHERE lot_id = ?
                 GROUP BY DATE_FORMAT(date_suivi, '%Y-%m')
                 ORDER BY mois`,
                [lot.id]
            );

            for (const mort of mortalites) {
                if (!mortaliteParMois[mort.mois]) {
                    mortaliteParMois[mort.mois] = {
                        total_morts: 0,
                        total_initial: 0
                    };
                }
                mortaliteParMois[mort.mois].total_morts += mort.total_morts;
                mortaliteParMois[mort.mois].total_initial += lot.nombre_initial;
            }
        }

        // Calculer les pourcentages
        const resultats = Object.keys(mortaliteParMois).map(mois => {
            const data = mortaliteParMois[mois];
            const taux = data.total_initial > 0 
                ? ((data.total_morts / data.total_initial) * 100).toFixed(1)
                : 0;
            return {
                mois: mois,
                taux: parseFloat(taux),
                total_morts: data.total_morts,
                total_initial: data.total_initial
            };
        }).sort((a, b) => a.mois.localeCompare(b.mois));

        res.json(resultats);

    } catch (error) {
        console.error('Erreur mortalité mensuelle:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la mortalité mensuelle' });
    }
};

// Récupérer toutes les données du dashboard en une seule requête
const getFullDashboard = async (req, res) => {
    const userId = req.userId;

    try {
        // Exécuter toutes les requêtes en parallèle
        const [lots, stock, vaccins, ventes, mortaliteMensuelle] = await Promise.all([
            db.query('SELECT * FROM lots WHERE user_id = ?', [userId]),
            db.query('SELECT * FROM stock_aliment WHERE user_id = ?', [userId]),
            db.query(
                `SELECT v.* FROM vaccinations v 
                 JOIN lots l ON v.lot_id = l.id 
                 WHERE l.user_id = ? AND v.statut = 'programme' 
                 AND v.date_programmee >= CURDATE()`,
                [userId]
            ),
            db.query(
                `SELECT v.* FROM ventes v
                 JOIN lots l ON v.lot_id = l.id
                 WHERE l.user_id = ?
                 ORDER BY v.date_vente`,
                [userId]
            ),
            db.query(
                `SELECT 
                    DATE_FORMAT(s.date_suivi, '%Y-%m') as mois,
                    SUM(s.mortalite_jour) as total_morts,
                    SUM(l.nombre_initial) as total_initial
                 FROM suivi_quotidien s
                 JOIN lots l ON s.lot_id = l.id
                 WHERE l.user_id = ?
                 GROUP BY DATE_FORMAT(s.date_suivi, '%Y-%m')
                 ORDER BY mois`,
                [userId]
            )
        ]);

        const lotsList = lots[0];
        const stockList = stock[0];
        const vaccinsList = vaccins[0];
        const ventesList = ventes[0];
        const mortaliteList = mortaliteMensuelle[0];

        // 1. Lots actifs
        const lotsActifs = lotsList.filter(lot => lot.statut === 'actif').length;

        // 2. Total volailles
        let totalVolailles = 0;
        for (const lot of lotsList) {
            if (lot.statut === 'actif') {
                const [morts] = await db.query(
                    'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
                    [lot.id]
                );
                const [ventes] = await db.query(
                    'SELECT SUM(nombre_vendu) as total_vendus FROM ventes WHERE lot_id = ?',
                    [lot.id]
                );
                const totalMorts = morts[0].total_morts || 0;
                const totalVendus = ventes[0].total_vendus || 0;
                const restant = lot.nombre_initial - totalMorts - totalVendus;
                if (restant > 0) totalVolailles += restant;
            }
        }

        // 3. Alertes stock
        let alertesStock = 0;
        for (const item of stockList) {
            if (item.quantite <= item.seuil_alerte) alertesStock++;
        }

        // 4. Vaccins programmés
        const vaccinsProgrammes = vaccinsList.length;

        // 5. Lots récents
        const lotsRecents = lotsList.slice(0, 5);
        for (let lot of lotsRecents) {
            const [morts] = await db.query(
                'SELECT SUM(mortalite_jour) as total_morts FROM suivi_quotidien WHERE lot_id = ?',
                [lot.id]
            );
            const totalMorts = morts[0].total_morts || 0;
            lot.taux_mortalite = ((totalMorts / lot.nombre_initial) * 100).toFixed(2);
            
            const arrivee = new Date(lot.date_arrivee);
            const aujourdhui = new Date();
            const diffTime = Math.abs(aujourdhui - arrivee);
            lot.age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // 6. Alertes détaillées
        const alertesStockDetail = stockList.filter(item => item.quantite <= item.seuil_alerte).map(item => ({
            ...item,
            alerte: true,
            message_alerte: "ATTENTION : Stock faible"
        }));

        const aujourdhui = new Date();
        const alertesVaccinsDetail = vaccinsList.filter(v => {
            const dateProgrammee = new Date(v.date_programmee);
            const diffJours = Math.ceil((dateProgrammee - aujourdhui) / (1000 * 60 * 60 * 24));
            return diffJours <= 3 && diffJours >= 0;
        }).map(v => {
            const dateProgrammee = new Date(v.date_programmee);
            const diffJours = Math.ceil((dateProgrammee - aujourdhui) / (1000 * 60 * 60 * 24));
            return {
                ...v,
                message: `Vaccin ${v.type_vaccin} dans ${diffJours} jour${diffJours > 1 ? 's' : ''}`
            };
        });

        // 7. Ventes mensuelles
        const ventesParMois = {};
        let chiffreAffairesTotal = 0;
        for (const vente of ventesList) {
            const date = new Date(vente.date_vente);
            const mois = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const montant = vente.nombre_vendu * parseFloat(vente.prix_unitaire);
            
            if (!ventesParMois[mois]) {
                ventesParMois[mois] = 0;
            }
            ventesParMois[mois] += montant;
            chiffreAffairesTotal += montant;
        }

        // 8. Taux de mortalité mensuel
        const mortaliteData = mortaliteList.map(item => ({
            mois: item.mois,
            taux: item.total_initial > 0 ? parseFloat(((item.total_morts / item.total_initial) * 100).toFixed(1)) : 0,
            total_morts: item.total_morts,
            total_initial: item.total_initial
        }));

        res.json({
            resume: {
                lots_actifs: lotsActifs,
                total_volailles: totalVolailles,
                alertes_stock: alertesStock,
                vaccins_programmes: vaccinsProgrammes
            },
            lotsRecents,
            alertesStock: alertesStockDetail,
            alertesVaccins: alertesVaccinsDetail,
            ventesMensuelles: ventesParMois,
            chiffreAffairesTotal: chiffreAffairesTotal,
            mortaliteMensuelle: mortaliteData
        });

    } catch (error) {
        console.error('Erreur dashboard complet:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données' });
    }
};

module.exports = { 
    getDashboardData, 
    getRecentLots, 
    getAlertes,
    getFullDashboard,
    getVentesMensuelles,
    getMortaliteMensuelle
};