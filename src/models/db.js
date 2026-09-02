const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'nicobici.db');
const db = new DatabaseSync(DB_PATH);

// Configure SQLite pragmas for performance and data safety
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT DEFAULT 'dueno',
    telefono TEXT,
    direccion TEXT,
    activo INTEGER DEFAULT 1,
    creado TEXT,
    ultimo_acceso TEXT
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    slug TEXT,
    codigo TEXT,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    creado TEXT
  );

  CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cuit TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    creado TEXT,
    actualizado TEXT
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    telefono TEXT,
    dni TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    creado TEXT,
    actualizado TEXT
  );

  CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    categoria_id TEXT,
    proveedor_id TEXT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    sku TEXT,
    codigo_barras TEXT,
    precio REAL DEFAULT 0,
    costo REAL DEFAULT 0,
    stock REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 2,
    iva REAL DEFAULT 21,
    imagen TEXT,
    activo INTEGER DEFAULT 1,
    creado TEXT,
    actualizado TEXT
  );

  CREATE TABLE IF NOT EXISTS historial_precios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id TEXT NOT NULL,
    precio_anterior REAL,
    precio_nuevo REAL,
    costo_anterior REAL,
    costo_nuevo REAL,
    fecha TEXT
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    ticket_nro TEXT NOT NULL,
    cliente_id TEXT,
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    fecha TEXT,
    subtotal REAL DEFAULT 0,
    iva_total REAL DEFAULT 0,
    iva_percent REAL DEFAULT 21,
    total REAL DEFAULT 0,
    pagado REAL DEFAULT 0,
    debe REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    cuotas_total INTEGER DEFAULT 1,
    vendedor_id TEXT,
    anulada INTEGER DEFAULT 0,
    fecha_anulacion TEXT,
    motivo_anulacion TEXT,
    creado TEXT
  );

  CREATE TABLE IF NOT EXISTS venta_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    nombre TEXT,
    sku TEXT,
    categoria_id TEXT,
    precio_unit REAL,
    costo_unit REAL,
    iva REAL,
    cantidad REAL,
    subtotal REAL,
    iva_amount REAL,
    total_item REAL
  );

  CREATE TABLE IF NOT EXISTS pagos (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    cliente_id TEXT,
    monto REAL NOT NULL,
    metodo TEXT DEFAULT 'efectivo',
    referencia TEXT,
    fecha TEXT
  );

  CREATE TABLE IF NOT EXISTS cuotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id TEXT NOT NULL,
    numero INTEGER NOT NULL,
    monto_original REAL NOT NULL,
    monto_pagado REAL DEFAULT 0,
    saldo REAL NOT NULL,
    vencimiento TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha_pago TEXT,
    metodo_pago TEXT
  );

  CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY,
    proveedor_id TEXT,
    numero TEXT,
    fecha TEXT,
    subtotal REAL DEFAULT 0,
    iva_total REAL DEFAULT 0,
    total REAL DEFAULT 0,
    pagado REAL DEFAULT 0,
    debe REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    notas TEXT,
    creado TEXT
  );

  CREATE TABLE IF NOT EXISTS compra_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad REAL NOT NULL,
    costo_unit REAL NOT NULL,
    subtotal REAL,
    iva REAL,
    total REAL
  );

  CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    producto_nombre TEXT,
    tipo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    stock_antes REAL,
    stock_despues REAL,
    motivo TEXT,
    referencia_id TEXT,
    fecha TEXT,
    usuario_id TEXT
  );

  CREATE TABLE IF NOT EXISTS cajas (
    id TEXT PRIMARY KEY,
    fecha_apertura TEXT NOT NULL,
    monto_inicial REAL DEFAULT 0,
    fecha_cierre TEXT,
    estado TEXT DEFAULT 'abierta',
    usuario_id TEXT
  );

  CREATE TABLE IF NOT EXISTS movimientos_caja (
    id TEXT PRIMARY KEY,
    caja_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    metodo TEXT DEFAULT 'efectivo',
    motivo TEXT,
    fecha TEXT
  );

  CREATE TABLE IF NOT EXISTS cierres_caja (
    id TEXT PRIMARY KEY,
    caja_id TEXT NOT NULL,
    efectivo_esperado REAL,
    efectivo_contado REAL,
    diferencia REAL,
    fecha_cierre TEXT,
    observaciones TEXT
  );

  CREATE TABLE IF NOT EXISTS devoluciones (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    cliente_id TEXT,
    total REAL,
    motivo TEXT,
    fecha TEXT,
    usuario_id TEXT
  );

  CREATE TABLE IF NOT EXISTS devolucion_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    devolucion_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad REAL NOT NULL,
    precio_unit REAL NOT NULL,
    total REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    usuario_id TEXT,
    usuario_nombre TEXT,
    accion TEXT,
    modulo TEXT,
    entidad TEXT,
    entidad_id TEXT,
    detalle TEXT,
    datos_antes TEXT,
    datos_despues TEXT,
    ip TEXT
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    empresa TEXT DEFAULT 'Nicobici',
    nombre_comercial TEXT DEFAULT 'Nicobici - Rodados & Repuestos',
    cuit TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    moneda TEXT DEFAULT 'ARS',
    iva_default REAL DEFAULT 21,
    logo TEXT DEFAULT '',
    ticket_pie TEXT DEFAULT '¡Gracias por su compra!'
  );

  CREATE TABLE IF NOT EXISTS config_drive (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    connected INTEGER DEFAULT 0,
    folder_id TEXT DEFAULT '',
    folder_name TEXT DEFAULT 'Nicobici Backups',
    auto_upload INTEGER DEFAULT 1,
    retention_days INTEGER DEFAULT 30
  );

  CREATE INDEX IF NOT EXISTS idx_prod_sku ON productos(sku);
  CREATE INDEX IF NOT EXISTS idx_prod_barcode ON productos(codigo_barras);
  CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
  CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
  CREATE INDEX IF NOT EXISTS idx_cuotas_venta ON cuotas(venta_id);
  CREATE INDEX IF NOT EXISTS idx_mov_prod ON inventario_movimientos(producto_id);
