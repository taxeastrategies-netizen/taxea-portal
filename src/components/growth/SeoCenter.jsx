import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Brain, Loader2, TrendingUp, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CLUSTERS = [
  {
    id: 1, keyword: 'gastos deducibles autonomos', vol: 22000, dif: 'media', intencion: 'informacional + comercial',
    prioridad: 'alta', estado: 'falta pilar', cta: 'Descarga la guia de deducciones', lead_magnet: 'Checklist gastos deducibles',
    riesgo: 'medio', funnel: 'TOFU-MOFU',
    secundarias: ['deducciones autonomo 2025', 'gastos deducibles irpf', 'que puedo deducir como autonomo', 'gastos ordenador autonomo'],
    articulo_pilar: 'Guia completa de gastos deducibles para autonomos en Espana',
    soporte: ['Gastos del coche para autonomos', 'Telefono movil como gasto deducible', 'Gastos de formacion autonomo'],
    recomendacion: 'Crear pilar + 3 articulos soporte. Alto volumen con intencion mixta. Incluir disclaimer fiscal en cada punto.',
  },
  {
    id: 2, keyword: 'alta autonomo Canarias IGIC', vol: 4800, dif: 'baja', intencion: 'transaccional',
    prioridad: 'critica', estado: 'no existe', cta: 'Hablamos? Te ayudamos con el alta', lead_magnet: 'Checklist alta autonomo IGIC',
    riesgo: 'bajo', funnel: 'BOFU',
    secundarias: ['autonomo IGIC como funciona', 'diferencias IVA IGIC', 'alta autonomo Tenerife', 'gestor autonomo Canarias'],
    articulo_pilar: 'Alta como autonomo en Canarias: IGIC, pasos y errores a evitar',
    soporte: ['IGIC vs IVA: diferencias clave', 'Como tributar siendo autonomo en Canarias', 'Mejores gestores en Canarias'],
    recomendacion: 'Maxima prioridad: bajo volumen pero intencion transaccional directa. Nuestra especialidad geografica. Bajo riesgo de compliance.',
  },
  {
    id: 3, keyword: 'SL vs autonomo ventajas fiscales', vol: 9400, dif: 'media-alta', intencion: 'informacional + decision',
    prioridad: 'alta', estado: 'borrador', cta: 'Calcula que te conviene mas', lead_magnet: 'Comparativa SL vs autonomo',
    riesgo: 'alto', funnel: 'MOFU',
    secundarias: ['cuando constituir SL', 'tributacion SL vs autonomo', 'autonomo vs SL cuanto gano'],
    articulo_pilar: 'SL o autonomo: comparativa fiscal real sin promesas',
    soporte: ['Costes de constituir una SL', 'IRPF vs IS: cual es mas eficiente'],
    recomendacion: 'Alto riesgo de claims absolutos. Revisar todas las afirmaciones fiscales. Siempre con condicionales y "depende de tu caso".',
  },
  {
    id: 4, keyword: 'control financiero pyme', vol: 5600, dif: 'media', intencion: 'informacional + MOFU',
    prioridad: 'media', estado: 'no existe', cta: 'Analiza tu salud financiera', lead_magnet: 'Plantilla control financiero',
    riesgo: 'bajo', funnel: 'MOFU',
    secundarias: ['tesoreria pyme', 'cuadro de mando financiero', 'flujo de caja pyme', 'kpis financieros'],
    articulo_pilar: 'Control financiero para pymes: guia practica sin complicaciones',
    soporte: ['Como calcular el flujo de caja', 'KPIs financieros basicos para el dueno de negocio'],
    recomendacion: 'Diferenciador fuerte: cruzar con el modulo Finance del portal. Lead magnet con plantilla de control financiero.',
  },
];

const MONEY_PAGES = [
  { titulo: 'Alta autonomo Canarias IGIC', intencion: 'transaccional', potencial: 'muy alto', accion: 'Crear landing + SEO', gap: 'No existe' },
  { titulo: 'Mejor gestor online Canarias', intencion: 'transaccional', potencial: 'muy alto', accion: 'Optimizar landing existente', gap: 'Sin CTA claro' },
  { titulo: 'Error en declaracion: que hacer', intencion: 'urgente-transaccional', potencial: 'alto', accion: 'Crear articulo + lead magnet', gap: 'No existe' },
  { titulo: 'Cambia de gestoria sin problemas', intencion: 'comercial-decision', potencial: 'alto', accion: 'Landing comparativa', gap: 'No existe' },
];

