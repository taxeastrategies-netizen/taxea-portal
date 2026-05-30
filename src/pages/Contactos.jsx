import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Users, Pencil, Trash2, RefreshCw, Copy } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const EMPTY = { nombre: '', nif_cif: '', tipo: 'cliente', email: '', telefono: '', direccion_fiscal: '', codigo_postal: '', ciudad: '', provincia: '', pais: 'España', organismo_publico: false, persona_contacto: '', notas: '' };

export default function Contactos() {
  const { company, loadingCompany } = useOutletContext() || {};
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) load();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Contact.filter({ company_id: company.id });
    setContacts((data || []).filter(c => c.activo !== false));
    setLoading(false);
  };

  const syncFromInvoices = async () => {
    setSyncing(true);
    const [invoices, existing] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id }),
      base44.entities.Contact.filter({ company_id: company.id }),
    ]);

    const existingNifs = new Set(existing.map(c => c.nif_cif).filter(Boolean));
    const existingNames = new Set(existing.map(c => c.nombre?.toLowerCase()).filter(Boolean));

    const toCreate = [];
    const seen = new Set();

    for (const inv of invoices || []) {
      // Facturas emitidas → cliente
      if (inv.cliente_nombre && !seen.has(inv.cliente_nombre + inv.cliente_nif)) {
        seen.add(inv.cliente_nombre + inv.cliente_nif);
        if ((inv.cliente_nif && !existingNifs.has(inv.cliente_nif)) ||
            (!inv.cliente_nif && !existingNames.has(inv.cliente_nombre?.toLowerCase()))) {
          toCreate.push({
            company_id: company.id,
            nombre: inv.cliente_nombre,
            nif_cif: inv.cliente_nif || '',
            email: inv.cliente_email || '',
            tipo: 'cliente',
            activo: true,
          });
          if (inv.cliente_nif) existingNifs.add(inv.cliente_nif);
          else existingNames.add(inv.cliente_nombre?.toLowerCase());
        }
      }
      // Facturas recibidas → proveedor
      if (inv.proveedor_nombre && !seen.has(inv.proveedor_nombre + inv.proveedor_nif)) {
        seen.add(inv.proveedor_nombre + inv.proveedor_nif);
        if ((inv.proveedor_nif && !existingNifs.has(inv.proveedor_nif)) ||
            (!inv.proveedor_nif && !existingNames.has(inv.proveedor_nombre?.toLowerCase()))) {
          toCreate.push({
            company_id: company.id,
            nombre: inv.proveedor_nombre,
            nif_cif: inv.proveedor_nif || '',
            tipo: 'proveedor',
            activo: true,
          });
          if (inv.proveedor_nif) existingNifs.add(inv.proveedor_nif);
          else existingNames.add(inv.proveedor_nombre?.toLowerCase());
        }
      }
    }

    if (toCreate.length > 0) {
      await base44.entities.Contact.bulkCreate(toCreate);
    }
    setSyncing(false);
    load();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company.id, activo: true };
    if (editing) await base44.entities.Contact.update(editing.id, payload);
    else await base44.entities.Contact.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Contact.update(id, { activo: false });
    load();
  };

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.nombre?.toLowerCase().includes(q) || c.nif_cif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    const matchTipo = filterTipo === 'all' || c.tipo === filterTipo || c.tipo === 'ambos';
    return matchSearch && matchTipo;
  });

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Contactos" />;

  return (
    <div>
      <PageHeader title="Contactos" subtitle="Gestiona la información de tus contactos">
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncFromInvoices} disabled={syncing} className="h-9 gap-1.5">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync desde facturas'}
          </Button>
          <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo contacto
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar contactos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
            <SelectItem value="proveedor">Proveedores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground mb-1">Sin contactos</p>
          <p className="text-sm text-muted-foreground">Usa "Sync desde facturas" para importar automáticamente o crea uno nuevo.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">NIF/CIF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Ciudad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{c.nombre}</p>
                    {c.persona_contacto && <p className="text-xs text-muted-foreground">{c.persona_contacto}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.nif_cif || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.ciudad || '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.tipo === 'cliente' ? 'bg-teal-light text-teal' : c.tipo === 'proveedor' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                      {c.tipo === 'cliente' ? 'Cliente' : c.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Copiar NIF"
                        onClick={() => navigator.clipboard.writeText(c.nif_cif || '')}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Editar"
                        onClick={() => { setEditing(c); setForm({ ...c }); setShowForm(true); }}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre / Razón social *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del contacto" />
            </div>
            <div className="space-y-1.5">
              <Label>NIF / CIF</Label>
              <Input value={form.nif_cif} onChange={e => setForm(f => ({ ...f, nif_cif: e.target.value }))} placeholder="B12345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="proveedor">Proveedor</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@ejemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+34 600 000 000" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dirección fiscal</Label>
              <Input value={form.direccion_fiscal} onChange={e => setForm(f => ({ ...f, direccion_fiscal: e.target.value }))} placeholder="Calle, número, piso..." />
            </div>
            <div className="space-y-1.5">
              <Label>Código Postal</Label>
              <Input value={form.codigo_postal} onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value }))} placeholder="28001" />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label>Provincia</Label>
              <Input value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center justify-between bg-secondary/50 border border-border rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Organismo público</p>
                <p className="text-xs text-muted-foreground">Activa si es una Administración Pública (FacturaE)</p>
              </div>
              <Switch checked={!!form.organismo_publico} onCheckedChange={v => setForm(f => ({ ...f, organismo_publico: v }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Persona de contacto</Label>
              <Input value={form.persona_contacto} onChange={e => setForm(f => ({ ...f, persona_contacto: e.target.value }))} placeholder="Nombre de la persona de contacto" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} />
            </div>
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