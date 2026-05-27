import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { AlertCircle, ChevronRight, RefreshCw, Settings, Calendar } from 'lucide-react';
import { getPeriodosDelModelo } from './aeatDeadlines';
import { Button } from '@/components/ui/button';
import ModeloPeriodsTable from './ModeloPeriodsTable';

const ESTADO_CONFIG = {
  sin_datos: { label: 'Sin datos', color: 'bg-gray-100 text-gray-600' },
  pendiente_configurar: { label: 'Pendiente configurar', color: 'bg-amber-100 text-amber-700' },
  calculado: { label: 'Calculado', color: 'bg-blue-100 text-blue-700' },
  borrador: { label: 'Borrador', color: 'bg-indigo-100 text-indigo-700' },
  pendiente_revision: { label: 'Pendiente revisión', color: 'bg-yellow-100 text-yellow-700' },
  revisado: { label: 'Revisado', color: 'bg-teal-100 text-teal-700' },
  listo_presentar: { label: 'Listo para presentar', color: 'bg-green-100 text-green-700' },
  presentado: { label: 'Presentado', color: 'bg-green-200 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  con_requerimiento: { label: 'Con requerimiento', color: 'bg-red-200 text-red-800' },
  sustitutiva: { label: 'Sustitutiva', color: 'bg-purple-100 text-purple-700' },
  no_aplica: { label: 'No aplica', color: 'bg-gray-100 text-gray-400' },
};

export default function ImpuestosPanel() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [selectedModelo, setSelectedModelo] = useState(null);
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

  const { data: filings = [] } = useQuery({
    queryKey: ['taxFilings', companyId],
    queryFn: () => base44.entities.TaxFiling.filter({ companyId }),
    enabled: !!companyId,
  });

  const activeModelos = modelos.filter(m => m.activo);

  // Próximos: usando plazos reales AEAT aunque no exista TaxPeriod guardado
  const today = new Date();
  const proximos = activeModelos.flatMap(m => {
    const periodos = getPeriodosDelModelo(m.codigo, currentYear);
    return periodos
      .map(p => {
        const savedPeriod = periods.find(sp => sp.modeloCodigo === m.codigo && sp.periodo === p.periodo);
        const diff = (new Date(p.presentacion) - today) / (1000 * 60 * 60 * 24);
        if (diff < 0 || diff > 45) return null;
        const estado = savedPeriod?.estado || 'sin_datos';
        if (estado === 'presentado' || estado === 'no_aplica') return null;
        return { ...p, modeloCodigo: m.codigo, fechaLimiteInterna: p.limiteInterno, estado };
      })
      .filter(Boolean);
  }).sort((a, b) => new Date(a.presentacion) - new Date(b.presentacion));

  if (!companyId) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Selecciona un cliente para ver el panel de impuestos.
      </div>
    );
  }

  if (activeModelos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <Settings className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">Configuración fiscal pendiente</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Antes de calcular modelos, configura las obligaciones fiscales del cliente en la pestaña <strong>Configuración fiscal</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar desde contabilidad
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Calendario fiscal
        </Button>
      </div>

      {/* KPI resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Modelos activos" value={activeModelos.length} />
        <KpiCard label="Períodos sin datos" value={periods.filter(p => p.estado === 'sin_datos' || !p.estado).length} warn />
        <KpiCard label="Listos para presentar" value={periods.filter(p => p.estado === 'listo_presentar').length} ok />
        <KpiCard label="Presentados este año" value={filings.filter(f => f.ejercicio === currentYear).length} />
      </div>

      {/* Próximos impuestos */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Próximos impuestos</h2>
        {proximos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No hay modelos a presentar en los próximos 45 días.
          </div>
        ) : (
          <div className="space-y-2">
            {proximos.map(p => {
              const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.sin_datos;
              const diasRestantes = Math.ceil((new Date(p.presentacion) - today) / (1000 * 60 * 60 * 24));
              return (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedModelo(p.modeloCodigo)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{p.modeloCodigo}</div>
                    <div>
                      <p className="text-sm font-medium">{p.modeloCodigo} — {p.periodo} {p.ejercicio}</p>
                      <p className="text-xs text-muted-foreground">Dom: {p.domiciliacion} · Pres: {p.presentacion} · {diasRestantes}d</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabla por modelo */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Períodos por modelo — {currentYear}</h2>
          <div className="flex gap-1">
            {activeModelos.slice(0, 8).map(m => (
              <button key={m.codigo} onClick={() => setSelectedModelo(selectedModelo === m.codigo ? null : m.codigo)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${selectedModelo === m.codigo ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {m.codigo}
              </button>
            ))}
          </div>
        </div>
        {selectedModelo ? (
          <ModeloPeriodsTable modeloCodigo={selectedModelo} companyId={companyId} year={currentYear} estadoConfig={ESTADO_CONFIG} />
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Selecciona un modelo arriba para ver sus períodos
          </div>
        )}
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        Presentación directa AEAT/ATC no disponible todavía. Puedes generar borrador o fichero para presentación externa.
      </div>
    </div>
  );
}

function KpiCard({ label, value, warn, ok }) {
  return (
    <div className={`rounded-xl border p-4 ${warn && value > 0 ? 'border-amber-200 bg-amber-50' : ok && value > 0 ? 'border-green-200 bg-green-50' : 'border-border bg-white'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold font-jakarta ${warn && value > 0 ? 'text-amber-700' : ok && value > 0 ? 'text-green-700' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}