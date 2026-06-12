function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login');
}

function isPimpinan(req, res, next) {
  if (req.session.userId && req.session.userRole === 'pimpinan') return next();
  if (!req.session.userId) return res.redirect('/login');
  return res.status(403).render('error', {
    message: 'Akses ditolak. Halaman ini khusus Pimpinan.',
    error: { status: 403, stack: '' }
  });
}

function isPegawai(req, res, next) {
  if (req.session.userId && req.session.userRole === 'pegawai') return next();
  if (!req.session.userId) return res.redirect('/login');
  return res.status(403).render('error', {
    message: 'Akses ditolak. Halaman ini khusus Pegawai.',
    error: { status: 403, stack: '' }
  });
}

module.exports = { isAuthenticated, isPimpinan, isPegawai };
