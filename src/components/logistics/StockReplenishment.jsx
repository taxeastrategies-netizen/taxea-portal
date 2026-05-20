import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, TrendingUp, Package, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

export default function StockReplenishment() {
  const { company } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('critico');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [prods, movs] = await Promise.all([
      base44.entities.LogisticsProduct.filter({ company_id: company.id }),
      base44.entities.StockMovement.filter({ company_id: company.id }, '-movement_date', 200),
    ]);
    setProducts(prods || []);
    setMovements(movs || []);
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="Reposición" />;

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600 * 1000);

  const criticalStock = products.filter(p => p.min_stock > 0 && (p.current_stock || 0) <= p.min_stock);
  const overstock = products.filter(p => p.max_stock > 0 && (p.current_stock || 0) > p.max_stock);
  const noMovement = products.filter(p => {
    const lastMov = movements.find(m => m.product_id === p.id);
    return !lastMov || new Date(lastMov.movement_date) < thirtyDaysAgo;
  });
  const negativeMargin = products.filter(p => p.sale_price > 0 && (p.pmp_cost || p.purchase_price || 0) > p.sale_price);

  const blockedCash = noMovement.reduce((s, p) => s + (p.current_stock || 0) * (p.pmp_cost || p.purchase_price || 0), 0);

  const getReplenishRecommendation = (p) => {
    const sales30 = movements.filter(m => m.product_id === p.id && m.movement_type === 'salida_venta' && new Date(m.movement_date) > thirtyDaysAgo);
    const totalSold = sales30.reduce((s, m) => s + (m.quantity || 0), 0);
    const dailyRate = totalSold / 30;
    if (dailyRate === 0) return { qty: p.min_stock || 10, days: null, note: 'Sin historial de ventas. Se sugiere reponer hasta stock mínimo.' };
    const daysLeft = dailyRate > 0 ? Math.floor((p.current_stock || 0) / dailyRate) : 999;
    const suggestedQty = Math.max(p.min_stock || 0, Math.ceil(dailyRate * 30));
    return { qty: suggestedQty, days: daysLeft, note: `Venta media: ${dailyRate.toFixed(1)} ud/día. Stock para ${daysLeft} días.` };
  };

  const VIEWS = [
    { id: 'critico', label: 'Stock crítico', count: criticalStock.length, color: 'red' },
    { id: 'sobrestock', label: 'Sobrestock', count: overstock.length, color: 'amber' },
    { id: 'parado', label: 'Sin movimiento', count: noMovement.length, color: 'amber' },
    { id: 'margen', label: 'Margen negativo', count: negativeMargin.length, color: 'red' },
  ];

  const currentList = view === 'critico' ? criticalStock : view === 'sobrestock' ? overstock : view === 'parado' ? noMovement : negativeMargin;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Panel de reposición y alertas</h1>
          <p className="text-sm text-muted-foreground">Stock crítico, sobrestock y productos inmovilizados</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Radar dinero bloqueado */}
      {blockedCash > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">{fmt(blockedCash)} inmovilizados en stock sin movimiento</p>
            <p className="text-xs text-amber-700 mt-0.5">{noMovement.length} productos sin movimiento en los últimos 30 días. Considera liquidar, bajar precio o revisar descatalogación.</p>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} className={cn('p-3 rounded-xl border text-left transition-all', view === v.id ? 'border-taxea-red bg-accent' : 'border-border bg-card hover:bg-secondary/50')}>
            <p className={cn('text-2xl font-bold', v.color === 'red' ? 'text-red-600' : 'text-amber-600', v.count === 0 && 'text-emerald-600')}>{v.count}</p>
            <p className="text-xs text-muted-foreground mt-1">{v.label}</p>
            {v.count === 0 && <p className="text-[10px] text-emerald-600">✓ OK</p>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : currentList.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <p className="font-semibold text-emerald-800">¡Todo en orden!</p>
          <p className="text-sm text-emerald-700 mt-1">No hay productos en esta categoría de alerta</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Producto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Stock actual</th>
                  {view === 'critico' && <><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Stock mín.</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Reponer</th></>}
                  {view === 'sobrestock' && <><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Stock máx.</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Exceso</th></>}
                  {view === 'parado' && <><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Valor bloqueado</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Acción sugerida</th></>}
                  {view === 'margen' && <><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Coste PMP</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">P. Venta</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Pérdida/ud</th></>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Recomendación IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentList.map(p => {
                  const rec = getReplenishRecommendation(p);
                  const stockValue = (p.current_stock || 0) * (p.pmp_cost || p.purchase_price || 0);
                  const costPMP = p.pmp_cost || p.purchase_price || 0;
                  return (
                    <tr key={p.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground font-mono">{p.sku || '—'}</p></td>
                      <td className={cn('px-4 py-3 text-right font-bold', view === 'critico' ? 'text-red-600' : view === 'sobrestock' ? 'text-amber-600' : 'text-foreground')}>{p.current_stock ?? 0} {p.unit_of_measure || 'ud'}</td>
                      {view === 'critico' && <>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.min_stock}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{rec.qty} ud</td>
                      </>}
                      {view === 'sobrestock' && <>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.max_stock}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">{(p.current_stock || 0) - p.max_stock} ud</td>
                      </>}
                      {view === 'parado' && <>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">{fmt(stockValue)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">Liquidar · Bajar precio · Devolver a proveedor</td>
                      </>}
                      {view === 'margen' && <>
                        <td className="px-4 py-3 text-right text-muted-foreground">{costPMP > 0 ? costPMP.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.sale_price > 0 ? p.sale_price.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{costPMP > 0 && p.sale_price > 0 ? (-1 * (p.sale_price - costPMP)).toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                      </>}
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{rec.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}