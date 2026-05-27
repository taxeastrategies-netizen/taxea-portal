import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Settings, ChevronRight, Send } from 'lucide-react';
import { getPeriodosDelModelo } from './aeatDeadlines';
import { Button } from '@/components/ui/button';
import PresentarModeloFlow from './PresentarModeloFlow';

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

function PeriodRow({ periodo, ejercicio, modeloCodigo, savedPeriod, invoices, onView, onPresentar }) {
  const cfg = ESTADO_CONFIG[savedPeriod?.estado || 'sin_datos'];
  const emitidas = invoices.filter(f => f.tipo === 'emitida' && !f.anulada && facturaEnPeriodo(f, periodo, ejercicio));
  const recibidas = invoices.filter(f => f.tipo === 'recibida' && !f.anulada && facturaEnPeriodo(f, periodo, ejercicio));
  const baseEmitida = emitidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const baseRecibida = recibidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const cuotaEmitida = emitidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const cuotaRecibida = recibidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const total = cuotaEmitida - cuotaRecibida;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <td className="py-3 px-4 text-sm text-gray-700 font-medium">
        {periodo === 'Anual' ? `Anual ${ejercicio}` : `${periodo === 'T1' ? '1' : periodo === 'T2' ? '2' : periodo === 'T3' ? '3' : '4'} Trimestre`}
      </td>
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
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView({ periodo, ejercicio, baseEmitida, baseRecibida, cuotaEmitida, cuotaRecibida, total, emitidas, recibidas })}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
            Ver <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {savedPeriod?.estado !== 'presentado' && savedPeriod?.estado !== 'no_aplica' && (
            <button onClick={() => onPresentar(periodo)}
              className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-0.5 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
              <Send className="w-3 h-3 mr-0.5" /> Presentar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ResumenImpuestos({ invoices, ejercicio }) {
  const facturas = invoices.filter(f => {
    const anio = f.anio || (f.fecha_emision && new Date(f.fecha_emision).getFullYear());
    return anio === ejercicio && !f.anulada;
  });

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
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Ventas</span>
            <div className="flex gap-12"><span>Subtotal</span><span>Importe</span></div>
          </div>
        </div>
        {ivaEmitidas.length === 0
          ? <div className="px-4 py-3 text-xs text-gray-400">Sin ventas este año</div>
          : ivaEmitidas.map(([tipo, v]) => (
            <div key={tipo} className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
              <span className="text-sm text-blue-600">{tipo}</span>
              <div className="flex gap-8 text-sm">
                <span className="text-gray-600 w-24 text-right">{fmt(v.base)}</span>
                <span className="text-gray-800 font-medium w-20 text-right">{fmt(v.cuota)}</span>
              </div>
            </div>
          ))}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 mt-1">
          <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Compras</span>
            <div className="flex gap-12"><span>Subtotal</span><span>Importe</span></div>
          </div>
        </div>
        {ivaRecibidas.length === 0
          ? <div className="px-4 py-3 text-xs text-gray-400">Sin compras este año</div>
          : ivaRecibidas.map(([tipo, v]) => (
            <div key={tipo} className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
              <span className="text-sm text-blue-600">{tipo}</span>
              <div className="flex gap-8 text-sm">
                <span className="text-gray-600 w-24 text-right">{fmt(v.base)}</span>
                <span className="text-gray-800 font-medium w-20 text-right">{fmt(v.cuota)}</span>
              </div>
            </div>
          ))}
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
  const [presentarFlow, setPresentarFlow] = useState(null); // { periodo }
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
  const displayModelo = selectedModelo
    ? activeModelos.find(m => m.codigo === selectedModelo)
    : activeModelos[0] || null;

  if (!companyId) return <div className="text-center py-16 text-sm text-gray-400">Selecciona un cliente.</div>;

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
    <>
      {presentarFlow && displayModelo && (
        <PresentarModeloFlow
          modelo={displayModelo.codigo}
          companyId={companyId}
          clienteNif={company?.taxId || ''}
          clienteNombre={company?.legalName || company?.displayName || ''}
          ejercicio={currentYear}
          periodo={presentarFlow.periodo}
          onClose={() => setPresentarFlow(null)}
          onPresentado={() => setPresentarFlow(null)}
        />
      )}

      <div className="flex gap-0 min-h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 border-r border-gray-200 flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modelos</p>
          </div>
          <div className="py-1">
            {activeModelos.map(m => {
              const isActive = displayModelo?.codigo === m.codigo;
              const modelPeriods = getPeriodosDelModelo(m.codigo, currentYear);
              const pendientes = modelPeriods.filter(p => {
                const sp = periods.find(s => s.modeloCodigo === m.codigo && s.periodo === p.periodo);
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
          {displayModelo && (
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
                <span className="text-sm text-gray-500">{currentYear}</span>
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
                          onPresentar={(periodo) => setPresentarFlow({ periodo })}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detail panel */}
              {detailData && (
                <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">Detalle — {detailData.periodo} {detailData.ejercicio}</h4>
                    <button onClick={() => setDetailData(null)} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {[
                      ['IVA repercutido', fmt(detailData.cuotaEmitida), `${detailData.emitidas.length} facturas · base ${fmt(detailData.baseEmitida)}`, 'text-blue-700'],
                      ['IVA soportado', fmt(detailData.cuotaRecibida), `${detailData.recibidas.length} facturas · base ${fmt(detailData.baseRecibida)}`, 'text-orange-600'],
                      ['Resultado', fmt(Math.abs(detailData.total)), detailData.total > 0 ? 'A ingresar' : detailData.total < 0 ? 'A devolver' : 'Cero', detailData.total > 0 ? 'text-red-600' : 'text-green-600'],
                    ].map(([label, val, sub, color]) => (
                      <div key={label} className="bg-white rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <p className={`font-bold ${color}`}>{val}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" className="gap-1.5 h-7 text-xs"
                      onClick={() => { setDetailData(null); setPresentarFlow({ periodo: detailData.periodo }); }}>
                      <Send className="w-3 h-3" /> Presentar modelo
                    </Button>
                  </div>
                </div>
              )}

              <ResumenImpuestos invoices={invoices} ejercicio={currentYear} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}