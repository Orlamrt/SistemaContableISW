const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../services/db');
const { canReadCompliance, canReadComplianceAsClient } = require('../services/authorization');

const router = express.Router();

router.get('/summary', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    const [rows] = await query(
      'SELECT id, description, status, checked_at FROM compliance_logs ORDER BY checked_at DESC LIMIT 10',
    );
    const last = rows[0] || null;
    if (canReadCompliance(user)) {
      return res.json({
        last_check: last ? last.checked_at : null,
        last_status: last ? last.status : null,
        items: rows,
      });
    }
    if (canReadComplianceAsClient(user)) {
      return res.json({
        last_check: last ? last.checked_at : null,
        last_status: last ? last.status : null,
        items: rows.slice(0, 1),
        message: 'Vista resumida para clientes. Solicita acceso adicional a tu auditor.',
      });
    }
    return res.status(403).json({ error: 'FORBIDDEN', message: 'No autorizado para ver cumplimiento' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
