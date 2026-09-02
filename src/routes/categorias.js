const express = require('express');
const router = express.Router();
const db = require('../models/db');
function slugify(s){ return s.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

const PALETTE = [
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
  '#e11d48', '#0284c7', '#059669', '#d97706', '#7c3aed'
];

function pickAutoColor(indexOrSeed) {
  if (typeof indexOrSeed === 'number') {
    return PALETTE[indexOrSeed % PALETTE.length];
  }
  let hash = 0;
  const str = String(indexOrSeed || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

router.get('/', (req,res)=>{ res.json({ok:true, data: db.getCategorias()}); });

router.post('/', (req,res)=>{
  const {nombre, descripcion, codigo, color} = req.body;
  if(!nombre) return res.status(400).json({ok:false, error:'Nombre requerido'});
  if(nombre.trim().length < 2) return res.status(400).json({ok:false, error:'Nombre muy corto'});
  const all=db.getCategorias();
  const autoColor = color || pickAutoColor(all.length);
  const cat = { 
    id:'cat_'+db.genId(), 
    nombre: nombre.trim(), 
    slug: slugify(nombre), 
    descripcion: (descripcion||'').trim().slice(0,120), 
    codigo: (codigo||'').trim().toUpperCase().slice(0,12) || slugify(nombre).slice(0,8).toUpperCase(),
    color: autoColor,
    creado: new Date().toISOString() 
  };
  // validar duplicado por slug/codigo
  if(all.some(c=> c.slug===cat.slug)) return res.status(409).json({ok:false, error:'Ya existe una categoría con ese nombre'});
  if(cat.codigo && all.some(c=> c.codigo===cat.codigo)) return res.status(409).json({ok:false, error:'Código ya existe'});
  db.createCategoria(cat);
  res.json({ok:true, data:cat});
});

router.put('/:id', (req,res)=>{
  const cat = db.findCategoriaById(req.params.id);
  if(!cat) return res.status(404).json({ok:false, error:'Categoría no encontrada'});
  const {nombre, descripcion, codigo, color} = req.body;
  const patch={};
  if(nombre){ patch.nombre=nombre.trim(); patch.slug=slugify(nombre); }
  if(descripcion!==undefined) patch.descripcion=descripcion.trim().slice(0,120);
  if(codigo!==undefined) patch.codigo=codigo.trim().toUpperCase().slice(0,12);
  if(color) patch.color = color;
  const upd = db.updateCategoria(req.params.id, patch);
  res.json({ok:true, data:upd});
});

router.delete('/:id', (req,res)=>{
  // no permitir borrar si hay productos con esa categoria
  const prods = db.getProductos().filter(p=> p.categoriaId===req.params.id);
  if(prods.length) return res.status(409).json({ok:false, error:`No se puede borrar: ${prods.length} productos usan esta categoría`});
  const d = db.deleteCategoria(req.params.id);
  if(!d) return res.status(404).json({ok:false, error:'No encontrada'});
  res.json({ok:true});
});

module.exports = router;
