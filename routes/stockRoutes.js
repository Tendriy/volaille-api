const express = require('express');
const { addStock, getAllStock, updateStock, deleteStock } = require('../controllers/stockController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', addStock);
router.get('/', getAllStock);
router.put('/:id', updateStock);
router.delete('/:id', deleteStock);

module.exports = router;