`);

// Migraciones automáticas de columnas adicionales si ya existía la BD
try { db.exec("ALTER TABLE usuarios ADD COLUMN telefono TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE usuarios ADD COLUMN direccion TEXT;"); } catch (_) {}

function genId(prefix = '') {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== CONFIG =====
function getConfig() {
  const row = db.prepare('SELECT * FROM config WHERE id = 1').get();
  if (!row) {
    db.prepare(`
      INSERT INTO config (id, empresa, nombre_comercial, cuit, direccion, telefono, email, moneda, iva_default, logo, ticket_pie)
      VALUES (1, 'Nicobici', 'Nicobici - Rodados & Repuestos', '', '', '', '', 'ARS', 21, '', '¡Gracias por su compra!')
    `).run();
    return {
      id: 1,
      empresa: 'Nicobici',
      nombreComercial: 'Nicobici - Rodados & Repuestos',
      cuit: '',
      direccion: '',
      telefono: '',
      email: '',
      moneda: 'ARS',
      ivaDefault: 21,
      logo: '',
      ticketPie: '¡Gracias por su compra!'
    };
  }
  return {
    id: row.id,
    empresa: row.empresa || 'Nicobici',
    nombreComercial: row.nombre_comercial || 'Nicobici',
    cuit: row.cuit || '',
    direccion: row.direccion || '',
    telefono: row.telefono || '',
    email: row.email || '',
    moneda: row.moneda || 'ARS',
    ivaDefault: row.iva_default !== undefined ? Number(row.iva_default) : 21,
    logo: row.logo || '',
    ticketPie: row.ticket_pie || '¡Gracias por su compra!'
  };
}

function saveConfig(patch) {
  const curr = getConfig();
  const next = { ...curr, ...patch };
  if (next.ivaDefault !== undefined) {
    next.ivaDefault = Math.max(0, Math.min(100, Number(next.ivaDefault) || 0));
  }
  db.prepare(`
    INSERT INTO config (id, empresa, nombre_comercial, cuit, direccion, telefono, email, moneda, iva_default, logo, ticket_pie)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      empresa = excluded.empresa,
      nombre_comercial = excluded.nombre_comercial,
      cuit = excluded.cuit,
      direccion = excluded.direccion,
      telefono = excluded.telefono,
      email = excluded.email,
      moneda = excluded.moneda,
      iva_default = excluded.iva_default,
      logo = excluded.logo,
      ticket_pie = excluded.ticket_pie
  `).run(
    next.empresa,
    next.nombreComercial || next.empresa,
    next.cuit,
    next.direccion,
    next.telefono,
    next.email,
    next.moneda,
    next.ivaDefault,
    next.logo,
    next.ticketPie
  );
  return getConfig();
}

// ===== CONFIG DRIVE =====
function getConfigDrive() {
  const row = db.prepare('SELECT * FROM config_drive WHERE id = 1').get();
  if (!row) {
    db.prepare(`
      INSERT INTO config_drive (id, connected, folder_id, folder_name, auto_upload, retention_days)
      VALUES (1, 0, '', 'Nicobici Backups', 1, 30)
    `).run();
    return { connected: false, folderId: '', folderName: 'Nicobici Backups', autoUpload: true, retentionDays: 30 };
  }
  return {
    connected: Boolean(row.connected),
    folderId: row.folder_id || '',
    folderName: row.folder_name || 'Nicobici Backups',
    autoUpload: Boolean(row.auto_upload),
    retentionDays: row.retention_days || 30
  };
}

function saveConfigDrive(patch) {
  const curr = getConfigDrive();
  const next = {
    connected: patch.connected !== undefined ? patch.connected : (curr.connected ? 1 : 0),
    folderId: patch.folderId !== undefined ? patch.folderId : curr.folderId,
    folderName: patch.folderName !== undefined ? patch.folderName : curr.folderName,
    autoUpload: patch.autoUpload !== undefined ? patch.autoUpload : (curr.autoUpload ? 1 : 0),
    retentionDays: patch.retentionDays !== undefined ? patch.retentionDays : curr.retentionDays
  };
  db.prepare(`
    INSERT INTO config_drive (id, connected, folder_id, folder_name, auto_upload, retention_days)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      connected = excluded.connected,
      folder_id = excluded.folder_id,
      folder_name = excluded.folder_name,
      auto_upload = excluded.auto_upload,
      retention_days = excluded.retention_days
  `).run(next.connected, next.folderId, next.folderName, next.autoUpload, next.retentionDays);
  return getConfigDrive();
}

// ===== USERS =====
function getUsers() {
  const rows = db.prepare('SELECT * FROM usuarios').all();
  return rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    password: r.password_hash,
    password_hash: r.password_hash,
    rol: r.rol,
    telefono: r.telefono || '',
    direccion: r.direccion || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    ultimo_acceso: r.ultimo_acceso
  }));
}

function findUserByEmail(email) {
  if (!email) return null;
  const r = db.prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    password: r.password_hash,
    password_hash: r.password_hash,
    rol: r.rol,
    telefono: r.telefono || '',
    direccion: r.direccion || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    ultimo_acceso: r.ultimo_acceso
  };
}

function findUserById(id) {
  if (!id) return null;
  const r = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    password: r.password_hash,
    password_hash: r.password_hash,
    rol: r.rol,
    telefono: r.telefono || '',
    direccion: r.direccion || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    ultimo_acceso: r.ultimo_acceso
  };
}

function createUser(user) {
  const id = user.id || genId('user');
  const pwd = user.password_hash || user.password;
  db.prepare(`
    INSERT INTO usuarios (id, nombre, email, password_hash, rol, telefono, direccion, activo, creado, ultimo_acceso)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    user.nombre,
    user.email.toLowerCase().trim(),
    pwd,
    user.rol || 'dueno',
    user.telefono ? user.telefono.trim() : '',
    user.direccion ? user.direccion.trim() : (user.domicilio ? user.domicilio.trim() : ''),
    user.activo !== undefined ? (user.activo ? 1 : 0) : 1,
    user.creado || new Date().toISOString(),
    user.ultimo_acceso || null
  );
  return findUserById(id);
}

function updateUser(id, patch) {
  const curr = findUserById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };
  const pwd = next.password_hash || next.password;
  db.prepare(`
    UPDATE usuarios SET
      nombre = ?,
      email = ?,
      password_hash = ?,
      rol = ?,
      telefono = ?,
      direccion = ?,
      activo = ?,
      ultimo_acceso = ?
    WHERE id = ?
  `).run(
    next.nombre,
    next.email.toLowerCase().trim(),
    pwd,
    next.rol,
    next.telefono || '',
    next.direccion || next.domicilio || '',
    next.activo ? 1 : 0,
    next.ultimo_acceso || null,
    id
  );
  return findUserById(id);
}

