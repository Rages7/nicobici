const express=require('express');
const router=express.Router();
const db=require('../models/db');

router.get('/', (req,res)=>{
  const q=(req.query.q||'').toLowerCase();
  let provs=db.getProveedores();
  if(q) provs=provs.filter(p=> (p.nombre+' '+(p.cuit||'')+' '+(p.email||'')).toLowerCase().includes(q));
  // contar productos por proveedor
  const prods=db.getProductos();
  const counts=Object.fromEntries(provs.map(p=>[p.id, prods.filter(x=>x.proveedorId===p.id).length]));
  res.json({ok:true, data: provs.map(p=> ({...p, productos: counts[p.id]||0}))});
});
router.get('/:id', (req,res)=>{
  const p=db.findProveedorById(req.params.id);
  if(!p) return res.status(404).json({ok:false, error:'Proveedor no encontrado'});
  const prods=db.getProductos().filter(x=> x.proveedorId===p.id);
  res.json({ok:true, data:p, productos: prods});
});
router.post('/', (req,res)=>{
  const {nombre, cuit, telefono, email, direccion} = req.body;
  if(!nombre || !nombre.trim()) return res.status(400).json({ok:false, error:'Nombre requerido'});
  const cuitTrim=(cuit||'').trim();
  if(cuitTrim && db.findProveedorByCuit(cuitTrim)) return res.status(409).json({ok:false, error:'CUIT ya existe'});
  const prov={ id:'prov_'+db.genId(), nombre:nombre.trim(), cuit:cuitTrim, telefono:(telefono||'').trim(), email:(email||'').trim(), direccion:(direccion||'').trim(), creado:new Date().toISOString() };
  db.createProveedor(prov);
  res.json({ok:true, data:prov});
});
router.put('/:id', (req,res)=>{
  const p=db.findProveedorById(req.params.id);
  if(!p) return res.status(404).json({ok:false, error:'No encontrado'});
  const {nombre, cuit, telefono, email, direccion}=req.body;
  const patch={};
  if(nombre!==undefined) patch.nombre=nombre.trim();
  if(cuit!==undefined){
    const c=cuit.trim();
    if(c && c!==p.cuit && db.findProveedorByCuit(c)) return res.status(409).json({ok:false, error:'CUIT ya existe'});
    patch.cuit=c;
  }
  if(telefono!==undefined) patch.telefono=telefono.trim();
  if(email!==undefined) patch.email=email.trim();
  if(direccion!==undefined) patch.direccion=direccion.trim();
  const upd=db.updateProveedor(req.params.id, patch);
  res.json({ok:true, data:upd});
});
router.delete('/:id', (req,res)=>{
  const r=db.deleteProveedor(req.params.id);
  if(r===null) return res.status(404).json({ok:false, error:'No encontrado'});
  if(r===false) return res.status(409).json({ok:false, error:'No se puede borrar: tiene productos asociados. Reasigne productos primero.'});
  res.json({ok:true});
});
module.exports=router;
