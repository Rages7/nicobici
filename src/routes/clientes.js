const express=require('express');
const router=express.Router();
const db=require('../models/db');
function clienteNombre(c){ return `${c.nombre||''} ${c.apellido||''}`.trim(); }

router.get('/', (req,res)=>{
  const q=(req.query.q||'').toLowerCase().trim();
  let clientes=db.getClientes();
  if(q){
    clientes=clientes.filter(c=>{
      const nombre=clienteNombre(c).toLowerCase();
      const tel=(c.telefono||'').toLowerCase();
      const dni=(c.dni||'').toLowerCase();
      const dir=(c.direccion||'').toLowerCase();
      return nombre.includes(q) || tel.includes(q) || dni.includes(q) || dir.includes(q);
    });
  }
  const prodsVentas=db.getVentas();
  const result=clientes.map(c=>{
    const ventas=prodsVentas.filter(v=> v.clienteId===c.id || v.cliente_id===c.id || v.usuarioId===c.id);
    const deuda=ventas.filter(v=> (v.debe||0)>0.01).reduce((s,v)=> s+v.debe,0);
    const totalCompras=ventas.reduce((s,v)=> s+(v.total||0),0);
    return {
      id:c.id,
      nombre:c.nombre,
      apellido:c.apellido,
      dni:c.dni||'',
      telefono:c.telefono||'',
      direccion:c.direccion||'',
      email:c.email||'',
      notas:c.notas||'',
      creado:c.creado,
      nombreCompleto:clienteNombre(c),
      ventasCount:ventas.length,
      deuda,
      totalCompras
    };
  });
  result.sort((a,b)=> (b.deuda || 0) - (a.deuda || 0) || (a.nombre || '').localeCompare(b.nombre || ''));
  res.json({ok:true, data: result});
});

router.get('/:id', (req,res)=>{
  const c=db.findClienteById(req.params.id);
  if(!c) return res.status(404).json({ok:false, error:'Cliente no encontrado'});
  const ventas=db.getVentas().filter(v=> v.clienteId===c.id || v.cliente_id===c.id || v.usuarioId===c.id).sort((a,b)=> new Date(b.creado)-new Date(a.creado));
  const deuda=ventas.filter(v=> (v.debe||0)>0.01).reduce((s,v)=> s+v.debe,0);
  const pagos=db.getPagos().filter(p=> p.clienteId===c.id || p.usuarioId===c.id);
  res.json({ok:true, data:{
    id:c.id,
    nombre:c.nombre,
    apellido:c.apellido,
    dni:c.dni||'',
    telefono:c.telefono||'',
    direccion:c.direccion||'',
    email:c.email||'',
    notas:c.notas||'',
    creado:c.creado,
    nombreCompleto:clienteNombre(c),
    deuda,
    ventas,
    pagos
  }});
});

router.post('/', (req,res)=>{
  const {nombre, apellido, telefono, dni, direccion, domicilio, email, notas} = req.body;
  if(!nombre || !nombre.trim()) return res.status(400).json({ok:false, error:'Nombre requerido'});
  if(!apellido || !apellido.trim()) return res.status(400).json({ok:false, error:'Apellido requerido'});
  if(!telefono || !telefono.trim()) return res.status(400).json({ok:false, error:'Número de teléfono requerido'});
  const tel=telefono.trim();
  const digits=tel.replace(/\D/g,'');
  if(digits.length < 6) return res.status(400).json({ok:false, error:'Teléfono inválido'});
  const dir = (domicilio || direccion || '').trim();
  const cli={
    id:'cli_'+db.genId(),
    nombre:nombre.trim(),
    apellido:apellido.trim(),
    telefono:tel,
    dni:(dni||'').trim(),
    direccion:dir,
    email:(email||'').trim(),
    notas:(notas||'').trim(),
    creado:new Date().toISOString()
  };
  db.createCliente(cli);
  res.json({ok:true, data: cli});
});

router.put('/:id', (req,res)=>{
  const c=db.findClienteById(req.params.id);
  if(!c) return res.status(404).json({ok:false, error:'No encontrado'});
  const {nombre, apellido, telefono, dni, direccion, domicilio, email, notas}=req.body;
  const patch={};
  if(nombre!==undefined){ if(!nombre.trim()) return res.status(400).json({ok:false, error:'Nombre requerido'}); patch.nombre=nombre.trim(); }
  if(apellido!==undefined){ if(!apellido.trim()) return res.status(400).json({ok:false, error:'Apellido requerido'}); patch.apellido=apellido.trim(); }
  if(telefono!==undefined){ if(!telefono.trim()) return res.status(400).json({ok:false, error:'Teléfono requerido'}); const d=telefono.trim().replace(/\D/g,''); if(d.length<6) return res.status(400).json({ok:false, error:'Teléfono inválido'}); patch.telefono=telefono.trim(); }
  if(dni!==undefined){ patch.dni=dni.trim(); }
  if(direccion!==undefined || domicilio!==undefined){ patch.direccion=(domicilio || direccion || '').trim(); }
  if(email!==undefined){ patch.email=email.trim(); }
  if(notas!==undefined){ patch.notas=notas.trim(); }
  const upd=db.updateCliente(req.params.id, patch);
  res.json({ok:true, data: upd});
});

router.delete('/:id', (req,res)=>{
  const r=db.deleteCliente(req.params.id);
  if(r===null) return res.status(404).json({ok:false, error:'No encontrado'});
  if(r===false) return res.status(409).json({ok:false, error:'No se puede borrar: tiene ventas asociadas'});
  res.json({ok:true});
});

module.exports=router;