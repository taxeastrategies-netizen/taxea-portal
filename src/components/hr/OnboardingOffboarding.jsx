import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UserPlus, UserMinus, CheckCircle2, Circle, Clock } from 'lucide-react';

const ONBOARD_STEPS = [
  'Contrato firmado', 'Datos personales', 'Alta Seguridad Social', 'Entrega portátil', 'Accesos sistemas',
  'Cuenta email', 'Formación inicial', 'Presentación equipo', 'Revisión primera semana'
];
const OFFBOARD_STEPS = [
  'Comunicación salida', 'Revocación accesos', 'Devolución material', 'Liquidación pendiente',
  'Exit interview', 'Baja Seguridad Social', 'Documentación final'
];

export default function OnboardingOffboarding() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('onboarding');

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.Employee.filter({ company_id: companyId }).then(d => setEmployees(d || [])).finally(() => setLoading(false));
  }, [companyId]);

  const onboarding = employees.filter(e => !e.onboarding_completado && e.estado === 'activo');
  const offboarding = employees.filter(e => e.estado === 'offboarding');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Onboarding & Offboarding</h2>
          <p className="text-sm text-slate-400">Incorporaciones y salidas del equipo</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('onboarding')} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all", tab === 'onboarding' ? "bg-white text-foreground shadow-sm" : "text-slate-500")}>
          <UserPlus className="w-3.5 h-3.5" /> Onboarding ({onboarding.length})
        </button>
        <button onClick={() => setTab('offboarding')} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all", tab === 'offboarding' ? "bg-white text-foreground shadow-sm" : "text-slate-500")}>
          <UserMinus className="w-3.5 h-3.5" /> Offboarding ({offboarding.length})
        </button>
      </div>

      {tab === 'onboarding' && (
        <div className="space-y-4">
          {onboarding.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
              <UserPlus className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Sin onboardings pendientes.</p>
            </div>
          ) : onboarding.map(emp => (
            <div key={emp.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {emp.nombre?.[0]}{emp.apellidos?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{emp.nombre} {emp.apellidos}</p>
                  <p className="text-xs text-slate-400">{emp.cargo || '—'} · {emp.departamento || '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {ONBOARD_STEPS.map((step, i) => {
                  const done = i < 3;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                      <span className={cn("text-sm", done ? 'text-slate-500 line-through' : 'text-foreground')}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'offboarding' && (
        <div className="space-y-4">
          {offboarding.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
              <UserMinus className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Sin offboardings en curso.</p>
            </div>
          ) : offboarding.map(emp => (
            <div key={emp.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-sm font-bold text-orange-700">
                  {emp.nombre?.[0]}{emp.apellidos?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{emp.nombre} {emp.apellidos}</p>
                  <p className="text-xs text-slate-400">{emp.cargo || '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {OFFBOARD_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <span className="text-sm text-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}