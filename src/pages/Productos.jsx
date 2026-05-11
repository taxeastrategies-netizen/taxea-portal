import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Package, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const EMPTY = { nombre: '', descripcion: '', precio_base: '', tipo_impuesto: 21, categoria: '', activo: true };

export default function Productos() {
  const { company, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const data = await base44.entities.ProductService.filter({ company_id: company.id });
    setItems(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company.id, precio_base: parseFloat(form.precio_base) || 0, tipo_impuesto: parseFloat(form.tipo_impuesto) || 21 };
    if (editing) await base44.entities.ProductService.update(editing.id, payload);
    else await base44.entities.ProductService.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Productos y Servicios" />;

  return (
    <div>
      <PageHeader title="Productos y Servicios" subtitle="Catálogo para facturación rápida">
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo producto/servicio
        </Button>
      </PageHeader>

      {loading ? <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      : items.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">Sin productos ni servicios</p>
          <p className="text-sm text-muted-foreground mt-1">Añade tus servicios habituales para facturar más rápido</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.id} className={`bg-card rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-shadow ${!item.activo ? 'opacity-50' : 'border-border'}`}>
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-teal" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-3.5 h-3.5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(item); setForm({ ...item }); setShowForm(true); }}>Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => base44.entities.ProductService.update(item.id, { activo: !item.activo }).then(load)}>
                      {item.activo ? 'Desactivar' : 'Activar'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3">
                <p className="font-medium text-foreground text-sm">{item.nombre}</p>
                {item.descripcion && <p className="text-xs text-muted-foreground mt-1">{item.descripcion}</p>}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-jakarta font-bold text-teal">{(item.precio_base || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">{item.tipo_impuesto}% imp.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar producto/servicio' : 'Nuevo producto/servicio'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={form.descripcion || ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Precio base (€) *</Label><Input type="number" step="0.01" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Tipo impuesto (%)</Label><Input type="number" value={form.tipo_impuesto} onChange={e => setForm(f => ({ ...f, tipo_impuesto: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Categoría</Label><Input value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Servicio, Producto, Consultoría..." /></div>
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