export default function SeoCenter() {
  const [expanded, setExpanded] = useState(null);
  const [aiCluster, setAiCluster] = useState({});
  const [loading, setLoading] = useState({});
  const [tab, setTab] = useState('clusters');

  const generateClusterIdeas = async (cluster) => {
    setLoading(p => ({ ...p, [cluster.id]: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto SEO para el mercado espanol en fiscalidad y asesorias. Para el cluster "${cluster.keyword}" genera:\n1. Brief del articulo pilar (estructura H1-H2, 300 palabras)\n2. 5 preguntas FAQ para schema\n3. 3 ideas de lead magnet\n4. Advertencias de compliance fiscal si aplica\n\nRespuesta concisa y practica. Marca borrador.`,
    });
    setAiCluster(p => ({ ...p, [cluster.id]: typeof res === 'string' ? res : res?.response || '' }));
    setLoading(p => ({ ...p, [cluster.id]: false }));
  };

  const PRIO_COLORS = { critica: 'bg-red-100 text-red-700', alta: 'bg-amber-100 text-amber-700', media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600' };
  const RISK_COLORS = { alto: 'text-red-600', medio: 'text-amber-600', bajo: 'text-emerald-600' };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Search className="w-5 h-5 text-emerald-600" />SEO Center</h1><p className="text-sm text-muted-foreground">Clusters tematicos, money pages y autoridad SEO para Taxea</p></div>

      <div className="flex gap-2">
        {[['clusters','Clusters SEO'],['money','Money Pages'],['compliance','Compliance Fiscal']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', tab===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{l}</button>
        ))}
      </div>

      {tab === 'clusters' && (
        <div className="space-y-3">
          {CLUSTERS.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold">{c.keyword}</p>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', PRIO_COLORS[c.prioridad])}>{c.prioridad}</span>
                      <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{c.funnel}</span>
                      <span className={cn('text-[10px] font-medium', RISK_COLORS[c.riesgo])}>Riesgo {c.riesgo}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Vol: ~{c.vol.toLocaleString('es-ES')}/mes</span>
                      <span>Dif: {c.dif}</span>
                      <span>{c.intencion}</span>
                      <span className="font-medium text-amber-600">Estado: {c.estado}</span>
                    </div>
                  </div>
                  {expanded === c.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              {expanded === c.id && (
                <div className="border-t border-border p-4 space-y-3 bg-secondary/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs font-semibold text-muted-foreground mb-1">Articulo pilar</p><p>{c.articulo_pilar}</p></div>
                    <div><p className="text-xs font-semibold text-muted-foreground mb-1">CTA + Lead Magnet</p><p>{c.cta}</p><p className="text-muted-foreground text-xs mt-0.5">{c.lead_magnet}</p></div>
                    <div><p className="text-xs font-semibold text-muted-foreground mb-1">Keywords secundarias</p><p className="text-xs">{c.secundarias.join(' · ')}</p></div>
                    <div><p className="text-xs font-semibold text-muted-foreground mb-1">Articulos soporte</p>{c.soporte.map(s => <p key={s} className="text-xs">• {s}</p>)}</div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary mb-1">Recomendacion</p>
                    <p className="text-sm">{c.recomendacion}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => generateClusterIdeas(c)} disabled={loading[c.id]}>
                    {loading[c.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}Generar brief con IA
                  </Button>
                  {aiCluster[c.id] && <div className="bg-slate-900 text-white text-xs p-4 rounded-xl whitespace-pre-wrap leading-relaxed">{aiCluster[c.id]}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'money' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase">
              <th className="text-left p-3">Pagina / Articulo</th>
              <th className="text-left p-3">Intencion</th>
              <th className="text-left p-3">Potencial</th>
              <th className="text-left p-3">Gap</th>
              <th className="text-left p-3">Accion</th>
            </tr></thead>
            <tbody>
              {MONEY_PAGES.map(p => (
                <tr key={p.titulo} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-3 font-medium">{p.titulo}</td>
                  <td className="p-3 text-xs text-muted-foreground">{p.intencion}</td>
                  <td className="p-3"><span className={cn('text-xs font-bold', p.potencial === 'muy alto' ? 'text-emerald-600' : 'text-amber-600')}>{p.potencial}</span></td>
                  <td className="p-3 text-xs text-red-600 font-medium">{p.gap}</td>
                  <td className="p-3 text-xs text-primary font-medium">{p.accion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Reglas de compliance fiscal SEO</p>
            {[
              'Nunca afirmar "puedes deducirte X" sin condicionantes claros.',
              'Siempre incluir: "dependiendo de tu caso y cumpliendo los requisitos".',
              'No confundir IVA e IGIC en el mismo articulo sin distinguir territorios.',
              'Articulos sobre deducciones deben incluir nota de validacion profesional.',
              'No usar titulos como "Ahorra impuestos haciendo X" sin matices.',
              'Comparativas de precios de competidores requieren revision legal previa.',
            ].map((r, i) => <p key={i} className="text-sm text-amber-700 flex gap-2 mb-1"><span className="font-bold">{i+1}.</span>{r}</p>)}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-semibold mb-3 text-sm">Usa el Fiscal SEO Compliance Checker para revisar textos individuales</p>
            <p className="text-sm text-muted-foreground">Navega a <span className="font-mono bg-secondary px-1 rounded">Compliance &gt; Fiscal SEO</span> para analizar articulos antes de publicar.</p>
          </div>
        </div>
      )}
    </div>
  );
}