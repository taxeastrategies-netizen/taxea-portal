import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, FileText,
  User, Calendar, Euro, Building2, Edit3, Save, Loader2,
  ShieldAlert, Info, Search, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LaborAccountingEntryPreview from './LaborAccountingEntryPreview';

const fmt = (n) => (typeof n === 'number' && !isNaN(n)) ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
const fmtPct = (n) => (typeof n === 'number' && !isNaN(n)) ? n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + '%' : '—';

const CONF_STYLES = {
  alta: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  media: 'border-amber-300 bg-amber-50 text-amber-900',
  baja: 'border-red-300 bg-red-50 text-red-900',
  no_fiable: 'border-red-400 bg-red-100 text-red-900 ring-1 ring-red-300',
};

const CONF_BADGE = {
  alta: 'bg-emerald-100 text-emerald-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-red-100 text-red-700',
  no_fiable: 'bg-red-200 text-red-800 font-bold',
};

function ConfField({ label, value, conf = 'media', source, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');

  const handleSave = () => { setEditing(false); onEdit?.(val); };

  return (
    <div className={cn('border rounded-lg p-2.5 transition-all', CONF_STYLES[conf] || CONF_STYLES.media)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CONF_BADGE[conf] || CONF_BADGE.media)}>
          {conf === 'no_fiable' ? '⚠ No fiable' : conf === 'alta' ? '✓ Alta' : conf === 'media' ? '~ Media' : '✗ Baja'}
        </span>
      </div>
      {editing ? (
        <div className="flex gap-1">
          <input value={val} onChange={e => setVal(e.target.value)} className="flex-1 text-sm bg-white border rounded px-2 py-0.5 focus:outline-none" autoFocus />
          <button onClick={handleSave} className="text-emerald-600"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground"><XCircle className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{value ?? <span className="text-muted-foreground italic">No detectado</span>}</span>
          <button onClick={() => setEditing(true)} className="opacity-30 hover:opacity-100 flex-shrink-0"><Edit3 className="w-3 h-3" /></button>
        </div>
      )}
      {source && <p className="text-[10px] text-muted-foreground mt-1 truncate">Fuente: {source}</p>}
    </div>
  );
}

function MathBadge({ ok, label, diff }) {
  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-lg text-xs', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      <span className="font-medium">{label}</span>
      {!ok && diff != null && <span className="ml-auto opacity-70">Dif: {fmt(diff)}</span>}
    </div>
  );
}

