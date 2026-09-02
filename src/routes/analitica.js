const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/', (req,res)=>{
  const hoy = new Date().toISOString().slice(0,10);
  const fecha = req.query.fecha || hoy;
  const ventas = db.getVentas();
  const productos = db.getProductos();
  const categorias = db.getCategorias();

  const ventasHoy = ventas.filter(v=> v.fecha===fecha);
  const subtotalHoy = ventasHoy.reduce((s,v)=> s+(v.subtotal||0),0);
  const ivaHoy = ventasHoy.reduce((s,v)=> s+(v.ivaTotal||0),0);
  const totalVendido = ventasHoy.reduce((s,v)=> s+(v.total||0),0);
  const gananciaHoy = ventasHoy.reduce((s,v)=> {
    const costo = (v.items||[]).reduce((a,i)=> a+ (Number(i.costoUnit)||0)*i.qty,0);
    const sub = v.subtotal || v.total || 0;
    return s + (sub - costo);
  },0);
  const debePendiente = ventas.filter(v=> (v.debe||0)>0.01).reduce((s,v)=> s+v.debe,0);
  const unidadesHoy = ventasHoy.reduce((s,v)=> s+ (v.items||[]).reduce((a,i)=> a+i.qty,0),0);

  const porProductoMap={};
  for(const v of ventasHoy) for(const it of v.items||[]){
    porProductoMap[it.nombre] = (porProductoMap[it.nombre]||0) + it.qty;
  }
  const porProducto = Object.entries(porProductoMap).map(([nombre, qty])=> ({nombre, qty})).sort((a,b)=> b.qty-a.qty);

  const porCategoriaMap={};
  for(const v of ventasHoy) for(const it of v.items||[]){
    const cat = categorias.find(c=> c.id===it.categoriaId);
    const key = cat ? cat.nombre : 'Sin categoría';
    porCategoriaMap[key] = (porCategoriaMap[key]||0) + (it.subtotal||0);
  }
  const porCategoria = Object.entries(porCategoriaMap).map(([nombre, total])=> ({nombre, total}));

  const deudaMap={};
  for(const v of ventas.filter(v=> (v.debe||0)>0.01)){
    const cid = v.clienteId || v.usuarioId;
    const cnombre = v.clienteNombre || v.usuarioNombre || '—';
    deudaMap[cid] = deudaMap[cid]||{usuarioId: cid, clienteId: cid, usuarioNombre: cnombre, clienteNombre: cnombre, deuda:0, ventas:0};
    deudaMap[cid].deuda += v.debe;
    deudaMap[cid].ventas += 1;
  }
  const topDeudores = Object.values(deudaMap).sort((a,b)=> b.deuda-a.deuda).slice(0,5);

  const stockBajo = productos.filter(p=> (Number(p.stock)||0) <= (Number(p.stockMin)||2)).slice(0,5);

  const evolucion=[];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const f = d.toISOString().slice(0,10);
    const vd = ventas.filter(v=> v.fecha===f);
    const t = vd.reduce((s,v)=> s+(v.total||0),0);
    const sub = vd.reduce((s,v)=> s+(v.subtotal||0),0);
    const iva = vd.reduce((s,v)=> s+(v.ivaTotal||0),0);
    const g = vd.reduce((s,v)=> s+ ((v.subtotal||v.total||0) - (v.items||[]).reduce((a,i)=> a+ (Number(i.costoUnit)||0)*i.qty,0)),0);
    evolucion.push({fecha:f, total:t, subtotal:sub, iva, ganancia:g, ventas:vd.length});
  }

  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const f30 = hace30.toISOString().slice(0,10);
  const porProd30={};
  for(const v of ventas.filter(v=> v.fecha >= f30)) for(const it of v.items||[]){
    porProd30[it.nombre] = (porProd30[it.nombre]||0)+ it.qty;
  }
  const topProductos = Object.entries(porProd30).map(([nombre,qty])=>({nombre,qty})).sort((a,b)=>b.qty-a.qty).slice(0,5);

  // cuotas vencidas y por vencer + ventas contado con deuda
  const hoyStr=hoy;
  let cuotasVencidas=0, cuotasPendientes=0;
  let ventasConDeuda=0;
  for(const v of ventas){
    if((v.debe||0)>0.01) ventasConDeuda++;
    if(!v.cuotas || !v.cuotas.length){
      if((v.debe||0)>0.01){
        cuotasPendientes++;
        // contado vencido si hace >7 días y sigue con deuda
        const ventaFecha = v.fecha || v.creado?.slice(0,10) || hoyStr;
        if(ventaFecha < hoyStr) cuotasVencidas++; // contado viejo con deuda = vencido
      }
      continue;
    }
    for(const c of v.cuotas){
      if(c.pagado) continue;
      cuotasPendientes++;
      if(c.vencimiento < hoyStr) cuotasVencidas++;
    }
  }

  const user = db.findUserById(req.session?.userId);
  const isDueno = !user || user.rol === 'dueno' || user.rol === 'admin';
  const gananciaOutput = isDueno ? gananciaHoy : null;
  const evolucionOutput = isDueno ? evolucion : evolucion.map(e => ({ ...e, ganancia: null }));

  const cfg=db.getConfig();
  res.json({ok:true, data:{
    fecha, config: cfg,
    kpis:{ ventasHoy: ventasHoy.length, subtotalHoy, ivaHoy, totalVendido, gananciaHoy: gananciaOutput, debePendiente, unidadesHoy, cuotasVencidas, cuotasPendientes, ventasConDeuda },
    porProducto, porCategoria, topDeudores, stockBajo, evolucion: evolucionOutput, topProductos,
    isDueno
  }});
});

module.exports = router;