// ===== CATEGORIAS =====
function getCategorias() {
  const rows = db.prepare('SELECT * FROM categorias ORDER BY nombre ASC').all();
  return rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    slug: r.slug || r.id,
    codigo: r.codigo || r.nombre.slice(0, 3).toUpperCase(),
    descripcion: r.descripcion || '',
    activo: Boolean(r.activo),
    creado: r.creado
  }));
}

function findCategoriaById(id) {
  const r = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    slug: r.slug || r.id,
    codigo: r.codigo || r.nombre.slice(0, 3).toUpperCase(),
    descripcion: r.descripcion || '',
    activo: Boolean(r.activo),
    creado: r.creado
  };
}

function createCategoria(cat) {
  const id = cat.id || ('cat_' + (cat.slug || cat.nombre.toLowerCase().replace(/\s+/g, '_')));
  db.prepare(`
    INSERT INTO categorias (id, nombre, slug, codigo, descripcion, activo, creado)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    cat.nombre.trim(),
    cat.slug || cat.nombre.toLowerCase().replace(/\s+/g, '-'),
    cat.codigo || cat.nombre.slice(0, 3).toUpperCase(),
    cat.descripcion || '',
    cat.activo !== undefined ? (cat.activo ? 1 : 0) : 1,
    cat.creado || new Date().toISOString()
  );
  return findCategoriaById(id);
}

function updateCategoria(id, patch) {
  const curr = findCategoriaById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };
  db.prepare(`
    UPDATE categorias SET
      nombre = ?,
      slug = ?,
      codigo = ?,
      descripcion = ?,
      activo = ?
    WHERE id = ?
  `).run(
    next.nombre.trim(),
    next.slug,
    next.codigo,
    next.descripcion || '',
    next.activo ? 1 : 0,
    id
  );
  return findCategoriaById(id);
}

function deleteCategoria(id) {
  const cat = findCategoriaById(id);
  if (!cat) return null;
  const count = db.prepare('SELECT COUNT(*) as c FROM productos WHERE categoria_id = ?').get(id).c;
  if (count > 0) return false;
  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  return cat;
}

// ===== PROVEEDORES =====
function getProveedores() {
  const rows = db.prepare('SELECT * FROM proveedores ORDER BY nombre ASC').all();
  return rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    cuit: r.cuit || '',
    telefono: r.telefono || '',
    email: r.email || '',
    direccion: r.direccion || '',
    notas: r.notas || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    actualizado: r.actualizado
  }));
}

function findProveedorById(id) {
  const r = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    cuit: r.cuit || '',
    telefono: r.telefono || '',
    email: r.email || '',
    direccion: r.direccion || '',
    notas: r.notas || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    actualizado: r.actualizado
  };
}

function findProveedorByCuit(cuit) {
  if (!cuit) return null;
  const r = db.prepare('SELECT * FROM proveedores WHERE cuit = ?').get(cuit.trim());
  if (!r) return null;
  return findProveedorById(r.id);
}

function createProveedor(prov) {
  const id = prov.id || genId('prov');
  db.prepare(`
    INSERT INTO proveedores (id, nombre, cuit, telefono, email, direccion, notas, activo, creado, actualizado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    prov.nombre.trim(),
    prov.cuit ? prov.cuit.trim() : '',
    prov.telefono ? prov.telefono.trim() : '',
    prov.email ? prov.email.trim() : '',
    prov.direccion ? prov.direccion.trim() : '',
    prov.notas || '',
    prov.activo !== undefined ? (prov.activo ? 1 : 0) : 1,
    prov.creado || new Date().toISOString(),
    prov.actualizado || new Date().toISOString()
  );
  return findProveedorById(id);
}

function updateProveedor(id, patch) {
  const curr = findProveedorById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };
  db.prepare(`
    UPDATE proveedores SET
      nombre = ?,
      cuit = ?,
      telefono = ?,
      email = ?,
      direccion = ?,
      notas = ?,
      activo = ?,
      actualizado = ?
    WHERE id = ?
  `).run(
    next.nombre.trim(),
    next.cuit || '',
    next.telefono || '',
    next.email || '',
    next.direccion || '',
    next.notas || '',
    next.activo ? 1 : 0,
    new Date().toISOString(),
    id
  );
  return findProveedorById(id);
}

function deleteProveedor(id) {
  const prov = findProveedorById(id);
  if (!prov) return null;
  const prodCount = db.prepare('SELECT COUNT(*) as c FROM productos WHERE proveedor_id = ?').get(id).c;
  if (prodCount > 0) return false;
  const compCount = db.prepare('SELECT COUNT(*) as c FROM compras WHERE proveedor_id = ?').get(id).c;
  if (compCount > 0) return false;
  db.prepare('DELETE FROM proveedores WHERE id = ?').run(id);
  return prov;
}

// ===== CLIENTES =====
function getClientes() {
  const rows = db.prepare('SELECT * FROM clientes ORDER BY nombre ASC').all();
  return rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    telefono: r.telefono || '',
    dni: r.dni || '',
    email: r.email || '',
    direccion: r.direccion || '',
    notas: r.notas || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    actualizado: r.actualizado
  }));
}

function findClienteById(id) {
  const r = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    telefono: r.telefono || '',
    dni: r.dni || '',
    email: r.email || '',
    direccion: r.direccion || '',
    notas: r.notas || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    actualizado: r.actualizado
  };
}

function findClienteByTelefono(tel) {
  if (!tel) return null;
  const clean = tel.replace(/\D/g, '');
  if (!clean) return null;
  const all = getClientes();
  return all.find(c => (c.telefono || '').replace(/\D/g, '') === clean) || null;
}

