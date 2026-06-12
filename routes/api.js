const express = require('express');
const router = express.Router();
const ac = require('../controllers/apiController');
const { isAuthenticated, isPimpinan, isPegawai } = require('../middlewares/auth');

// Tugas API
router.get('/tugas', isAuthenticated, ac.getTugas);
router.get('/tugas/:id', isAuthenticated, ac.getTugasById);
router.post('/tugas', isAuthenticated, isPimpinan, ac.createTugasApi);
router.put('/tugas/:id', isAuthenticated, isPimpinan, ac.updateTugasApi);
router.delete('/tugas/:id', isAuthenticated, isPimpinan, ac.deleteTugasApi);

// Submission API (Pegawai)
router.get('/my-tugas', isAuthenticated, isPegawai, ac.getMyTugas);
router.post('/tugas/:id/submit', isAuthenticated, isPegawai, ac.submitTugasApi);

// Logbook API
router.get('/logbook', isAuthenticated, ac.getLogbook);

// Monitoring API
router.get('/monitoring', isAuthenticated, isPimpinan, ac.getMonitoring);

module.exports = router;
