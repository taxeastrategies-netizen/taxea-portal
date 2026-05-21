import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Brain, Loader2, ThermometerSun, Star, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_LEADS = [
  { name: 'Clinica Dental Gomez', tipo: 'SL', facturacion: 380000, sector: 'salud', canal: 'Google Ads', servicio: 'Fiscalidad + Contabilidad + Financiero', trabajadores: 8, urgencia: 'alta', regimen: 'IVA', score: 88, temp: 'caliente', clase: 'SQL', motivo: 'SL con alta facturacion, servicio recurrente complejo, urgencia real y multiples modulos.' },
  { name: 'Autonomo Tech Lanzarote', tipo: 'autonomo', facturacion: 95000, sector: 'tech', canal: 'SEO organico', servicio: 'Fiscalidad + IGIC', trabajadores: 0, urgencia: 'media', regimen: 'IGIC', score: 74, temp: 'caliente', clase: 'MQL', motivo: 'Autonomo con IGIC, facturacion media-alta, perfil digital ideal para plan profesional.' },
  { name: 'Reformas Canarias SL', tipo: 'SL', facturacion: 120000, sector: 'construccion', canal: 'Meta Ads', servicio: 'Contabilidad basica', trabajadores: 3, urgencia: 'baja', regimen: 'IVA', score: 52, temp: 'templado', clase: 'nutricion', motivo: 'SL pequena, servicio de menor valor, baja urgencia y canal mas costoso.' },
  { name: 'Ecommerce Moda SL', tipo: 'SL', facturacion: 210000, sector: 'ecommerce', canal: 'Referido', servicio: 'Fiscalidad + Ecommerce + Logistica', trabajadores: 4, urgencia: 'alta', regimen: 'IVA', score: 82, temp: 'caliente', clase: 'oportunidad', motivo: 'Ecommerce con operaciones cross-border, alta complejidad y urgencia. Canal referido = alta calidad.' },
  { name: 'Bar Tapas Gomera', tipo: 'autonomo', facturacion: 42000, sector: 'hosteleria', canal: 'Meta Ads', servicio: 'Renta anual', trabajadores: 1, urgencia: 'baja', regimen: 'IVA', score: 28, temp: 'frio', clase: 'no cualificado', motivo: 'Busca servicio puntual, baja facturacion, sin recurrencia y canal caro.' },
  { name: 'Asesoria Medina', tipo: 'SL', facturacion: 460000, sector: 'servicios', canal: 'Referido', servicio: 'ERP Completo + Reporting', trabajadores: 12, urgencia: 'alta', regimen: 'IVA', score: 95, temp: 'caliente', clase: 'oportunidad', motivo: 'Despacho de gran tamano, alta facturacion, todos los modulos y referido interno.' },
  { name: 'Autonomo Canarias Reparto', tipo: 'autonomo', facturacion: 28000, sector: 'transporte', canal: 'Google Ads', servicio: 'Contabilidad basica', trabajadores: 0, urgencia: 'media', regimen: 'IGIC', score: 41, temp: 'frio', clase: 'nutricion', motivo: 'Autonomo con baja facturacion, servicio basico, solo IGIC, margen reducido.' },
  { name: 'Consultora Innova SL', tipo: 'SL', facturacion: 195000, sector: 'consultoria', canal: 'LinkedIn', servicio: 'Financiero + Reporting + M&A', trabajadores: 6, urgencia: 'alta', regimen: 'IVA', score: 79, temp: 'caliente', clase: 'SQL', motivo: 'SL con operaciones complejas y necesidad de reporting financiero avanzado.' },
  { name: 'Tienda Surf Fuerteventura', tipo: 'autonomo', facturacion: 68000, sector: 'retail', canal: 'SEO organico', servicio: 'Fiscalidad IGIC + stock', trabajadores: 2, urgencia: 'media', regimen: 'IGIC', score: 61, temp: 'templado', clase: 'MQL', motivo: 'IGIC + inventario, canal organico de calidad, potencial de expansion.' },
  { name: 'Inmobiliaria Tenerife SL', tipo: 'SL', facturacion: 320000, sector: 'inmobiliario', canal: 'Google Ads', servicio: 'Fiscalidad + Contabilidad', trabajadores: 5, urgencia: 'alta', regimen: 'IVA', score: 76, temp: 'caliente', clase: 'SQL', motivo: 'Sector con alta transaccionalidad, facturacion alta, urgencia real.' },
];

