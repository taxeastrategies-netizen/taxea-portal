import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FlaskConical, Loader2, CheckCircle, XCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TREATMENT_LABELS = {
  iva: 'IVA', igic: 'IGIC', exento: 'Exento', no_sujeto: 'No sujeto',
  exento_intracomunitario: 'Entrega intracomunitaria (exenta)',
  exento_exportacion: 'Exportación (exenta)',
  adquisicion_intracomunitaria: 'Adquisición intracomunitaria',
  inversion_sujeto_pasivo: 'Inversión del sujeto pasivo',
  sin_configuracion: 'Sin configuración',
};

export default function FiscalTestSimulator({ companyId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    direction: 'gasto',
    counterpartyName: 'Proveedor ejemplo',
    counterpartyTaxId: 'B12345678',
    invoiceBase: 1000,
    invoiceTaxRate: 21,
    invoiceTaxAmount: 210,
    invoiceWithholdingRate: 0,
    invoiceWithholdingAmount: 0,
    esProveedorExtranjero: false,
    detectedOperationType: 'interior',
  });

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('evaluateFiscalTreatment', { ...form, companyId, ocrData: { tipo_operacion: form.detectedOperationType } });
      setResult(res?.data || res);
    } catch (e) {
      console.error(e);
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-5 h-5 text-primary" />
        <h3 className="font-jakarta font-semibold text-foreground text-sm">Probar configuración con factura ejemplo</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">Dirección</Label>
          <Select value={form.direction} onValueChange={v => set('direction', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gasto">Gasto (recibida)</SelectItem>
              <SelectItem value="ingreso">Ingreso (emitida)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de operación</Label>
          <Select value={form.detectedOperationType} onValueChange={v => set('detectedOperationType', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interior">Interior</SelectItem>
              <SelectItem value="intracomunitaria">Intracomunitaria</SelectItem>
              <SelectItem value="exportacion">Exportación</SelectItem>
              <SelectItem value="adquisicion_intracomunitaria">Adquisición intracomunitaria</SelectItem>
              <SelectItem value="inversion_sujeto_pasivo">Inversión sujeto pasivo</SelectItem>
              <SelectItem value="importacion">Importación</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nombre contraparte</Label>
          <Input value={form.counterpartyName} onChange={e => set('counterpartyName', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">NIF contraparte</Label>
          <Input value={form.counterpartyTaxId} onChange={e => set('counterpartyTaxId', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Base imponible (€)</Label>
          <Input type="number" value={form.invoiceBase} onChange={e => set('invoiceBase', parseFloat(e.target.value))} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo impuesto (%)</Label>
          <Input type="number" value={form.invoiceTaxRate} onChange={e => set('invoiceTaxRate', parseFloat(e.target.value))} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cuota impuesto (€)</Label>
          <Input type="number" value={form.invoiceTaxAmount} onChange={e => set('invoiceTaxAmount', parseFloat(e.target.value))} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Retención IRPF (%)</Label>
          <Input type="number" value={form.invoiceWithholdingRate} onChange={e => set('invoiceWithholdingRate', parseFloat(e.target.value))} className="h-9 text-sm" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer col-span-2">
          <input type="checkbox" checked={form.esProveedorExtranjero} onChange={e => set('esProveedorExtranjero', e.target.checked)} className="rounded border-border" />
          <span className="text-xs text-foreground">Es proveedor extranjero</span>
        </label>
      </div>

      <Button onClick={runTest} disabled={loading} className="bg-teal hover:bg-teal-dark h-9 gap-2 w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {loading ? 'Evaluando...' : 'Probar configuración fiscal'}
      </Button>

      {result && !result.error && (
        <div className="mt-4 space-y-2">
          <div className={`rounded-lg p-3 border ${result.status === 'ready_to_post' ? 'bg-emerald-50 border-emerald-200' : result.status?.startsWith('blocked') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {result.status === 'ready_to_post' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
              <span className="text-sm font-semibold text-foreground">
                {TREATMENT_LABELS[result.proposedTreatment] || result.proposedTreatment} · {result.confidence}% confianza
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{result.explanation}</p>
          </div>

          {result.alerts?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Alertas:</p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {result.alerts.map((a, i) => <li key={i}>· {a}</li>)}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.proposedTaxRate > 0 && <div className="bg-secondary/40 rounded p-2"><span className="text-muted-foreground">Impuesto:</span> <span className="font-semibold">{result.proposedTaxRate}% = {result.proposedTaxAmount?.toFixed(2)}€</span></div>}
            {result.proposedWithholdingRate > 0 && <div className="bg-secondary/40 rounded p-2"><span className="text-muted-foreground">Retención:</span> <span className="font-semibold">{result.proposedWithholdingRate}% = {result.proposedWithholdingAmount?.toFixed(2)}€</span></div>}
            {result.deductibleAmount > 0 && <div className="bg-emerald-50 rounded p-2"><span className="text-emerald-600">Deducible:</span> <span className="font-semibold text-emerald-700">{result.deductibleAmount?.toFixed(2)}€</span></div>}
            {result.nonDeductibleAmount > 0 && <div className="bg-red-50 rounded p-2"><span className="text-red-600">No deducible:</span> <span className="font-semibold text-red-700">{result.nonDeductibleAmount?.toFixed(2)}€</span></div>}
            {result.reverseChargeAmount > 0 && <div className="bg-purple-50 rounded p-2"><span className="text-purple-600">Autorrepercusión:</span> <span className="font-semibold text-purple-700">{result.reverseChargeAmount?.toFixed(2)}€</span></div>}
          </div>
        </div>
      )}

      {result?.error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700">Error: {result.error}</p>
        </div>
      )}
    </div>
  );
}