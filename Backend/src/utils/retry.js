function isRetryableDbError(err) {
  if (!err) return false;
  const mysqlCodes = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);
  const mysqlNumbers = new Set([1205, 1213]);
  if (mysqlCodes.has(err.code)) return true;
  if (mysqlNumbers.has(err.errno)) return true;
  if (typeof err.sqlState === 'string' && err.sqlState.startsWith('40')) return true; // serialization failure family
  return false;
}

async function withRetry(fn, { retries = 2, baseDelay = 100 } = {}) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!isRetryableDbError(err) || attempt === retries) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 25);
      const delay = baseDelay * (attempt + 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
  throw lastError;
}

module.exports = { withRetry, isRetryableDbError };
