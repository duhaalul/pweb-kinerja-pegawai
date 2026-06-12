const db = require('../lib/db');
const ExcelJS = require('exceljs');

// ===================== PIMPINAN =====================

// GET /tugas - list semua penugasan (pimpinan)
const index = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const searchParam = `%${search}%`;
    const [rows] = await db.query(
      `SELECT a.*, 
        e1.name AS assigned_by_name, 
        e2.name AS assigned_to_name
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       WHERE a.title LIKE ? OR e2.name LIKE ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [searchParam, searchParam, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignments a
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       WHERE a.title LIKE ? OR e2.name LIKE ?`,
      [searchParam, searchParam]
    );

    const [employees] = await db.query(
      `SELECT e.id, e.name FROM employees e
       JOIN users u ON u.id = e.id WHERE e.status = 'active'`
    );

    res.render('tugas/index', {
      title: 'Manajemen Penugasan',
      tugas: rows,
      employees,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// GET /tugas/create
const createForm = async (req, res, next) => {
  try {
    const [employees] = await db.query(
      `SELECT e.id, e.name FROM employees e JOIN model_has_roles mhr ON mhr.model_id = e.id JOIN roles r ON r.id = mhr.role_id WHERE e.status = 'active' AND r.name = 'pegawai'`
    );
    res.render('tugas/create', {
      title: 'Tambah Penugasan',
      employees,
      errors: [],
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /tugas/create
const store = async (req, res, next) => {
  const { title, description, assigned_to, start_date, due_date, priority } = req.body;
  const errors = [];
  if (!title) errors.push('Judul wajib diisi.');
  if (!assigned_to) errors.push('Pegawai wajib dipilih.');
  if (!priority) errors.push('Prioritas wajib dipilih.');

  if (errors.length > 0) {
    const [employees] = await db.query(`SELECT e.id, e.name FROM employees e JOIN model_has_roles mhr ON mhr.model_id = e.id JOIN roles r ON r.id = mhr.role_id WHERE e.status = 'active' AND r.name = 'pegawai'`);
    return res.render('tugas/create', {
      title: 'Tambah Penugasan', employees, errors,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  }
  try {
    await db.query(
      `INSERT INTO assignments (title, description, assigned_by, assigned_to, start_date, due_date, status, priority, assigned_by_id, assigned_to_id, parent_id_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?, ?, 0, NOW(), NOW())`,
      [title, description || null, req.session.userId, assigned_to, start_date || null, due_date || null, priority, req.session.userId, assigned_to]
    );
    req.session.flashSuccess = 'Penugasan berhasil ditambahkan.';
    res.redirect('/tugas');
  } catch (err) { next(err); }
};

// GET /tugas/:id/edit
const editForm = async (req, res, next) => {
  try {
    const [[tugas]] = await db.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!tugas) return res.redirect('/tugas');
    const [employees] = await db.query(`SELECT e.id, e.name FROM employees e JOIN model_has_roles mhr ON mhr.model_id = e.id JOIN roles r ON r.id = mhr.role_id WHERE e.status = 'active' AND r.name = 'pegawai'`);
    res.render('tugas/edit', {
      title: 'Edit Penugasan', tugas, employees, errors: [],
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /tugas/:id/edit
const update = async (req, res, next) => {
  const { title, description, assigned_to, start_date, due_date, priority, status } = req.body;
  const errors = [];
  if (!title) errors.push('Judul wajib diisi.');

  if (errors.length > 0) {
    const [[tugas]] = await db.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    const [employees] = await db.query(`SELECT e.id, e.name FROM employees e JOIN model_has_roles mhr ON mhr.model_id = e.id JOIN roles r ON r.id = mhr.role_id WHERE e.status = 'active' AND r.name = 'pegawai'`);
    return res.render('tugas/edit', {
      title: 'Edit Penugasan', tugas, employees, errors,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  }
  try {
    await db.query(
      `UPDATE assignments SET title=?, description=?, assigned_to=?, assigned_to_id=?, start_date=?, due_date=?, priority=?, status=?, updated_at=NOW() WHERE id=?`,
      [title, description || null, assigned_to, assigned_to, start_date || null, due_date || null, priority, status, req.params.id]
    );
    req.session.flashSuccess = 'Penugasan berhasil diperbarui.';
    res.redirect('/tugas');
  } catch (err) { next(err); }
};

// POST /tugas/:id/delete
const destroy = async (req, res, next) => {
  try {
    await db.query('DELETE FROM assignment_progress WHERE assignment_id = ?', [req.params.id]);
    await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    req.session.flashSuccess = 'Penugasan berhasil dihapus.';
    res.redirect('/tugas');
  } catch (err) { next(err); }
};

// GET /tugas/:id/detail
const detail = async (req, res, next) => {
  try {
    const [[tugas]] = await db.query(
      `SELECT a.*, e1.name AS assigned_by_name, e2.name AS assigned_to_name
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       WHERE a.id = ?`, [req.params.id]
    );
    if (!tugas) return res.redirect('/tugas');
    const [progress] = await db.query(
      `SELECT ap.*, e.name AS created_by_name
       FROM assignment_progress ap
       LEFT JOIN employees e ON ap.created_by = e.id
       WHERE ap.assignment_id = ? ORDER BY ap.progress_date DESC`,
      [req.params.id]
    );
    res.render('tugas/detail', {
      title: 'Detail Penugasan', tugas, progress,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /tugas/:id/revisi - pimpinan revisi kiriman pegawai
const revisi = async (req, res, next) => {
  const { progress_id, catatan } = req.body;
  try {
    await db.query(
      `UPDATE assignment_progress SET status='in_progress', description=CONCAT(description, '\n[Revisi: ', ?, ']'), updated_at=NOW() WHERE id=?`,
      [catatan || 'Mohon diperbaiki.', progress_id]
    );
    await db.query(
      `UPDATE assignments SET status='in_progress', updated_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    req.session.flashSuccess = 'Revisi berhasil dikirim ke pegawai.';
    res.redirect('/tugas/' + req.params.id + '/detail');
  } catch (err) { next(err); }
};

// GET /tugas/export/excel
const exportExcel = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.title, a.description, a.status, a.priority, a.start_date, a.due_date,
              e1.name AS assigned_by_name, e2.name AS assigned_to_name, a.created_at
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       WHERE a.status != 'cancelled'
       ORDER BY a.created_at DESC`
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Penugasan Aktif');

    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Judul Tugas', key: 'title', width: 30 },
      { header: 'Deskripsi', key: 'description', width: 40 },
      { header: 'Ditugaskan Oleh', key: 'assigned_by_name', width: 20 },
      { header: 'Pegawai', key: 'assigned_to_name', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Prioritas', key: 'priority', width: 12 },
      { header: 'Tanggal Mulai', key: 'start_date', width: 15 },
      { header: 'Tenggat', key: 'due_date', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    rows.forEach((r, i) => {
      sheet.addRow({
        no: i + 1,
        title: r.title,
        description: r.description || '-',
        assigned_by_name: r.assigned_by_name || '-',
        assigned_to_name: r.assigned_to_name || '-',
        status: r.status,
        priority: r.priority,
        start_date: r.start_date ? new Date(r.start_date).toLocaleDateString('id-ID') : '-',
        due_date: r.due_date ? new Date(r.due_date).toLocaleDateString('id-ID') : '-',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=penugasan-aktif.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

// ===================== PEGAWAI =====================

// GET /tugas/pegawai - list tugas untuk pegawai yg login
const pegawaiIndex = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const statusFilter = req.query.status || '';

    let whereExtra = '';
    const params = [req.session.userId, `%${search}%`];
    if (statusFilter) { whereExtra = ' AND a.status = ?'; params.push(statusFilter); }

    const [rows] = await db.query(
      `SELECT a.*, e.name AS assigned_by_name
       FROM assignments a
       LEFT JOIN employees e ON a.assigned_by = e.id
       WHERE a.assigned_to = ? AND a.title LIKE ?${whereExtra}
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignments a
       WHERE a.assigned_to = ? AND a.title LIKE ?${whereExtra}`,
      params
    );

    res.render('tugas/pegawai-index', {
      title: 'Tugas Saya',
      tugas: rows,
      search,
      statusFilter,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// GET /tugas/:id/submit - form kumpul tugas
const submitForm = async (req, res, next) => {
  try {
    const [[tugas]] = await db.query('SELECT * FROM assignments WHERE id = ? AND assigned_to = ?', [req.params.id, req.session.userId]);
    if (!tugas) return res.redirect('/tugas/pegawai');
    const [existing] = await db.query('SELECT * FROM assignment_progress WHERE assignment_id = ?', [req.params.id]);
    res.render('tugas/submit', {
      title: 'Kumpulkan Tugas', tugas,
      existing: existing[0] || null, errors: [],
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

// POST /tugas/:id/submit
const submitStore = async (req, res, next) => {
  const { description, link } = req.body;
  const errors = [];
  if (!description) errors.push('Deskripsi hasil kerja wajib diisi.');

  if (errors.length > 0) {
    const [[tugas]] = await db.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    return res.render('tugas/submit', {
      title: 'Kumpulkan Tugas', tugas, existing: null, errors,
      user: { name: req.session.userName, role: req.session.userRole }
    });
  }

  try {
    const attachment = req.file ? req.file.filename : null;
    const [existing] = await db.query('SELECT * FROM assignment_progress WHERE assignment_id = ?', [req.params.id]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE assignment_progress SET description=?, attachment=?, status='in_progress', updated_at=NOW() WHERE assignment_id=?`,
        [description + (link ? '\nLink: ' + link : ''), attachment || existing[0].attachment, req.params.id]
      );
    } else {
      await db.query(
        `INSERT INTO assignment_progress (assignment_id, description, progress_date, status, attachment, created_by, employee_id, created_at, updated_at)
         VALUES (?, ?, NOW(), 'in_progress', ?, ?, ?, NOW(), NOW())`,
        [req.params.id, description + (link ? '\nLink: ' + link : ''), attachment, req.session.userId, req.session.userId]
      );
    }
    await db.query(`UPDATE assignments SET status='in_progress', updated_at=NOW() WHERE id=?`, [req.params.id]);
    req.session.flashSuccess = 'Tugas berhasil dikumpulkan.';
    res.redirect('/tugas/pegawai');
  } catch (err) { next(err); }
};

// POST /tugas/:id/selesai - pimpinan validasi jadi selesai
const selesai = async (req, res, next) => {
  try {
    await db.query(
      `UPDATE assignment_progress SET status='completed', updated_at=NOW() WHERE assignment_id=?`,
      [req.params.id]
    );
    await db.query(
      `UPDATE assignments SET status='completed', updated_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    req.session.flashSuccess = 'Tugas ditandai selesai.';
    res.redirect('/tugas/' + req.params.id + '/detail');
  } catch (err) { next(err); }
};

module.exports = {
  index, createForm, store, editForm, update, destroy,
  detail, revisi, exportExcel,
  pegawaiIndex, submitForm, submitStore, selesai
};