export default function PayrollOcrReviewWorkspace({ document: doc, company, user, onBack }) {
  const [extraction, setExtraction] = useState(null);
  const [accountingEntry, setAccountingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [activeTab, setActiveTab] = useState('identificacion');

  useEffect(() => { if (doc?.id) loadData(); }, [doc?.id]);

  const loadData = async () => {
    setLoading(true);
    const [extractions, entries] = await Promise.all([
      base44.entities.PayrollExtraction.filter({ labor_ocr_document_id: doc.id }),
      base44.entities.LaborAccountingEntryProposal.filter({ labor_ocr_document_id: doc.id }),
    ]);
    setExtraction(extractions[0] || null);
    setAccountingEntry(entries[0] || null);
    setLoading(false);
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    await base44.functions.invoke('processLaborOcr', { document_id: doc.id });
    setTimeout(() => { loadData(); setReprocessing(false); }, 4000);
  };

  const handleValidate = async () => {
    setSaving(true);
    const f = doc?.extracted_fields?.response || doc?.extracted_fields || {};
    const empName = f.employee?.full_name || doc.original_file_name;
    const periodLabel = f.period?.label || '';
    const docName = `Nómina ${periodLabel} - ${empName}`.trim();
    const now = new Date().toISOString();

    await base44.entities.LaborOcrDocument.update(doc.id, {
      ocr_status: 'validado',
      validation_status: 'validado',
      reviewed_by: user?.email,
      reviewed_at: now,
    });

    if (accountingEntry?.id) {
      await base44.entities.LaborAccountingEntryProposal.update(accountingEntry.id, {
        status: 'validado',
        validated_by: user?.email,
        validated_at: now,
      });
    }

    if (doc.file_url && company?.id) {
      // 1. People HR > Docs y firmas
      await base44.entities.HRDocument.create({
        company_id: company.id,
        employee_id: doc.employee_id || null,
        nombre: docName,
        tipo: 'nomina',
        archivo_url: doc.file_url,
        estado_firma: 'sin_firma',
        notas: `Validada desde OCR Laboral. Confianza: ${doc.confidence_global}%`,
      });

      // 2. Documentos > Laboral > Nóminas
      await base44.entities.Document.create({
        company_id: company.id,
        nombre: docName,
        carpeta: 'lab_nominas',
        archivo_url: doc.file_url,
        tipo_archivo: 'pdf',
        anio: f.period?.year || new Date().getFullYear(),
        estado: 'aprobado',
        etiquetas: ['nómina', 'ocr-laboral', empName].filter(Boolean),
        subido_por: user?.email || '',
        comentarios: `Validada desde OCR Laboral. Confianza: ${doc.confidence_global}%. Empleado: ${empName}. Periodo: ${periodLabel}.`,
      });
    }

    toast.success('Nómina validada y archivada', {
      description: 'Guardada en Documentos › Laboral › Nóminas y en People HR › Docs y firmas',
    });
    setSaving(false);
    onBack?.();
  };

  // Handle both wrapped (result.response) and unwrapped formats
  const fields = doc?.extracted_fields?.response || doc?.extracted_fields || {};
  const emp = fields.employee || {};
  const comp = fields.company || {};
  const per = fields.period || {};
  const totals = fields.totals || {};
  const mathVal = fields.math_validation || {};
  const conf = doc?.confidence_global || 0;

  const hasConflicts = (fields.identity_conflicts || []).length > 0;
  const canValidate = doc?.ocr_status !== 'validado' && !hasConflicts;

  const TABS = [
    { id: 'identificacion', label: 'Identificación', icon: User },
    { id: 'periodo', label: 'Periodo', icon: Calendar },
    { id: 'devengos', label: 'Devengos', icon: Euro },
    { id: 'deducciones', label: 'Deducciones', icon: Euro },
    { id: 'bases_totales', label: 'Bases y totales', icon: Euro },
    { id: 'asiento', label: 'Asiento', icon: FileText },
    { id: 'evidencias', label: 'Evidencias', icon: Search },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border bg-card flex items-center gap-3 flex-shrink-0 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="w-px h-4 bg-border" />
        <FileText className="w-4 h-4 text-taxea-red flex-shrink-0" />
        <span className="font-semibold text-sm truncate max-w-xs">{doc?.original_file_name}</span>
        <ConfBadge value={conf} />
        <DocStatusBadge status={doc?.ocr_status} />
        {hasConflicts && (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3" /> Conflictos de identidad
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReprocess} disabled={reprocessing} className="gap-1.5">
            {reprocessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-analizar
          </Button>
          {canValidate && (
            <Button size="sm" onClick={handleValidate} disabled={saving || hasConflicts} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Validar nómina
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* PDF viewer */}
          <div className="w-[45%] border-r border-border flex flex-col flex-shrink-0">
            <div className="px-4 py-2 border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documento</div>
            <div className="flex-1 overflow-auto p-3">
              {doc?.file_url ? (
                <iframe src={doc.file_url} className="w-full h-full min-h-[600px] rounded-lg border border-border" title="Nómina" />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">Vista previa no disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border bg-secondary/20 overflow-x-auto flex-shrink-0">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5',
                    activeTab === t.id ? 'border-taxea-red text-taxea-red bg-white' : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <t.icon className="w-3 h-3" />{t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Warnings */}
              {(fields.warnings || []).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span className="text-xs font-semibold text-amber-800">Advertencias</span></div>
                  {fields.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">· {w}</p>)}
                </div>
              )}
              {(fields.identity_conflicts || []).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5"><ShieldAlert className="w-3.5 h-3.5 text-red-600" /><span className="text-xs font-semibold text-red-800">Conflictos de identidad</span></div>
                  {fields.identity_conflicts.map((c, i) => <p key={i} className="text-xs text-red-700">· {c}</p>)}
                </div>
              )}

              {/* Tab: Identificación */}
              {activeTab === 'identificacion' && (
                <div className="space-y-4">
                  <Section title="Trabajador" icon={User}>
                    <div className="grid grid-cols-2 gap-2">
                      <ConfField label="Nombre completo" value={emp.full_name} conf={emp.name_confidence} source={emp.name_source} />
                      <ConfField label="DNI / NIE" value={emp.tax_id} conf={emp.tax_id_confidence} source={emp.tax_id_source} />
                      <ConfField label="NAF / NUSS" value={emp.naf} conf={emp.naf_confidence} source={emp.naf_source} />
                      <ConfField label="Grupo cotización" value={emp.professional_group} conf="media" />
                      <ConfField label="Tipo contrato" value={emp.contract_type} conf="media" />
                      <ConfField label="Antigüedad" value={emp.seniority_date} conf="media" />
                    </div>
                  </Section>
                  <Section title="Empresa" icon={Building2}>
                    <div className="grid grid-cols-2 gap-2">
                      <ConfField label="Razón social" value={comp.name} conf={comp.name_confidence} source={comp.name_source} />
                      <ConfField label="CIF / NIF" value={comp.tax_id} conf={comp.tax_id_confidence} source={comp.tax_id_source} />
                      <ConfField label="CCC (cta. cotización)" value={comp.ccc} conf="media" />
                      <ConfField label="Domicilio" value={comp.address} conf="media" />
                    </div>
                  </Section>
                  {fields.processing_notes && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                      <Info className="w-3 h-3 inline mr-1" />{fields.processing_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Periodo */}
              {activeTab === 'periodo' && (
                <Section title="Periodo de liquidación" icon={Calendar}>
                  <div className="grid grid-cols-2 gap-2">
                    <ConfField label="Periodo (etiqueta)" value={per.label} conf={per.confidence} source={per.source} />
                    <ConfField label="Fecha inicio" value={per.start} conf={per.confidence} />
                    <ConfField label="Fecha fin" value={per.end} conf={per.confidence} />
                    <ConfField label="Mes" value={per.month} conf={per.confidence} />
                    <ConfField label="Año" value={per.year} conf={per.confidence} />
                    <ConfField label="Días trabajados" value={per.worked_days} conf={per.confidence} />
                    <ConfField label="Fecha de pago" value={per.payment_date} conf="media" />
                    <ConfField label="Fecha de emisión" value={per.issue_date} conf="media" />
                  </div>
                  {per.source && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                      <Info className="w-3 h-3 inline mr-1" />Periodo extraído de: <strong>{per.source}</strong>
                    </div>
                  )}
                </Section>
              )}

              {/* Tab: Devengos */}
              {activeTab === 'devengos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {(fields.devengos || []).length} conceptos · Total: {fmt(totals.total_accruals)}
                    </p>
                  </div>
                  <LineTable lines={fields.devengos || []} type="devengo" />
                </div>
              )}

              {/* Tab: Deducciones */}
              {activeTab === 'deducciones' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {(fields.deducciones || []).length} conceptos · Total: {fmt(totals.total_deductions)}
                  </p>
                  <LineTable lines={fields.deducciones || []} type="deduccion" />
                </div>
              )}

              {/* Tab: Bases y totales */}
              {activeTab === 'bases_totales' && (
                <div className="space-y-4">
                  <Section title="Totales" icon={Euro}>
                    <div className="space-y-2">
                      {[
                        { label: 'Total devengado', value: totals.total_accruals, bold: true },
                        { label: 'Total deducciones', value: totals.total_deductions },
                        { label: 'Líquido a percibir', value: totals.net_pay, bold: true, color: 'text-emerald-700' },
                        { label: '──────────────────', separator: true },
                        { label: 'IRPF (%)', value: totals.irpf_rate, pct: true },
                        { label: 'IRPF (importe)', value: totals.irpf_amount },
                        { label: 'SS trabajador', value: totals.employee_ss_amount },
                        { label: 'SS empresa', value: totals.employer_ss_amount },
                        { label: 'Anticipo', value: totals.advance_payment },
                        { label: '──────────────────', separator: true },
                        { label: 'Base cotización CC', value: totals.contribution_base_cc },
                        { label: 'Base cotización AT/EP', value: totals.contribution_base_at },
                        { label: 'Base IRPF', value: totals.irpf_base },
                      ].map((r, i) => r.separator ? (
                        <div key={i} className="border-t border-border" />
                      ) : (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className={cn('font-semibold', r.color, r.bold && 'text-base')}>{r.pct ? fmtPct(r.value) : fmt(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                  <Section title="Validaciones matemáticas" icon={CheckCircle2}>
                    <div className="space-y-1.5">
                      <MathBadge ok={mathVal.total_accruals_matches !== false} label="Total devengado = suma devengos" diff={mathVal.accruals_difference} />
                      <MathBadge ok={mathVal.total_deductions_matches !== false} label="Total deducciones = suma deducciones" />
                      <MathBadge ok={mathVal.net_pay_matches !== false} label="Líquido = devengado - deducciones" diff={mathVal.net_difference} />
                      <MathBadge ok={mathVal.irpf_matches !== false} label="IRPF importe ≈ base × tipo%" />
                      <MathBadge ok={mathVal.ss_matches !== false} label="SS trabajador = suma líneas SS" />
                    </div>
                  </Section>
                </div>
              )}

              {/* Tab: Asiento */}
              {activeTab === 'asiento' && (
                <LaborAccountingEntryPreview entry={accountingEntry} document={doc} onRefresh={loadData} />
              )}

              {/* Tab: Evidencias */}
              {activeTab === 'evidencias' && (
                <EvidencePanel fields={fields} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-taxea-red" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

function LineTable({ lines, type }) {
  if (!lines?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-xl">
      No se detectaron {type === 'devengo' ? 'devengos' : 'deducciones'}
    </div>
  );
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/50 border-b border-border">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Concepto</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">Tipo</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden lg:table-cell">Cuenta</th>
            {type === 'deduccion' && <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">%</th>}
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Importe</th>
            <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Conf.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((l, i) => {
            const conf = typeof l.confianza === 'number' ? l.confianza : 70;
            const confColor = conf >= 80 ? 'text-emerald-600' : conf >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2">
                  <p className="font-medium">{l.concepto_normalizado || l.descripcion_original || '—'}</p>
                  {l.descripcion_original && l.concepto_normalizado && l.descripcion_original !== l.concepto_normalizado && (
                    <p className="text-[10px] text-muted-foreground">{l.descripcion_original}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium',
                    l.tipo === 'salarial' || l.tipo === 'irpf' ? 'bg-blue-50 text-blue-700' :
                    l.tipo === 'no_salarial' ? 'bg-slate-100 text-slate-600' :
                    l.tipo?.startsWith('ss_') ? 'bg-purple-50 text-purple-700' :
                    'bg-orange-50 text-orange-700'
                  )}>{l.tipo || '—'}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono hidden lg:table-cell">{l.cuenta_sugerida || '—'}</td>
                {type === 'deduccion' && <td className="px-3 py-2 text-right text-muted-foreground hidden md:table-cell">{l.porcentaje ? fmtPct(l.porcentaje) : '—'}</td>}
                <td className="px-3 py-2 text-right font-semibold">
                  {typeof l.importe === 'number' ? l.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('font-semibold', confColor)}>{conf}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-secondary/30">
            <td colSpan={type === 'deduccion' ? 5 : 4} className="px-3 py-2 text-right text-xs font-bold text-muted-foreground">TOTAL</td>
            <td colSpan={2} className="px-3 py-2 text-right text-sm font-bold">
              {fmt(lines.reduce((s, l) => s + (l.importe || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EvidencePanel({ fields }) {
  const emp = fields.employee || {};
  const comp = fields.company || {};
  const per = fields.period || {};

  const evidences = [
    { campo: 'Nombre empleado', valor: emp.full_name, fuente: emp.name_source || 'employee_block', confianza: emp.name_confidence, validacion: 'Zona: bloque trabajador + etiqueta' },
    { campo: 'DNI/NIE trabajador', valor: emp.tax_id, fuente: emp.tax_id_source || 'employee_block', confianza: emp.tax_id_confidence, validacion: 'Patrón: 8 dígitos + letra / X+7d+letra' },
    { campo: 'NAF / NUSS', valor: emp.naf, fuente: emp.naf_source || 'employee_block', confianza: emp.naf_confidence, validacion: 'Patrón: ~12 dígitos, zona trabajador' },
    { campo: 'Razón social empresa', valor: comp.name, fuente: comp.name_source || 'company_block', confianza: comp.name_confidence, validacion: 'Zona: bloque empresa' },
    { campo: 'CIF/NIF empresa', valor: comp.tax_id, fuente: comp.tax_id_source || 'company_block', confianza: comp.tax_id_confidence, validacion: 'Patrón: letra + 7 dígitos + control, zona empresa' },
    { campo: 'CCC empresa', valor: comp.ccc, fuente: 'company_block', confianza: 'media', validacion: 'Código cuenta cotización, zona empresa' },
    { campo: 'Periodo liquidación', valor: per.label, fuente: per.source, confianza: per.confidence, validacion: 'Extraído de etiqueta laboral, no de fecha de pago/emisión' },
  ].filter(e => e.valor);

  if (!evidences.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No hay evidencias disponibles. Procesa el documento primero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Cada campo extraído con su fuente, zona del documento y validación aplicada.</p>
      {evidences.map((e, i) => (
        <div key={i} className={cn('border rounded-xl p-3', CONF_STYLES[e.confianza] || CONF_STYLES.media)}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-xs font-bold">{e.campo}</p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', CONF_BADGE[e.confianza] || CONF_BADGE.media)}>
              {e.confianza || 'media'}
            </span>
          </div>
          <p className="text-sm font-mono font-medium mb-1">{e.valor}</p>
          <div className="grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
            <span>📍 Zona: <strong>{e.fuente || '—'}</strong></span>
            <span>✓ Validación: {e.validacion}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfBadge({ value }) {
  if (!value) return null;
  const color = value >= 80 ? 'bg-emerald-100 text-emerald-700' : value >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', color)}>Confianza {value}%</span>;
}

function DocStatusBadge({ status }) {
  const map = {
    procesado_alta_confianza: 'bg-emerald-100 text-emerald-700',
    procesado_con_advertencias: 'bg-amber-100 text-amber-700',
    requiere_revision: 'bg-orange-100 text-orange-700',
    validado: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    procesando: 'bg-blue-100 text-blue-700',
  };
  const labels = {
    procesado_alta_confianza: 'Alta confianza', procesado_con_advertencias: 'Con advertencias',
    requiere_revision: 'Requiere revisión', validado: 'Validado', error: 'Error', procesando: 'Procesando',
  };
  if (!status) return null;
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', map[status] || 'bg-slate-100 text-slate-600')}>{labels[status] || status}</span>;
}