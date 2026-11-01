import { financialExportNumber } from '@/lib/verifiedFinancialMetrics';
import { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = financialExportNumber;

const SHEETS = [
  { id: 'summary', label: 'P&L Summary', desc: 'Resumen ingresos, gastos y rentabilidad', checked: true },
  { id: 'cashflow', label: 'Cashflow', desc: 'Liquidez, caja, burn rate y runway', checked: true },
  { id: 'debt', label: 'Debt Schedule', desc: 'Instrumentos de deuda y cuotas', checked: true },
  { id: 'kpis', label: 'KPIs & Ratios', desc: 'Ratios financieros clave', checked: true },
  { id: 'ar', label: 'Accounts Receivable', desc: 'Facturas emitidas y estado de cobro', checked: false },
  { id: 'ap', label: 'Accounts Payable', desc: 'Facturas recibidas y estado de pago', checked: false },
  { id: 'transactions', label: 'Bank Transactions', desc: 'Movimientos bancarios', checked: false },
];

export default function ExcelExport({ financials, company, invoices, expenses, debts, bankAccounts, transactions }) {
  const [selected, setSelected] = useState(SHEETS.filter(s => s.checked).map(s => s.id));
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const f = financials || {};

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const exportExcel = async () => {
    setLoading(true);
    setDone(false);
    const wb = XLSX.utils.book_new();
    const companyName = company?.nombre_comercial || company?.razon_social || 'Empresa';
    const now = format(new Date(), "MMMM yyyy", { locale: es });

    if (selected.includes('summary')) {
      const data = [
        ['TAXEA BUSINESS OS — FINANCIAL REPORT', '', ''],
        [companyName, '', now],
        ['', '', ''],
        ['P&L SUMMARY', '', ''],
        ['Concepto', 'Importe (EUR)', 'Notas'],
        ['Ingresos contables', fmt(f.ingresos), 'Período actual'],
        ['Gastos contables', fmt(f.gastoTotal), ''],
        ['Resultado contable', fmt(f.beneficio), ''],
        ['Margen neto (%)', fmt(f.margenNeto), '%'],
        ['EBITDA contable', fmt(f.ebitda), ''],
        ['Cobros pendientes (AR)', fmt(f.cobrosPendientes), ''],
        ['Pagos pendientes (AP)', fmt(f.pagosPendientes), ''],
        ['Cobros menos pagos pendientes', fmt(f.workingCapital), ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'P&L Summary');
    }

    if (selected.includes('cashflow')) {
      const data = [
        ['CASHFLOW & LIQUIDEZ', '', ''],
        [companyName, '', now],
        ['', '', ''],
        ['Métrica', 'Valor', 'Unidad'],
        ['Caja disponible', fmt(f.cashTotal), 'EUR'],
        ['Salidas observadas / 30d', fmt(f.burnRate), 'EUR/mes'],
        ['Runway estimado', f.runway == null ? 'No verificable' : Number(f.runway.toFixed(1)), 'meses'],
        ['Cuotas mensuales deuda', fmt(f.cuotasMensuales), 'EUR'],
        ['Intereses anuales', fmt(f.interesesAnuales), 'EUR'],
        ['DSO (días cobro)', f.dso ?? 'No verificable', 'días'],
        ['DPO (días pago)', f.dpo ?? 'No verificable', 'días'],
        ['Cuentas bancarias', bankAccounts.length, 'cuentas'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Cashflow');
    }

    if (selected.includes('debt')) {
      const headers = ['Nombre', 'Tipo', 'Entidad', 'Importe inicial', 'Capital pendiente', 'TIN %', 'Cuota', 'Estado', 'Vencimiento'];
      const rows = debts.map(d => [
        d.nombre, d.tipo, d.entidad || '', fmt(d.importe_inicial), fmt(d.capital_pendiente || 0),
        d.tin || 0, fmt(d.cuota || 0), d.estado, d.fecha_vencimiento || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Debt Schedule');
    }

    if (selected.includes('kpis')) {
      const deudaEbitda = f.ebitda > 0 ? f.deudaTotal / f.ebitda : null;
      const cobInt = f.ebitda > 0 && f.interesesAnuales > 0 ? f.ebitda / f.interesesAnuales : null;
      const data = [
        ['KPIs & RATIOS FINANCIEROS', '', ''],
        [companyName, '', now],
        ['', '', ''],
        ['KPI', 'Valor', 'Criterio de lectura'],
        ['Margen EBITDA', `${f.margen?.toFixed(1) || 0}%`, 'EBITDA / ingresos contables'],
        ['Deuda / EBITDA', deudaEbitda === null ? 'No aplicable' : `${deudaEbitda.toFixed(2)}x`, 'Deuda registrada / EBITDA'],
        ['Cobertura intereses', cobInt === null ? 'No aplicable' : `${cobInt.toFixed(2)}x`, 'EBITDA / intereses registrados'],
        ['DSO (días cobro)', `${f.dso ?? 'No verificable'} días`, 'Media de cobros completos con fecha'],
        ['DPO (días pago)', `${f.dpo ?? 'No verificable'} días`, 'Media de pagos completos con fecha'],
        ['Cobros menos pagos pendientes', fmt(f.workingCapital), 'Diferencia documental; no es fondo de maniobra'],
        ['Runway (meses)', f.runway == null ? 'No verificable' : f.runway.toFixed(1), 'Escenario sin nuevos ingresos'],
        ['Salidas observadas / 30d', fmt(f.burnRate), ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, 'KPIs & Ratios');
    }

    if (selected.includes('ar')) {
      const headers = ['Nº Factura', 'Cliente', 'Fecha', 'Total', 'Estado cobro'];
      const rows = invoices.filter(i => i.tipo === 'emitida').map(i => [
        i.numero_factura || '', i.cliente_nombre || '', i.fecha_emision || '',
        fmt(i.total_factura), i.estado_cobro || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts Receivable');
    }

    if (selected.includes('ap')) {
      const headers = ['Nº Factura', 'Proveedor', 'Fecha', 'Total', 'Estado pago'];
      const rows = invoices.filter(i => i.tipo === 'recibida').map(i => [
        i.numero_factura || '', i.proveedor_nombre || i.cliente_nombre || '', i.fecha_emision || '',
        fmt(i.total_factura), i.estado_cobro || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts Payable');
    }

    if (selected.includes('transactions')) {
      const headers = ['Fecha', 'Concepto', 'Importe', 'Tipo', 'Categoría IA'];
      const rows = transactions.slice(0, 500).map(t => [
        t.fecha_operacion, t.concepto, t.importe, t.tipo, t.categoria_ia || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Bank Transactions');
    }

    const filename = `Taxea_Financial_Report_${companyName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMM')}.xlsx`;
    XLSX.writeFile(wb, filename);
    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-jakarta font-bold">Export Excel Premium</h3>
            <p className="text-emerald-300 text-sm mt-0.5">Exportación multi-pestaña con KPIs, ratios y datos financieros</p>
          </div>
        </div>
      </div>

      {/* Sheet selector */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Selecciona las pestañas a incluir</p>
        </div>
        <div className="divide-y divide-slate-50">
          {SHEETS.map(s => (
            <label key={s.id} className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50/50 transition-colors">
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}
                className="w-4 h-4 rounded accent-taxea-red" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-slate-400">{s.desc}</p>
              </div>
              {s.checked && <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Recomendado</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Export button */}
      <button onClick={exportExcel} disabled={loading || selected.length === 0}
        className={cn("w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-60",
          done ? "bg-emerald-600 text-white" : "bg-gradient-to-r from-emerald-700 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-500")}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        {loading ? 'Generando Excel…' : done ? '¡Descargado!' : `Exportar Excel (${selected.length} pestañas)`}
      </button>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          El archivo Excel incluirá los datos de <strong>{company?.nombre_comercial || company?.razon_social || 'tu empresa'}</strong> del período actual. 
          Los datos se extraen directamente de Taxea — facturas, gastos, deuda y movimientos bancarios.
        </p>
      </div>
    </div>
  );
}