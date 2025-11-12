const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { query, transactional } = require('./db');

const ROLE_MAP = {
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR',
  CLIENTE: 'CLIENTE',
  SOPORTE: 'SOPORTE',
};

const PERMISSIONS = [
  'audits.read',
  'audits.write',
  'audits.review',
  'files.upload',
  'files.review',
  'notifications.read',
  'meetings.manage',
  'compliance.read',
  'reports.manage',
  'tickets.manage',
  'tickets.read',
];

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS,
  AUDITOR: [
    'audits.read',
    'audits.write',
    'audits.review',
    'files.upload',
    'files.review',
    'notifications.read',
    'meetings.manage',
    'compliance.read',
    'reports.manage',
    'tickets.read',
  ],
  CLIENTE: [
    'audits.read',
    'audits.write',
    'files.upload',
    'notifications.read',
    'meetings.manage',
    'tickets.manage',
  ],
  SOPORTE: [
    'tickets.manage',
    'notifications.read',
    'audits.read',
    'meetings.manage',
  ],
};

async function ensureRolesAndPermissions() {
  await transactional(async (conn) => {
    await query(
      `CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`,
      [],
      conn,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_key VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`,
      [],
      conn,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS user_roles (
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        INDEX idx_user_roles_user (user_id),
        INDEX idx_user_roles_role (role_id)
      ) ENGINE=InnoDB`,
      [],
      conn,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        INDEX idx_role_permissions_role (role_id)
      ) ENGINE=InnoDB`,
      [],
      conn,
    );

    // Seed roles
    for (const roleName of Object.values(ROLE_MAP)) {
      await query('INSERT IGNORE INTO roles (name) VALUES (?)', [roleName], conn);
    }

    // Seed permissions
    for (const permission of PERMISSIONS) {
      await query('INSERT IGNORE INTO permissions (permission_key) VALUES (?)', [permission], conn);
    }

    // Assign role permissions
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const [[role]] = await query('SELECT id FROM roles WHERE name = ?', [roleName], conn);
      if (!role) continue;
      for (const permissionKey of permissions) {
        const [[permission]] = await query('SELECT id FROM permissions WHERE permission_key = ?', [permissionKey], conn);
        if (!permission) continue;
        await query(
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [role.id, permission.id],
          conn,
        );
      }
    }
  });
}

async function ensureDefaultAdmin() {
  await ensureRolesAndPermissions();
  await transactional(async (conn) => {
    const [[existingUser]] = await query('SELECT id FROM users WHERE email = ?', [config.defaultAdmin.email], conn);
    if (existingUser) {
      return;
    }
    const passwordHash = await bcrypt.hash(config.defaultAdmin.password, 10);
    const [result] = await query(
      `INSERT INTO users (email, password_hash, status, created_at, updated_at, version)
       VALUES (?, ?, 'active', NOW(), NOW(), 0)`,
      [config.defaultAdmin.email, passwordHash],
      conn,
    );
    const adminRoleId = await getRoleId(ROLE_MAP.ADMIN, conn);
    await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, adminRoleId], conn);
  });
}

async function getRoleId(roleName, conn) {
  const [[row]] = await query('SELECT id FROM roles WHERE name = ?', [roleName], conn);
  if (!row) {
    throw new Error(`Role ${roleName} is not defined`);
  }
  return row.id;
}

async function assignRoleToUser(userId, roleName, conn) {
  const roleId = await getRoleId(roleName, conn);
  await query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId], conn);
}

async function replaceUserRoles(userId, roles, conn) {
  await query('DELETE FROM user_roles WHERE user_id = ?', [userId], conn);
  for (const roleName of roles) {
    await assignRoleToUser(userId, roleName, conn);
  }
}

async function getUserRoles(userId, conn) {
  const [rows] = await query(
    `SELECT r.name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?`,
    [userId],
    conn,
  );
  return rows.map((row) => row.name);
}

async function getUserPermissions(userId, conn) {
  const [rows] = await query(
    `SELECT DISTINCT p.permission_key
       FROM user_roles ur
       INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ?`,
    [userId],
    conn,
  );
  return rows.map((row) => row.permission_key);
}

async function getUserWithRoles(userId, conn) {
  const [[user]] = await query(
    `SELECT id, email, status, version, created_at, updated_at
       FROM users
      WHERE id = ?`,
    [userId],
    conn,
  );
  if (!user) return null;
  const roles = await getUserRoles(userId, conn);
  const permissions = await getUserPermissions(userId, conn);
  return { ...user, roles, permissions };
}

function hasRole(user, roles = []) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some((role) => roles.includes(role));
}

function hasPermission(user, permissions = []) {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.some((permission) => permissions.includes(permission));
}

function hashIdempotencyKey(userId, endpoint, key) {
  return crypto.createHash('sha256').update(`${userId}:${endpoint}:${key}`).digest();
}

module.exports = {
  ROLE_MAP,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ensureRolesAndPermissions,
  ensureDefaultAdmin,
  assignRoleToUser,
  replaceUserRoles,
  getUserWithRoles,
  getUserRoles,
  getUserPermissions,
  hasRole,
  hasPermission,
  hashIdempotencyKey,
};
