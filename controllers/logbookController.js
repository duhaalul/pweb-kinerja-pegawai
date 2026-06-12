const db = require('../lib/db');
const PDFDocument = require('pdfkit');

// ===================== PEGAWAI =====================

// GET /logbook - list logbook milik pegawai
const index = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const [rows] = await db.query(
      `SELECT * FROM assignment_progress
       WHERE employee_id = ? AND description LIKE ?
       ORDER BY progress_date DESC LIMIT ? OFFSET ?`,
      [req.session.userId, `%${search}%`, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignment_progress WHERE employee_id = ? AND description LIKE ?`,
      [req.session.userId, `%${search}%`]
    );

    res.render('logbook/index', {
      title: 'Logbook Saya',
      logbooks: rows, search,
      currentPage: page, totalPages: Math.ceil(total / limit),
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// GET /logbook/create
const createForm = (req, res) => {
  res.render('logbook/create', {
    title: 'Tambah Logbook', errors: [],
    user: { name: req.session.userName, role: req.session.userRole }
  });
};

// POST /logbook/create
const store = async (req, res, next) => {
  const { description, progress_date } = req.body;
  const errors = [];
  if (!description) errors.push('Deskripsi kegiatan wajib diisi.');
  if (!progress_date) errors.push('Tanggal wajib diisi.');

  if (errors.length > 0) {
    return res.render('logbook/create', {
      title: 'Tambah Logbook', errors,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  }
  try {
    const attachment = req.file ? req.file.filename : null;
    // Simpan logbook sebagai assignment_progress tanpa assignment_id
    // Kita gunakan assignment_id = 0 sebagai logbook bebas
    await db.query(
      `INSERT INTO assignment_progress (assignment_id, description, progress_date, status, attachment, created_by, employee_id, created_at, updated_at)
       VALUES (0, ?, ?, 'in_progress', ?, ?, ?, NOW(), NOW())`,
      [description, progress_date, attachment, req.session.userId, req.session.userId]
    );
    req.session.flashSuccess = 'Logbook berhasil ditambahkan.';
    res.redirect('/logbook');
  } catch (err) { next(err); }
};

// GET /logbook/:id/edit
const editForm = async (req, res, next) => {
  try {
    const [[logbook]] = await db.query(
      'SELECT * FROM assignment_progress WHERE id = ? AND employee_id = ?',
      [req.params.id, req.session.userId]
    );
    if (!logbook) return res.redirect('/logbook');
    res.render('logbook/edit', {
      title: 'Edit Logbook', logbook, errors: [],
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /logbook/:id/edit
const update = async (req, res, next) => {
  const { description, progress_date } = req.body;
  const errors = [];
  if (!description) errors.push('Deskripsi wajib diisi.');

  if (errors.length > 0) {
    const [[logbook]] = await db.query('SELECT * FROM assignment_progress WHERE id = ?', [req.params.id]);
    return res.render('logbook/edit', {
      title: 'Edit Logbook', logbook, errors,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  }
  try {
    const attachment = req.file ? req.file.filename : null;
    if (attachment) {
      await db.query(
        'UPDATE assignment_progress SET description=?, progress_date=?, attachment=?, updated_at=NOW() WHERE id=? AND employee_id=?',
        [description, progress_date, attachment, req.params.id, req.session.userId]
      );
    } else {
      await db.query(
        'UPDATE assignment_progress SET description=?, progress_date=?, updated_at=NOW() WHERE id=? AND employee_id=?',
        [description, progress_date, req.params.id, req.session.userId]
      );
    }
    req.session.flashSuccess = 'Logbook berhasil diperbarui.';
    res.redirect('/logbook');
  } catch (err) { next(err); }
};

// POST /logbook/:id/delete
const destroy = async (req, res, next) => {
  try {
    await db.query('DELETE FROM assignment_progress WHERE id=? AND employee_id=?', [req.params.id, req.session.userId]);
    req.session.flashSuccess = 'Logbook berhasil dihapus.';
    res.redirect('/logbook');
  } catch (err) { next(err); }
};

// ===================== PIMPINAN =====================

// GET /logbook/pimpinan - semua logbook pegawai
const pimpinanIndex = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const filterDate = req.query.date || '';
    const filterDateEnd = req.query.date_end || '';
    const filterEmployee = req.query.employee_id || '';

    let where = 'WHERE ap.assignment_id = 0';
    const params = [];

    if (search) { where += ' AND (ap.description LIKE ? OR e.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (filterEmployee) { where += ' AND ap.employee_id = ?'; params.push(filterEmployee); }
    if (filterDate) { where += ' AND ap.progress_date >= ?'; params.push(filterDate); }
    if (filterDateEnd) { where += ' AND ap.progress_date <= ?'; params.push(filterDateEnd); }

    const [rows] = await db.query(
      `SELECT ap.*, e.name AS employee_name
       FROM assignment_progress ap
       LEFT JOIN employees e ON ap.employee_id = e.id
       ${where} ORDER BY ap.progress_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignment_progress ap LEFT JOIN employees e ON ap.employee_id = e.id ${where}`,
      params
    );
    const [employees] = await db.query(`SELECT id, name FROM employees WHERE status='active'`);

    res.render('logbook/pimpinan-index', {
      title: 'Logbook Pegawai',
      logbooks: rows, employees, search, filterDate, filterDateEnd, filterEmployee,
      currentPage: page, totalPages: Math.ceil(total / limit),
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /logbook/:id/approve
const approve = async (req, res, next) => {
  try {
    await db.query(
      `UPDATE assignment_progress SET status='completed', updated_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    req.session.flashSuccess = 'Logbook disetujui.';
    res.redirect('/logbook/pimpinan');
  } catch (err) { next(err); }
};

