import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileDown, ChevronRight, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CURRENT_YEAR = new Date().getFullYear();

const PYG_STRUCTURE = [
  { label: 'Ingresos de explotación', types: ['ingreso'], prefix: '7', sign: 1 },
  { label: 'Gastos de explotación', types: ['gasto'], prefix: '6', sign: -1, subExclude: ['64'] },
  { label: 'Gastos de personal', types: ['gasto'], prefix: '64', sign: -1 },
  { label: 'Amortizaciones', types: ['amortizacion'], prefix: '68', sign: -1 },
];

function KpiCard({ label, value, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-bold font-mono mt-1', color)}>{fmt(value)} €</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, accounts, sign }) {
  const [expanded, setExpanded] = useState(true);
  const total = accounts.reduce((s, a) => s + a.saldo * sign, 0);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-sm text-foreground">{title}</span>
        <div className="flex items-center gap-3">
          <span className={cn('font-mono text-sm font-bold', total >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(total)} €</span>
          <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {accounts.length === 0 ? (
            <p className="px-4 py-2 text-xs text-muted-foreground">Sin datos.</p>
          ) : accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/10">
              <div>
                <span className="font-mono text-xs text-primary mr-2">{acc.code}</span>
                <span className="text-sm text-foreground">{acc.name}</span>
              </div>
              <span className={cn('font-mono text-sm', acc.saldo * sign >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(acc.saldo * sign)} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PerdidasGanancias() {
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(CURRENT_YEAR);

  const load = async () => {
    setLoading(true);
    const [accs, lns, ents] = await Promise.all([
      base44.entities.AccountingAccount.list('code', 300).catch(() => []),
      base44.entities.JournalEntryLine.list('created_date', 1000).catch(() => []),
      base44.entities.JournalEntry.list('-date', 500).catch(() => []),
    ]);
    setAccounts(accs || []);
    setLines(lns || []);
    setEntries(ents || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const confirmedEntryIds = useMemo(() => new Set(entries.filter(e => e.status === 'confirmado').map(e => e.id)), [entries]);
  const pendingCount = entries.filter(e => e.status === 'pendiente_revision' || e.status === 'borrador').length;

  const accountsWithSaldos = useMemo(() => {
    return accounts.map(acc => {
      const accLines = lines.filter(l => l.accountCode === acc.code && confirmedEntryIds.has(l.journalEntryId));
      const debe = accLines.reduce((s, l) => s + Number(l.debit || 0), 0) + Number(acc.openingDebit || 0);
      const haber = accLines.reduce((s, l) => s + Number(l.credit || 0), 0) + Number(acc.openingCredit || 0);
      return { ...acc, debe, haber, saldo: debe - haber };
    });
  }, [accounts, lines, confirmedEntryIds]);

  const ingresos = accountsWithSaldos.filter(a => a.type === 'ingreso' || (a.code || '').startsWith('7'));
  const gastos = accountsWithSaldos.filter(a => a.type === 'gasto' || (a.code || '').startsWith('6'));
  const personal = gastos.filter(a => (a.code || '').startsWith('64'));
  const otrosGastos = gastos.filter(a => !(a.code || '').startsWith('64'));

  const totalIngresos = ingresos.reduce((s, a) => s + a.saldo, 0);
  const totalGastos = gastos.reduce((s, a) => s + a.saldo, 0);
  const resultado = totalIngresos - totalGastos;
  const margen = totalIngresos > 0 ? (resultado / totalIngresos) * 100 : 0;

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Pérdidas y Ganancias', 20, 20);
    doc.setFontSize(10);
    doc.text(`Año: ${year}`, 20, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 20, 36);
    if (pendingCount > 0) doc.text(`⚠ Borrador sujeto a revisión contable — ${pendingCount} asientos pendientes`, 20, 42);
    doc.setFontSize(12);
    doc.text('Ingresos de explotación', 20, 54);
    doc.setFontSize(10);
    doc.text(`Total ingresos: ${fmt(totalIngresos)} €`, 20, 62);
    doc.text(`Total gastos: ${fmt(totalGastos)} €`, 20, 68);
    doc.text(`Resultado: ${fmt(resultado)} €`, 20, 74);
    doc.text(`Margen: ${margen.toFixed(1)}%`, 20, 80);
    doc.save(`pyg-${year}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Pérdidas y ganancias</h2>
          <p className="text-xs text-muted-foreground">Cuenta de resultados calculada desde cuentas de ingresos y gastos confirmadas.</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} className="h-8"><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={exportPDF} className="h-8 gap-1.5"><FileDown className="w-3.5 h-3.5" />PDF</Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Borrador sujeto a revisión contable — {pendingCount} asientos pendientes de confirmar
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos" value={totalIngresos} color="text-emerald-700" />
        <KpiCard label="Gastos" value={totalGastos} color="text-red-600" />
        <KpiCard label="Resultado" value={resultado} color={resultado >= 0 ? 'text-emerald-700' : 'text-red-600'} />
        <KpiCard label="Margen" value={margen} color={margen >= 0 ? 'text-emerald-700' : 'text-red-600'} sub="%" />
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          <Section title="Ingresos de explotación" accounts={ingresos} sign={1} />
          <Section title="Gastos de explotación" accounts={otrosGastos} sign={-1} />
          {personal.length > 0 && <Section title="Gastos de personal (64x)" accounts={personal} sign={-1} />}

          {/* Resultado final */}
          <div className={cn('flex items-center justify-between px-5 py-4 rounded-xl border-2 font-bold',
            resultado >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50')}>
            <div className="flex items-center gap-2">
              {resultado >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
              <span className={cn('text-sm', resultado >= 0 ? 'text-emerald-800' : 'text-red-800')}>
                Resultado del ejercicio
              </span>
            </div>
            <span className={cn('text-xl font-mono', resultado >= 0 ? 'text-emerald-700' : 'text-red-700')}>{fmt(resultado)} €</span>
          </div>
        </div>
      )}
    </div>
  );
}