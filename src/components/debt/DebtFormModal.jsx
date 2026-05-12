import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'prestamo_bancario', label: 'Préstamo bancario' },
  { value: 'ico', label: 'ICO' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'renting', label: 'Renting' },
  { value: 'linea_credito', label: 'Línea de crédito' },
  { value: 'poliza', label: 'Póliza de crédito' },
  { value: 'prestamo_socio', label: 'Préstamo de socio' },
  { value: 'prestamo_participativo', label: 'Préstamo participativo' },
  { value: 'deuda_convertible', label: 'Deuda convertible' },
  { value: 'financiacion_puente', label: 'Financiación puente' },
  { value: 'otro', label: 'Otro' },
];

const TIPO_COLORS = {
  prestamo_bancario: 'text-blue-600 bg-blue-50',
  ico: 'text-taxea-red bg-taxea-red/8',
  leasing: 'text-violet-600 bg-violet-50',
  renting: 'text-slate-600 bg-slate-100',
  linea_credito: 'text-emerald-600 bg-emerald-50',
  poliza: 'text-amber-600 bg-amber-50',
};

const isLinea = t => t === 'linea_credito' || t === 'poliza';
const isLeasing = t => t === 'leasing' || t === 'renting';

const DEFAULT = {
  tipo: 'prestamo_bancario', nombre: '', entidad: '', numero_contrato: '',
  importe_inicial: '', capital_pendiente: '', tin: '', tae: '',
  plazo_meses: '', fecha_inicio: '', fecha_vencimiento: '',
  periodicidad: 'mensual', cuota: '', estado: 'activo',
  en_carencia: false, fecha_fin_carencia: '',
  avales: '', garantias: '', moneda: 'EUR',
  limite_credito: '', dispuesto: '',
  activo_asociado: '', opcion_compra: '', valor_residual: '',
  intereses_pagados: '', capital_amortizado: '',
  notas: '',
};

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/20 bg-white";

export default function DebtFormModal({ debt, companyId, onClose, onSaved }) {
  const [form, setForm] = useState(debt ? {
    ...DEFAULT, ...debt,
    importe_inicial: debt.importe_inicial || '',
    capital_pendiente: debt.capital_pendiente || '',
    tin: debt.tin || '', tae: debt.tae || '',
    cuota: debt.cuota || '', plazo_meses: debt.plazo_meses || '',
    limite_credito: debt.limite_credito || '', dispuesto: debt.dispuesto || '',
  } : DEFAULT);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre || !form.importe_inicial) return;
    setSaving(true);
    const data = {
      ...form,
      company_id: companyId,
      importe_inicial: parseFloat(form.importe_inicial) || 0,
      capital_pendiente: parseFloat(form.capital_pendiente) || parseFloat(form.importe_inicial) || 0,
      tin: parseFloat(form.tin) || 0,
      tae: parseFloat(form.tae) || 0,
      cuota: parseFloat(form.cuota) || 0,
      plazo_meses: parseInt(form.plazo_meses) || 0,
      limite_credito: parseFloat(form.limite_credito) || 0,
      dispuesto: parseFloat(form.dispuesto) || 0,
      opcion_compra: parseFloat(form.opcion_compra) || 0,
      valor_residual: parseFloat(form.valor_residual) || 0,
      intereses_pagados: parseFloat(form.intereses_pagados) || 0,
      capital_amortizado: parseFloat(form.capital_amortizado) || 0,
    };
    if (debt?.id) {
      await base44.entities.DebtInstrument.update(debt.id, data);
    } else {
      await base44.entities.DebtInstrument.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">{debt ? 'Editar instrumento' : 'Nuevo instrumento de deuda'}</p>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tipo selector visual */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de instrumento</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIPOS.map(t => (
                <button key={t.value} onClick={() => set('tipo', t.value)}
                  className={cn("px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-center",
                    form.tipo === t.value
                      ? "border-taxea-red bg-taxea-red/8 text-taxea-red"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white")}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre / descripción" required>
              <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Préstamo BBVA 2024" />
            </Field>
            <Field label="Entidad financiera">
              <input className={inputCls} value={form.entidad} onChange={e => set('entidad', e.target.value)} placeholder="Banco, entidad, proveedor..." />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Importe inicial (€)" required>
              <input type="number" className={inputCls} value={form.importe_inicial} onChange={e => set('importe_inicial', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Capital pendiente (€)">
              <input type="number" className={inputCls} value={form.capital_pendiente} onChange={e => set('capital_pendiente', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Cuota periódica (€)">
              <input type="number" className={inputCls} value={form.cuota} onChange={e => set('cuota', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="TIN (%)">
              <input type="number" step="0.01" className={inputCls} value={form.tin} onChange={e => set('tin', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="TAE (%)">
              <input type="number" step="0.01" className={inputCls} value={form.tae} onChange={e => set('tae', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Plazo (meses)">
              <input type="number" className={inputCls} value={form.plazo_meses} onChange={e => set('plazo_meses', e.target.value)} placeholder="60" />
            </Field>
            <Field label="Periodicidad">
              <select className={inputCls} value={form.periodicidad} onChange={e => set('periodicidad', e.target.value)}>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha inicio">
              <input type="date" className={inputCls} value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" className={inputCls} value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
            </Field>
          </div>

          {isLinea(form.tipo) && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Field label="Límite de crédito (€)">
                <input type="number" className={inputCls} value={form.limite_credito} onChange={e => set('limite_credito', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Dispuesto actual (€)">
                <input type="number" className={inputCls} value={form.dispuesto} onChange={e => set('dispuesto', e.target.value)} placeholder="0.00" />
              </Field>
            </div>
          )}

          {isLeasing(form.tipo) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
              <Field label="Activo asociado">
                <input className={inputCls} value={form.activo_asociado} onChange={e => set('activo_asociado', e.target.value)} placeholder="Vehículo, maquinaria..." />
              </Field>
              <Field label="Opción de compra (€)">
                <input type="number" className={inputCls} value={form.opcion_compra} onChange={e => set('opcion_compra', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Valor residual (€)">
                <input type="number" className={inputCls} value={form.valor_residual} onChange={e => set('valor_residual', e.target.value)} placeholder="0.00" />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Capital amortizado (€)">
              <input type="number" className={inputCls} value={form.capital_amortizado} onChange={e => set('capital_amortizado', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Intereses pagados (€)">
              <input type="number" className={inputCls} value={form.intereses_pagados} onChange={e => set('intereses_pagados', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Estado">
              <select className={inputCls} value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="activo">Activo</option>
                <option value="carencia">En carencia</option>
                <option value="cancelado">Cancelado</option>
                <option value="vencido">Vencido</option>
                <option value="refinanciado">Refinanciado</option>
              </select>
            </Field>
            <Field label="Avales / Garantías">
              <input className={inputCls} value={form.avales} onChange={e => set('avales', e.target.value)} placeholder="SGR, inmueble, personal..." />
            </Field>
          </div>

          <Field label="Notas / Observaciones">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/20 bg-white resize-none" rows={2}
              placeholder="Condiciones especiales, renovaciones, historial..." />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre || !form.importe_inicial}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {debt ? 'Guardar cambios' : 'Crear instrumento'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}