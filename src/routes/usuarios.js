const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/', (req,res)=>{
  const users = db.getUsers().map(u=>{
    const ventas = db.getVentas().filter(v=> v.usuarioId===u.id || v.clienteId===u.id);
    const deuda = ventas.filter(v=> v.debe>0).reduce((s,v)=> s+v.debe,0);
    const totalCompras = ventas.reduce((s,v)=> s+v.total,0);
    return { id:u.id, nombre:u.nombre, email:u.email, telefono:u.telefono||'', direccion:u.direccion||'', creado:u.creado, ventasCount: ventas.length, deuda, totalCompras };
  });
  // filtro q
  let data = users;
  if(req.query.q){
    const q=req.query.q.toLowerCase();
    data = data.filter(u=> (u.nombre+' '+u.email+' '+(u.direccion||'')+' '+(u.telefono||'')).toLowerCase().includes(q));
  }
  data.sort((a,b)=> b.deuda - a.deuda);
  res.json({ok:true, data});
});

router.get('/:id', (req,res)=>{
  const user = db.findUserById(req.params.id);
  if(!user) return res.status(404).json({ok:false, error:'Usuario no encontrado'});
  const ventas = db.getVentas().filter(v=> v.usuarioId===user.id || v.clienteId===user.id).sort((a,b)=> new Date(b.creado)-new Date(a.creado));
  const deuda = ventas.filter(v=> v.debe>0).reduce((s,v)=> s+v.debe,0);
  const pagos = db.getPagos().filter(p=> p.usuarioId===user.id || p.clienteId===user.id);
  res.json({ok:true, data:{ id:user.id, nombre:user.nombre, email:user.email, telefono:user.telefono||'', direccion:user.direccion||'', creado:user.creado, deuda, ventas, pagos }});
});

module.exports = router;
