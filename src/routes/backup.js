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

function getTimestamp() {
  // Hora exacta Argentina (UTC-3)
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false }).replace(' ', 'T').replace(/:/g, '-');
}

// POST /api/backup - Crear nuevo backup SQLite copia (solo 1 archivo, reemplaza anterior)
router.post('/', async (req, res) => {
  try {
    const now = getTimestamp();
    const backupDbName = `nicobici-db-${now}.db`;
    const targetDbPath = path.join(BACKUPS_DIR, backupDbName);

    // Limpiar backups anteriores locales (mantener solo 1)
    try {
      fs.readdirSync(BACKUPS_DIR).forEach(f => {
        if (f.startsWith('nicobici-db-') || f.startsWith('nicobici-backup-') || f.startsWith('nicobici-snapshot-')) {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch(_) {}
        }
      });
    } catch(_) {}

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
          // Borrar anteriores en Drive antes de subir (1 solo)
          try {
            const oldFiles = await driveService.listFiles(folderId);
            for (const f of oldFiles) {
              if (f.name.startsWith('nicobici-db-') || f.name.startsWith('nicobici-backup-') || f.name.startsWith('nicobici-snapshot-')) {
                try { await driveService.deleteFile(f.id); } catch(_) {}
              }
            }
          } catch(_) {}
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
