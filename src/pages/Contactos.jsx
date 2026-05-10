import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Users, MoreVertical, Building2, User } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const EMPTY = { nombre: '', razon_social: '', nif_cif: '', tipo: 'cliente', direccion_fiscal: '', email: '', telefono: '', persona_contacto: '', notas: '', actividad: '', regimen_fiscal: '' };

export default function Contactos() {
  const { company } = useOutletContext() || {};
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Contact.filter({ company_id: company.id });
    setContacts(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company.id, activo: true };
    if (editing) await base44.entities.Contact.update(editing.id, payload);
    else await base44.entities.Contact.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.nombre?.toLowerCase().includes(search.toLowerCase()) || c.nif_cif?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || c.tipo === filterTipo || c.tipo === 'ambos';
    return matchSearch && matchTipo;
  });

  return (
    <div>
      <PageHeader title="Contactos" subtitle={`${contacts.length} clientes y proveedores`}>
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo contacto
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar contacto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
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
          <p className="font-medium text-foreground">Sin contactos</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", c.tipo === 'cliente' ? 'bg-teal-light' : 'bg-orange-50')}>
                    {c.tipo === 'cliente' ? <User className="w-5 h-5 text-teal" /> : <Building2 className="w-5 h-5 text-orange-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.nif_cif || '—'}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-3.5 h-3.5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(c); setForm({ ...c }); setShowForm(true); }}>Editar</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => base44.entities.Contact.update(c.id, { activo: false }).then(load)}>Desactivar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 space-y-1">
                {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                {c.telefono && <p className="text-xs text-muted-foreground">{c.telefono}</p>}
              </div>
              <div className="mt-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-md font-medium",
                  c.tipo === 'cliente' ? 'bg-teal-light text-teal' :
                  c.tipo === 'proveedor' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                )}>
                  {c.tipo === 'cliente' ? 'Cliente' : c.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre / Razón social *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
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
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dirección fiscal</Label>
              <Input value={form.direccion_fiscal} onChange={e => setForm(f => ({ ...f, direccion_fiscal: e.target.value }))} />
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