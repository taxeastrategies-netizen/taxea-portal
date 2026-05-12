import { useState } from 'react';
import { Zap, Plus, Clock, Mail, CheckCircle2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Report' },
  { id: 'board', label: 'Board Report' },
  { id: 'investor', label: 'Investor Report' },
  { id: 'cashflow', label: 'Cashflow Report' },
  { id: 'custom', label: 'Personalizado' },
];

const FREQUENCIES = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'quarterly', label: 'Trimestral' },
  { id: 'annual', label: 'Anual' },
];

export default function AutoReports({ company }) {
  const [automations, setAutomations] = useState([
    { id: 1, name: 'Monthly Board Report', type: 'board', frequency: 'monthly', email: 'socios@empresa.com', active: true },
    { id: 2, name: 'Cashflow Semanal CFO', type: 'cashflow', frequency: 'weekly', email: 'cfo@empresa.com', active: false },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'monthly', frequency: 'monthly', email: '' });

  const add = () => {
    if (!form.name || !form.email) return;
    setAutomations(prev => [...prev, { ...form, id: Date.now(), active: true }]);
    setForm({ name: '', type: 'monthly', frequency: 'monthly', email: '' });
    setShowForm(false);
  };

  const toggle = (id) => setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const remove = (id) => setAutomations(prev => prev.filter(a => a.id !== id));

  const freqLabel = { weekly: 'Semanal', monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' };
  const typeLabel = { monthly: 'Monthly Report', board: 'Board Report', investor: 'Investor Report', cashflow: 'Cashflow Report', custom: 'Personalizado' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-700 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-jakarta font-bold">Informes Automáticos</h3>
              <p className="text-orange-200 text-sm mt-0.5">Generación y envío periódico programado de reportes</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-foreground">Nueva automatización</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Monthly Board Report"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email destinatario</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="socios@empresa.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de informe</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
                {REPORT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Frecuencia</label>
              <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
                {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-all">
              Crear automatización
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Automations list */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Automatizaciones configuradas</p>
        </div>
        {automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <Clock className="w-12 h-12" />
            <p className="text-sm text-slate-400">Sin automatizaciones. Crea la primera.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {automations.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", a.active ? "bg-emerald-500" : "bg-slate-300")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">{typeLabel[a.type]}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{freqLabel[a.frequency]}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.active && <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Activa</span>}
                  <button onClick={() => toggle(a.id)} className="text-slate-400 hover:text-slate-700 transition-colors">
                    {a.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => remove(a.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-xs text-orange-700">
          <strong>Próximamente:</strong> Integración completa con envío automático por email y programación real vía Taxea Automations Engine. Actualmente en configuración previa.
        </p>
      </div>
    </div>
  );
}