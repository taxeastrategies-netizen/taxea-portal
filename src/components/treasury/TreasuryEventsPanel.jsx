import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowUpRight, ArrowDownRight, Clock, Zap, CheckCircle, X, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const TIPO_CFG = {
  cobro_previsto:       { icon: ArrowUpRight,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', label: 'Cobro previsto' },
  pago_previsto:        { icon: ArrowDownRight,color: 'text-red-500',     bg: 'bg-red-50 border-red-100',         label: 'Pago previsto' },
  transferencia_interna:{ icon: ArrowUpRight,  color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100',       label: 'Transferencia' },
  impuesto:             { icon: Clock,          color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100',     label: 'Impuesto' },
  nomina:               { icon: ArrowDownRight,color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100',   label: 'Nómina' },
  cuota_prestamo:       { icon: ArrowDownRight,color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100',   label: 'Préstamo' },
  otro:                 { icon: Clock,          color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-100',     label: 'Otro' },
};

const PRIORIDAD_CFG = {
  urgente:    'bg-red-50 border-red-200 text-red-600',
  normal:     'bg-slate-50 border-slate-200 text-slate-500',
  diferible:  'bg-slate-50 border-slate-100 text-slate-400',
  estrategico:'bg-blue-50 border-blue-200 text-blue-600',
};

function AddEventForm({ companyId, accounts, onSaved, onClose }) {
  const [form, setForm] = useState({ tipo: 'pago_previsto', concepto: '', importe: '', fecha_prevista: '', prioridad: 'normal', recurrente: false, bank_account_id: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    if (!form.concepto || !form.importe || !form.fecha_prevista) return;
    setLoading(true);
    await base44.entities.TreasuryEvent.create({ ...form, company_id: companyId, importe: parseFloat(form.importe) });
    setLoading(false);
    onSaved();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Nuevo evento previsto</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        {[
          { label: 'Tipo', key: 'tipo', type: 'select', opts: Object.entries(TIPO_CFG).map(([k,v]) => ({ value: k, label: v.label })) },
          { label: 'Concepto', key: 'concepto', type: 'text', placeholder: 'Ej: Pago proveedor X' },
          { label: 'Importe (€)', key: 'importe', type: 'number', placeholder: '0.00' },
          { label: 'Fecha prevista', key: 'fecha_prevista', type: 'date' },
          { label: 'Prioridad', key: 'prioridad', type: 'select', opts: [{ value: 'urgente', label: 'Urgente' }, { value: 'normal', label: 'Normal' }, { value: 'diferible', label: 'Diferible' }, { value: 'estrategico', label: 'Estratégico' }] },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{f.label}</label>
            {f.type === 'select' ? (
              <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
                {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white" />
            )}
          </div>
        ))}
        <button disabled={loading || !form.concepto || !form.importe || !form.fecha_prevista} onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all">
          {loading ? 'Guardando...' : 'Guardar evento'}
        </button>
      </motion.div>
    </div>
  );
}

export default function TreasuryEventsPanel({ events, companyId, accounts, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('pagos'); // pagos | cobros

  const pagos = events.filter(e => ['pago_previsto', 'impuesto', 'nomina', 'cuota_prestamo', 'transferencia_interna'].includes(e.tipo));
  const cobros = events.filter(e => e.tipo === 'cobro_previsto');

  const list = tab === 'pagos' ? pagos : cobros;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-foreground">Previsiones</h3>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-taxea-red text-white hover:bg-taxea-red/90 transition-all">
          <Plus className="w-3.5 h-3.5" /> Nuevo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4">
        {[{ id: 'pagos', label: `Pagos (${pagos.length})` }, { id: 'cobros', label: `Cobros (${cobros.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {list.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-300">Sin previsiones registradas</p>
          </div>
        ) : list.sort((a, b) => new Date(a.fecha_prevista) - new Date(b.fecha_prevista)).map((e, i) => {
          const cfg = TIPO_CFG[e.tipo] || TIPO_CFG.otro;
          const Icon = cfg.icon;
          const prio = PRIORIDAD_CFG[e.prioridad] || PRIORIDAD_CFG.normal;
          const isVencido = e.estado !== 'ejecutado' && isPast(parseISO(e.fecha_prevista));
          const dateStr = e.fecha_prevista ? (() => { try { return format(parseISO(e.fecha_prevista), 'd MMM', { locale: es }); } catch { return e.fecha_prevista; } })() : '—';
          return (
            <motion.div key={e.id || i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm", cfg.bg, isVencido && "ring-1 ring-red-200")}>
              <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60")}>
                <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{e.concepto}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">{dateStr}</span>
                  {isVencido && <span className="text-[10px] text-red-500 font-medium">Vencido</span>}
                  {e.recurrente && <span className="text-[10px] text-blue-500">↻</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className={cn("text-sm font-bold", cfg.color)}>{fmt(e.importe)}</p>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", prio)}>{e.prioridad}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {showForm && <AddEventForm companyId={companyId} accounts={accounts} onSaved={onRefresh} onClose={() => setShowForm(false)} />}
    </motion.div>
  );
}