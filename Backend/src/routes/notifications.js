const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query, transactional } = require('../services/db');

const router = express.Router();

router.get('/', requireAuth(), async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const [rows] = await query(
      `SELECT id, title, message, type, is_read, created_at, updated_at, version
         FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [userId],
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/read', requireAuth(), async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const notificationId = Number(req.params.id);
    const result = await transactional(async (conn) => {
      const [[notification]] = await query(
        'SELECT id, user_id, version FROM notifications WHERE id = ?',
        [notificationId],
        conn,
      );
      if (!notification) {
        return { status: 404, body: { error: 'NOT_FOUND', message: 'Notificación no encontrada' } };
      }
      if (notification.user_id !== userId) {
        return { status: 403, body: { error: 'FORBIDDEN', message: 'No puedes modificar esta notificación' } };
      }
      const [updateResult] = await query(
        `UPDATE notifications
            SET is_read = 1, version = version + 1, updated_at = NOW()
          WHERE id = ? AND user_id = ?`,
        [notificationId, userId],
        conn,
      );
      if (updateResult.affectedRows === 0) {
        return { status: 409, body: { error: 'VERSION_CONFLICT', message: 'No se pudo actualizar la notificación' } };
      }
      return { status: 200, body: { message: 'Notificación marcada como leída' } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
