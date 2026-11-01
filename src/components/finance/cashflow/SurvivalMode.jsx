import { Wallet } from 'lucide-react';
const fmt = value => value == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export default function SurvivalMode({ financials }) {
  const known = financials.bankKnown && financials.cashHistorySufficient && Number.isFinite(financials.runway) && financials.burnRate > 0;
  return <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600"/><h3 className="text-sm font-semibold">Cobertura del saldo observado</h3></div>
    <div className="py-6 text-center"><p className="font-jakarta text-4xl font-bold">{known ? financials.runway.toFixed(1) : '—'}</p><p className="mt-2 text-xs text-muted-foreground">{known ? 'meses al mismo ritmo de salidas' : 'Sin base suficiente para calcular la cobertura'}</p></div>
    <div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-secondary/50 p-3"><p className="text-muted-foreground">Saldo bancario EUR</p><p className="mt-1 font-semibold">{fmt(financials.bankKnown ? financials.cashDisponible : null)}</p></div><div className="rounded-lg bg-secondary/50 p-3"><p className="text-muted-foreground">Salidas observadas / 30 días</p><p className="mt-1 font-semibold">{fmt(financials.cashHistorySufficient ? financials.burnRate : null)}</p></div></div>
    <p className="mt-4 text-xs text-muted-foreground">Escenario sin ingresos futuros, financiación ni nuevos compromisos. Las salidas bancarias pueden incluir inversiones y transferencias; no equivalen a costes de explotación. No determina una fecha de insolvencia.</p>
  </section>;
}
