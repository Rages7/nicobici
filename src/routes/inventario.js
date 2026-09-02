const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/resumen', (req,res)=>{
  const productos = db.getProductos();
  const totalProductos = productos.length;
  const unidadesTotales = productos.reduce((s,p)=> s+(Number(p.stock)||0),0);
  const valorTotal = productos.reduce((s,p)=> s+ (Number(p.stock)||0)*(Number(p.costo)||0),0);
  const valorVenta = productos.reduce((s,p)=> s+ (Number(p.stock)||0)*(Number(p.precio)||0),0);
  const stockBajo = productos.filter(p=> (Number(p.stock)||0) <= (Number(p.stockMin)||2));
  const sinStock = productos.filter(p=> (Number(p.stock)||0)===0);
  res.json({ok:true, data:{ totalProductos, unidadesTotales, valorTotal, valorVenta, gananciaPotencial: valorVenta-valorTotal, stockBajo, sinStock }});
});

router.get('/movimientos', (req,res)=>{
  let movs = db.getMovimientos();
  const {productoId, tipo, desde, hasta} = req.query;
  if(productoId) movs = movs.filter(m=> m.productoId===productoId);
  if(tipo) movs = movs.filter(m=> m.tipo===tipo);
  if(desde) movs = movs.filter(m=> m.fecha >= desde);
  if(hasta) movs = movs.filter(m=> m.fecha <= hasta);
  movs.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
  res.json({ok:true, data: movs.slice(0,200)});
});

router.post('/entrada', (req,res)=>{
  const {productoId, qty, costo, motivo} = req.body;
  if(!productoId) return res.status(400).json({ok:false, error:'productoId requerido'});
  const prod = db.findProductoById(productoId);
  if(!prod) return res.status(404).json({ok:false, error:'Producto no encontrado'});
  const q = Number(qty);
  if(!q || q<=0) return res.status(400).json({ok:false, error:'qty inválida'});
  if(costo!==undefined) db.updateProducto(productoId, {costo: Number(costo)});
  const r = db.ajustarStock(productoId, q, 'entrada', motivo||'entrada inventario', req.session?.userId||null);
  if(r===false) return res.status(400).json({ok:false, error:'Error stock'});
  res.json({ok:true, data: db.findProductoById(productoId)});
});

router.post('/ajuste', (req,res)=>{
  const {productoId, qtyDelta, motivo} = req.body;
  if(!productoId) return res.status(400).json({ok:false, error:'productoId requerido'});
  if(!motivo) return res.status(400).json({ok:false, error:'Motivo requerido'});
  const delta = Number(qtyDelta);
  if(!delta || isNaN(delta)) return res.status(400).json({ok:false, error:'qtyDelta inválido'});
  const r = db.ajustarStock(productoId, delta, 'ajuste', motivo, req.session?.userId||null);
  if(r===false) return res.status(400).json({ok:false, error:'Stock resultante negativo'});
  if(r===null) return res.status(404).json({ok:false, error:'Producto no encontrado'});
  res.json({ok:true, data: db.findProductoById(productoId)});
});

module.exports = router;
