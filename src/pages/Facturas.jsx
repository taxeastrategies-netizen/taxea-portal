import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Download, Upload, Eye, MoreVertical, FileText } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const EMPTY_INVOICE = {
  numero_factura: '', fecha_emision: '', fecha_vencimiento: '', cliente_nombre: '',
  cliente_nif: '', concepto: '', base_imponible: '', tipo_iva: 21,
  cuota_iva: '', retencion_irpf: 0, total_factura: '', tipo: 'emitida',
  estado_cobro: 'pendiente', estado_contable: 'pendiente', comentarios: ''
};

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
  const [form, setForm] = useState(EMPTY_INVOICE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (company?.id) {
      loadInvoices();
    } else if (!loadingCompany) {
      setLoading(false);
    }
  }, [company?.id, loadingCompany]);

  const loadInvoices = async () => {
    setLoading(true);
    const data = await base44.entities.Invoice.filter({ company_id: company.id });
    setInvoices(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.numero_factura) { setSaveError('El número de factura es obligatorio.'); return; }
    if (!form.fecha_emision) { setSaveError('La fecha de emisión es obligatoria.'); return; }
    if (!form.base_imponible) { setSaveError('La base imponible es obligatoria.'); return; }
    setSaving(true);
    const year = form.fecha_emision ? new Date(form.fecha_emision).getFullYear() : new Date().getFullYear();
    const month = form.fecha_emision ? new Date(form.fecha_emision).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    const base = parseFloat(form.base_imponible) || 0;
    const cuota = base * (parseFloat(form.tipo_iva) || 0) / 100;
    const total = base + cuota - (base * (parseFloat(form.retencion_irpf) || 0) / 100);
    const payload = {
      ...form,
      company_id: company.id,
      base_imponible: base,
      cuota_iva: cuota,
      total_factura: parseFloat(form.total_factura) || total,
      tipo_iva: parseFloat(form.tipo_iva) || 21,
      retencion_irpf: parseFloat(form.retencion_irpf) || 0,
      anio: year,
      trimestre,
      subido_por: user?.email,
    };
    try {
      if (editing) {
        await base44.entities.Invoice.update(editing.id, payload);
      } else {
        await base44.entities.Invoice.create(payload);
        // Registrar en timeline
        base44.entities.TimelineEvent.create({
          company_id: company.id,
          tipo: 'factura_clasificada',
          titulo: `Nueva factura: ${payload.numero_factura}`,
          descripcion: `${payload.tipo === 'emitida' ? 'Emitida' : 'Recibida'} · ${payload.cliente_nombre || ''} · ${(payload.total_factura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`,
          color: 'azul',
          usuario_email: user?.email,
          automatico: true,
          visibilidad: 'ambos',
        }).catch(() => {});
      }
      setSaving(false);
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_INVOICE);
      loadInvoices();
    } catch (err) {
      setSaveError('No se pudo guardar la factura. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const openEdit = (inv) => {
    setEditing(inv);
    setForm({ ...inv });
    setShowForm(true);
  };

  const updateEstado = async (id, field, value) => {
    await base44.entities.Invoice.update(id, { [field]: value });
    loadInvoices();
  };

  const filtered = invoices.filter(i => {
    const matchSearch = !search ||
      i.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      i.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      i.concepto?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === 'all' || i.estado_contable === filterEstado;
    const matchTrimestre = filterTrimestre === 'all' || i.trimestre === filterTrimestre;
    const matchTipo = i.tipo === filterTipo;
    return matchSearch && matchEstado && matchTrimestre && matchTipo;
  });

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="la sección de Facturas" />;

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle={`${filtered.length} facturas · ${filterTipo === 'emitida' ? 'Emitidas' : 'Recibidas'}`}
      >
        <Button onClick={() => { setEditing(null); setForm(EMPTY_INVOICE); setShowForm(true); }}
          className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva Factura
        </Button>
      </PageHeader>

      {/* Tipo toggle */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit mb-5">
        {['emitida', 'recibida'].map(t => (
          <button key={t}
            onClick={() => setFilterTipo(t)}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Estado cobro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{inv.numero_factura}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.fecha_emision}</td>
                    <td className="px-4 py-3 text-foreground">{inv.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{inv.concepto || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{(inv.base_imponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{(inv.total_factura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3 hidden lg:table-cell"><StatusBadge status={inv.estado_cobro} /></td>
                    <td className="px-4 py-3"><StatusBadge status={inv.estado_contable} /></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(inv)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_cobro', 'cobrada')}>Marcar cobrada</DropdownMenuItem>
                          {isAdmin && <>
                            <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'en_revision')}>En revisión</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateEstado(inv.id, 'estado_contable', 'contabilizada')}>Contabilizar</DropdownMenuItem>
                          </>}
                          {inv.archivo_url && (
                            <DropdownMenuItem asChild>
                              <a href={inv.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                <Download className="w-3.5 h-3.5" /> Descargar
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog formulario */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY_INVOICE); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Factura' : 'Nueva Factura'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emitida">Emitida</SelectItem>
                  <SelectItem value="recibida">Recibida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nº Factura *</Label>
              <Input value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="F-2024-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha emisión *</Label>
              <Input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={form.fecha_vencimiento || ''} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente / Proveedor</Label>
              <Input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} placeholder="Nombre o razón social" />
            </div>
            <div className="space-y-1.5">
              <Label>NIF / CIF</Label>
              <Input value={form.cliente_nif} onChange={e => setForm(f => ({ ...f, cliente_nif: e.target.value }))} placeholder="B12345678" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Concepto</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción del servicio o producto" />
            </div>
            <div className="space-y-1.5">
              <Label>Base imponible (€) *</Label>
              <Input type="number" step="0.01" value={form.base_imponible} onChange={e => setForm(f => ({ ...f, base_imponible: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo IVA/IGIC (%)</Label>
              <Input type="number" value={form.tipo_iva} onChange={e => setForm(f => ({ ...f, tipo_iva: e.target.value }))} placeholder="21" />
            </div>
            <div className="space-y-1.5">
              <Label>Retención IRPF (%)</Label>
              <Input type="number" value={form.retencion_irpf} onChange={e => setForm(f => ({ ...f, retencion_irpf: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Total factura (€)</Label>
              <Input type="number" step="0.01" value={form.total_factura} onChange={e => setForm(f => ({ ...f, total_factura: e.target.value }))} placeholder="Calculado automáticamente" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado de cobro</Label>
              <Select value={form.estado_cobro} onValueChange={v => setForm(f => ({ ...f, estado_cobro: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="cobrada">Cobrada</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado contable</Label>
              <Select value={form.estado_contable} onValueChange={v => setForm(f => ({ ...f, estado_contable: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_revision">En revisión</SelectItem>
                  <SelectItem value="revisada">Revisada</SelectItem>
                  <SelectItem value="contabilizada">Contabilizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Comentarios</Label>
              <Input value={form.comentarios || ''} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} placeholder="Notas adicionales..." />
            </div>
          </div>
          {saveError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-2">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
              {saving ? 'Guardando...' : 'Guardar factura'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}