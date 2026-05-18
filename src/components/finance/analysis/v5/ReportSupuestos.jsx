/**
 * ReportSupuestos — Panel de supuestos editables V5
 * Permite al usuario introducir datos que faltan para calcular burn rate, runway, etc.
 */
import { useState } from 'react';
import { Settings2, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function InputField({ label, value, onChange, placeholder, note }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
      />
      {note && <p className="text-[9px] text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

export default function ReportSupuestos({ supuestos, onChange, onClose }) {
  const [local, setLocal] = useState({ ...supuestos });

  const set = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));
  const apply = () => { onChange(local); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-600" />
            <p className="text-sm font-bold text-slate-800">Supuestos editables</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 leading-relaxed">Los valores introducidos aquí son <strong>supuestos del usuario</strong>, no datos contables extraídos. El informe los marcará como estimaciones y los diferenciará claramente de los datos documentales.</p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Burn rate & Runway</p>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Gastos mensuales medios (€)" value={local.gastosMensuales} onChange={v => set('gastosMensuales', v)} placeholder="Ej. 25.000" note="Gastos operativos medios al mes" />
              <InputField label="Ingresos mensuales medios (€)" value={local.ingresosMensuales} onChange={v => set('ingresosMensuales', v)} placeholder="Ej. 30.000" note="Ingresos cobrados medios al mes" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Deuda y tesorería</p>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Deuda financiera confirmada (€)" value={local.deudaFinanciera} onChange={v => set('deudaFinanciera', v)} placeholder="Ej. 150.000" note="Si no figura en las cuentas 17x/52x" />
              <InputField label="Tesorería adicional (€)" value={local.tesoreria} onChange={v => set('tesoreria', v)} placeholder="Ej. 50.000" note="Si hay caja no reflejada en 57x" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Compromisos de pago</p>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Impuestos pendientes (€)" value={local.impuestosPendientes} onChange={v => set('impuestosPendientes', v)} placeholder="Ej. 12.000" />
              <InputField label="Pagos comprometidos (€)" value={local.pagosComprometidos} onChange={v => set('pagosComprometidos', v)} placeholder="Ej. 20.000" />
              <InputField label="Cobros pendientes esperados (€)" value={local.cobrosPendientes} onChange={v => set('cobrosPendientes', v)} placeholder="Ej. 40.000" />
              <InputField label="Vencimiento deuda corto (€)" value={local.vencimientoDeudaCp} onChange={v => set('vencimientoDeudaCp', v)} placeholder="Ej. 30.000" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">M&A — Ajustes EBITDA</p>
            <InputField label="Ajustes EBITDA (€, positivo = suma, negativo = resta)" value={local.ajustesEbitda} onChange={v => set('ajustesEbitda', v)} placeholder="Ej. 15.000 por gastos no recurrentes" note="Solo si existen ajustes identificados y documentados" />
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nivel de prudencia</p>
            <div className="flex gap-2">
              {['conservador', 'base', 'optimista'].map(nivel => (
                <button key={nivel} onClick={() => set('prudencia', nivel)}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize',
                    local.prudencia === nivel ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {nivel}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Cancelar</button>
          <button onClick={apply} className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800">Aplicar supuestos</button>
        </div>
      </div>
    </div>
  );
}