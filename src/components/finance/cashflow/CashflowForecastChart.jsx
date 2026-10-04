import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { buildCashForecast } from '@/lib/cashForecast';

const fmt = value => value == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const VIEWS = [{ id: '7d', label: '7 días', days: 7 }, { id: '30d', label: '30 días', days: 30 }, { id: '13w', label: '13 semanas', days: 91 }];

export default function CashflowForecastChart({ invoices = [], obligations = [], events = [], treasury, treasuryError, supportError = '' }) {
  const [view, setView] = useState('13w');
  const days = VIEWS.find(item => item.id === view)?.days || 91;
  const forecast = useMemo(() => buildCashForecast({ invoices, obligations, events, treasury, treasuryError }), [invoices, obligations, events, treasury, treasuryError]);
  const data = forecast.points.slice(0, days);
  const next = data.at(-1)?.cash;
  const atRisk = forecast.hasBankBalance && data.some(row => row.cash < 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Previsión de tesorería">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-jakarta text-sm font-bold">Tesorería prevista</h3>
          <p className="mt-1 text-xs text-muted-foreground">{forecast.source}. Las fechas de cobro son estimaciones, no garantías.</p>
        </div>
        <div className="flex rounded-lg bg-secondary p-0.5">{VIEWS.map(item => <button key={item.id} type="button" onClick={() => setView(item.id)} className={'rounded-md px-2.5 py-1 text-xs ' + (view === item.id ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground')}>{item.label}</button>)}</div>
      </div>
      {supportError && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Previsión parcial: no se pudieron leer {supportError}. El saldo proyectado puede omitir pagos o cobros.</p>}
      {!forecast.hasBankBalance ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sin saldo bancario conectado y verificable. Se muestran los vencimientos registrados, pero no un saldo futuro inventado. <a href="/finance/treasury" className="font-semibold underline">Revisar bancos</a></div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-secondary/50 p-3"><p className="text-[11px] text-muted-foreground">Saldo bancario observado</p><p className="mt-1 text-base font-bold">{fmt(forecast.opening)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] text-emerald-700">Cobros previstos</p><p className="mt-1 text-base font-bold text-emerald-700">{fmt(data.reduce((sum, row) => sum + row.entradas, 0))}</p></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-[11px] text-rose-700">Pagos previstos</p><p className="mt-1 text-base font-bold text-rose-700">{fmt(data.reduce((sum, row) => sum + row.salidas, 0))}</p></div>
            <div className="rounded-xl bg-cyan-50 p-3"><p className="text-[11px] text-cyan-800">Saldo proyectado</p><p className="mt-1 text-base font-bold text-cyan-800">{fmt(next)}</p></div>
          </div>
          {atRisk && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">La proyección baja de cero durante este periodo. Confirma fechas y cobros antes de tomar decisiones.</p>}
          <div className="mt-5 h-[260px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 6, right: 9, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="day" interval={days === 7 ? 0 : days === 30 ? 4 : 13} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={value => Math.abs(value) >= 1000 ? Math.round(value / 1000) + 'k' : String(value)} />
            <Tooltip formatter={(value, name) => [fmt(value), name === 'cash' ? 'Saldo previsto' : name === 'entradas' ? 'Cobros' : 'Pagos']} labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="cash" name="cash" stroke="#059669" fill="#05966922" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="entradas" name="entradas" stroke="#2563eb" fill="transparent" dot={false} />
            <Area type="monotone" dataKey="salidas" name="salidas" stroke="#d97706" fill="transparent" dot={false} />
          </AreaChart></ResponsiveContainer></div>
        </>
      )}
      <details className="mt-4 rounded-lg border border-border bg-background"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Ver origen de la proyección ({forecast.movements.filter(row => row.date <= data.at(-1)?.date).length} apuntes)</summary>
        <div className="max-h-60 overflow-auto border-t border-border px-3 py-2 text-xs">
          {forecast.movements.filter(row => row.date <= data.at(-1)?.date).slice(0, 80).map(row => <a key={row.key} href={row.route} className="flex justify-between gap-3 border-b border-border py-1.5 hover:text-taxea-red"><span>{row.originalDate} · {row.label}{row.originalDate < row.date ? ' · vencido' : ''}</span><span className="shrink-0 font-semibold">{fmt(row.amount)}</span></a>)}
          {forecast.undated > 0 && <p className="py-2 text-amber-700">{forecast.undated} partidas sin fecha fiable o cobros vencidos no se incluyen en la curva; revísalas en su módulo de origen.</p>}
          {!forecast.movements.length && <p className="py-2 text-muted-foreground">No hay vencimientos cuantificados dentro del horizonte.</p>}
        </div>
      </details>
    </section>
  );
}
