const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query, transactional } = require('../services/db');
const { canManageMeetings } = require('../services/authorization');

const router = express.Router();

router.get('/', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await query(
      `SELECT id, user_id, scheduled_at, notes, created_at, updated_at, version
         FROM meetings
        WHERE user_id = ?
        ORDER BY scheduled_at DESC`,
      [userId],
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    if (!canManageMeetings(user)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No puedes gestionar reuniones' });
    }
    const { scheduled_at: scheduledAt, notes } = req.body;
    if (!scheduledAt) {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Fecha y hora requeridas' });
    }
    const result = await transactional(async (conn) => {
      const [[conflict]] = await query(
        `SELECT id FROM meetings
          WHERE user_id = ?
            AND ABS(TIMESTAMPDIFF(MINUTE, scheduled_at, ?)) < 30
          LIMIT 1 FOR UPDATE`,
        [user.id, scheduledAt],
        conn,
      );
      if (conflict) {
        return { status: 409, body: { error: 'TIME_CONFLICT', message: 'Existe una reunión en un intervalo cercano' } };
      }
      const [insertResult] = await query(
        `INSERT INTO meetings (user_id, scheduled_at, notes, created_at, updated_at, version)
         VALUES (?, ?, ?, NOW(), NOW(), 0)`,
        [user.id, scheduledAt, notes || null],
        conn,
      );
      return { status: 201, body: { message: 'Reunión agendada', meetingId: insertResult.insertId } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
