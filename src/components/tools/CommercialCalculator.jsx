import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { commercialCalculations, numberInput } from '@/lib/utilityTools.mjs';
const LABELS={cost:'Coste variable unitario (€)',price:'Precio de venta unitario (€)',margin:'Margen objetivo (%)',discount:'Descuento (%)',fixed:'Costes fijos del periodo (€)'};
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
export default function CommercialCalculator() {
  const [form,setForm]=useState({cost:'60',price:'100',margin:'40',discount:'10',fixed:'1200'});
  let result,error='';
  try {result=commercialCalculations({cost:numberInput(form.cost),price:numberInput(form.price),margin:numberInput(form.margin),discount:numberInput(form.discount),fixed:numberInput(form.fixed)});}
  catch(e){error=e.message;}
  const results=result?[
    ['Beneficio unitario',money(result.profit),'Precio − coste variable'],
    ['Margen sobre venta',result.margin.toFixed(2)+'%','(Precio − coste) / precio × 100'],
    ['Recargo sobre coste',result.markup==null?'No calculable con coste cero':result.markup.toFixed(2)+'%','(Precio − coste) / coste × 100'],
    ['Precio para margen objetivo',money(result.targetPrice),'Coste / (1 − margen objetivo / 100)'],
    ['Precio con descuento',money(result.discounted),'Precio × (1 − descuento / 100)'],
    ['Punto de equilibrio',result.breakEven==null?'No alcanzable':result.breakEven+' unidades','Costes fijos / contribución unitaria, redondeado al alza'],
  ]:[];
  return <section className="space-y-5"><div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground mb-5">Introduce importes sin IVA/IGIC y en la misma moneda. El margen sobre venta y el recargo sobre coste son conceptos distintos. Esta utilidad no calcula modelos tributarios.</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Object.entries(LABELS).map(([key,label])=><label key={key} className="text-sm font-medium">{label}<Input className="mt-2" inputMode="decimal" value={form[key]} onChange={e=>setForm(current=>({...current,[key]:e.target.value}))}/></label>)}</div></div>
    {error && <p role="alert" className="text-sm text-red-600 rounded-xl border p-4">{error}</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{results.map(([label,value,formula])=><div key={label} className="rounded-2xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="text-xl font-jakarta font-bold mt-3 text-primary">{value}</p><p className="text-xs text-muted-foreground mt-3">{formula}</p></div>)}</div>
    {result?.profit<=0 && <p className="text-sm text-amber-700">El precio no supera el coste variable: no cubre costes fijos. Revisa precio y coste.</p>}
  </section>;
}
