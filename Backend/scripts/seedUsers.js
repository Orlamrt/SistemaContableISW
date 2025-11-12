#!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcryptjs');
const { initPool, query } = require('../src/services/db');
const { ensureRolesAndPermissions, assignRoleToUser, ROLE_MAP } = require('../src/services/rbac');

async function seed() {
  await initPool();
  await ensureRolesAndPermissions();

  const seeds = [
    { email: 'admin@example.com', password: 'ChangeMe123!', roles: [ROLE_MAP.ADMIN] },
    { email: 'auditor@example.com', password: 'Auditor123!', roles: [ROLE_MAP.AUDITOR] },
    { email: 'cliente@example.com', password: 'Cliente123!', roles: [ROLE_MAP.CLIENTE] },
    { email: 'soporte@example.com', password: 'Soporte123!', roles: [ROLE_MAP.SOPORTE] },
  ];

  for (const seedUser of seeds) {
    const [[existing]] = await query('SELECT id FROM users WHERE email = ?', [seedUser.email]);
    let userId = existing ? existing.id : null;
    if (!existing) {
      const hash = await bcrypt.hash(seedUser.password, 10);
      const [result] = await query(
        `INSERT INTO users (email, password_hash, status, created_at, updated_at, version)
         VALUES (?, ?, 'active', NOW(), NOW(), 0)`,
        [seedUser.email, hash],
      );
      userId = result.insertId;
    }
    for (const role of seedUser.roles) {
      await assignRoleToUser(userId, role);
    }
    // eslint-disable-next-line no-console
    console.log(`Seeded ${seedUser.email} with roles ${seedUser.roles.join(', ')}`);
  }
  process.exit(0);
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
