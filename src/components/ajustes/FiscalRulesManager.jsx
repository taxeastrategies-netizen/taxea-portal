import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ScrollText, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const TAXES = [
  { value: 'iva', label: 'IVA' },
  { value: 'igic', label: 'IGIC' },
  { value: 'irpf', label: 'IRPF' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'contabilidad', label: 'Contabilidad' },
];

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

export default function FiscalRulesManager({ companyId }) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState({ tax: 'iva', direction: 'ambos', documentType: 'emitida', operationType: '', counterpartyCondition: '', resultTreatment: '', taxRate: 0, withholdingRate: 0, deductiblePercent: 100, accountingMapping: '', modelsImpact: '', invoiceMention: '', autoApprovalAllowed: false, severity: 'media', sourceUrl: '' });

  useEffect(() => {
    if (companyId) load();
    else setLoading(false);
  }, [companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.FiscalRule.filter({ company_id: companyId });
      setRules(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newRule.resultTreatment) return;
    try {
      const created = await base44.entities.FiscalRule.create({
        ...newRule,
        company_id: companyId,
        version: 1,
        active: true,
        reviewedAt: new Date().toISOString(),
      });
      setRules(prev => [...prev, created]);
      setNewRule({ tax: 'iva', direction: 'ambos', documentType: 'emitida', operationType: '', counterpartyCondition: '', resultTreatment: '', taxRate: 0, withholdingRate: 0, deductiblePercent: 100, accountingMapping: '', modelsImpact: '', invoiceMention: '', autoApprovalAllowed: false, severity: 'media', sourceUrl: '' });
      setShowForm(false);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try { await base44.entities.FiscalRule.delete(id); setRules(prev => prev.filter(r => r.id !== id)); }
    catch (e) { console.error(e); }
  };

  const sevColors = {
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    baja: 'bg-slate-100 text-slate-600 border-slate-200',
    media: 'bg-amber-100 text-amber-700 border-amber-200',
    alta: 'bg-orange-100 text-orange-700 border-orange-200',
    critica: 'bg-red-100 text-red-700 border-red-200',
  };

  if (loading) return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">6. Reglas fiscales personalizadas ({rules.length})</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="h-8 gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" /> Nueva regla
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Las reglas personalizadas tienen prioridad sobre las reglas generales del motor. Úsalas para casos específicos del cliente.
      </p>

      {showForm && (
        <div className="bg-secondary/30 rounded-lg p-4 mb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Impuesto</Label>
              <Select value={newRule.tax} onValueChange={v => setNewRule(r => ({ ...r, tax: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{TAXES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Select value={newRule.direction} onValueChange={v => setNewRule(r => ({ ...r, direction: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="ingreso">Ingreso (emitida)</SelectItem>
                  <SelectItem value="gasto">Gasto (recibida)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de documento</Label>
              <Select value={newRule.documentType} onValueChange={v => setNewRule(r => ({ ...r, documentType: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emitida">Emitida</SelectItem>
                  <SelectItem value="recibida">Recibida</SelectItem>
                  <SelectItem value="rectificativa">Rectificativa</SelectItem>
                  <SelectItem value="simplificada">Simplificada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de operación</Label>
              <Input value={newRule.operationType} onChange={e => setNewRule(r => ({ ...r, operationType: e.target.value }))} className="h-9 text-sm" placeholder="Ej: intracomunitaria, ISP, exportación" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Resultado / tratamiento *</Label>
              <Input value={newRule.resultTreatment} onChange={e => setNewRule(r => ({ ...r, resultTreatment: e.target.value }))} className="h-9 text-sm" placeholder="Ej: exento_intracomunitario" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo impositivo (%)</Label>
              <Input type="number" value={newRule.taxRate} onChange={e => setNewRule(r => ({ ...r, taxRate: parseFloat(e.target.value) }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Retención (%)</Label>
              <Input type="number" value={newRule.withholdingRate} onChange={e => setNewRule(r => ({ ...r, withholdingRate: parseFloat(e.target.value) }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% Deducible</Label>
              <Input type="number" value={newRule.deductiblePercent} onChange={e => setNewRule(r => ({ ...r, deductiblePercent: parseFloat(e.target.value) }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severidad</Label>
              <Select value={newRule.severity} onValueChange={v => setNewRule(r => ({ ...r, severity: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Mención obligatoria en factura</Label>
              <Input value={newRule.invoiceMention} onChange={e => setNewRule(r => ({ ...r, invoiceMention: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Factura de comerciante minorista" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Modelos afectados</Label>
              <Input value={newRule.modelsImpact} onChange={e => setNewRule(r => ({ ...r, modelsImpact: e.target.value }))} className="h-9 text-sm" placeholder="Ej: 303, 349, 390" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newRule.autoApprovalAllowed} onChange={e => setNewRule(r => ({ ...r, autoApprovalAllowed: e.target.checked }))} className="rounded border-border" />
            <span className="text-xs text-foreground">Permitir autoaprobación con esta regla</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} className="bg-teal hover:bg-teal-dark">Crear regla</Button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showForm ? (
        <div className="text-center py-6">
          <ScrollText className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No hay reglas personalizadas. El motor usará las reglas generales.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-start justify-between border border-border rounded-lg p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-[10px]">{rule.tax?.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{rule.direction}</Badge>
                  <Badge variant="outline" className="text-[10px]">{rule.documentType}</Badge>
                  <Badge className={`text-[10px] ${sevColors[rule.severity] || sevColors.media}`}>{rule.severity}</Badge>
                  {rule.autoApprovalAllowed && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Auto</Badge>}
                </div>
                <p className="text-sm font-medium text-foreground">{rule.resultTreatment}</p>
                {rule.operationType && <span className="text-xs text-muted-foreground">Operación: {rule.operationType}</span>}
                {rule.taxRate > 0 && <span className="text-xs text-muted-foreground ml-2">· Tipo: {rule.taxRate}%</span>}
                {rule.withholdingRate > 0 && <span className="text-xs text-muted-foreground ml-2">· Ret: {rule.withholdingRate}%</span>}
                {rule.invoiceMention && <span className="text-xs text-muted-foreground ml-2">· Mención: "{rule.invoiceMention}"</span>}
              </div>
              <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}