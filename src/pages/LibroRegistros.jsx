import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { BookOpen, Download, FileText } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PnLPanel from '@/components/libros/PnLPanel.jsx';
import { exportarLibros } from '@/components/libros/ExportExcel.jsx';
import { exportarLibrosPDF } from '@/components/libros/ExportPDF.jsx';
import { useFinancialData } from '@/hooks/useFinancialData';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS = [
  { key: 'ventas', label: 'Libro Ventas' },
  { key: 'compras', label: 'Libro Compras' },
  { key: 'gastos', label: 'Gastos' },
  { key: 'pnl', label: 'P&L' },
];

export default function LibroRegistros() {
  const { company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('ventas');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [filterAnio, setFilterAnio] = useState(new Date().getFullYear().toString());
  const { invoices, expenses, loading } = useFinancialData(company?.id, { year: filterAnio });
  const [exporting, setExporting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  function inPeriod(item) {
    return filterTrimestre === 'all' || item.trimestre === filterTrimestre;
  }

  // Facturas y gastos activos (sin anular) — única fuente de verdad para tablas, KPIs, exportaciones y P&L
  const activeInvoices = useMemo(() => invoices.filter(i => !i.anulada), [invoices]);
  const activeExpenses = useMemo(() => expenses.filter(e => !e.anulada), [expenses]);

  const emitidas = useMemo(() => activeInvoices.filter(i => i.tipo === 'emitida' && inPeriod(i)), [activeInvoices, filterTrimestre]);
  const recibidas = useMemo(() => activeInvoices.filter(i => i.tipo === 'recibida' && inPeriod(i)), [activeInvoices, filterTrimestre]);
  const gastosF = useMemo(() => activeExpenses.filter(e => e.tipo === 'gasto' && inPeriod(e)), [activeExpenses, filterTrimestre]);

  // KPIs libro ventas
  const totalBaseV = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const totalCuotaV = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const totalRetV = emitidas.reduce((s, i) => s + (i.base_imponible || 0) * (i.retencion_irpf || 0) / 100, 0);
  const totalTotalV = emitidas.reduce((s, i) => s + (i.total_factura || 0), 0);

  // KPIs libro compras
  const totalBaseC = [...recibidas, ...gastosF].reduce((s, i) => s + (i.base_imponible || 0), 0);
  const totalCuotaC = [...recibidas].reduce((s, i) => s + (i.cuota_iva || 0), 0)
    + gastosF.reduce((s, e) => s + (e.cuota_impuesto || 0), 0);
  const totalTotalC = [...recibidas].reduce((s, i) => s + (i.total_factura || 0), 0)
    + gastosF.reduce((s, e) => s + (e.total || 0), 0);

  const handleExport = async () => {
    setExporting(true);
    await exportarLibros({
      invoices: activeInvoices, expenses: activeExpenses, year: filterAnio,
      companyName: company?.razon_social || company?.nombre_comercial || 'Empresa',
    });
    setExporting(false);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    await exportarLibrosPDF({
      invoices: activeInvoices, expenses: activeExpenses, year: filterAnio,
      companyName: company?.razon_social || company?.nombre_comercial || 'Empresa',
    });
    setExportingPDF(false);
  };

  if (loadingCompany && loading && !invoices.length) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="el Libro de Registros" />;

  return (
    <div>
      <PageHeader title="Libros de Registro" subtitle="Compatibles AEAT · Excel multipestaña">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterAnio} onValueChange={setFilterAnio}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="T1">T1 · Ene-Mar</SelectItem>
              <SelectItem value="T2">T2 · Abr-Jun</SelectItem>
              <SelectItem value="T3">T3 · Jul-Sep</SelectItem>
              <SelectItem value="T4">T4 · Oct-Dic</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handleExportPDF} disabled={exportingPDF}>
            {exportingPDF
              ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generando PDF…</>
              : <><FileText className="w-4 h-4" /> Exportar PDF</>
            }
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generando Excel…</>
              : <><Download className="w-4 h-4" /> Exportar Excel</>
            }
          </Button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* P&L */}
      {activeTab === 'pnl' && (
        <PnLPanel invoices={activeInvoices} expenses={activeExpenses} year={filterAnio} quarter={filterTrimestre === 'all' ? null : filterTrimestre} />
      )}

      {/* Libro Ventas */}
      {activeTab === 'ventas' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard label="Base imponible" value={fmt(totalBaseV)} />
            <KpiCard label="IVA/IGIC repercutido" value={fmt(totalCuotaV)} color="text-teal" />
            <KpiCard label="IRPF retenido" value={fmt(totalRetV)} color="text-destructive" />
            <KpiCard label="Total facturas" value={fmt(totalTotalV)} color="text-foreground font-bold" />
          </div>
          <LibroTable data={emitidas} tipo="ventas" loading={loading} />
        </>
      )}

      {/* Libro Compras */}
      {activeTab === 'compras' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <KpiCard label="Base imponible" value={fmt(totalBaseC)} />
            <KpiCard label="IVA/IGIC soportado" value={fmt(totalCuotaC)} color="text-teal" />
            <KpiCard label="Total" value={fmt(totalTotalC)} color="text-foreground font-bold" />
          </div>
          <div className="space-y-4">
            {recibidas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Facturas recibidas</p>
                <LibroTable data={recibidas} tipo="compras" loading={loading} />
              </div>
            )}
            {gastosF.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gastos registrados</p>
                <LibroTable data={gastosF} tipo="gastos_tabla" loading={false} />
              </div>
            )}
            {recibidas.length === 0 && gastosF.length === 0 && !loading && (
              <EmptyState />
            )}
          </div>
        </>
      )}

      {/* Gastos */}
      {activeTab === 'gastos' && (
        <LibroTable data={gastosF} tipo="gastos_tabla" loading={loading} />
      )}
    </div>
  );
}

