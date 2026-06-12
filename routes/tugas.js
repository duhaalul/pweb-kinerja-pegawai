const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const tc = require('../controllers/tugasController');
const { isAuthenticated, isPimpinan, isPegawai } = require('../middlewares/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Pimpinan
router.get('/', isAuthenticated, isPimpinan, tc.index);
router.get('/create', isAuthenticated, isPimpinan, tc.createForm);
router.post('/create', isAuthenticated, isPimpinan, tc.store);
router.get('/export/excel', isAuthenticated, isPimpinan, tc.exportExcel);
router.get('/:id/edit', isAuthenticated, isPimpinan, tc.editForm);
router.post('/:id/edit', isAuthenticated, isPimpinan, tc.update);
router.post('/:id/delete', isAuthenticated, isPimpinan, tc.destroy);
router.get('/:id/detail', isAuthenticated, tc.detail);
router.post('/:id/revisi', isAuthenticated, isPimpinan, tc.revisi);
router.post('/:id/selesai', isAuthenticated, isPimpinan, tc.selesai);

// Pegawai
router.get('/pegawai', isAuthenticated, isPegawai, tc.pegawaiIndex);
router.get('/:id/submit', isAuthenticated, isPegawai, tc.submitForm);
router.post('/:id/submit', isAuthenticated, isPegawai, upload.single('attachment'), tc.submitStore);

module.exports = router;
