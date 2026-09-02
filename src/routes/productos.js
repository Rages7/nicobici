const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const db = require('../models/db');

const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no soportado (sólo JPG, PNG, WebP)'));
    }
  }
});

function saveBase64Image(base64, id) {
  const m = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return 'too_big';
  const fname = id + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
  return '/uploads/' + fname;
}

// GET /api/productos?q=&categoria=&proveedorId=&page=&limit=
router.get('/', (req, res) => {
  try {
    let prods = db.getProductos();
    const { q, categoria, proveedorId, proveedor, barcode, sku, page = '1', limit = '100' } = req.query;

    if (categoria) prods = prods.filter(p => p.categoriaId === categoria || p.categoria_id === categoria);
    const provFilter = proveedorId || proveedor;
    if (provFilter) prods = prods.filter(p => p.proveedorId === provFilter || p.proveedor_id === provFilter);

    if (barcode) {
      prods = prods.filter(p => (p.codigoBarras || p.codigo_barras || '') === barcode.trim());
    }

    if (sku) {
      prods = prods.filter(p => (p.sku || '').toLowerCase() === sku.trim().toLowerCase());
    }

    if (q) {
      const qq = q.toLowerCase().trim();
      prods = prods.filter(p => (
        (p.nombre || '') + ' ' +
        (p.sku || '') + ' ' +
        (p.codigoBarras || p.codigo_barras || '') + ' ' +
        (p.descripcion || '')
      ).toLowerCase().includes(qq));
    }

    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, parseInt(limit));
    const start = (p - 1) * l;

    res.json({
      ok: true,
      data: prods.slice(start, start + l),
      total: prods.length,
      page: p,
      limit: l
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/productos/buscar/:codigo (SKU o Código de barras)
router.get('/buscar/:codigo', (req, res) => {
  try {
    const prod = db.findProductoBySkuOrBarcode(req.params.codigo);
    if (!prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
    res.json({ ok: true, data: prod });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/productos/:id - Ficha de producto con Kardex
router.get('/:id', (req, res) => {
  try {
    const prod = db.findProductoById(req.params.id);
    if (!prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
    const movs = db.getMovimientosByProducto(req.params.id).slice(0, 30);
    res.json({ ok: true, data: prod, kardex: movs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/productos - Alta de producto con soporte multipart y JSON
router.post('/', upload.single('imagenArchivo'), (req, res) => {
  try {
    const body = req.body;
    const {
      nombre, descripcion, categoriaId, proveedorId,
      sku, codigoBarras, codigo_barras, precio, costo, stock, stockMin, stock_minimo,
      iva, imagenBase64, imagenUrl, activo
    } = body;

    if (!nombre || !nombre.trim()) return res.status(400).json({ ok: false, error: 'Nombre es requerido' });
    if (!categoriaId || !db.findCategoriaById(categoriaId)) {
      return res.status(400).json({ ok: false, error: 'Categoría inválida o no seleccionada' });
    }

    const id = 'prod_' + db.genId();
    let imagen = imagenUrl || '';

    if (req.file) {
      imagen = '/uploads/' + req.file.filename;
    } else if (imagenBase64) {
      const r = saveBase64Image(imagenBase64, id);
      if (r === 'too_big') return res.status(413).json({ ok: false, error: 'Imagen muy grande (máx 5MB)' });
      if (r) imagen = r;
    }

    const nuevo = db.createProducto({
      id,
      nombre: nombre.trim(),
      descripcion: descripcion || '',
      categoriaId,
      proveedorId: proveedorId || null,
      sku: sku ? sku.trim() : ('SKU-' + id.slice(-6).toUpperCase()),
      codigoBarras: codigoBarras || codigo_barras || '',
      precio: Number(precio) || 0,
      costo: Number(costo) || 0,
      stock: Number(stock) || 0,
      stockMin: stockMin !== undefined ? Number(stockMin) : (stock_minimo !== undefined ? Number(stock_minimo) : 2),
      iva: iva !== undefined && iva !== '' ? Number(iva) : 21,
      imagen,
      activo: activo !== undefined ? (activo === true || activo === 'true' || activo === '1') : true
    });

    // Si tiene stock inicial > 0, registrar Kardex
    if (Number(stock) > 0) {
      db.createMovimiento({
        productoId: nuevo.id,
        productoNombre: nuevo.nombre,
        tipo: 'entrada',
        cantidad: Number(stock),
        stockAntes: 0,
        stockDespues: Number(stock),
        motivo: 'Stock Inicial de Alta',
        usuarioId: req.session ? req.session.userId : null
      });
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'CREAR_PRODUCTO',
      modulo: 'PRODUCTOS',
      entidad: 'productos',
      entidadId: nuevo.id,
      detalle: `Alta de ${nuevo.nombre} (Stock: ${nuevo.stock}, Precio: $${nuevo.precio})`
    });

    res.json({ ok: true, data: nuevo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/productos/:id - Modificación
router.put('/:id', upload.single('imagenArchivo'), (req, res) => {
  try {
    const prod = db.findProductoById(req.params.id);
    if (!prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });

    const body = req.body;
    const patch = {};

    if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
    if (body.descripcion !== undefined) patch.descripcion = body.descripcion;
    if (body.categoriaId !== undefined) patch.categoriaId = body.categoriaId;
    if (body.proveedorId !== undefined) patch.proveedorId = body.proveedorId;
    if (body.sku !== undefined) patch.sku = body.sku.trim();
    if (body.codigoBarras !== undefined || body.codigo_barras !== undefined) {
      patch.codigoBarras = (body.codigoBarras || body.codigo_barras || '').trim();
    }
    if (body.precio !== undefined) patch.precio = Number(body.precio);
    if (body.costo !== undefined) patch.costo = Number(body.costo);
    
    // Control y reposición de stock con Kardex
    const oldStock = Number(prod.stock || 0);
    if (body.agregarStock !== undefined && Number(body.agregarStock) > 0) {
      const added = Number(body.agregarStock);
      const newStock = oldStock + added;
      patch.stock = newStock;

      db.createMovimiento({
        productoId: prod.id,
        productoNombre: prod.nombre,
        tipo: 'entrada',
        cantidad: added,
        stockAntes: oldStock,
        stockDespues: newStock,
        motivo: body.motivoStock || 'Reposición de Stock en Edición',
        usuarioId: req.session ? req.session.userId : null
      });
    } else if (body.stock !== undefined && Number(body.stock) !== oldStock) {
      const newStock = Number(body.stock);
      patch.stock = newStock;
      const diff = newStock - oldStock;

      db.createMovimiento({
        productoId: prod.id,
        productoNombre: prod.nombre,
        tipo: diff > 0 ? 'entrada' : 'ajuste',
        cantidad: Math.abs(diff),
        stockAntes: oldStock,
        stockDespues: newStock,
        motivo: body.motivoStock || (diff > 0 ? 'Reposición manual' : 'Ajuste de inventario'),
        usuarioId: req.session ? req.session.userId : null
      });
    }

    if (body.stockMin !== undefined || body.stock_minimo !== undefined) {
      patch.stockMin = Number(body.stockMin !== undefined ? body.stockMin : body.stock_minimo);
    }
    if (body.iva !== undefined) patch.iva = Number(body.iva);
    if (body.activo !== undefined) {
      patch.activo = body.activo === true || body.activo === 'true' || body.activo === 1 || body.activo === '1';
    }

    if (req.file) {
      patch.imagen = '/uploads/' + req.file.filename;
    } else if (body.imagenBase64) {
      const r = saveBase64Image(body.imagenBase64, prod.id);
      if (r && r !== 'too_big') patch.imagen = r;
    } else if (body.imagenUrl) {
      patch.imagen = body.imagenUrl;
    }

    const upd = db.updateProducto(prod.id, patch);

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'MODIFICAR_PRODUCTO',
      modulo: 'PRODUCTOS',
      entidad: 'productos',
      entidadId: prod.id,
      detalle: `Modificación de ${upd.nombre}`
    });

    res.json({ ok: true, data: upd });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/productos/:id - Baja
router.delete('/:id', (req, res) => {
  try {
    const del = db.deleteProducto(req.params.id);
    if (!del) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: del.softDeleted ? 'DESACTIVAR_PRODUCTO' : 'ELIMINAR_PRODUCTO',
      modulo: 'PRODUCTOS',
      entidad: 'productos',
      entidadId: req.params.id,
      detalle: del.softDeleted ? 'Baja lógica por historial de ventas' : 'Eliminación física'
    });

    res.json({ ok: true, data: del });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
