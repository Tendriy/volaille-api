const express = require('express');
const { addVaccin, getAllVaccins, marquerEffectue, getAlertesVaccins } = require('../controllers/vaccinController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', addVaccin);
router.get('/', getAllVaccins);
router.get('/alertes', getAlertesVaccins);
router.put('/:id/effectuer', marquerEffectue);

module.exports = router;