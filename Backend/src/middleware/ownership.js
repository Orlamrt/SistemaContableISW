const { ROLE_MAP } = require('../services/rbac');

function ensureOwnership(checkFn, { allowRoles = [] } = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sesión requerida' });
      }
      const bypass = allowRoles.some((role) => user.roles.includes(role));
      if (bypass) {
        return next();
      }
      const ownsResource = await checkFn(req, res);
      if (!ownsResource) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acceso restringido al propietario' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  ensureOwnership,
  ROLE_MAP,
};
