const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/caja - Estado de la caja actual abierta
router.get('/', (req, res) => {
  try {
    const caja = db.getCajaAbierta();
    res.json({ ok: true, data: caja });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/caja/abrir - Abrir caja diaria
router.post('/abrir', (req, res) => {
  try {
    const { montoInicial = 0 } = req.body;
    const r = db.abrirCaja(montoInicial, req.session ? req.session.userId : null);
    if (!r.ok) return res.status(400).json(r);

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'ABRIR_CAJA',
      modulo: 'CAJA',
      entidad: 'cajas',
      entidadId: r.data.id,
      detalle: `Apertura de caja con fondo inicial $${montoInicial}`
    });

    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/caja/movimiento - Ingreso / Egreso manual
router.post('/movimiento', (req, res) => {
  try {
    const { tipo, monto, metodo = 'efectivo', motivo } = req.body;
    if (!tipo || !['ingreso', 'egreso', 'gasto', 'retiro'].includes(tipo)) {
      return res.status(400).json({ ok: false, error: 'Tipo inválido (ingreso, egreso, gasto, retiro)' });
    }
    const montoNum = Number(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ ok: false, error: 'Monto debe ser mayor a 0' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ ok: false, error: 'Motivo es requerido' });
    }

    const mov = db.registrarMovimientoCaja({
      tipo,
      monto: montoNum,
      metodo,
      motivo: motivo.trim()
    });

    if (!mov) return res.status(400).json({ ok: false, error: 'No hay ninguna caja abierta' });

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'MOVIMIENTO_CAJA',
      modulo: 'CAJA',
      entidad: 'movimientos_caja',
      entidadId: mov.id,
      detalle: `${tipo.toUpperCase()}: $${montoNum} (${motivo})`
    });

    res.json({ ok: true, data: mov });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/caja/cerrar - Cierre y arqueo ciego
router.post('/cerrar', (req, res) => {
  try {
    const { efectivoContado, observaciones = '' } = req.body;
    if (efectivoContado === undefined || isNaN(Number(efectivoContado)) || Number(efectivoContado) < 0) {
      return res.status(400).json({ ok: false, error: 'Efectivo contado es requerido' });
    }

    const r = db.cerrarCaja({
      efectivoContado: Number(efectivoContado),
      observaciones,
      usuarioId: req.session ? req.session.userId : null
    });

    if (!r.ok) return res.status(400).json(r);

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'CERRAR_CAJA',
      modulo: 'CAJA',
      entidad: 'cierres_caja',
      entidadId: r.data.id,
      detalle: `Cierre de caja: Esperado $${r.data.efectivoEsperado}, Contado $${r.data.efectivoContado}, Diferencia $${r.data.diferencia}`
    });

    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/caja/historial - Historial de cierres de caja
router.get('/historial', (req, res) => {
  try {
    const rows = db.getHistorialCajas();
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
