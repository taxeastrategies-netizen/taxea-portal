import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { FilePen, CheckCircle, ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { mesATrimestreLabel } from './aeatDeadlines';

const ESTADO_CONFIG = {
  borrador: { label: 'Borrador', color: 'bg-indigo-100 text-indigo-700' },
  en_revision: { label: 'En revisión', color: 'bg-yellow-100 text-yellow-700' },
  revisado: { label: 'Revisado', color: 'bg-teal-100 text-teal-700' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
};

function fmt(n) { return n != null ? `${Number(n).toFixed(2)} €` : '—'; }

/**
 * Determina si una factura pertenece a un periodo trimestral
 */
function facturaEnPeriodo(factura, periodo, ejercicio) {
  const anio = factura.anio || (factura.fecha_emision && new Date(factura.fecha_emision).getFullYear());
  if (anio !== ejercicio) return false;
  if (periodo === 'Anual') return true;
  const trimestre = factura.trimestre || (factura.fecha_emision && mesATrimestreLabel(new Date(factura.fecha_emision).getMonth() + 1));
  return trimestre === periodo;
}

function DraftDetail({ draft, invoices, journalEntries, onClose }) {
  const emitidas = invoices.filter(f => f.tipo === 'emitida' && !f.anulada && facturaEnPeriodo(f, draft.periodo, draft.ejercicio));
  const recibidas = invoices.filter(f => f.tipo === 'recibida' && !f.anulada && facturaEnPeriodo(f, draft.periodo, draft.ejercicio));
  const contabilizadas = invoices.filter(f => !f.anulada && facturaEnPeriodo(f, draft.periodo, draft.ejercicio) && (f.estado_contable === 'contabilizada' || f.linked_journal_entry_id));
  const pendientesContab = invoices.filter(f => !f.anulada && facturaEnPeriodo(f, draft.periodo, draft.ejercicio) && f.estado_contable !== 'contabilizada' && !f.linked_journal_entry_id);

  const baseEmitida = emitidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const cuotaEmitida = emitidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const baseRecibida = recibidas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const cuotaRecibida = recibidas.reduce((s, f) => s + (f.cuota_iva || 0), 0);
  const resultado = cuotaEmitida - cuotaRecibida;

  return (
    <div className="border border-border rounded-xl bg-white mt-3 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Borrador {draft.modeloCodigo} — {draft.periodo} {draft.ejercicio}</h3>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onClose}>Cerrar</Button>
      </div>

      {/* Alertas de datos */}
      {pendientesContab.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>{pendientesContab.length} factura(s)</strong> del período aún no están contabilizadas. El importe puede ser incompleto.
            <span className="block mt-0.5">Ve a <strong>Contabilidad → Facturas pendientes</strong> para contabilizarlas.</span>
          </p>
        </div>
      )}

      {/* Resumen de casillas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">IVA REPERCUTIDO (ventas)</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span>Facturas emitidas</span><span className="font-medium">{emitidas.length}</span></div>
            <div className="flex justify-between"><span>Base imponible</span><span className="font-medium">{fmt(baseEmitida)}</span></div>
            <div className="flex justify-between text-blue-700 font-semibold"><span>Cuota IVA repercutida</span><span>{fmt(cuotaEmitida)}</span></div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">IVA SOPORTADO (compras)</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span>Facturas recibidas</span><span className="font-medium">{recibidas.length}</span></div>
            <div className="flex justify-between"><span>Base imponible</span><span className="font-medium">{fmt(baseRecibida)}</span></div>
            <div className="flex justify-between text-orange-700 font-semibold"><span>Cuota IVA soportada</span><span>{fmt(cuotaRecibida)}</span></div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className={`rounded-lg p-3 flex items-center justify-between ${resultado >= 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        <p className="text-sm font-semibold">Resultado del período</p>
        <div className="text-right">
          <p className={`text-lg font-bold ${resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(resultado)}</p>
          <p className="text-xs text-muted-foreground">{resultado >= 0 ? 'A ingresar' : 'A devolver / compensar'}</p>
        </div>
      </div>

      {/* Trazabilidad */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Trazabilidad — {contabilizadas.length} de {emitidas.length + recibidas.length} facturas contabilizadas
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {[...emitidas, ...recibidas].map(f => (
            <div key={f.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30">
              <div className="flex items-center gap-2">
                {(f.estado_contable === 'contabilizada' || f.linked_journal_entry_id)
                  ? <CheckCircle className="w-3 h-3 text-green-500" />
                  : <AlertCircle className="w-3 h-3 text-amber-400" />}
                <span className="font-medium">{f.numero_factura}</span>
                <span className="text-muted-foreground">{f.tipo === 'emitida' ? f.cliente_nombre : f.proveedor_nombre}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{fmt(f.cuota_iva)}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${f.estado_contable === 'contabilizada' || f.linked_journal_entry_id ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                  {f.estado_contable === 'contabilizada' || f.linked_journal_entry_id ? 'Contabilizada' : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
          {emitidas.length + recibidas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Sin datos suficientes para calcular el modelo. Pendiente de facturas contabilizadas.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Info className="w-3 h-3" />
        Los importes proceden exclusivamente de facturas reales. Los ajustes manuales se añadirán en la próxima fase.
      </div>
    </div>
  );
}

export default function BorradoresTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['taxDrafts', companyId],
    queryFn: () => base44.entities.TaxDraft.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => base44.entities.Invoice.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: journalEntries = [] } = useQuery({
    queryKey: ['journalEntries', companyId],
    queryFn: () => base44.entities.JournalEntry.filter({ companyId, status: 'confirmado' }),
    enabled: !!companyId,
  });

  const updateDraft = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaxDraft.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxDrafts', companyId] }),
  });

  // Crear borrador desde período
  const createDraft = useMutation({
    mutationFn: ({ modeloCodigo, periodo, ejercicio }) => base44.entities.TaxDraft.create({
      companyId, modeloCodigo, periodo, ejercicio,
      version: 1,
      estado: 'borrador',
      origenDatos: 'facturas_asientos',
      usuarioCreador: user?.email,
    }),
    onSuccess: (newDraft) => {
      qc.invalidateQueries({ queryKey: ['taxDrafts', companyId] });
      setExpandedId(newDraft.id);
    },
  });

  const activeModelos = modelos.filter(m => m.activo);
  const currentYear = new Date().getFullYear();

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Borradores de modelos fiscales</h2>
        <p className="text-xs text-muted-foreground">Calculados desde facturas y asientos reales</p>
      </div>

      {/* Crear nuevo borrador */}
      {activeModelos.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Crear nuevo borrador</p>
          <div className="flex flex-wrap gap-2">
            {activeModelos.map(m => (
              ['T1','T2','T3','T4'].map(p => {
                const exists = drafts.find(d => d.modeloCodigo === m.codigo && d.periodo === p && d.ejercicio === currentYear);
                if (exists) return null;
                return (
                  <Button key={`${m.codigo}-${p}`} size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => createDraft.mutate({ modeloCodigo: m.codigo, periodo: p, ejercicio: currentYear })}>
                    <FilePen className="w-3 h-3" /> {m.codigo} {p}
                  </Button>
                );
              })
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
          <FilePen className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No hay borradores creados</p>
          <p className="text-xs text-muted-foreground max-w-sm">Pulsa un botón arriba para crear un borrador. Los importes se calcularán automáticamente desde facturas reales y asientos confirmados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(d => {
            const cfg = ESTADO_CONFIG[d.estado] || ESTADO_CONFIG.borrador;
            const isExpanded = expandedId === d.id;
            const facturasPeriodo = invoices.filter(f => !f.anulada && facturaEnPeriodo(f, d.periodo, d.ejercicio));
            const contabilizadas = facturasPeriodo.filter(f => f.estado_contable === 'contabilizada' || f.linked_journal_entry_id);
            const pendientes = facturasPeriodo.length - contabilizadas.length;

            return (
              <div key={d.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{d.modeloCodigo}</div>
                    <div>
                      <p className="text-sm font-medium">{d.modeloCodigo} — {d.periodo} {d.ejercicio} <span className="text-muted-foreground font-normal">v{d.version}</span></p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{contabilizadas.length}/{facturasPeriodo.length} facturas contabilizadas</span>
                        {pendientes > 0 && <span className="text-xs text-amber-600 font-medium">· {pendientes} pendiente(s)</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    <div className="flex gap-1">
                      {d.estado === 'borrador' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600" onClick={e => { e.stopPropagation(); updateDraft.mutate({ id: d.id, data: { estado: 'en_revision' } }); }}>
                          Enviar a revisión
                        </Button>
                      )}
                      {d.estado === 'en_revision' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={e => { e.stopPropagation(); updateDraft.mutate({ id: d.id, data: { estado: 'aprobado' } }); }}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                        </Button>
                      )}
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <DraftDetail
                      draft={d}
                      invoices={invoices}
                      journalEntries={journalEntries}
                      onClose={() => setExpandedId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        Los borradores calculan automáticamente base imponible y cuota IVA de las facturas reales del período. Las facturas no contabilizadas se marcan como pendientes.
      </div>
    </div>
  );
}