import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Clock, CheckSquare, Sparkles, Loader2, Calendar, Ticket, Shield, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const TABS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

const PRIORITY_DOT = { critica: 'bg-red-500', alta: 'bg-orange-400', media: 'bg-amber-400', baja: 'bg-slate-300' };
const STATUS_CHIP = { backlog: 'bg-slate-100 text-slate-600', en_curso: 'bg-blue-100 text-blue-700', bloqueado: 'bg-red-100 text-red-700', finalizado: 'bg-emerald-100 text-emerald-700', pendiente_revisar: 'bg-amber-100 text-amber-700' };

function TaskRow({ task, navigate }) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'finalizado';
  const hasImpact = task.impact_fiscal || task.impact_accounting || task.impact_financial || task.impact_legal;
  return (
    <div onClick={() => navigate('/operations/tasks')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 cursor-pointer border-b border-border last:border-0">
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority] || 'bg-slate-300')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">{task.assignee_name || 'Sin asignar'} · {task.due_date || 'Sin fecha'}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {hasImpact && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">⚡</span>}
        {isOverdue && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Vencida</span>}
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_CHIP[task.status] || 'bg-slate-100 text-slate-600')}>{task.status?.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, count, color, children, onNavigate }) {
  const colorMap = { red: 'text-red-600 bg-red-50 border-red-100', amber: 'text-amber-600 bg-amber-50 border-amber-100', blue: 'text-blue-600 bg-blue-50 border-blue-100', default: 'text-primary bg-accent border-border' };
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={cn('flex items-center justify-between px-4 py-3 border-b', colorMap[color] || colorMap.default)}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-semibold">{title}</span>
          {count !== undefined && <span className="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded-full">{count}</span>}
        </div>
        {onNavigate && <button onClick={onNavigate} className="text-xs hover:underline opacity-70">Ver todo →</button>}
      </div>
      {children}
    </div>
  );
}

