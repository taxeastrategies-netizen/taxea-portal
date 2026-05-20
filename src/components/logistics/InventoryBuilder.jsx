import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit2, Trash2, Package, Loader2, ChevronDown, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { toast } from 'sonner';

const STATUS_COLOR = { activo: 'bg-emerald-100 text-emerald-700', descatalogado: 'bg-slate-100 text-slate-600', pendiente_reposicion: 'bg-amber-100 text-amber-700' };
const STATUS_LABEL = { activo: 'Activo', descatalogado: 'Descatalogado', pendiente_reposicion: 'Pdte. reposición' };

function generateSku(name, families, categories, categoryId, familyId, count) {
  const cat = categories.find(c => c.id === categoryId);
  const fam = families.find(f => f.id === familyId);
  const prefix = (cat?.code_prefix || fam?.code_prefix || name?.substring(0, 3) || 'PRD').toUpperCase();
  return `${prefix}-${String((count || 0) + 1).padStart(6, '0')}`;
}

const EMPTY_FORM = { name: '', description: '', sku: '', barcode: '', family_id: '', category_id: '', unit_of_measure: 'ud', status: 'activo', purchase_price: '', sale_price: '', min_stock: '', max_stock: '', current_stock: '', default_warehouse_id: '', default_supplier_id: '', notes: '', tags: [] };

