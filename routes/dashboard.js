const express = require('express');
const router = express.Router();
const dc = require('../controllers/dashboardController');
const { isAuthenticated, isPimpinan } = require('../middlewares/auth');

router.get('/', isAuthenticated, dc.index);
router.get('/monitoring', isAuthenticated, isPimpinan, dc.monitoring);

module.exports = router;