function createCliente(cli) {
  const id = cli.id || genId('cli');
  db.prepare(`
    INSERT INTO clientes (id, nombre, apellido, telefono, dni, email, direccion, notas, activo, creado, actualizado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    cli.nombre.trim(),
    cli.apellido.trim(),
    cli.telefono ? cli.telefono.trim() : '',
    cli.dni ? cli.dni.trim() : '',
    cli.email ? cli.email.trim() : '',
    cli.direccion ? cli.direccion.trim() : '',
    cli.notas || '',
    cli.activo !== undefined ? (cli.activo ? 1 : 0) : 1,
    cli.creado || new Date().toISOString(),
    cli.actualizado || new Date().toISOString()
  );
  return findClienteById(id);
}

function updateCliente(id, patch) {
  const curr = findClienteById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };
  db.prepare(`
    UPDATE clientes SET
      nombre = ?,
      apellido = ?,
      telefono = ?,
      dni = ?,
      email = ?,
      direccion = ?,
      notas = ?,
      activo = ?,
      actualizado = ?
    WHERE id = ?
  `).run(
    next.nombre.trim(),
    next.apellido.trim(),
    next.telefono || '',
    next.dni || '',
    next.email || '',
    next.direccion || '',
    next.notas || '',
    next.activo ? 1 : 0,
    new Date().toISOString(),
    id
  );
  return findClienteById(id);
}

function deleteCliente(id) {
  const cli = findClienteById(id);
  if (!cli) return null;
  const count = db.prepare('SELECT COUNT(*) as c FROM ventas WHERE cliente_id = ?').get(id).c;
  if (count > 0) return false;
  db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
  return cli;
}

function getDeudaCliente(clienteId) {
  const row = db.prepare(`
    SELECT SUM(debe) as total_deuda FROM ventas
    WHERE cliente_id = ? AND anulada = 0 AND debe > 0.01
  `).get(clienteId);
  return row && row.total_deuda ? Number(row.total_deuda) : 0;
}

function getDeudaUsuario(usuarioId) {
  return getDeudaCliente(usuarioId);
}

// ===== PRODUCTOS =====
function formatProducto(r) {
  if (!r) return null;
  return {
    id: r.id,
    categoriaId: r.categoria_id,
    categoria_id: r.categoria_id,
    proveedorId: r.proveedor_id || null,
    proveedor_id: r.proveedor_id || null,
    nombre: r.nombre,
    descripcion: r.descripcion || '',
    sku: r.sku || '',
    codigoBarras: r.codigo_barras || '',
    codigo_barras: r.codigo_barras || '',
    precio: Number(r.precio) || 0,
    costo: Number(r.costo) || 0,
    stock: Number(r.stock) || 0,
    stockMin: Number(r.stock_minimo) || 2,
    stock_minimo: Number(r.stock_minimo) || 2,
    iva: Number(r.iva) !== undefined ? Number(r.iva) : 21,
    imagen: r.imagen || '',
    activo: Boolean(r.activo),
    creado: r.creado,
    actualizado: r.actualizado
  };
}

function getProductos() {
  const rows = db.prepare('SELECT * FROM productos ORDER BY creado DESC').all();
  return rows.map(formatProducto);
}

function findProductoById(id) {
  const r = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  return formatProducto(r);
}

function findProductoBySkuOrBarcode(code) {
  if (!code) return null;
  const c = code.trim().toLowerCase();
  const r = db.prepare('SELECT * FROM productos WHERE LOWER(sku) = ? OR LOWER(codigo_barras) = ?').get(c, c);
  return formatProducto(r);
}

function createProducto(prod) {
  const id = prod.id || genId('prod');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO productos (id, categoria_id, proveedor_id, nombre, descripcion, sku, codigo_barras, precio, costo, stock, stock_minimo, iva, imagen, activo, creado, actualizado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    prod.categoriaId || prod.categoria_id || null,
    prod.proveedorId || prod.proveedor_id || null,
    prod.nombre.trim(),
    prod.descripcion || '',
    prod.sku ? prod.sku.trim() : '',
    prod.codigoBarras || prod.codigo_barras ? (prod.codigoBarras || prod.codigo_barras).trim() : '',
    Number(prod.precio) || 0,
    Number(prod.costo) || 0,
    Number(prod.stock) || 0,
    prod.stockMin !== undefined ? Number(prod.stockMin) : (prod.stock_minimo !== undefined ? Number(prod.stock_minimo) : 2),
    prod.iva !== undefined ? Number(prod.iva) : 21,
    prod.imagen || '',
    prod.activo !== undefined ? (prod.activo ? 1 : 0) : 1,
    prod.creado || now,
    prod.actualizado || now
  );

  // Registrar historial de precios inicial
  if (prod.precio || prod.costo) {
    db.prepare(`
      INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo, costo_anterior, costo_nuevo, fecha)
      VALUES (?, 0, ?, 0, ?, ?)
    `).run(id, Number(prod.precio) || 0, Number(prod.costo) || 0, now);
  }

  return findProductoById(id);
}

function updateProducto(id, patch) {
  const curr = findProductoById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };
  const now = new Date().toISOString();

  // Historial de precios si cambiaron
  if (patch.precio !== undefined || patch.costo !== undefined) {
    const prevPrecio = curr.precio;
    const nextPrecio = Number(next.precio) || 0;
    const prevCosto = curr.costo;
    const nextCosto = Number(next.costo) || 0;
    if (prevPrecio !== nextPrecio || prevCosto !== nextCosto) {
      db.prepare(`
        INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo, costo_anterior, costo_nuevo, fecha)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, prevPrecio, nextPrecio, prevCosto, nextCosto, now);
    }
  }

  db.prepare(`
    UPDATE productos SET
      categoria_id = ?,
      proveedor_id = ?,
      nombre = ?,
      descripcion = ?,
      sku = ?,
      codigo_barras = ?,
      precio = ?,
      costo = ?,
      stock = ?,
      stock_minimo = ?,
      iva = ?,
      imagen = ?,
      activo = ?,
      actualizado = ?
    WHERE id = ?
  `).run(
    next.categoriaId || next.categoria_id || null,
    next.proveedorId || next.proveedor_id || null,
    next.nombre.trim(),
    next.descripcion || '',
    next.sku || '',
    next.codigoBarras || next.codigo_barras || '',
    Number(next.precio) || 0,
    Number(next.costo) || 0,
    Number(next.stock) || 0,
    next.stockMin !== undefined ? Number(next.stockMin) : (next.stock_minimo !== undefined ? Number(next.stock_minimo) : 2),
    next.iva !== undefined ? Number(next.iva) : 21,
    next.imagen || '',
    next.activo ? 1 : 0,
    now,
    id
  );
  return findProductoById(id);
}

