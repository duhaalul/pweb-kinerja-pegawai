const db = require('../lib/db');

// ===== API TUGAS (Pimpinan) =====
const getTugas = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND a.status = ?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT a.id, a.title, a.description, a.status, a.priority, a.start_date, a.due_date,
              e1.name AS assigned_by, e2.name AS assigned_to, a.created_at
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignments a ${where}`, params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getTugasById = async (req, res) => {
  try {
    const [[tugas]] = await db.query(
      `SELECT a.*, e1.name AS assigned_by, e2.name AS assigned_to
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       WHERE a.id = ?`, [req.params.id]
    );
    if (!tugas) return res.status(404).json({ success: false, message: 'Penugasan tidak ditemukan.' });
    const [progress] = await db.query('SELECT * FROM assignment_progress WHERE assignment_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...tugas, progress } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createTugasApi = async (req, res) => {
  try {
    const { title, description, assigned_to, start_date, due_date, priority } = req.body;
    if (!title || !assigned_to || !priority) {
      return res.status(400).json({ success: false, message: 'title, assigned_to, priority wajib diisi.' });
    }
    const [result] = await db.query(
      `INSERT INTO assignments (title, description, assigned_by, assigned_to, start_date, due_date, status, priority, assigned_by_id, assigned_to_id, parent_id_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?, ?, 0, NOW(), NOW())`,
      [title, description || null, req.session.userId, assigned_to, start_date || null, due_date || null, priority, req.session.userId, assigned_to]
    );
    res.status(201).json({ success: true, message: 'Penugasan berhasil dibuat.', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateTugasApi = async (req, res) => {
  try {
    const { title, description, status, priority, due_date } = req.body;
    await db.query(
      `UPDATE assignments SET title=COALESCE(?,title), description=COALESCE(?,description), status=COALESCE(?,status), priority=COALESCE(?,priority), due_date=COALESCE(?,due_date), updated_at=NOW() WHERE id=?`,
      [title, description, status, priority, due_date, req.params.id]
    );
    res.json({ success: true, message: 'Penugasan berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteTugasApi = async (req, res) => {
  try {
    await db.query('DELETE FROM assignment_progress WHERE assignment_id=?', [req.params.id]);
    await db.query('DELETE FROM assignments WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Penugasan berhasil dihapus.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ===== API SUBMISSION (Pegawai) =====
const getMyTugas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.status, a.priority, a.due_date, e.name AS assigned_by
       FROM assignments a LEFT JOIN employees e ON a.assigned_by = e.id
       WHERE a.assigned_to = ? ORDER BY a.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const submitTugasApi = async (req, res) => {
  try {
    const { description } = req.body;
    const { id } = req.params;
    if (!description) return res.status(400).json({ success: false, message: 'Deskripsi wajib diisi.' });

    const [existing] = await db.query('SELECT * FROM assignment_progress WHERE assignment_id=?', [id]);
    if (existing.length > 0) {
      await db.query(
        'UPDATE assignment_progress SET description=?, status="in_progress", updated_at=NOW() WHERE assignment_id=?',
        [description, id]
      );
    } else {
      await db.query(
        `INSERT INTO assignment_progress (assignment_id, description, progress_date, status, created_by, employee_id, created_at, updated_at)
         VALUES (?, ?, NOW(), 'in_progress', ?, ?, NOW(), NOW())`,
        [id, description, req.session.userId, req.session.userId]
      );
    }
    await db.query("UPDATE assignments SET status='in_progress', updated_at=NOW() WHERE id=?", [id]);
    res.json({ success: true, message: 'Tugas berhasil dikumpulkan.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ===== API LOGBOOK =====
const getLogbook = async (req, res) => {
  try {
    const { employee_id, date, date_end, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE ap.assignment_id = 0';
    const params = [];
    if (employee_id) { where += ' AND ap.employee_id=?'; params.push(employee_id); }
    if (date) { where += ' AND ap.progress_date >= ?'; params.push(date); }
    if (date_end) { where += ' AND ap.progress_date <= ?'; params.push(date_end); }

    const [rows] = await db.query(
      `SELECT ap.*, e.name AS employee_name FROM assignment_progress ap
       LEFT JOIN employees e ON ap.employee_id=e.id
       ${where} ORDER BY ap.progress_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ===== API MONITORING =====
const getMonitoring = async (req, res) => {
  try {
    const { status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND a.status=?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT a.id, a.title, a.status, a.priority, a.due_date,
              e2.name AS assigned_to, COUNT(ap.id) AS progress_count
       FROM assignments a
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       LEFT JOIN assignment_progress ap ON ap.assignment_id = a.id
       ${where} GROUP BY a.id ORDER BY a.created_at DESC`,
      params
    );

    const stats = {
      total: rows.length,
      completed: rows.filter(r => r.status === 'completed').length,
      in_progress: rows.filter(r => r.status === 'in_progress').length,
      assigned: rows.filter(r => r.status === 'assigned').length,
    };

    res.json({ success: true, data: rows, stats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getTugas, getTugasById, createTugasApi, updateTugasApi, deleteTugasApi,
  getMyTugas, submitTugasApi,
  getLogbook,
  getMonitoring
};
