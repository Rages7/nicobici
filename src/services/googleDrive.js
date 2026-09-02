const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const TOKEN_PATH = path.join(DATA_DIR, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_NAME = 'Nicobici Backups';

// Buscar credentials.json en varias ubicaciones (local, Render Secret Files, env var)
function resolveCredentialsPath() {
  // 1. Variable de entorno si existe
  if (process.env.GOOGLE_CREDENTIALS_PATH && fs.existsSync(process.env.GOOGLE_CREDENTIALS_PATH)) {
    return process.env.GOOGLE_CREDENTIALS_PATH;
  }
  // 2. Raíz del proyecto (local)
  const projectRoot = path.join(__dirname, '../..');
  const candidates = [
    // Render Secret Files (montado en /etc/secrets/)
    '/etc/secrets/client_secret.json',
    '/etc/secrets/credentials.json',
    // Disco persistente de Render (está en /data/)
    path.join(DATA_DIR, 'client_secret.json'),
    path.join(DATA_DIR, 'credentials.json'),
    // Raíz del proyecto (local development)
    path.join(projectRoot, 'client_secret_109339278610-pbo4r4rd2hj95fmim65im49pfd425ea9.apps.googleusercontent.com.json'),
    path.join(projectRoot, 'credentials.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]; // fallback al path original (dará error claro si no existe)
}
const CREDENTIALS_PATH = resolveCredentialsPath();

let oauth2Client = null;
let driveClient = null;

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('No se encontro credentials.json en la raiz del proyecto');
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const creds = raw.installed || raw.web;
  return {
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    redirectUri: (creds.redirect_uris && creds.redirect_uris[0]) || 'http://localhost:3000/api/google-drive/callback'
  };
}

function getClient() {
  if (oauth2Client) return oauth2Client;
  const creds = loadCredentials();
  oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', (newTokens) => {
      const existing = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : {};
      fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...newTokens }, null, 2), 'utf8');
    });
  }
  return oauth2Client;
}

function getDrive() {
  if (driveClient) return driveClient;
  driveClient = google.drive({ version: 'v3', auth: getClient() });
  return driveClient;
}

function isAuthenticated() {
  const client = getClient();
  return !!(client.credentials && client.credentials.access_token);
}

function getAuthUrl() {
  const client = getClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

async function handleCallback(code) {
  const client = getClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  return tokens;
}

async function findOrCreateFolder(folderName) {
  const drive = getDrive();
  const name = folderName || FOLDER_NAME;
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  return folder.data.id;
}

async function uploadFile(filePath, fileName, folderId) {
  const drive = getDrive();
  const fileMetadata = { name: fileName };
  if (folderId) fileMetadata.parents = [folderId];
  const media = {
    mimeType: fileName.endsWith('.db') ? 'application/octet-stream' : 'application/json',
    body: fs.createReadStream(filePath)
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, size, createdTime'
  });
  return file.data;
}

async function listFiles(folderId) {
  const drive = getDrive();
  const q = folderId
    ? `'${folderId}' in parents and trashed=false`
    : `name contains 'nicobici' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: 'files(id, name, size, createdTime, mimeType)',
    orderBy: 'createdTime desc',
    pageSize: 50
  });
  return res.data.files || [];
}

async function deleteFile(fileId) {
  const drive = getDrive();
  await drive.files.delete({ fileId });
  return true;
}

async function downloadFile(fileId, destPath) {
  const drive = getDrive();
  const res = await drive.files.get({ fileId, alt: 'media' });
  fs.writeFileSync(destPath, res.data);
  return destPath;
}

async function getStorageInfo() {
  const drive = getDrive();
  const res = await drive.about.get({ fields: 'storageQuota' });
  return res.data.storageQuota;
}

module.exports = {
  isAuthenticated,
  getAuthUrl,
  handleCallback,
  findOrCreateFolder,
  uploadFile,
  listFiles,
  deleteFile,
  downloadFile,
  getStorageInfo
};
