import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileDown, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CURRENT_YEAR = new Date().getFullYear();

function Section({ title, accounts, sign = 1, defaultOpen = true }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const total = accounts.reduce((s, a) => s + a.saldo * sign, 0);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-sm text-foreground">{title}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-foreground">{fmt(total)} €</span>
          <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {accounts.length === 0 ? (
            <p className="px-4 py-2 text-xs text-muted-foreground">Sin cuentas clasificadas en este grupo.</p>
          ) : accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/10">
              <div>
                <span className="font-mono text-xs text-primary mr-2">{acc.code}</span>
                <span className="text-sm text-foreground">{acc.name}</span>
              </div>
              <span className="font-mono text-sm text-foreground">{fmt(acc.saldo * sign)} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BalanceSituacion() {
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
  const pendingCount = entries.filter(e => ['pendiente_revision', 'borrador'].includes(e.status)).length;

  const accountsWithSaldos = useMemo(() => {
    return accounts.map(acc => {
      const accLines = lines.filter(l => l.accountCode === acc.code && confirmedEntryIds.has(l.journalEntryId));
      const debe = accLines.reduce((s, l) => s + Number(l.debit || 0), 0) + Number(acc.openingDebit || 0);
      const haber = accLines.reduce((s, l) => s + Number(l.credit || 0), 0) + Number(acc.openingCredit || 0);
      return { ...acc, debe, haber, saldo: debe - haber };
    });
  }, [accounts, lines, confirmedEntryIds]);

  // Classification
  const activoNoCorriente = accountsWithSaldos.filter(a => a.type === 'activo' && (a.code || '').match(/^[12]/));
  const activoCorriente = accountsWithSaldos.filter(a => (a.type === 'activo' || a.type === 'cliente' || a.type === 'banco') && (a.code || '').match(/^[345]/));
  const patrimonioNeto = accountsWithSaldos.filter(a => a.type === 'patrimonio' || (a.code || '').startsWith('1'));
  const pasivoNoCorriente = accountsWithSaldos.filter(a => a.type === 'pasivo' && (a.code || '').match(/^1[56]/));
  const pasivoCorriente = accountsWithSaldos.filter(a => (a.type === 'pasivo' || a.type === 'proveedor' || a.type === 'impuesto') && (a.code || '').match(/^4/));

  const totalActivo = [...activoNoCorriente, ...activoCorriente].reduce((s, a) => s + a.saldo, 0);
  const totalPatrimonio = patrimonioNeto.reduce((s, a) => s + a.saldo, 0);
  const totalPasivo = [...pasivoNoCorriente, ...pasivoCorriente].reduce((s, a) => s + Math.abs(a.saldo), 0);
  const diff = Math.round((totalActivo - totalPatrimonio - totalPasivo) * 100) / 100;
  const cuadrado = Math.abs(diff) < 0.01;

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Balance de Situación', 20, 20);
    doc.setFontSize(10);
    doc.text(`Año: ${year}`, 20, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 20, 36);
    if (pendingCount > 0) doc.text(`⚠ Borrador sujeto a revisión — ${pendingCount} asientos pendientes`, 20, 42);
    let y = 54;
    doc.setFontSize(12);
    doc.text('ACTIVO', 20, y); y += 8;
    doc.setFontSize(10);
    doc.text(`  Activo no corriente: ${fmt(activoNoCorriente.reduce((s, a) => s + a.saldo, 0))} €`, 20, y); y += 6;
    doc.text(`  Activo corriente: ${fmt(activoCorriente.reduce((s, a) => s + a.saldo, 0))} €`, 20, y); y += 6;
    doc.text(`  TOTAL ACTIVO: ${fmt(totalActivo)} €`, 20, y); y += 10;
    doc.setFontSize(12);
    doc.text('PATRIMONIO NETO', 20, y); y += 8;
    doc.setFontSize(10);
    doc.text(`  Total patrimonio: ${fmt(totalPatrimonio)} €`, 20, y); y += 10;
    doc.setFontSize(12);
    doc.text('PASIVO', 20, y); y += 8;
    doc.setFontSize(10);
    doc.text(`  Pasivo no corriente: ${fmt(pasivoNoCorriente.reduce((s, a) => s + Math.abs(a.saldo), 0))} €`, 20, y); y += 6;
    doc.text(`  Pasivo corriente: ${fmt(pasivoCorriente.reduce((s, a) => s + Math.abs(a.saldo), 0))} €`, 20, y); y += 6;
    doc.text(`  TOTAL PASIVO: ${fmt(totalPasivo)} €`, 20, y); y += 10;
    doc.text(`Cuadre: ${cuadrado ? 'OK' : `DESCUADRE ${fmt(diff)} €`}`, 20, y);
    doc.save(`balance-${year}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Balance de situación</h2>
          <p className="text-xs text-muted-foreground">Estructura patrimonial calculada desde cuentas de activo, pasivo y patrimonio.</p>
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

      {/* Control de cuadre */}
      <div className={cn('flex flex-wrap items-center justify-between gap-4 px-5 py-3 rounded-xl border-2',
        cuadrado ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50')}>
        <div className="flex items-center gap-2">
          {cuadrado ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
          <span className={cn('text-sm font-semibold', cuadrado ? 'text-emerald-800' : 'text-red-800')}>
            {cuadrado ? 'Balance cuadrado' : 'El balance no cuadra. Revisa asientos pendientes, apertura, cierre o cuentas sin clasificar.'}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <span>Activo: <strong>{fmt(totalActivo)} €</strong></span>
          <span>PN: <strong>{fmt(totalPatrimonio)} €</strong></span>
          <span>Pasivo: <strong>{fmt(totalPasivo)} €</strong></span>
          {!cuadrado && <span className="text-red-700 font-bold">Dif: {fmt(Math.abs(diff))} €</span>}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm font-bold text-foreground uppercase tracking-wide px-1">ACTIVO</p>
            <Section title="Activo no corriente" accounts={activoNoCorriente} sign={1} />
            <Section title="Activo corriente" accounts={activoCorriente} sign={1} />
            <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl font-bold text-sm">
              <span>TOTAL ACTIVO</span>
              <span className="font-mono">{fmt(totalActivo)} €</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-foreground uppercase tracking-wide px-1">PATRIMONIO NETO Y PASIVO</p>
            <Section title="Patrimonio neto" accounts={patrimonioNeto} sign={-1} />
            <Section title="Pasivo no corriente" accounts={pasivoNoCorriente} sign={-1} />
            <Section title="Pasivo corriente" accounts={pasivoCorriente} sign={-1} />
            <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl font-bold text-sm">
              <span>TOTAL PN + PASIVO</span>
              <span className="font-mono">{fmt(totalPatrimonio + totalPasivo)} €</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}