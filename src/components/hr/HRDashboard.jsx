import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Users, Clock, Calendar, TrendingUp, Heart, Wifi, MapPin, Home, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_COLORS = {
  activo: 'bg-emerald-400',
  remoto: 'bg-blue-400',
  vacaciones: 'bg-amber-400',
  ausente: 'bg-slate-300',
  baja_medica: 'bg-red-400',
  offboarding: 'bg-orange-400',
};

const STATUS_LABELS = {
  activo: 'En oficina',
  remoto: 'Remoto',
  vacaciones: 'Vacaciones',
  ausente: 'Ausente',
  baja_medica: 'Baja médica',
  offboarding: 'Offboarding',
};

export default function HRDashboard() {
  const ctx = useOutletContext() || {};
  const { company, user } = ctx;
  const companyId = company?.id;

  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Employee.filter({ company_id: companyId }),
      base44.entities.HRAbsence.filter({ company_id: companyId }),
    ]).then(([emps, abs]) => {
      setEmployees(emps || []);
      setAbsences(abs || []);
    }).finally(() => setLoading(false));
  }, [companyId]);

  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es });

  const active = employees.filter(e => e.estado === 'activo').length;
  const remote = employees.filter(e => e.estado === 'remoto').length;
  const onVacation = employees.filter(e => e.estado === 'vacaciones').length;
  const pendingAbsences = absences.filter(a => a.estado === 'pendiente').length;

  const byDept = employees.reduce((acc, e) => {
    const d = e.departamento || 'Sin departamento';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const kpis = [
    { label: 'Empleados activos', value: active, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'En remoto hoy', value: remote, icon: Wifi, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'De vacaciones', value: onVacation, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Ausencias pendientes', value: pendingAbsences, icon: Clock, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Hero greeting */}
      <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-3xl p-6 text-white shadow-lg">
        <p className="text-rose-200 text-sm mb-1 capitalize">{today}</p>
        <h2 className="text-2xl font-jakarta font-bold">{greeting}, {user?.full_name?.split(' ')[0] || 'equipo'} 👋</h2>
        <p className="text-rose-100 text-sm mt-1">
          {employees.length > 0
            ? `${active} persona${active !== 1 ? 's' : ''} activa${active !== 1 ? 's' : ''} · ${remote} en remoto · ${onVacation} de vacaciones`
            : 'Bienvenido al módulo People & HR de Taxea Business OS'}
        </p>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn("bg-white border rounded-2xl p-4 shadow-sm", k.border)}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", k.bg)}>
                  <Icon className={cn("w-4 h-4", k.color)} />
                </div>
                <p className="text-2xl font-jakarta font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Team status */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-sm font-semibold text-foreground">Estado del equipo</p>
          </div>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
              <Users className="w-10 h-10" />
              <p className="text-sm text-slate-400">Sin empleados registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {employees.slice(0, 15).map(emp => (
                <div key={emp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {emp.nombre?.[0]}{emp.apellidos?.[0]}
                    </div>
                    <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white", STATUS_COLORS[emp.estado] || 'bg-slate-300')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{emp.nombre} {emp.apellidos}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.cargo || emp.departamento || '—'}</p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{STATUS_LABELS[emp.estado] || emp.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Departments */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Distribución por departamento</p>
          {Object.keys(byDept).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
              <TrendingUp className="w-10 h-10" />
              <p className="text-sm text-slate-400">Sin datos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                const pct = employees.length > 0 ? (count / employees.length) * 100 : 0;
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{dept}</span>
                      <span className="font-bold text-foreground">{count} persona{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        className="h-full bg-rose-400 rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick modules */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Accesos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Empleados', icon: Users, path: '/people/employees', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Ausencias', icon: Calendar, path: '/people/absences', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Fichajes', icon: Clock, path: '/people/time', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Documentos', icon: Heart, path: '/people/documents', color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'Recruiting', icon: TrendingUp, path: '/people/recruiting', color: 'text-pink-600', bg: 'bg-pink-50' },
            { label: 'HR IA', icon: Brain, path: '/people/ai-assistant', color: 'text-slate-600', bg: 'bg-slate-100' },
          ].map((m, i) => {
            const Icon = m.icon;
            return (
              <a key={i} href={m.path}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-center cursor-pointer">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", m.bg)}>
                  <Icon className={cn("w-5 h-5", m.color)} />
                </div>
                <span className="text-xs font-medium text-slate-600">{m.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}