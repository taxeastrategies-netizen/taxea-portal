import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Brain, Sparkles, Loader2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Zap, Shield, Activity, Target, RefreshCw, ChevronRight, FileText, Cpu,
  BarChart2, Clock, XCircle, Star, Award, Flame, Eye, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell
} from 'recharts';
import NoCompanyState from '@/components/ui/NoCompanyState';

// ─── Health Score Gauge ───────────────────────────────────────────────────────
function HealthGauge({ score }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = score / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= score) { setDisplayed(score); clearInterval(timer); }
      else setDisplayed(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [score]);

  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Operaciones saludables' : score >= 50 ? 'Atención moderada' : 'Estado crítico';
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75;
  const offset = arc - (arc * displayed) / 100;

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="160" viewBox="0 0 220 160">
        <circle cx="110" cy="130" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16"
          strokeDasharray={`${arc} ${circumference}`} strokeLinecap="round"
          transform="rotate(-225 110 130)" />
        <circle cx="110" cy="130" r={radius} fill="none" stroke={color} strokeWidth="16"
          strokeDasharray={`${arc - offset} ${circumference}`} strokeLinecap="round"
          transform="rotate(-225 110 130)"
          style={{ transition: 'stroke-dasharray 0.05s linear' }} />
        <text x="110" y="120" textAnchor="middle" fontSize="42" fontWeight="bold" fill={color}>{displayed}</text>
        <text x="110" y="148" textAnchor="middle" fontSize="11" fill="#94a3b8">/ 100</text>
      </svg>
      <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
    </div>
  );
}

