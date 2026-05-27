import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { History, FileCheck, FilePen, Send, ChevronDown } from 'lucide-react';

const ESTADO_CONFIG = {
  presentado:        { label: 'Presentado',  color: 'bg-green-100 text-green-700', icon: FileCheck },
  borrador:          { label: 'Borrador',    color: 'bg-blue-100 text-blue-700',   icon: FilePen },
  aprobado:          { label: 'Aprobado',    color: 'bg-teal-100 text-teal-700',   icon: FileCheck },
  en_revision:       { label: 'En revisión', color: 'bg-yellow-100 text-yellow-700', icon: FilePen },
  rechazado:         { label: 'Rechazado',   color: 'bg-red-100 text-red-700',     icon: Send },
  con_requerimiento: { label: 'Requerimiento', color: 'bg-red-200 text-red-800',   icon: Send },
};

function fmt(n) { return n != null ? `${Number(n).toFixed(2)} €` : '—'; }

export default function HistorialFiscalTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [yearFilter, setYearFilter] = useState('todos');
  const currentYear = new Date().getFullYear();

  const { data: filings = [], isLoading: loadingFilings } = useQuery({
    queryKey: ['taxFilings', companyId],
    queryFn: () => base44.entities.TaxFiling.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: drafts = [], isLoading: loadingDrafts } = useQuery({
    queryKey: ['taxDrafts', companyId],
    queryFn: () => base44.entities.TaxDraft.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ['taxPeriods', companyId],
    queryFn: () => base44.entities.TaxPeriod.filter({ companyId }),
    enabled: !!companyId,
  });

  if (!companyId) return <div className="text-center py-16 text-sm text-gray-400">Selecciona un cliente.</div>;

  const years = [...new Set([
    ...filings.map(f => f.ejercicio),
    ...drafts.map(d => d.ejercicio),
  ])].filter(Boolean).sort((a, b) => b - a);

  const filteredFilings = yearFilter === 'todos' ? filings : filings.filter(f => f.ejercicio === parseInt(yearFilter));
  const filteredDrafts = yearFilter === 'todos' ? drafts : drafts.filter(d => d.ejercicio === parseInt(yearFilter));

  // Combine into timeline events
  const events = [
    ...filteredFilings.map(f => ({
      id: `f-${f.id}`,
      date: f.fechaPresentacion || f.created_date,
      tipo: 'presentacion',
      modelo: f.modeloCodigo,
      periodo: f.periodo,
      ejercicio: f.ejercicio,
      estado: f.estadoPresentacion || 'presentado',
      importe: f.importeFinal,
      via: f.via,
      justificante: f.numeroJustificante,
      notas: f.notas,
    })),
    ...filteredDrafts.map(d => ({
      id: `d-${d.id}`,
      date: d.updated_date || d.created_date,
      tipo: 'borrador',
      modelo: d.modeloCodigo,
      periodo: d.periodo,
      ejercicio: d.ejercicio,
      estado: d.estado,
      importe: null,
      notas: d.notas,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Historial fiscal</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registro de borradores y presentaciones realizadas</p>
        </div>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
          <option value="todos">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
          <option value={currentYear}>{currentYear}</option>
        </select>
      </div>

      {loadingFilings || loadingDrafts ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando historial...</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 rounded-xl">
          <History className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">Sin historial registrado</p>
          <p className="text-xs text-gray-400 max-w-xs">Las presentaciones y borradores aprobados aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-0 border-b border-gray-200">
            <div className="px-4 py-3 border-r border-gray-200">
              <p className="text-xs text-gray-400">Presentaciones</p>
              <p className="text-xl font-bold text-gray-800">{filteredFilings.length}</p>
            </div>
            <div className="px-4 py-3 border-r border-gray-200">
              <p className="text-xs text-gray-400">Borradores</p>
              <p className="text-xl font-bold text-gray-800">{filteredDrafts.length}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400">Total ingresado</p>
              <p className="text-xl font-bold text-red-600">
                {fmt(filteredFilings.reduce((s, f) => s + (f.importeFinal > 0 ? f.importeFinal : 0), 0))}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="divide-y divide-gray-100">
            {events.map(ev => {
              const cfg = ESTADO_CONFIG[ev.estado] || { label: ev.estado, color: 'bg-gray-100 text-gray-600', icon: FilePen };
              const Icon = cfg.icon;
              const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
              return (
                <div key={ev.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ev.tipo === 'presentacion' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    <Icon className={`w-4 h-4 ${ev.tipo === 'presentacion' ? 'text-green-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{ev.modelo}</span>
                      <span className="text-sm text-gray-500">— {ev.periodo} {ev.ejercicio}</span>
                      {ev.justificante && <span className="text-xs text-gray-400 font-mono">#{ev.justificante}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{dateStr}</span>
                      {ev.via && <span className="text-xs text-gray-400">· {ev.via.replace(/_/g, ' ')}</span>}
                      {ev.notas && <span className="text-xs text-gray-400 truncate">· {ev.notas}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {ev.importe != null && (
                      <span className={`text-sm font-semibold ${ev.importe > 0 ? 'text-red-600' : ev.importe < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {fmt(Math.abs(ev.importe))}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}