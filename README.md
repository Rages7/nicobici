# 🚲 Nicobici v2 — Sistema Completo (Diseño Claro Elegante)

**Carpeta:** `/storage/emulated/0/ialocal/nicobici`  
**Stack:** Node.js + Express + express-session + bcryptjs + JSON DB (5 archivos) + Chart.js CDN. Sin compilación nativa (compatible con FS sin symlinks, `npm install --no-bin-links`).

## Qué hace (tu pedido)

- **Categorías:** bicis, motos, muebles, accesorios, repuestos — CRUD, color/icono
- **Productos:** nombre, descripción, sku, precio, **costo** (para ganancia), stock, stockMin, **foto** (subida file → `/public/uploads/` + fallback URL)
- **Clientes = Usuarios registrados** (no tabla separada). Cada venta es un **ticket/cuenta** a un usuario
- **Ventas:** selector cliente + productos/qty + cálculo live total/pagado/debe/estado (pagada/parcial/pendiente). **Modificar/Eliminar** restituye/descuenta stock. Ticket imprimible en `/ticket.html?id=...`
- **Deuda:** `debe = total - pagado`. Ver en `/usuarios.html` (deuda por cliente, historial) y `/ventas.html` (badge debe). **Pagar** deuda parcial → `POST /api/ventas/:id/pagar`. Si cliente saldó y quiere otro producto → **nueva venta/cuenta** (no se reabre)
- **Inventario:** `stock` por producto + `inventario_movimientos.json` **Kardex** (venta/entrada/ajuste/devolucion) + KPIs valor total/unidades/stock bajo/ganancia potencial. Entrada y Ajuste desde `/inventario.html`
- **Analítica + Gráficos:** `/dashboard.html` con Chart.js: **ganancias del día (barras unidades), cantidad por producto (dona), ventas por categoría (dona), evolución 7 días (línea)**, KPIs ventas hoy/total/ganancia/debe, top productos 30d, top deudores
- **Diseño:** claro elegante (fondo #f8fafc, cards #fff, borde #e2e8f0, acento ámbar #f59e0b), sidebar 260px + bottom-nav móvil, tablas sticky, badges, modales, stock bars

## Estructura
```
data/
  users.json, categorias.json, productos.json, ventas.json, pagos.json, inventario_movimientos.json
public/
  index.html, dashboard.html, productos.html, categorias.html, ventas.html, usuarios.html, inventario.html, ticket.html, login.html, register.html
  css/style.css, js/app.js, uploads/
src/
  server.js (+3mb json limit, 7 routers)
  models/db.js, models/init.js
  routes/auth.js, datos.js, categorias.js, productos.js, ventas.js, usuarios.js, inventario.js, analitica.js
```

## Uso
```bash
cd /storage/emulated/0/ialocal/nicobici
npm install --no-bin-links   # ya instalado
node src/models/init.js      # seed categorías + 3 productos demo
npm start                    # http://localhost:3000
# Dashboard: /dashboard.html | Productos: /productos.html | Ventas: /ventas.html | Inventario: /inventario.html
```

## API clave
- `GET/POST/PUT/DELETE /api/categorias`
- `GET /api/productos?q=&categoria=&page=&limit` / `POST` (imagenBase64/imagenUrl) / `PUT /:id` / `DELETE /:id`
- `GET /api/ventas?q=&estado=&usuarioId=&desde=&hasta` / `POST` {usuarioId, items:[{productoId,qty}], pagado, metodo} / `PUT /:id` / `DELETE /:id` / `POST /:id/pagar` {monto}
- `GET /api/usuarios` / `GET /:id` (deuda + historial)
- `GET /api/inventario/resumen` / `GET /movimientos` / `POST /entrada` / `POST /ajuste`
- `GET /api/analitica?fecha=YYYY-MM-DD` (KPIs + porProducto/porCategoria/topDeudores/evolucion/stockBajo)
- `GET /api/auth/*` (registro/login/me/logout)

## Fotos
En `/productos.html` → input file (máx 2MB) → FileReader base64 → POST → backend guarda en `public/uploads/<id>.jpg` y guarda ruta en `productos.json`. Se ve en grid, venta y ticket.

## Inventario
Toda venta descuenta stock y crea movimiento tipo `venta`. Editar/eliminar restituye. Entrada/Ajuste manual desde `/inventario.html`. Valor inventario = Σ stock*costo.

## Qué más se puede agregar (v3)
- Export PDF ticket, múltiples fotos por producto, código barras, roles admin/vendedor, backup ZIP, notificaciones stock bajo, reserva/apartado.
