const { query } = require('./db');

async function ensureAuditLogTable(conn) {
  await query(
    `CREATE TABLE IF NOT EXISTS audit_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      actor_id INT NULL,
      entity VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_log_entity (entity, entity_id)
    ) ENGINE=InnoDB`,
    [],
    conn,
  );
}

async function logAuditEvent({ conn, actorId, entity, entityId, action, before, after }) {
  await ensureAuditLogTable(conn);
  await query(
    `INSERT INTO audit_log (actor_id, entity, entity_id, action, before_data, after_data)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [actorId || null, entity, String(entityId), action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null],
    conn,
  );
}

module.exports = {
  logAuditEvent,
  ensureAuditLogTable,
};
