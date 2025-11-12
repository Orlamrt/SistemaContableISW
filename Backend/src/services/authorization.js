const { ROLE_MAP } = require('./rbac');

function canCreateAudit(user) {
  return user.roles.some((role) => [ROLE_MAP.CLIENTE, ROLE_MAP.AUDITOR, ROLE_MAP.ADMIN].includes(role));
}

function canReviewAudit(user) {
  return user.roles.some((role) => [ROLE_MAP.ADMIN, ROLE_MAP.AUDITOR].includes(role));
}

function canViewAllAudits(user) {
  return user.roles.some((role) => [ROLE_MAP.ADMIN, ROLE_MAP.AUDITOR].includes(role));
}

function canViewOwnAudit(user) {
  return user.roles.includes(ROLE_MAP.CLIENTE) || user.roles.includes(ROLE_MAP.SOPORTE);
}

function canManageMeetings(user) {
  return user.roles.some((role) => [ROLE_MAP.ADMIN, ROLE_MAP.AUDITOR, ROLE_MAP.CLIENTE, ROLE_MAP.SOPORTE].includes(role));
}

function canReadCompliance(user) {
  return user.roles.some((role) => [ROLE_MAP.ADMIN, ROLE_MAP.AUDITOR].includes(role));
}

function canReadComplianceAsClient(user) {
  return user.roles.includes(ROLE_MAP.CLIENTE);
}

module.exports = {
  canCreateAudit,
  canReviewAudit,
  canViewAllAudits,
  canViewOwnAudit,
  canManageMeetings,
  canReadCompliance,
  canReadComplianceAsClient,
};
