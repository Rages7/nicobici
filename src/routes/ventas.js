const express = require('express');
const router = express.Router();
const db = require('../models/db');

function calcEstado(total, pagado) {
  const debe = total - pagado;
  if (debe <= 0.01) return 'pagada';
  if (pagado <= 0.01) return 'pendiente';
  return 'parcial';
}

// GET /api/ventas - Listado con filtros
router.get('/', (req, res) => {
  try {
    let ventas = db.getVentas();
    const { usuarioId, clienteId, estado, q, desde, hasta, anuladas } = req.query;
    const cid = clienteId || usuarioId;

    if (cid) ventas = ventas.filter(v => v.clienteId === cid || v.cliente_id === cid || v.usuarioId === cid);
    if (estado) ventas = ventas.filter(v => v.estado === estado);
    if (!anuladas || anuladas === '0' || anuladas === 'false') {
      ventas = ventas.filter(v => !v.anulada);
    }
    if (q) {
      const qq = q.toLowerCase().trim();
      ventas = ventas.filter(v => {
        const nombre = (v.clienteNombre || v.cliente_nombre || v.usuarioNombre || '').toLowerCase();
        const tel = (v.clienteTelefono || v.cliente_telefono || '').toLowerCase();
        const ticket = (v.ticketNro || v.ticket_nro || '').toLowerCase();
        const itemsStr = (v.items || []).map(i => (i.nombre || '') + ' ' + (i.sku || '')).join(' ').toLowerCase();
        return ticket.includes(qq) || nombre.includes(qq) || tel.includes(qq) || itemsStr.includes(qq);
      });
    }
    if (desde) ventas = ventas.filter(v => v.fecha >= desde);
    if (hasta) ventas = ventas.filter(v => v.fecha <= hasta);

    res.json({ ok: true, data: ventas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ventas/:id - Detalle de ticket
router.get('/:id', (req, res) => {
  try {
    const v = db.findVentaById(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'Venta no encontrada' });
    const pagos = db.getPagosByVenta(v.id);
    res.json({ ok: true, data: v, pagos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/ventas - Transacción completa POS
router.post('/', (req, res) => {
  try {
    let {
      clienteId, usuarioId, items, pagado = 0, metodo = 'efectivo',
      ivaPercent, cuotasTotal, primeraCuotaPagada, referencia
    } = req.body;

    const cid = clienteId || usuarioId;
    if (!cid) return res.status(400).json({ ok: false, error: 'clienteId requerido' });
    const cliente = db.findClienteById(cid);
    if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ ok: false, error: 'items requerido (mínimo 1 producto)' });

    const cfg = db.getConfig();
    let saleIva = null;
    if (ivaPercent !== undefined && ivaPercent !== '' && ivaPercent !== null) {
      saleIva = Number(ivaPercent);
      if (isNaN(saleIva) || saleIva < 0 || saleIva > 100) {
        return res.status(400).json({ ok: false, error: 'IVA % inválido' });
      }
    }

    // Validar disponibilidad de stock antes de iniciar
    const qtyByProd = {};
    for (const it of items) {
      const pid = it.productoId || it.producto_id;
      const qty = Math.max(1, Number(it.qty || it.cantidad) || 1);
      qtyByProd[pid] = (qtyByProd[pid] || 0) + qty;
    }

    for (const pid of Object.keys(qtyByProd)) {
      const prod = db.findProductoById(pid);
      if (!prod) return res.status(404).json({ ok: false, error: `Producto ${pid} no existe` });
      if (!prod.activo) return res.status(400).json({ ok: false, error: `Producto ${prod.nombre} está inactivo` });
      const need = qtyByProd[pid];
      if ((Number(prod.stock) || 0) < need) {
        return res.status(409).json({
          ok: false,
          error: `Stock insuficiente: ${prod.nombre} (Stock actual: ${prod.stock}, Solicitado: ${need})`
        });
      }
    }

    let subtotal = 0, ivaTotal = 0;
    const itemsNorm = [];
    for (const it of items) {
      const prod = db.findProductoById(it.productoId || it.producto_id);
      const qty = Math.max(1, Number(it.qty || it.cantidad) || 1);
      const ivaProd = saleIva !== null ? saleIva : (prod.iva !== undefined ? Number(prod.iva) : Number(cfg.ivaDefault));
      const sub = prod.precio * qty;
      const ivaFinal = Math.round(sub * (ivaProd / 100) * 100) / 100;
      subtotal += sub;
      ivaTotal += ivaFinal;
      itemsNorm.push({
        productoId: prod.id,
        nombre: prod.nombre,
        sku: prod.sku,
        categoriaId: prod.categoriaId,
        precioUnit: prod.precio,
        costoUnit: prod.costo || 0,
        iva: ivaProd,
        qty,
        subtotal: sub,
        ivaAmount: ivaFinal,
        totalItem: sub + ivaFinal
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    ivaTotal = Math.round(ivaTotal * 100) / 100;
    const total = Math.round((subtotal + ivaTotal) * 100) / 100;
    let pagadoNum = Math.max(0, Math.min(total, Number(pagado) || 0));

    let cuotas = null;
    let cuotasCount = Number(cuotasTotal) || 1;
    if (cuotasCount > 1) {
      cuotasCount = Math.max(2, Math.min(36, cuotasCount));
      cuotas = db.buildCuotas(total, cuotasCount, new Date());
      if (primeraCuotaPagada && cuotas && cuotas.length) {
        cuotas[0].pagado = true;
        cuotas[0].estado = 'pagada';
        cuotas[0].montoPagado = cuotas[0].monto;
        cuotas[0].saldo = 0;
        cuotas[0].fechaPago = new Date().toISOString();
        cuotas[0].metodo = metodo;
        pagadoNum = cuotas[0].monto;
      }
    }

    const debe = Math.round((total - pagadoNum) * 100) / 100;
    const estado = calcEstado(total, pagadoNum);
    const saleId = 'venta_' + db.genId();
    const ticketNro = 'T-' + saleId.slice(-8).toUpperCase();

    // Iniciar transacción de creación
    const venta = db.createVenta({
      id: saleId,
      ticketNro,
      clienteId: cliente.id,
      clienteNombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
      clienteTelefono: cliente.telefono,
      fecha: new Date().toISOString().slice(0, 10),
      items: itemsNorm,
      subtotal,
      ivaTotal,
      ivaPercent: saleIva !== null ? saleIva : Number(cfg.ivaDefault),
      total,
      pagado: pagadoNum,
      debe,
      estado,
      cuotasTotal: cuotasCount,
      cuotas,
      vendedorId: req.session ? req.session.userId : null
    });

    // Descontar stock y registrar Kardex
    for (const it of itemsNorm) {
      db.ajustarStock(
        it.productoId,
        -it.qty,
        'venta',
        `Venta ${ticketNro}`,
        req.session ? req.session.userId : null,
        venta.id
      );
    }

    // Registrar Pago inicial si hubo
    if (pagadoNum > 0) {
      db.createPago({
        ventaId: venta.id,
        clienteId: cliente.id,
        monto: pagadoNum,
        metodo,
        referencia: referencia || `Pago Inicial ${ticketNro}`
      });

      if (metodo === 'efectivo') {
        db.registrarMovimientoCaja({
          tipo: 'venta',
          monto: pagadoNum,
          metodo: 'efectivo',
          motivo: `Cobro Venta ${ticketNro} - ${cliente.nombre}`
        });
      }
    }

    // Sincronizar cuotas si aplican
    if (venta.cuotas && venta.cuotas.length) {
      db.syncCuotasPagos(venta);
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? (req.session.userNombre || req.session.nombre) : 'Sistema',
      accion: 'NUEVA_VENTA',
      modulo: 'VENTAS',
      entidad: 'ventas',
      entidadId: venta.id,
      detalle: `Venta ${ticketNro} a ${cliente.nombre} por $${total} (Pagado: $${pagadoNum}, Debe: $${debe})`
    });

    res.json({ ok: true, data: db.findVentaById(venta.id) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/ventas/:id - Actualizar venta existente
router.put('/:id', (req, res) => {
  try {
    const v = db.findVentaById(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'Venta no encontrada' });
    if (v.anulada) return res.status(400).json({ ok: false, error: 'No se puede editar una venta anulada' });

    let { clienteId, usuarioId, pagado, metodo } = req.body;
    const cid = clienteId || usuarioId || v.clienteId;
    const cliente = db.findClienteById(cid);

    const patch = {};
    if (cliente) {
      patch.clienteId = cliente.id;
      patch.clienteNombre = `${cliente.nombre} ${cliente.apellido}`.trim();
      patch.clienteTelefono = cliente.telefono;
    }

    if (pagado !== undefined) {
      const pagadoNum = Math.max(0, Math.min(Number(v.total), Number(pagado) || 0));
      patch.pagado = pagadoNum;
      patch.debe = Math.max(0, Math.round((Number(v.total) - pagadoNum) * 100) / 100);
      patch.estado = calcEstado(v.total, pagadoNum);
    }

    const upd = db.updateVenta(v.id, patch);
    if (upd && upd.cuotas && upd.cuotas.length) {
      db.syncCuotasPagos(upd);
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? (req.session.userNombre || req.session.nombre) : 'Sistema',
      accion: 'EDITAR_VENTA',
      modulo: 'VENTAS',
      entidad: 'ventas',
      entidadId: v.id,
      detalle: `Edición de venta ${v.ticketNro}`
    });

    res.json({ ok: true, data: db.findVentaById(v.id) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/ventas/:id/pagar - Abonar o cancelar deuda
router.post('/:id/pagar', (req, res) => {
  try {
    const { monto, metodo = 'efectivo', referencia = '' } = req.body;
    const v = db.findVentaById(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'Venta no encontrada' });
    if (v.anulada) return res.status(400).json({ ok: false, error: 'No se puede pagar una venta anulada' });

    const saldoPendiente = Number(v.debe) || 0;
    if (saldoPendiente <= 0.01) {
      return res.status(400).json({ ok: false, error: 'La venta ya está totalmente saldada' });
    }

    const montoNum = Math.max(0.01, Math.min(saldoPendiente, Number(monto) || saldoPendiente));
    const now = new Date().toISOString();

    const pago = db.createPago({
      ventaId: v.id,
      clienteId: v.clienteId,
      monto: montoNum,
      metodo,
      referencia: referencia || `Abono a Ticket ${v.ticketNro}`,
      fecha: now
    });

    const nuevoPagado = Math.round((Number(v.pagado) + montoNum) * 100) / 100;
    const nuevoDebe = Math.max(0, Math.round((Number(v.total) - nuevoPagado) * 100) / 100);
    const nuevoEstado = calcEstado(v.total, nuevoPagado);

    const upd = db.updateVenta(v.id, {
      pagado: nuevoPagado,
      debe: nuevoDebe,
      estado: nuevoEstado
    });

    if (upd.cuotas && upd.cuotas.length) {
      db.syncCuotasPagos(upd);
    }

    if (metodo === 'efectivo') {
      db.registrarMovimientoCaja({
        tipo: 'pago_deuda',
        monto: montoNum,
        metodo: 'efectivo',
        motivo: `Cobro Deuda ${v.ticketNro} - ${v.clienteNombre}`
      });
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? (req.session.userNombre || req.session.nombre) : 'Sistema',
      accion: 'COBRO_VENTA',
      modulo: 'VENTAS',
      entidad: 'ventas',
      entidadId: v.id,
      detalle: `Cobro de $${montoNum} en ${v.ticketNro}`
    });

    res.json({ ok: true, data: db.findVentaById(v.id), pago });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/ventas/:id - Anulación de venta y devolución de stock
router.delete('/:id', (req, res) => {
  try {
    const v = db.findVentaById(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'Venta no encontrada' });
    if (v.anulada) return res.status(400).json({ ok: false, error: 'La venta ya fue anulada previamente' });

    const motivo = req.body && req.body.motivo ? req.body.motivo : 'Anulación solicitada por operador';
    const now = new Date().toISOString();

    // 1. Marcar venta como anulada
    db.updateVenta(v.id, {
      anulada: true,
      fechaAnulacion: now,
      motivoAnulacion: motivo,
      estado: 'anulada'
    });

    // 2. Restituir stock y generar Kardex 'devolucion'
    for (const it of (v.items || [])) {
      db.ajustarStock(
        it.productoId,
        it.qty,
        'devolucion',
        `Anulación Venta ${v.ticketNro}: ${motivo}`,
        req.session ? req.session.userId : null,
        v.id
      );
    }

    // 3. Registrar egreso de caja si se había pagado en efectivo
    if (Number(v.pagado) > 0) {
      db.registrarMovimientoCaja({
        tipo: 'egreso',
        monto: Number(v.pagado),
        metodo: 'efectivo',
        motivo: `Devolución por Anulación ${v.ticketNro}`
      });
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? (req.session.userNombre || req.session.nombre) : 'Sistema',
      accion: 'ANULAR_VENTA',
      modulo: 'VENTAS',
      entidad: 'ventas',
      entidadId: v.id,
      detalle: `Anulación de venta ${v.ticketNro}: ${motivo}. Stock restituido.`
    });

    res.json({ ok: true, mensaje: 'Venta anulada correctamente y stock restituido al Kardex', data: db.findVentaById(v.id) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
