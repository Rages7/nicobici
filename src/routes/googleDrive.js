const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const driveService = require('../services/googleDrive');
const db = require('../models/db');

const DATA_DIR = path.join(__dirname, '../../data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// GET /api/google-drive/status - Estado de conexion
router.get('/status', async (req, res) => {
  try {
    const connected = driveService.isAuthenticated();
    const config = db.getConfigDrive();
    let storageInfo = null;
    if (connected) {
      try { storageInfo = await driveService.getStorageInfo(); } catch (_) {}
    }
    res.json({
      ok: true,
      connected,
      folderId: config.folderId,
      folderName: config.folderName,
      autoUpload: config.autoUpload,
      retentionDays: config.retentionDays,
      storageInfo
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/google-drive/auth - URL de autorizacion
router.post('/auth', (req, res) => {
  try {
    const url = driveService.getAuthUrl();
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/google-drive/callback - Callback OAuth2
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Codigo no proporcionado');
    await driveService.handleCallback(code);
    const folderId = await driveService.findOrCreateFolder();
    db.saveConfigDrive({ connected: 1, folderId });
    res.redirect('/index.html?drive=connected');
  } catch (err) {
    res.redirect('/index.html?drive=error&msg=' + encodeURIComponent(err.message));
  }
});

// POST /api/google-drive/disconnect - Desconectar Drive
router.post('/disconnect', (req, res) => {
  try {
    const tokenPath = path.join(DATA_DIR, 'token.json');
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    db.saveConfigDrive({ connected: 0, folderId: '' });
    res.json({ ok: true, mensaje: 'Google Drive desconectado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function getTimestamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false }).replace(' ', 'T').replace(/:/g, '-');
}

// POST /api/google-drive/upload - Subir backup actual a Drive (solo 1 archivo con hora exacta ARG)
router.post('/upload', async (req, res) => {
  try {
    if (!driveService.isAuthenticated()) {
      return res.status(400).json({ ok: false, error: 'Google Drive no conectado' });
    }
    const config = db.getConfigDrive();
    const folderId = config.folderId || await driveService.findOrCreateFolder();
    const sourceDbPath = path.join(DATA_DIR, 'nicobici.db');
    const results = [];

    if (fs.existsSync(sourceDbPath)) {
      // Borrar backups anteriores en Drive (mantener solo 1)
      try {
        const oldFiles = await driveService.listFiles(folderId);
        for (const f of oldFiles) {
          if (f.name.startsWith('nicobici-db-') || f.name.startsWith('nicobici-backup-') || f.name.startsWith('nicobici-snapshot-')) {
            try { await driveService.deleteFile(f.id); } catch(_) {}
          }
        }
      } catch(_) {}

      const now = getTimestamp();
      const dbFile = await driveService.uploadFile(sourceDbPath, `nicobici-db-${now}.db`, folderId);
      results.push(dbFile);

      const snapshot = db.generarBackupSnapshot();
      const snapshotPath = path.join(DATA_DIR, `nicobici-snapshot-${now}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
      const jsonFile = await driveService.uploadFile(snapshotPath, `nicobici-snapshot-${now}.json`, folderId);
      results.push(jsonFile);
      fs.unlinkSync(snapshotPath);
    }

    db.registrarAuditoria({
      usuarioId: req.session.userId,
      usuarioNombre: req.session.nombre,
      accion: 'SUBIR_DRIVE',
      modulo: 'SISTEMA',
      entidad: 'google_drive',
      entidadId: folderId,
      detalle: `Subidos ${results.length} archivos a Google Drive`
    });

    res.json({ ok: true, archivos: results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/google-drive/upload-backup - Subir un archivo backup especifico
router.post('/upload-backup', async (req, res) => {
  try {
    if (!driveService.isAuthenticated()) {
      return res.status(400).json({ ok: false, error: 'Google Drive no conectado' });
    }
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ ok: false, error: 'fileName requerido' });
    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    const config = db.getConfigDrive();
    const folderId = config.folderId || await driveService.findOrCreateFolder();
    const file = await driveService.uploadFile(filePath, fileName, folderId);
    res.json({ ok: true, archivo: file });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/google-drive/list - Listar respaldos en Drive
router.get('/list', async (req, res) => {
  try {
    if (!driveService.isAuthenticated()) {
      return res.status(400).json({ ok: false, error: 'Google Drive no conectado' });
    }
    const config = db.getConfigDrive();
    const files = await driveService.listFiles(config.folderId);
    res.json({ ok: true, archivos: files });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/google-drive/delete/:id - Eliminar respaldo de Drive
router.delete('/delete/:id', async (req, res) => {
  try {
    if (!driveService.isAuthenticated()) {
      return res.status(400).json({ ok: false, error: 'Google Drive no conectado' });
    }
    await driveService.deleteFile(req.params.id);
    res.json({ ok: true, mensaje: 'Archivo eliminado de Google Drive' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/google-drive/restore/:id - Restaurar desde Drive
router.post('/restore/:id', async (req, res) => {
  try {
    if (!driveService.isAuthenticated()) {
      return res.status(400).json({ ok: false, error: 'Google Drive no conectado' });
    }
    const config = db.getConfigDrive();
    const files = await driveService.listFiles(config.folderId);
    const file = files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en Drive' });

    const destPath = path.join(BACKUPS_DIR, file.name);
    await driveService.downloadFile(req.params.id, destPath);

    if (file.name.endsWith('.db')) {
      const currentDb = path.join(DATA_DIR, 'nicobici.db');
      const backupPath = path.join(DATA_DIR, 'nicobici-pre-restore.db');
      fs.copyFileSync(currentDb, backupPath);
      fs.copyFileSync(destPath, currentDb);
    }

    res.json({ ok: true, mensaje: 'Backup restaurado desde Google Drive', archivo: file.name });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/google-drive/config - Actualizar configuracion de Drive
router.put('/config', (req, res) => {
  try {
    const { autoUpload, retentionDays, folderName } = req.body;
    const patch = {};
    if (autoUpload !== undefined) patch.autoUpload = autoUpload ? 1 : 0;
    if (retentionDays !== undefined) patch.retentionDays = Number(retentionDays);
    if (folderName !== undefined) patch.folderName = folderName;
    db.saveConfigDrive(patch);
    res.json({ ok: true, config: db.getConfigDrive() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