function deleteProducto(id) {
  const prod = findProductoById(id);
  if (!prod) return null;
  const count = db.prepare('SELECT COUNT(*) as c FROM venta_items WHERE producto_id = ?').get(id).c;
  if (count > 0) {
    // Si tiene ventas históricas, baja lógica
    updateProducto(id, { activo: false });
    return { ...prod, activo: false, softDeleted: true };
  }
  db.prepare('DELETE FROM productos WHERE id = ?').run(id);
  db.prepare('DELETE FROM historial_precios WHERE producto_id = ?').run(id);
  return prod;
}

// ===== VENTAS & VENTA_ITEMS =====
function formatVenta(r) {
  if (!r) return null;
  const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(r.id).map(i => ({
    id: i.id,
    productoId: i.producto_id,
    producto_id: i.producto_id,
    nombre: i.nombre,
    sku: i.sku,
    categoriaId: i.categoria_id,
    precioUnit: Number(i.precio_unit) || 0,
    costoUnit: Number(i.costo_unit) || 0,
    iva: Number(i.iva) || 0,
    qty: Number(i.cantidad) || 0,
    cantidad: Number(i.cantidad) || 0,
    subtotal: Number(i.subtotal) || 0,
    ivaAmount: Number(i.iva_amount) || 0,
    totalItem: Number(i.total_item) || 0
  }));

  const cuotas = db.prepare('SELECT * FROM cuotas WHERE venta_id = ? ORDER BY numero ASC').all(r.id).map(c => ({
    id: c.id,
    n: c.numero,
    numero: c.numero,
    monto: Number(c.monto_original) || 0,
    montoOriginal: Number(c.monto_original) || 0,
    montoPagado: Number(c.monto_pagado) || 0,
    saldo: Number(c.saldo) || 0,
    vencimiento: c.vencimiento,
    pagado: c.estado === 'pagada',
    estado: c.estado,
    fechaPago: c.fecha_pago,
    metodo: c.metodo_pago
  }));

  return {
    id: r.id,
    ticketNro: r.ticket_nro,
    ticket_nro: r.ticket_nro,
    clienteId: r.cliente_id,
    cliente_id: r.cliente_id,
    clienteNombre: r.cliente_nombre || 'Cliente Ocasional',
    cliente_nombre: r.cliente_nombre || 'Cliente Ocasional',
    clienteTelefono: r.cliente_telefono || '',
    cliente_telefono: r.cliente_telefono || '',
    // backward compatibility
    usuarioId: r.cliente_id,
    usuarioNombre: r.cliente_nombre || 'Cliente Ocasional',
    usuarioEmail: r.cliente_telefono || '',
    fecha: r.fecha,
    items,
    subtotal: Number(r.subtotal) || 0,
    ivaTotal: Number(r.iva_total) || 0,
    ivaPercent: Number(r.iva_percent) || 21,
    total: Number(r.total) || 0,
    pagado: Number(r.pagado) || 0,
    debe: Number(r.debe) || 0,
    estado: r.estado,
    cuotasTotal: Number(r.cuotas_total) || 1,
    cuotas: cuotas.length ? cuotas : null,
    vendedorId: r.vendedor_id || null,
    anulada: Boolean(r.anulada),
    fechaAnulacion: r.fecha_anulacion,
    motivoAnulacion: r.motivo_anulacion,
    creado: r.creado
  };
}

function getVentas() {
  const rows = db.prepare('SELECT * FROM ventas ORDER BY creado DESC').all();
  return rows.map(formatVenta);
}

function findVentaById(id) {
  const r = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
  return formatVenta(r);
}

