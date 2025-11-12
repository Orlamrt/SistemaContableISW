const test = require('node:test');
const assert = require('node:assert');
const { requireRole } = require('../src/middleware/auth');
const { ROLE_MAP } = require('../src/services/rbac');

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('requireRole permite acceso cuando el usuario tiene un rol válido', () => {
  const middleware = requireRole(ROLE_MAP.ADMIN, ROLE_MAP.AUDITOR);
  const req = { user: { roles: [ROLE_MAP.AUDITOR] } };
  const res = createRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(nextCalled, true);
});

test('requireRole bloquea cuando no hay intersección de roles', () => {
  const middleware = requireRole(ROLE_MAP.ADMIN);
  const req = { user: { roles: [ROLE_MAP.CLIENTE] } };
  const res = createRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(nextCalled, false);
  assert.deepStrictEqual(res.body.required, [ROLE_MAP.ADMIN]);
});
