import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BarChart2, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#16a34a', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#6366f1', '#64748b'];

export default function HRReports() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Employee.filter({ company_id: companyId }),
      base44.entities.HRAbsence.filter({ company_id: companyId }),
    ]).then(([emps, abs]) => { setEmployees(emps || []); setAbsences(abs || []); }).finally(() => setLoading(false));
  }, [companyId]);

  const deptData = useMemo(() => {
    const map = {};
    employees.forEach(e => {
      const d = e.departamento || 'Sin departamento';
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [employees]);

  const modalData = useMemo(() => {
    const map = { presencial: 0, remoto: 0, hibrido: 0 };
    employees.forEach(e => { if (e.modalidad && map[e.modalidad] !== undefined) map[e.modalidad]++; });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [employees]);

  const absentismoPct = employees.length > 0 ? ((absences.filter(a => a.estado === 'aprobada').length / employees.length) * 100).toFixed(1) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">HR Reports & People Analytics</h2>
          <p className="text-sm text-slate-400">Analítica de plantilla, absentismo y productividad</p>
        </div>
      </div>

      {!loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-400">Headcount</p>
              <p className="text-2xl font-jakarta font-bold text-foreground mt-1">{employees.length}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-400">Departamentos</p>
              <p className="text-2xl font-jakarta font-bold text-blue-600 mt-1">{deptData.length}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-400">Tasa absentismo</p>
              <p className="text-2xl font-jakarta font-bold text-amber-600 mt-1">{absentismoPct}%</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-400">Ausencias aprobadas</p>
              <p className="text-2xl font-jakarta font-bold text-foreground mt-1">{absences.filter(a => a.estado === 'aprobada').length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-4">Distribución por departamento</p>
              {deptData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={deptData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={2}>
                        {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {deptData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-600">{d.name}</span>
                        <span className="font-bold text-foreground ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">Sin datos.</p>}
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-4">Modalidad de trabajo</p>
              {modalData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={modalData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={2}>
                        {modalData.map((_, i) => <Cell key={i} fill={['#16a34a', '#3b82f6', '#f59e0b'][i]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {modalData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#16a34a', '#3b82f6', '#f59e0b'][i] }} />
                        <span className="text-slate-600">{d.name}</span>
                        <span className="font-bold text-foreground ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">Sin datos.</p>}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}