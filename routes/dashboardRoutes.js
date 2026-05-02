const express = require('express');
const { 
    getDashboardData, 
    getRecentLots, 
    getAlertes,
    getFullDashboard,
    getVentesMensuelles,
    getMortaliteMensuelle
} = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Toutes les routes du dashboard nécessitent une authentification
router.use(authenticateToken);

// Route principale du dashboard (pour les statistiques)
router.get('/', getDashboardData);

// Route pour les lots récents
router.get('/recent-lots', getRecentLots);

// Route pour les alertes
router.get('/alertes', getAlertes);

// Route complète (tout en une seule requête)
router.get('/full', getFullDashboard);

// Route pour les ventes mensuelles
router.get('/ventes-mensuelles', getVentesMensuelles);

// Route pour le taux de mortalité mensuel
router.get('/mortalite-mensuelle', getMortaliteMensuelle);

module.exports = router;