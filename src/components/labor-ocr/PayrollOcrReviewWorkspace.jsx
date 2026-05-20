import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, FileText,
  User, Calendar, Euro, Percent, Building2, Edit3, Save, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LaborAccountingEntryPreview from './LaborAccountingEntryPreview';

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

const CONFIDENCE_COLOR = {
  high: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  medium: 'border-amber-300 bg-amber-50 text-amber-800',
  low: 'border-red-300 bg-red-50 text-red-800',
  none: 'border-slate-200 bg-slate-50 text-slate-500',
};

function ConfField({ label, value, conf, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const level = !value && value !== 0 ? 'none' : conf >= 80 ? 'high' : conf >= 50 ? 'medium' : 'low';

  const handleSave = () => { setEditing(false); onEdit?.(val); };

  return (
    <div className={cn('border rounded-lg p-2.5 transition-all', CONFIDENCE_COLOR[level])}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">{label}</p>
      {editing ? (
        <div className="flex gap-1">
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            className="flex-1 text-sm bg-white border border-amber-300 rounded px-2 py-0.5 focus:outline-none"
            autoFocus
          />
          <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-800"><Save className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{value ?? '—'}</span>
          <button onClick={() => setEditing(true)} className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0">
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PayrollOcrReviewWorkspace({ document: doc, company, user, onBack, onRefresh }) {
  const [extraction, setExtraction] = useState(null);
  const [accountingEntry, setAccountingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('datos'); // datos | devengos | deducciones | asiento

  useEffect(() => {
    if (doc?.id) loadData();
  }, [doc?.id]);

  const loadData = async () => {
    setLoading(true);
    const extractions = await base44.entities.PayrollExtraction.filter({ labor_ocr_document_id: doc.id });
    setExtraction(extractions[0] || null);
    const entries = await base44.entities.LaborAccountingEntryProposal.filter({ labor_ocr_document_id: doc.id });
    setAccountingEntry(entries[0] || null);
    setLoading(false);
  };

  const handleValidate = async () => {
    setSaving(true);
    await base44.entities.LaborOcrDocument.update(doc.id, {
      ocr_status: 'validado',
      validation_status: 'validado',
      reviewed_by: user?.email,
      reviewed_at: new Date().toISOString(),
    });
    if (accountingEntry?.id) {
      await base44.entities.LaborAccountingEntryProposal.update(accountingEntry.id, { status: 'validado', validated_by: user?.email, validated_at: new Date().toISOString() });
    }
    if (doc.file_url && company?.id) {
      await base44.entities.HRDocument.create({
        company_id: company.id,
        employee_id: doc.employee_id || null,
        nombre: `Nómina ${extraction?.period_label || ''} - ${extraction?.employee_name || doc.original_file_name}`,
        tipo: 'nomina',
        archivo_url: doc.file_url,
        estado_firma: 'sin_firma',
        notas: `Validada desde OCR Laboral. Lote: ${doc.batch_id}`,
      });
    }
    setSaving(false);
    onBack?.();
  };

  const fields = doc?.extracted_fields || {};
  const conf = doc?.confidence_global || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver al lote
        </button>
        <div className="w-px h-4 bg-border" />
        <FileText className="w-4 h-4 text-taxea-red" />
        <span className="font-semibold text-sm truncate flex-1">{doc?.original_file_name}</span>
        <ConfidenceBadge value={conf} />
        <StatusBadge status={doc?.ocr_status} />
        {doc?.ocr_status !== 'validado' && (
          <Button onClick={handleValidate} disabled={saving} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Validar nómina
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: document viewer */}
          <div className="w-1/2 border-r border-border flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documento</p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {doc?.file_url ? (
                <iframe src={doc.file_url} className="w-full h-full min-h-[600px] rounded-lg border border-border" title="Documento" />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Vista previa no disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: extracted data */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border bg-secondary/30 px-4 pt-2 gap-1">
              {[
                { id: 'datos', label: 'Datos generales' },
                { id: 'devengos', label: 'Devengos' },
                { id: 'deducciones', label: 'Deducciones' },
                { id: 'asiento', label: 'Asiento contable' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors',
                    activeTab === t.id ? 'border-taxea-red text-taxea-red bg-white' : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {activeTab === 'datos' && (
                <>
                  {(fields.warnings || []).length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span className="text-xs font-semibold text-amber-800">Advertencias OCR</span></div>
                      {fields.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">· {w}</p>)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <ConfField label="Empleado" value={extraction?.employee_name || fields.employee_name} conf={conf} />
                    <ConfField label="NIF/NIE" value={extraction?.employee_tax_id || fields.employee_tax_id} conf={conf} />
                    <ConfField label="Núm. SS" value={extraction?.social_security_number || fields.social_security_number} conf={conf} />
                    <ConfField label="Periodo" value={extraction?.period_label || fields.period_label} conf={conf} />
                    <ConfField label="Empresa" value={extraction?.company_name || fields.company_name} conf={conf} />
                    <ConfField label="CIF empresa" value={extraction?.company_tax_id || fields.company_tax_id} conf={conf} />
                    <ConfField label="Días trabajados" value={extraction?.worked_days || fields.worked_days} conf={conf} />
                    <ConfField label="Grupo cotización" value={extraction?.professional_group || fields.professional_group} conf={conf} />
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Totales</p>
                    <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
                      {[
                        { label: 'Total devengado', value: extraction?.total_accruals || fields.total_accruals },
                        { label: 'Total deducciones', value: extraction?.total_deductions || fields.total_deductions },
                        { label: 'Retención IRPF', value: extraction?.irpf_amount || fields.irpf_amount },
                        { label: 'SS Trabajador', value: extraction?.employee_ss_amount || fields.employee_ss_amount },
                        { label: 'Base cotización CC', value: extraction?.contribution_base_common || fields.contribution_base_common },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-semibold">{fmt(r.value)}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="font-bold">Líquido a percibir</span>
                        <span className="font-bold text-emerald-600">{fmt(extraction?.net_pay || fields.net_pay)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'devengos' && (
                <LineTable lines={extraction?.devengos || fields.devengos || []} type="devengo" />
              )}

              {activeTab === 'deducciones' && (
                <LineTable lines={extraction?.deducciones || fields.deducciones || []} type="deduccion" />
              )}

              {activeTab === 'asiento' && (
                <LaborAccountingEntryPreview
                  entry={accountingEntry}
                  document={doc}
                  onRefresh={loadData}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LineTable({ lines, type }) {
  if (!lines?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">No se detectaron {type === 'devengo' ? 'devengos' : 'deducciones'}</div>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/50 border-b border-border">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Concepto</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">Cuenta</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Importe</th>
            <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Conf.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((l, i) => {
            const conf = l.confianza || 0;
            const color = conf >= 80 ? 'text-emerald-600' : conf >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 text-foreground">{l.descripcion || l.originalLabel || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{l.cuenta_sugerida || l.suggestedAccount || '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{typeof l.importe === 'number' ? l.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}</td>
                <td className="px-3 py-2 text-center"><span className={cn('font-semibold', color)}>{conf ? conf + '%' : '—'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBadge({ value }) {
  if (!value) return null;
  const color = value >= 80 ? 'bg-emerald-100 text-emerald-700' : value >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', color)}>Confianza {value}%</span>;
}

function StatusBadge({ status }) {
  const map = {
    procesado_alta_confianza: 'bg-emerald-100 text-emerald-700',
    procesado_con_advertencias: 'bg-amber-100 text-amber-700',
    requiere_revision: 'bg-orange-100 text-orange-700',
    validado: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };
  const labels = {
    procesado_alta_confianza: 'Alta confianza', procesado_con_advertencias: 'Advertencias',
    requiere_revision: 'Revisar', validado: 'Validado', error: 'Error',
  };
  if (!status) return null;
  return <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', map[status] || 'bg-slate-100 text-slate-600')}>{labels[status] || status}</span>;
}