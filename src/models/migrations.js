const fs = require('fs');
const path = require('path');
const dbDao = require('./db');

const DATA_DIR = path.join(__dirname, '../../data');

function readJson(file, def = []) {
  try {
    if (!fs.existsSync(file)) return def;
    const c = fs.readFileSync(file, 'utf8');
    if (!c.trim()) return def;
    return JSON.parse(c);
  } catch (e) {
    console.error('Error reading JSON:', file, e.message);
    return def;
  }
}

function migrateFromJSON() {
  console.log('\n========================================');
  console.log('📦 Iniciando Migración JSON -> SQLite DB');
  console.log('========================================\n');

  // 1. Config
  const cfgFile = path.join(DATA_DIR, 'config.json');
  if (fs.existsSync(cfgFile)) {
    const cfg = readJson(cfgFile, {});
    dbDao.saveConfig(cfg);
    console.log('✓ Configuración migrada a SQLite');
  }

  // 2. Usuarios
  const users = readJson(path.join(DATA_DIR, 'users.json'), []);
  let userCount = 0;
  for (const u of users) {
    if (!dbDao.findUserByEmail(u.email)) {
      dbDao.createUser(u);
      userCount++;
    }
  }
  console.log(`✓ Usuarios migrados: ${userCount} nuevos (Total JSON: ${users.length})`);

  // 3. Categorías
  const cats = readJson(path.join(DATA_DIR, 'categorias.json'), []);
  let catCount = 0;
  for (const c of cats) {
    if (!dbDao.findCategoriaById(c.id)) {
      dbDao.createCategoria(c);
      catCount++;
    }
  }
  console.log(`✓ Categorías migradas: ${catCount} nuevas (Total JSON: ${cats.length})`);

  // 4. Proveedores
  const provs = readJson(path.join(DATA_DIR, 'proveedores.json'), []);
  let provCount = 0;
  for (const p of provs) {
    if (!dbDao.findProveedorById(p.id)) {
      dbDao.createProveedor(p);
      provCount++;
    }
  }
  console.log(`✓ Proveedores migrados: ${provCount} nuevos (Total JSON: ${provs.length})`);

  // 5. Clientes
  const clientes = readJson(path.join(DATA_DIR, 'clientes.json'), []);
  let cliCount = 0;
  for (const c of clientes) {
    if (!dbDao.findClienteById(c.id)) {
      dbDao.createCliente(c);
      cliCount++;
    }
  }
  console.log(`✓ Clientes migrados: ${cliCount} nuevos (Total JSON: ${clientes.length})`);

  // 6. Productos
  const prods = readJson(path.join(DATA_DIR, 'productos.json'), []);
  let prodCount = 0;
  for (const p of prods) {
    if (!dbDao.findProductoById(p.id)) {
      dbDao.createProducto(p);
      prodCount++;
    }
  }
  console.log(`✓ Productos migrados: ${prodCount} nuevos (Total JSON: ${prods.length})`);

  // 7. Ventas
  const ventas = readJson(path.join(DATA_DIR, 'ventas.json'), []);
  let vCount = 0;
  for (const v of ventas) {
    if (!dbDao.findVentaById(v.id)) {
      dbDao.createVenta(v);
      vCount++;
    }
  }
  console.log(`✓ Ventas migradas: ${vCount} nuevas (Total JSON: ${ventas.length})`);

  // 8. Pagos
  const pagos = readJson(path.join(DATA_DIR, 'pagos.json'), []);
  let pagoCount = 0;
  const existingPagos = dbDao.getPagos();
  for (const p of pagos) {
    if (!existingPagos.some(x => x.id === p.id)) {
      dbDao.createPago(p);
      pagoCount++;
    }
  }
  console.log(`✓ Pagos migrados: ${pagoCount} nuevos (Total JSON: ${pagos.length})`);

  // 9. Kardex / Movimientos
  const movs = readJson(path.join(DATA_DIR, 'inventario_movimientos.json'), []);
  let movCount = 0;
  const existingMovs = dbDao.getMovimientos();
  for (const m of movs) {
    if (!existingMovs.some(x => x.id === m.id)) {
      dbDao.createMovimiento(m);
      movCount++;
    }
  }
  console.log(`✓ Movimientos Kardex migrados: ${movCount} nuevos (Total JSON: ${movs.length})`);

  // 10. Auditoría
  const auds = readJson(path.join(DATA_DIR, 'auditoria.json'), []);
  let audCount = 0;
  for (const a of auds) {
    dbDao.registrarAuditoria(a);
    audCount++;
  }
  console.log(`✓ Auditoría sincronizada: ${audCount} registros`);

  console.log('\n========================================');
  console.log('✅ Migración a SQLite completada con éxito.');
  console.log(`   Base de datos: ${path.join(DATA_DIR, 'nicobici.db')}`);
  console.log('========================================\n');
}

if (require.main === module) {
  migrateFromJSON();
}

module.exports = { migrateFromJSON };
