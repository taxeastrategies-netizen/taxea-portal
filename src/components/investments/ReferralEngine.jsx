import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Copy, ExternalLink, Loader2, Pencil, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}

const TIPO_COM_LABELS = { cpa: 'CPA', revenue_share: 'Rev. Share', hibrido: 'Híbrido', fijo: 'Fijo', pendiente: 'Pendiente' };
const CAT_BADGE = {
  neobank: 'bg-blue-50 text-blue-700', broker: 'bg-violet-50 text-violet-700',
  crypto: 'bg-amber-50 text-amber-700', fondos: 'bg-emerald-50 text-emerald-700',
  depositos: 'bg-slate-100 text-slate-600', treasury: 'bg-indigo-50 text-indigo-700', otro: 'bg-slate-100 text-slate-600'
};

const DEFAULT_FORM = {
  nombre: '', categoria: 'broker', descripcion: '', referral_link: '',
  tipo_comision: 'cpa', comision_valor: '', comision_descripcion: '',
  rentabilidad_orientativa: '', liquidez: 'inmediata', riesgo: 'bajo',
  tipo_producto: '', condiciones: '', notas_internas: '', destacado: false, visible_clientes: false, orden: 0,
};

export default function ReferralEngine({ partners, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setShowForm(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...DEFAULT_FORM, ...p, comision_valor: p.comision_valor || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.nombre) return;
    setSaving(true);
    const data = { ...form, comision_valor: parseFloat(form.comision_valor) || 0, orden: parseInt(form.orden) || 0 };
    if (editing?.id) {
      await base44.entities.InvestmentPartner.update(editing.id, data);
    } else {
      await base44.entities.InvestmentPartner.create(data);
    }
    setSaving(false);
    setShowForm(false);
    onRefresh();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar partner "${p.nombre}"?`)) return;
    await base44.entities.InvestmentPartner.delete(p.id);
    onRefresh();
  };

  const handleCopy = (link, id) => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 bg-white";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Referral Engine</p>
          <p className="text-xs text-slate-400 mt-0.5">Gestiona los links de afiliado y partnerships financieros</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-all">
          <Plus className="w-4 h-4" /> Añadir partner
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {partners.length === 0 && (
          <div className="col-span-2 bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-xs">
            Sin partners configurados. Añade el primero.
          </div>
        )}
        {partners.map(p => {
          const catBadge = CAT_BADGE[p.categoria] || 'bg-slate-100 text-slate-600';
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground">{p.nombre}</p>
                    {p.destacado && <span className="text-[9px] bg-amber-400 text-white font-bold px-1.5 py-0.5 rounded-full">DEST.</span>}
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg", catBadge)}>{p.categoria}</span>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", p.estado === 'activo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                    {p.estado}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Clicks', value: p.total_clicks || 0 },
                  { label: 'Registros', value: p.total_registros || 0 },
                  { label: 'Conversiones', value: p.total_conversiones || 0 },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-lg font-jakarta font-bold text-foreground">{s.value}</p>
                    <p className="text-[9px] text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                <span>Comisión: <span className="font-semibold text-foreground">{TIPO_COM_LABELS[p.tipo_comision]} {p.comision_valor ? `· ${p.comision_valor}` : ''}</span></span>
                <span>Ingresos: <span className="font-semibold text-emerald-600">{fmt(p.ingresos_generados)}</span></span>
              </div>

              {p.referral_link && (
                <div className="flex items-center gap-2">
                  <input readOnly value={p.referral_link} className="flex-1 h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400 font-mono truncate" />
                  <button onClick={() => handleCopy(p.referral_link, p.id)}
                    className={cn("p-1.5 rounded-lg transition-all", copied === p.id ? "bg-emerald-50 text-emerald-500" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                    {copied === p.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={p.referral_link} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <p className="text-sm font-semibold">{editing ? 'Editar partner' : 'Nuevo partner'}</p>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
                  <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Trade Republic, Revolut..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Categoría</label>
                  <select className={inputCls} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                    {['neobank','broker','crypto','fondos','depositos','treasury','otro'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
                  <select className={inputCls} value={form.estado || 'activo'} onChange={e => set('estado', e.target.value)}>
                    {['activo','pausado','negociacion','inactivo'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Referral link</label>
                <input className={inputCls + ' font-mono'} value={form.referral_link} onChange={e => set('referral_link', e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipo comisión</label>
                  <select className={inputCls} value={form.tipo_comision} onChange={e => set('tipo_comision', e.target.value)}>
                    {Object.entries(TIPO_COM_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor comisión</label>
                  <input type="number" className={inputCls} value={form.comision_valor} onChange={e => set('comision_valor', e.target.value)} placeholder="Ej: 25 (€ o %)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción comisión</label>
                <input className={inputCls} value={form.comision_descripcion} onChange={e => set('comision_descripcion', e.target.value)} placeholder="25€ por registro activo con depósito mínimo..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción pública</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 bg-white resize-none" rows={2} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Riesgo</label>
                  <select className={inputCls} value={form.riesgo} onChange={e => set('riesgo', e.target.value)}>
                    {['muy_bajo','bajo','moderado','alto','muy_alto'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Liquidez</label>
                  <select className={inputCls} value={form.liquidez} onChange={e => set('liquidez', e.target.value)}>
                    {['inmediata','1_7_dias','1_mes','3_meses','limitada'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Orden</label>
                  <input type="number" className={inputCls} value={form.orden} onChange={e => set('orden', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rentabilidad orientativa</label>
                <input className={inputCls} value={form.rentabilidad_orientativa} onChange={e => set('rentabilidad_orientativa', e.target.value)} placeholder="~3.75% TAE (orientativo)" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notas internas (solo admin)</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none resize-none bg-white" rows={2} value={form.notas_internas} onChange={e => set('notas_internas', e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.destacado} onChange={e => set('destacado', e.target.checked)} className="accent-violet-600" />
                  <span className="text-xs text-slate-600">Destacado</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nombre}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-700 transition-all">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear partner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}