const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbDao = require('./db');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function writeJson(filename, data) {
  try {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing JSON fallback:', filename, e.message);
  }
}

/**
 * Limpia por completo todas las tablas de la base de datos
 * y carga datos iniciales nuevos, limpios y representativos de Nicobici.
 */
function resetAndSeedDB() {
  console.log('\n🧹 Limpiando base de datos SQLite y sembrando nuevos datos para Nicobici...\n');

  const { db } = dbDao;

  // 1. Limpieza de tablas
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
    console.log('✓ Tablas anteriores vaciadas correctamente');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const now = new Date().toISOString();

  // 2. Configuración de la Empresa
  const cfg = {
    empresa: 'Nicobici',
    nombreComercial: 'Nicobici — Rodados, Repuestos & Muebles',
    cuit: '30-78451296-3',
    direccion: 'Av. 3 de Abril 1250, Corrientes, Argentina',
    telefono: '+54 9 3794-112233',
    email: 'contacto@nicobici.local',
    moneda: 'ARS',
    ivaDefault: 21,
    ticketPie: '¡Gracias por su compra en Nicobici! Garantía de servicio y calidad.'
  };
  dbDao.saveConfig(cfg);
  writeJson('config.json', cfg);
  console.log('✓ Configuración del negocio establecida');

  // 3. Usuarios Dueños (con Domicilio y Teléfono)
  const passwordHash = bcrypt.hashSync('admin', 10);
  const usuariosSeed = [
    {
      id: 'user_dueno1',
      nombre: 'Dueño 1 (Nicolás Gómez)',
      email: 'dueno1@nicobici.local',
      password_hash: passwordHash,
      rol: 'dueno',
      telefono: '3794-112233',
      direccion: 'Av. 3 de Abril 1250, Corrientes',
      activo: 1,
      creado: now
    },
    {
      id: 'user_dueno2',
      nombre: 'Dueño 2 (Martín Benítez)',
      email: 'dueno2@nicobici.local',
      password_hash: passwordHash,
      rol: 'dueno',
      telefono: '3794-445566',
      direccion: 'Calle Junín 840, Corrientes',
      activo: 1,
      creado: now
    }
  ];
  for (const u of usuariosSeed) {
    dbDao.createUser(u);
  }
  writeJson('users.json', dbDao.getUsers());
  console.log(`✓ Usuarios creados (${usuariosSeed.length}): dueno1@nicobici.local / dueno2@nicobici.local (Pass: Nicobici123!)`);

  // 4. Categorías
  const categoriasSeed = [
    { id: 'cat_bicis', nombre: 'Bicicletas', slug: 'bicicletas', codigo: 'BIC', descripcion: 'Bicicletas MTB, Ruta, Urbanas y Paseo' },
    { id: 'cat_repuestos', nombre: 'Repuestos', slug: 'repuestos', codigo: 'REP', descripcion: 'Cadenas, piñones, cubiertas, cámaras, frenos, transmisiones' },
    { id: 'cat_accesorios', nombre: 'Accesorios & Seguridad', slug: 'accesorios', codigo: 'ACC', descripcion: 'Cascos, luces, infladores, candados y caramañolas' },
    { id: 'cat_motos', nombre: 'Motos & Repuestos', slug: 'motos', codigo: 'MOT', descripcion: 'Repuestos, lubricantes y accesorios para motocicletas' },
    { id: 'cat_muebles', nombre: 'Muebles & Hogar', slug: 'muebles', codigo: 'MUE', descripcion: 'Muebles para el hogar, escritorios, mesas y roperos' }
  ];
  for (const c of categoriasSeed) {
    dbDao.createCategoria(c);
  }
  writeJson('categorias.json', dbDao.getCategorias());
  console.log(`✓ Categorías creadas (${categoriasSeed.length})`);

  // 5. Proveedores
  const proveedoresSeed = [
    {
      id: 'prov_shimano',
      nombre: 'Distribuidora Shimano & Ciclismo SRL',
      cuit: '30-71458921-8',
      telefono: '011-4890-1122',
      email: 'ventas@shimanociclismo.com.ar',
      direccion: 'Av. Warnes 1420, CABA',
      activo: 1,
      creado: now
    },
    {
      id: 'prov_venzo',
      nombre: 'Venzo & Rodados Mayorista SA',
      cuit: '30-72889412-4',
      telefono: '0351-478-9000',
      email: 'pedidos@venzomayorista.com.ar',
      direccion: 'Av. Colón 3200, Córdoba',
      activo: 1,
      creado: now
    },
    {
      id: 'prov_muebles',
      nombre: 'Muebles del Norte SA',
      cuit: '30-68994512-1',
      telefono: '0379-442-8899',
      email: 'ventas@mueblesdelnorte.com',
      direccion: 'Ruta 12 Km 1025, Corrientes',
      activo: 1,
      creado: now
    },
    {
      id: 'prov_motos',
      nombre: 'Moto Partes & Repuestos Litoral',
      cuit: '30-75124896-3',
      telefono: '0379-446-7788',
      email: 'contacto@motoparteslitoral.com',
      direccion: 'Av. Independencia 2850, Corrientes',
      activo: 1,
      creado: now
    }
  ];
  for (const p of proveedoresSeed) {
    dbDao.createProveedor(p);
  }
  writeJson('proveedores.json', dbDao.getProveedores());
  console.log(`✓ Proveedores creados (${proveedoresSeed.length})`);

  // 6. Clientes con Domicilio Completo
  const clientesSeed = [
    {
      id: 'cli_carlos_rodriguez',
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      dni: '32458912',
      telefono: '3794-551122',
      email: 'carlos.rodriguez@email.com',
      direccion: 'Av. San Martín 1540, B° Cambá Cuá, Corrientes',
      notas: 'Cliente habitual de repuestos y service MTB',
      creado: now
    },
    {
      id: 'cli_mariana_fernandez',
      nombre: 'Mariana',
      apellido: 'Fernández',
      dni: '36784120',
      telefono: '3794-663344',
      email: 'mariana.fernandez@email.com',
      direccion: 'Calle Pellegrini 820, B° Centro, Corrientes',
      notas: 'Compradora de bicicleta urbana y accesorios',
      creado: now
    },
    {
      id: 'cli_lucas_gomez',
      nombre: 'Lucas',
      apellido: 'Gómez',
      dni: '40125890',
      telefono: '3794-778899',
      email: 'lucas.gomez@email.com',
      direccion: 'Av. Maipú 2100, B° San Roque, Corrientes',
      notas: 'Ciclista aficionado ruta y accesorios',
      creado: now
    },
    {
      id: 'cli_valeria_romero',
      nombre: 'Valeria',
      apellido: 'Romero',
      dni: '34901234',
      telefono: '3794-882211',
      email: 'valeria.romero@email.com',
      direccion: 'Calle Yrigoyen 1430, B° Deportes, Corrientes',
      notas: 'Cuenta corriente y compras en cuotas',
      creado: now
    },
    {
      id: 'cli_esteban_toledo',
      nombre: 'Esteban',
      apellido: 'Toledo',
      dni: '38221789',
      telefono: '3794-994455',
      email: 'esteban.toledo@email.com',
      direccion: 'Calle 9 de Julio 1120, B° Libertad, Corrientes',
      notas: 'Cliente de rodados y muebles del hogar',
      creado: now
    },
    {
      id: 'cli_sofia_martinez',
      nombre: 'Sofía',
      apellido: 'Martínez',
      dni: '39874561',
      telefono: '3794-336677',
      email: 'sofia.martinez@email.com',
      direccion: 'Av. Libertad 4500, B° Victor Colas, Corrientes',
      notas: 'Compradora de indumentaria y seguridad',
      creado: now
    }
  ];
  for (const c of clientesSeed) {
    dbDao.createCliente(c);
  }
  writeJson('clientes.json', dbDao.getClientes());
  console.log(`✓ Clientes creados con domicilio (${clientesSeed.length})`);

  // 7. Productos nuevos y completos de Nicobici
  const productosSeed = [
    {
      id: 'prod_venzo29',
      categoriaId: 'cat_bicis',
      proveedorId: 'prov_venzo',
      nombre: 'Bicicleta MTB Venzo Frida R29 21V Shimano',
      descripcion: 'Cuadro de aluminio 6061 hidroformado, frenos a disco mecánico, cambios Shimano Tourney 21 velocidades, suspensión delantera con bloqueo.',
      sku: 'BIC-VENZO-29',
      barcode: '779123456701',
      precio: 450000,
      costo: 290000,
      stock: 6,
      stockMin: 2,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_topmega29',
      categoriaId: 'cat_bicis',
      proveedorId: 'prov_venzo',
      nombre: 'Bicicleta MTB TopMega Sunshine R29 Frenos Disco',
      descripcion: 'Rodado 29, 21 velocidades, horquilla con suspensión, llantas doble pared de aluminio y frenos a disco.',
      sku: 'BIC-TOPM-SUN29',
      barcode: '779123456702',
      precio: 380000,
      costo: 240000,
      stock: 5,
      stockMin: 2,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_paseo26',
      categoriaId: 'cat_bicis',
      proveedorId: 'prov_venzo',
      nombre: 'Bicicleta Paseo Urbana Vintage R26 con Canasto',
      descripcion: 'Asiento ancho con resortes confort, canasto delantero trenzado, guardabarros metálicos y cubrecadena.',
      sku: 'BIC-PAS-VINT26',
      barcode: '779123456703',
      precio: 260000,
      costo: 165000,
      stock: 4,
      stockMin: 2,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_cascomtb',
      categoriaId: 'cat_accesorios',
      proveedorId: 'prov_shimano',
      nombre: 'Casco Ciclismo MTB Ajustable con Luz LED Trasera',
      descripcion: 'Estructura In-Mold ultraliviana, 21 canales de ventilación, almohadillas desmontables lavables y luz LED de 3 modos.',
      sku: 'ACC-CASCO-LED',
      barcode: '779123456704',
      precio: 32000,
      costo: 16000,
      stock: 15,
      stockMin: 3,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_infladorpie',
      categoriaId: 'cat_accesorios',
      proveedorId: 'prov_shimano',
      nombre: 'Inflador de Pie Profesional con Manómetro Doble Válvula',
      descripcion: 'Cuerpo de acero de alta presión hasta 160 PSI, manómetro analógico de precisión, cabezal dual para válvula Presta y Schrader.',
      sku: 'ACC-INFL-PIE',
      barcode: '779123456705',
      precio: 24000,
      costo: 12000,
      stock: 12,
      stockMin: 3,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_setluces',
      categoriaId: 'cat_accesorios',
      proveedorId: 'prov_shimano',
      nombre: 'Set Luces LED Delantera y Trasera Recargables USB',
      descripcion: 'Faro delantero blanco de 400 lúmenes con batería de litio USB y luz trasera roja con destellador de seguridad.',
      sku: 'ACC-LUCES-USB',
      barcode: '779123456706',
      precio: 14500,
      costo: 7000,
      stock: 25,
      stockMin: 5,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_cubiertamaxxis',
      categoriaId: 'cat_repuestos',
      proveedorId: 'prov_shimano',
      nombre: 'Cubierta MTB Maxxis Ardent 29x2.25 Kevlar Tubeless',
      descripcion: 'Banda de rodadura agresiva de alto agarre lateral para senderos y tierra, carcasa EXO Protection con talón plegable Kevlar.',
      sku: 'REP-CUB-MAXX29',
      barcode: '779123456707',
      precio: 55000,
      costo: 34000,
      stock: 10,
      stockMin: 4,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_camara29',
      categoriaId: 'cat_repuestos',
      proveedorId: 'prov_shimano',
      nombre: 'Cámara de Bicicleta R29 Válvula Auto Schrader Reforzada',
      descripcion: 'Butilo de alta elasticidad resistente a pinchazos, compatible con medidas de cubierta 29x1.90 a 29x2.35.',
      sku: 'REP-CAM-R29',
      barcode: '779123456708',
      precio: 7500,
      costo: 3500,
      stock: 30,
      stockMin: 8,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_cadenashimano',
      categoriaId: 'cat_repuestos',
      proveedorId: 'prov_shimano',
      nombre: 'Cadena Shimano HG-53 9 Velocidades Original Japón',
      descripcion: 'Cadena Hyperglide de precisión para transmisiones de 9 velocidades MTB y ruta, 116 eslabones con pin de conexión incluido.',
      sku: 'REP-CAD-SHIM9V',
      barcode: '779123456709',
      precio: 22000,
      costo: 13500,
      stock: 8,
      stockMin: 2,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_pedalesaluminio',
      categoriaId: 'cat_repuestos',
      proveedorId: 'prov_shimano',
      nombre: 'Pedales MTB Plataforma Aluminio con Pines Antideslizantes',
      descripcion: 'Cuerpo de aleación de aluminio mecanizado CNC, eje de cromo-molibdeno 9/16 con rulemanes sellados y pines reemplazables.',
      sku: 'REP-PEDAL-ALUM',
      barcode: '779123456710',
      precio: 18000,
      costo: 9500,
      stock: 14,
      stockMin: 3,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_aceiteteflon',
      categoriaId: 'cat_repuestos',
      proveedorId: 'prov_shimano',
      nombre: 'Aceite Lubricante Cadena Teflón PTFE 120ml para Seco y Húmedo',
      descripcion: 'Fórmula sintética con micropartículas de teflón para máxima suavidad de cambio y repelencia de suciedad y agua.',
      sku: 'REP-LUB-TEFLON',
      barcode: '779123456711',
      precio: 8900,
      costo: 4200,
      stock: 20,
      stockMin: 5,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_candadoulock',
      categoriaId: 'cat_accesorios',
      proveedorId: 'prov_shimano',
      nombre: 'Candado U-Lock Acero Cementado 16mm con Soporte para Cuadro',
      descripcion: 'Grillete de acero endurecido anticorte con doble traba de seguridad, revestimiento de goma anti-rayas y 2 llaves computadas.',
      sku: 'ACC-CAND-ULOCK',
      barcode: '779123456712',
      precio: 28000,
      costo: 14500,
      stock: 10,
      stockMin: 3,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_placard4p',
      categoriaId: 'cat_muebles',
      proveedorId: 'prov_muebles',
      nombre: 'Placard Ropero 4 Puertas 2 Cajones Melamina Blanco',
      descripcion: 'Melamina 15mm de primera calidad, correderas metálicas, barral de colgado y estantes interiores organizadores.',
      sku: 'MUE-PLAC-4P',
      barcode: '779123456713',
      precio: 210000,
      costo: 135000,
      stock: 3,
      stockMin: 1,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_mesanordica',
      categoriaId: 'cat_muebles',
      proveedorId: 'prov_muebles',
      nombre: 'Mesa Comedor Nórdica 140x80cm Madera Paraíso Maciza',
      descripcion: 'Tapa enchapada laqueada satinada resistente y patas macizas de paraíso con regatones protectores para piso.',
      sku: 'MUE-MESA-NORD',
      barcode: '779123456714',
      precio: 145000,
      costo: 85000,
      stock: 4,
      stockMin: 1,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    },
    {
      id: 'prod_aceitemoto4t',
      categoriaId: 'cat_motos',
      proveedorId: 'prov_motos',
      nombre: 'Aceite para Motor 4 Tiempos 20W50 Mineral 1L para Moto',
      descripcion: 'Lubricante para motores 4T de motocicleta con aditivos antidesgaste para embrague húmedo (norma JASO MA2 / API SL).',
      sku: 'MOT-ACEITE-4T',
      barcode: '779123456715',
      precio: 12500,
      costo: 6800,
      stock: 18,
      stockMin: 4,
      iva: 0,
      imagen: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
      activo: 1,
      creado: now
    }
  ];

  for (const prod of productosSeed) {
    dbDao.createProducto(prod);
    // Registrar Kardex inicial de entrada para cuadre de inventario
    dbDao.createMovimiento({
      productoId: prod.id,
      productoNombre: prod.nombre,
      tipo: 'entrada',
      cantidad: prod.stock,
      stockAntes: 0,
      stockDespues: prod.stock,
      motivo: 'Carga inicial de catálogo Nicobici',
      referenciaId: 'inventario_inicial',
      usuarioId: 'user_dueno1'
    });
  }
  writeJson('productos.json', dbDao.getProductos());
  writeJson('inventario_movimientos.json', dbDao.getMovimientos());
  console.log(`✓ Productos creados con Kardex inicial (${productosSeed.length})`);

  // Limpiar JSONs de ventas, pagos, auditoría para sincronizarlos vacíos
  writeJson('ventas.json', []);
  writeJson('pagos.json', []);

  // 8. Registro de Auditoría inicial
  dbDao.registrarAuditoria({
    usuarioId: 'user_dueno1',
    usuarioNombre: 'Dueño 1 (Nicolás Gómez)',
    accion: 'RESETEO_CATALOGO',
    modulo: 'SISTEMA',
    entidad: 'sistema',
    entidadId: 'init',
    detalle: 'Carga inicial de usuarios, clientes con domicilio y catálogo de productos nuevos'
  });
  writeJson('auditoria.json', dbDao.getAuditoria());

  console.log('\n📊 Resumen de Base de Datos SQLite Nicobici Actualizada:');
  console.log(`  - Usuarios:     ${dbDao.getUsers().length}`);
  console.log(`  - Categorías:   ${dbDao.getCategorias().length}`);
  console.log(`  - Proveedores:  ${dbDao.getProveedores().length}`);
  console.log(`  - Clientes:     ${dbDao.getClientes().length}`);
  console.log(`  - Productos:    ${dbDao.getProductos().length}`);
  console.log(`  - Ventas:       ${dbDao.getVentas().length}`);
  console.log(`  - Mov. Kardex:  ${dbDao.getMovimientos().length}`);
  console.log('✨ Base de datos y catálogo limpios y cargados con éxito.\n');
}

