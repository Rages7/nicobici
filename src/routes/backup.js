const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../models/db');

const DATA_DIR = path.join(__dirname, '../../data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let driveService = null;
try { driveService = require('../services/googleDrive'); } catch (_) {}

// GET /api/backup - Listar backups disponibles y snapshot JSON
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).map(f => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        nombre: f,
        tamano: stat.size,
        fecha: stat.mtime
      };
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json({
      ok: true,
      backups: files,
      snapshot: db.generarBackupSnapshot()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/backup/download/:nombre - Descargar archivo backup
router.get('/download/:nombre', (req, res) => {
  try {
    const file = path.join(BACKUPS_DIR, req.params.nombre);
    if (!fs.existsSync(file)) return res.status(404).send('Archivo no encontrado');
    res.download(file);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST /api/backup - Crear nuevo backup SQLite copia
router.post('/', async (req, res) => {
  try {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDbName = `nicobici-backup-${now}.db`;
    const targetDbPath = path.join(BACKUPS_DIR, backupDbName);

    const sourceDbPath = path.join(DATA_DIR, 'nicobici.db');
    if (fs.existsSync(sourceDbPath)) {
      fs.copyFileSync(sourceDbPath, targetDbPath);
    }

    const snapshotName = `nicobici-snapshot-${now}.json`;
    const snapshotPath = path.join(BACKUPS_DIR, snapshotName);
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify(db.generarBackupSnapshot(), null, 2),
      'utf8'
    );

    let driveUploaded = false;
    let driveError = null;
    if (driveService && driveService.isAuthenticated()) {
      try {
        const config = db.getConfigDrive();
        if (config.autoUpload) {
          const folderId = config.folderId || await driveService.findOrCreateFolder();
          if (fs.existsSync(targetDbPath)) {
            await driveService.uploadFile(targetDbPath, backupDbName, folderId);
          }
          await driveService.uploadFile(snapshotPath, snapshotName, folderId);
          driveUploaded = true;
        }
      } catch (e) {
        driveError = e.message;
      }
    }

    db.registrarAuditoria({
      usuarioId: req.session ? req.session.userId : 'sistema',
      usuarioNombre: req.session ? req.session.nombre : 'Sistema',
      accion: 'CREAR_BACKUP',
      modulo: 'SISTEMA',
      entidad: 'backup',
      entidadId: backupDbName,
      detalle: `Backup creado: ${backupDbName}${driveUploaded ? ' (subido a Drive)' : ''}`
    });

    res.json({
      ok: true,
      mensaje: 'Backup generado exitosamente',
      archivoDb: backupDbName,
      archivoJson: snapshotName,
      driveUploaded,
      driveError
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
