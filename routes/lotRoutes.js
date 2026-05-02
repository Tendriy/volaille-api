const express = require('express');
const {
    addLot,
    getAllLots,
    getLotById,
    updateLot,
    deleteLot,
    cloturerLot,
    searchLots,
    fusionnerTousLesLotsDoublons
} = require('../controllers/lotController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Routes principales
router.post('/', addLot);
router.get('/', getAllLots);
router.get('/search', searchLots);
router.get('/:id', getLotById);
router.put('/:id', updateLot);
router.delete('/:id', deleteLot);
router.put('/:id/cloturer', cloturerLot);

// Route pour fusionner tous les lots en double (même nom + même race)
router.post('/fusionner', fusionnerTousLesLotsDoublons);

module.exports = router;