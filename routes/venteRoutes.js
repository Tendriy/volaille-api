const express = require('express');
const { addVente, getAllVentes, getVentesByLot } = require('../controllers/venteController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', addVente);
router.get('/', getAllVentes);
router.get('/lot/:lot_id', getVentesByLot);

module.exports = router;