import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Package, TrendingDown, AlertTriangle, TrendingUp, BarChart2, Plus, Upload, ArrowDown, ArrowUp, FileText, RefreshCw, Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const fmt = (n, decimals = 2) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtEur = (n) => fmt(n) + ' €';

function KpiCard({ title, value, sub, color = 'default', icon: Icon }) {
  const colors = {
    green: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
    default: 'border-border bg-card',
  };
  const iconColors = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', default: 'text-taxea-red' };
  return (
    <div className={cn('border rounded-xl p-4', colors[color])}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', iconColors[color])} />}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function LogisticsDashboard() {
  const { company, user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [prods, movs, alrts] = await Promise.all([
      base44.entities.LogisticsProduct.filter({ company_id: company.id }),
      base44.entities.StockMovement.filter({ company_id: company.id }, '-movement_date', 50),
      base44.entities.InventoryAlert.filter({ company_id: company.id, status: 'activa' }),
    ]);
    setProducts(prods || []);
    setMovements(movs || []);
    setAlerts(alrts || []);
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="Logística" />;

  const totalInventoryValue = products.reduce((s, p) => s + (p.current_stock || 0) * (p.pmp_cost || p.purchase_price || 0), 0);
  const criticalStock = products.filter(p => (p.current_stock || 0) <= (p.min_stock || 0) && (p.min_stock || 0) > 0);
  const overstock = products.filter(p => p.max_stock > 0 && (p.current_stock || 0) > p.max_stock);
  const noMovement = products.filter(p => {
    const lastMov = movements.find(m => m.product_id === p.id);
    return !lastMov;
  });
  const negativeMargin = products.filter(p => p.sale_price > 0 && (p.pmp_cost || p.purchase_price || 0) > p.sale_price);
  const avgMargin = products.length ? products.reduce((s, p) => s + (p.estimated_gross_margin || 0), 0) / products.length : 0;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  const recentMovements = movements.slice(0, 8);

  const QUICK_ACTIONS = [
    { label: 'Nuevo producto', icon: Plus, path: '/logistics/inventory', color: 'bg-taxea-red hover:bg-taxea-red-dark text-white' },
    { label: 'Importar inventario', icon: Upload, path: '/logistics/import', color: 'bg-white border border-border hover:bg-secondary text-foreground' },
    { label: 'Registrar entrada', icon: ArrowDown, path: '/logistics/movements', color: 'bg-white border border-border hover:bg-secondary text-foreground' },
    { label: 'Registrar salida', icon: ArrowUp, path: '/logistics/movements', color: 'bg-white border border-border hover:bg-secondary text-foreground' },
    { label: 'Valorar existencias', icon: BarChart2, path: '/logistics/valuation', color: 'bg-white border border-border hover:bg-secondary text-foreground' },
    { label: 'Ver alertas', icon: AlertTriangle, path: '/logistics/replenishment', color: alerts.length > 0 ? 'bg-red-50 border border-red-200 hover:bg-red-100 text-red-700' : 'bg-white border border-border hover:bg-secondary text-foreground' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground font-jakarta">Dashboard Logístico</h1>
          <p className="text-sm text-muted-foreground">Inventario, existencias, margen y cierre · {products.length} productos</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Actualizar
        </Button>
      </div>

      {/* Alertas críticas */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítica{criticalAlerts.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-700 mt-0.5">{criticalAlerts[0]?.title}</p>
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {QUICK_ACTIONS.map((a, i) => (
          <button key={i} onClick={() => navigate(a.path)} className={cn('flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all shadow-sm', a.color)}>
            <a.icon className="w-5 h-5" />
            {a.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Valor inventario" value={fmtEur(totalInventoryValue)} sub={`${products.length} productos activos`} icon={Package} color="default" />
            <KpiCard title="Stock crítico" value={criticalStock.length} sub="Bajo mínimo" icon={TrendingDown} color={criticalStock.length > 0 ? 'red' : 'green'} />
            <KpiCard title="Sobrestock" value={overstock.length} sub="Sobre máximo" icon={TrendingUp} color={overstock.length > 0 ? 'amber' : 'green'} />
            <KpiCard title="Margen medio" value={fmt(avgMargin, 1) + '%'} sub="Estimado bruto" icon={BarChart2} color={avgMargin < 10 ? 'red' : avgMargin < 25 ? 'amber' : 'green'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Sin movimiento" value={noMovement.length} sub="Sin ventas/entradas" icon={Package} color={noMovement.length > 5 ? 'amber' : 'default'} />
            <KpiCard title="Margen negativo" value={negativeMargin.length} sub="Precio < coste" icon={AlertTriangle} color={negativeMargin.length > 0 ? 'red' : 'green'} />
            <KpiCard title="Alertas activas" value={alerts.length} sub={`${criticalAlerts.length} críticas`} icon={AlertTriangle} color={criticalAlerts.length > 0 ? 'red' : alerts.length > 0 ? 'amber' : 'green'} />
            <KpiCard title="Pedidos pendientes" value="—" sub="Próximamente" icon={ShoppingCart} color="default" />
          </div>

          {/* Últimos movimientos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Últimos movimientos</p>
                <button onClick={() => navigate('/logistics/movements')} className="text-xs text-taxea-red hover:underline">Ver todos</button>
              </div>
              {recentMovements.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sin movimientos registrados</div>
              ) : (
                <div className="divide-y divide-border">
                  {recentMovements.map(m => (
                    <div key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', m.movement_type?.startsWith('entrada') ? 'bg-emerald-500' : m.movement_type?.startsWith('salida') ? 'bg-red-500' : 'bg-blue-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.product_name || m.product_id}</p>
                        <p className="text-xs text-muted-foreground">{m.movement_type?.replace('_', ' ')} · {m.movement_date}</p>
                      </div>
                      <p className={cn('text-sm font-semibold flex-shrink-0', m.movement_type?.startsWith('entrada') ? 'text-emerald-600' : 'text-red-600')}>
                        {m.movement_type?.startsWith('entrada') ? '+' : '-'}{m.quantity}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stock crítico */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Stock crítico</p>
                <button onClick={() => navigate('/logistics/replenishment')} className="text-xs text-taxea-red hover:underline">Ver panel</button>
              </div>
              {criticalStock.length === 0 ? (
                <div className="p-6 text-center text-sm text-emerald-600 font-medium">✓ Todo el stock está en nivel saludable</div>
              ) : (
                <div className="divide-y divide-border">
                  {criticalStock.slice(0, 6).map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {p.sku || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-red-600">{p.current_stock || 0}</p>
                        <p className="text-xs text-muted-foreground">mín: {p.min_stock || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}