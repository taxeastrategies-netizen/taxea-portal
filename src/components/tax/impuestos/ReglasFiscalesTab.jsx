import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Edit2, Trash2, Check, X } from 'lucide-react';

const REGLAS_PREDEFINIDAS = [
  { tipo: 'exencion', codigo: 'IVA-0', descripcion: 'Facturación exenta de IVA (art. 20 LIVA)', activa: true },
  { tipo: 'retencion', codigo: 'IRPF-7', descripcion: 'Retención IRPF 7% (inicio actividad)', activa: false },
  { tipo: 'retencion', codigo: 'IRPF-15', descripcion: 'Retención IRPF 15% (régimen general)', activa: true },
  { tipo: 'criterio_caja', codigo: 'RECC', descripcion: 'Régimen especial criterio de caja (RECC)', activa: false },
  { tipo: 'pro_rata', codigo: 'PRO-RATA', descripcion: 'Prorrata IVA (actividades mixtas exentas/sujetas)', activa: false },
  { tipo: 'recargo', codigo: 'RE', descripcion: 'Recargo de equivalencia (minoristas)', activa: false },
];

const TIPO_CONFIG = {
  exencion:    { label: 'Exención',    color: 'bg-blue-100 text-blue-700' },
  retencion:   { label: 'Retención',   color: 'bg-purple-100 text-purple-700' },
  criterio_caja: { label: 'Criterio caja', color: 'bg-amber-100 text-amber-700' },
  pro_rata:    { label: 'Prorrata',    color: 'bg-teal-100 text-teal-700' },
  recargo:     { label: 'Recargo Eq.', color: 'bg-orange-100 text-orange-700' },
};

export default function ReglasFiscalesTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [editingId, setEditingId] = useState(null);
  const [editNota, setEditNota] = useState('');

  // For now use TaxModel observations/notes as rule storage
  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  if (!companyId) return <div className="text-center py-16 text-sm text-gray-400">Selecciona un cliente.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Reglas fiscales aplicables</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configura las reglas que afectan al cálculo de impuestos del cliente</p>
        </div>
      </div>

      {/* Reglas predefinidas */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reglas estándar</p>
        </div>
        <div className="divide-y divide-gray-100">
          {REGLAS_PREDEFINIDAS.map((regla, i) => {
            const tc = TIPO_CONFIG[regla.tipo] || { label: regla.tipo, color: 'bg-gray-100 text-gray-600' };
            return (
              <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${regla.activa ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{regla.descripcion}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tc.color}`}>{tc.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Código: {regla.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${regla.activa ? 'text-green-600' : 'text-gray-400'}`}>
                    {regla.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Observaciones por modelo */}
      {modelos.filter(m => m.activo).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Observaciones por modelo</p>
          </div>
          <div className="divide-y divide-gray-100">
            {modelos.filter(m => m.activo).map(m => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 w-10">{m.codigo}</span>
                    <span className="text-sm text-gray-500">{m.observaciones || <span className="text-gray-300 italic">Sin observaciones</span>}</span>
                  </div>
                  <button onClick={() => { setEditingId(m.id); setEditNota(m.observaciones || ''); }}
                    className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {editingId === m.id && (
                  <div className="mt-2 flex gap-2">
                    <input value={editNota} onChange={e => setEditNota(e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Añade observaciones..." />
                    <button onClick={() => setEditingId(null)} className="text-xs text-green-600 hover:text-green-800 font-medium px-2">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        Las reglas activas afectan al cálculo automático de bases imponibles y tipos aplicables en cada modelo fiscal.
        Próximamente: integración con el motor de reglas para ajuste automático de casillas.
      </div>
    </div>
  );
}