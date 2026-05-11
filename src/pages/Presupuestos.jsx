import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, FileCheck, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const EMPTY = { numero_presupuesto: '', fecha: '', cliente_nombre: '', cliente_nif: '', base_imponible: '', tipo_impuesto: 21, total: '', estado: 'borrador', notas: '', validez_dias: 30 };

export default function Presupuestos() {
  const { company, user, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) { load(); }
    else if (!loadingCompany) { setLoading(false); }
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Quote.filter({ company_id: company.id });
    setItems(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company.id, base_imponible: parseFloat(form.base_imponible) || 0, total: parseFloat(form.total) || 0, tipo_impuesto: parseFloat(form.tipo_impuesto) || 21 };
    if (editing) await base44.entities.Quote.update(editing.id, payload);
    else await base44.entities.Quote.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const convertToInvoice = async (q) => {
    await base44.entities.Invoice.create({
      company_id: company.id,
      numero_factura: `F-${q.numero_presupuesto}`,
      fecha_emision: new Date().toISOString().split('T')[0],
      cliente_nombre: q.cliente_nombre,
      cliente_nif: q.cliente_nif,
      base_imponible: q.base_imponible,
      tipo_iva: q.tipo_impuesto,
      cuota_iva: q.base_imponible * (q.tipo_impuesto || 21) / 100,
      total_factura: q.total,
      tipo: 'emitida',
      estado_cobro: 'pendiente',
      estado_contable: 'pendiente',
      anio: new Date().getFullYear(),
      trimestre: ['T1','T2','T3','T4'][Math.floor(new Date().getMonth() / 3)],
      subido_por: user?.email,
    });
    await base44.entities.Quote.update(q.id, { estado: 'convertido_factura' });
    load();
  };

  const filtered = items.filter(i => !search || i.numero_presupuesto?.toLowerCase().includes(search.toLowerCase()) || i.cliente_nombre?.toLowerCase().includes(search.toLowerCase()));

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Presupuestos" />;

  return (
    <div>
      <PageHeader title="Presupuestos" subtitle={`${items.length} presupuestos`}>
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo presupuesto
        </Button>
      </PageHeader>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar presupuesto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
        : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">Sin presupuestos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nº</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium text-foreground">{q.numero_presupuesto}</td>
                    <td className="px-4 py-3 text-muted-foreground">{q.fecha}</td>
                    <td className="px-4 py-3">{q.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{(q.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3"><StatusBadge status={q.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(q); setForm({ ...q }); setShowForm(true); }}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => base44.entities.Quote.update(q.id, { estado: 'aceptado' }).then(load)}>Marcar aceptado</DropdownMenuItem>
                          {q.estado === 'aceptado' && (
                            <DropdownMenuItem onClick={() => convertToInvoice(q)}>Convertir en factura</DropdownMenuItem>
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

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1.5"><Label>Nº Presupuesto *</Label><Input value={form.numero_presupuesto} onChange={e => setForm(f => ({ ...f, numero_presupuesto: e.target.value }))} placeholder="P-2024-001" /></div>
            <div className="space-y-1.5"><Label>Fecha *</Label><Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Cliente</Label><Input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>NIF/CIF</Label><Input value={form.cliente_nif} onChange={e => setForm(f => ({ ...f, cliente_nif: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Base imponible (€)</Label><Input type="number" step="0.01" value={form.base_imponible} onChange={e => setForm(f => ({ ...f, base_imponible: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Tipo impuesto (%)</Label><Input type="number" value={form.tipo_impuesto} onChange={e => setForm(f => ({ ...f, tipo_impuesto: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Total (€) *</Label><Input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="aceptado">Aceptado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Notas</Label><Textarea value={form.notas || ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}