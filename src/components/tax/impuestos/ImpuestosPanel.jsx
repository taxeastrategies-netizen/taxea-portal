import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Settings, ChevronRight, Eye } from 'lucide-react';
import { getPeriodosDelModelo, getDeadlines } from './aeatDeadlines';
import { Button } from '@/components/ui/button';

const ESTADO_CONFIG = {
  sin_datos:            { label: 'Pendiente',   color: 'text-gray-500',  dot: 'bg-gray-400' },
  pendiente_configurar: { label: 'Pendiente',   color: 'text-gray-500',  dot: 'bg-gray-400' },
  calculado:            { label: 'Borrador',    color: 'text-blue-600',  dot: 'bg-blue-500' },
  borrador:             { label: 'Borrador',    color: 'text-blue-600',  dot: 'bg-blue-500' },
  pendiente_revision:   { label: 'En revisión', color: 'text-yellow-600',dot: 'bg-yellow-500' },
  revisado:             { label: 'Revisado',    color: 'text-teal-600',  dot: 'bg-teal-500' },
  listo_presentar:      { label: 'Listo',       color: 'text-green-600', dot: 'bg-green-500' },
  presentado:           { label: 'Presentado',  color: 'text-green-700', dot: 'bg-green-600' },
  rechazado:            { label: 'Rechazado',   color: 'text-red-600',   dot: 'bg-red-500' },
  con_requerimiento:    { label: 'Req.',         color: 'text-red-700',   dot: 'bg-red-600' },
  no_aplica:            { label: 'No aplica',   color: 'text-gray-400',  dot: 'bg-gray-300' },
};

function fmt(n) { return n != null ? `${Number(n).toFixed(2)} €` : '0,00 €'; }

function facturaEnPeriodo(f, periodo, ejercicio) {
  const anio = f.anio || (f.fecha_emision && new Date(f.fecha_emision).getFullYear());
  if (anio !== ejercicio) return false;
  if (periodo === 'Anual') return true;
  const mes = f.fecha_emision ? new Date(f.fecha_emision).getMonth() + 1 : null;
  if (!mes) return false;
  const t = mes <= 3 ? 'T1' : mes <= 6 ? 'T2' : mes <= 9 ? 'T3' : 'T4';
  return t === periodo;
}

