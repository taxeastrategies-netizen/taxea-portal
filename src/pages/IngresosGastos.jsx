import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, TrendingUp, TrendingDown, MoreVertical, Upload, BarChart3, Trash2, Download, CheckSquare, Square } from 'lucide-react';
import jsPDF from 'jspdf';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { calculateFinancialKPIs } from '@/lib/financialCore';
import { useFinancialData, triggerFinancialRefresh } from '@/hooks/useFinancialData';

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
  const { invoices, expenses, loading: finLoading } = useFinancialData(company?.id, { year: filterAnio });
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterAnio, setFilterAnio] = useState(new Date().getFullYear().toString());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  // Items unificados: facturas (excluyendo anuladas) + expenses
  const items = useMemo(() => {
    const invoiceItems = (invoices || [])
      .filter(inv => !inv.anulada)
      .map(inv => ({
        _source: 'invoice',
        _original: inv,
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
    const expenseItems = (expenses || []).map(e => ({ ...e, _source: 'expense' }));
    return [...expenseItems, ...invoiceItems];
  }, [invoices, expenses]);

  const handleSave = async () => {
    setSaving(true);
    const year = form.fecha ? new Date(form.fecha).getFullYear() : new Date().getFullYear();
    const month = form.fecha ? new Date(form.fecha).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    const base = parseFloat(form.base_imponible) || 0;
    const cuota = base * (parseFloat(form.tipo_impuesto) || 0) / 100;
    const total = parseFloat(form.total) || base + cuota;
    if (editing) {
      if (editing._source === 'invoice') {
        await base44.entities.Invoice.update(editing.id, {
          cliente_nombre: form.proveedor_cliente,
          concepto: form.concepto,
          fecha_emision: form.fecha,
          base_imponible: base,
          tipo_iva: parseFloat(form.tipo_impuesto) || 21,
          cuota_iva: cuota,
          total_factura: total,
          estado_contable: form.estado,
          categoria_gasto: form.categoria,
          anio: year, trimestre,
        });
      } else {
        await base44.entities.Expense.update(editing.id, {
          ...form, company_id: company.id,
          base_imponible: base, cuota_impuesto: cuota, total,
          tipo_impuesto: parseFloat(form.tipo_impuesto) || 21,
          anio: year, trimestre,
        });
      }
    } else {
      await base44.entities.Expense.create({
        ...form, company_id: company.id,
        base_imponible: base, cuota_impuesto: cuota, total,
        tipo_impuesto: parseFloat(form.tipo_impuesto) || 21,
        anio: year, trimestre, subido_por: user?.email,
      });
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); triggerFinancialRefresh();
  };

  const handleDelete = async (item) => {
    if (item._source === 'invoice') await base44.entities.Invoice.delete(item.id);
    else await base44.entities.Expense.delete(item.id);
    setSelected(s => { const n = new Set(s); n.delete(item.id); return n; });
    triggerFinancialRefresh();
  };

  const handleBulkDelete = async () => {
    const toDelete = filtered.filter(i => selected.has(i.id));
    await Promise.all(toDelete.map(i =>
      i._source === 'invoice' ? base44.entities.Invoice.delete(i.id) : base44.entities.Expense.delete(i.id)
    ));
    setSelected(new Set());
    setConfirmDelete(null);
    triggerFinancialRefresh();
  };

  const exportPDF = (rows) => {
    const doc = new jsPDF({ orientation: rows.length > 20 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.text('Ingresos y Gastos — Taxea', 14, 18);
    doc.setFontSize(9);
    doc.text(`Año: ${filterAnio} · ${rows.length} registros · Generado: ${new Date().toLocaleDateString('es-ES')}`, 14, 25);
    const headers = ['Tipo', 'Fecha', 'Proveedor/Cliente', 'Concepto', 'Base (€)', 'IVA%', 'Total (€)', 'T', 'Estado'];
    const colWidths = [18, 22, 40, 50, 22, 12, 22, 10, 22];
    let y = 32;
    // Header row
    doc.setFillColor(220, 50, 70); doc.setTextColor(255, 255, 255); doc.setFontSize(7);
    let x = 14;
    headers.forEach((h, i) => { doc.rect(x, y, colWidths[i], 6, 'F'); doc.text(h, x + 2, y + 4); x += colWidths[i]; });
    y += 8;
    doc.setTextColor(30, 30, 30); doc.setFontSize(7);
    rows.forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 14; }
      if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); x = 14; colWidths.forEach(w => { doc.rect(x, y - 1, w, 6, 'F'); x += w; }); }
      const cells = [
        item.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
        item.fecha || '—', (item.proveedor_cliente || '—').slice(0, 18),
        (item.concepto || '—').slice(0, 24),
        fmt(item.base_imponible), `${item.tipo_impuesto ?? 0}%`, fmt(item.total),
        item.trimestre || '—', item.estado || '—',
      ];
      x = 14;
      cells.forEach((cell, i) => { doc.text(String(cell), x + 2, y + 3.5); x += colWidths[i]; });
      y += 7;
    });
    // Totals
    y += 3;
    doc.setFontSize(8); doc.setFont(undefined, 'bold');
    const totalBase = rows.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const totalAll = rows.reduce((s, i) => s + (i.total || 0), 0);
    doc.text(`Total base: ${fmt(totalBase)} €   Total: ${fmt(totalAll)} €`, 14, y);
    doc.save(`ingresos-gastos-${filterAnio}.pdf`);
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

  // KPIs unificados (excluyen anuladas, mismas reglas que todos los dashboards)
  const finKPIs = calculateFinancialKPIs(invoices, expenses, { year: filterAnio, quarter: filterTrimestre });
  const totalIngresos = finKPIs.totalIngresos;
  const totalGastos = finKPIs.totalGastos;
  const totalBaseIng = finKPIs.baseIngresos;
  const totalBaseGas = finKPIs.baseGastos;
  const resultado = finKPIs.resultado;
  const margen = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100).toFixed(1) : '0.0';

  if ((loadingCompany && finLoading) || finLoading) return (
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportPDF(filtered.filter(i => selected.has(i.id)))}>
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setConfirmDelete('bulk')}>
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancelar</Button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {finLoading ? (
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
                  <th className="px-4 py-3 w-8">
                    <button onClick={() => {
                      if (selected.size === filtered.length) setSelected(new Set());
                      else setSelected(new Set(filtered.map(i => i.id)));
                    }} className="text-muted-foreground hover:text-foreground">
                      {selected.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
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
                 <tr key={item.id} className={`hover:bg-secondary/30 transition-colors ${selected.has(item.id) ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3 w-8">
                      <button onClick={() => setSelected(s => { const n = new Set(s); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} className="text-muted-foreground hover:text-foreground">
                        {selected.has(item.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
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
                          <DropdownMenuItem onClick={() => { setEditing(item); setForm(item._source === 'invoice' ? { tipo: item.tipo, fecha: item.fecha, proveedor_cliente: item.proveedor_cliente, concepto: item.concepto, base_imponible: item.base_imponible, tipo_impuesto: item.tipo_impuesto, cuota_impuesto: item.cuota_impuesto, total: item.total, estado: item.estado, categoria: item.categoria || 'otros' } : { ...item }); setShowForm(true); }}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportPDF([item])}>
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Descargar PDF
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => {
                              if (item._source === 'invoice') base44.entities.Invoice.update(item.id, { estado_contable: 'contabilizada' }).then(triggerFinancialRefresh);
                              else base44.entities.Expense.update(item.id, { estado: 'contabilizado' }).then(triggerFinancialRefresh);
                            }}>Contabilizar</DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(item)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
                          </DropdownMenuItem>
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

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar {confirmDelete === 'bulk' ? `${selected.size} registros` : 'este registro'}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (confirmDelete === 'bulk') handleBulkDelete();
              else { handleDelete(confirmDelete); setConfirmDelete(null); }
            }}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

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