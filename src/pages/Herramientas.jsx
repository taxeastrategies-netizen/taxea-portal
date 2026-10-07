import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Wrench, ScanLine, Files, FileSpreadsheet, Calculator, CalendarClock, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import DocumentTools from '@/components/tools/DocumentTools';
import PdfImageKit from '@/components/tools/PdfImageKit';
import CommercialCalculator from '@/components/tools/CommercialCalculator';
import UtilityDeadlines from '@/components/tools/UtilityDeadlines';

export const TOOL_CATALOG=[
  {id:'renombrador',title:'Renombrador OCR',icon:ScanLine,tag:'Orden documental',description:'Lee tus documentos y propone nombres coherentes. Revisa, corrige y descarga el lote sin alterar los originales.'},
  {id:'pdf-imagenes',title:'Kit PDF e imágenes',icon:Files,tag:'Procesamiento local',description:'Une, separa, reordena y gira PDF. Convierte fotos a PDF y optimiza imágenes desde tu navegador.'},
  {id:'extractor',title:'Extractor de documentos',icon:FileSpreadsheet,tag:'Datos reutilizables',description:'Extrae fechas, emisores, conceptos e importes. Revisa los datos y llévalos a Excel o CSV, sin contabilizar.'},
  {id:'calculadora',title:'Calculadora comercial',icon:Calculator,tag:'Decisiones rápidas',description:'Calcula márgenes, recargos, descuentos, precio objetivo y punto de equilibrio con fórmulas transparentes.'},
  {id:'vencimientos',title:'Vencimientos',icon:CalendarClock,tag:'Control y calendario',description:'Controla certificados, seguros, contratos y renovaciones. Guarda fechas por empresa y exporta tu calendario.'},
];
export default function Herramientas() {
  const {tool}=useParams(),{company}=useOutletContext() || {};
  const current=TOOL_CATALOG.find(item=>item.id===tool);
  const content=current?.id==='renombrador'?<DocumentTools mode="rename" company={company}/>:
    current?.id==='extractor'?<DocumentTools mode="extract" company={company}/>:
    current?.id==='pdf-imagenes'?<PdfImageKit/>:
    current?.id==='calculadora'?<CommercialCalculator/>:
    current?.id==='vencimientos'?<UtilityDeadlines company={company}/>:null;
  return <div className="space-y-6 animate-fade-in">
    <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none"/>
      <p className="text-xs uppercase tracking-[.18em] text-muted-foreground mb-3">Core Operativo</p>
      <h1 className="font-jakarta text-2xl md:text-3xl font-bold flex items-center gap-3"><Wrench className="h-7 w-7 text-primary"/>{current?.title || 'Herramientas'}</h1>
      <p className="text-sm text-muted-foreground max-w-2xl mt-3">{current?.description || 'Utilidades prácticas para resolver el trabajo del día a día. Un espacio independiente que iremos ampliando contigo.'}</p>
      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-5"><ShieldCheck className="h-4 w-4 text-emerald-600"/>No se crean facturas ni asientos contables. Tus archivos originales se conservan.</p>
    </header>
    {tool && !current?<div role="alert" className="rounded-xl border p-6">Herramienta no encontrada. <Link className="text-primary underline" to="/herramientas">Volver al catálogo</Link></div>:current?<><Link className="inline-flex items-center gap-2 text-sm text-primary hover:underline" to="/herramientas"><ArrowLeft className="h-4 w-4"/>Todas las herramientas</Link>
      <nav aria-label="Herramientas" className="flex flex-wrap gap-2">{TOOL_CATALOG.map(item=><Link key={item.id} to={'/herramientas/'+item.id} aria-current={current.id===item.id?'page':undefined} className={'rounded-full border px-3 py-2 text-xs font-medium '+(current.id===item.id?'bg-primary text-primary-foreground border-primary':'bg-card hover:bg-secondary')}>{item.title}</Link>)}</nav>
      <div key={current.id+':'+(company?.id || 'local')}>{content}</div>
    </>:<section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Catálogo de herramientas">{TOOL_CATALOG.map(({id,title,icon:Icon,tag,description})=><Link key={id} to={'/herramientas/'+id} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg hover:border-primary/40 focus-visible:outline-primary">
      <div className="flex justify-between items-start mb-5"><div className="p-3 rounded-xl bg-primary/5 border border-primary/10"><Icon className="h-6 w-6 text-primary"/></div><span className="text-[10px] rounded-full border px-2 py-1 text-muted-foreground">{tag}</span></div>
      <h2 className="font-jakarta font-semibold text-lg">{title}</h2><p className="text-sm text-muted-foreground mt-2 mb-6 flex-1">{description}</p><span className="text-sm font-medium text-primary inline-flex items-center gap-2">Abrir herramienta<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span>
    </Link>)}</section>}
  </div>;
}
