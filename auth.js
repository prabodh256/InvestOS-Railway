const jwt = require('jsonwebtoken');
const { getUserById } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'investos-super-secret-change-in-prod-2024';

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = getUserById(userId);
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid or inactive user' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
