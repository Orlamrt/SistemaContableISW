const mysql = require('mysql2/promise');
const config = require('../config');
const { withRetry } = require('../utils/retry');

let pool;

async function initPool() {
  if (pool) return pool;
  pool = await mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: config.db.waitForConnections,
    connectionLimit: config.db.connectionLimit,
    queueLimit: config.db.queueLimit,
  });
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initPool() first.');
  }
  return pool;
}

async function getConnection() {
  const activePool = getPool();
  return activePool.getConnection();
}

async function query(sql, params = [], conn) {
  if (conn) {
    return conn.query(sql, params);
  }
  const activePool = getPool();
  return activePool.query(sql, params);
}

async function withTransaction(workFn, { connection } = {}) {
  const conn = connection || await getConnection();
  let external = Boolean(connection);
  if (!external) {
    await conn.beginTransaction();
  }
  try {
    const result = await workFn(conn);
    if (!external) {
      await conn.commit();
    }
    return result;
  } catch (err) {
    if (!external) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        // eslint-disable-next-line no-console
        console.error('Error rolling back transaction', rollbackError);
      }
    }
    throw err;
  } finally {
    if (!external) {
      conn.release();
    }
  }
}

async function transactional(workFn, options = {}) {
  return withRetry(() => withTransaction(workFn, options), options.retryOptions);
}

module.exports = {
  initPool,
  getPool,
  getConnection,
  query,
  withTransaction,
  transactional,
};
