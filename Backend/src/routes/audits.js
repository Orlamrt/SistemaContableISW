const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { query, transactional } = require('../services/db');
const { findExistingIdempotentResponse, persistIdempotentResponse } = require('../services/idempotency');
const { logAuditEvent } = require('../services/audit-log');
const { canCreateAudit, canReviewAudit, canViewAllAudits } = require('../services/authorization');

const router = express.Router();

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, config.uploadDir),
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Solo se permiten archivos PDF o CSV.'));
    }
    return cb(null, true);
  },
});

const AUDIT_STATUSES = ['enviada', 'en_revision', 'en_proceso', 'completada', 'rechazada'];

async function formatAuditRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    audit_type: row.audit_type,
    file_path: row.file_path,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    version: row.version,
  };
}

router.post('/', requireAuth(), upload.single('file'), async (req, res, next) => {
  try {
    const user = req.user;
    if (!canCreateAudit(user)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Rol sin permisos para crear solicitudes' });
    }
    const { audit_type: auditType } = req.body;
    if (!auditType || !['interna', 'externa', 'ti'].includes(auditType)) {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Tipo de auditoría inválido' });
    }
    if (!req.file) {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Archivo obligatorio (PDF/CSV)' });
    }
    const idempotencyKey = req.header(config.idempotency.headerName);
    const endpoint = 'POST:/api/audits';

    const result = await transactional(async (conn) => {
      const existing = await findExistingIdempotentResponse({ conn, userId: user.id, endpoint, key: idempotencyKey });
      if (existing) {
        return existing;
      }
      const filePath = `/uploads/${req.file.filename}`;
      const [insertResult] = await query(
        `INSERT INTO audit_requests (user_id, audit_type, file_path, status, created_at, updated_at, version)
         VALUES (?, ?, ?, 'enviada', NOW(), NOW(), 0)`,
        [user.id, auditType, filePath],
        conn,
      );
      const auditId = insertResult.insertId;
      await query(
        `INSERT INTO notifications (user_id, title, message, type, created_at, updated_at, version)
         VALUES (?, 'Solicitud de auditoría registrada', 'Tu solicitud fue recibida y está en revisión.', 'success', NOW(), NOW(), 0)`,
        [user.id],
        conn,
      );
      const responseBody = { message: 'Solicitud registrada', auditId };
      await persistIdempotentResponse({
        conn,
        userId: user.id,
        endpoint,
        key: idempotencyKey,
        status: 201,
        body: responseBody,
      });
      await logAuditEvent({
        conn,
        actorId: user.id,
        entity: 'audit_request',
        entityId: auditId,
        action: 'create',
        before: null,
        after: { audit_type: auditType, file_path: filePath },
      });
      return { status: 201, body: responseBody };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    if (err.message && err.message.includes('Solo se permiten archivos')) {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
    return next(err);
  }
});

router.get('/', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    const { status, ownerId } = req.query;
    const filters = [];
    const params = [];
    if (status && AUDIT_STATUSES.includes(status)) {
      filters.push('status = ?');
      params.push(status);
    }
    if (canViewAllAudits(user)) {
      if (ownerId) {
        filters.push('user_id = ?');
        params.push(ownerId);
      }
    } else {
      filters.push('user_id = ?');
      params.push(user.id);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await query(
      `SELECT id, user_id, audit_type, file_path, status, created_at, updated_at, version
         FROM audit_requests
        ${whereClause}
        ORDER BY created_at DESC`,
      params,
    );
    const audits = await Promise.all(rows.map(formatAuditRow));
    return res.json(audits);
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    const auditId = Number(req.params.id);
    const [[audit]] = await query(
      `SELECT id, user_id, audit_type, file_path, status, created_at, updated_at, version
         FROM audit_requests
        WHERE id = ?`,
      [auditId],
    );
    if (!audit) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Solicitud no encontrada' });
    }
    if (!canViewAllAudits(user) && audit.user_id !== user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No puedes ver esta solicitud' });
    }
    return res.json(await formatAuditRow(audit));
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/status', requireAuth(), async (req, res, next) => {
  try {
    const user = req.user;
    if (!canReviewAudit(user)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Solo auditores o administradores pueden actualizar estado' });
    }
    const auditId = Number(req.params.id);
    const { status, version } = req.body;
    if (!status || !AUDIT_STATUSES.includes(status)) {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Estado inválido' });
    }
    if (typeof version !== 'number') {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Versión requerida' });
    }
    const result = await transactional(async (conn) => {
      const [[existing]] = await query(
        `SELECT id, user_id, audit_type, status, version
           FROM audit_requests
          WHERE id = ?`,
        [auditId],
        conn,
      );
      if (!existing) {
        return { status: 404, body: { error: 'NOT_FOUND', message: 'Solicitud no encontrada' } };
      }
      const [updateResult] = await query(
        `UPDATE audit_requests
            SET status = ?, version = version + 1, updated_at = NOW()
          WHERE id = ? AND version = ?`,
        [status, auditId, version],
        conn,
      );
      if (updateResult.affectedRows === 0) {
        return { status: 409, body: { error: 'VERSION_CONFLICT', message: 'La solicitud fue actualizada por otro usuario' } };
      }
      await logAuditEvent({
        conn,
        actorId: user.id,
        entity: 'audit_request',
        entityId: auditId,
        action: 'update_status',
        before: { status: existing.status, version: existing.version },
        after: { status },
      });
      await query(
        `INSERT INTO notifications (user_id, title, message, type, created_at, updated_at, version)
         VALUES (?, 'Estado de auditoría actualizado', CONCAT('Tu solicitud cambió a ', ?), 'info', NOW(), NOW(), 0)`,
        [existing.user_id, status],
        conn,
      );
      return { status: 200, body: { message: 'Estado actualizado' } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
