import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Download, Eye, MoreVertical, FileText, Send, Ban, Trash2, TrendingUp, CalendarDays, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import InvoiceForm from '@/components/facturas/InvoiceForm';
import InvoiceViewer from '@/components/facturas/InvoiceViewer';
import InvoiceDocumentWorkspace from '@/components/facturas/InvoiceDocumentWorkspace';
import SendInvoiceDocumentModal from '@/components/facturas/SendInvoiceDocumentModal';
import { cn } from '@/lib/utils';

export default function Facturas() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [filterTipo, setFilterTipo] = useState('emitida');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  // workspaceInvoice: factura abierta en la vista completa de documento
  const [workspaceInvoice, setWorkspaceInvoice] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(null);
  const [showAnuladas, setShowAnuladas] = useState(false);
  const [anularTarget, setAnularTarget] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  useEffect(() => {
    if (company?.id) loadInvoices();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const loadInvoices = async () => {
    setLoading(true);
    const data = await base44.entities.Invoice.filter({ company_id: company.id });
    setInvoices(data || []);
    setLoading(false);
  };

  const handleAnular = async () => {
    if (!anularTarget || !motivoAnulacion.trim()) return;
    setAnulando(true);
    await base44.entities.Invoice.update(anularTarget.id, {
      anulada: true,
      fecha_anulacion: new Date().toISOString(),
      motivo_anulacion: motivoAnulacion,
    });
    if (anularTarget.linked_journal_entry_id) {
      await base44.entities.JournalEntry.update(anularTarget.linked_journal_entry_id, { status: 'anulado' });
    }
    setAnulando(false);
    setAnularTarget(null);
    setMotivoAnulacion('');
    loadInvoices();
  };

  const handleEliminar = async (inv) => {
    if (!confirm(`¿Eliminar definitivamente la factura ${inv.numero_factura}? Esta acción no se puede deshacer.`)) return;
    await base44.entities.Invoice.delete(inv.id);
    loadInvoices();
  };

  const openEdit = (inv) => { setEditing(inv); setShowForm(true); };
  const openNew = () => { setEditing(null); setShowForm(true); };

  const updateEstado = async (id, field, value) => {
    await base44.entities.Invoice.update(id, { [field]: value });
    loadInvoices();
    // Actualizar factura en workspace si está abierta
    if (workspaceInvoice?.id === id) {
      setWorkspaceInvoice(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleOpenWorkspace = (inv) => {
    setWorkspaceInvoice(inv);
  };

  const handleCloseWorkspace = () => {
    setWorkspaceInvoice(null);
    loadInvoices(); // Refrescar listado al volver
  };

  const handleSend = (inv) => {
    setSendingInvoice(inv || workspaceInvoice);
  };

  const handleSent = async () => {
    loadInvoices();
    if (workspaceInvoice) {
      // Refrescar la factura en el workspace
      const data = await base44.entities.Invoice.filter({ company_id: company.id });
      const fresh = data?.find(i => i.id === workspaceInvoice.id);
      if (fresh) setWorkspaceInvoice(fresh);
    }
  };

  const handleWorkspaceRefresh = async () => {
    loadInvoices();
    if (workspaceInvoice) {
      const data = await base44.entities.Invoice.filter({ company_id: company.id });
      const fresh = data?.find(i => i.id === workspaceInvoice.id);
      if (fresh) setWorkspaceInvoice(fresh);
    }
  };

  const activas = invoices.filter(i => !i.anulada);

  const kpis = useMemo(() => {
    const tipo = activas.filter(i => i.tipo === filterTipo);
    const now = new Date();
    const qMonth = now.getMonth();
    const qNum = Math.floor(qMonth / 3);
    const qStart = new Date(now.getFullYear(), qNum * 3, 1);
    const qEnd = new Date(now.getFullYear(), qNum * 3 + 3, 0);
    const esteT = tipo.filter(i => {
      const d = new Date(i.fecha_emision || i.created_date);
      return d >= qStart && d <= qEnd;
    });
    const pendientes = tipo.filter(i => i.estado_cobro === 'pendiente' || i.estado_cobro === 'vencida');
    const vencidas = tipo.filter(i => i.estado_cobro === 'vencida');
    const years = new Set(tipo.map(i => i.anio || new Date(i.fecha_emision || i.created_date).getFullYear()).filter(Boolean));
    return {
      total: tipo.length,
      totalValor: tipo.reduce((s, i) => s + (i.total_factura || 0), 0),
      anios: years.size,
      esteT: esteT.length,
      esteTValor: esteT.reduce((s, i) => s + (i.total_factura || 0), 0),
      pendientes: pendientes.length,
      pendientesValor: pendientes.reduce((s, i) => s + (i.total_factura || 0), 0),
      vencidas: vencidas.length,
    };
  }, [activas, filterTipo]);
  const anuladas = invoices.filter(i => i.anulada);
  const lista = showAnuladas ? anuladas : activas;

  const filtered = lista.filter(i => {
    const matchSearch = !search ||
      i.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      i.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      i.concepto?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === 'all' || i.estado_contable === filterEstado;
    const matchTrimestre = filterTrimestre === 'all' || i.trimestre === filterTrimestre;
    return matchSearch && matchEstado && matchTrimestre && i.tipo === filterTipo;
  });

  if (loadingCompany && loading) return (
    <div className="p-12 text-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="la sección de Facturas" />;

  const fmtNum = n => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      {/* ── Listado de facturas ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader title="Facturas" subtitle={`${filtered.length} facturas · ${filterTipo === 'emitida' ? 'Emitidas' : 'Recibidas'}`}>
          <Button onClick={openNew} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nueva Factura
          </Button>
        </PageHeader>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-taxea-red/10 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-taxea-red" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{filterTipo === 'emitida' ? 'Facturas Emitidas' : 'Facturas Recibidas'}</p>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">Valor: <span className="font-semibold text-foreground">{fmtNum(kpis.totalValor)} €</span></p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Años con facturas</p>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{kpis.anios}</p>
            <p className="text-xs text-muted-foreground">Total ejercicios fiscales</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Este Trimestre</p>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{kpis.esteT}</p>
            <p className="text-xs text-muted-foreground">Valor: <span className="font-semibold text-foreground">{fmtNum(kpis.esteTValor)} €</span></p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpis.vencidas > 0 ? 'bg-red-500/10' : 'bg-orange-400/10'}`}>
                <AlertCircle className={`w-3.5 h-3.5 ${kpis.vencidas > 0 ? 'text-red-500' : 'text-orange-400'}`} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Pendientes de Cobro</p>
            </div>
            <p className={`text-3xl font-bold mb-1 ${kpis.vencidas > 0 ? 'text-red-500' : 'text-foreground'}`}>{kpis.pendientes}</p>
            <p className="text-xs text-muted-foreground">
              Valor: <span className="font-semibold text-foreground">{fmtNum(kpis.pendientesValor)} €</span>
              {kpis.vencidas > 0 && <span className="ml-2 text-red-500 font-medium">{kpis.vencidas} vencidas</span>}
            </p>
          </div>
        </div>

        {/* Tipo toggle + estado anuladas */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
          {['emitida', 'recibida'].map(t => (
            <button key={t} onClick={() => setFilterTipo(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterTipo === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'emitida' ? 'Emitidas' : 'Recibidas'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowAnuladas(false)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${!showAnuladas ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:border-foreground'}`}>
            Activas ({activas.filter(i => i.tipo === filterTipo).length})
          </button>
          <button onClick={() => setShowAnuladas(true)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${showAnuladas ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border hover:border-red-400'}`}>
            Anuladas ({anuladas.filter(i => i.tipo === filterTipo).length})
          </button>
        </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar factura..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Estado contable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en_revision">En revisión</SelectItem>
              <SelectItem value="revisada">Revisada</SelectItem>
              <SelectItem value="contabilizada">Contabilizada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="T1">T1</SelectItem>
              <SelectItem value="T2">T2</SelectItem>
              <SelectItem value="T3">T3</SelectItem>
              <SelectItem value="T4">T4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-medium">No hay facturas</p>
              <p className="text-sm text-muted-foreground mt-1">Crea tu primera factura o sube un PDF</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nº Factura</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Concepto</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Base</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Cobro</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(inv => (
                    <tr key={inv.id}
                      onClick={() => handleOpenWorkspace(inv)}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium text-foreground">
                         {inv.numero_factura}
                         {inv.anulada && <span className="ml-1.5 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">ANULADA</span>}
                       </td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.fecha_emision}</td>
                      <td className="px-4 py-3 text-foreground">{inv.cliente_nombre || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{inv.concepto || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{(inv.base_imponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{(inv.total_factura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                      <td className="px-4 py-3 hidden lg:table-cell"><StatusBadge status={inv.estado_cobro} /></td>
                      <td className="px-4 py-3"><StatusBadge status={inv.estado_contable} /></td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSend(inv)}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                            title="Enviar factura">
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenWorkspace(inv)}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-teal transition-colors"
                            title="Ver factura">
                            <Eye className="w-4 h-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={() => openEdit(inv)}>Editar</DropdownMenuItem>
                               <DropdownMenuItem onClick={() => handleOpenWorkspace(inv)}>Ver documento</DropdownMenuItem>
                               <DropdownMenuItem onClick={() => handleSend(inv)}>Enviar por email</DropdownMenuItem>
                               <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_cobro', 'cobrada')}>Marcar cobrada</DropdownMenuItem>
                               {isAdmin && (
                                 <>
                                   <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'en_revision')}>En revisión</DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'contabilizada')}>Contabilizar</DropdownMenuItem>
                                 </>
                               )}
                               {inv.archivo_url && (
                                 <DropdownMenuItem asChild>
                                   <a href={inv.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                     <Download className="w-3.5 h-3.5" /> Descargar archivo
                                   </a>
                                 </DropdownMenuItem>
                               )}
                               {!inv.anulada && (
                                 <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setAnularTarget(inv); setMotivoAnulacion(''); }}>
                                   <Ban className="w-3.5 h-3.5 mr-1.5" /> Anular factura
                                 </DropdownMenuItem>
                               )}
                               {inv.anulada && (
                                 <DropdownMenuItem className="text-red-700 focus:text-red-700" onClick={() => handleEliminar(inv)}>
                                   <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar definitivamente
                                 </DropdownMenuItem>
                               )}
                             </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Vista completa de documento (workspace) ─────────────────────── */}
      {workspaceInvoice && (
        <InvoiceDocumentWorkspace
          invoice={workspaceInvoice}
          company={company}
          user={user}
          isAdmin={isAdmin}
          onClose={handleCloseWorkspace}
          onSend={handleSend}
          onEdit={(inv) => { openEdit(inv); }}
          onRefresh={handleWorkspaceRefresh}
        />
      )}

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      <InvoiceForm
        open={showForm}
        onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}
        editing={editing}
        company={company}
        user={user}
        onSaved={loadInvoices}
      />

      <InvoiceViewer
        open={!!viewing}
        onOpenChange={v => { if (!v) setViewing(null); }}
        invoice={viewing}
        company={company}
      />

      <SendInvoiceDocumentModal
        open={!!sendingInvoice}
        onOpenChange={v => { if (!v) setSendingInvoice(null); }}
        invoice={sendingInvoice}
        company={company}
        user={user}
        onSent={handleSent}
      />

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
                ⚠️ Esta factura tiene un asiento contable vinculado que también quedará anulado.
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium">Motivo de anulación <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-input rounded-md px-3 py-2 text-sm"
                placeholder="Ej: Error en importe, factura duplicada..."
                value={motivoAnulacion}
                onChange={e => setMotivoAnulacion(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAnularTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={!motivoAnulacion.trim() || anulando}
                onClick={handleAnular}
              >
                {anulando ? 'Anulando...' : 'Confirmar anulación'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}