function createVenta(v) {
  const id = v.id || genId('venta');
  const now = v.creado || new Date().toISOString();
  const ticketNro = v.ticketNro || v.ticket_nro || ('T-' + id.slice(-8).toUpperCase());

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO ventas (
        id, ticket_nro, cliente_id, cliente_nombre, cliente_telefono,
        fecha, subtotal, iva_total, iva_percent, total, pagado, debe,
        estado, cuotas_total, vendedor_id, anulada, creado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      ticketNro,
      v.clienteId || v.cliente_id || null,
      v.clienteNombre || v.cliente_nombre || 'Cliente',
      v.clienteTelefono || v.cliente_telefono || '',
      v.fecha || now.slice(0, 10),
      Number(v.subtotal) || 0,
      Number(v.ivaTotal) || Number(v.iva_total) || 0,
      Number(v.ivaPercent) || Number(v.iva_percent) || 21,
      Number(v.total) || 0,
      Number(v.pagado) || 0,
      Number(v.debe) || 0,
      v.estado || 'pendiente',
      Number(v.cuotasTotal) || Number(v.cuotas_total) || 1,
      v.vendedorId || v.vendedor_id || null,
      now
    );

    // Insert Items
    const stmtItem = db.prepare(`
      INSERT INTO venta_items (
        venta_id, producto_id, nombre, sku, categoria_id,
        precio_unit, costo_unit, iva, cantidad, subtotal, iva_amount, total_item
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of (v.items || [])) {
      stmtItem.run(
        id,
        it.productoId || it.producto_id,
        it.nombre,
        it.sku || '',
        it.categoriaId || it.categoria_id || null,
        Number(it.precioUnit) || Number(it.precio_unit) || 0,
        Number(it.costoUnit) || Number(it.costo_unit) || 0,
        Number(it.iva) || 0,
        Number(it.qty) || Number(it.cantidad) || 1,
        Number(it.subtotal) || 0,
        Number(it.ivaAmount) || Number(it.iva_amount) || 0,
        Number(it.totalItem) || Number(it.total_item) || 0
      );
    }

    // Insert Cuotas si existen
    if (v.cuotas && Array.isArray(v.cuotas)) {
      const stmtCuota = db.prepare(`
        INSERT INTO cuotas (
          venta_id, numero, monto_original, monto_pagado, saldo,
          vencimiento, estado, fecha_pago, metodo_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of v.cuotas) {
        stmtCuota.run(
          id,
          c.n || c.numero || 1,
          Number(c.monto) || Number(c.montoOriginal) || 0,
          Number(c.montoPagado) || 0,
          Number(c.saldo) || (Number(c.monto) - Number(c.montoPagado || 0)),
          c.vencimiento || now.slice(0, 10),
          c.estado || (c.pagado ? 'pagada' : 'pendiente'),
          c.fechaPago || null,
          c.metodo || null
        );
      }
    }

    db.exec('COMMIT');
    return findVentaById(id);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function updateVenta(id, patch) {
  const curr = findVentaById(id);
  if (!curr) return null;
  const next = { ...curr, ...patch };

  db.prepare(`
    UPDATE ventas SET
      pagado = ?,
      debe = ?,
      estado = ?,
      anulada = ?,
      fecha_anulacion = ?,
      motivo_anulacion = ?
    WHERE id = ?
  `).run(
    Number(next.pagado) || 0,
    Number(next.debe) || 0,
    next.estado,
    next.anulada ? 1 : 0,
    next.fechaAnulacion || null,
    next.motivoAnulacion || null,
    id
  );

  return findVentaById(id);
}

function deleteVenta(id) {
  const v = findVentaById(id);
  if (!v) return null;
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM venta_items WHERE venta_id = ?').run(id);
    db.prepare('DELETE FROM cuotas WHERE venta_id = ?').run(id);
    db.prepare('DELETE FROM pagos WHERE venta_id = ?').run(id);
    db.prepare('DELETE FROM ventas WHERE id = ?').run(id);
    db.exec('COMMIT');
    return v;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ===== PAGOS =====
function getPagos() {
  const rows = db.prepare('SELECT * FROM pagos ORDER BY fecha DESC').all();
  return rows.map(r => ({
    id: r.id,
    ventaId: r.venta_id,
    clienteId: r.cliente_id,
    usuarioId: r.cliente_id,
    monto: Number(r.monto) || 0,
    metodo: r.metodo,
    referencia: r.referencia || '',
    fecha: r.fecha
  }));
}

function getPagosByVenta(ventaId) {
  const rows = db.prepare('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC').all(ventaId);
  return rows.map(r => ({
    id: r.id,
    ventaId: r.venta_id,
    clienteId: r.cliente_id,
    monto: Number(r.monto) || 0,
    metodo: r.metodo,
    referencia: r.referencia || '',
    fecha: r.fecha
  }));
}

function createPago(p) {
  const id = p.id || genId('pago');
  const now = p.fecha || new Date().toISOString();
  db.prepare(`
    INSERT INTO pagos (id, venta_id, cliente_id, monto, metodo, referencia, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    p.ventaId || p.venta_id,
    p.clienteId || p.cliente_id || null,
    Number(p.monto) || 0,
    p.metodo || 'efectivo',
    p.referencia || '',
    now
  );
  return { id, ventaId: p.ventaId, clienteId: p.clienteId, monto: Number(p.monto), metodo: p.metodo, fecha: now };
}

function deletePagosByVenta(ventaId) {
  db.prepare('DELETE FROM pagos WHERE venta_id = ?').run(ventaId);
}

// ===== MOVIMIENTOS KARDEX =====
function getMovimientos() {
  const rows = db.prepare('SELECT * FROM inventario_movimientos ORDER BY fecha DESC').all();
  return rows.map(r => ({
    id: r.id,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    tipo: r.tipo,
    cantidad: Number(r.cantidad) || 0,
    stockAntes: Number(r.stock_antes) || 0,
    stockDespues: Number(r.stock_despues) || 0,
    motivo: r.motivo,
    referenciaId: r.referencia_id,
    fecha: r.fecha,
    usuarioId: r.usuario_id
  }));
}

function createMovimiento(m) {
  const id = m.id || genId('mov');
  const now = m.fecha || new Date().toISOString();
  db.prepare(`
    INSERT INTO inventario_movimientos (
      id, producto_id, producto_nombre, tipo, cantidad,
      stock_antes, stock_despues, motivo, referencia_id, fecha, usuario_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    m.productoId || m.producto_id,
    m.productoNombre || m.producto_nombre || '',
    m.tipo,
    Number(m.cantidad) || 0,
    Number(m.stockAntes) || Number(m.stock_antes) || 0,
    Number(m.stockDespues) || Number(m.stock_despues) || 0,
    m.motivo || '',
    m.referenciaId || m.referencia_id || null,
    now,
    m.usuarioId || m.usuario_id || null
  );
  return { id, ...m, fecha: now };
}

function getMovimientosByProducto(productoId) {
  const rows = db.prepare('SELECT * FROM inventario_movimientos WHERE producto_id = ? ORDER BY fecha DESC').all(productoId);
  return rows.map(r => ({
    id: r.id,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    tipo: r.tipo,
    cantidad: Number(r.cantidad) || 0,
    stockAntes: Number(r.stock_antes) || 0,
    stockDespues: Number(r.stock_despues) || 0,
    motivo: r.motivo,
    referenciaId: r.referencia_id,
    fecha: r.fecha,
    usuarioId: r.usuario_id
  }));
}

function ajustarStock(productoId, delta, tipo, motivo, usuarioId, referenciaId = null) {
  const prod = findProductoById(productoId);
  if (!prod) return null;
  const antes = Number(prod.stock) || 0;
  const despues = antes + Number(delta);
  if (despues < 0) return false;

  db.prepare('UPDATE productos SET stock = ?, actualizado = ? WHERE id = ?')
    .run(despues, new Date().toISOString(), productoId);

  createMovimiento({
    productoId,
    productoNombre: prod.nombre,
    tipo,
    cantidad: delta,
    stockAntes: antes,
    stockDespues: despues,
    motivo: motivo || tipo,
    referenciaId,
    usuarioId
  });

  return { antes, despues };
}

// ===== CUOTAS HELPERS =====
function buildCuotas(total, cuotasTotal, fechaBase) {
  if (!cuotasTotal || cuotasTotal <= 1) return null;
  const n = Math.max(2, Math.min(36, Number(cuotasTotal)));
  const base = Math.floor((total / n) * 100) / 100;
  const cuotas = [];
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    let monto = i === n ? Math.round((total - acc) * 100) / 100 : base;
    acc += monto;
    const venc = new Date(fechaBase);
    venc.setMonth(venc.getMonth() + (i - 1));
    cuotas.push({
      n: i,
      numero: i,
      monto,
      montoOriginal: monto,
      montoPagado: 0,
      saldo: monto,
      vencimiento: venc.toISOString().slice(0, 10),
      pagado: false,
      estado: 'pendiente',
      fechaPago: null,
      metodo: null
    });
  }
  const sum = cuotas.reduce((s, c) => s + c.monto, 0);
  if (Math.abs(sum - total) > 0.01) {
    cuotas[cuotas.length - 1].monto = Math.round((cuotas[cuotas.length - 1].monto + (total - sum)) * 100) / 100;
    cuotas[cuotas.length - 1].montoOriginal = cuotas[cuotas.length - 1].monto;
    cuotas[cuotas.length - 1].saldo = cuotas[cuotas.length - 1].monto;
  }
  return cuotas;
}

function syncCuotasPagos(venta) {
  if (!venta.cuotas || !venta.cuotas.length) return venta;
  let pagado = Number(venta.pagado) || 0;
  let remaining = pagado;

  for (const c of venta.cuotas) {
    const targetMonto = Number(c.monto || c.montoOriginal || 0);
    if (remaining >= targetMonto - 0.01) {
      c.pagado = true;
      c.estado = 'pagada';
      c.montoPagado = targetMonto;
      c.saldo = 0;
      remaining -= targetMonto;
    } else if (remaining > 0) {
      c.pagado = false;
      c.estado = 'parcial';
      c.montoPagado = Math.round(remaining * 100) / 100;
      c.saldo = Math.round((targetMonto - remaining) * 100) / 100;
      remaining = 0;
    } else {
      c.pagado = false;
      c.estado = 'pendiente';
      c.montoPagado = 0;
      c.saldo = targetMonto;
    }

    // Actualizar en SQLite
    if (c.id) {
      db.prepare(`
        UPDATE cuotas SET
          monto_pagado = ?,
          saldo = ?,
          estado = ?
        WHERE id = ?
      `).run(c.montoPagado, c.saldo, c.estado, c.id);
    }
  }

  return venta;
}

// ===== COMPRAS A PROVEEDORES =====
function getCompras() {
  const rows = db.prepare('SELECT * FROM compras ORDER BY creado DESC').all();
  return rows.map(r => {
    const items = db.prepare('SELECT * FROM compra_items WHERE compra_id = ?').all(r.id);
    return {
      id: r.id,
      proveedorId: r.proveedor_id,
      numero: r.numero,
      fecha: r.fecha,
      subtotal: Number(r.subtotal) || 0,
      ivaTotal: Number(r.iva_total) || 0,
      total: Number(r.total) || 0,
      pagado: Number(r.pagado) || 0,
      debe: Number(r.debe) || 0,
      estado: r.estado,
      notas: r.notas,
      items: items.map(i => ({
        id: i.id,
        productoId: i.producto_id,
        cantidad: Number(i.cantidad),
        costoUnit: Number(i.costo_unit),
        subtotal: Number(i.subtotal),
        iva: Number(i.iva),
        total: Number(i.total)
      })),
      creado: r.creado
    };
  });
}

function findCompraById(id) {
  const r = db.prepare('SELECT * FROM compras WHERE id = ?').get(id);
  if (!r) return null;
  const items = db.prepare('SELECT * FROM compra_items WHERE compra_id = ?').all(id);
  return {
    id: r.id,
    proveedorId: r.proveedor_id,
    numero: r.numero,
    fecha: r.fecha,
    subtotal: Number(r.subtotal) || 0,
    ivaTotal: Number(r.iva_total) || 0,
    total: Number(r.total) || 0,
    pagado: Number(r.pagado) || 0,
    debe: Number(r.debe) || 0,
    estado: r.estado,
    notas: r.notas,
    items: items.map(i => ({
      id: i.id,
      productoId: i.producto_id,
      cantidad: Number(i.cantidad),
      costoUnit: Number(i.costo_unit),
      subtotal: Number(i.subtotal),
      iva: Number(i.iva),
      total: Number(i.total)
    })),
    creado: r.creado
  };
}

function createCompra(c, usuarioId = null) {
  const id = c.id || genId('comp');
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO compras (id, proveedor_id, numero, fecha, subtotal, iva_total, total, pagado, debe, estado, notas, creado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      c.proveedorId || c.proveedor_id,
      c.numero || '',
      c.fecha || now.slice(0, 10),
      Number(c.subtotal) || 0,
      Number(c.ivaTotal) || 0,
      Number(c.total) || 0,
      Number(c.pagado) || 0,
      Number(c.debe) || 0,
      c.estado || 'pagada',
      c.notas || '',
      now
    );

    const stmtItem = db.prepare(`
      INSERT INTO compra_items (compra_id, producto_id, cantidad, costo_unit, subtotal, iva, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of (c.items || [])) {
      const qty = Number(it.cantidad || it.qty) || 1;
      const costo = Number(it.costoUnit || it.costo_unit || it.costo) || 0;
      stmtItem.run(
        id,
        it.productoId || it.producto_id,
        qty,
        costo,
        Number(it.subtotal) || (qty * costo),
        Number(it.iva) || 0,
        Number(it.total) || (qty * costo)
      );

      // Aumentar stock del producto y actualizar costo
      const prod = findProductoById(it.productoId || it.producto_id);
      if (prod) {
        const antes = Number(prod.stock) || 0;
        const despues = antes + qty;
        db.prepare('UPDATE productos SET stock = ?, costo = ?, actualizado = ? WHERE id = ?')
          .run(despues, costo, now, prod.id);

        createMovimiento({
          productoId: prod.id,
          productoNombre: prod.nombre,
          tipo: 'compra',
          cantidad: qty,
          stockAntes: antes,
          stockDespues: despues,
          motivo: `Compra ${c.numero || id}`,
          referenciaId: id,
          usuarioId
        });
      }
    }

    db.exec('COMMIT');
    return findCompraById(id);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ===== CAJA DIARIA =====
function getCajaAbierta() {
  const r = db.prepare('SELECT * FROM cajas WHERE estado = ? ORDER BY fecha_apertura DESC LIMIT 1').get('abierta');
  if (!r) return null;
  const movs = db.prepare('SELECT * FROM movimientos_caja WHERE caja_id = ? ORDER BY fecha DESC').all(r.id);
  const ingresos = movs.filter(m => ['ingreso', 'venta', 'pago_deuda'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0);
  const egresos = movs.filter(m => ['egreso', 'gasto', 'retiro'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0);
  const efectivoEsperado = Number(r.monto_inicial) + (
    movs.filter(m => m.metodo === 'efectivo' && ['ingreso', 'venta', 'pago_deuda'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0) -
    movs.filter(m => m.metodo === 'efectivo' && ['egreso', 'gasto', 'retiro'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0)
  );

  return {
    id: r.id,
    fechaApertura: r.fecha_apertura,
    montoInicial: Number(r.monto_inicial),
    estado: r.estado,
    usuarioId: r.usuario_id,
    movimientos: movs.map(m => ({ id: m.id, cajaId: m.caja_id, tipo: m.tipo, monto: Number(m.monto), metodo: m.metodo, motivo: m.motivo, fecha: m.fecha })),
    totales: {
      montoInicial: Number(r.monto_inicial),
      ingresos,
      egresos,
      efectivoEsperado,
      saldoTotal: Number(r.monto_inicial) + ingresos - egresos
    }
  };
}

function abrirCaja(montoInicial = 0, usuarioId = null) {
  const abierta = getCajaAbierta();
  if (abierta) return { ok: false, error: 'Ya existe una caja abierta' };
  const id = genId('caja');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cajas (id, fecha_apertura, monto_inicial, estado, usuario_id)
    VALUES (?, ?, ?, 'abierta', ?)
  `).run(id, now, Number(montoInicial) || 0, usuarioId);

  return { ok: true, data: getCajaAbierta() };
}

function registrarMovimientoCaja({ tipo, monto, metodo = 'efectivo', motivo = '' }) {
  let caja = getCajaAbierta();
  if (!caja) {
    abrirCaja(0, null);
    caja = getCajaAbierta();
  }
  if (!caja) return null;
  const id = genId('mcaja');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO movimientos_caja (id, caja_id, tipo, monto, metodo, motivo, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, caja.id, tipo, Number(monto) || 0, metodo, motivo, now);
  return { id, cajaId: caja.id, tipo, monto: Number(monto), metodo, motivo, fecha: now };
}

function cerrarCaja({ efectivoContado, observaciones = '', usuarioId = null }) {
  const caja = getCajaAbierta();
  if (!caja) return { ok: false, error: 'No hay ninguna caja abierta para cerrar' };
  const now = new Date().toISOString();
  const esperado = caja.totales.efectivoEsperado;
  const contado = Number(efectivoContado) || 0;
  const diferencia = contado - esperado;
  const id = genId('cierre');

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO cierres_caja (id, caja_id, efectivo_esperado, efectivo_contado, diferencia, fecha_cierre, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, caja.id, esperado, contado, diferencia, now, observaciones);

    db.prepare(`
      UPDATE cajas SET estado = 'cerrada', fecha_cierre = ? WHERE id = ?
    `).run(now, caja.id);

    db.exec('COMMIT');
    return {
      ok: true,
      data: {
        id,
        cajaId: caja.id,
        efectivoEsperado: esperado,
        efectivoContado: contado,
        diferencia,
        fechaCierre: now,
        observaciones
      }
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getHistorialCajas() {
  const rows = db.prepare(`
    SELECT c.*, ci.efectivo_esperado, ci.efectivo_contado, ci.diferencia, ci.observaciones
    FROM cajas c
    LEFT JOIN cierres_caja ci ON c.id = ci.caja_id
    ORDER BY c.fecha_apertura DESC
    LIMIT 30
  `).all();
  return rows;
}

// ===== AUDITORIA =====
function getAuditoria(limit = 200) {
  const rows = db.prepare('SELECT * FROM auditoria ORDER BY fecha DESC LIMIT ?').all(limit);
  return rows.map(r => ({
    id: r.id,
    fecha: r.fecha,
    usuarioId: r.usuario_id,
    usuarioNombre: r.usuario_nombre,
    accion: r.accion,
    modulo: r.modulo || '',
    entidad: r.entidad || '',
    entidadId: r.entidad_id || '',
    detalle: r.detalle || '',
    datosAntes: r.datos_antes ? JSON.parse(r.datos_antes) : null,
    datosDespues: r.datos_despues ? JSON.parse(r.datos_despues) : null,
    ip: r.ip
  }));
}

function registrarAuditoria({ usuarioId = 'sistema', usuarioNombre = 'Sistema', accion = 'EVENTO', modulo = '', entidad = '', entidadId = '', detalle = '', datosAntes = null, datosDespues = null, ip = '127.0.0.1' }) {
  const id = genId('aud');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO auditoria (id, fecha, usuario_id, usuario_nombre, accion, modulo, entidad, entidad_id, detalle, datos_antes, datos_despues, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    now,
    usuarioId,
    usuarioNombre,
    accion,
    modulo,
    entidad,
    entidadId,
    detalle,
    datosAntes ? JSON.stringify(datosAntes) : null,
    datosDespues ? JSON.stringify(datosDespues) : null,
    ip
  );
  return { id, fecha: now, accion, detalle };
}

// ===== BACKUP SNAPSHOT GENERATOR =====
function generarBackupSnapshot() {
  return {
    fecha: new Date().toISOString(),
    sistema: 'Nicobici v5 Enterprise POS & ERP (SQLite Engine)',
    config: getConfig(),
    usuarios: getUsers().map(u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, creado: u.creado })),
    categorias: getCategorias(),
    proveedores: getProveedores(),
    clientes: getClientes(),
    productos: getProductos(),
    ventas: getVentas(),
    pagos: getPagos(),
    compras: getCompras(),
    caja: getCajaAbierta(),
    movimientos: getMovimientos(),
    auditoria: getAuditoria(500)
  };
}

module.exports = {
  db,
  genId,
  getConfig, saveConfig,
  getConfigDrive, saveConfigDrive,
  getUsers, findUserByEmail, findUserById, createUser, updateUser,
  getCategorias, findCategoriaById, createCategoria, updateCategoria, deleteCategoria,
  getProveedores, findProveedorById, findProveedorByCuit, createProveedor, updateProveedor, deleteProveedor,
  getClientes, findClienteById, findClienteByTelefono, createCliente, updateCliente, deleteCliente, getDeudaCliente, getDeudaUsuario,
  getProductos, findProductoById, findProductoBySkuOrBarcode, createProducto, updateProducto, deleteProducto,
  getVentas, findVentaById, createVenta, updateVenta, deleteVenta,
  getPagos, createPago, getPagosByVenta, deletePagosByVenta,
  getMovimientos, createMovimiento, getMovimientosByProducto, ajustarStock,
  buildCuotas, syncCuotasPagos,
  getCompras, findCompraById, createCompra,
  getCajaAbierta, abrirCaja, registrarMovimientoCaja, cerrarCaja, getHistorialCajas,
  getAuditoria, registrarAuditoria,
  generarBackupSnapshot
};
