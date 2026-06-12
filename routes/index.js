var express = require('express');
var router = express.Router();
const indexController = require('../controllers/indexController');
const { isAuthenticated } = require('../middlewares/auth');

router.get('/', indexController.index);
router.get('/login', indexController.loginPage);
router.post('/login', indexController.login);
router.get('/logout', isAuthenticated, indexController.logout);

module.exports = router;
