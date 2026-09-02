const bcrypt = require('bcryptjs');
const dbDao = require('../src/models/db');
const { db } = dbDao;

console.log('\n🧹 Limpiando TODO: usuarios, categorías, clientes, productos, ventas...\n');

db.exec('BEGIN TRANSACTION');
try {
  db.prepare('DELETE FROM venta_items').run();
  db.prepare('DELETE FROM cuotas').run();
  db.prepare('DELETE FROM pagos').run();
  db.prepare('DELETE FROM ventas').run();
  db.prepare('DELETE FROM compra_items').run();
  db.prepare('DELETE FROM compras').run();
  db.prepare('DELETE FROM devolucion_items').run();
  db.prepare('DELETE FROM devoluciones').run();
  db.prepare('DELETE FROM movimientos_caja').run();
  db.prepare('DELETE FROM cierres_caja').run();
  db.prepare('DELETE FROM cajas').run();
  db.prepare('DELETE FROM inventario_movimientos').run();
  db.prepare('DELETE FROM historial_precios').run();
  db.prepare('DELETE FROM productos').run();
  db.prepare('DELETE FROM clientes').run();
  db.prepare('DELETE FROM proveedores').run();
  db.prepare('DELETE FROM categorias').run();
  db.prepare('DELETE FROM usuarios').run();
  db.prepare('DELETE FROM auditoria').run();
  db.exec('COMMIT');
  console.log('✓ Todas las tablas vaciadas');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

// Crear dueño admin/admin
const hash = bcrypt.hashSync('admin', 10);
const now = new Date().toISOString();

dbDao.createUser({
  id: 'user_admin',
  nombre: 'Admin',
  email: 'admin',
  password_hash: hash,
  rol: 'dueno',
  telefono: '',
  direccion: '',
  activo: 1,
  creado: now
});



console.log('✓ Dueño creado: admin / admin (y admin@nicobici.local / admin)');

dbDao.registrarAuditoria({
  usuarioId: 'user_admin',
  usuarioNombre: 'Admin',
  accion: 'LIMPIEZA_TOTAL',
  modulo: 'SISTEMA',
  entidad: 'sistema',
  entidadId: 'clean',
  detalle: 'Limpieza total + creación admin/admin'
});

console.log('\n✅ Base limpia lista. Categorías, clientes, productos = 0');
console.log('   Login: admin / admin');
console.log(`   Usuarios: ${dbDao.getUsers().length} | Categorias: ${dbDao.getCategorias().length} | Clientes: ${dbDao.getClientes().length} | Productos: ${dbDao.getProductos().length}\n`);