export default function OperationsFocusView() {
  const { company } = useOutletContext() || {};
  const navigate = useNavigate();
  const [tab, setTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [risks, setRisks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [aiRec, setAiRec] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [t, tk, r, p] = await Promise.all([
      base44.entities.OpsTask.filter({ company_id: company.id }, '-due_date', 300),
      base44.entities.OpsTicket.filter({ company_id: company.id }, '-created_date', 50),
      base44.entities.OpsRisk.filter({ company_id: company.id }),
      base44.entities.OpsProject.filter({ company_id: company.id }),
    ]);
    setTasks(t || []);
    setTickets(tk || []);
    setRisks(r || []);
    setProjects(p || []);
    setLoading(false);
  };

  const getAiRec = async () => {
    setLoadingAi(true);
    const today = new Date().toISOString().split('T')[0];
    const overdue = tasks.filter(t => t.due_date && t.due_date < today && !['finalizado','archivado'].includes(t.status));
    const critical = tasks.filter(t => t.priority === 'critica' && !['finalizado','archivado'].includes(t.status));
    const openTickets = tickets.filter(t => !['resuelto','cerrado','archivado'].includes(t.status));
    const highRisks = risks.filter(r => ['alto','critico'].includes(r.severity) && r.status !== 'cerrado');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Operaciones. Fecha: ${today}. Resumen del ${tab === 'today' ? 'día' : tab === 'week' ? 'semana' : 'mes'}: ${overdue.length} tareas vencidas, ${critical.length} críticas, ${openTickets.length} tickets abiertos, ${highRisks.length} riesgos altos. Proyectos activos: ${projects.filter(p => p.status === 'activo').length}. Da una recomendación operativa concreta en 2-3 frases, directa y accionable.`,
    });
    setAiRec(typeof res === 'string' ? res : res?.response || '');
    setLoadingAi(false);
  };

  if (!company) return <NoCompanyState pageName="Vista de enfoque" />;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const active = (t) => !['finalizado','archivado'].includes(t.status);

  const todayTasks = tasks.filter(t => active(t) && (t.due_date === today || t.priority === 'critica' || t.status === 'bloqueado'));
  const weekTasks = tasks.filter(t => active(t) && t.due_date && t.due_date <= weekEndStr);
  const monthTasks = tasks.filter(t => active(t));

  const overdueToday = tasks.filter(t => active(t) && t.due_date && t.due_date < today);
  const openTickets = tickets.filter(t => !['resuelto','cerrado','archivado'].includes(t.status));
  const criticalRisks = risks.filter(r => ['alto','critico'].includes(r.severity) && r.status !== 'cerrado');
  const activeProjects = projects.filter(p => p.status === 'activo');

  const displayTasks = tab === 'today' ? todayTasks : tab === 'week' ? weekTasks : monthTasks;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Vista de enfoque operativo</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={getAiRec} disabled={loadingAi} className="gap-1.5">
            {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}IA
          </Button>
        </div>
      </div>

      {aiRec && (
        <div className="bg-accent border border-border rounded-xl p-4 flex gap-3">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm">{aiRec}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-border rounded-xl overflow-hidden w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-4 py-2 text-sm font-medium transition-colors', tab === t.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Tareas del período */}
          <Section icon={CheckSquare} title={tab === 'today' ? 'Tareas urgentes / hoy' : tab === 'week' ? 'Tareas esta semana' : 'Todas las tareas activas'} count={displayTasks.length} color={overdueToday.length > 0 ? 'red' : 'blue'} onNavigate={() => navigate('/operations/tasks')}>
            {displayTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Sin tareas pendientes</div>
            ) : displayTasks.slice(0, 8).map(t => <TaskRow key={t.id} task={t} navigate={navigate} />)}
          </Section>

          {/* Tareas vencidas */}
          {tab === 'today' && (
            <Section icon={AlertTriangle} title="Vencidas sin resolver" count={overdueToday.length} color={overdueToday.length > 0 ? 'red' : 'default'} onNavigate={() => navigate('/operations/tasks')}>
              {overdueToday.length === 0 ? (
                <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Sin vencidas</div>
              ) : overdueToday.slice(0, 8).map(t => <TaskRow key={t.id} task={t} navigate={navigate} />)}
            </Section>
          )}

          {/* Tickets abiertos */}
          <Section icon={Ticket} title="Tickets abiertos" count={openTickets.length} color={openTickets.length > 3 ? 'amber' : 'default'} onNavigate={() => navigate('/operations/tickets')}>
            {openTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Sin tickets abiertos</div>
            ) : (
              <div className="divide-y divide-border">
                {openTickets.slice(0, 5).map(tk => (
                  <div key={tk.id} onClick={() => navigate('/operations/tickets')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 cursor-pointer">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[tk.priority] || 'bg-slate-300')} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{tk.title}</p><p className="text-xs text-muted-foreground">{tk.type} · {tk.reporter_name || '—'}</p></div>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium">{tk.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Riesgos */}
          <Section icon={Shield} title="Riesgos activos" count={criticalRisks.length} color={criticalRisks.length > 0 ? 'red' : 'default'} onNavigate={() => navigate('/operations/risks')}>
            {criticalRisks.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Sin riesgos críticos</div>
            ) : (
              <div className="divide-y divide-border">
                {criticalRisks.slice(0, 5).map(r => (
                  <div key={r.id} onClick={() => navigate('/operations/risks')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 cursor-pointer">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', r.severity === 'critico' ? 'bg-red-500' : 'bg-orange-400')} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{r.title}</p><p className="text-xs text-muted-foreground">{r.category} · {r.probability} prob.</p></div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', r.severity === 'critico' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>{r.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Proyectos activos */}
          {tab !== 'today' && (
            <Section icon={Calendar} title="Proyectos activos" count={activeProjects.length} color="blue" onNavigate={() => navigate('/operations/projects')}>
              {activeProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sin proyectos activos</div>
              ) : (
                <div className="divide-y divide-border">
                  {activeProjects.slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', ['alto','critico'].includes(p.risk_level) ? 'bg-red-500' : p.risk_level === 'medio' ? 'bg-amber-400' : 'bg-emerald-400')} />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-muted-foreground">{p.owner_name || '—'} · vence {p.end_date || '—'}</p></div>
                      <div className="text-right flex-shrink-0"><p className="text-xs font-bold">{p.progress || 0}%</p></div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}