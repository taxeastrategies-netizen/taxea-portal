import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, AlertTriangle, CheckCircle, Loader2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_LABELS = {
  ready_to_post: { label: 'Listo para contabilizar', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  review_required: { label: 'Requiere revisión', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  blocked_missing_fiscal_profile: { label: 'Falta configuración fiscal', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  blocked_conflict_ocr_vs_config: { label: 'Conflicto fiscal detectado', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
};

const TREATMENT_LABELS = {
  iva: 'IVA',
  igic: 'IGIC',
  exento: 'Exento',
  no_sujeto: 'No sujeto',
  exento_intracomunitario: 'Entrega intracomunitaria (exenta)',
  exento_exportacion: 'Exportación (exenta)',
  adquisicion_intracomunitaria: 'Adquisición intracomunitaria',
  inversion_sujeto_pasivo: 'Inversión del sujeto pasivo',
  sin_configuracion: 'Sin configuración',
};

export default function FiscalAssessmentPanel({ ocrData, companyId, direction, counterpartyName, counterpartyTaxId, invoiceBase, invoiceTaxRate, invoiceTaxAmount, invoiceWithholdingRate, invoiceWithholdingAmount, esProveedorExtranjero }) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const evaluate = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('evaluateFiscalTreatment', {
        ocrData,
        companyId,
        direction,
        counterpartyName,
        counterpartyTaxId,
        invoiceBase,
        invoiceTaxRate,
        invoiceTaxAmount,
        invoiceWithholdingRate,
        invoiceWithholdingAmount,
        esProveedorExtranjero,
      });
      const data = res?.data || res;
      setAssessment(data);
    } catch (e) {
      console.error('[FiscalAssessment] Error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (companyId && direction) evaluate();
  }, [companyId, direction, counterpartyTaxId]);

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
        <span className="text-xs text-indigo-700 font-medium">Evaluando tratamiento fiscal...</span>
      </div>
    );
  }

  if (!assessment) return null;

  const statusCfg = STATUS_LABELS[assessment.status] || STATUS_LABELS.review_required;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-indigo-200">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-900">Resultado fiscal propuesto</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${statusCfg.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-indigo-500 hover:text-indigo-700">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-indigo-500">Tratamiento:</span>{' '}
            <span className="font-semibold text-indigo-900">{TREATMENT_LABELS[assessment.proposedTreatment] || assessment.proposedTreatment}</span>
          </div>
          <div>
            <span className="text-indigo-500">Confianza:</span>{' '}
            <span className={`font-semibold ${assessment.confidence >= 70 ? 'text-emerald-600' : assessment.confidence >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{assessment.confidence}%</span>
          </div>
          {assessment.proposedTaxRate > 0 && (
            <div>
              <span className="text-indigo-500">Impuesto:</span>{' '}
              <span className="font-semibold text-indigo-900">{assessment.proposedTaxRate}% = {assessment.proposedTaxAmount?.toFixed(2)}€</span>
            </div>
          )}
          {assessment.proposedWithholdingRate > 0 && (
            <div>
              <span className="text-indigo-500">Retención IRPF:</span>{' '}
              <span className="font-semibold text-indigo-900">{assessment.proposedWithholdingRate}% = {assessment.proposedWithholdingAmount?.toFixed(2)}€</span>
            </div>
          )}
          {assessment.deductibleAmount > 0 && (
            <div>
              <span className="text-indigo-500">Deducible:</span>{' '}
              <span className="font-semibold text-emerald-600">{assessment.deductibleAmount?.toFixed(2)}€</span>
            </div>
          )}
          {assessment.nonDeductibleAmount > 0 && (
            <div>
              <span className="text-indigo-500">No deducible:</span>{' '}
              <span className="font-semibold text-red-600">{assessment.nonDeductibleAmount?.toFixed(2)}€</span>
            </div>
          )}
          {assessment.reverseChargeAmount > 0 && (
            <div>
              <span className="text-indigo-500">Autorrepercusión:</span>{' '}
              <span className="font-semibold text-purple-600">{assessment.reverseChargeAmount?.toFixed(2)}€</span>
            </div>
          )}
        </div>

        {/* Explanation */}
        {assessment.explanation && (
          <div className="mt-2 bg-white/60 rounded p-2">
            <p className="text-xs text-indigo-700 leading-relaxed">{assessment.explanation}</p>
          </div>
        )}
      </div>

      {/* Alerts */}
      {assessment.alerts?.length > 0 && (
        <div className="px-3 pb-2">
          {assessment.alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-1.5 mt-1">
              <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-amber-700">{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded: rules + review reasons */}
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-indigo-200 pt-2 space-y-2">
          {assessment.reviewReasons?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-indigo-900 mb-1">Motivos de revisión:</p>
              <ul className="text-xs text-indigo-700 space-y-0.5">
                {assessment.reviewReasons.map((r, i) => <li key={i}>· {r}</li>)}
              </ul>
            </div>
          )}
          {assessment.appliedRules?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-indigo-900 mb-1">Reglas aplicadas:</p>
              <div className="flex flex-wrap gap-1">
                {assessment.appliedRules.map((rule, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-white border-indigo-200 text-indigo-600">
                    {rule}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {assessment.profileSummary && (
            <div className="flex items-start gap-1.5">
              <Info className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-500">
                Perfil: {assessment.profileSummary.territory?.replace(/_/g, '/')} · {assessment.profileSummary.entityType} · {assessment.profileSummary.regime} · {assessment.profileSummary.deductionRight}
                {assessment.profileSummary.activityName && ` · ${assessment.profileSummary.activityName}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}