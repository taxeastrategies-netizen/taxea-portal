import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, TrendingUp, TrendingDown, MoreVertical, Upload, BarChart3 } from 'lucide-react';
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

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IngresosGastos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterAnio, setFilterAnio] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  useEffect(() => {
    if (company?.id) load();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, filterAnio, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const [expenses, invoices] = await Promise.all([
      base44.entities.Expense.filter({ company_id: company.id, anio: parseInt(filterAnio) }),
      base44.entities.Invoice.filter({ company_id: company.id, anio: parseInt(filterAnio) }),
    ]);
    const invoiceItems = (invoices || []).map(inv => ({
      _source: 'invoice',
      id: inv.id,
      tipo: inv.tipo === 'emitida' ? 'ingreso' : 'gasto',
      fecha: inv.fecha_emision,
      proveedor_cliente: inv.cliente_nombre,
      concepto: inv.concepto,
      base_imponible: inv.base_imponible,
      tipo_impuesto: inv.tipo_iva,
      cuota_impuesto: inv.cuota_iva,
      total: inv.total_factura,
      trimestre: inv.trimestre,
      estado: inv.estado_contable,
      categoria: inv.categoria || (inv.tipo === 'emitida' ? 'ventas_servicios' : 'otros'),
      numero_factura: inv.numero_factura,
    }));
    setItems([...(expenses || []).map(e => ({ ...e, _source: 'expense' })), ...invoiceItems]);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const year = form.fecha ? new Date(form.fecha).getFullYear() : new Date().getFullYear();
    const month = form.fecha ? new Date(form.fecha).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    const base = parseFloat(form.base_imponible) || 0;
    const cuota = base * (parseFloat(form.tipo_impuesto) || 0) / 100;
    const payload = {
      ...form,
      company_id: company.id,
      base_imponible: base,
      cuota_impuesto: cuota,
      total: parseFloat(form.total) || base + cuota,
      tipo_impuesto: parseFloat(form.tipo_impuesto) || 21,
      anio: year, trimestre, subido_por: user?.email,
    };
    if (editing) {
      if (editing._source === 'invoice') await base44.entities.Invoice.update(editing.id, { estado_contable: payload.estado });
      else await base44.entities.Expense.update(editing.id, payload);
    } else {
      await base44.entities.Expense.create(payload);
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const filtered = useMemo(() => items.filter(i => {
    const matchSearch = !search || i.concepto?.toLowerCase().includes(search.toLowerCase()) || i.proveedor_cliente?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || i.tipo === filterTipo;
    const matchTrimestre = filterTrimestre === 'all' || i.trimestre === filterTrimestre;
    const matchCat = filterCategoria === 'all' || i.categoria === filterCategoria;
    return matchSearch && matchTipo && matchTrimestre && matchCat;
  }), [items, search, filterTipo, filterTrimestre, filterCategoria]);

  const ingresos = useMemo(() => filtered.filter(i => i.tipo === 'ingreso'), [filtered]);
  const gastos = useMemo(() => filtered.filter(i => i.tipo === 'gasto'), [filtered]);

  const totalIngresos = ingresos.reduce((s, i) => s + (i.total || 0), 0);
  const totalGastos = gastos.reduce((s, i) => s + (i.total || 0), 0);
  const totalBaseIng = ingresos.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const totalBaseGas = gastos.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const resultado = totalIngresos - totalGastos;
  const margen = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100).toFixed(1) : '0.0';

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Ingresos y Gastos" />;

  return (
    <div>
      <PageHeader title="Ingresos y Gastos" subtitle={`${filtered.length} registros · ${filterAnio}`}>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo registro
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-0.5">Total Ingresos</p>
          <p className="text-lg font-jakarta font-bold text-green-800">{fmt(totalIngresos)} €</p>
          <p className="text-[10px] text-green-600 mt-0.5">Base: {fmt(totalBaseIng)} €</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-0.5">Total Gastos</p>
          <p className="text-lg font-jakarta font-bold text-red-800">{fmt(totalGastos)} €</p>
          <p className="text-[10px] text-red-600 mt-0.5">Base: {fmt(totalBaseGas)} €</p>
        </div>
        <div className={`border rounded-xl p-4 ${resultado >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Resultado</p>
          <p className={`text-lg font-jakarta font-bold ${resultado >= 0 ? 'text-blue-800' : 'text-destructive'}`}>{fmt(resultado)} €</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Margen</p>
          <p className="text-lg font-jakarta font-bold text-foreground">{margen} %</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
          <Link to="/tax-accounting/libros" className="text-xs text-primary font-medium flex items-center gap-1.5 hover:underline">
            <BarChart3 className="w-4 h-4" /> Ver P&amp;L completo
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por concepto o proveedor/cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ingreso">Ingresos</SelectItem>
            <SelectItem value="gasto">Gastos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="T1">T1</SelectItem>
            <SelectItem value="T2">T2</SelectItem>
            <SelectItem value="T3">T3</SelectItem>
            <SelectItem value="T4">T4</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Proveedor/Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Concepto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Base</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">IVA%</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">T</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Estado</th>
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
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.fecha}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.proveedor_cliente || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs max-w-[160px] truncate">{item.concepto || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs capitalize">
                      {CATEGORIAS.find(c => c.value === item.categoria)?.label || item.categoria || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">{fmt(item.base_imponible)} €</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell text-xs">{item.tipo_impuesto ?? 0}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-xs">{fmt(item.total)} €</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.trimestre}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item._source !== 'invoice'
                            ? <DropdownMenuItem onClick={() => { setEditing(item); setForm({ ...item }); setShowForm(true); }}>Editar</DropdownMenuItem>
                            : <DropdownMenuItem asChild><a href="/tax-accounting/facturas">Ver en Facturas</a></DropdownMenuItem>
                          }
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => {
                              if (item._source === 'invoice') base44.entities.Invoice.update(item.id, { estado_contable: 'contabilizada' }).then(load);
                              else base44.entities.Expense.update(item.id, { estado: 'contabilizado' }).then(load);
                            }}>Contabilizar</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/40 font-semibold text-xs">
                  <td colSpan={5} className="px-4 py-2.5 text-muted-foreground">TOTAL ({filtered.length} registros)</td>
                  <td className="px-4 py-2.5 text-right">{fmt(filtered.reduce((s, i) => s + (i.base_imponible || 0), 0))} €</td>
                  <td className="hidden lg:table-cell"></td>
                  <td className="px-4 py-2.5 text-right font-bold">{fmt(filtered.reduce((s, i) => s + (i.total || 0), 0))} €</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
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
              <Input type="number" step="0.01" value={form.base_imponible}
                onChange={e => {
                  const base = parseFloat(e.target.value) || 0;
                  const cuota = base * (parseFloat(form.tipo_impuesto) || 0) / 100;
                  setForm(f => ({ ...f, base_imponible: e.target.value, cuota_impuesto: cuota.toFixed(2), total: (base + cuota).toFixed(2) }));
                }} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo impuesto (%)</Label>
              <Select value={String(form.tipo_impuesto)} onValueChange={v => {
                const base = parseFloat(form.base_imponible) || 0;
                const cuota = base * parseFloat(v) / 100;
                setForm(f => ({ ...f, tipo_impuesto: parseFloat(v), cuota_impuesto: cuota.toFixed(2), total: (base + cuota).toFixed(2) }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 4, 7, 10, 21].map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cuota impuesto (€)</Label>
              <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm">{fmt(form.cuota_impuesto)} €</div>
            </div>
            <div className="space-y-1.5">
              <Label>Total (€)</Label>
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