// POST /logbook/:id/reject
const reject = async (req, res, next) => {
  const { catatan } = req.body;
  try {
    await db.query(
      `UPDATE assignment_progress SET status='in_progress', description=CONCAT(description, '\n[Ditolak: ', ?, ']'), updated_at=NOW() WHERE id=?`,
      [catatan || 'Mohon diperbaiki.', req.params.id]
    );
    req.session.flashSuccess = 'Logbook ditolak dengan catatan.';
    res.redirect('/logbook/pimpinan');
  } catch (err) { next(err); }
};

// GET /logbook/export/pdf
const exportPdf = async (req, res, next) => {
  try {
    const filterEmployee = req.query.employee_id || '';
    const filterDate = req.query.date || '';
    const filterDateEnd = req.query.date_end || '';

    let where = 'WHERE ap.assignment_id = 0';
    const params = [];
    if (filterEmployee) { where += ' AND ap.employee_id = ?'; params.push(filterEmployee); }
    if (filterDate) { where += ' AND ap.progress_date >= ?'; params.push(filterDate); }
    if (filterDateEnd) { where += ' AND ap.progress_date <= ?'; params.push(filterDateEnd); }

    const [rows] = await db.query(
      `SELECT ap.*, e.name AS employee_name
       FROM assignment_progress ap
       LEFT JOIN employees e ON ap.employee_id = e.id
       ${where} ORDER BY ap.progress_date DESC`,
      params
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=logbook-pegawai.pdf');
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('Laporan Logbook Pegawai', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center' });
    doc.moveDown();

    rows.forEach((lb, i) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${i + 1}. ${lb.employee_name || '-'} — ${new Date(lb.progress_date).toLocaleDateString('id-ID')}`);
      doc.fontSize(10).font('Helvetica').text(lb.description || '-', { indent: 20 });
      doc.fontSize(9).fillColor('#555').text(`Status: ${lb.status}`, { indent: 20 });
      doc.fillColor('#000').moveDown(0.5);
    });

    doc.end();
  } catch (err) { next(err); }
};

module.exports = {
  index, createForm, store, editForm, update, destroy,
  pimpinanIndex, approve, reject, exportPdf
};