function PeriodRow({ periodo, ejercicio, modeloCodigo, savedPeriod, invoices, onView }) {
  const cfg = ESTADO_CONFIG[savedPeriod?.estado || 'sin_datos'];
  const emitidas = invoices.filter(f => f.tipo === 'emitida' && !f.anulada && facturaEnPeriodo(f, periodo, ejercicio));
  const recibidas = invoices.filter(f => f.tipo === 'recibida' && !f.anulada && facturaEnPeriodo(f, periodo, ejercicio));
  const baseEmitida = emitidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const baseRecibida = recibidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const cuotaEmitida = emitidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const cuotaRecibida = recibidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const total = cuotaEmitida - cuotaRecibida;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 text-sm text-gray-700 font-medium">{periodo === 'Anual' ? `Anual ${ejercicio}` : `${periodo === 'T1' ? '1' : periodo === 'T2' ? '2' : periodo === 'T3' ? '3' : '4'} Trimestre`}</td>
      <td className="py-3 px-4 text-sm text-gray-600 text-right">{emitidas.length > 0 ? fmt(baseEmitida) : <span className="text-gray-300">—</span>}</td>
      <td className="py-3 px-4 text-sm text-gray-600 text-right">{recibidas.length > 0 ? fmt(baseRecibida) : <span className="text-gray-300">—</span>}</td>
      <td className="py-3 px-4 text-sm font-semibold text-right">
        {emitidas.length + recibidas.length > 0 ? (
          <span className={total > 0 ? 'text-red-600' : total < 0 ? 'text-green-600' : 'text-gray-500'}>
            {fmt(Math.abs(total))}
          </span>
        ) : <span className="text-gray-300">0</span>}
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <button onClick={() => onView({ periodo, ejercicio, baseEmitida, baseRecibida, cuotaEmitida, cuotaRecibida, total, emitidas, recibidas })}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 ml-auto">
          Ver <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function ResumenImpuestos({ invoices, ejercicio }) {
  const currentYear = ejercicio;
  const facturas = invoices.filter(f => {
    const anio = f.anio || (f.fecha_emision && new Date(f.fecha_emision).getFullYear());
    return anio === currentYear && !f.anulada;
  });

  // Group by IVA type
  const emitidas = facturas.filter(f => f.tipo === 'emitida');
  const recibidas = facturas.filter(f => f.tipo === 'recibida');

  const groupByIva = (list) => {
    const map = {};
    list.forEach(f => {
      const tipo = f.tipo_iva != null ? `IVA ${f.tipo_iva}%` : 'IVA 21%';
      if (!map[tipo]) map[tipo] = { base: 0, cuota: 0 };
      map[tipo].base += f.base_imponible || 0;
      map[tipo].cuota += f.cuota_iva || 0;
    });
    return Object.entries(map).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  };

  const ivaEmitidas = groupByIva(emitidas);
  const ivaRecibidas = groupByIva(recibidas);
  const totalRepercutido = emitidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const totalSoportado = recibidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const resultado = totalRepercutido - totalSoportado;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Resumen de impuestos</h3>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Ventas */}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Ventas</span>
            <div className="flex gap-12">
              <span>Subtotal</span>
              <span>Importe</span>
            </div>
          </div>
        </div>
        {ivaEmitidas.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-400">Sin ventas este año</div>
        ) : ivaEmitidas.map(([tipo, v]) => (
          <div key={tipo} className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
            <span className="text-sm text-blue-600 hover:underline cursor-pointer">{tipo}</span>
            <div className="flex gap-8 text-sm">
              <span className="text-gray-600 w-24 text-right">{fmt(v.base)}</span>
              <span className="text-gray-800 font-medium w-20 text-right">{fmt(v.cuota)}</span>
            </div>
          </div>
        ))}
        {/* Compras */}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 border-t border-gray-200 mt-1">
          <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Compras</span>
            <div className="flex gap-12">
              <span>Subtotal</span>
              <span>Importe</span>
            </div>
          </div>
        </div>
        {ivaRecibidas.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-400">Sin compras este año</div>
        ) : ivaRecibidas.map(([tipo, v]) => (
          <div key={tipo} className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
            <span className="text-sm text-blue-600 hover:underline cursor-pointer">{tipo}</span>
            <div className="flex gap-8 text-sm">
              <span className="text-gray-600 w-24 text-right">{fmt(v.base)}</span>
              <span className="text-gray-800 font-medium w-20 text-right">{fmt(v.cuota)}</span>
            </div>
          </div>
        ))}
        {/* Resultado */}
        <div className={`flex justify-between items-center px-4 py-3 ${resultado > 0 ? 'bg-red-50' : resultado < 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
          <span className="text-sm font-semibold text-gray-800">Resultado neto</span>
          <span className={`text-base font-bold ${resultado > 0 ? 'text-red-600' : resultado < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {fmt(Math.abs(resultado))} {resultado > 0 ? '(a ingresar)' : resultado < 0 ? '(a devolver)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ImpuestosPanel({ onGoToConfig }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [selectedModelo, setSelectedModelo] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const currentYear = new Date().getFullYear();

  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ['taxPeriods', companyId, currentYear],
    queryFn: () => base44.entities.TaxPeriod.filter({ companyId, ejercicio: currentYear }),
    enabled: !!companyId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => base44.entities.Invoice.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const activeModelos = modelos.filter(m => m.activo);
  const currentModelo = selectedModelo
    ? activeModelos.find(m => m.codigo === selectedModelo)
    : activeModelos[0];

  // Auto-select first model
  const displayModelo = currentModelo || (activeModelos.length > 0 ? activeModelos[0] : null);

  if (!companyId) return <div className="text-center py-16 text-sm text-gray-400">Selecciona un cliente para ver el panel de impuestos.</div>;

  if (activeModelos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Settings className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">No hay modelos a presentar</h3>
        <p className="text-sm text-gray-500 max-w-xs mb-5">Accede a todos tus modelos haciendo clic en mostrar todos.</p>
        <Button size="sm" onClick={onGoToConfig}>Configurar modelos</Button>
      </div>
    );
  }

  const periodosList = displayModelo ? getPeriodosDelModelo(displayModelo.codigo, currentYear) : [];

  return (
    <div className="flex gap-0 min-h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Left sidebar: model list */}
      <div className="w-56 border-r border-gray-200 flex-shrink-0">
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modelos</p>
        </div>
        <div className="py-1">
          {activeModelos.map(m => {
            const isActive = (displayModelo?.codigo === m.codigo);
            const modelPeriods = getPeriodosDelModelo(m.codigo, currentYear);
            const pendientes = modelPeriods.filter(p => {
              const sp = periods.find(sp => sp.modeloCodigo === m.codigo && sp.periodo === p.periodo);
              return !sp || (sp.estado !== 'presentado' && sp.estado !== 'no_aplica');
            }).length;
            return (
              <button key={m.codigo}
                onClick={() => { setSelectedModelo(m.codigo); setDetailData(null); }}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${isActive ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{m.codigo}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[130px]">{m.nombre || (m.periodicidad === 'anual' ? 'Anual' : 'Trimestral')}</p>
                </div>
                {pendientes > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">{pendientes}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-auto">
        {displayModelo ? (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-800">{displayModelo.codigo}</span>
                <span className="text-base text-gray-500 font-medium">{displayModelo.nombre || `Modelo ${displayModelo.codigo}`}</span>
                <span className="text-sm text-gray-400 ml-1">
                  {displayModelo.periodicidad === 'anual' ? '· Anual' : displayModelo.periodicidad === 'mensual' ? '· Mensual' : '· Trimestral'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{currentYear}</span>
              </div>
            </div>

            {/* Period table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Período</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Facturas de venta</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Facturas de compra</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Total a pagar</th>
                    <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-500">Estado</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {periodosList.map(p => {
                    const savedPeriod = periods.find(sp => sp.modeloCodigo === displayModelo.codigo && sp.periodo === p.periodo);
                    return (
                      <PeriodRow
                        key={p.periodo}
                        periodo={p.periodo}
                        ejercicio={currentYear}
                        modeloCodigo={displayModelo.codigo}
                        savedPeriod={savedPeriod}
                        invoices={invoices}
                        onView={setDetailData}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail drawer */}
            {detailData && (
              <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">Detalle — {detailData.periodo} {detailData.ejercicio}</h4>
                  <button onClick={() => setDetailData(null)} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">IVA repercutido</p>
                    <p className="font-bold text-blue-700">{fmt(detailData.cuotaEmitida)}</p>
                    <p className="text-xs text-gray-400">{detailData.emitidas.length} facturas · base {fmt(detailData.baseEmitida)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">IVA soportado</p>
                    <p className="font-bold text-orange-600">{fmt(detailData.cuotaRecibida)}</p>
                    <p className="text-xs text-gray-400">{detailData.recibidas.length} facturas · base {fmt(detailData.baseRecibida)}</p>
                  </div>
                  <div className={`bg-white rounded-lg p-3 border ${detailData.total > 0 ? 'border-red-200' : 'border-green-200'}`}>
                    <p className="text-xs text-gray-500 mb-1">Resultado</p>
                    <p className={`font-bold text-lg ${detailData.total > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(Math.abs(detailData.total))}</p>
                    <p className="text-xs text-gray-400">{detailData.total > 0 ? 'A ingresar' : detailData.total < 0 ? 'A devolver' : 'Cero'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen de impuestos */}
            <ResumenImpuestos invoices={invoices} ejercicio={currentYear} />
          </div>
        ) : null}
      </div>
    </div>
  );
}