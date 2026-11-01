import { Link } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';
import { getOutstandingAmount } from '@/lib/financialCore';
const fmt = value => value == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export default function LiquidityRiskEngine({ financials }) {
  const known = financials.bankKnown && financials.pagosPendientes !== null;
  const gap = known ? financials.cashDisponible - financials.pagosPendientes : null;
  const overdue = financials.financialError ? null : financials.vencidas.reduce((sum, row) => sum + getOutstandingAmount(row), 0);
  const warning = known && gap < 0;
  return <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-600"/><h3 className="text-sm font-semibold">Saldo y compromisos registrados</h3></div>
    <p className="mt-2 text-xs text-muted-foreground">Comparación documental; no es un diagnóstico de solvencia ni incluye todas las deudas futuras.</p>
    <dl className="mt-4 space-y-3 text-xs">{[['Saldo bancario EUR', financials.bankKnown ? financials.cashDisponible : null],['Facturas por pagar',financials.pagosPendientes],['Cobros vencidos registrados',overdue],['Saldo menos facturas por pagar',gap]].map(([label,value])=><div key={label} className="flex justify-between gap-3 border-b border-border/60 pb-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{fmt(value)}</dd></div>)}</dl>
    <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0"/><p>{!known ? 'Falta saldo reciente o información documental para comparar.' : warning ? 'Las facturas pendientes de pago superan el saldo observado. Revisa sus fechas y las fuentes de financiación.' : 'El saldo cubre las facturas pendientes registradas. Revisa también impuestos, nóminas y otros compromisos.'}</p></div>
    <Link to="/finance/ap" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">Revisar cuentas a pagar</Link>
  </section>;
}
