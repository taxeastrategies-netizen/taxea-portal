import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, ArrowDown, ArrowUp, Search, X, Save, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { toast } from 'sonner';

const TYPE_LABEL = { entrada_compra: 'Entrada compra', entrada_devolucion: 'Entrada devolución', entrada_ajuste: 'Entrada ajuste', salida_venta: 'Salida venta', salida_merma: 'Salida merma', salida_rotura: 'Salida rotura', salida_perdida: 'Salida pérdida', salida_robo: 'Salida robo', salida_autoconsumo: 'Autoconsumo', salida_ajuste: 'Salida ajuste', traspaso: 'Traspaso', regularizacion: 'Regularización' };
const TYPE_COLOR = (t) => t?.startsWith('entrada') ? 'bg-emerald-100 text-emerald-700' : t?.startsWith('salida') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

const NEEDS_REASON = ['salida_merma', 'salida_rotura', 'salida_perdida', 'salida_robo', 'entrada_ajuste', 'salida_ajuste', 'regularizacion'];

const EMPTY = { product_id: '', movement_type: 'entrada_compra', quantity: '', unit_cost: '', sale_price: '', movement_date: new Date().toISOString().split('T')[0], reason: '', document_ref: '', notes: '' };

export default function StockMovements() {
  const { company, user } = useOutletContext() || {};
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [movs, prods] = await Promise.all([
      base44.entities.StockMovement.filter({ company_id: company.id }, '-movement_date', 200),
      base44.entities.LogisticsProduct.filter({ company_id: company.id }),
    ]);
    setMovements(movs || []);
    setProducts(prods || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.product_id) { toast.error('Selecciona un producto'); return; }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { toast.error('La cantidad debe ser positiva'); return; }
    if (NEEDS_REASON.includes(form.movement_type) && !form.reason) { toast.error('El motivo es obligatorio para este tipo de movimiento'); return; }
    setSaving(true);
    const product = products.find(p => p.id === form.product_id);
    const qty = parseFloat(form.quantity);
    const unitCost = parseFloat(form.unit_cost) || 0;
    const isEntry = form.movement_type.startsWith('entrada');

    // Calculate new PMP if entry with cost
    let pmpBefore = product?.pmp_cost || product?.purchase_price || 0;
    let pmpAfter = pmpBefore;
    if (isEntry && unitCost > 0) {
      const currentStock = product?.current_stock || 0;
      const currentValue = currentStock * pmpBefore;
      const newValue = currentValue + qty * unitCost;
      pmpAfter = newValue / (currentStock + qty);
    }

    await base44.entities.StockMovement.create({
      company_id: company.id,
      product_id: form.product_id,
      product_name: product?.name || '',
      product_sku: product?.sku || '',
      movement_type: form.movement_type,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: qty * unitCost,
      sale_price: parseFloat(form.sale_price) || 0,
      movement_date: form.movement_date,
      reason: form.reason,
      document_ref: form.document_ref,
      notes: form.notes,
      created_by: user?.email || '',
      status: 'confirmado',
      pmp_before: pmpBefore,
      pmp_after: Math.round(pmpAfter * 100) / 100,
    });

    // Update product stock and PMP
    const newStock = (product?.current_stock || 0) + (isEntry ? qty : -qty);
    await base44.entities.LogisticsProduct.update(form.product_id, {
      current_stock: newStock,
      ...(isEntry && unitCost > 0 ? { pmp_cost: Math.round(pmpAfter * 100) / 100 } : {}),
    });

    toast.success('Movimiento registrado');
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY);
    load();
  };

  if (!company) return <NoCompanyState pageName="Movimientos" />;

  const filtered = movements.filter(m => {
    const matchSearch = !search || m.product_name?.toLowerCase().includes(search.toLowerCase()) || m.product_sku?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || (filterType === 'entradas' && m.movement_type?.startsWith('entrada')) || (filterType === 'salidas' && m.movement_type?.startsWith('salida')) || filterType === m.movement_type;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Movimientos de stock</h1>
          <p className="text-sm text-muted-foreground">{movements.length} movimientos registrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => { setForm({...EMPTY, movement_type: 'entrada_compra'}); setShowForm(true); }} variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <ArrowDown className="w-3.5 h-3.5" /> Entrada
          </Button>
          <Button size="sm" onClick={() => { setForm({...EMPTY, movement_type: 'salida_venta'}); setShowForm(true); }} variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
            <ArrowUp className="w-3.5 h-3.5" /> Salida
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {['all','entradas','salidas'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', filterType === t ? 'bg-taxea-red text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground')}>
            {t === 'all' ? 'Todos' : t === 'entradas' ? 'Entradas' : 'Salidas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cantidad</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Coste unit.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">PMP nuevo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Motivo/Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin movimientos</td></tr>
                ) : filtered.map(m => (
                  <tr key={m.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{m.movement_date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.product_name || m.product_id}</p>
                      {m.product_sku && <p className="text-xs text-muted-foreground font-mono">{m.product_sku}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', TYPE_COLOR(m.movement_type))}>
                        {TYPE_LABEL[m.movement_type] || m.movement_type}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 text-right font-bold', m.movement_type?.startsWith('entrada') ? 'text-emerald-600' : 'text-red-600')}>
                      {m.movement_type?.startsWith('entrada') ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{m.unit_cost ? m.unit_cost.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{m.pmp_after ? m.pmp_after.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[150px]">{m.reason || m.document_ref || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm">Registrar movimiento</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de movimiento</label>
                <select value={form.movement_type} onChange={e => setForm(p => ({...p, movement_type: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Producto *</label>
                <select value={form.product_id} onChange={e => setForm(p => ({...p, product_id: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">— Seleccionar producto —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.current_stock ?? 0})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Cantidad *</label>
                  <Input type="number" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Coste unitario (€)</label>
                  <Input type="number" value={form.unit_cost} onChange={e => setForm(p => ({...p, unit_cost: e.target.value}))} className="h-9 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha</label>
                  <Input type="date" value={form.movement_date} onChange={e => setForm(p => ({...p, movement_date: e.target.value}))} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Nº documento / ref.</label>
                  <Input value={form.document_ref} onChange={e => setForm(p => ({...p, document_ref: e.target.value}))} className="h-9 text-sm" placeholder="FAC-001..." />
                </div>
              </div>
              {NEEDS_REASON.includes(form.movement_type) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Motivo *</label>
                  <Input value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))} className="h-9 text-sm" placeholder="Motivo obligatorio" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Notas</label>
                <Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Registrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}