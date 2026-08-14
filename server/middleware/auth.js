// Lightweight auth: pass through for now.
// The InsForge SDK authenticates client-side; the Express server
// uses the service-role / anon key directly for DB access.
// In production, replace with `getDb().auth.getUser(token)` when
// the InsForge SDK exposes a server-side token verification method.
function verifyToken(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    req.user = { uid: header.split('Bearer ')[1].slice(0, 20), id: header.split('Bearer ')[1].slice(0, 20) };
  }
  next();
}

module.exports = { verifyToken };
