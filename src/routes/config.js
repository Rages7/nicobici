const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/config — Configuración actual
router.get('/', (req, res) => {
  try {
    res.json({ ok: true, data: db.getConfig() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/config — Modificar configuración (Solo Dueño)
router.put('/', (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const user = db.findUserById(req.session.userId);
    if (user && user.rol !== 'dueno' && user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo el dueño puede modificar la configuración del local.' });
    }

    const {
      ivaDefault, empresa, nombreComercial, cuit,
      direccion, telefono, email, moneda, ticketPie, logo
    } = req.body;

    const patch = {};
    if (ivaDefault !== undefined) patch.ivaDefault = Number(ivaDefault);
    if (empresa !== undefined) patch.empresa = String(empresa).trim();
    if (nombreComercial !== undefined) patch.nombreComercial = String(nombreComercial).trim();
    if (cuit !== undefined) patch.cuit = String(cuit).trim();
    if (direccion !== undefined) patch.direccion = String(direccion).trim();
    if (telefono !== undefined) patch.telefono = String(telefono).trim();
    if (email !== undefined) patch.email = String(email).trim();
    if (moneda !== undefined) patch.moneda = String(moneda).trim();
    if (ticketPie !== undefined) patch.ticketPie = String(ticketPie).trim();
    if (logo !== undefined) patch.logo = String(logo).trim();

    const cfg = db.saveConfig(patch);

    db.registrarAuditoria({
      usuarioId: req.session.userId,
      usuarioNombre: req.session.userNombre,
      accion: 'CONFIG_ACTUALIZADA',
      modulo: 'CONFIG',
      entidad: 'config',
      entidadId: '1',
      detalle: `Ajustes actualizados para ${cfg.empresa}`,
      ip
    });

    res.json({ ok: true, data: cfg });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/config/backup — Descarga de respaldo completo del sistema
router.get('/backup', (req, res) => {
  try {
    const user = db.findUserById(req.session.userId);
    if (user && user.rol !== 'dueno' && user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo el dueño puede descargar copias de seguridad.' });
    }

    const backupData = db.generarBackupSnapshot();
    const fechaStr = new Date().toISOString().slice(0, 10);
    const filename = `nicobici-backup-${fechaStr}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/config/auditoria — Registro histórico de auditoría y seguridad
router.get('/auditoria', (req, res) => {
  try {
    const user = db.findUserById(req.session.userId);
    if (user && user.rol !== 'dueno' && user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado: solo para administradores.' });
    }

    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const auditoria = db.getAuditoria(limit);
    res.json({ ok: true, data: auditoria });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
