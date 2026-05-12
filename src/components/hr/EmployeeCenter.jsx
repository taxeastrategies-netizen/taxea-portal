import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Users, Plus, Search, X, Mail, Phone, Building2, LayoutGrid, List } from 'lucide-react';

const STATUS_COLORS = {
  activo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  baja: 'bg-slate-50 text-slate-400 border-slate-200',
  vacaciones: 'bg-amber-50 text-amber-700 border-amber-200',
  remoto: 'bg-blue-50 text-blue-700 border-blue-200',
  ausente: 'bg-orange-50 text-orange-700 border-orange-200',
  baja_medica: 'bg-red-50 text-red-700 border-red-200',
  offboarding: 'bg-slate-50 text-slate-500 border-slate-200',
};

const DEPTS = ['Todos', 'Tecnología', 'Finanzas', 'RRHH', 'Marketing', 'Ventas', 'Operaciones', 'Legal'];

export default function EmployeeCenter() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('Todos');
  const [view, setView] = useState('grid');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', cargo: '', departamento: '', modalidad: 'presencial', tipo_contrato: 'indefinido' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const data = await base44.entities.Employee.filter({ company_id: companyId }, '-created_date', 200);
    setEmployees(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const save = async () => {
    if (!form.nombre || !form.email) return;
    setSaving(true);
    await base44.entities.Employee.create({ ...form, company_id: companyId, estado: 'activo' });
    setSaving(false);
    setShowForm(false);
    setForm({ nombre: '', apellidos: '', email: '', cargo: '', departamento: '', modalidad: 'presencial', tipo_contrato: 'indefinido' });
    load();
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || `${e.nombre} ${e.apellidos} ${e.email} ${e.cargo}`.toLowerCase().includes(q);
    const matchD = dept === 'Todos' || e.departamento === dept;
    return matchQ && matchD;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Employee Center</h2>
            <p className="text-sm text-slate-400">{employees.length} empleados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
            {view === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Añadir empleado
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empleado…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {DEPTS.slice(0, 5).map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                dept === d ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-base font-bold text-rose-700">
                  {emp.nombre?.[0]}{emp.apellidos?.[0]}
                </div>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLORS[emp.estado] || STATUS_COLORS.activo)}>
                  {emp.estado || 'activo'}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{emp.nombre} {emp.apellidos}</p>
              <p className="text-xs text-slate-400 mt-0.5">{emp.cargo || '—'}</p>
              <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
                {emp.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Mail className="w-3 h-3" />{emp.email}
                  </div>
                )}
                {emp.departamento && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Building2 className="w-3 h-3" />{emp.departamento}
                  </div>
                )}
                {emp.modalidad && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className={cn("w-2 h-2 rounded-full inline-block", emp.modalidad === 'remoto' ? 'bg-blue-400' : emp.modalidad === 'hibrido' ? 'bg-violet-400' : 'bg-emerald-400')} />
                    {emp.modalidad.charAt(0).toUpperCase() + emp.modalidad.slice(1)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
              <Users className="w-12 h-12" />
              <p className="text-sm text-slate-400">{search ? 'Sin resultados.' : 'Añade el primer empleado.'}</p>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
              <Users className="w-12 h-12" />
              <p className="text-sm text-slate-400">{search ? 'Sin resultados.' : 'Añade el primer empleado.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(emp => (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-xs font-bold text-rose-700 flex-shrink-0">
                    {emp.nombre?.[0]}{emp.apellidos?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{emp.nombre} {emp.apellidos}</p>
                    <p className="text-xs text-slate-400">{emp.cargo || '—'} · {emp.departamento || '—'}</p>
                  </div>
                  <div className="hidden sm:block text-xs text-slate-400">{emp.email}</div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", STATUS_COLORS[emp.estado] || STATUS_COLORS.activo)}>
                    {emp.estado || 'activo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add employee modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Nuevo empleado</p>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nombre *', key: 'nombre' }, { label: 'Apellidos', key: 'apellidos' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </div>
              ))}
            </div>
            {[
              { label: 'Email *', key: 'email', type: 'email' }, { label: 'Cargo', key: 'cargo' }, { label: 'Departamento', key: 'departamento' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Modalidad</label>
                <select value={form.modalidad} onChange={e => setForm(p => ({ ...p, modalidad: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200">
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Contrato</label>
                <select value={form.tipo_contrato} onChange={e => setForm(p => ({ ...p, tipo_contrato: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200">
                  <option value="indefinido">Indefinido</option>
                  <option value="temporal">Temporal</option>
                  <option value="practicas">Prácticas</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.nombre || !form.email}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 disabled:opacity-50 transition-all shadow-sm">
              {saving ? 'Guardando…' : 'Añadir empleado'}
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}