const TEMP_COLORS = { caliente: 'bg-red-100 text-red-700', templado: 'bg-amber-100 text-amber-700', frio: 'bg-blue-100 text-blue-700' };
const CLASE_COLORS = { SQL: 'bg-emerald-100 text-emerald-700', MQL: 'bg-blue-100 text-blue-700', oportunidad: 'bg-purple-100 text-purple-700', nutricion: 'bg-amber-100 text-amber-700', 'no cualificado': 'bg-slate-100 text-slate-600' };

const ScoreGauge = ({ score }) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#ef4444' : '#6b7280';
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${score * 1.633} 163.3`} strokeLinecap="round"
          transform="rotate(-90 32 32)" />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
};

export default function LeadFitScore() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [aiMsg, setAiMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = filter === 'all' ? DEMO_LEADS : DEMO_LEADS.filter(l => l.temp === filter || l.clase === filter);
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  const generateMessage = async (lead) => {
    setSelected(lead);
    setLoading(true);
    setAiMsg('');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asesor comercial experto en servicios fiscales. Genera el siguiente mensaje de seguimiento para este lead:\n\n- Nombre/empresa: ${lead.name}\n- Tipo: ${lead.tipo}\n- Servicio: ${lead.servicio}\n- Urgencia: ${lead.urgencia}\n- Score: ${lead.score}/100\n- Clasificacion: ${lead.clase}\n\nGenera:\n1. Mensaje corto WhatsApp (max 3 frases, no agresivo)\n2. Siguiente accion recomendada\n3. Riesgo a evitar\n\nMarca como borrador. No prometas resultados garantizados.`,
    });
    setAiMsg(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta">Lead Fit Score</h1><p className="text-sm text-muted-foreground">Calidad y encaje comercial de los leads desde Marketing — separado del CRM</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Leads totales', v: DEMO_LEADS.length, color: 'text-foreground' },
          { label: 'Calientes (≥75)', v: DEMO_LEADS.filter(l=>l.score>=75).length, color: 'text-red-600' },
          { label: 'Score medio', v: Math.round(DEMO_LEADS.reduce((s,l)=>s+l.score,0)/DEMO_LEADS.length), color: 'text-primary' },
          { label: 'No cualificados', v: DEMO_LEADS.filter(l=>l.score<40).length, color: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['all','Todos'],['caliente','Calientes'],['templado','Templados'],['frio','Frios'],['SQL','SQL'],['oportunidad','Oportunidades']].map(([v,l])=>(
          <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', filter===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground')}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map(lead => (
          <div key={lead.name} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
              <ScoreGauge score={lead.score} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-semibold">{lead.name}</p>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', TEMP_COLORS[lead.temp])}>{lead.temp}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', CLASE_COLORS[lead.clase])}>{lead.clase}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{lead.tipo} · {lead.sector} · {lead.facturacion.toLocaleString('es-ES')}EUR/año · {lead.canal}</p>
                <p className="text-xs text-muted-foreground">{lead.servicio} · {lead.regimen} · Urgencia: {lead.urgencia}</p>
                <p className="text-xs mt-1.5 text-foreground/70 italic">{lead.motivo}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 text-xs h-8 gap-1" onClick={() => generateMessage(lead)}>
                <Brain className="w-3 h-3" />Siguiente accion
              </Button>
            </div>
            {selected?.name === lead.name && (
              <div className="mt-3 pt-3 border-t border-border">
                {loading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Generando...</div> : (
                  <div>
                    <p className="text-[10px] text-amber-600 font-semibold mb-1">⚠ BORRADOR — Revisar antes de enviar</p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{aiMsg}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}