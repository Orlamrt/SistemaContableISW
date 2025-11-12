const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../config');
const { query, transactional } = require('../services/db');
const { generateToken, requireAuth } = require('../middleware/auth');
const { ROLE_MAP, assignRoleToUser, getUserWithRoles } = require('../services/rbac');

const router = express.Router();

const transporter = config.smtp.host ? nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
}) : nodemailer.createTransport({ jsonTransport: true });

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email y contraseña son obligatorios' });
    }
    const [existingEmail] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'El email ya está registrado' });
    }

    await transactional(async (conn) => {
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await query(
        `INSERT INTO users (email, password_hash, status, created_at, updated_at, version)
         VALUES (?, ?, 'active', NOW(), NOW(), 0)`,
        [email, passwordHash],
        conn,
      );
      await assignRoleToUser(result.insertId, ROLE_MAP.CLIENTE, conn);
    });

    return res.status(201).json({ message: 'Usuario registrado correctamente como CLIENTE' });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email y contraseña son obligatorios' });
    }
    const [[user]] = await query(
      `SELECT id, email, password_hash, status
         FROM users
        WHERE email = ?`,
      [email],
    );
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'La cuenta no está activa' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });
    }
    const userWithRoles = await getUserWithRoles(user.id);
    const token = generateToken({ id: user.id, roles: userWithRoles.roles });
    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: userWithRoles.roles,
        permissions: userWithRoles.permissions,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth(), async (req, res, next) => {
  try {
    const user = await getUserWithRoles(req.user.id);
    return res.json({
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/recover', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email requerido' });
    }
    const [[user]] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await transactional(async (conn) => {
      await query(
        `INSERT INTO password_resets (user_id, token, token_hash, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, 0, NOW())`,
        [user.id, token, tokenHash, expiresAt],
        conn,
      );
    });
    const resetLink = `${config.appUrl}/reset.html?token=${token}`;
    if (config.smtp.user) {
      await transporter.sendMail({
        from: `Auditoría Digital <${config.smtp.user}>`,
        to: email,
        subject: 'Recuperación de contraseña',
        html: `<p>Solicitaste restablecer tu contraseña.</p><p>Haz clic en el enlace: <a href="${resetLink}">${resetLink}</a></p>` ,
      });
    }
    // Always respond success without revealing existence
    // eslint-disable-next-line no-console
    console.log('Recovery link (dev):', resetLink);
    return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
  } catch (err) {
    return next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Token y contraseña son obligatorios' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const [[resetRecord]] = await query(
      `SELECT id, user_id
         FROM password_resets
        WHERE token_hash = ? AND used = 0 AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`,
      [tokenHash],
    );
    if (!resetRecord) {
      return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Token inválido o expirado' });
    }
    await transactional(async (conn) => {
      const passwordHash = await bcrypt.hash(password, 10);
      await query(
        `UPDATE users SET password_hash = ?, version = version + 1, updated_at = NOW() WHERE id = ?`,
        [passwordHash, resetRecord.user_id],
        conn,
      );
      await query('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRecord.id], conn);
    });
    return res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
