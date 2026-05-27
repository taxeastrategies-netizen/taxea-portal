import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart2, AlertCircle } from 'lucide-react';

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '0,00 €';

function AccountGroup({ title, accounts, sign = 1 }) {
  if (accounts.length === 0) return null;
  const total = accounts.reduce((s, a) => s + (a.balance * sign), 0);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {accounts.map(a => (
        <div key={a.code} className="flex justify-between text-sm py-0.5 border-b border-dashed border-border/50">
          <span className="text-muted-foreground"><span className="font-mono text-xs mr-2">{a.code}</span>{a.name}</span>
          <span className="font-mono">{fmt(a.balance * sign)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-semibold py-1 border-t border-border">
        <span>Total {title}</span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );
}

export default function BalancePyG() {
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['journal-entries-balance'],
    queryFn: () => base44.entities.JournalEntry.filter({ status: 'confirmado' }, '-date', 1000),
  });

  const { data: lines = [], isLoading: loadingLines } = useQuery({
    queryKey: ['journal-lines-balance'],
    queryFn: () => base44.entities.JournalEntryLine.list('-created_date', 5000),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts-balance'],
    queryFn: () => base44.entities.AccountingAccount.list(),
  });

  const confirmedEntryIds = useMemo(() => new Set(entries.map(e => e.id)), [entries]);
  const confirmedLines = useMemo(() => lines.filter(l => confirmedEntryIds.has(l.journalEntryId)), [lines, confirmedEntryIds]);

  const accountBalances = useMemo(() => {
    const map = {};
    confirmedLines.forEach(l => {
      const code = l.accountCode;
      if (!code) return;
      if (!map[code]) map[code] = { code, name: l.accountName || code, debit: 0, credit: 0 };
      map[code].debit += Number(l.debit) || 0;
      map[code].credit += Number(l.credit) || 0;
    });
    return Object.values(map).map(a => ({ ...a, balance: a.debit - a.credit }));
  }, [confirmedLines]);

  const isLoading = loadingEntries || loadingLines;

  const getGroup = (prefix) => accountBalances.filter(a => a.code.startsWith(prefix));

  // PGC groups
  const activo = [...getGroup('1'), ...getGroup('2'), ...getGroup('3'), ...getGroup('4')].filter(a => a.balance > 0);
  const pasivo = [...getGroup('1'), ...getGroup('4'), ...getGroup('5')].filter(a => a.balance < 0).map(a => ({ ...a, balance: Math.abs(a.balance) }));
  const ingresos = getGroup('7').filter(a => a.balance !== 0);
  const gastos = getGroup('6').filter(a => a.balance !== 0);

  const totalIngresos = ingresos.reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalGastos = gastos.reduce((s, a) => s + Math.abs(a.balance), 0);
  const resultado = totalIngresos - totalGastos;

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando...</div>;

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          <div>
            <p className="font-jakarta font-semibold">Balance y Cuenta de Pérdidas y Ganancias</p>
            <p className="text-xs text-muted-foreground">Solo se calcula desde asientos confirmados.</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">Balance no generado por falta de datos</p>
          <p className="text-sm text-muted-foreground">El balance y la PyG se generarán cuando existan asientos confirmados en el libro diario.</p>
        </div>
      </div>
    );
  }

  if (accountBalances.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="font-semibold">Importe no disponible</p>
        <p className="text-sm text-muted-foreground">Los asientos confirmados no tienen líneas contables con cuentas asignadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-primary" />
        <div>
          <p className="font-jakarta font-semibold">Balance y Cuenta de Pérdidas y Ganancias</p>
          <p className="text-xs text-muted-foreground">Calculado desde {entries.length} asientos confirmados. Cada cifra es trazable hasta su asiento y factura original.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* BALANCE */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <p className="font-jakarta font-bold text-sm">Balance de situación</p>
          {activo.length === 0 && pasivo.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin movimientos en cuentas de balance.</p>
          ) : (
            <>
              <AccountGroup title="Activo" accounts={activo} />
              <AccountGroup title="Pasivo y Patrimonio" accounts={pasivo} />
            </>
          )}
        </div>

        {/* PyG */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <p className="font-jakarta font-bold text-sm">Cuenta de Pérdidas y Ganancias</p>
          {ingresos.length === 0 && gastos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay datos suficientes para calcular este libro.</p>
          ) : (
            <>
              <AccountGroup title="Ingresos (Grupo 7)" accounts={ingresos.map(a => ({ ...a, balance: Math.abs(a.balance) }))} />
              <AccountGroup title="Gastos (Grupo 6)" accounts={gastos.map(a => ({ ...a, balance: Math.abs(a.balance) }))} />
              <div className={`flex justify-between font-bold text-sm py-2 px-3 rounded-lg border ${resultado >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span>{resultado >= 0 ? '✓ Resultado del ejercicio (beneficio)' : '✗ Resultado del ejercicio (pérdida)'}</span>
                <span className="font-mono">{fmt(Math.abs(resultado))}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}