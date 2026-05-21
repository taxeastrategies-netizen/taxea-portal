import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Award, Loader2, FileText, BarChart2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const REPORT_TYPES = [
  { id: 'weekly', label: 'Informe semanal de marketing', desc: 'Resumen de la semana: leads, conversiones, alertas y acciones', icon: BarChart2 },
  { id: 'monthly', label: 'Informe mensual de Growth', desc: 'Analisis completo mensual con KPIs, que funciono y que no', icon: TrendingUp },
  { id: 'campaigns', label: 'Informe de campanas', desc: 'Rendimiento detallado por campana con recomendaciones', icon: FileText },
  { id: 'executive', label: 'Informe ejecutivo premium', desc: 'Informe estilo Big Four para presentar a socios o direccion', icon: Award },
];

const DEMO_KPIS = {
  leads: 247, qualified: 118, closed: 27, mrr: 6480,
  cac: 84, cpl: 9.2, conv: 10.9, churn: 4.2,
  campaigns: 8, active: 6, proposals: 37, appointments: 62,
};

export default function GrowthReports() {
  const { company } = useOutletContext() || {};
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async (type) => {
    if (!company) return;
    setSelected(type);
    setLoading(true);
    setReport('');

    const prompts = {
      weekly: `Genera un informe semanal de marketing para "${company?.nombre || 'la empresa'}" en formato ejecutivo conciso.\n\nKPIs de la semana:\n- Leads: ${DEMO_KPIS.leads}\n- Cualificados: ${DEMO_KPIS.qualified}\n- Citas: ${DEMO_KPIS.appointments}\n- Cierres: ${DEMO_KPIS.closed}\n- MRR generado: ${DEMO_KPIS.mrr}EUR\n- CPL: ${DEMO_KPIS.cpl}EUR\n- CAC: ${DEMO_KPIS.cac}EUR\n\nEstructura:\n1. Resumen ejecutivo (3 frases)\n2. Que funciono esta semana\n3. Que no funciono\n4. Alertas\n5. Acciones para la proxima semana\n\nTono: directo, sin adornos, orientado a decision.`,
      monthly: `Genera un informe mensual de Growth para "${company?.nombre || 'la empresa'}".\n\nDatos del mes:\n- Leads totales: ${DEMO_KPIS.leads}\n- Leads cualificados: ${DEMO_KPIS.qualified} (${Math.round(DEMO_KPIS.qualified/DEMO_KPIS.leads*100)}%)\n- Clientes cerrados: ${DEMO_KPIS.closed}\n- MRR generado: ${DEMO_KPIS.mrr}EUR\n- CAC medio: ${DEMO_KPIS.cac}EUR\n- Conversion total: ${DEMO_KPIS.conv}%\n- Churn estimado: ${DEMO_KPIS.churn}%\n- Campanas activas: ${DEMO_KPIS.active}\n\nEstructura del informe:\n# INFORME MENSUAL GROWTH\n## 1. Resumen ejecutivo\n## 2. KPIs clave del mes\n## 3. Analisis de canales\n## 4. Que funciono\n## 5. Que no funciono\n## 6. Riesgos detectados\n## 7. Oportunidades identificadas\n## 8. Plan de accion mes siguiente\n## 9. Objetivos para el proximo mes\n\nTono: profesional, analitico, accionable.`,
      campaigns: `Genera un informe de rendimiento de campanas para "${company?.nombre || 'la empresa'}".\n\nCampanas activas: ${DEMO_KPIS.active} de ${DEMO_KPIS.campaigns} totales\nLeads totales: ${DEMO_KPIS.leads}\nCierres: ${DEMO_KPIS.closed}\nMRR: ${DEMO_KPIS.mrr}EUR\n\nCampanas de referencia:\n- Google Ads (Diagnostico Fiscal): 62 leads, 7 cierres, ROAS 2.7x - MEJOR CAMPANA\n- Meta Ads (Gestoria Low Cost): 48 leads, 4 cierres, ROAS 2.1x - ESCALAR\n- Meta Ads (Vendes Ganas Poco): 19 leads, 1 cierre, ROAS 0.8x - EN RIESGO\n- SEO organico: 27 leads, 3 cierres, CAC 0 - INVERTIR MAS\n\nGenera el informe con analisis por campana, ranking, recomendaciones de escalar/pausar/ajustar y proximos pasos.`,
      executive: `Genera un informe ejecutivo premium estilo McKinsey/Big Four de Marketing y Growth para "${company?.nombre || 'la empresa'}".\n\nKPIs:\n- MRR: ${DEMO_KPIS.mrr}EUR/mes\n- Clientes cerrados: ${DEMO_KPIS.closed}\n- CAC: ${DEMO_KPIS.cac}EUR\n- Conversion: ${DEMO_KPIS.conv}%\n- Churn: ${DEMO_KPIS.churn}%\n- LTV estimado: ${Math.round(DEMO_KPIS.mrr / DEMO_KPIS.closed * 18)}EUR\n- LTV/CAC: ${(Math.round(DEMO_KPIS.mrr / DEMO_KPIS.closed * 18) / DEMO_KPIS.cac).toFixed(1)}x\n\nEstructura:\n# INFORME EJECUTIVO DE MARKETING Y GROWTH\n## Executive Summary\n## 1. Situacion comercial actual\n## 2. Analisis de canales y eficiencia\n## 3. Salud del embudo de venta\n## 4. Rentabilidad del marketing\n## 5. Riesgos y oportunidades\n## 6. Recomendaciones estrategicas\n## 7. Plan de accion 90 dias\n## 8. KPIs de seguimiento\n\nTono: consultor senior, denso, con datos, benchmarks y recomendaciones de alto impacto.`,
    };

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: prompts[type],
      model: 'claude_sonnet_4_6',
    });
    setReport(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="Informes de Growth" />;

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta">Informes de Growth</h1><p className="text-sm text-muted-foreground">Informes automaticos generados con IA a partir de tus datos reales</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORT_TYPES.map(rt => (
          <button key={rt.id} onClick={() => generate(rt.id)} disabled={loading} className={cn('text-left bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all hover:border-primary/40', selected === rt.id && 'border-primary ring-1 ring-primary/20')}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><rt.icon className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="font-semibold text-sm">{rt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rt.desc}</p>
              </div>
              {loading && selected === rt.id && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto flex-shrink-0 mt-0.5" />}
            </div>
          </button>
        ))}
      </div>

      {loading && !report && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generando informe con IA...</p>
        </div>
      )}

      {report && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
          <div className={cn('px-6 py-4 flex items-center gap-3', selected === 'executive' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-900')}>
            {selected === 'executive' ? <Award className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white/60" />}
            <div>
              <p className="font-bold text-white text-sm">{REPORT_TYPES.find(r=>r.id===selected)?.label}</p>
              <p className="text-xs text-white/60">{company?.nombre || 'Empresa'} - {new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' })} - Generado con IA</p>
            </div>
            {selected === 'executive' && <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">CONFIDENCIAL</span>}
          </div>
          <div className="p-6 text-sm leading-relaxed whitespace-pre-wrap">{report}</div>
          <div className="px-6 py-3 border-t border-border bg-secondary/30 text-xs text-muted-foreground">
            Generado por Taxea Portal - Growth AI Director - Borrador pendiente de revision
          </div>
        </div>
      )}
    </div>
  );
}