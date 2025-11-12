const jwt = require('jsonwebtoken');
const config = require('../config');
const { getUserWithRoles } = require('../services/rbac');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
}

function requireAuth() {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Token requerido' });
      }
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Token inválido o expirado' });
      }
      const user = await getUserWithRoles(decoded.id);
      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Usuario no disponible' });
      }
      req.user = {
        id: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        status: user.status,
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = (req.user && req.user.roles) || [];
    const allowed = userRoles.some((role) => roles.includes(role));
    if (!allowed) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Rol insuficiente', required: roles });
    }
    return next();
  };
}

function optionalAuth() {
  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await getUserWithRoles(decoded.id);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status,
        };
      }
    } catch (err) {
      // ignore invalid tokens
    }
    return next();
  };
}

module.exports = {
  generateToken,
  requireAuth,
  requireRole,
  optionalAuth,
};
