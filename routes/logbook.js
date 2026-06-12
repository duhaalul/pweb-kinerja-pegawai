const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const lc = require('../controllers/logbookController');
const { isAuthenticated, isPimpinan, isPegawai } = require('../middlewares/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Pegawai
router.get('/', isAuthenticated, isPegawai, lc.index);
router.get('/create', isAuthenticated, isPegawai, lc.createForm);
router.post('/create', isAuthenticated, isPegawai, upload.single('attachment'), lc.store);
router.get('/:id/edit', isAuthenticated, isPegawai, lc.editForm);
router.post('/:id/edit', isAuthenticated, isPegawai, upload.single('attachment'), lc.update);
router.post('/:id/delete', isAuthenticated, isPegawai, lc.destroy);

// Pimpinan
router.get('/pimpinan', isAuthenticated, isPimpinan, lc.pimpinanIndex);
router.post('/:id/approve', isAuthenticated, isPimpinan, lc.approve);
router.post('/:id/reject', isAuthenticated, isPimpinan, lc.reject);
router.get('/export/pdf', isAuthenticated, isPimpinan, lc.exportPdf);

module.exports = router;
