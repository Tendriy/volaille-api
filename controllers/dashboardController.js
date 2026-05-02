const db = require('../config/database');
const Lot = require('../models/Lot');
const Stock = require('../models/Stock');
const Vaccin = require('../models/Vaccin');

// Récupérer toutes les données du tableau de bord
const getDashboardData = async (req, res) => {
    const userId = req.userId;

    try {
        // 1. Récupérer tous les lots
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE user_id = $1',
            [userId]
        );
        const lots = lotsResult.rows;

        // 2. Compter les lots actifs
        const lotsActifs = lots.filter(lot => lot.statut === 'actif').length;

        // 3. Calculer le nombre total de volailles vivantes
        let totalVolailles = 0;
        for (const lot of lots) {
            if (lot.statut === 'actif') {
                const mortsResult = await db.query(
                    'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
                    [lot.id]
                );
                const ventesResult = await db.query(
                    'SELECT COALESCE(SUM(nombre_vendu), 0) as total_vendus FROM ventes WHERE lot_id = $1',
                    [lot.id]
                );
                
                const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
                const totalVendus = parseInt(ventesResult.rows[0].total_vendus) || 0;
                const restant = lot.nombre_initial - totalMorts - totalVendus;
                
                if (restant > 0) {
                    totalVolailles += restant;
                }
            }
        }

        // 4. Compter les alertes stock
        const stockResult = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = $1',
            [userId]
        );
        const stock = stockResult.rows;
        let alertesStock = 0;
        for (const item of stock) {
            if (item.quantite <= item.seuil_alerte) {
                alertesStock++;
            }
        }

        // 5. Compter les vaccins programmés
        const vaccinsResult = await db.query(
            `SELECT v.* FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1 AND v.statut = 'programme' 
             AND v.date_programmee >= CURRENT_DATE`,
            [userId]
        );
        const vaccinsProgrammes = vaccinsResult.rows.length;

        // 6. Retourner les données
        res.json({
            lots_actifs: lotsActifs,
            total_volailles: totalVolailles,
            alertes_stock: alertesStock,
            vaccins_programmes: vaccinsProgrammes
        });

    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données du tableau de bord' });
    }
};

// Récupérer les lots récents (5 derniers)
const getRecentLots = async (req, res) => {
    const userId = req.userId;

    try {
        const lotsResult = await db.query(
            'SELECT * FROM lots WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
            [userId]
        );
        const lots = lotsResult.rows;

        for (let lot of lots) {
            const mortsResult = await db.query(
                'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
                [lot.id]
            );
            const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
            lot.taux_mortalite = ((totalMorts / lot.nombre_initial) * 100).toFixed(2);
            
            const arrivee = new Date(lot.date_arrivee);
            const aujourdhui = new Date();
            const diffTime = Math.abs(aujourdhui - arrivee);
            lot.age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        res.json(lots);

    } catch (error) {
        console.error('Erreur lots récents:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des lots récents' });
    }
};

