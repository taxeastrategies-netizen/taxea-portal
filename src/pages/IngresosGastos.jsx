import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, TrendingUp, TrendingDown, MoreVertical, Upload } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CATEGORIAS = [
  { value: 'ventas_servicios', label: 'Ventas / Servicios' },
  { value: 'compras', label: 'Compras' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'publicidad_marketing', label: 'Publicidad y Marketing' },
  { value: 'servicios_profesionales', label: 'Servicios Profesionales' },
  { value: 'software', label: 'Software' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'dietas', label: 'Dietas' },
  { value: 'gastos_financieros', label: 'Gastos Financieros' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'otros', label: 'Otros' },
];

const EMPTY = {
  tipo: 'gasto', fecha: '', proveedor_cliente: '', concepto: '',
  categoria: 'otros', base_imponible: '', tipo_impuesto: 21,
  cuota_impuesto: '', total: '', estado: 'pendiente'
};

export default function IngresosGastos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) {
      load();
    } else if (!loadingCompany) {
      setLoading(false);
    }
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Expense.filter({ company_id: company.id });
    setItems(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const year = form.fecha ? new Date(form.fecha).getFullYear() : new Date().getFullYear();
    const month = form.fecha ? new Date(form.fecha).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    const payload = {
      ...form,
      company_id: company.id,
      base_imponible: parseFloat(form.base_imponible) || 0,
      cuota_impuesto: parseFloat(form.cuota_impuesto) || 0,
      total: parseFloat(form.total) || 0,
      tipo_impuesto: parseFloat(form.tipo_impuesto) || 21,
      anio: year, trimestre, subido_por: user?.email,
    };
    if (editing) await base44.entities.Expense.update(editing.id, payload);
    else await base44.entities.Expense.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.concepto?.toLowerCase().includes(search.toLowerCase()) || i.proveedor_cliente?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || i.tipo === filterTipo;
    const matchTrimestre = filterTrimestre === 'all' || i.trimestre === filterTrimestre;
    return matchSearch && matchTipo && matchTrimestre;
  });

  const totalIngresos = filtered.filter(i => i.tipo === 'ingreso').reduce((s, i) => s + (i.total || 0), 0);
  const totalGastos = filtered.filter(i => i.tipo === 'gasto').reduce((s, i) => s + (i.total || 0), 0);

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Ingresos y Gastos" />;

  return (
    <div>
      <PageHeader title="Ingresos y Gastos" subtitle={`${filtered.length} registros`}>
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo registro
        </Button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-1">Total Ingresos</p>
          <p className="text-xl font-jakarta font-bold text-green-800">{totalIngresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Total Gastos</p>
          <p className="text-xl font-jakarta font-bold text-red-800">{totalGastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
        </div>
        <div className={`border rounded-xl p-4 ${totalIngresos - totalGastos >= 0 ? 'bg-teal-light border-teal/20' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs font-medium text-muted-foreground mb-1">Resultado</p>
          <p className={`text-xl font-jakarta font-bold ${totalIngresos - totalGastos >= 0 ? 'text-teal' : 'text-destructive'}`}>
            {(totalIngresos - totalGastos).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ingreso">Ingresos</SelectItem>
            <SelectItem value="gasto">Gastos</SelectItem>
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

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">Sin registros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Proveedor/Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Base</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${item.tipo === 'ingreso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {item.tipo === 'ingreso' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {item.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.fecha}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.proveedor_cliente || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell capitalize">
                      {CATEGORIAS.find(c => c.value === item.categoria)?.label || item.categoria || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{(item.base_imponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3 text-right font-semibold">{(item.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3"><StatusBadge status={item.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(item); setForm({ ...item }); setShowForm(true); }}>Editar</DropdownMenuItem>
                          {isAdmin && <DropdownMenuItem onClick={() => base44.entities.Expense.update(item.id, { estado: 'contabilizado' }).then(load)}>Contabilizar</DropdownMenuItem>}
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
          <DialogHeader><DialogTitle>{editing ? 'Editar registro' : 'Nuevo registro'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="gasto">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor / Cliente</Label>
              <Input value={form.proveedor_cliente} onChange={e => setForm(f => ({ ...f, proveedor_cliente: e.target.value }))} placeholder="Nombre" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Concepto</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción" />
            </div>
            <div className="space-y-1.5">
              <Label>Base imponible (€)</Label>
              <Input type="number" step="0.01" value={form.base_imponible} onChange={e => setForm(f => ({ ...f, base_imponible: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo impuesto (%)</Label>
              <Input type="number" value={form.tipo_impuesto} onChange={e => setForm(f => ({ ...f, tipo_impuesto: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total (€) *</Label>
              <Input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_revision">En revisión</SelectItem>
                  <SelectItem value="revisado">Revisado</SelectItem>
                  <SelectItem value="contabilizado">Contabilizado</SelectItem>
                </SelectContent>
              </Select>
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