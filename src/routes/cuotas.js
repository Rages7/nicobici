const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/cuotas - Listado general de cuotas con datos de venta y cliente
router.get('/', (req, res) => {
  try {
    const rows = db.db.prepare(`
      SELECT c.*, v.ticket_nro, v.cliente_nombre, v.cliente_telefono, v.total as venta_total
      FROM cuotas c
      JOIN ventas v ON c.venta_id = v.id
      WHERE v.anulada = 0
      ORDER BY c.vencimiento ASC
    `).all();

    res.json({
      ok: true,
      data: rows.map(r => ({
        id: r.id,
        ventaId: r.venta_id,
        ticketNro: r.ticket_nro,
        clienteNombre: r.cliente_nombre,
        clienteTelefono: r.cliente_telefono,
        numero: r.numero,
        montoOriginal: Number(r.monto_original),
        montoPagado: Number(r.monto_pagado),
        saldo: Number(r.saldo),
        vencimiento: r.vencimiento,
        estado: r.estado,
        fechaPago: r.fecha_pago,
        metodoPago: r.metodo_pago
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/cuotas/vencidas - Cuotas con fecha superada y saldo pendiente
router.get('/vencidas', (req, res) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const rows = db.db.prepare(`
      SELECT c.*, v.ticket_nro, v.cliente_nombre, v.cliente_telefono
      FROM cuotas c
      JOIN ventas v ON c.venta_id = v.id
      WHERE v.anulada = 0 AND c.saldo > 0.01 AND c.vencimiento < ?
      ORDER BY c.vencimiento ASC
    `).all(hoy);

    res.json({
      ok: true,
      data: rows.map(r => ({
        id: r.id,
        ventaId: r.venta_id,
        ticketNro: r.ticket_nro,
        clienteNombre: r.cliente_nombre,
        clienteTelefono: r.cliente_telefono,
        numero: r.numero,
        montoOriginal: Number(r.monto_original),
        montoPagado: Number(r.monto_pagado),
        saldo: Number(r.saldo),
        vencimiento: r.vencimiento,
        estado: 'vencida'
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/cuotas/:id/pagar - Pagar una cuota específica
router.post('/:id/pagar', (req, res) => {
  try {
    const { monto, metodo = 'efectivo', referencia = '' } = req.body;
    const cuota = db.db.prepare('SELECT * FROM cuotas WHERE id = ?').get(req.params.id);
    if (!cuota) return res.status(404).json({ ok: false, error: 'Cuota no encontrada' });

    const venta = db.findVentaById(cuota.venta_id);
    if (!venta) return res.status(404).json({ ok: false, error: 'Venta asociada no encontrada' });

    const saldoCuota = Number(cuota.saldo);
    if (saldoCuota <= 0.01) return res.status(400).json({ ok: false, error: 'Esta cuota ya está completamente saldada' });

    const montoPagar = Math.max(0.01, Math.min(saldoCuota, Number(monto) || saldoCuota));
    const now = new Date().toISOString();

    // 1. Registrar Pago
    const pago = db.createPago({
      ventaId: venta.id,
      clienteId: venta.clienteId,
      monto: montoPagar,
      metodo,
      referencia: referencia || `Pago Cuota ${cuota.numero}`,
      fecha: now
    });

    // 2. Actualizar Cuota
    const nuevoPagadoCuota = Number(cuota.monto_pagado) + montoPagar;
    const nuevoSaldoCuota = Math.max(0, Number(cuota.monto_original) - nuevoPagadoCuota);
    const estadoCuota = nuevoSaldoCuota <= 0.01 ? 'pagada' : 'parcial';

    db.db.prepare(`
      UPDATE cuotas SET
        monto_pagado = ?,
        saldo = ?,
        estado = ?,
        fecha_pago = ?,
        metodo_pago = ?
      WHERE id = ?
    `).run(nuevoPagadoCuota, nuevoSaldoCuota, estadoCuota, now, metodo, cuota.id);

    // 3. Actualizar Venta Cabecera
    const nuevoPagadoVenta = Number(venta.pagado) + montoPagar;
    const nuevoDebeVenta = Math.max(0, Number(venta.total) - nuevoPagadoVenta);
    const estadoVenta = nuevoDebeVenta <= 0.01 ? 'pagada' : 'parcial';

    db.updateVenta(venta.id, {
      pagado: nuevoPagadoVenta,
      debe: nuevoDebeVenta,
      estado: estadoVenta
    });

    // 4. Registrar en Caja si es efectivo
    if (metodo === 'efectivo') {
      db.registrarMovimientoCaja({
        tipo: 'pago_deuda',
        monto: montoPagar,
        metodo: 'efectivo',
        motivo: `Cobro Cuota ${cuota.numero} - ${venta.clienteNombre} (${venta.ticketNro})`
      });
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'PAGO_CUOTA',
      modulo: 'CUOTAS',
      entidad: 'cuotas',
      entidadId: String(cuota.id),
      detalle: `Pago de $${montoPagar} en cuota ${cuota.numero} (${venta.ticketNro})`
    });

    res.json({
      ok: true,
      pago,
      cuota: {
        id: cuota.id,
        numero: cuota.numero,
        montoPagado: nuevoPagadoCuota,
        saldo: nuevoSaldoCuota,
        estado: estadoCuota
      },
      venta: db.findVentaById(venta.id)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
