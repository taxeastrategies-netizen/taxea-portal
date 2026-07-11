import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function ImpFinanceTab({ companyId, ejercicio }) {
  const [subtab, setSubtab] = useState('pyg');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const filter = { companyId, ejercicio: Number(ejercicio) };
    const query = subtab === 'pyg'
      ? base44.entities.ProfitLossLine.filter(filter, 'subcuenta', 200)
      : base44.entities.FinancialMetric.filter(filter, 'metrica', 100);
    query.then(d => { setData(d || []); setLoading(false); }).catch(() => { setLoading(false); setData([]); });
  }, [companyId, ejercicio, subtab]);

  const totalImpacto = data.reduce((acc, r) => acc + (r.impactoResultado || 0), 0);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSubtab('pyg')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            subtab === 'pyg' ? "bg-teal text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/70")}>
          <TrendingUp className="w-3.5 h-3.5" /> PyG
        </button>
        <button onClick={() => setSubtab('kpis')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            subtab === 'kpis' ? "bg-teal text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/70")}>
          <BarChart3 className="w-3.5 h-3.5" /> KPIs Financieros
        </button>
      </div>

      {subtab === 'pyg' && !loading && data.length > 0 && (
        <div className="mb-4 bg-teal-light/50 border border-teal/20 rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Impacto total en resultado (operativo)</p>
          <p className={cn("text-2xl font-jakarta font-bold", totalImpacto >= 0 ? "text-green-600" : "text-red-600")}>
            {fmt(totalImpacto)}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          Sin datos financieros para este ejercicio.
        </div>
      ) : subtab === 'pyg' ? (
        <PygTable rows={data} />
      ) : (
        <KpiTable rows={data} />
      )}
    </div>
  );
}

function PygTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Subcuenta</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Nombre</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Naturaleza</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Debe Op.</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Haber Op.</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Impacto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 font-mono text-xs">{r.subcuenta}</td>
                <td className="px-3 py-2 text-xs">{r.nombreSubcuenta}</td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{r.naturaleza}</td>
                <td className="px-3 py-2 text-right">{fmt(r.debeOperativo)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.haberOperativo)}</td>
                <td className={cn("px-3 py-2 text-right font-medium", (r.impactoResultado || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  {fmt(r.impactoResultado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Familia</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Métrica</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Valor</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Unidad</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 text-xs"><span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{r.familia}</span></td>
                <td className="px-3 py-2 text-xs font-medium">{r.metrica}</td>
                <td className="px-3 py-2 text-right font-medium">{r.unidad === 'EUR' ? fmt(r.valor) : r.valor}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.unidad}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">{r.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}