const path = require('path');

const env = process.env.NODE_ENV || 'development';

function parseIntEnv(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const config = {
  env,
  port: parseIntEnv(process.env.PORT, 4000),
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-env',
  frontendOrigins: (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  appUrl: process.env.APP_URL || 'http://127.0.0.1:5500',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseIntEnv(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'auditoria_digital',
    waitForConnections: true,
    connectionLimit: parseIntEnv(process.env.DB_POOL_MAX, 10),
    queueLimit: parseIntEnv(process.env.DB_QUEUE_LIMIT, 0),
  },
  uploadDir: path.join(__dirname, '..', '..', 'uploads'),
  idempotency: {
    headerName: 'Idempotency-Key',
    maxBodyLength: parseIntEnv(process.env.IDEMPOTENCY_MAX_BODY_LENGTH, 4096),
  },
  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
  },
};

module.exports = config;
