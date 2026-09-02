const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../models/db');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Rate Limiting en memoria para Login (Protección Anti Fuerza Bruta)
const loginAttempts = new Map(); // key -> { count: number, lockUntil: number | null }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutos de bloqueo

function getClientKey(req, email) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  return `${ip}::${(email || '').toLowerCase().trim()}`;
}

function checkRateLimit(key) {
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };
  if (record.lockUntil && Date.now() < record.lockUntil) {
    const remainingMin = Math.ceil((record.lockUntil - Date.now()) / 60000);
    return { allowed: false, remainingMin };
  }
  if (record.lockUntil && Date.now() >= record.lockUntil) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedAttempt(key) {
  const record = loginAttempts.get(key) || { count: 0, lockUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(key, record);
  return record;
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

// POST /api/auth/registro — Creación de usuarios (Dueños o Vendedores)
router.post('/registro', async (req, res) => {
  const { nombre, email, password, rol = 'vendedor', direccion, domicilio, telefono } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!nombre || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: nombre, email, password' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email no válido' });
  }
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
  }

  const users = db.getUsers();
  // Si ya hay usuarios, solo un dueño logueado puede crear más cuentas
  if (users.length > 0) {
    if (!req.session.userId) {
      return res.status(403).json({ ok: false, error: 'Solo el dueño logueado puede crear nuevas cuentas.' });
    }
    const me = db.findUserById(req.session.userId);
    if (!me || (me.rol !== 'dueno' && me.rol !== 'admin')) {
      return res.status(403).json({ ok: false, error: 'Acceso denegado: solo el dueño puede registrar personal.' });
    }
  }

  // Rol permitido: 'dueno' o 'vendedor'
  const userRol = (users.length === 0 || rol === 'dueno') ? 'dueno' : 'vendedor';

  const hash = await bcrypt.hash(password, 10);
  const dir = (domicilio || direccion || '').trim();
  const tel = (telefono || '').trim();
  const user = {
    id: genId(),
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    password: hash,
    rol: userRol,
    direccion: dir,
    telefono: tel,
    creado: new Date().toISOString()
  };

  db.createUser(user);

  db.registrarAuditoria({
    usuarioId: req.session.userId || user.id,
    usuarioNombre: req.session.userNombre || user.nombre,
    accion: 'USUARIO_CREADO',
    detalle: `Se registró cuenta ${user.nombre} (${user.email}) con rol [${user.rol}]${user.direccion ? ` - Domicilio: ${user.direccion}` : ''}`,
    ip
  });

  // Auto-login solo si es el primer usuario del sistema
  if (users.length === 0) {
    req.session.userId = user.id;
    req.session.userNombre = user.nombre;
    req.session.nombre = user.nombre;
    req.session.userRol = user.rol;
  }

  res.json({ ok: true, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, direccion: user.direccion, telefono: user.telefono } });
});

// POST /api/auth/login — Con Rate Limiting & Anti-Fuerza Bruta
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const key = getClientKey(req, email);

  // 1. Validar si está bloqueado por demasiados intentos
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    db.registrarAuditoria({
      accion: 'LOGIN_BLOQUEADO',
      detalle: `Intento de acceso a cuenta bloqueada temporalmente: ${email}`,
      ip
    });
    return res.status(429).json({
      ok: false,
      error: `Demasiados intentos fallidos. Por seguridad, la cuenta está bloqueada temporalmente por ${limit.remainingMin} minutos.`
    });
  }

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Faltan email y password' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    const rec = recordFailedAttempt(key);
    const intentosRestantes = Math.max(0, MAX_ATTEMPTS - rec.count);
    db.registrarAuditoria({
      accion: 'LOGIN_FALLIDO',
      detalle: `Email no existente: ${email}`,
      ip
    });
    return res.status(401).json({
      ok: false,
      error: intentosRestantes > 0 
        ? `Email o contraseña incorrectos. Intentos restantes: ${intentosRestantes}.` 
        : `Demasiados intentos fallidos. Cuenta bloqueada por 10 minutos.`
    });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const rec = recordFailedAttempt(key);
    const intentosRestantes = Math.max(0, MAX_ATTEMPTS - rec.count);
    db.registrarAuditoria({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: 'LOGIN_FALLIDO',
      detalle: `Contraseña incorrecta para ${user.email}`,
      ip
    });
    return res.status(401).json({
      ok: false,
      error: intentosRestantes > 0 
        ? `Email o contraseña incorrectos. Intentos restantes: ${intentosRestantes}.` 
        : `Demasiados intentos fallidos. Cuenta bloqueada por 10 minutos.`
    });
  }

  // Éxito: limpiar contador de intentos
  clearLoginAttempts(key);

  req.session.userId = user.id;
  req.session.userNombre = user.nombre;
  req.session.nombre = user.nombre;
  req.session.userRol = user.rol || 'dueno';

  db.registrarAuditoria({
    usuarioId: user.id,
    usuarioNombre: user.nombre,
    accion: 'LOGIN_EXITOSO',
    detalle: `Sesión iniciada correctamente (Rol: ${user.rol || 'dueno'})`,
    ip
  });

  res.json({ ok: true, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol || 'dueno' } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  if (req.session.userId) {
    db.registrarAuditoria({
      usuarioId: req.session.userId,
      usuarioNombre: req.session.userNombre,
      accion: 'LOGOUT',
      detalle: 'Cierre de sesión seguro',
      ip
    });
  }
  req.session.destroy(() => {
    res.clearCookie('nicobici.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ ok: true, user: null });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.json({ ok: true, user: null });
  res.json({
    ok: true,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol || 'dueno',
      telefono: user.telefono || '',
      direccion: user.direccion || ''
    }
  });
});

module.exports = router;
