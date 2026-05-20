import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Truck, Search, Edit2, Trash2, Loader2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const STATUS_COLOR = { activo: 'bg-emerald-100 text-emerald-700', inactivo: 'bg-slate-100 text-slate-500', preferente: 'bg-blue-100 text-blue-700' };
const EMPTY = { name: '', tax_id: '', email: '', phone: '', address: '', average_delivery_days: '', payment_terms: '', status: 'activo', notes: '' };

export default function LogisticsSuppliers() {
  const { company } = useOutletContext() || {};
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);
  const load = async () => { setLoading(true); const data = await base44.entities.LogisticsSupplier.filter({ company_id: company.id }); setSuppliers(data || []); setLoading(false); };

  const openEdit = (s) => { setForm({ name: s.name || '', tax_id: s.tax_id || '', email: s.email || '', phone: s.phone || '', address: s.address || '', average_delivery_days: s.average_delivery_days ?? '', payment_terms: s.payment_terms || '', status: s.status || 'activo', notes: s.notes || '' }); setEditing(s.id); setShowForm(true); };
  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id, average_delivery_days: parseFloat(form.average_delivery_days) || 0 };
    if (editing) await base44.entities.LogisticsSupplier.update(editing, data);
    else await base44.entities.LogisticsSupplier.create(data);
    toast.success(editing ? 'Proveedor actualizado' : 'Proveedor creado');
    setSaving(false); setShowForm(false); load();
  };

  if (!company) return <NoCompanyState pageName="Proveedores" />;
  const filtered = suppliers.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.tax_id?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Proveedores logísticos</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} proveedores registrados</p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo proveedor</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Proveedor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Contacto</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Plazo entrega</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground"><Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />{search ? 'Sin resultados' : 'Sin proveedores registrados'}</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3"><p className="font-medium">{s.name}</p>{s.tax_id && <p className="text-xs text-muted-foreground font-mono">{s.tax_id}</p>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell"><p>{s.email || '—'}</p><p>{s.phone || ''}</p></td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">{s.average_delivery_days > 0 ? `${s.average_delivery_days} días` : '—'}</td>
                  <td className="px-4 py-3 text-center"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[s.status] || 'bg-slate-100 text-slate-600')}>{s.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={async () => { await base44.entities.LogisticsSupplier.delete(s.id); load(); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-auto">
              {[['name','Nombre *'],['tax_id','CIF / NIF'],['email','Email'],['phone','Teléfono'],['address','Dirección'],['average_delivery_days','Plazo medio entrega (días)'],['payment_terms','Condiciones de pago'],['notes','Notas']].map(([k, l]) => (
                <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label><Input value={form[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} className="h-9 text-sm" /></div>
              ))}
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="activo">Activo</option><option value="preferente">Preferente</option><option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Crear proveedor'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}