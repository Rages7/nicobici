#!/usr/bin/env bash
# Script para copiar credenciales Google OAuth al disco persistente de Render
# Ejecutar en Render Shell después del primer deploy
#
# En Render: Shell → /opt/render/project/src → bash scripts/setup-google-credentials.sh

set -e

DEST="/opt/render/project/src/data"
SRC_CANDIDATES=(
  "/opt/render/project/src/client_secret_109339278610-pbo4r4rd2hj95fmim65im49pfd425ea9.apps.googleusercontent.com.json"
  "/opt/render/project/src/credentials.json"
)

echo "🔑 Configurando credenciales Google OAuth para Nicobici..."
echo ""

for src in "${SRC_CANDIDATES[@]}"; do
  if [ -f "$src" ]; then
    cp "$src" "$DEST/client_secret.json"
    echo "✅ Credenciales copiadas a $DEST/client_secret.json"
    echo "   Origen: $src"
    exit 0
  fi
done

echo "❌ No se encontró el archivo de credenciales Google OAuth."
echo ""
echo "Pasos para solucionarlo:"
echo "1. Subí el archivo client_secret_...json como Secret File en Render:"
echo "   - Render Dashboard → tu servicio → Environment → Secret Files"
echo "   - Nombre: /opt/render/project/src/data/client_secret.json"
echo "   - Contenido: el JSON completo de credenciales"
echo ""
echo "2. O copialo manualmente desde tu máquina local:"
echo "   - Render Shell → pegar el contenido con cat > $DEST/client_secret.json"
echo ""
echo "3. Después reiniciá el servicio desde Render Dashboard"
exit 1
