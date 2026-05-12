import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Calendar, Plus, CheckCircle2, XCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS = { pendiente: 'bg-amber-50 text-amber-700 border-amber-200', aprobada: 'bg-emerald-50 text-emerald-700 border-emerald-200', rechazada: 'bg-red-50 text-red-700 border-red-200', cancelada: 'bg-slate-50 text-slate-400 border-slate-200' };
const TIPO_LABELS = { vacaciones: 'Vacaciones', baja_medica: 'Baja médica', permiso: 'Permiso', cita_medica: 'Cita médica', asunto_propio: 'Asunto propio', maternidad: 'Maternidad', paternidad: 'Paternidad', otro: 'Otro' };
const TIPO_COLORS = { vacaciones: 'text-blue-600', baja_medica: 'text-red-600', permiso: 'text-violet-600', cita_medica: 'text-amber-600', asunto_propio: 'text-slate-600' };

export default function HRAbsences() {
  const ctx = useOutletContext() || {};
  const { company, user } = ctx;
  const companyId = company?.id;

  const [absences, setAbsences] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('all');
  const [form, setForm] = useState({ tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', motivo: '' });

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [abs, emps] = await Promise.all([
      base44.entities.HRAbsence.filter({ company_id: companyId }, '-created_date', 200),
      base44.entities.Employee.filter({ company_id: companyId }),
    ]);
    setAbsences(abs || []);
    setEmployees(emps || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const submit = async () => {
    if (!form.fecha_inicio || !form.fecha_fin) return;
    const dias = Math.max(1, differenceInDays(parseISO(form.fecha_fin), parseISO(form.fecha_inicio)) + 1);
    await base44.entities.HRAbsence.create({
      company_id: companyId,
      employee_id: user?.email || '',
      employee_nombre: user?.full_name || '',
      tipo: form.tipo,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      dias,
      motivo: form.motivo,
    });
    setShowForm(false);
    setForm({ tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', motivo: '' });
    load();
  };

  const approve = async (id) => {
    await base44.entities.HRAbsence.update(id, { estado: 'aprobada', aprobado_por: user?.email });
    load();
  };
  const reject = async (id) => {
    await base44.entities.HRAbsence.update(id, { estado: 'rechazada' });
    load();
  };

  const filtered = tab === 'all' ? absences : absences.filter(a => a.estado === tab);
  const pending = absences.filter(a => a.estado === 'pendiente').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Ausencias y Vacaciones</h2>
            <p className="text-sm text-slate-400">{absences.length} registros · {pending} pendientes</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Solicitar ausencia
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ id: 'all', label: 'Todas' }, { id: 'pendiente', label: `Pendientes (${pending})` }, { id: 'aprobada', label: 'Aprobadas' }, { id: 'rechazada', label: 'Rechazadas' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <Calendar className="w-12 h-12" />
            <p className="text-sm text-slate-400">Sin ausencias registradas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{a.employee_nombre || a.employee_id}</p>
                    <span className={cn("text-xs font-semibold", TIPO_COLORS[a.tipo] || 'text-slate-500')}>
                      {TIPO_LABELS[a.tipo] || a.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{a.fecha_inicio} → {a.fecha_fin} · {a.dias || 1} día{(a.dias || 1) > 1 ? 's' : ''}</p>
                  {a.motivo && <p className="text-xs text-slate-400 italic mt-0.5">{a.motivo}</p>}
                </div>
                <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-full border", STATUS[a.estado] || STATUS.pendiente)}>
                  {a.estado}
                </span>
                {a.estado === 'pendiente' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => approve(a.id)} className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => reject(a.id)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Solicitar ausencia</p>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-taxea-red/30">
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-taxea-red/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Fin</label>
                <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-taxea-red/30" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Motivo (opcional)</label>
              <textarea value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-taxea-red/30" />
            </div>
            <button onClick={submit} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
              Enviar solicitud
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}