// ─── Toxic Task Card ──────────────────────────────────────────────────────────
function ToxicCard({ task, reason, severity }) {
  const col = { alta: 'border-red-200 bg-red-50', media: 'border-orange-200 bg-orange-50', baja: 'border-amber-200 bg-amber-50' };
  const dot = { alta: 'bg-red-500', media: 'bg-orange-400', baja: 'bg-amber-400' };
  return (
    <div className={cn('border rounded-xl p-3', col[severity] || col.media)}>
      <div className="flex items-start gap-2">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', dot[severity] || dot.media)} />
        <div>
          <p className="text-sm font-semibold">{task.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
          {task.assignee_name && <p className="text-xs text-muted-foreground mt-0.5">Responsable: {task.assignee_name}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Automation Recommendation ────────────────────────────────────────────────
function AutoCard({ title, description, effort, impact, type }) {
  const effortColor = { bajo: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', alto: 'text-red-600 bg-red-50' };
  const impactColor = { alto: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', bajo: 'text-slate-600 bg-slate-50' };
  const icons = { recurrente: '🔄', alerta: '🔔', informe: '📊', tarea: '✅', comunicacion: '💬' };
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl">{icons[type] || '⚡'}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', effortColor[effort] || effortColor.medio)}>Esfuerzo {effort}</span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', impactColor[impact] || impactColor.medio)}>Impacto {impact}</span>
      </div>
    </div>
  );
}

// ─── Improvement Card ─────────────────────────────────────────────────────────
function ImprovementCard({ title, description, area, priority, status, onDone }) {
  const priorityColor = { alta: 'text-red-600', media: 'text-amber-600', baja: 'text-slate-500' };
  const areaColor = { procesos: 'bg-blue-50 text-blue-700', tareas: 'bg-purple-50 text-purple-700', riesgos: 'bg-red-50 text-red-700', proyectos: 'bg-emerald-50 text-emerald-700', general: 'bg-slate-50 text-slate-600' };
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 transition-all', status === 'done' && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button onClick={onDone} className={cn('w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all', status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400')}>
          {status === 'done' && <CheckCircle2 className="w-full h-full text-white" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className={cn('text-sm font-semibold', status === 'done' && 'line-through text-muted-foreground')}>{title}</p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', areaColor[area] || areaColor.general)}>{area}</span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className={cn('text-xs font-semibold mt-1', priorityColor[priority])}>Prioridad {priority}</p>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'director', label: 'IA Director', icon: Brain },
  { id: 'health', label: 'Health Score', icon: Activity },
  { id: 'chaos', label: 'Radar de Caos', icon: Flame },
  { id: 'toxic', label: 'Tareas Tóxicas', icon: XCircle },
  { id: 'audit', label: 'Auditoría IA', icon: Eye },
  { id: 'automation', label: 'Automatizaciones', icon: Zap },
  { id: 'improvement', label: 'Mejora Continua', icon: TrendingUp },
  { id: 'report', label: 'Informe Big Four', icon: Award },
];

export default function OperationsAICenter() {
  const { company } = useOutletContext() || {};
  const [tab, setTab] = useState('director');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [chaosData, setChaosData] = useState(null);
  const [toxicTasks, setToxicTasks] = useState([]);
  const [auditResult, setAuditResult] = useState('');
  const [directorBriefing, setDirectorBriefing] = useState('');
  const [automations, setAutomations] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [premiumReport, setPremiumReport] = useState('');
  const [generating, setGenerating] = useState({});

  useEffect(() => { if (company?.id) loadData(); else setLoading(false); }, [company?.id]);

  const loadData = async () => {
    setLoading(true);
    const [tasks, projects, processes, tickets, risks, roadmap] = await Promise.all([
      base44.entities.OpsTask.filter({ company_id: company.id }, '-created_date', 300),
      base44.entities.OpsProject.filter({ company_id: company.id }),
      base44.entities.OpsProcess.filter({ company_id: company.id }),
      base44.entities.OpsTicket.filter({ company_id: company.id }),
      base44.entities.OpsRisk.filter({ company_id: company.id }),
      base44.entities.OpsRoadmapItem.filter({ company_id: company.id }),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const active = (t) => !['finalizado', 'archivado', 'cerrado'].includes(t?.status);

    const d = {
      tasks: tasks || [],
      projects: projects || [],
      processes: processes || [],
      tickets: tickets || [],
      risks: risks || [],
      roadmap: roadmap || [],
      today,
      overdue: (tasks || []).filter(t => t.due_date && t.due_date < today && active(t)),
      critical: (tasks || []).filter(t => t.priority === 'critica' && active(t)),
      blocked: (tasks || []).filter(t => t.status === 'bloqueado'),
      withImpact: (tasks || []).filter(t => (t.impact_fiscal || t.impact_accounting || t.impact_financial || t.impact_legal) && active(t)),
      openTickets: (tickets || []).filter(t => active(t)),
      activeRisks: (risks || []).filter(r => r.status !== 'cerrado'),
      criticalRisks: (risks || []).filter(r => ['alto', 'critico'].includes(r.severity) && r.status !== 'cerrado'),
      activeProjects: (projects || []).filter(p => p.status === 'activo'),
      highRiskProjects: (projects || []).filter(p => ['alto', 'critico'].includes(p.risk_level) && p.status === 'activo'),
    };

    setData(d);
    computeHealthScore(d);
    computeChaosRadar(d);
    detectToxicTasks(d.tasks, today);
    generateAutomationRecs(d);
    generateImprovements(d);
    setLoading(false);
  };

  const computeHealthScore = (d) => {
    let score = 100;
    score -= Math.min(d.overdue.length * 4, 25);
    score -= Math.min(d.blocked.length * 3, 15);
    score -= Math.min(d.critical.length * 3, 15);
    score -= Math.min(d.criticalRisks.length * 4, 20);
    score -= Math.min(d.highRiskProjects.length * 3, 15);
    score -= d.openTickets.filter(t => t.priority === 'critica').length * 5;
    score += Math.min(d.projects.filter(p => p.status === 'finalizado').length * 2, 10);
    score += Math.min(d.processes.length * 1, 5);
    setHealthScore(Math.max(0, Math.min(100, Math.round(score))));
  };

  const computeChaosRadar = (d) => {
    const norm = (val, max) => Math.round((1 - Math.min(val, max) / max) * 10);
    setChaosData([
      { subject: 'Tareas', valor: norm(d.overdue.length, 10), max: 10 },
      { subject: 'Proyectos', valor: norm(d.highRiskProjects.length, 5), max: 5 },
      { subject: 'Riesgos', valor: norm(d.criticalRisks.length, 8), max: 8 },
      { subject: 'Tickets', valor: norm(d.openTickets.length, 15), max: 15 },
      { subject: 'Impacto Fiscal', valor: norm(d.withImpact.length, 10), max: 10 },
      { subject: 'Procesos', valor: Math.min(d.processes.length, 10) },
    ]);
  };

  const detectToxicTasks = (tasks, today) => {
    const toxic = [];
    tasks.forEach(t => {
      if (!['finalizado', 'archivado'].includes(t.status)) {
        if (t.due_date && t.due_date < today && t.status !== 'finalizado')
          toxic.push({ task: t, reason: `Vencida hace ${Math.floor((new Date(today) - new Date(t.due_date)) / 86400000)} días sin resolver`, severity: 'alta' });
        else if (t.status === 'bloqueado')
          toxic.push({ task: t, reason: 'Bloqueada: genera dependencias en cadena', severity: 'alta' });
        else if (!t.assignee_name && t.priority === 'critica')
          toxic.push({ task: t, reason: 'Tarea crítica sin responsable asignado', severity: 'alta' });
        else if (t.impact_fiscal && !['finalizado'].includes(t.status) && !t.due_date)
          toxic.push({ task: t, reason: 'Impacto fiscal detectado sin fecha límite', severity: 'media' });
        else if (!t.due_date && t.priority === 'alta')
          toxic.push({ task: t, reason: 'Alta prioridad sin fecha de entrega', severity: 'media' });
      }
    });
    setToxicTasks(toxic.slice(0, 10));
  };

  const generateAutomationRecs = (d) => {
    const recs = [];
    if (d.overdue.length > 2) recs.push({ title: 'Recordatorios automáticos de vencimiento', description: 'Enviar alerta 48h antes del vencimiento de cada tarea con impacto', effort: 'bajo', impact: 'alto', type: 'alerta' });
    if (d.processes.length > 0) recs.push({ title: 'Generación automática de tareas desde procesos', description: 'Al ejecutar un proceso, crear todas sus tareas automáticamente con plazos', effort: 'bajo', impact: 'alto', type: 'recurrente' });
    if (d.openTickets.length > 3) recs.push({ title: 'Auto-asignación de tickets por departamento', description: 'Asignar automáticamente tickets nuevos al responsable según el tipo', effort: 'medio', impact: 'alto', type: 'tarea' });
    if (d.projects.some(p => !p.owner_name)) recs.push({ title: 'Alerta de proyectos sin responsable', description: 'Notificación inmediata cuando un proyecto activo queda sin responsable', effort: 'bajo', impact: 'medio', type: 'alerta' });
    recs.push({ title: 'Informe operativo semanal automático', description: 'Generar y enviar el resumen operativo cada lunes a la dirección', effort: 'bajo', impact: 'alto', type: 'informe' });
    recs.push({ title: 'Escalado automático de tareas críticas vencidas', description: 'Si una tarea crítica lleva más de 24h vencida, escalar a dirección', effort: 'medio', impact: 'alto', type: 'alerta' });
    if (d.risks.filter(r => r.review_date).length > 0) recs.push({ title: 'Recordatorio de revisión de riesgos', description: 'Notificar al responsable del riesgo 7 días antes de la fecha de revisión', effort: 'bajo', impact: 'medio', type: 'alerta' });
    setAutomations(recs);
  };

  const generateImprovements = (d) => {
    const impr = [];
    if (d.overdue.length > 0) impr.push({ id: '1', title: 'Reducir tareas vencidas a 0', description: `Actualmente ${d.overdue.length} tareas vencidas. Revisar capacidad y redistribuir.`, area: 'tareas', priority: 'alta', status: 'pending' });
    if (d.criticalRisks.length > 0) impr.push({ id: '2', title: 'Plan de mitigación para riesgos críticos', description: `${d.criticalRisks.length} riesgos sin mitigar. Asignar responsable y fecha límite.`, area: 'riesgos', priority: 'alta', status: 'pending' });
    if (d.processes.length < 3) impr.push({ id: '3', title: 'Documentar procesos clave del negocio', description: 'Menos de 3 procesos documentados. Empieza por el cierre mensual y alta de cliente.', area: 'procesos', priority: 'media', status: 'pending' });
    if (d.blocked.length > 0) impr.push({ id: '4', title: 'Desbloquear tareas estancadas', description: `${d.blocked.length} tareas bloqueadas generan fricción. Revisar dependencias.`, area: 'tareas', priority: 'alta', status: 'pending' });
    if (d.highRiskProjects.length > 0) impr.push({ id: '5', title: 'Revisión semanal de proyectos en riesgo', description: `${d.highRiskProjects.length} proyectos en riesgo alto. Implementar check-in semanal.`, area: 'proyectos', priority: 'media', status: 'pending' });
    impr.push({ id: '6', title: 'Establecer OKRs operativos trimestrales', description: 'Definir objetivos medibles por departamento para el próximo trimestre.', area: 'general', priority: 'media', status: 'pending' });
    impr.push({ id: '7', title: 'Crear plantillas para los 5 procesos más repetitivos', description: 'Ahorrar tiempo estandarizando los procesos que se ejecutan más de 2 veces al mes.', area: 'procesos', priority: 'baja', status: 'pending' });
    setImprovements(impr);
  };

  const toggleImprovement = (id) => {
    setImprovements(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'done' ? 'pending' : 'done' } : i));
  };

  const runDirectorBriefing = async () => {
    if (!data) return;
    setGenerating(p => ({ ...p, director: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Operaciones de "${company.nombre || 'la empresa'}". Genera un briefing ejecutivo del estado operativo actual. Sé directo, analítico y accionable.\n\nDatos:\n- Health Score: ${healthScore}/100\n- Tareas vencidas: ${data.overdue.length}\n- Tareas críticas: ${data.critical.length}\n- Tareas bloqueadas: ${data.blocked.length}\n- Tareas con impacto fiscal/contable: ${data.withImpact.length}\n- Proyectos activos: ${data.activeProjects.length} (${data.highRiskProjects.length} en riesgo alto)\n- Tickets abiertos: ${data.openTickets.length}\n- Riesgos activos: ${data.activeRisks.length} (${data.criticalRisks.length} críticos)\n- Procesos documentados: ${data.processes.length}\n- Roadmap items: ${data.roadmap.length}\n\nEstructura del briefing:\n🎯 SITUACIÓN GENERAL (2 frases)\n⚠️ ALERTAS CRÍTICAS (lista de máximo 3)\n📊 ANÁLISIS DE CAPACIDAD (2-3 frases)\n💡 DECISIONES REQUERIDAS HOY (lista de 3-4 acciones concretas)\n🔮 PREVISIÓN PRÓXIMOS 7 DÍAS (2 frases)\n\nTono: CEO-level, sin florituras, máxima densidad informativa.`,
      model: 'claude_sonnet_4_6',
    });
    setDirectorBriefing(typeof res === 'string' ? res : res?.response || '');
    setGenerating(p => ({ ...p, director: false }));
  };

  const runAudit = async () => {
    if (!data) return;
    setGenerating(p => ({ ...p, audit: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Realiza una auditoría operativa automática de "${company.nombre || 'la empresa'}". Actúa como auditor senior de operaciones.\n\nDatos actuales:\n- ${data.tasks.length} tareas totales (${data.overdue.length} vencidas, ${data.blocked.length} bloqueadas)\n- ${data.projects.length} proyectos (${data.activeProjects.length} activos)\n- ${data.processes.length} procesos documentados\n- ${data.risks.length} riesgos registrados (${data.criticalRisks.length} críticos)\n- ${data.tickets.length} tickets (${data.openTickets.length} abiertos)\n\nEmite un informe de auditoría con:\n1. PUNTUACIÓN POR ÁREA (Gestión de tareas /10, Proyectos /10, Procesos /10, Riesgos /10, Incidencias /10)\n2. HALLAZGOS CRÍTICOS\n3. HALLAZGOS MODERADOS  \n4. BUENAS PRÁCTICAS DETECTADAS\n5. PLAN DE ACCIÓN CORRECTIVO (5-7 acciones con plazo)\n6. DICTAMEN FINAL\n\nTono: formal, riguroso, estilo Big Four.`,
      model: 'claude_sonnet_4_6',
    });
    setAuditResult(typeof res === 'string' ? res : res?.response || '');
    setGenerating(p => ({ ...p, audit: false }));
  };

  const runPremiumReport = async () => {
    if (!data) return;
    setGenerating(p => ({ ...p, report: true }));
    const margin = data.activeProjects.reduce((sum, p) => sum + (p.revenue || 0) - (p.actual_cost || 0), 0);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un informe operativo ejecutivo premium estilo McKinsey / Big Four para "${company.nombre || 'la empresa'}".\n\nDatos operativos:\n- Health Score: ${healthScore}/100\n- Tareas: ${data.tasks.length} totales, ${data.overdue.length} vencidas, ${data.critical.length} críticas\n- Proyectos: ${data.activeProjects.length} activos, ${data.highRiskProjects.length} en riesgo\n- Margen operativo proyectos: ${margin > 0 ? '+' : ''}${margin.toLocaleString('es-ES')}€\n- Riesgos: ${data.criticalRisks.length} críticos activos\n- Procesos: ${data.processes.length} documentados\n- Eficiencia general: ${Math.round((data.tasks.filter(t=>t.status==='finalizado').length / Math.max(data.tasks.length,1))*100)}% tareas completadas\n\nEstructura del informe:\n\n# INFORME OPERATIVO EJECUTIVO\n## Executive Summary\n## 1. Situación Operativa Actual\n## 2. Análisis de Rendimiento\n## 3. Gestión de Riesgos\n## 4. Eficiencia de Procesos\n## 5. Análisis de Capacidad y Recursos\n## 6. Rentabilidad Operativa\n## 7. Recomendaciones Estratégicas\n## 8. Plan de Acción 90 días\n## 9. KPIs de Seguimiento\n\nTono: consultoría senior, denso, con datos, benchmarks implícitos y recomendaciones de alto impacto.`,
      model: 'claude_sonnet_4_6',
    });
    setPremiumReport(typeof res === 'string' ? res : res?.response || '');
    setGenerating(p => ({ ...p, report: false }));
  };

  if (!company) return <NoCompanyState pageName="IA Director de Operaciones" />;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <Brain className="absolute inset-0 m-auto w-7 h-7 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">Analizando operaciones con IA...</p>
    </div>
  );

  const scoreColor = healthScore >= 75 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = healthScore >= 75 ? 'from-emerald-50 to-emerald-100/50' : healthScore >= 50 ? 'from-amber-50 to-amber-100/50' : 'from-red-50 to-red-100/50';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Bot className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-bold font-jakarta">IA Director de Operaciones</h1>
            <p className="text-xs text-white/60">Fase 3 · Innovación fuerte · Motor de inteligencia operativa</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={cn('px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold', scoreColor.replace('text-','text-'))}>
              <span className="text-white/60 mr-1">Health:</span>
              <span className={healthScore >= 75 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-red-400'}>{healthScore}/100</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadData} className="border-white/20 text-white hover:bg-white/10 h-8">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-0 border-b border-border bg-card">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all', tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── IA DIRECTOR ── */}
        {tab === 'director' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold text-lg">Briefing ejecutivo del Director de Operaciones</h2><p className="text-sm text-muted-foreground">Análisis en tiempo real + recomendaciones de IA de alto nivel</p></div>
              <Button onClick={runDirectorBriefing} disabled={generating.director} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
                {generating.director ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Generar briefing
              </Button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Health Score', value: `${healthScore}/100`, color: healthScore >= 75 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : healthScore >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700', icon: Activity },
                { label: 'Alertas activas', value: data.overdue.length + data.critical.length + data.blocked.length, color: 'border-red-200 bg-red-50 text-red-700', icon: AlertTriangle },
                { label: 'Proyectos en riesgo', value: data.highRiskProjects.length, color: data.highRiskProjects.length > 0 ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Shield },
                { label: 'Impacto Taxea', value: data.withImpact.length, color: data.withImpact.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Zap },
              ].map(s => (
                <div key={s.label} className={cn('border rounded-xl p-4', s.color)}>
                  <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p><s.icon className="w-4 h-4 opacity-50" /></div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            {directorBriefing ? (
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <p className="font-semibold text-sm text-white/80">Director de Operaciones — IA</p>
                  <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">claude sonnet</span>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-white/90">{directorBriefing}</div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl p-8 text-center text-white/40 border-2 border-dashed border-white/10">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">El Director de Operaciones espera tu solicitud</p>
                <p className="text-sm mt-1 opacity-60">Haz clic en "Generar briefing" para activar el análisis de IA</p>
              </div>
            )}
          </div>
        )}

        {/* ── HEALTH SCORE ── */}
        {tab === 'health' && healthScore !== null && (
          <div className="space-y-6">
            <h2 className="font-bold text-lg">Operation Health Score</h2>
            <div className={cn('rounded-2xl p-8 bg-gradient-to-br', scoreBg, 'border border-border')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col items-center">
                  <HealthGauge score={healthScore} />
                  <p className="text-xs text-muted-foreground mt-3 text-center">Puntuación calculada en tiempo real<br />basada en {data.tasks.length} tareas · {data.projects.length} proyectos · {data.risks.length} riesgos</p>
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-sm mb-3">Factores del Health Score</p>
                  {[
                    { label: 'Tareas vencidas', penalty: data.overdue.length * 4, max: 25, count: data.overdue.length, unit: 'vencidas', bad: true },
                    { label: 'Tareas bloqueadas', penalty: data.blocked.length * 3, max: 15, count: data.blocked.length, unit: 'bloqueadas', bad: true },
                    { label: 'Riesgos críticos', penalty: data.criticalRisks.length * 4, max: 20, count: data.criticalRisks.length, unit: 'críticos', bad: true },
                    { label: 'Proyectos en riesgo', penalty: data.highRiskProjects.length * 3, max: 15, count: data.highRiskProjects.length, unit: 'en riesgo', bad: true },
                    { label: 'Procesos documentados', penalty: -data.processes.length, max: -5, count: data.processes.length, unit: 'procesos', bad: false },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', f.bad && f.count > 0 ? 'bg-red-500' : 'bg-emerald-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1"><span>{f.label}</span><span className={cn('font-semibold', f.bad ? 'text-red-600' : 'text-emerald-600')}>{f.count} {f.unit} · {f.bad ? '-' : '+'}{Math.min(Math.abs(f.penalty), Math.abs(f.max))}pts</span></div>
                        <div className="h-1.5 bg-secondary rounded-full"><div className={cn('h-full rounded-full', f.bad ? 'bg-red-400' : 'bg-emerald-400')} style={{ width: `${Math.min((Math.abs(f.penalty) / Math.abs(f.max)) * 100, 100)}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Histórico simulado */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-semibold mb-4">Tendencia de Health Score (simulada)</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={[
                  { mes: 'Ene', score: Math.max(0, healthScore - 20) },
                  { mes: 'Feb', score: Math.max(0, healthScore - 15) },
                  { mes: 'Mar', score: Math.max(0, healthScore - 8) },
                  { mes: 'Abr', score: Math.max(0, healthScore - 12) },
                  { mes: 'May', score: healthScore },
                ]}>
                  <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}/100`, 'Health Score']} />
                  <Area type="monotone" dataKey="score" stroke="#6366f1" fill="url(#scoreGrad)" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── RADAR DE CAOS ── */}
        {tab === 'chaos' && chaosData && (
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-lg">Radar de Caos Operativo</h2>
              <p className="text-sm text-muted-foreground">Puntuación de estabilidad por dimensión (10 = perfecto, 0 = caótico)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={chaosData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Radar name="Estabilidad" dataKey="valor" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                  </RadarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center">Áreas más cercanas al centro = mayor caos</p>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-sm">Análisis por dimensión</p>
                {chaosData.map(d => {
                  const pct = (d.valor / 10) * 100;
                  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  const label = pct >= 70 ? 'Estable' : pct >= 40 ? 'Atención' : 'Caótico';
                  return (
                    <div key={d.subject} className="flex items-center gap-3">
                      <span className="text-sm w-28 flex-shrink-0">{d.subject}</span>
                      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden"><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} /></div>
                      <span className="text-xs font-bold w-8">{d.valor}/10</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{label}</span>
                    </div>
                  );
                })}
                <div className="mt-4 p-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">¿Qué es el Radar de Caos?</p>
                  Mide el nivel de estabilidad operativa en 6 dimensiones clave. Un área cercana al centro indica alto nivel de desorden en esa dimensión, requiriendo atención inmediata.
                </div>
              </div>
            </div>

            {/* Caos breakdown chart */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-semibold mb-4">Distribución del impacto del caos</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chaosData} layout="vertical">
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [`${v}/10`, 'Estabilidad']} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {chaosData.map((entry, i) => (
                      <Cell key={i} fill={entry.valor >= 7 ? '#10b981' : entry.valor >= 4 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── TAREAS TÓXICAS ── */}
        {tab === 'toxic' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />Detector de Tareas Tóxicas</h2>
              <p className="text-sm text-muted-foreground">Tareas que bloquean, dañan o generan riesgo para el negocio</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[['Alta toxicidad', toxicTasks.filter(t=>t.severity==='alta').length, 'border-red-200 bg-red-50 text-red-700'],['Toxicidad media', toxicTasks.filter(t=>t.severity==='media').length, 'border-orange-200 bg-orange-50 text-orange-700'],['Total detectadas', toxicTasks.length, 'border-amber-200 bg-amber-50 text-amber-700']].map(([l,v,c])=>(
                <div key={l} className={cn('border rounded-xl p-3 text-center', c)}><p className="text-2xl font-bold">{v}</p><p className="text-xs font-medium">{l}</p></div>
              ))}
            </div>

            {toxicTasks.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-emerald-800">Sin tareas tóxicas detectadas</p>
                <p className="text-sm text-emerald-600 mt-1">El estado actual de las tareas es saludable</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alta toxicidad</p>
                {toxicTasks.filter(t => t.severity === 'alta').map((t, i) => <ToxicCard key={i} {...t} />)}
                {toxicTasks.filter(t => t.severity === 'media').length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Toxicidad media</p>
                    {toxicTasks.filter(t => t.severity === 'media').map((t, i) => <ToxicCard key={i} {...t} />)}
                  </>
                )}
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Criterios de detección de toxicidad:</p>
              <p>• <strong>Vencida:</strong> fecha límite pasada y sin completar</p>
              <p>• <strong>Bloqueada:</strong> estado "bloqueado" activo (genera dependencias en cadena)</p>
              <p>• <strong>Sin responsable crítica:</strong> tarea de prioridad crítica sin asignación</p>
              <p>• <strong>Impacto fiscal sin fecha:</strong> tarea con impacto fiscal sin deadline definido</p>
              <p>• <strong>Alta prioridad sin fecha:</strong> tarea de alta prioridad sin fecha de entrega</p>
            </div>
          </div>
        )}

        {/* ── AUDITORÍA ── */}
        {tab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold text-lg">Auditoría Operativa Automática</h2><p className="text-sm text-muted-foreground">Análisis independiente del estado de las operaciones</p></div>
              <Button onClick={runAudit} disabled={generating.audit} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
                {generating.audit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}Ejecutar auditoría
              </Button>
            </div>

            {!auditResult ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <Eye className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                <p className="font-semibold text-slate-700 text-lg">Auditoría no ejecutada</p>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">La auditoría analizará el 100% de tus datos operativos y emitirá un dictamen con hallazgos y plan correctivo</p>
                <Button onClick={runAudit} disabled={generating.audit} className="mt-6 bg-slate-900 text-white gap-2">
                  {generating.audit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}Iniciar auditoría
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-white/60" />
                  <p className="font-semibold text-white text-sm">Informe de Auditoría Operativa</p>
                  <span className="ml-auto text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">Generado por IA · {new Date().toLocaleDateString('es-ES')}</span>
                </div>
                <div className="p-6 text-sm leading-relaxed whitespace-pre-wrap">{auditResult}</div>
              </div>
            )}
          </div>
        )}

        {/* ── AUTOMATIZACIONES ── */}
        {tab === 'automation' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />Recomendaciones de automatización</h2>
              <p className="text-sm text-muted-foreground">Automatizaciones propuestas basadas en tu actividad operativa real</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((a, i) => <AutoCard key={i} {...a} />)}
            </div>
            <div className="bg-accent border border-border rounded-xl p-4 flex gap-3">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">¿Cómo implementar estas automatizaciones?</p>
                <p className="text-muted-foreground">Las automatizaciones de Taxea se configuran desde el panel de automatizaciones de la plataforma. Cada recomendación puede implementarse con 0 código mediante triggers basados en entidades (creación, actualización, fecha).</p>
              </div>
            </div>
          </div>
        )}

        {/* ── MEJORA CONTINUA ── */}
        {tab === 'improvement' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Centro de Mejora Continua</h2>
              <p className="text-sm text-muted-foreground">Acciones de mejora generadas por IA basadas en tu estado operativo actual</p>
            </div>

            <div className="flex gap-3">
              {[
                ['Completadas', improvements.filter(i=>i.status==='done').length, 'text-emerald-600'],
                ['Pendientes', improvements.filter(i=>i.status!=='done').length, 'text-amber-600'],
                ['Total', improvements.length, 'text-primary'],
              ].map(([l,v,c])=>(
                <div key={l} className="bg-card border border-border rounded-xl px-4 py-3 flex-1 text-center">
                  <p className={cn('text-xl font-bold', c)}>{v}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {['alta','media','baja'].map(priority => {
                const group = improvements.filter(i => i.priority === priority);
                if (!group.length) return null;
                return (
                  <div key={priority}>
                    <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', priority==='alta'?'text-red-600':priority==='media'?'text-amber-600':'text-slate-500')}>
                      Prioridad {priority}
                    </p>
                    <div className="space-y-2 mb-4">
                      {group.map(item => <ImprovementCard key={item.id} {...item} onDone={() => toggleImprovement(item.id)} />)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-accent border border-border rounded-xl p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Metodología de mejora continua</p>
              Las mejoras se regeneran automáticamente cada vez que cargas la sección, basándose en tu estado operativo real. Márcalas como completadas para llevar un registro de progreso.
            </div>
          </div>
        )}

        {/* ── INFORME PREMIUM ── */}
        {tab === 'report' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" />Informe Premium estilo Big Four</h2>
                <p className="text-sm text-muted-foreground">Informe ejecutivo de nivel consultoría · McKinsey · Big Four</p>
              </div>
              <Button onClick={runPremiumReport} disabled={generating.report} className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 border-0">
                {generating.report ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}Generar informe premium
              </Button>
            </div>

            {!premiumReport ? (
              <div className="relative rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-10 text-center">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0, #f59e0b 1px, transparent 0, transparent 50%)' , backgroundSize: '10px 10px'}} />
                <Award className="w-16 h-16 mx-auto mb-4 text-amber-400" />
                <p className="font-bold text-xl text-amber-900">Informe Operativo Ejecutivo Premium</p>
                <p className="text-sm text-amber-700 mt-2 max-w-md mx-auto">Análisis profundo con metodología Big Four. Incluye Executive Summary, análisis por área, riesgos, rentabilidad, recomendaciones estratégicas y plan de acción 90 días.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4 text-xs">
                  {['Executive Summary', 'Análisis de rendimiento', 'Gestión de riesgos', 'Eficiencia de procesos', 'Rentabilidad operativa', 'Plan 90 días'].map(l => (
                    <span key={l} className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{l}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center gap-3">
                  <Award className="w-6 h-6 text-white" />
                  <div>
                    <p className="font-bold text-white">Informe Operativo Ejecutivo</p>
                    <p className="text-xs text-white/70">{company.nombre || 'Empresa'} · {new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' })} · Generado con IA</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">CONFIDENCIAL</span>
                  </div>
                </div>
                <div className="p-8">
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">{premiumReport}</div>
                </div>
                <div className="px-8 py-4 border-t border-border bg-secondary/30 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Generado por Taxea Portal · IA Director de Operaciones</span>
                  <span>Health Score: {healthScore}/100</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}