export default function InventoryBuilder() {
  const { company } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('productos');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [prods, fams, cats, sups, whs] = await Promise.all([
      base44.entities.LogisticsProduct.filter({ company_id: company.id }),
      base44.entities.ProductFamily.filter({ company_id: company.id }),
      base44.entities.ProductCategory.filter({ company_id: company.id }),
      base44.entities.LogisticsSupplier.filter({ company_id: company.id }),
      base44.entities.Warehouse.filter({ company_id: company.id }),
    ]);
    setProducts(prods || []);
    setFamilies(fams || []);
    setCategories(cats || []);
    setSuppliers(sups || []);
    setWarehouses(whs || []);
    setLoading(false);
  };

  const openCreate = () => {
    const autoSku = generateSku(form.name, families, categories, form.category_id, form.family_id, products.length);
    setForm({ ...EMPTY_FORM, sku: autoSku });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({ name: p.name || '', description: p.description || '', sku: p.sku || '', barcode: p.barcode || '', family_id: p.family_id || '', category_id: p.category_id || '', unit_of_measure: p.unit_of_measure || 'ud', status: p.status || 'activo', purchase_price: p.purchase_price ?? '', sale_price: p.sale_price ?? '', min_stock: p.min_stock ?? '', max_stock: p.max_stock ?? '', current_stock: p.current_stock ?? '', default_warehouse_id: p.default_warehouse_id || '', default_supplier_id: p.default_supplier_id || '', notes: p.notes || '', tags: p.tags || [] });
    setEditing(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const margin = form.sale_price && form.purchase_price ? ((form.sale_price - form.purchase_price) / form.sale_price * 100) : 0;
    const data = { ...form, company_id: company.id, purchase_price: parseFloat(form.purchase_price) || 0, sale_price: parseFloat(form.sale_price) || 0, min_stock: parseFloat(form.min_stock) || 0, max_stock: parseFloat(form.max_stock) || 0, current_stock: parseFloat(form.current_stock) || 0, estimated_gross_margin: Math.round(margin * 10) / 10, pmp_cost: parseFloat(form.purchase_price) || 0 };
    if (editing) await base44.entities.LogisticsProduct.update(editing, data);
    else await base44.entities.LogisticsProduct.create(data);
    toast.success(editing ? 'Producto actualizado' : 'Producto creado');
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.LogisticsProduct.delete(id);
    toast.success('Producto eliminado');
    load();
  };

  if (!company) return <NoCompanyState pageName="Inventario" />;

  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));

  const Field = ({ label, name, type = 'text', options }) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {options ? (
        <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">— Sin seleccionar —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input type={type} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className="h-9 text-sm" />
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Inventario de productos</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos · {families.length} familias · {categories.length} categorías</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveTab(activeTab === 'productos' ? 'familias' : 'productos')}>
            {activeTab === 'productos' ? 'Familias y categorías' : 'Productos'}
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nuevo producto
          </Button>
        </div>
      </div>

      {activeTab === 'productos' ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-semibold text-foreground">{search ? 'Sin resultados' : 'Sin productos'}</p>
              <p className="text-sm text-muted-foreground mt-1">Crea tu primer producto para empezar a gestionar el inventario</p>
              {!search && <Button onClick={openCreate} className="mt-4 bg-taxea-red hover:bg-taxea-red-dark" size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo producto</Button>}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Producto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">SKU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Stock</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">P.Compra</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">P.Venta</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Margen</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(p => {
                      const stockColor = p.min_stock > 0 && (p.current_stock || 0) <= p.min_stock ? 'text-red-600 font-bold' : p.max_stock > 0 && (p.current_stock || 0) > p.max_stock ? 'text-amber-600 font-bold' : 'text-foreground';
                      return (
                        <tr key={p.id} className="hover:bg-secondary/20">
                          <td className="px-4 py-3">
                            <p className="font-medium">{p.name}</p>
                            {p.description && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.description}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{p.sku || '—'}</td>
                          <td className={cn('px-4 py-3 text-right font-semibold', stockColor)}>{p.current_stock ?? 0} {p.unit_of_measure || 'ud'}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{p.purchase_price ? p.purchase_price.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{p.sale_price ? p.sale_price.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}</td>
                          <td className={cn('px-4 py-3 text-right font-semibold hidden lg:table-cell', (p.estimated_gross_margin || 0) < 0 ? 'text-red-600' : (p.estimated_gross_margin || 0) < 15 ? 'text-amber-600' : 'text-emerald-600')}>{p.estimated_gross_margin ? p.estimated_gross_margin.toFixed(1) + '%' : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[p.status] || 'bg-slate-100 text-slate-600')}>{STATUS_LABEL[p.status] || p.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <FamiliesAndCategories company={company} families={families} categories={categories} onRefresh={load} />
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Field label="Nombre del producto *" name="name" /></div>
                <Field label="SKU / Código interno" name="sku" />
                <Field label="Código de barras / QR" name="barcode" />
                <Field label="Familia" name="family_id" options={families.map(f => ({ value: f.id, label: f.name }))} />
                <Field label="Categoría" name="category_id" options={categories.map(c => ({ value: c.id, label: c.name }))} />
                <Field label="Unidad de medida" name="unit_of_measure" options={[{value:'ud',label:'Unidad'},{value:'kg',label:'Kilogramo'},{value:'lt',label:'Litro'},{value:'m',label:'Metro'},{value:'m2',label:'m²'},{value:'caja',label:'Caja'},{value:'pack',label:'Pack'}]} />
                <Field label="Estado" name="status" options={[{value:'activo',label:'Activo'},{value:'descatalogado',label:'Descatalogado'},{value:'pendiente_reposicion',label:'Pendiente reposición'}]} />
                <Field label="Precio de compra (€)" name="purchase_price" type="number" />
                <Field label="Precio de venta (€)" name="sale_price" type="number" />
                <Field label="Stock actual" name="current_stock" type="number" />
                <Field label="Stock mínimo" name="min_stock" type="number" />
                <Field label="Stock máximo" name="max_stock" type="number" />
                <Field label="Almacén por defecto" name="default_warehouse_id" options={warehouses.map(w => ({ value: w.id, label: w.name }))} />
                <Field label="Proveedor habitual" name="default_supplier_id" options={suppliers.map(s => ({ value: s.id, label: s.name }))} />
                <div className="col-span-2"><Field label="Descripción / Notas" name="notes" /></div>
              </div>
              {form.purchase_price && form.sale_price && (
                <div className={cn('p-2 rounded-lg text-xs text-center font-medium', form.sale_price < form.purchase_price ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                  Margen bruto estimado: {form.sale_price > 0 ? (((form.sale_price - form.purchase_price) / form.sale_price) * 100).toFixed(1) : 0}%
                  {form.sale_price < form.purchase_price && ' ⚠ Precio inferior al coste'}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editing ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FamiliesAndCategories({ company, families, categories, onRefresh }) {
  const [showFam, setShowFam] = useState(false);
  const [showCat, setShowCat] = useState(false);
  const [famForm, setFamForm] = useState({ name: '', code_prefix: '', description: '' });
  const [catForm, setCatForm] = useState({ name: '', code_prefix: '', family_id: '', description: '' });

  const saveFam = async () => { await base44.entities.ProductFamily.create({ ...famForm, company_id: company.id, active: true }); toast.success('Familia creada'); setShowFam(false); setFamForm({ name: '', code_prefix: '', description: '' }); onRefresh(); };
  const saveCat = async () => { await base44.entities.ProductCategory.create({ ...catForm, company_id: company.id, active: true }); toast.success('Categoría creada'); setShowCat(false); setCatForm({ name: '', code_prefix: '', family_id: '', description: '' }); onRefresh(); };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Familias ({families.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowFam(!showFam)}><Plus className="w-3.5 h-3.5 mr-1" />Nueva</Button>
        </div>
        {showFam && (
          <div className="p-4 border-b border-border space-y-2 bg-secondary/20">
            <Input placeholder="Nombre de la familia" value={famForm.name} onChange={e => setFamForm(p => ({...p, name: e.target.value}))} className="h-8 text-sm" />
            <Input placeholder="Prefijo SKU (ej: BEB)" value={famForm.code_prefix} onChange={e => setFamForm(p => ({...p, code_prefix: e.target.value}))} className="h-8 text-sm" />
            <Button size="sm" onClick={saveFam} className="w-full bg-taxea-red hover:bg-taxea-red-dark">Crear familia</Button>
          </div>
        )}
        <div className="divide-y divide-border">
          {families.map(f => <div key={f.id} className="px-4 py-3 flex items-center gap-2"><span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono">{f.code_prefix || '—'}</span><span className="text-sm">{f.name}</span></div>)}
          {!families.length && <div className="p-6 text-center text-sm text-muted-foreground">Sin familias creadas</div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Categorías ({categories.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowCat(!showCat)}><Plus className="w-3.5 h-3.5 mr-1" />Nueva</Button>
        </div>
        {showCat && (
          <div className="p-4 border-b border-border space-y-2 bg-secondary/20">
            <Input placeholder="Nombre de la categoría" value={catForm.name} onChange={e => setCatForm(p => ({...p, name: e.target.value}))} className="h-8 text-sm" />
            <Input placeholder="Prefijo SKU" value={catForm.code_prefix} onChange={e => setCatForm(p => ({...p, code_prefix: e.target.value}))} className="h-8 text-sm" />
            <select value={catForm.family_id} onChange={e => setCatForm(p => ({...p, family_id: e.target.value}))} className="w-full h-8 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Familia (opcional)</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button size="sm" onClick={saveCat} className="w-full bg-taxea-red hover:bg-taxea-red-dark">Crear categoría</Button>
          </div>
        )}
        <div className="divide-y divide-border">
          {categories.map(c => <div key={c.id} className="px-4 py-3 flex items-center gap-2"><span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono">{c.code_prefix || '—'}</span><span className="text-sm">{c.name}</span>{families.find(f => f.id === c.family_id) && <span className="text-xs text-muted-foreground ml-auto">{families.find(f => f.id === c.family_id)?.name}</span>}</div>)}
          {!categories.length && <div className="p-6 text-center text-sm text-muted-foreground">Sin categorías creadas</div>}
        </div>
      </div>
    </div>
  );
}