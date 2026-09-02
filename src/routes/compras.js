const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/compras - Listado de facturas de compra
router.get('/', (req, res) => {
  try {
    const compras = db.getCompras();
    res.json({ ok: true, data: compras });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/compras/:id - Detalle de compra e ítems
router.get('/:id', (req, res) => {
  try {
    const c = db.findCompraById(req.params.id);
    if (!c) return res.status(404).json({ ok: false, error: 'Compra no encontrada' });
    res.json({ ok: true, data: c });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/compras - Registrar compra a proveedor
router.post('/', (req, res) => {
  try {
    const { proveedorId, numero, fecha, items, pagado = 0, notas = '' } = req.body;
    if (!proveedorId) return res.status(400).json({ ok: false, error: 'proveedorId requerido' });
    const prov = db.findProveedorById(proveedorId);
    if (!prov) return res.status(404).json({ ok: false, error: 'Proveedor no encontrado' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ ok: false, error: 'items requerido (mínimo 1 producto)' });

    let subtotal = 0;
    const itemsNorm = [];
    for (const it of items) {
      const prod = db.findProductoById(it.productoId);
      if (!prod) return res.status(404).json({ ok: false, error: `Producto ${it.productoId} no existe` });
      const qty = Math.max(1, Number(it.cantidad || it.qty) || 1);
      const costo = Number(it.costoUnit !== undefined ? it.costoUnit : prod.costo) || 0;
      const sub = qty * costo;
      subtotal += sub;
      itemsNorm.push({
        productoId: prod.id,
        cantidad: qty,
        costoUnit: costo,
        subtotal: sub,
        iva: Number(it.iva) || 0,
        total: sub
      });
    }

    const total = subtotal;
    const pagadoNum = Number(pagado) || 0;
    const debe = Math.max(0, total - pagadoNum);
    const estado = debe <= 0.01 ? 'pagada' : (pagadoNum > 0 ? 'parcial' : 'pendiente');

    const nueva = db.createCompra({
      proveedorId,
      numero: numero || ('COMP-' + Date.now().toString(36).toUpperCase()),
      fecha: fecha || new Date().toISOString().slice(0, 10),
      subtotal,
      ivaTotal: 0,
      total,
      pagado: pagadoNum,
      debe,
      estado,
      notas,
      items: itemsNorm
    }, req.session ? req.session.userId : null);

    // Registrar egreso en caja si se pagó en efectivo
    if (pagadoNum > 0) {
      db.registrarMovimientoCaja({
        tipo: 'egreso',
        monto: pagadoNum,
        metodo: 'efectivo',
        motivo: `Pago Compra a Proveedor ${prov.nombre} (${nueva.numero})`
      });
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'REGISTRAR_COMPRA',
      modulo: 'COMPRAS',
      entidad: 'compras',
      entidadId: nueva.id,
      detalle: `Compra ${nueva.numero} a ${prov.nombre} por $${total}`
    });

    res.json({ ok: true, data: nueva });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
