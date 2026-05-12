import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Clock, Play, Square, Plus, ChevronRight, Wifi, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TimeAttendance() {
  const ctx = useOutletContext() || {};
  const { company, user } = ctx;
  const companyId = company?.id;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.HRTimeEntry.filter({ company_id: companyId }, '-fecha', 100)
      .then(data => setEntries(data || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayEntries = entries.filter(e => e.fecha === todayStr);
  const totalHoy = todayEntries.reduce((s, e) => s + (e.horas_totales || 0), 0);

  const clockIn = async () => {
    setClocking(true);
    const now = format(new Date(), 'HH:mm');
    await base44.entities.HRTimeEntry.create({
      company_id: companyId,
      employee_id: user?.email || '',
      employee_nombre: user?.full_name || '',
      fecha: todayStr,
      hora_entrada: now,
      tipo: 'presencial',
    });
    const data = await base44.entities.HRTimeEntry.filter({ company_id: companyId }, '-fecha', 100);
    setEntries(data || []);
    setActiveTimer(new Date());
    setClocking(false);
  };

  const clockOut = async () => {
    const open = todayEntries.find(e => e.hora_entrada && !e.hora_salida);
    if (!open) return;
    const now = format(new Date(), 'HH:mm');
    const [h1, m1] = open.hora_entrada.split(':').map(Number);
    const [h2, m2] = now.split(':').map(Number);
    const hours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    await base44.entities.HRTimeEntry.update(open.id, { hora_salida: now, horas_totales: Math.max(0, hours) });
    const data = await base44.entities.HRTimeEntry.filter({ company_id: companyId }, '-fecha', 100);
    setEntries(data || []);
    setActiveTimer(null);
  };

  const hasOpenEntry = todayEntries.some(e => e.hora_entrada && !e.hora_salida);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 + i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayEntries = entries.filter(e => e.fecha === dateStr);
    const hours = dayEntries.reduce((s, e) => s + (e.horas_totales || 0), 0);
    return { date: d, dateStr, hours, entries: dayEntries, isToday: dateStr === todayStr };
  });
  const weekTotal = weekDays.reduce((s, d) => s + d.hours, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <Clock className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Time & Attendance</h2>
          <p className="text-sm text-slate-400">Control horario, fichajes y registro de jornada</p>
        </div>
      </div>

      {/* Clock in/out hero */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs text-slate-400 mb-1">{format(new Date(), "EEEE, d MMMM yyyy", { locale: es })}</p>
            <p className="text-5xl font-jakarta font-black text-foreground tabular-nums">{format(new Date(), 'HH:mm')}</p>
            <p className="text-sm text-slate-400 mt-2">
              Horas hoy: <span className="font-bold text-emerald-600">{totalHoy.toFixed(1)}h</span>
              {hasOpenEntry && <span className="ml-2 text-blue-500 font-medium animate-pulse">● Fichaje activo</span>}
            </p>
          </div>
          <div className="flex gap-3">
            {!hasOpenEntry ? (
              <button onClick={clockIn} disabled={clocking}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-all shadow-md">
                <Play className="w-5 h-5" /> Entrada
              </button>
            ) : (
              <button onClick={clockOut}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-md">
                <Square className="w-5 h-5" /> Salida
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Week view */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Esta semana</p>
          <span className="text-sm font-bold text-foreground">{weekTotal.toFixed(1)}h <span className="text-slate-400 font-normal">/ 40h</span></span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => (
            <div key={i} className={cn(
              "text-center p-3 rounded-xl border transition-all",
              d.isToday ? 'bg-emerald-50 border-emerald-200' : 'border-slate-100 hover:bg-slate-50'
            )}>
              <p className="text-[10px] text-slate-400 font-medium capitalize">{format(d.date, 'EEE', { locale: es })}</p>
              <p className={cn("text-xs font-bold mt-1", d.isToday ? 'text-emerald-700' : 'text-foreground')}>{d.hours > 0 ? `${d.hours.toFixed(1)}h` : '—'}</p>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", d.isToday ? 'bg-emerald-500' : 'bg-slate-300')}
                  style={{ width: `${Math.min(100, (d.hours / 8) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent entries */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-semibold text-foreground">Registros recientes</p>
        </div>
        <div className="divide-y divide-slate-50">
          {entries.slice(0, 15).map((e, i) => (
            <div key={e.id || i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", e.hora_salida ? 'bg-emerald-400' : 'bg-blue-400')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{e.employee_nombre || e.employee_id}</p>
                <p className="text-xs text-slate-400">{e.fecha}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-foreground">{e.hora_entrada || '—'} → {e.hora_salida || '…'}</p>
                <p className="text-xs text-slate-400">{e.horas_totales ? `${e.horas_totales.toFixed(1)}h` : 'Activo'}</p>
              </div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", e.tipo === 'remoto' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500')}>
                {e.tipo === 'remoto' ? 'Remoto' : 'Oficina'}
              </span>
            </div>
          ))}
          {entries.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
              <Clock className="w-10 h-10" />
              <p className="text-sm text-slate-400">Sin registros de fichaje.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}