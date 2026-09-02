const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/auditoria - Listado de logs de auditoría
router.get('/', (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || '100'));
    const logs = db.getAuditoria(limit);
    res.json({ ok: true, data: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
