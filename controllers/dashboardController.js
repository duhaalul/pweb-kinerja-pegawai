const db = require('../lib/db');

const index = async (req, res, next) => {
  try {
    const role = req.session.userRole;

    if (role === 'pimpinan') {
      const [[{ totalTugas }]] = await db.query('SELECT COUNT(*) as totalTugas FROM assignments');
      const [[{ tugasSelesai }]] = await db.query("SELECT COUNT(*) as tugasSelesai FROM assignments WHERE status='completed'");
      const [[{ tugasProses }]] = await db.query("SELECT COUNT(*) as tugasProses FROM assignments WHERE status='in_progress'");
      const [[{ tugasBelum }]] = await db.query("SELECT COUNT(*) as tugasBelum FROM assignments WHERE status='assigned'");
      const [[{ totalLogbook }]] = await db.query("SELECT COUNT(*) as totalLogbook FROM assignment_progress WHERE assignment_id=0");
      const [[{ logbookPending }]] = await db.query("SELECT COUNT(*) as logbookPending FROM assignment_progress WHERE assignment_id=0 AND status='in_progress'");

      const [recentTugas] = await db.query(
        `SELECT a.title, a.status, a.priority, e.name AS assigned_to_name
         FROM assignments a LEFT JOIN employees e ON a.assigned_to = e.id
         ORDER BY a.created_at DESC LIMIT 5`
      );

      return res.render('dashboard/pimpinan', {
        title: 'Dashboard Pimpinan',
        stats: { totalTugas, tugasSelesai, tugasProses, tugasBelum, totalLogbook, logbookPending },
        recentTugas,
        user: { name: req.session.userName, role }
      });
    }

    // Pegawai
    const [[{ myTugas }]] = await db.query(
      "SELECT COUNT(*) as myTugas FROM assignments WHERE assigned_to=?",
      [req.session.userId]
    );
    const [[{ mySelesai }]] = await db.query(
      "SELECT COUNT(*) as mySelesai FROM assignments WHERE assigned_to=? AND status='completed'",
      [req.session.userId]
    );
    const [[{ myProses }]] = await db.query(
      "SELECT COUNT(*) as myProses FROM assignments WHERE assigned_to=? AND status='in_progress'",
      [req.session.userId]
    );
    const [[{ myLogbook }]] = await db.query(
      "SELECT COUNT(*) as myLogbook FROM assignment_progress WHERE employee_id=? AND assignment_id=0",
      [req.session.userId]
    );
    const [recentTugas] = await db.query(
      `SELECT a.title, a.status, a.priority, e.name AS assigned_by_name
       FROM assignments a LEFT JOIN employees e ON a.assigned_by = e.id
       WHERE a.assigned_to=? ORDER BY a.created_at DESC LIMIT 5`,
      [req.session.userId]
    );

    res.render('dashboard/pegawai', {
      title: 'Dashboard Saya',
      stats: { myTugas, mySelesai, myProses, myLogbook },
      recentTugas,
      user: { name: req.session.userName, role }
    });
  } catch (err) { next(err); }
};

// GET /dashboard/monitoring - pimpinan monitor semua penugasan
const monitoring = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status || '';
    const search = req.query.search || '';

    let where = 'WHERE (a.title LIKE ? OR e2.name LIKE ?)';
    const params = [`%${search}%`, `%${search}%`];
    if (statusFilter) { where += ' AND a.status = ?'; params.push(statusFilter); }

    const [rows] = await db.query(
      `SELECT a.*, e1.name AS assigned_by_name, e2.name AS assigned_to_name
       FROM assignments a
       LEFT JOIN employees e1 ON a.assigned_by = e1.id
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM assignments a
       LEFT JOIN employees e2 ON a.assigned_to = e2.id
       ${where}`, params
    );

    res.render('dashboard/monitoring', {
      title: 'Monitoring Penugasan',
      tugas: rows, search, statusFilter,
      currentPage: page, totalPages: Math.ceil(total / limit),
      user: { name: req.session.userName, role: req.session.userRole }
    });
  } catch (err) { next(err); }
};

module.exports = { index, monitoring };
