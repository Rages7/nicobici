const express = require('express');
const router = express.Router();
const db = require('../models/db');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'No autenticado' });
  next();
}

// GET /api/datos - listar registros (si está logueado ve los suyos, si no todos públicos)
router.get('/', (req, res) => {
  const registros = db.getRegistros();
  // ordenar por fecha descendente
  registros.sort((a,b) => new Date(b.creado) - new Date(a.creado));
  res.json({ ok: true, data: registros });
});

// POST /api/datos - crear registro (requiere login)
router.post('/', requireAuth, (req, res) => {
  const { titulo, descripcion, categoria, fecha } = req.body;
  if (!titulo) return res.status(400).json({ ok: false, error: 'Título es obligatorio' });

  const user = db.findUserById(req.session.userId);
  const registro = {
    id: genId(),
    userId: req.session.userId,
    userNombre: user ? user.nombre : 'Anónimo',
    titulo: titulo.trim(),
    descripcion: (descripcion || '').trim(),
    categoria: (categoria || 'general').trim(),
    fecha: fecha || new Date().toISOString().slice(0,10),
    creado: new Date().toISOString()
  };
  db.createRegistro(registro);
  res.json({ ok: true, data: registro });
});

// DELETE /api/datos/:id
router.delete('/:id', requireAuth, (req, res) => {
  const result = db.deleteRegistro(req.params.id, req.session.userId);
  if (result === null) return res.status(404).json({ ok: false, error: 'Registro no encontrado' });
  if (result === false) return res.status(403).json({ ok: false, error: 'No tienes permiso para borrar este registro' });
  res.json({ ok: true });
});

module.exports = router;
