const test = require('node:test');
const assert = require('node:assert');
const { hashIdempotencyKey } = require('../src/services/rbac');

test('Idempotency hash is deterministic and user scoped', () => {
  const keyA = hashIdempotencyKey(1, 'POST:/api/audits', 'abc');
  const keyB = hashIdempotencyKey(1, 'POST:/api/audits', 'abc');
  const keyC = hashIdempotencyKey(2, 'POST:/api/audits', 'abc');
  assert.strictEqual(Buffer.compare(keyA, keyB), 0);
  assert.notStrictEqual(Buffer.compare(keyA, keyC), 0);
});
