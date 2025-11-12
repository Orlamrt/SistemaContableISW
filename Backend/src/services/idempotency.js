const config = require('../config');
const { query } = require('./db');
const { hashIdempotencyKey } = require('./rbac');

async function ensureIdempotencyTable(conn) {
  await query(
    `CREATE TABLE IF NOT EXISTS idempotency_keys (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(120) NOT NULL,
      key_hash VARBINARY(32) NOT NULL,
      response_status SMALLINT NOT NULL,
      response_body TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_idempotency (user_id, endpoint, key_hash),
      INDEX idx_idempotency_created_at (created_at)
    ) ENGINE=InnoDB`,
    [],
    conn,
  );
}

async function findExistingIdempotentResponse({ conn, userId, endpoint, key }) {
  if (!key) return null;
  await ensureIdempotencyTable(conn);
  const keyHash = hashIdempotencyKey(userId, endpoint, key);
  const [[row]] = await query(
    `SELECT response_status, response_body
       FROM idempotency_keys
      WHERE user_id = ? AND endpoint = ? AND key_hash = ?`,
    [userId, endpoint, keyHash],
    conn,
  );
  if (!row) return null;
  return { status: row.response_status, body: row.response_body ? JSON.parse(row.response_body) : null };
}

async function persistIdempotentResponse({ conn, userId, endpoint, key, status, body }) {
  if (!key) return;
  await ensureIdempotencyTable(conn);
  const keyHash = hashIdempotencyKey(userId, endpoint, key);
  const bodyString = body ? JSON.stringify(body).slice(0, config.idempotency.maxBodyLength) : null;
  await query(
    `INSERT INTO idempotency_keys (user_id, endpoint, key_hash, response_status, response_body)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE response_status = VALUES(response_status), response_body = VALUES(response_body)` ,
    [userId, endpoint, keyHash, status, bodyString],
    conn,
  );
}

module.exports = {
  findExistingIdempotentResponse,
  persistIdempotentResponse,
};
