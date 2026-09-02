# Plan: Integración Google Drive en Nicobici

## Resumen
Agregar respaldo automático a Google Drive al crear backups + configuración para sincronizar la carpeta `data/`.

---

## PASO 1 (TÚ lo haces - Requisito previo)

Crear credenciales OAuth2 en Google Cloud Console:

1. Ir a **https://console.cloud.google.com**
2. Crear proyecto (ej: "Nicobici Backup")
3. Ir a **APIs y servicios** → **Biblioteca** → buscar "Google Drive API" → **Habilitar**
4. Ir a **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth 2.0**
5. Tipo: **Aplicación de escritorio**
6. Autorizar redirect URI: `http://localhost:3000/api/google-drive/callback`
7. Descargar el archivo JSON renombrado como `credentials.json`
8. Colocarlo en: `C:\Users\rages\Documents\nicobici\credentials.json`

---

## PASO 2 (YO lo implemento)

| # | Archivo | Acción | Descripción |
|---|---------|--------|-------------|
| 1 | `package.json` | Modificar | Agregar dependencia `googleapis` |
| 2 | `src/services/googleDrive.js` | **Crear** | Servicio de autenticación y operaciones con Drive |
| 3 | `src/routes/googleDrive.js` | **Crear** | 7 endpoints API para gestión de Drive |
| 4 | `src/models/db.js` | Modificar | Agregar tabla `config_drive` + función `getConfigDrive()` |
| 5 | `src/routes/backup.js` | Modificar | Auto-upload a Drive al crear backup |
| 6 | `src/server.js` | Modificar | Registrar ruta `googleDrive` |
| 7 | `public/backup.html` | Modificar | UI: botón conectar, lista de backups en Drive, toggle auto-upload |
| 8 | `public/js/app.js` | Modificar | Funciones JS para llamar a las nuevas APIs |

---

## APIs que se crearán

```
GET  /api/google-drive/status      → Estado de conexión
POST /api/google-drive/auth        → URL de autorización OAuth2
GET  /api/google-drive/callback    → Callback OAuth2
POST /api/google-drive/upload      → Subir backup actual a Drive
GET  /api/google-drive/list        → Listar respaldos en Drive
DELETE /api/google-drive/delete/:id → Eliminar respaldo de Drive
POST /api/google-drive/restore/:id → Restaurar desde Drive
```

---

## Flujo automático

1. Cada vez que el usuario crea un backup (`POST /api/backup`), automáticamente se sube a Google Drive
2. Se crea carpeta "Nicobici Backups" en Drive (si no existe)
3. Los archivos se nombran: `nicobici-backup-YYYY-MM-DDTHH-MM-SS.db` y `.json`
4. Se puede restaurar directamente desde Drive
5. Opcional: eliminar respaldos antiguos según días de retención

---

## Archivos nuevos/modificados

```
nicobici/
├── src/
│   ├── services/
│   │   └── googleDrive.js        ← NUEVO
│   ├── routes/
│   │   ├── googleDrive.js        ← NUEVO
│   │   └── backup.js             ← MODIFICADO (auto-upload)
│   ├── models/
│   │   └── db.js                 ← MODIFICADO (tabla config_drive)
│   └── server.js                 ← MODIFICADO (registrar ruta)
├── public/
│   ├── backup.html               ← MODIFICADO (UI de Drive)
│   └── js/app.js                 ← MODIFICADO (funciones de Drive)
├── credentials.json              ← NUEVO (del usuario)
├── data/
│   └── token.json                ← NUEVO (tras autenticar)
└── package.json                  ← MODIFICADO (dependencia googleapis)
```