// Récupérer les alertes (stock + vaccins)
const getAlertes = async (req, res) => {
    const userId = req.userId;

    try {
        const stockResult = await db.query(
            'SELECT * FROM stock_aliment WHERE user_id = $1',
            [userId]
        );
        const stock = stockResult.rows;
        
        const alertesStock = stock.filter(item => item.quantite <= item.seuil_alerte).map(item => ({
            ...item,
            alerte: true,
            message_alerte: item.quantite <= item.seuil_alerte ? "ATTENTION : Stock faible" : "Stock suffisant"
        }));

        const vaccinsResult = await db.query(
            `SELECT v.*, l.nom_lot 
             FROM vaccinations v 
             JOIN lots l ON v.lot_id = l.id 
             WHERE l.user_id = $1 
             AND v.statut = 'programme'
             AND v.date_programmee >= CURRENT_DATE
             AND v.date_programmee <= CURRENT_DATE + $2 * INTERVAL '1 day'`,
            [userId, 3]
        );

        const aujourdhui = new Date();
        const alertesVaccins = vaccinsResult.rows.map(vaccin => {
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
        console.error('Erreur alertes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
    }
};

// Récupérer les ventes mensuelles
const getVentesMensuelles = async (req, res) => {
    const userId = req.userId;

    try {
        const ventesResult = await db.query(
            `SELECT v.* FROM ventes v
             JOIN lots l ON v.lot_id = l.id
             WHERE l.user_id = $1
             ORDER BY v.date_vente`,
            [userId]
        );

        const ventes = ventesResult.rows;
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
        // Pour PostgreSQL, utiliser TO_CHAR pour formater la date
        const mortaliteResult = await db.query(
            `SELECT 
                TO_CHAR(s.date_suivi, 'YYYY-MM') as mois,
                COALESCE(SUM(s.mortalite_jour), 0) as total_morts,
                SUM(l.nombre_initial) as total_initial
             FROM suivi_quotidien s
             JOIN lots l ON s.lot_id = l.id
             WHERE l.user_id = $1
             GROUP BY TO_CHAR(s.date_suivi, 'YYYY-MM')
             ORDER BY mois`,
            [userId]
        );

        const resultats = mortaliteResult.rows.map(item => {
            const taux = item.total_initial > 0 
                ? ((item.total_morts / item.total_initial) * 100).toFixed(1)
                : 0;
            return {
                mois: item.mois,
                taux: parseFloat(taux),
                total_morts: parseInt(item.total_morts),
                total_initial: parseInt(item.total_initial)
            };
        });

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
        const [lotsResult, stockResult, vaccinsResult, ventesResult, mortaliteResult] = await Promise.all([
            db.query('SELECT * FROM lots WHERE user_id = $1', [userId]),
            db.query('SELECT * FROM stock_aliment WHERE user_id = $1', [userId]),
            db.query(
                `SELECT v.* FROM vaccinations v 
                 JOIN lots l ON v.lot_id = l.id 
                 WHERE l.user_id = $1 AND v.statut = 'programme' 
                 AND v.date_programmee >= CURRENT_DATE`,
                [userId]
            ),
            db.query(
                `SELECT v.* FROM ventes v
                 JOIN lots l ON v.lot_id = l.id
                 WHERE l.user_id = $1
                 ORDER BY v.date_vente`,
                [userId]
            ),
            db.query(
                `SELECT 
                    TO_CHAR(s.date_suivi, 'YYYY-MM') as mois,
                    COALESCE(SUM(s.mortalite_jour), 0) as total_morts,
                    SUM(l.nombre_initial) as total_initial
                 FROM suivi_quotidien s
                 JOIN lots l ON s.lot_id = l.id
                 WHERE l.user_id = $1
                 GROUP BY TO_CHAR(s.date_suivi, 'YYYY-MM')
                 ORDER BY mois`,
                [userId]
            )
        ]);

        const lots = lotsResult.rows;
        const stock = stockResult.rows;
        const vaccins = vaccinsResult.rows;
        const ventes = ventesResult.rows;
        const mortaliteData = mortaliteResult.rows;

        // 1. Lots actifs
        const lotsActifs = lots.filter(lot => lot.statut === 'actif').length;

        // 2. Total volailles
        let totalVolailles = 0;
        for (const lot of lots) {
            if (lot.statut === 'actif') {
                const mortsResult = await db.query(
                    'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
                    [lot.id]
                );
                const ventesLotResult = await db.query(
                    'SELECT COALESCE(SUM(nombre_vendu), 0) as total_vendus FROM ventes WHERE lot_id = $1',
                    [lot.id]
                );
                const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
                const totalVendus = parseInt(ventesLotResult.rows[0].total_vendus) || 0;
                const restant = lot.nombre_initial - totalMorts - totalVendus;
                if (restant > 0) totalVolailles += restant;
            }
        }

        // 3. Alertes stock
        let alertesStock = 0;
        for (const item of stock) {
            if (item.quantite <= item.seuil_alerte) alertesStock++;
        }

        // 4. Vaccins programmés
        const vaccinsProgrammes = vaccins.length;

        // 5. Lots récents
        const lotsRecents = lots.slice(0, 5);
        for (let lot of lotsRecents) {
            const mortsResult = await db.query(
                'SELECT COALESCE(SUM(mortalite_jour), 0) as total_morts FROM suivi_quotidien WHERE lot_id = $1',
                [lot.id]
            );
            const totalMorts = parseInt(mortsResult.rows[0].total_morts) || 0;
            lot.taux_mortalite = ((totalMorts / lot.nombre_initial) * 100).toFixed(2);
            
            const arrivee = new Date(lot.date_arrivee);
            const aujourdhui = new Date();
            const diffTime = Math.abs(aujourdhui - arrivee);
            lot.age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // 6. Alertes détaillées
        const alertesStockDetail = stock.filter(item => item.quantite <= item.seuil_alerte).map(item => ({
            ...item,
            alerte: true,
            message_alerte: "ATTENTION : Stock faible"
        }));

        const aujourdhui = new Date();
        const alertesVaccinsDetail = vaccins.filter(v => {
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

        // 8. Taux de mortalité mensuel
        const mortaliteFormatted = mortaliteData.map(item => ({
            mois: item.mois,
            taux: item.total_initial > 0 ? parseFloat(((item.total_morts / item.total_initial) * 100).toFixed(1)) : 0,
            total_morts: parseInt(item.total_morts),
            total_initial: parseInt(item.total_initial)
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
            mortaliteMensuelle: mortaliteFormatted
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