function KpiCard({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center shadow-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-jakarta font-bold ${color}`}>{value} €</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center bg-card rounded-xl border border-border">
      <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="text-muted-foreground font-medium">Sin registros para este período</p>
    </div>
  );
}

function LibroTable({ data, tipo, loading }) {
  if (loading) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!data.length) return <EmptyState />;

  const esGasto = tipo === 'gastos_tabla';
  const esCompra = tipo === 'compras';

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Fecha</th>
              {!esGasto && <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Nº Factura</th>}
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{esGasto ? 'Proveedor' : 'Cliente/Proveedor'}</th>
              {!esGasto && <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">NIF/CIF</th>}
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Concepto</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs">Base</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Tipo %</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Cuota</th>
              {!esGasto && <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Ret. %</th>}
              <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs">Total</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">T</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.fecha_emision || item.fecha || '—'}</td>
                {!esGasto && <td className="px-3 py-2.5 font-medium text-foreground">{item.numero_factura || '—'}</td>}
                <td className="px-3 py-2.5 text-foreground">{item.cliente_nombre || item.proveedor_cliente || '—'}</td>
                {!esGasto && <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell text-xs">{item.cliente_nif || '—'}</td>}
                <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell max-w-[180px] truncate text-xs">{item.concepto || '—'}</td>
                <td className="px-3 py-2.5 text-right text-xs">{(item.base_imponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground hidden lg:table-cell text-xs">{item.tipo_iva ?? item.tipo_impuesto ?? 0}%</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground hidden lg:table-cell text-xs">{(item.cuota_iva || item.cuota_impuesto || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                {!esGasto && <td className="px-3 py-2.5 text-right text-muted-foreground hidden lg:table-cell text-xs">{item.retencion_irpf ?? 0}%</td>}
                <td className="px-3 py-2.5 text-right font-semibold text-xs">{(item.total_factura || item.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.trimestre}</span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={item.estado_contable || item.estado} /></td>
              </tr>
            ))}
          </tbody>
          {/* Totales */}
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/40 font-semibold text-xs">
              <td colSpan={!esGasto ? 5 : 3} className="px-3 py-2.5 text-muted-foreground">TOTAL ({data.length} registros)</td>
              <td className="px-3 py-2.5 text-right">{data.reduce((s, i) => s + (i.base_imponible || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
              <td className="hidden lg:table-cell"></td>
              <td className="px-3 py-2.5 text-right hidden lg:table-cell text-teal">
                {data.reduce((s, i) => s + (i.cuota_iva || i.cuota_impuesto || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </td>
              {!esGasto && <td className="hidden lg:table-cell"></td>}
              <td className="px-3 py-2.5 text-right font-bold">
                {data.reduce((s, i) => s + (i.total_factura || i.total || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}