/**
 * Generador de datos de prueba para Nicobici (Original)
 */
const { initDB } = require('./src/models/init');
initDB();
const { db } = require('./src/models/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function newId() { return crypto.randomUUID(); }
function hashPw(pw) { return bcrypt.hashSync(pw, 10); }

console.log('[*] Cargando datos de prueba completos en Nicobici...');

// 1. Usuarios
const uCount = db.prepare('SELECT count(*) as c FROM usuarios WHERE email = ?').get('admin').c;
if (uCount === 0) {
  db.prepare(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, activo, creado)
              VALUES (?, ?, ?, ?, 'dueno', 1, datetime('now'))`)
    .run(newId(), 'Administrador', 'admin', hashPw('admin'));
}

// 2. Categorías
const cats = [
  'Bicicletas MTB / Montaña',
  'Bicicletas Urbanas & Paseo',
  'Transmisión & Cambios',
  'Frenos & Rotores',
  'Cubiertas & Cámaras',
  'Accesorios & Seguridad',
  'Taller & Lubricantes'
];

for (const c of cats) {
  const exists = db.prepare('SELECT count(*) as c FROM categorias WHERE nombre = ?').get(c).c;
  if (exists === 0) {
    db.prepare(`INSERT INTO categorias (id, nombre, slug, activo, creado) VALUES (?, ?, ?, 1, datetime('now'))`)
      .run(newId(), c, c.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
}

// 3. Proveedores
const provs = [
  { nombre: 'Shimano Argentina S.A.', cuit: '30-71234567-9', tel: '011-4567-8900', email: 'ventas@shimano.com.ar' },
  { nombre: 'Distribuidora Rodados Sur', cuit: '30-68994411-3', tel: '011-4321-1234', email: 'contacto@rodadossur.com.ar' },
  { nombre: 'Maxxis & Kenda Neumáticos', cuit: '33-70891234-9', tel: '0341-4890123', email: 'pedidos@maxxiskenda.com' },
  { nombre: 'Venzo & Vairo Mayorista', cuit: '30-75432109-1', tel: '0351-4789012', email: 'mayorista@venzovairo.com' }
];

for (const p of provs) {
  const exists = db.prepare('SELECT count(*) as c FROM proveedores WHERE nombre = ?').get(p.nombre).c;
  if (exists === 0) {
    db.prepare(`INSERT INTO proveedores (id, nombre, cuit, telefono, email, activo, creado) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`)
      .run(newId(), p.nombre, p.cuit, p.tel, p.email);
  }
}

// 4. Clientes
const clientes = [
  { nom: 'Martín', ape: 'Gómez', tel: '11-4521-8899', dni: '34589120', email: 'mgomez@gmail.com', dir: 'Av. Rivadavia 4520, CABA' },
  { nom: 'Lucía', ape: 'Fernández', tel: '11-6321-7744', dni: '38901445', email: 'lucia.f@hotmail.com', dir: 'San Martín 1250, Quilmes' },
  { nom: 'Facundo', ape: 'Rodríguez', tel: '11-5544-3322', dni: '29870112', email: 'facu_rod@yahoo.com.ar', dir: 'Belgrano 840, Morón' },
  { nom: 'Sofía', ape: 'Alvarez', tel: '11-3322-1100', dni: '41230988', email: 'sofi.alvarez@gmail.com', dir: 'Mitre 450, San Isidro' },
  { nom: 'Gonzalo', ape: 'Pérez', tel: '11-7788-9900', dni: '36412550', email: 'gonza_perez@gmail.com', dir: 'Av. Cabildo 2200, Belgrano' },
  { nom: 'Camila', ape: 'López', tel: '11-2233-4455', dni: '39102304', email: 'cami_lopez@outlook.com', dir: 'Av. La Plata 890, Caballito' }
];

for (const cl of clientes) {
  const exists = db.prepare('SELECT count(*) as c FROM clientes WHERE dni = ?').get(cl.dni).c;
  if (exists === 0) {
    db.prepare(`INSERT INTO clientes (id, nombre, apellido, telefono, dni, email, direccion, activo, creado) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`)
      .run(newId(), cl.nom, cl.ape, cl.tel, cl.dni, cl.email, cl.dir);
  }
}

// 5. Productos
const prods = [
  { nom: 'Bicicleta MTB R29 Venzo Frida 21V', sku: 'BIC-VEN-29-01', precio: 380000, costo: 260000, stock: 5, min: 2, cat: 'Bicicletas MTB / Montaña' },
  { nom: 'Bicicleta MTB R29 Vairo XR 3.8 Disco Hidráulico', sku: 'BIC-VAI-29-02', precio: 520000, costo: 370000, stock: 3, min: 2, cat: 'Bicicletas MTB / Montaña' },
  { nom: 'Bicicleta Urbana Paseo Vintage R28 Canasto', sku: 'BIC-URB-28-01', precio: 290000, costo: 195000, stock: 4, min: 2, cat: 'Bicicletas Urbanas & Paseo' },
  { nom: 'Pata de Cambio Shimano Tourney TY300 7/8V', sku: 'SHI-TY300', precio: 24500, costo: 14000, stock: 14, min: 4, cat: 'Transmisión & Cambios' },
  { nom: 'Pata de Cambio Shimano Altus M310 8V', sku: 'SHI-M310', precio: 38900, costo: 23000, stock: 8, min: 3, cat: 'Transmisión & Cambios' },
  { nom: 'Pata de Cambio Shimano Deore M5100 11V', sku: 'SHI-M5100', precio: 89000, costo: 56000, stock: 1, min: 3, cat: 'Transmisión & Cambios' },
  { nom: 'Cadena KMC Z7 6/7/8 Velocidades', sku: 'CAD-KMC-Z7', precio: 16500, costo: 9200, stock: 18, min: 5, cat: 'Transmisión & Cambios' },
  { nom: 'Kit Frenos a Disco Hidráulicos Shimano MT200', sku: 'SHI-MT200', precio: 78000, costo: 49000, stock: 7, min: 2, cat: 'Frenos & Rotores' },
  { nom: 'Pastillas de Freno Shimano B01S / B05S Resina', sku: 'SHI-B05S', precio: 8500, costo: 4100, stock: 25, min: 6, cat: 'Frenos & Rotores' },
  { nom: 'Cubierta Maxxis Ikon 29x2.20 Kevlar TLR', sku: 'MAX-IKON-29', precio: 64000, costo: 39000, stock: 6, min: 4, cat: 'Cubiertas & Cámaras' },
  { nom: 'Cubierta Kenda Small Block Eight 29x2.10', sku: 'KEN-SB8-29', precio: 36500, costo: 21500, stock: 12, min: 4, cat: 'Cubiertas & Cámaras' },
  { nom: 'Cámara Kenda R29 Válvula Auto / Schrader', sku: 'CAM-KEN-29A', precio: 7200, costo: 3800, stock: 35, min: 10, cat: 'Cubiertas & Cámaras' },
  { nom: 'Casco MTB Cairbull con Visera y Ajuste Nuca', sku: 'ACC-CAS-CAIR', precio: 42000, costo: 24000, stock: 8, min: 3, cat: 'Accesorios & Seguridad' },
  { nom: 'Inflador de Mano Giyo Doble Válvula con Soporte', sku: 'ACC-INF-GIYO', precio: 15400, costo: 8500, stock: 15, min: 4, cat: 'Accesorios & Seguridad' },
  { nom: 'Luces Delantera y Trasera LED USB Recargables', sku: 'ACC-LUC-USB', precio: 12900, costo: 6800, stock: 20, min: 5, cat: 'Accesorios & Seguridad' },
  { nom: 'Lubricante para Cadena con PTFE Seco 120ml', sku: 'LUB-PTFE-120', precio: 9800, costo: 4900, stock: 22, min: 6, cat: 'Taller & Lubricantes' }
];

for (const pr of prods) {
  const catRow = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(pr.cat);
  const catId = catRow ? catRow.id : null;
  const exists = db.prepare('SELECT count(*) as c FROM productos WHERE sku = ?').get(pr.sku).c;
  if (exists === 0) {
    db.prepare(`INSERT INTO productos (id, categoria_id, nombre, sku, precio, costo, stock, stock_minimo, iva, activo, creado, actualizado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 21, 1, datetime('now'), datetime('now'))`)
      .run(newId(), catId, pr.nom, pr.sku, pr.precio, pr.costo, pr.stock, pr.min);
  }
}

// 6. Ventas históricas
const vCount = db.prepare('SELECT count(*) as c FROM ventas').get().c;
if (vCount < 10) {
  const allProds = db.prepare('SELECT * FROM productos WHERE activo = 1').all();
  const allClients = db.prepare('SELECT * FROM clientes WHERE activo = 1').all();
  const metodos = ['efectivo', 'transferencia', 'tarjeta', 'mercadopago'];

  for (let d = 12; d >= 0; d--) {
    const cantVentas = Math.floor(Math.random() * 2) + 1;
    for (let k = 0; k < cantVentas; k++) {
      const cli = allClients[Math.floor(Math.random() * allClients.length)];
      const prod = allProds[Math.floor(Math.random() * allProds.length)];
      const qty = Math.floor(Math.random() * 2) + 1;
      const subtotal = prod.precio * qty;
      const iva = Math.round(subtotal * 0.21);
      const total = subtotal + iva;
      const debe = (Math.random() > 0.6) ? Math.round(total * 0.4) : 0;
      const pagado = total - debe;
      const estado = debe > 0 ? 'parcial' : 'pagada';
      const metodo = metodos[Math.floor(Math.random() * metodos.length)];
      const vid = newId();
      const ticketNro = String(db.prepare('SELECT count(*) as c FROM ventas').get().c + 1).padStart(6, '0');
      const fecha = new Date(Date.now() - d * 86400000 - Math.random() * 36000000).toISOString().replace('T', ' ').substring(0, 19);

      db.prepare(`INSERT INTO ventas (id, ticket_nro, cliente_id, cliente_nombre, fecha, subtotal, iva_total, total, pagado, debe, estado, metodo_pago, anulada, creado)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(
        vid, ticketNro, cli ? cli.id : null, cli ? `${cli.nombre} ${cli.apellido}` : 'Consumidor Final',
        fecha, subtotal, iva, total, pagado, debe, estado, metodo, fecha
      );

      db.prepare(`INSERT INTO venta_items (venta_id, producto_id, nombre, sku, precio_unit, cantidad, subtotal, iva, total_item)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 21, ?)`).run(
        vid, prod.id, prod.nombre, prod.sku, prod.precio, qty, subtotal, total
      );

      if (pagado > 0) {
        db.prepare(`INSERT INTO pagos (id, venta_id, monto, metodo, fecha) VALUES (?, ?, ?, ?, ?)`).run(
          newId(), vid, pagado, metodo, fecha
        );
      }
    }
  }
}

console.log('[+] Datos de prueba cargados con éxito.');
console.log('    Productos: ' + db.prepare('SELECT count(*) as c FROM productos').get().c);
console.log('    Ventas:    ' + db.prepare('SELECT count(*) as c FROM ventas').get().c);
console.log('    Clientes:  ' + db.prepare('SELECT count(*) as c FROM clientes').get().c);
