const express = require('express');
const router = express.Router();
const db = require('../models/db');

function cleanPhone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  // Si no tiene código de país (ej Argentina), agregar 549 si empieza con código local
  if (digits.length === 10) return '549' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '549' + digits.slice(1);
  return digits;
}

// GET /api/whatsapp/ticket/:id - Enlace para ticket de venta
router.get('/ticket/:id', (req, res) => {
  try {
    const v = db.findVentaById(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'Venta no encontrada' });
    const cfg = db.getConfig();

    const phone = cleanPhone(v.clienteTelefono);
    let itemsText = (v.items || []).map(i => `• ${i.cantidad}x ${i.nombre} - $${i.totalItem.toLocaleString('es-AR')}`).join('\n');

    let msg = `Hola *${v.clienteNombre}*, gracias por tu compra en *${cfg.empresa}* 🚲\n\n`;
    msg += `📄 *Comprobante:* ${v.ticketNro}\n`;
    msg += `📅 *Fecha:* ${v.fecha}\n\n`;
    msg += `📦 *Detalle:*\n${itemsText}\n\n`;
    msg += `💰 *Total:* $${v.total.toLocaleString('es-AR')}\n`;
    msg += `💵 *Abonado:* $${v.pagado.toLocaleString('es-AR')}\n`;
    if (v.debe > 0.01) {
      msg += `⚠️ *Saldo Pendiente:* $${v.debe.toLocaleString('es-AR')}\n`;
      if (v.cuotas && v.cuotas.length) {
        msg += `🗓️ *Plan de Cuotas:* ${v.cuotas.length} cuotas\n`;
      }
    } else {
      msg += `✅ *Estado:* Totalmente Pagado\n`;
    }
    msg += `\n${cfg.ticketPie || '¡Muchas gracias por elegirnos!'}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    res.json({ ok: true, phone, message: msg, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/whatsapp/deuda/:clienteId - Enlace de recordatorio de deuda y cuenta corriente
router.get('/deuda/:clienteId', (req, res) => {
  try {
    const c = db.findClienteById(req.params.clienteId);
    if (!c) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    const cfg = db.getConfig();

    const deuda = db.getDeudaCliente(c.id);
    const phone = cleanPhone(c.telefono);

    let msg = `Hola *${c.nombre}*, te saludamos desde *${cfg.empresa}* 🚲\n\n`;
    msg += `Te enviamos el estado de tu cuenta corriente:\n`;
    msg += `💰 *Saldo total pendiente:* $${deuda.toLocaleString('es-AR')}\n\n`;

    // Cuotas pendientes si existen
    const cuotasPendientes = db.db.prepare(`
      SELECT c.*, v.ticket_nro
      FROM cuotas c
      JOIN ventas v ON c.venta_id = v.id
      WHERE v.cliente_id = ? AND v.anulada = 0 AND c.saldo > 0.01
      ORDER BY c.vencimiento ASC
    `).all(c.id);

    if (cuotasPendientes.length) {
      msg += `📌 *Próximos vencimientos:*\n`;
      for (const cu of cuotasPendientes) {
        msg += `• Cuota #${cu.numero} (${cu.ticket_nro}) - $${Number(cu.saldo).toLocaleString('es-AR')} (Vence: ${cu.vencimiento})\n`;
      }
      msg += `\n`;
    }

    msg += `Por cualquier consulta o para coordinar medios de pago, estamos a tu disposición. ¡Muchas gracias!`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    res.json({ ok: true, phone, deuda, message: msg, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
