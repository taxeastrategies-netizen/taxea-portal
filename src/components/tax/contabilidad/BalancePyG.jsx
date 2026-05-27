import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

function SectionRow({ code, name, amount }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-dashed border-border/50">
      <span className="text-muted-foreground"><span className="font-mono text-xs mr-2">{code}</span>{name}</span>
      <span className="font-mono">{fmt(Math.abs(amount))}</span>
    </div>
  );
}

function Section({ title, items, total }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">{title}</p>
      {items.map(a => <SectionRow key={a.code} code={a.code} name={a.name} amount={a.saldo} />)}
      <div className="flex justify-between text-sm font-semibold py-1.5 border-t border-border">
        <span>Total {title}</span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );
}

export default function BalancePyG() {
  const { data: entries = [], isLoading: le } = useQuery({
    queryKey: ['journal-entries-balance'],
    queryFn: () => base44.entities.JournalEntry.filter({ status: 'confirmado' }, '-date', 1000),
  });

  const { data: lines = [], isLoading: ll } = useQuery({
    queryKey: ['journal-lines-balance'],
    queryFn: () => base44.entities.JournalEntryLine.list('-created_date', 5000),
  });

  const confirmedIds = useMemo(() => new Set(entries.map(e => e.id)), [entries]);
  const confirmedLines = useMemo(() => lines.filter(l => confirmedIds.has(l.journalEntryId)), [lines, confirmedIds]);

  // Build saldo per account from confirmed lines
  const accountSaldos = useMemo(() => {
    const map = {};
    confirmedLines.forEach(l => {
      if (!l.accountCode) return;
      if (!map[l.accountCode]) map[l.accountCode] = { code: l.accountCode, name: l.accountName || l.accountCode, debit: 0, credit: 0 };
      map[l.accountCode].debit += Number(l.debit) || 0;
      map[l.accountCode].credit += Number(l.credit) || 0;
    });
    return Object.values(map).map(a => ({ ...a, saldo: a.debit - a.credit }));
  }, [confirmedLines]);

  // Balance accounts: groups 1-5
  const balanceAccounts = accountSaldos.filter(a => /^[12345]/.test(a.code));
  // PyG accounts: group 6 (gastos), group 7 (ingresos)
  const gastoAccounts = accountSaldos.filter(a => a.code.startsWith('6'));
  const ingresoAccounts = accountSaldos.filter(a => a.code.startsWith('7'));

  // Activo: saldo > 0 (deudor)
  const activo = balanceAccounts.filter(a => a.saldo > 0).sort((a, b) => a.code.localeCompare(b.code));
  // Pasivo/Patrimonio: saldo < 0 (acreedor) — mostrar en positivo
  const pasivo = balanceAccounts.filter(a => a.saldo < 0).sort((a, b) => a.code.localeCompare(b.code));

  const totalIngresos = ingresoAccounts.reduce((s, a) => s + Math.abs(a.saldo), 0);
  const totalGastos = gastoAccounts.reduce((s, a) => s + Math.abs(a.saldo), 0);
  const resultadoEjercicio = totalIngresos - totalGastos;

  const totalActivo = activo.reduce((s, a) => s + a.saldo, 0);
  // Pasivo+Patrimonio = sum of absolute values of negative saldos + resultado ejercicio
  const totalPasivoPatrimonio = pasivo.reduce((s, a) => s + Math.abs(a.saldo), 0) + resultadoEjercicio;
  const cuadra = Math.abs(totalActivo - totalPasivoPatrimonio) < 0.02;

  if (le || ll) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando...</div>;

  if (entries.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
        <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="font-semibold">Balance no generado por falta de datos</p>
        <p className="text-sm text-muted-foreground">El balance y la PyG se generarán cuando existan asientos confirmados en el libro diario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-primary" />
        <div>
          <p className="font-jakarta font-semibold">Balance y Cuenta de Pérdidas y Ganancias</p>
          <p className="text-xs text-muted-foreground">Calculado desde {entries.length} asientos confirmados.</p>
        </div>
        {accountSaldos.length > 0 && (
          <span className={cn('ml-auto text-xs font-medium px-2.5 py-1 rounded-full border', cuadra ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
            {cuadra ? '✓ Balance cuadrado' : '⚠ Balance pendiente de cuadrar'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* BALANCE */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="font-jakarta font-bold text-sm mb-3">Balance de situación</p>
          {activo.length === 0 && pasivo.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin movimientos en cuentas de balance (grupos 1–5).</p>
          ) : (
            <>
              {/* ACTIVO */}
              <Section title="ACTIVO" items={activo} total={totalActivo} />

              {/* PASIVO + PATRIMONIO */}
              <Section
                title="PASIVO Y PATRIMONIO NETO"
                items={pasivo.map(a => ({ ...a, saldo: Math.abs(a.saldo) }))}
                total={totalPasivoPatrimonio - resultadoEjercicio}
              />
              {resultadoEjercicio !== 0 && (
                <div className="flex justify-between text-sm py-1 border-b border-dashed border-border/50 mt-1">
                  <span className="text-muted-foreground"><span className="font-mono text-xs mr-2">PyG</span>Resultado del ejercicio</span>
                  <span className={cn('font-mono', resultadoEjercicio >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(resultadoEjercicio)}</span>
                </div>
              )}

              <div className="mt-3 pt-2 border-t-2 border-foreground/20 space-y-1">
                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL ACTIVO</span><span className="font-mono">{fmt(totalActivo)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL PASIVO + PATRIMONIO</span><span className="font-mono">{fmt(totalPasivoPatrimonio)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* PyG */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="font-jakarta font-bold text-sm mb-3">Cuenta de Pérdidas y Ganancias</p>
          {ingresoAccounts.length === 0 && gastoAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay datos suficientes para calcular este libro.</p>
          ) : (
            <>
              <Section title="INGRESOS (Grupo 7)" items={ingresoAccounts.map(a => ({ ...a, saldo: Math.abs(a.saldo) }))} total={totalIngresos} />
              <Section title="GASTOS (Grupo 6)" items={gastoAccounts.map(a => ({ ...a, saldo: Math.abs(a.saldo) }))} total={totalGastos} />

              <div className={cn('flex justify-between font-bold text-sm py-2 px-3 rounded-lg border mt-3', resultadoEjercicio >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800')}>
                <span>{resultadoEjercicio >= 0 ? 'Resultado ejercicio (beneficio)' : 'Resultado ejercicio (pérdida)'}</span>
                <span className="font-mono">{fmt(Math.abs(resultadoEjercicio))}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}