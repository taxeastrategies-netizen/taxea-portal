import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, X, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

export default function InventorySmartImport() {
  const { company, user } = useOutletContext() || {};
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [summary, setSummary] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  if (!company) return <NoCompanyState pageName="Importación" />;

  const handleFile = async (f) => {
    setFile(f);
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setFileUrl(file_url);
    setUploading(false);
  };

  const handleAnalyze = async () => {
    if (!fileUrl) return;
    setAnalyzing(true);
    setProposals([]);
    setSummary('');
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este documento (factura, albarán, ticket, Excel o imagen de compra) y extrae todos los productos/artículos que aparezcan.\n\nPara cada línea de producto detectada, proporciona:\n- nombre del producto\n- descripción\n- cantidad\n- precio unitario sin IVA\n- IVA si aparece\n- descuento si aparece\n- unidad de medida\n- proveedor si aparece\n- acción propuesta: "crear_producto", "actualizar_precio" o "registrar_entrada"\n- confianza (alta/media/baja)\n- aviso si hay algo extraño\n\nSi es un Excel de inventario, extrae todos los productos con sus stocks, precios y datos.\n\nGenera también un resumen ejecutivo de lo detectado.`,
      file_urls: [fileUrl],
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          supplier_detected: { type: 'string' },
          document_type: { type: 'string' },
          document_date: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                original_text: { type: 'string' },
                product_name: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                vat_rate: { type: 'number' },
                discount: { type: 'number' },
                unit_of_measure: { type: 'string' },
                suggested_sku: { type: 'string' },
                supplier_name: { type: 'string' },
                proposed_action: { type: 'string' },
                confidence: { type: 'string' },
                warning: { type: 'string' },
              }
            }
          }
        }
      }
    });
    const data = result.response || result;
    setProposals((data.lines || []).map((l, i) => ({ ...l, id: i, selected: true })));
    setSummary(data.summary || `Se detectaron ${data.lines?.length || 0} líneas de producto en el documento.`);
    setAnalyzing(false);
  };

  const toggleLine = (id) => setProposals(p => p.map(l => l.id === id ? { ...l, selected: !l.selected } : l));

  const handleImport = async () => {
    const selected = proposals.filter(l => l.selected && l.proposed_action !== 'ignorar');
    if (!selected.length) { toast.error('Selecciona al menos una línea'); return; }
    setImporting(true);
    let created = 0, updated = 0;
    for (const line of selected) {
      if (line.proposed_action === 'crear_producto' || line.proposed_action === 'registrar_entrada') {
        const margin = line.unit_price ? 0 : 0;
        await base44.entities.LogisticsProduct.create({
          company_id: company.id,
          name: line.product_name || line.original_text,
          description: line.description || '',
          sku: line.suggested_sku || '',
          unit_of_measure: line.unit_of_measure || 'ud',
          purchase_price: line.unit_price || 0,
          current_stock: line.quantity || 0,
          pmp_cost: line.unit_price || 0,
          status: 'activo',
          estimated_gross_margin: margin,
        });
        created++;
      }
    }
    toast.success(`Importación completada: ${created} productos creados, ${updated} actualizados`);
    setImporting(false);
    setDone(true);
  };

  const CONF_COLOR = { alta: 'text-emerald-600 bg-emerald-50', media: 'text-amber-600 bg-amber-50', baja: 'text-red-600 bg-red-50' };
  const ACTION_LABEL = { crear_producto: 'Crear producto', actualizar_precio: 'Actualizar precio', registrar_entrada: 'Entrada de stock', ignorar: 'Ignorar' };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Sparkles className="w-5 h-5 text-taxea-red" />Importación inteligente de inventario</h1>
        <p className="text-sm text-muted-foreground">Sube una factura, albarán, ticket, Excel o imagen. La IA extrae los productos automáticamente.</p>
      </div>

      {done ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="font-bold text-emerald-800 text-lg">¡Importación completada!</p>
          <p className="text-sm text-emerald-700 mt-2">Los productos se han creado en tu inventario.</p>
          <Button onClick={() => { setDone(false); setFile(null); setFileUrl(null); setProposals([]); setSummary(''); }} className="mt-4" variant="outline">Nueva importación</Button>
        </div>
      ) : (
        <>
          {/* Upload zone */}
          {!fileUrl && (
            <label className={cn('flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-colors', uploading ? 'border-taxea-red/50 bg-accent' : 'border-border hover:border-taxea-red/50 hover:bg-accent/50')}>
              {uploading ? <Loader2 className="w-10 h-10 text-taxea-red animate-spin mb-3" /> : <Upload className="w-10 h-10 text-muted-foreground mb-3" />}
              <p className="font-semibold text-foreground">{uploading ? 'Subiendo archivo...' : 'Arrastra o haz clic para subir'}</p>
              <p className="text-xs text-muted-foreground mt-1">Excel, PDF, imagen (JPG/PNG), CSV · Facturas, albaranes, tickets</p>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={uploading} />
            </label>
          )}

          {fileUrl && !proposals.length && !analyzing && (
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <FileText className="w-8 h-8 text-taxea-red flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">Archivo subido correctamente. Listo para analizar.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setFileUrl(null); }}><X className="w-3.5 h-3.5 mr-1" />Quitar</Button>
                <Button size="sm" onClick={handleAnalyze} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Analizar con IA
                </Button>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="bg-accent border border-border rounded-xl p-8 text-center">
              <Loader2 className="w-10 h-10 text-taxea-red animate-spin mx-auto mb-3" />
              <p className="font-semibold">Analizando documento...</p>
              <p className="text-sm text-muted-foreground mt-1">La IA está extrayendo productos, cantidades y precios</p>
            </div>
          )}

          {proposals.length > 0 && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Análisis completado</p>
                  <p className="text-xs text-emerald-700 mt-0.5">{summary}</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-semibold">{proposals.length} líneas detectadas</p>
                  <div className="flex gap-2">
                    <button onClick={() => setProposals(p => p.map(l => ({...l, selected: true})))} className="text-xs text-muted-foreground hover:text-foreground">Seleccionar todo</button>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={() => setProposals(p => p.map(l => ({...l, selected: false})))} className="text-xs text-muted-foreground hover:text-foreground">Deseleccionar todo</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 w-8"></th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Producto detectado</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cantidad</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Precio unit.</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Acción</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Confianza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {proposals.map(l => (
                        <tr key={l.id} className={cn('hover:bg-secondary/20', !l.selected && 'opacity-40')}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={l.selected} onChange={() => toggleLine(l.id)} className="rounded" />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{l.product_name || l.original_text}</p>
                            {l.warning && <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" />{l.warning}</p>}
                          </td>
                          <td className="px-4 py-3 text-right">{l.quantity ?? '—'} {l.unit_of_measure || 'ud'}</td>
                          <td className="px-4 py-3 text-right">{l.unit_price != null ? l.unit_price.toLocaleString('es-ES', {minimumFractionDigits: 2}) + ' €' : '—'}</td>
                          <td className="px-4 py-3">
                            <select value={l.proposed_action || 'crear_producto'} onChange={e => setProposals(p => p.map(pr => pr.id === l.id ? {...pr, proposed_action: e.target.value} : pr))} className="text-xs border border-input rounded px-2 py-1 bg-transparent">
                              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', CONF_COLOR[l.confidence] || CONF_COLOR.media)}>{l.confidence || 'media'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setProposals([]); setSummary(''); setFile(null); setFileUrl(null); }}>Nueva importación</Button>
                <Button onClick={handleImport} disabled={importing} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Importar {proposals.filter(l => l.selected).length} líneas
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}