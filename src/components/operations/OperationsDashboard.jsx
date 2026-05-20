import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckSquare, AlertTriangle, Clock, TrendingUp, Folder, Loader2, Sparkles, RefreshCw, Plus, CalendarClock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const PRIORITY_COLOR = { critica: 'text-red-600 bg-red-50 border-red-200', alta: 'text-orange-600 bg-orange-50 border-orange-200', media: 'text-amber-600 bg-amber-50 border-amber-200', baja: 'text-slate-600 bg-slate-50 border-slate-200' };
const STATUS_COLOR = { backlog: 'bg-slate-100 text-slate-600', pendiente_revisar: 'bg-amber-100 text-amber-700', en_curso: 'bg-blue-100 text-blue-700', bloqueado: 'bg-red-100 text-red-700', pendiente_cliente: 'bg-purple-100 text-purple-700', finalizado: 'bg-emerald-100 text-emerald-700', archivado: 'bg-slate-100 text-slate-400' };

function KpiCard({ title, value, sub, color = 'default', icon: Icon, onClick }) {
  const colors = { green: 'border-emerald-200 bg-emerald-50', amber: 'border-amber-200 bg-amber-50', red: 'border-red-200 bg-red-50', default: 'border-border bg-card' };
  const iconCol = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', default: 'text-primary' };
  return (
    <div onClick={onClick} className={cn('border rounded-xl p-4 transition-all', colors[color], onClick && 'cursor-pointer hover:shadow-md')}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
        {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', iconCol[color])} />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function OperationsDashboard() {
  const { company, user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRec, setAiRec] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [t, p] = await Promise.all([
      base44.entities.OpsTask.filter({ company_id: company.id }, '-created_date', 200),
      base44.entities.OpsProject.filter({ company_id: company.id }),
    ]);
    setTasks(t || []);
    setProjects(p || []);
    setLoading(false);
  };

  const getAiRec = async () => {
    setLoadingAi(true);
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'finalizado' && t.status !== 'archivado');
    const critical = tasks.filter(t => t.priority === 'critica' && t.status !== 'finalizado');
    const blocked = tasks.filter(t => t.status === 'bloqueado');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Operaciones de una pyme. Tienes: ${overdue.length} tareas vencidas, ${critical.length} tareas críticas, ${blocked.length} tareas bloqueadas, ${projects.filter(p => p.status === 'activo').length} proyectos activos. Da una recomendación operativa del día en 2-3 frases, directa y accionable. Sin eufemismos.`,
    });
    setAiRec(typeof res === 'string' ? res : res?.response || 'Sin recomendación disponible.');
    setLoadingAi(false);
  };

  if (!company) return <NoCompanyState pageName="Operaciones" />;

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && !['finalizado', 'archivado'].includes(t.status));
  const dueToday = tasks.filter(t => t.due_date === today && !['finalizado', 'archivado'].includes(t.status));
  const critical = tasks.filter(t => t.priority === 'critica' && !['finalizado', 'archivado'].includes(t.status));
  const blocked = tasks.filter(t => t.status === 'bloqueado');
  const inProgress = tasks.filter(t => t.status === 'en_curso');
  const activeProjects = projects.filter(p => p.status === 'activo');
  const highRiskProjects = projects.filter(p => ['alto', 'critico'].includes(p.risk_level) && p.status === 'activo');
  const withImpact = tasks.filter(t => (t.impact_fiscal || t.impact_accounting || t.impact_financial || t.impact_legal) && !['finalizado', 'archivado'].includes(t.status));

  const healthColor = overdue.length > 3 || blocked.length > 2 ? 'red' : overdue.length > 0 || blocked.length > 0 ? 'amber' : 'green';
  const healthLabel = healthColor === 'green' ? 'Operaciones bajo control' : healthColor === 'amber' ? 'Retrasos detectados' : 'Atención requerida';

  const QUICK_ACTIONS = [
    { label: 'Nueva tarea', icon: Plus, path: '/operations/tasks' },
    { label: 'Mis tareas', icon: CheckSquare, path: '/operations/tasks' },
    { label: 'Proyectos', icon: Folder, path: '/operations/projects' },
    { label: 'Roadmap', icon: TrendingUp, path: '/operations/roadmap' },
    { label: 'Procesos', icon: Zap, path: '/operations/processes' },
    { label: 'Informes', icon: CalendarClock, path: '/operations/reports' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Dashboard Operativo</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} tareas · {activeProjects.length} proyectos activos</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Health */}
      <div className={cn('border rounded-xl p-4 flex items-center gap-3', healthColor === 'green' ? 'border-emerald-200 bg-emerald-50' : healthColor === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50')}>
        <div className={cn('w-3 h-3 rounded-full flex-shrink-0', healthColor === 'green' ? 'bg-emerald-500' : healthColor === 'amber' ? 'bg-amber-500' : 'bg-red-500')} />
        <div className="flex-1">
          <p className={cn('font-semibold text-sm', healthColor === 'green' ? 'text-emerald-800' : healthColor === 'amber' ? 'text-amber-800' : 'text-red-800')}>{healthLabel}</p>
          {overdue.length > 0 && <p className="text-xs text-muted-foreground">{overdue.length} tareas vencidas · {blocked.length} bloqueadas · {withImpact.length} con impacto fiscal/contable</p>}
        </div>
        <Button size="sm" variant="outline" onClick={getAiRec} disabled={loadingAi} className="gap-1.5">
          {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
          IA
        </Button>
      </div>

      {aiRec && (
        <div className="bg-accent border border-border rounded-xl p-4 flex gap-3">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{aiRec}</p>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {QUICK_ACTIONS.map((a, i) => (
          <button key={i} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border text-xs font-medium hover:bg-secondary transition-colors shadow-sm">
            <a.icon className="w-5 h-5 text-primary" />{a.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Vencidas" value={overdue.length} sub="Sin completar" color={overdue.length > 0 ? 'red' : 'green'} icon={AlertTriangle} onClick={() => navigate('/operations/tasks')} />
            <KpiCard title="Vencen hoy" value={dueToday.length} sub="Fecha límite hoy" color={dueToday.length > 0 ? 'amber' : 'green'} icon={Clock} onClick={() => navigate('/operations/tasks')} />
            <KpiCard title="Críticas" value={critical.length} sub="Prioridad crítica" color={critical.length > 0 ? 'red' : 'green'} icon={AlertTriangle} onClick={() => navigate('/operations/tasks')} />
            <KpiCard title="En curso" value={inProgress.length} sub="En progreso" color="default" icon={CheckSquare} onClick={() => navigate('/operations/tasks')} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Bloqueadas" value={blocked.length} sub="Requieren acción" color={blocked.length > 0 ? 'red' : 'green'} icon={AlertTriangle} />
            <KpiCard title="Proyectos activos" value={activeProjects.length} sub={`${highRiskProjects.length} en riesgo alto`} color={highRiskProjects.length > 0 ? 'amber' : 'default'} icon={Folder} onClick={() => navigate('/operations/projects')} />
            <KpiCard title="Impacto fiscal/cont." value={withImpact.length} sub="Tareas con impacto" color={withImpact.length > 0 ? 'amber' : 'green'} icon={TrendingUp} />
            <KpiCard title="Total backlog" value={tasks.filter(t => t.status === 'backlog').length} sub="Sin asignar" color="default" icon={CheckSquare} onClick={() => navigate('/operations/tasks')} />
          </div>

          {/* Urgentes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Tareas urgentes / vencidas</p>
                <button onClick={() => navigate('/operations/tasks')} className="text-xs text-primary hover:underline">Ver todas</button>
              </div>
              {overdue.length === 0 && dueToday.length === 0 && critical.length === 0 ? (
                <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Sin tareas urgentes</div>
              ) : (
                <div className="divide-y divide-border">
                  {[...overdue, ...dueToday, ...critical].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 6).map(t => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border flex-shrink-0', PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.media)}>{t.priority}</span>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.title}</p><p className="text-xs text-muted-foreground">{t.due_date || 'Sin fecha'} · {t.assignee_name || 'Sin asignar'}</p></div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLOR[t.status] || 'bg-slate-100 text-slate-600')}>{t.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Proyectos activos</p>
                <button onClick={() => navigate('/operations/projects')} className="text-xs text-primary hover:underline">Ver todos</button>
              </div>
              {activeProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sin proyectos activos</div>
              ) : (
                <div className="divide-y divide-border">
                  {activeProjects.slice(0, 6).map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', p.risk_level === 'critico' || p.risk_level === 'alto' ? 'bg-red-500' : p.risk_level === 'medio' ? 'bg-amber-500' : 'bg-emerald-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.owner_name || 'Sin responsable'} · {p.end_date || 'Sin fecha'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold">{p.progress || 0}%</p>
                        <div className="w-12 h-1 bg-secondary rounded-full mt-1"><div className="h-full bg-primary rounded-full" style={{ width: `${p.progress || 0}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}