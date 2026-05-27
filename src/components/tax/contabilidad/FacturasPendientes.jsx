import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Search, Eye, CheckCircle, XCircle, AlertCircle, Clock, ArrowUpCircle, ArrowDownCircle, Ban, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AsientoProposalModal from './AsientoProposalModal';

const ESTADO_CFG = {
  pendiente:           { label: 'Pendiente', color: 'bg-slate-100 text-slate-600', icon: Clock },
  asiento_propuesto:   { label: 'Asiento propuesto', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  contabilizada:       { label: 'Contabilizada', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rechazada:           { label: 'Rechazada', color: 'bg-red-100 text-red-700', icon: XCircle },
  requiere_correccion: { label: 'Requiere corrección', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

export default function FacturasPendientes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todas');
  const [filterEstado, setFilterEstado] = useState('todas');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAnuladas, setShowAnuladas] = useState(false);
  const [anularTarget, setAnularTarget] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-contabilidad'],
    queryFn: () => base44.entities.Invoice.list('-fecha_emision', 200),
  });

  const markRechazada = useMutation({
    mutationFn: (id) => base44.entities.Invoice.update(id, { estado_contable: 'rechazada' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices-contabilidad'] }),
  });

  const anularFactura = useMutation({
    mutationFn: async ({ id, motivo, journalEntryId }) => {
      await base44.entities.Invoice.update(id, {
        anulada: true,
        fecha_anulacion: new Date().toISOString(),
        motivo_anulacion: motivo,
      });
      if (journalEntryId) {
        await base44.entities.JournalEntry.update(journalEntryId, { status: 'anulado' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices-contabilidad'] });
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      setAnularTarget(null);
      setMotivoAnulacion('');
    },
  });

  const eliminarFactura = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices-contabilidad'] }),
  });

  const activas = invoices.filter(i => !i.anulada);
  const anuladas = invoices.filter(i => i.anulada);
  const lista = showAnuladas ? anuladas : activas;

  const filtered = lista.filter(inv => {
    const matchTipo = filterTipo === 'todas' || inv.tipo === filterTipo;
    const matchEstado = filterEstado === 'todas' || inv.estado_contable === filterEstado;
    const matchSearch = !search ||
      inv.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      inv.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      inv.proveedor_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      inv.concepto?.toLowerCase().includes(search.toLowerCase());
    return matchTipo && matchEstado && matchSearch;
  });

  const pendientes = activas.filter(i => i.estado_contable === 'pendiente' || i.estado_contable === 'asiento_propuesto').length;
  const contabilizadas = activas.filter(i => i.estado_contable === 'contabilizada').length;
  const errores = activas.filter(i => i.estado_contable === 'requiere_correccion' || i.estado_contable === 'rechazada').length;

  const openModal = (inv) => { setSelectedInvoice(inv); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelectedInvoice(null); };

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando facturas...</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes de contabilizar', value: pendientes, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Contabilizadas', value: contabilizadas, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Con errores / rechazadas', value: errores, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(k => (
          <div key={k.label} className={cn('rounded-xl p-4 border', k.color)}>
            <p className="text-2xl font-bold font-jakarta">{k.value}</p>
            <p className="text-xs mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Toggle activas / anuladas */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAnuladas(false)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${!showAnuladas ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:border-foreground'}`}
        >Activas ({activas.length})</button>
        <button
          onClick={() => setShowAnuladas(true)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${showAnuladas ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border hover:border-red-400'}`}
        >Anuladas ({anuladas.length})</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por número, cliente, proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="emitida">Emitidas</SelectItem>
            <SelectItem value="recibida">Recibidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CFG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground">Todavía no hay facturas registradas</p>
          <p className="text-sm text-muted-foreground">Sube facturas de ingresos o gastos para empezar a construir el diario contable.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          No hay facturas que coincidan con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Tipo</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Nº Factura</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Cliente / Proveedor</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Concepto</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Base</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Estado contable</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => {
                const cfg = ESTADO_CFG[inv.estado_contable] || ESTADO_CFG.pendiente;
                const Icon = cfg.icon;
                const esEmitida = inv.tipo === 'emitida';
                return (
                  <tr key={inv.id} className={cn('hover:bg-muted/20 transition-colors', inv.anulada && 'opacity-60 line-through-none')}>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', esEmitida ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
                        {esEmitida ? <ArrowUpCircle className="w-2.5 h-2.5" /> : <ArrowDownCircle className="w-2.5 h-2.5" />}
                        {esEmitida ? 'Emitida' : 'Recibida'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-medium">
                      {inv.numero_factura}
                      {inv.anulada && <span className="ml-1.5 text-[9px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full not-italic">ANULADA</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.fecha_emision}</td>
                    <td className="px-4 py-2.5">{inv.cliente_nombre || inv.proveedor_nombre || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-40 truncate">{inv.concepto || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(inv.base_imponible)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmt(inv.total_factura)}</td>
                    <td className="px-4 py-2.5">
                      {inv.anulada ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          <Ban className="w-2.5 h-2.5" /> Anulada
                        </span>
                      ) : (
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-2.5 h-2.5" /> {cfg.label}
                        </span>
                      )}
                      {inv.anulada && inv.motivo_anulacion && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-32 truncate" title={inv.motivo_anulacion}>{inv.motivo_anulacion}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {inv.archivo_url && (
                          <a href={inv.archivo_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Eye className="w-3 h-3" /></Button>
                          </a>
                        )}
                        {!inv.anulada && (inv.estado_contable === 'pendiente' || inv.estado_contable === 'asiento_propuesto' || inv.estado_contable === 'requiere_correccion') && (
                          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => openModal(inv)}>
                            {inv.estado_contable === 'asiento_propuesto' ? 'Ver asiento' : 'Proponer asiento'}
                          </Button>
                        )}
                        {!inv.anulada && inv.estado_contable === 'pendiente' && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground hover:bg-muted"
                            onClick={() => markRechazada.mutate(inv.id)}>
                            Rechazar
                          </Button>
                        )}
                        {!inv.anulada && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50 gap-1"
                            onClick={() => { setAnularTarget(inv); setMotivoAnulacion(''); }}>
                            <Ban className="w-2.5 h-2.5" /> Anular
                          </Button>
                        )}
                        {inv.anulada && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-700 hover:bg-red-50 gap-1"
                            onClick={() => { if (confirm(`¿Eliminar definitivamente la factura ${inv.numero_factura}? Esta acción no se puede deshacer.`)) eliminarFactura.mutate(inv.id); }}>
                            <Trash2 className="w-2.5 h-2.5" /> Eliminar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Asiento proposal modal */}
      {showModal && selectedInvoice && (
        <AsientoProposalModal
          invoice={selectedInvoice}
          onClose={closeModal}
          onConfirmed={() => { qc.invalidateQueries({ queryKey: ['invoices-contabilidad'] }); qc.invalidateQueries({ queryKey: ['journal-entries'] }); closeModal(); }}
        />
      )}

      {/* Modal anular factura */}
      {anularTarget && (
        <Dialog open onOpenChange={() => setAnularTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-jakarta flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600" /> Anular factura {anularTarget.numero_factura}
              </DialogTitle>
            </DialogHeader>
            {anularTarget.linked_journal_entry_id && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                ⚠️ Esta factura tiene un asiento contable vinculado. Al anularla, el asiento también quedará marcado como <strong>anulado</strong>.
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium">Motivo de anulación <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-input rounded-md px-3 py-2 text-sm"
                placeholder="Ej: Error en importe, factura duplicada, acuerdo con cliente..."
                value={motivoAnulacion}
                onChange={e => setMotivoAnulacion(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAnularTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={!motivoAnulacion.trim() || anularFactura.isPending}
                onClick={() => anularFactura.mutate({ id: anularTarget.id, motivo: motivoAnulacion, journalEntryId: anularTarget.linked_journal_entry_id })}
              >
                {anularFactura.isPending ? 'Anulando...' : 'Confirmar anulación'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}