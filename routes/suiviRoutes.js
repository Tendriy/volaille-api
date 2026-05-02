const express = require('express');
const { addSuivi, getSuiviByLot, updateSuivi } = require('../controllers/suiviController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', addSuivi);
router.get('/lot/:lot_id', getSuiviByLot);
router.put('/:id', updateSuivi);

module.exports = router;