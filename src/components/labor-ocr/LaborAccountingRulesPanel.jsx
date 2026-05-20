import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Trash2, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONCEPT_TYPES = [
  { id: 'sueldos_salarios', label: 'Sueldos y salarios', defaultAccount: '640' },
  { id: 'ss_empresa', label: 'SS empresa', defaultAccount: '642' },
  { id: 'irpf', label: 'IRPF (HP Acreedora)', defaultAccount: '4751' },
  { id: 'ss_acreedora', label: 'SS Organismos acreedores', defaultAccount: '476' },
  { id: 'remuneraciones_pendientes', label: 'Remuneraciones pendientes', defaultAccount: '465' },
  { id: 'banco', label: 'Banco (pagos)', defaultAccount: '572' },
  { id: 'anticipos', label: 'Anticipos', defaultAccount: '460' },
  { id: 'indemnizaciones', label: 'Indemnizaciones', defaultAccount: '641' },
  { id: 'dietas', label: 'Dietas y desplazamientos', defaultAccount: '629' },
  { id: 'retribucion_especie', label: 'Retribución en especie', defaultAccount: '640' },
];

const DEFAULT_RULES = CONCEPT_TYPES.map(c => ({
  rule_name: c.label,
  concept_type: c.id,
  account_code: c.defaultAccount,
  account_name: c.label,
  priority: 0,
  active: true,
}));

export default function LaborAccountingRulesPanel({ company, onBack }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) loadRules();
  }, [company?.id]);

  const loadRules = async () => {
    setLoading(true);
    const data = await base44.entities.LaborAccountingRules.filter({ company_id: company.id });
    if (data.length === 0) {
      setRules(DEFAULT_RULES.map(r => ({ ...r, company_id: company.id, _new: true })));
    } else {
      setRules(data);
    }
    setLoading(false);
  };

  const handleChange = (idx, field, val) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const rule of rules) {
      const payload = { company_id: company.id, rule_name: rule.rule_name, concept_type: rule.concept_type, account_code: rule.account_code, account_name: rule.account_name, priority: rule.priority || 0, active: rule.active !== false };
      if (rule.id) await base44.entities.LaborAccountingRules.update(rule.id, payload);
      else await base44.entities.LaborAccountingRules.create(payload);
    }
    setSaving(false);
    loadRules();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="w-px h-4 bg-border" />
        <Settings className="w-4 h-4 text-taxea-red" />
        <span className="font-semibold text-sm">Reglas contables — OCR Laboral</span>
        <Button onClick={handleSave} disabled={saving} size="sm" className="ml-auto bg-taxea-red hover:bg-taxea-red/90 gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar reglas'}
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <p className="text-sm text-muted-foreground mb-4">Configura las cuentas contables que se usarán al generar asientos desde nóminas y seguros sociales. Las cuentas estándar del PGC español están preconfiguradas.</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Concepto</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Cuenta</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Descripción cuenta</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Activa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule, i) => (
                <tr key={i} className="hover:bg-secondary/20">
                  <td className="px-4 py-2.5 font-medium text-sm">{rule.rule_name}</td>
                  <td className="px-4 py-2.5">
                    <input
                      value={rule.account_code || ''}
                      onChange={e => handleChange(i, 'account_code', e.target.value)}
                      className="w-20 border border-input rounded px-2 py-1 text-sm font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <input
                      value={rule.account_name || ''}
                      onChange={e => handleChange(i, 'account_name', e.target.value)}
                      className="w-full border border-input rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="checkbox" checked={rule.active !== false} onChange={e => handleChange(i, 'active', e.target.checked)} className="w-4 h-4 accent-taxea-red" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}