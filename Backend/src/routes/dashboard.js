const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../services/db');
const { canViewAllAudits, canReadCompliance } = require('../services/authorization');

const router = express.Router();

router.get('/summary', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    const params = [];
    let auditsWhere = '';
    if (!canViewAllAudits(user)) {
      auditsWhere = 'WHERE user_id = ?';
      params.push(user.id);
    }
    const [auditStats] = await query(
      `SELECT status, COUNT(*) as total
         FROM audit_requests
         ${auditsWhere}
        GROUP BY status`,
      params,
    );
    const [notifications] = await query(
      `SELECT COUNT(*) AS unread
         FROM notifications
        WHERE user_id = ? AND is_read = 0`,
      [user.id],
    );
    const [meetings] = await query(
      `SELECT COUNT(*) AS upcoming
         FROM meetings
        WHERE user_id = ? AND scheduled_at >= NOW()`,
      [user.id],
    );
    let complianceSummary = null;
    if (canReadCompliance(user)) {
      const [[lastCompliance]] = await query(
        'SELECT status, checked_at FROM compliance_logs ORDER BY checked_at DESC LIMIT 1',
      );
      complianceSummary = lastCompliance || null;
    }
    return res.json({
      audits: auditStats,
      notifications: notifications[0],
      meetings: meetings[0],
      compliance: complianceSummary,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
