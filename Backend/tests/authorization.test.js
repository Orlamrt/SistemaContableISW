const test = require('node:test');
const assert = require('node:assert');
const { ROLE_MAP } = require('../src/services/rbac');
const {
  canCreateAudit,
  canReviewAudit,
  canViewAllAudits,
  canViewOwnAudit,
  canManageMeetings,
  canReadCompliance,
  canReadComplianceAsClient,
} = require('../src/services/authorization');

const userWithRoles = (...roles) => ({ roles });

test('CLIENTE puede crear auditorías y ver las propias', () => {
  const cliente = userWithRoles(ROLE_MAP.CLIENTE);
  assert.strictEqual(canCreateAudit(cliente), true);
  assert.strictEqual(canViewOwnAudit(cliente), true);
  assert.strictEqual(canViewAllAudits(cliente), false);
  assert.strictEqual(canReviewAudit(cliente), false);
});

test('AUDITOR puede revisar y ver todas las auditorías', () => {
  const auditor = userWithRoles(ROLE_MAP.AUDITOR);
  assert.strictEqual(canCreateAudit(auditor), true);
  assert.strictEqual(canViewAllAudits(auditor), true);
  assert.strictEqual(canReviewAudit(auditor), true);
  assert.strictEqual(canViewOwnAudit(auditor), false);
});

test('ADMIN tiene permisos completos', () => {
  const admin = userWithRoles(ROLE_MAP.ADMIN);
  assert.strictEqual(canCreateAudit(admin), true);
  assert.strictEqual(canViewAllAudits(admin), true);
  assert.strictEqual(canReviewAudit(admin), true);
  assert.strictEqual(canManageMeetings(admin), true);
  assert.strictEqual(canReadCompliance(admin), true);
});

test('CLIENTE recibe acceso resumido a cumplimiento', () => {
  const cliente = userWithRoles(ROLE_MAP.CLIENTE);
  assert.strictEqual(canReadCompliance(cliente), false);
  assert.strictEqual(canReadComplianceAsClient(cliente), true);
});

test('SOPORTE puede gestionar reuniones y tickets pero no auditorías', () => {
  const soporte = userWithRoles(ROLE_MAP.SOPORTE);
  assert.strictEqual(canManageMeetings(soporte), true);
  assert.strictEqual(canCreateAudit(soporte), false);
  assert.strictEqual(canReviewAudit(soporte), false);
});
