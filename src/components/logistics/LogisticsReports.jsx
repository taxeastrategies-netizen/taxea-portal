import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FileText, Loader2, Sparkles, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const REPORT_TYPES = [
  { id: 'inventario_mensual', label: 'Inventario mensual', desc: 'Estado actual del inventario con valoración y KPIs principales.' },
  { id: 'existencias_trimestral', label: 'Existencias trimestral', desc: 'Análisis de existencias por periodo trimestral.' },
  { id: 'stock_critico', label: 'Stock crítico', desc: 'Productos bajo mínimo, alertas y recomendaciones de reposición.' },
  { id: 'margen', label: 'Análisis de margen', desc: 'Margen bruto por producto, categoría y familia.' },
  { id: 'rotacion', label: 'Rotación', desc: 'Velocidad de rotación, días en almacén y productos dormidos.' },
  { id: 'fiscal_contable', label: 'Fiscal-contable de existencias', desc: 'Valoración PMP/FIFO y asiento sugerido de regularización.' },
  { id: 'asesor', label: 'Resumen para asesor', desc: 'Informe ejecutivo listo para enviar a la asesoría.' },
];

export default function LogisticsReports() {
  const { company, user } = useOutletContext() || {};
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [selectedType, setSelectedType] = useState('inventario_mensual');
  const [period, setPeriod] = useState({ start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.LogisticsReport.filter({ company_id: company.id }, '-created_date', 20);
    setReports(data || []);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(selectedType);
    const products = await base44.entities.LogisticsProduct.filter({ company_id: company.id });
    const movements = await base44.entities.StockMovement.filter({ company_id: company.id }, '-movement_date', 200);
    const totalValue = products.reduce((s, p) => s + (p.current_stock || 0) * (p.pmp_cost || p.purchase_price || 0), 0);
    const critical = products.filter(p => p.min_stock > 0 && (p.current_stock || 0) <= p.min_stock);

    const prompt = `Genera un informe logístico profesional tipo "${selectedType}" para la empresa "${company.nombre || 'la empresa'}" para el periodo ${period.start} a ${period.end}.\n\nDatos disponibles:\n- Total productos: ${products.length}\n- Valor total inventario: ${totalValue.toFixed(2)} EUR\n- Productos en stock crítico: ${critical.length}\n- Movimientos en periodo: ${movements.filter(m => m.movement_date >= period.start && m.movement_date <= period.end).length}\n\nEl informe debe incluir: resumen ejecutivo, estado del inventario, KPIs principales, alertas detectadas, recomendaciones y si aplica asiento contable sugerido.\n\nIncluir nota: "Informe operativo y contable sujeto a revisión profesional."`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
    await base44.entities.LogisticsReport.create({
      company_id: company.id,
      report_type: selectedType,
      period_start: period.start,
      period_end: period.end,
      summary: typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500),
      content: { text: typeof result === 'string' ? result : JSON.stringify(result), products_count: products.length, total_value: totalValue, critical_count: critical.length },
      generated_by: user?.email || '',
      status: 'generado',
    });
    toast.success('Informe generado');
    setGenerating(null);
    load();
  };

  if (!company) return <NoCompanyState pageName="Informes logísticos" />;

  const STATUS_COLOR = { borrador: 'bg-slate-100 text-slate-600', generado: 'bg-emerald-100 text-emerald-700', obsoleto: 'bg-slate-100 text-slate-400' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Informes logísticos</h1>
          <p className="text-sm text-muted-foreground">Genera informes de inventario, margen, rotación y cierre fiscal-contable</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Generador */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold">Generar nuevo informe</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de informe</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {REPORT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{REPORT_TYPES.find(r => r.id === selectedType)?.desc}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha inicio</label>
            <input type="date" value={period.start} onChange={e => setPeriod(p => ({...p, start: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha fin</label>
            <input type="date" value={period.end} onChange={e => setPeriod(p => ({...p, end: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={!!generating} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Generando informe...' : 'Generar informe con IA'}
        </Button>
      </div>

      {/* Lista informes */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-semibold text-foreground">Sin informes generados</p>
          <p className="text-sm text-muted-foreground mt-1">Genera tu primer informe logístico para exportarlo o enviarlo a tu asesor</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Informe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Periodo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Resumen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Generado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-taxea-red flex-shrink-0" />
                        <p className="font-medium">{REPORT_TYPES.find(t => t.id === r.report_type)?.label || r.report_type}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{r.period_start} → {r.period_end}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-600')}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">{r.summary}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{new Date(r.created_date).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}