function initDB() {
  // Detectar si esta instalación ya fue "inicializada limpia" (solo admin).
  // Si la DB tiene usuarios legacy (dueno1, dueno2, etc.) pero NO el admin limpio,
  // ejecutar limpieza única: borrar todo y dejar solo admin/admin.
  const users = dbDao.getUsers();
  const hasCleanAdmin = users.some(u => u.email && u.email.toLowerCase() === 'admin');

  if (!hasCleanAdmin) {
    console.log('\n🧹 Inicializando Nicobici limpio: eliminando todo y dejando solo admin/admin...\n');
    cleanToAdminOnly();
    return;
  }

  // Ya tiene admin: solo sembrar si está completamente vacío
  if (users.length === 0) {
    resetAndSeedDB();
  }
}

// Limpia TODAS las tablas y deja exclusivamente el usuario admin/admin
function cleanToAdminOnly() {
  const { db } = dbDao;
  const hash = bcrypt.hashSync('admin', 10);
  const now = new Date().toISOString();

  // 1. Vaciar todas las tablas
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
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  // 2. Crear único usuario: admin / admin
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

  dbDao.registrarAuditoria({
    usuarioId: 'user_admin',
    usuarioNombre: 'Admin',
    accion: 'INIT_ADMIN_ONLY',
    modulo: 'SISTEMA',
    entidad: 'sistema',
    entidadId: 'init',
    detalle: 'Arranque: base limpia + solo admin/admin'
  });

  console.log('✅ Base limpia. Login: admin / admin | Usuarios: 1 | Categorias/Clientes/Productos: 0');
}

if (require.main === module) {
  resetAndSeedDB();
}

module.exports = { initDB, resetAndSeedDB };
