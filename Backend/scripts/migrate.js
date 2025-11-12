#!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '..', '..', 'backend', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  if (!files.length) {
    console.log('No hay migraciones para ejecutar.');
    return;
  }
  const connection = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (!sql.trim()) continue;
      console.log(`▶️ Ejecutando migración ${file}`);
      await connection.query(sql);
      console.log(`✅ Migración ${file} completada`);
    }
  } finally {
    await connection.end();
  }
}

runMigrations().catch((err) => {
  console.error('❌ Error al ejecutar migraciones');
  console.error(err);
  process.exit(1);
});
