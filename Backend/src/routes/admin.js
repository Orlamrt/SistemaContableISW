const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { query } = require('../services/db');
const { ROLE_MAP } = require('../services/rbac');

const router = express.Router();

router.get('/users', requireAuth(), requireRole(ROLE_MAP.ADMIN), async (_req, res, next) => {
  try {
    const [rows] = await query(
      `SELECT u.id, u.email, u.status, u.updated_at,
              GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id
        ORDER BY u.created_at DESC`,
    );
    const users = rows.map((row) => ({
      id: row.id,
      email: row.email,
      status: row.status,
      updated_at: row.updated_at,
      roles: row.roles ? row.roles.split(',') : [],
    }));
    return res.json(users);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
