import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown, AlertCircle, Users } from 'lucide-react';

const fmt = n => `${(n || 0).toFixed(1)}h`;

export default function HoursBank() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Employee.filter({ company_id: companyId }),
      base44.entities.HRTimeEntry.filter({ company_id: companyId }, '-fecha', 500),
    ]).then(([emps, ents]) => { setEmployees(emps || []); setEntries(ents || []); }).finally(() => setLoading(false));
  }, [companyId]);

  const bankData = useMemo(() => {
    return employees.map(emp => {
      const empEntries = entries.filter(e => e.employee_id === emp.email || e.employee_id === emp.id);
      const totalWorked = empEntries.reduce((s, e) => s + (e.horas_totales || 0), 0);
      const totalExtra = empEntries.reduce((s, e) => s + (e.horas_extra || 0), 0);
      const weeksCount = Math.max(1, empEntries.length > 0 ? Math.ceil(new Set(empEntries.map(e => e.fecha?.slice(0, 10))).size / 5) : 1);
      const expected = weeksCount * (emp.horas_semanales || 40);
      const balance = totalWorked - expected;
      return { ...emp, totalWorked, totalExtra, expected, balance };
    }).sort((a, b) => b.totalWorked - a.totalWorked);
  }, [employees, entries]);

  const totalBalance = bankData.reduce((s, e) => s + e.balance, 0);
  const totalExtra = bankData.reduce((s, e) => s + e.totalExtra, 0);
  const totalWorked = bankData.reduce((s, e) => s + e.totalWorked, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Clock className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Hours Bank</h2>
          <p className="text-sm text-slate-400">Balance de horas, extras y compensaciones</p>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400">Horas registradas</p>
            <p className="text-2xl font-jakarta font-bold text-foreground mt-1">{fmt(totalWorked)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400">Horas extra</p>
            <p className="text-2xl font-jakarta font-bold text-amber-600 mt-1">{fmt(totalExtra)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400">Balance global</p>
            <p className={cn("text-2xl font-jakarta font-bold mt-1", totalBalance >= 0 ? 'text-emerald-600' : 'text-red-500')}>{totalBalance >= 0 ? '+' : ''}{fmt(totalBalance)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400">Empleados</p>
            <p className="text-2xl font-jakarta font-bold text-foreground mt-1">{bankData.length}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-semibold text-foreground">Balance individual</p>
        </div>
        {bankData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <Users className="w-12 h-12" />
            <p className="text-sm text-slate-400">Sin datos de horas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {bankData.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                  {emp.nombre?.[0]}{emp.apellidos?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{emp.nombre} {emp.apellidos}</p>
                  <p className="text-xs text-slate-400">{emp.cargo || emp.departamento || '—'}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className="text-sm font-bold text-foreground">{fmt(emp.totalWorked)}</p>
                  <p className={cn("text-xs font-medium", emp.balance >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {emp.balance >= 0 ? '+' : ''}{fmt(emp.balance)}
                  </p>
                </div>
                {emp.totalExtra > 0 && (
                  <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    +{fmt(emp.totalExtra)} extra
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}