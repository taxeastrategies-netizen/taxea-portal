import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FileText, Loader2, Sparkles, RefreshCw, TrendingUp, CheckSquare, Folder, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

export default function OperationsReports() {
  const { company, user } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [aiReport, setAiReport] = useState('');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [tasks, projects, processes, roadmap] = await Promise.all([
      base44.entities.OpsTask.filter({ company_id: company.id }),
      base44.entities.OpsProject.filter({ company_id: company.id }),
      base44.entities.OpsProcess.filter({ company_id: company.id }),
      base44.entities.OpsRoadmapItem.filter({ company_id: company.id }),
    ]);
    const today = new Date().toISOString().split('T')[0];
    setData({
      tasks: tasks || [],
      projects: projects || [],
      processes: processes || [],
      roadmap: roadmap || [],
      overdue: (tasks || []).filter(t => t.due_date && t.due_date < today && !['finalizado','archivado'].includes(t.status)),
      critical: (tasks || []).filter(t => t.priority === 'critica' && !['finalizado','archivado'].includes(t.status)),
      blocked: (tasks || []).filter(t => t.status === 'bloqueado'),
      withImpact: (tasks || []).filter(t => t.impact_fiscal || t.impact_accounting || t.impact_financial || t.impact_legal),
      activeProjects: (projects || []).filter(p => p.status === 'activo'),
      highRiskProjects: (projects || []).filter(p => ['alto','critico'].includes(p.risk_level) && p.status === 'activo'),
    });
    setLoading(false);
  };

  const generateReport = async () => {
    if (!data) return;
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un informe operativo ejecutivo para la empresa "${company.nombre || 'la empresa'}". Actúa como Director de Operaciones senior.\n\nDatos actuales:\n- Total tareas: ${data.tasks.length} (${data.overdue.length} vencidas, ${data.critical.length} críticas, ${data.blocked.length} bloqueadas)\n- Tareas con impacto fiscal/contable: ${data.withImpact.length}\n- Proyectos activos: ${data.activeProjects.length} (${data.highRiskProjects.length} en riesgo alto)\n- Procesos definidos: ${data.processes.length}\n- Iniciativas roadmap: ${data.roadmap.length}\n\nEl informe debe incluir:\n1. Situación operativa actual (semáforo: verde/ámbar/rojo)\n2. Alertas críticas\n3. Productividad y rendimiento\n4. Proyectos en riesgo\n5. Tareas con impacto fiscal/contable pendientes\n6. Recomendaciones inmediatas (3-5 acciones)\n7. Recomendaciones estratégicas\n\nTono: ejecutivo, directo, sin florituras.`,
      model: 'claude_sonnet_4_6',
    });
    setAiReport(typeof result === 'string' ? result : result?.response || '');
    toast.success('Informe operativo generado');
    setGenerating(false);
  };

  if (!company) return <NoCompanyState pageName="Informes operativos" />;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const stats = [
    { title: 'Total tareas', value: data.tasks.length, icon: CheckSquare, sub: `${data.tasks.filter(t => t.status === 'finalizado').length} completadas` },
    { title: 'Tareas vencidas', value: data.overdue.length, icon: CheckSquare, color: data.overdue.length > 0 ? 'red' : 'green', sub: 'Sin completar' },
    { title: 'Proyectos activos', value: data.activeProjects.length, icon: Folder, sub: `${data.highRiskProjects.length} en riesgo` },
    { title: 'Procesos definidos', value: data.processes.length, icon: Zap, sub: `${data.processes.filter(p => p.status === 'activo').length} activos` },
    { title: 'Tareas críticas', value: data.critical.length, icon: TrendingUp, color: data.critical.length > 0 ? 'red' : 'green', sub: 'Prioridad crítica' },
    { title: 'Con impacto fiscal', value: data.withImpact.length, icon: FileText, color: data.withImpact.length > 0 ? 'amber' : 'green', sub: 'Requieren atención' },
    { title: 'Roadmap', value: data.roadmap.length, icon: TrendingUp, sub: `${data.roadmap.filter(r => r.status === 'en_desarrollo').length} en desarrollo` },
    { title: 'Bloqueadas', value: data.blocked.length, icon: CheckSquare, color: data.blocked.length > 0 ? 'red' : 'green', sub: 'Requieren desbloqueo' },
  ];

  const COLOR = { green: 'border-emerald-200 bg-emerald-50', amber: 'border-amber-200 bg-amber-50', red: 'border-red-200 bg-red-50', default: 'border-border bg-card' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Informes operativos</h1><p className="text-sm text-muted-foreground">Estado del departamento de operaciones</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={generateReport} disabled={generating} className="bg-primary hover:bg-primary/90 gap-1.5">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generar informe IA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={cn('border rounded-xl p-4', COLOR[s.color] || COLOR.default)}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.title}</p>
            <p className="text-2xl font-bold">{s.value}</p>
            {s.sub && <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Distribución por estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Tareas por estado</p>
          {['backlog','pendiente_revisar','en_curso','bloqueado','en_revision','finalizado'].map(s => {
            const count = data.tasks.filter(t => t.status === s).length;
            const pct = data.tasks.length ? (count / data.tasks.length * 100) : 0;
            const LABELS = { backlog: 'Backlog', pendiente_revisar: 'Por revisar', en_curso: 'En curso', bloqueado: 'Bloqueado', en_revision: 'En revisión', finalizado: 'Finalizado' };
            return (
              <div key={s} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{LABELS[s]}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full"><div className={cn('h-full rounded-full', s === 'finalizado' ? 'bg-emerald-500' : s === 'bloqueado' ? 'bg-red-500' : s === 'en_curso' ? 'bg-blue-500' : 'bg-slate-300')} style={{ width: `${pct}%` }} /></div>
                <span className="text-xs font-semibold w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Proyectos por estado</p>
          {['planificacion','activo','en_pausa','finalizado','cancelado'].map(s => {
            const count = data.projects.filter(p => p.status === s).length;
            const pct = data.projects.length ? (count / data.projects.length * 100) : 0;
            const LABELS = { planificacion: 'Planificación', activo: 'Activo', en_pausa: 'En pausa', finalizado: 'Finalizado', cancelado: 'Cancelado' };
            return (
              <div key={s} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{LABELS[s]}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full"><div className={cn('h-full rounded-full', s === 'finalizado' ? 'bg-emerald-500' : s === 'activo' ? 'bg-blue-500' : s === 'cancelado' ? 'bg-red-400' : 'bg-slate-300')} style={{ width: `${pct}%` }} /></div>
                <span className="text-xs font-semibold w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {aiReport && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">Informe ejecutivo IA</p></div>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiReport}</div>
        </div>
      )}
    </div>
  );
}