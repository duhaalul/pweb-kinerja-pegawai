const bcrypt = require('bcryptjs');
const db = require('../lib/db');

const index = (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
};

const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { title: 'Login', error: req.session.flashError || null });
  delete req.session.flashError;
};

const login = async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.session.flashError = 'Username dan password wajib diisi.';
    return res.redirect('/login');
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE name = ?', [username]);
    if (rows.length === 0) {
      req.session.flashError = 'Username atau password salah.';
      return res.redirect('/login');
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.session.flashError = 'Username atau password salah.';
      return res.redirect('/login');
    }

    const [roleRows] = await db.query(
      `SELECT r.name FROM roles r
       JOIN model_has_roles mhr ON r.id = mhr.role_id
       WHERE mhr.model_id = ? AND mhr.model_type = 'App\\\\Models\\\\User'`,
      [user.id]
    );
    const role = roleRows.length > 0 ? roleRows[0].name : 'pegawai';

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.userRole = role;

    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
};

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
};

module.exports = { index, loginPage, login, logout };