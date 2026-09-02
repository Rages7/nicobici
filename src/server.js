const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./models/init');

// Asegurar inicio y migraciones de SQLite al arrancar el servidor
initDB();

const authRoutes = require('./routes/auth');
const datosRoutes = require('./routes/datos');
const categoriasRoutes = require('./routes/categorias');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const cuotasRoutes = require('./routes/cuotas');
const comprasRoutes = require('./routes/compras');
const cajaRoutes = require('./routes/caja');
const whatsappRoutes = require('./routes/whatsapp');
const usuariosRoutes = require('./routes/usuarios');
const inventarioRoutes = require('./routes/inventario');
const analiticaRoutes = require('./routes/analitica');
const configRoutes = require('./routes/config');
const backupRoutes = require('./routes/backup');
const auditoriaRoutes = require('./routes/auditoria');
const proveedoresRoutes = require('./routes/proveedores');
const clientesRoutes = require('./routes/clientes');
const googleDriveRoutes = require('./routes/googleDrive');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'nicobici_enterprise_secret_2026';

// Render/Proxy: necesario para express-rate-limit detrás de proxy
app.set('trust proxy', 1);

// Seguridad HTTP con Helmet (configuración amigable para SPA local)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate Limiter general para mitigar abuso
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes, intente nuevamente más tarde.' }
});
app.use('/api/', apiLimiter);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  name: 'nicobici.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 días
  }
}));

// Middleware de verificación de autenticación para APIs privadas
function requireApiAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: 'No autorizado. Debe iniciar sesión.' });
  }
  next();
}

// Rutas Públicas de la API
app.use('/api/auth', authRoutes);

// Rutas Protegidas de la API
app.use('/api/datos', requireApiAuth, datosRoutes);
app.use('/api/categorias', requireApiAuth, categoriasRoutes);
app.use('/api/productos', requireApiAuth, productosRoutes);
app.use('/api/ventas', requireApiAuth, ventasRoutes);
app.use('/api/cuotas', requireApiAuth, cuotasRoutes);
app.use('/api/compras', requireApiAuth, comprasRoutes);
app.use('/api/caja', requireApiAuth, cajaRoutes);
app.use('/api/whatsapp', requireApiAuth, whatsappRoutes);
app.use('/api/usuarios', requireApiAuth, usuariosRoutes);
app.use('/api/inventario', requireApiAuth, inventarioRoutes);
app.use('/api/analitica', requireApiAuth, analiticaRoutes);
app.use('/api/config', requireApiAuth, configRoutes);
app.use('/api/backup', requireApiAuth, backupRoutes);
app.use('/api/auditoria', requireApiAuth, auditoriaRoutes);
app.use('/api/proveedores', requireApiAuth, proveedoresRoutes);
app.use('/api/clientes', requireApiAuth, clientesRoutes);
app.use('/api/google-drive', requireApiAuth, googleDriveRoutes);

// Archivos estáticos y subidas
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Páginas de acceso público
app.get('/login.html', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard.html');
  }
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Guard para páginas protegidas
app.use((req, res, next) => {
  if (
    req.path.endsWith('.css') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.jpg') ||
    req.path.endsWith('.png') ||
    req.path.endsWith('.webp') ||
    req.path.endsWith('.ico') ||
    req.path.endsWith('.svg') ||
    req.path.endsWith('.woff2') ||
    req.path.endsWith('.ttf')
  ) {
    return next();
  }

  if (!req.session || !req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
});

// Archivos estáticos autenticados
app.use(express.static(path.join(__dirname, '../public')));

// Fallback a index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!req.session || !req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚲 Nicobici Enterprise POS & ERP (SQLite Engine) corriendo en http://localhost:${PORT}`);
  console.log(`   Carpeta: ${path.join(__dirname, '..')}`);
  console.log(`   Base de Datos: ${path.join(__dirname, '../data/nicobici.db')}\n`);
});
