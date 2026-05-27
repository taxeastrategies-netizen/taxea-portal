import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { getPeriodosDelModelo } from './aeatDeadlines';
import { Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const ESTADO_PERIODO = {
  sin_datos: { label: 'Sin datos', color: 'bg-gray-100 text-gray-500' },
  calculado: { label: 'Calculado', color: 'bg-blue-100 text-blue-700' },
  borrador: { label: 'Borrador', color: 'bg-indigo-100 text-indigo-700' },
  pendiente_revision: { label: 'Pendiente revisión', color: 'bg-yellow-100 text-yellow-700' },
  revisado: { label: 'Revisado', color: 'bg-teal-100 text-teal-700' },
  listo_presentar: { label: 'Listo', color: 'bg-green-100 text-green-700' },
  presentado: { label: 'Presentado', color: 'bg-green-200 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
};

function diasHasta(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));
}

function UrgencyBadge({ dias }) {
  if (dias === null) return null;
  if (dias < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Vencido</span>;
  if (dias <= 7) return <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">⚠ {dias}d</span>;
  if (dias <= 20) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{dias}d</span>;
  return <span className="text-xs text-muted-foreground">{dias}d</span>;
}

export default function CalendarioFiscalTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [ejercicio, setEjercicio] = useState(currentYear);

  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ['taxPeriods', companyId, ejercicio],
    queryFn: () => base44.entities.TaxPeriod.filter({ companyId, ejercicio }),
    enabled: !!companyId,
  });

  const activeModelos = modelos.filter(m => m.activo);

  // Construir calendario completo
  const calendario = activeModelos.flatMap(modelo => {
    const periodos = getPeriodosDelModelo(modelo.codigo, ejercicio);
    return periodos.map(p => {
      const savedPeriod = periods.find(sp => sp.modeloCodigo === modelo.codigo && sp.periodo === p.periodo);
      const diasPresentacion = diasHasta(p.presentacion);
      const diasDomiciliacion = diasHasta(p.domiciliacion);
      return {
        ...p,
        modeloCodigo: modelo.codigo,
        modeloNombre: modelo.nombre,
        administracion: modelo.administracion,
        estado: savedPeriod?.estado || 'sin_datos',
        importeConfirmado: savedPeriod?.importeConfirmado,
        diasPresentacion,
        diasDomiciliacion,
        urgente: diasPresentacion !== null && diasPresentacion >= 0 && diasPresentacion <= 20,
        vencido: diasPresentacion !== null && diasPresentacion < 0,
      };
    });
  }).sort((a, b) => new Date(a.presentacion) - new Date(b.presentacion));

  const proximos = calendario.filter(c => c.diasPresentacion !== null && c.diasPresentacion >= 0 && c.diasPresentacion <= 45 && c.estado !== 'presentado');
  const vencidos = calendario.filter(c => c.vencido && c.estado !== 'presentado');

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Calendario fiscal oficial — AEAT / ATC</h2>
        <div className="flex items-center gap-2">
          <select value={ejercicio} onChange={e => setEjercicio(Number(e.target.value))}
            className="text-sm border border-border rounded-md px-2 py-1 bg-white">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Alertas */}
      {vencidos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">{vencidos.length} plazo(s) vencido(s) sin presentar</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {vencidos.map(v => (
              <span key={`${v.modeloCodigo}-${v.periodo}`} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md font-medium">
                {v.modeloCodigo} {v.periodo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Próximos 45 días */}
      {proximos.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Próximos 45 días</h3>
          <div className="space-y-2">
            {proximos.map(item => {
              const cfg = ESTADO_PERIODO[item.estado] || ESTADO_PERIODO.sin_datos;
              return (
                <div key={`${item.modeloCodigo}-${item.periodo}`} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${item.administracion === 'ATC' ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary'}`}>
                      {item.modeloCodigo}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.administracion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Domiciliación</p>
                      <p className="text-xs font-medium">{item.domiciliacion}</p>
                      <UrgencyBadge dias={item.diasDomiciliacion} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Presentación / NRC</p>
                      <p className="text-xs font-medium">{item.presentacion}</p>
                      <UrgencyBadge dias={item.diasPresentacion} />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla completa del ejercicio */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Todos los plazos — {ejercicio}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Plazos oficiales AEAT/ATC. Domiciliación: cargo el último día del plazo de dom. NRC: mismo plazo que presentación telemática.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Modelo</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Período</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Adm.</th>
                <th className="text-center py-2.5 px-4 text-xs font-medium text-muted-foreground">Domiciliación</th>
                <th className="text-center py-2.5 px-4 text-xs font-medium text-muted-foreground">Presentación / NRC</th>
                <th className="text-center py-2.5 px-4 text-xs font-medium text-muted-foreground">Límite interno</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground">Importe</th>
                <th className="text-center py-2.5 px-4 text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {calendario.map((item, i) => {
                const cfg = ESTADO_PERIODO[item.estado] || ESTADO_PERIODO.sin_datos;
                const rowBg = item.vencido && item.estado !== 'presentado' ? 'bg-red-50' : item.urgente ? 'bg-amber-50/40' : '';
                return (
                  <tr key={`${item.modeloCodigo}-${item.periodo}`} className={`border-b border-border/50 hover:bg-muted/10 ${rowBg}`}>
                    <td className="py-2.5 px-4 font-semibold text-primary">{item.modeloCodigo}</td>
                    <td className="py-2.5 px-4 font-medium">{item.label}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.administracion === 'ATC' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.administracion}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-xs">{item.domiciliacion}</td>
                    <td className="py-2.5 px-4 text-center">
                      <p className="text-xs font-medium">{item.presentacion}</p>
                      {item.diasPresentacion !== null && item.estado !== 'presentado' && (
                        <UrgencyBadge dias={item.diasPresentacion} />
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center text-xs text-muted-foreground">{item.limiteInterno}</td>
                    <td className="py-2.5 px-4 text-right text-xs font-medium">
                      {item.importeConfirmado != null ? `${Number(item.importeConfirmado).toFixed(2)} €` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
              {calendario.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No hay modelos activos configurados para este cliente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota legal */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        Plazos conforme al calendario oficial del contribuyente AEAT y ATC. Si el último día es inhábil, el plazo se prorroga al siguiente día hábil.
        Domiciliación bancaria: el cargo en cuenta se produce el último día del plazo de presentación. 
        NRC (Número de Referencia Completo): debe obtenerse en la entidad bancaria antes del último día del plazo de presentación.
      </div>
    </div>
  );
}