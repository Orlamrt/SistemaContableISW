require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

/* ============================
   Configuración básica
============================ */

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'secretito';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        'http://127.0.0.1:5500',
        'http://localhost:5500'
    ],
    credentials: true
}));
// ============================
// Configuración de correo
// ============================
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5500';

const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true si usas 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


// Carpeta para archivos subidos
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB por ejemplo
    },
    fileFilter: (req, file, cb) => {
        const allowedMime = [
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel' // algunos navegadores etiquetan CSV así
        ];
        const ext = path.extname(file.originalname).toLowerCase();

        if (
            allowedMime.includes(file.mimetype) ||
            ext === '.pdf' ||
            ext === '.csv'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF o CSV.'));
        }
    }
});


/* ============================
   Conexión MySQL
============================ */

let pool;

async function initDB() {
    pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('✅ Conectado a MySQL');
}

/* ============================
   Helpers
============================ */

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const [, token] = authHeader.split(' ');
    if (!token) return res.status(401).json({ message: 'Token inválido' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
}

/* ============================
   Rutas Auth
============================ */

// Registro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Faltan datos' });
        }

        // Opcional pero útil: validar rol válido
        const validRoles = ['Administrador', 'Auditor', 'Cliente'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Rol inválido' });
        }

        const [rows] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (rows.length > 0) {
            return res.status(409).json({ message: 'El email ya está registrado' });
        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, hash, role]
        );

        return res.status(201).json({ message: 'Usuario registrado', userId: result.insertId });
    } catch (err) {
        console.error('Error en /api/auth/register', err);
        // DEV: mostramos el error exacto para depurar
        return res.status(500).json({ message: err.message });
    }
});


// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Faltan datos' });
        }

        const [rows] = await pool.query(
            'SELECT id, email, password_hash, role FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const token = generateToken(user);
        return res.json({
            message: 'Login exitoso',
            token,
            user: { id: user.id, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Error en /api/auth/login', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});


// Recuperar contraseña (real con token)
// Recuperar contraseña (solo genera token y muestra link en consola)
app.post('/api/auth/recover', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email requerido' });
        }

        const [rows] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        // Siempre respondemos 200 para no revelar si el correo existe
        if (rows.length === 0) {
            return res.json({
                message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
            });
        }

        const userId = rows[0].id;

        // Generar token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        // Guardar en tabla password_resets
        await pool.query(
            `INSERT INTO password_resets (user_id, token, expires_at, used)
             VALUES (?, ?, ?, 0)`,
            [userId, token, expiresAt]
        );

        const resetLink = `${APP_URL}/reset.html?token=${token}`;

        // 🔐 Solo mostrar en consola (modo desarrollo)
        console.log('🔐 Enlace de recuperación (DEV):', resetLink);

        return res.json({
            message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
        });
    } catch (err) {
        console.error('Error en /api/auth/recover', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

 /*       const resetLink = `${APP_URL}/reset.html?token=${token}`;

        // Enviar correo
        await mailer.sendMail({
            from: `"Soporte Auditoría Digital" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Restablecer contraseña',
            html: `
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace (válido por 1 hora):</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Si no fuiste tú, ignora este mensaje.</p>
            `
        });

        // También lo dejamos en la consola para pruebas locales
        console.log('🔐 Enlace de recuperación:', resetLink);

        return res.json({
            message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
        });
    } catch (err) {
        console.error('Error en /api/auth/recover', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});
// Resetear contraseña con token
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token y nueva contraseña requeridos' });
        }

        // Buscar token válido
        const [rows] = await pool.query(
            `SELECT pr.id, pr.user_id
               FROM password_resets pr
              WHERE pr.token = ?
                AND pr.used = 0
                AND pr.expires_at > NOW()
              ORDER BY pr.id DESC
              LIMIT 1`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token inválido o expirado.' });
        }

        const resetId = rows[0].id;
        const userId = rows[0].user_id;

        // Actualizar contraseña del usuario
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hash, userId]
        );

        // Marcar token como usado
        await pool.query(
            'UPDATE password_resets SET used = 1 WHERE id = ?',
            [resetId]
        );

        return res.json({ message: 'Contraseña restablecida correctamente. Ahora puedes iniciar sesión.' });
    } catch (err) {
        console.error('Error en /api/auth/reset-password', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});
*/

/* ============================
   Rutas Auditorías
============================ */

// Crear nueva solicitud
app.post('/api/audits', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { audit_type } = req.body;

        if (!audit_type) {
            return res.status(400).json({ message: 'Tipo de auditoría requerido' });
        }

        // ✅ Archivo obligatorio
        if (!req.file) {
            return res.status(400).json({
                message: 'Es obligatorio adjuntar un archivo en formato PDF o CSV.'
            });
        }

        const filePath = `/uploads/${req.file.filename}`;

        const [result] = await pool.query(
            'INSERT INTO audit_requests (user_id, audit_type, file_path) VALUES (?, ?, ?)',
            [req.user.id, audit_type, filePath]
        );

        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [
                req.user.id,
                'Solicitud de auditoría enviada',
                'Tu solicitud de auditoría con archivo adjunto ha sido registrada correctamente.',
                'success'
            ]
        );

        return res.status(201).json({ message: 'Solicitud registrada', auditId: result.insertId });
    } catch (err) {
        console.error('Error en POST /api/audits', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

// Listar auditorías del usuario
app.get('/api/audits', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM audit_requests WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        return res.json(rows);
    } catch (err) {
        console.error('Error en GET /api/audits', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

/* ============================
   Rutas Notificaciones
============================ */

app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        return res.json(rows);
    } catch (err) {
        console.error('Error en GET /api/notifications', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

/* ============================
   Rutas Reuniones / Coordinación
============================ */

app.post('/api/meetings', authMiddleware, async (req, res) => {
    try {
        const { scheduled_at, notes } = req.body;
        if (!scheduled_at) {
            return res.status(400).json({ message: 'Fecha y hora requeridas' });
        }

        const [result] = await pool.query(
            'INSERT INTO meetings (user_id, scheduled_at, notes) VALUES (?, ?, ?)',
            [req.user.id, scheduled_at, notes || null]
        );

        return res.status(201).json({ message: 'Reunión agendada', meetingId: result.insertId });
    } catch (err) {
        console.error('Error en POST /api/meetings', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/meetings', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM meetings WHERE user_id = ? ORDER BY scheduled_at DESC',
            [req.user.id]
        );
        return res.json(rows);
    } catch (err) {
        console.error('Error en GET /api/meetings', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

/* ============================
   Rutas Cumplimiento
============================ */

app.get('/api/compliance/summary', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM compliance_logs ORDER BY checked_at DESC LIMIT 5'
        );

        const last = rows[0] || null;
        return res.json({
            last_check: last ? last.checked_at : null,
            last_status: last ? last.status : null,
            items: rows
        });
    } catch (err) {
        console.error('Error en GET /api/compliance/summary', err);
        return res.status(500).json({ message: 'Error interno' });
    }
});

/* ============================
   Archivos estáticos subidos
============================ */

app.use('/uploads', express.static(uploadDir));

/* ============================
   Arranque
============================ */

initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Backend escuchando en http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Error al inicializar la BD:', err);
        process.exit(1);
    });
