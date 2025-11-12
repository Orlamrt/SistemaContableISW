const express = require('express');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE_MAP } = require('../services/rbac');

const router = express.Router();
const frontendDir = path.resolve(__dirname, '..', '..', '..', 'frontend');

function sendFrontend(res, relativePath) {
  return res.sendFile(path.join(frontendDir, relativePath));
}

router.get('/', (_req, res) => sendFrontend(res, 'index.html'));
router.get('/login', (_req, res) => sendFrontend(res, 'index.html'));
router.get('/dashboard', requireAuth(), (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  return sendFrontend(res, 'dashboard.html');
});
router.get('/roles/admin', requireAuth(), requireRole(ROLE_MAP.ADMIN), (_req, res) =>
  sendFrontend(res, path.join('roles', 'admin.html')),
);
router.get(
  '/roles/auditor',
  requireAuth(),
  requireRole(ROLE_MAP.AUDITOR, ROLE_MAP.ADMIN),
  (_req, res) => sendFrontend(res, path.join('roles', 'auditor.html')),
);
router.get(
  '/roles/cliente',
  requireAuth(),
  requireRole(ROLE_MAP.CLIENTE),
  (_req, res) => sendFrontend(res, path.join('roles', 'cliente.html')),
);
router.get(
  '/roles/soporte',
  requireAuth(),
  requireRole(ROLE_MAP.SOPORTE, ROLE_MAP.ADMIN),
  (_req, res) => sendFrontend(res, path.join('roles', 'soporte.html')),
);

module.exports = router;
