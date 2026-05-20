import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { BarChart2, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtPct = (n) => (n ?? 0).toFixed(1) + '%';

export default function InventoryValuation() {
  const { company } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [fifoLayers, setFifoLayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('pmp');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [prods, movs, layers] = await Promise.all([
      base44.entities.LogisticsProduct.filter({ company_id: company.id }),
      base44.entities.StockMovement.filter({ company_id: company.id }, 'movement_date', 500),
      base44.entities.FifoLayer.filter({ company_id: company.id, status: 'activa' }),
    ]);
    setProducts(prods || []);
    setMovements(movs || []);
    setFifoLayers(layers || []);
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="Valoración" />;

  const activeProducts = products.filter(p => p.status === 'activo' && (p.current_stock || 0) > 0);

  const calcPMP = (p) => {
    const stock = p.current_stock || 0;
    const pmp = p.pmp_cost || p.purchase_price || 0;
    return { stock, cost: pmp, value: stock * pmp, method: 'PMP' };
  };

  const calcFIFO = (p) => {
    const layers = fifoLayers.filter(l => l.product_id === p.id);
    const totalValue = layers.reduce((s, l) => s + (l.remaining_quantity || 0) * (l.unit_cost || 0), 0);
    const totalQty = layers.reduce((s, l) => s + (l.remaining_quantity || 0), 0);
    const stock = p.current_stock || 0;
    const fifoStock = totalQty || stock;
    return { stock: fifoStock, cost: fifoStock > 0 ? totalValue / fifoStock : 0, value: totalValue || stock * (p.purchase_price || 0), method: 'FIFO' };
  };

  const getCalc = (p) => method === 'pmp' ? calcPMP(p) : calcFIFO(p);

  const totalValue = activeProducts.reduce((s, p) => s + getCalc(p).value, 0);
  const totalValuePMP = activeProducts.reduce((s, p) => s + calcPMP(p).value, 0);
  const totalValueFIFO = activeProducts.reduce((s, p) => s + calcFIFO(p).value, 0);

  const totalCostSales = movements.filter(m => m.movement_type?.startsWith('salida')).reduce((s, m) => s + (m.total_cost || 0), 0);
  const totalSaleRevenue = movements.filter(m => m.movement_type === 'salida_venta').reduce((s, m) => s + (m.quantity || 0) * (m.sale_price || 0), 0);
  const grossMargin = totalSaleRevenue > 0 ? ((totalSaleRevenue - totalCostSales) / totalSaleRevenue * 100) : 0;

  const warnings = [
    ...activeProducts.filter(p => !p.purchase_price && !p.pmp_cost).map(p => `${p.name}: sin coste de compra definido`),
    ...activeProducts.filter(p => (p.current_stock || 0) < 0).map(p => `${p.name}: stock negativo`),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Valoración de existencias</h1>
          <p className="text-sm text-muted-foreground">PMP, FIFO, margen y coste de ventas</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Método selector */}
      <div className="flex gap-2">
        {['pmp', 'fifo'].map(m => (
          <button key={m} onClick={() => setMethod(m)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', method === m ? 'bg-taxea-red text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground')}>
            {m === 'pmp' ? 'PMP - Precio Medio Ponderado' : 'FIFO - Primera entrada, primera salida'}
          </button>
        ))}
      </div>

      {/* Avisos */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-amber-800">Advertencias de valoración</p></div>
          {warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">· {w}</p>)}
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Valor existencias', value: fmt(totalValue), sub: `Método ${method.toUpperCase()}`, color: 'default' },
              { label: 'Coste de ventas', value: fmt(totalCostSales), sub: 'Salidas acumuladas', color: 'default' },
              { label: 'Ingresos estimados', value: fmt(totalSaleRevenue), sub: 'Ventas registradas', color: 'default' },
              { label: 'Margen bruto', value: fmtPct(grossMargin), sub: 'Estimado', color: grossMargin < 0 ? 'red' : grossMargin < 15 ? 'amber' : 'green' },
            ].map((k, i) => (
              <div key={i} className={cn('border rounded-xl p-4', k.color === 'green' ? 'border-emerald-200 bg-emerald-50' : k.color === 'amber' ? 'border-amber-200 bg-amber-50' : k.color === 'red' ? 'border-red-200 bg-red-50' : 'border-border bg-card')}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Comparativa PMP vs FIFO */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Comparativa PMP vs FIFO</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Método</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Valor existencias</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Coste de ventas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Margen bruto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Impacto fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className={cn('hover:bg-secondary/20', method === 'pmp' && 'bg-taxea-red/5')}>
                    <td className="px-4 py-3 font-semibold">PMP {method === 'pmp' && <span className="text-[10px] bg-taxea-red text-white px-1.5 py-0.5 rounded ml-2">Activo</span>}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(totalValuePMP)}</td>
                    <td className="px-4 py-3 text-right">{fmt(totalCostSales)}</td>
                    <td className="px-4 py-3 text-right">{fmtPct(grossMargin)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">Neutro</td>
                  </tr>
                  <tr className={cn('hover:bg-secondary/20', method === 'fifo' && 'bg-taxea-red/5')}>
                    <td className="px-4 py-3 font-semibold">FIFO {method === 'fifo' && <span className="text-[10px] bg-taxea-red text-white px-1.5 py-0.5 rounded ml-2">Activo</span>}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(totalValueFIFO)}</td>
                    <td className="px-4 py-3 text-right">{fmt(totalCostSales)}</td>
                    <td className="px-4 py-3 text-right">{fmtPct(grossMargin)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">Mayor beneficio si precios suben</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Estimación orientativa pendiente de revisión contable/fiscal. Los valores reflejan los movimientos registrados en el sistema.</p>
          </div>

          {/* Tabla por producto */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold">Valoración por producto ({activeProducts.length})</p></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Producto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Stock</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Coste {method.toUpperCase()}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Valor total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">P. Venta</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin productos con stock activo</td></tr>
                  ) : activeProducts.map(p => {
                    const c = getCalc(p);
                    const margin = p.sale_price > 0 && c.cost > 0 ? ((p.sale_price - c.cost) / p.sale_price * 100) : null;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground font-mono">{p.sku || '—'}</p></td>
                        <td className="px-4 py-3 text-right">{c.stock} {p.unit_of_measure || 'ud'}</td>
                        <td className="px-4 py-3 text-right">{c.cost ? c.cost.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmt(c.value)}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">{p.sale_price ? p.sale_price.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                        <td className={cn('px-4 py-3 text-right font-semibold hidden md:table-cell', margin === null ? 'text-muted-foreground' : margin < 0 ? 'text-red-600' : margin < 15 ? 'text-amber-600' : 'text-emerald-600')}>{margin !== null ? fmtPct(margin) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/30">
                    <td className="px-4 py-3 font-bold">TOTAL</td>
                    <td />
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-lg">{fmt(totalValue)}</td>
                    <td /><td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}