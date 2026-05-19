import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Download, Eye, MoreVertical, FileText, Send } from 'lucide-react';
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

  const filtered = invoices.filter(i => {
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

  return (
    <>
      {/* ── Listado de facturas ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader title="Facturas" subtitle={`${filtered.length} facturas · ${filterTipo === 'emitida' ? 'Emitidas' : 'Recibidas'}`}>
          <Button onClick={openNew} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nueva Factura
          </Button>
        </PageHeader>

        {/* Tipo toggle */}
        <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit mb-5">
          {['emitida', 'recibida'].map(t => (
            <button key={t} onClick={() => setFilterTipo(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterTipo === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'emitida' ? 'Emitidas' : 'Recibidas'}
            </button>
          ))}
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
                      <td className="px-4 py-3 font-medium text-foreground">{inv.numero_factura}</td>
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
                              {isAdmin && <>
                                <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'en_revision')}>En revisión</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'contabilizada')}>Contabilizar</DropdownMenuItem>
                              </>}
                              {inv.archivo_url && (
                                <DropdownMenuItem asChild>
                                  <a href={inv.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                    <Download className="w-3.5 h-3.5" /> Descargar archivo
                                  </a>
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
    </>
  );
}