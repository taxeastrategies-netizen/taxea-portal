import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PRIORITY_BG = { critica: 'bg-red-500', alta: 'bg-orange-400', media: 'bg-blue-500', baja: 'bg-slate-400' };
const TYPE_BG = { task: 'bg-blue-500', ticket: 'bg-amber-500', risk: 'bg-red-500', project: 'bg-emerald-500' };

export default function OperationsCalendar() {
  const { company } = useOutletContext() || {};
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [tasks, tickets, risks, projects] = await Promise.all([
      base44.entities.OpsTask.filter({ company_id: company.id }),
      base44.entities.OpsTicket.filter({ company_id: company.id }),
      base44.entities.OpsRisk.filter({ company_id: company.id }),
      base44.entities.OpsProject.filter({ company_id: company.id }),
    ]);
    const allEvents = [
      ...(tasks || []).filter(t => t.due_date && !['finalizado','archivado'].includes(t.status)).map(t => ({ id: t.id, date: t.due_date, title: t.title, type: 'task', priority: t.priority, link: '/operations/tasks' })),
      ...(tickets || []).filter(t => t.due_date && !['resuelto','cerrado','archivado'].includes(t.status)).map(t => ({ id: t.id, date: t.due_date, title: t.title, type: 'ticket', priority: t.priority, link: '/operations/tickets' })),
      ...(risks || []).filter(r => r.review_date && r.status !== 'cerrado').map(r => ({ id: r.id, date: r.review_date, title: `Rev: ${r.title}`, type: 'risk', priority: null, link: '/operations/risks' })),
      ...(projects || []).filter(p => p.end_date && p.status === 'activo').map(p => ({ id: p.id, date: p.end_date, title: p.name, type: 'project', priority: null, link: '/operations/projects' })),
    ];
    setEvents(allEvents);
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="Calendario operativo" />;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-based week offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const today = new Date().toISOString().split('T')[0];

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const selectedDateStr = selectedDay ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : null;

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Calendario operativo</h1><p className="text-sm text-muted-foreground">{events.length} eventos · tareas, tickets, revisiones y proyectos</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <p className="font-semibold text-sm">{MONTHS[month]} {year}</p>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
            <div className="p-3">
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dayEvts = getEventsForDay(day);
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === today;
                  const isSelected = day === selectedDay;
                  const hasOverdue = dayEvts.length > 0 && dateStr < today;
                  return (
                    <div key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)} className={cn('min-h-[52px] p-1 rounded-lg cursor-pointer border transition-all', isSelected ? 'border-primary bg-accent' : 'border-transparent hover:bg-secondary/50', isToday && 'ring-2 ring-primary')}>
                      <p className={cn('text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-white' : 'text-foreground')}>{day}</p>
                      <div className="space-y-0.5">
                        {dayEvts.slice(0, 3).map(e => (
                          <div key={e.id} className={cn('text-[9px] px-1 py-0.5 rounded text-white truncate', TYPE_BG[e.type] || 'bg-slate-400')}>{e.title}</div>
                        ))}
                        {dayEvts.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayEvts.length - 3} más</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 pb-3 flex gap-3 flex-wrap">
            {[['task','Tareas'],['ticket','Tickets'],['risk','Revisiones riesgo'],['project','Proyectos']].map(([t,l])=>(
              <div key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className={cn('w-2.5 h-2.5 rounded', TYPE_BG[t])} />{l}</div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">{selectedDay ? `${selectedDay} de ${MONTHS[month]}` : 'Selecciona un día'}</p>
          </div>
          {!selectedDay ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Haz clic en un día para ver los eventos</p>
            </div>
          ) : dayEvents.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin eventos este día</div>
          ) : (
            <div className="divide-y divide-border">
              {dayEvents.map(e => (
                <div key={e.id} onClick={() => navigate(e.link)} className="px-4 py-3 hover:bg-secondary/30 cursor-pointer flex items-center gap-3">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', TYPE_BG[e.type] || 'bg-slate-400')} />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.title}</p><p className="text-xs text-muted-foreground capitalize">{e.type === 'task' ? 'Tarea' : e.type === 'ticket' ? 'Ticket' : e.type === 'risk' ? 'Revisión de riesgo' : 'Proyecto'}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}