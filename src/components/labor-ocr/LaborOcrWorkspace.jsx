import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { useAuth } from '@/lib/AuthContext';
import {
  ScanText, Upload, FileText, Users, ShieldCheck, AlertTriangle,
  ChevronRight, Plus, History, Settings, X, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LaborOcrBatchProcessor from './LaborOcrBatchProcessor';
import PayrollOcrReviewWorkspace from './PayrollOcrReviewWorkspace';
import LaborAccountingRulesPanel from './LaborAccountingRulesPanel';

const MODES = [
  { id: 'nominas', label: 'Nóminas', icon: FileText, desc: 'Procesa nóminas laborales con extracción de devengos, deducciones y propuesta contable.', color: 'border-taxea-red bg-red-50 text-taxea-red' },
  { id: 'seguros_sociales', label: 'Seguros Sociales', icon: ShieldCheck, desc: 'Analiza documentos RLC/RNT/TC con bases, cuotas y propuesta de asiento 476.', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { id: 'mixta', label: 'Carga Mixta', icon: ScanText, desc: 'El sistema clasifica documento a documento. Ideal para lotes combinados.', color: 'border-blue-500 bg-blue-50 text-blue-700' },
];

export default function LaborOcrWorkspace({ company, user }) {
  const [view, setView] = useState('home'); // home | batch | review | rules
  const [mode, setMode] = useState('nominas');
  const [period, setPeriod] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (company?.id) loadBatches();
  }, [company?.id]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    const data = await base44.entities.LaborOcrBatch.filter({ company_id: company.id }, '-created_date', 20);
    setBatches(data);
    setLoadingBatches(false);
  };

  const handleFiles = (newFiles) => {
    const arr = Array.from(newFiles).slice(0, 200 - files.length);
    setFiles(prev => [...prev, ...arr].slice(0, 200));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleStartBatch = async () => {
    if (!files.length || !company?.id) return;
    setProcessing(true);
    const batch = await base44.entities.LaborOcrBatch.create({
      company_id: company.id,
      mode,
      period: period || null,
      status: 'procesando',
      total_documents: files.length,
      created_by: user?.email,
    });

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const doc = await base44.entities.LaborOcrDocument.create({
        batch_id: batch.id,
        company_id: company.id,
        original_file_name: file.name,
        file_url,
        document_type: mode === 'nominas' ? 'nomina' : mode === 'seguros_sociales' ? 'seguro_social' : 'desconocido',
        ocr_status: 'procesando',
      });
      processDocumentOcr(doc, file_url, mode, batch.id, company);
    }

    setFiles([]);
    setSelectedBatch(batch);
    setView('batch');
    setProcessing(false);
    loadBatches();
  };

  const processDocumentOcr = async (doc, fileUrl, batchMode, batchId, company) => {
    try {
    const docType = batchMode === 'nominas' ? 'nómina' : batchMode === 'seguros_sociales' ? 'documento de seguros sociales (RLC/RNT/TC)' : 'documento laboral (nómina o seguros sociales)';
    const prompt = `Eres un sistema OCR especializado en documentos laborales españoles. Analiza este ${docType} y extrae TODOS los datos disponibles.

Devuelve un JSON con esta estructura exacta:
{
  "document_type": "nomina" | "seguro_social" | "desconocido",
  "confidence": número 0-100,
  "employee_name": string o null,
  "employee_tax_id": string o null,
  "social_security_number": string o null,
  "company_name": string o null,
  "company_tax_id": string o null,
  "period_label": string (ej: "Enero 2024") o null,
  "worked_days": número o null,
  "gross_salary": número o null,
  "total_accruals": número o null,
  "total_deductions": número o null,
  "net_pay": número o null,
  "irpf_rate": número o null,
  "irpf_amount": número o null,
  "employee_ss_amount": número o null,
  "employer_ss_amount": número o null,
  "contribution_base_common": número o null,
  "devengos": [{"descripcion": string, "importe": número, "tipo": string, "cuenta_sugerida": string, "confianza": número}],
  "deducciones": [{"descripcion": string, "importe": número, "porcentaje": número o null, "tipo": string, "cuenta_sugerida": string, "confianza": número}],
  "total_to_pay": número o null,
  "settlement_period": string o null,
  "contribution_account_code": string o null,
  "warnings": [string],
  "is_duplicate_risk": false,
  "document_quality": "alta" | "media" | "baja"
}

Para nóminas, las cuentas contables estándar son:
- Devengos salariales: cuenta 640
- SS empresa: cuenta 642
- IRPF: cuenta 4751
- SS trabajador acreedora: cuenta 476
- Líquido a percibir: cuenta 465

Sé preciso. Si un campo no aparece, devuelve null. No inventes datos.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string' },
          confidence: { type: 'number' },
          employee_name: {},
          employee_tax_id: {},
          social_security_number: {},
          company_name: {},
          company_tax_id: {},
          period_label: {},
          worked_days: {},
          gross_salary: {},
          total_accruals: {},
          total_deductions: {},
          net_pay: {},
          irpf_rate: {},
          irpf_amount: {},
          employee_ss_amount: {},
          employer_ss_amount: {},
          contribution_base_common: {},
          devengos: { type: 'array', items: { type: 'object' } },
          deducciones: { type: 'array', items: { type: 'object' } },
          total_to_pay: {},
          settlement_period: {},
          contribution_account_code: {},
          warnings: { type: 'array', items: { type: 'string' } },
          is_duplicate_risk: { type: 'boolean' },
          document_quality: { type: 'string' },
        }
      }
    });

    const conf = result?.confidence || 0;
    const hasWarnings = (result?.warnings || []).length > 0;
    const status = conf >= 80 ? 'procesado_alta_confianza' : conf >= 50 ? 'procesado_con_advertencias' : 'requiere_revision';

    await base44.entities.LaborOcrDocument.update(doc.id, {
      document_type: result?.document_type || doc.document_type,
      employee_name: result?.employee_name || null,
      period_label: result?.period_label || null,
      ocr_status: status,
      confidence_global: conf,
      extracted_fields: result,
      validation_status: 'pendiente',
    });

    if (result?.document_type === 'nomina' || doc.document_type === 'nomina') {
      await base44.entities.PayrollExtraction.create({
        labor_ocr_document_id: doc.id,
        company_id: company.id,
        employee_name: result?.employee_name,
        employee_tax_id: result?.employee_tax_id,
        social_security_number: result?.social_security_number,
        company_name: result?.company_name || company.razon_social,
        company_tax_id: result?.company_tax_id || company.nif_cif,
        period_label: result?.period_label,
        worked_days: result?.worked_days,
        gross_salary: result?.gross_salary,
        total_accruals: result?.total_accruals,
        total_deductions: result?.total_deductions,
        net_pay: result?.net_pay,
        irpf_rate: result?.irpf_rate,
        irpf_amount: result?.irpf_amount,
        employee_ss_amount: result?.employee_ss_amount,
        employer_ss_amount: result?.employer_ss_amount,
        contribution_base_common: result?.contribution_base_common,
        devengos: result?.devengos || [],
        deducciones: result?.deducciones || [],
        validation_warnings: result?.warnings || [],
        confidence_global: conf,
      });

      const netPay = result?.net_pay || 0;
      const irpf = result?.irpf_amount || 0;
      const ssWorker = result?.employee_ss_amount || 0;
      const grossSalary = result?.total_accruals || result?.gross_salary || 0;
      const debitTotal = grossSalary;
      const creditTotal = irpf + ssWorker + netPay;
      const balanced = Math.abs(debitTotal - creditTotal) < 0.1;

      await base44.entities.LaborAccountingEntryProposal.create({
        labor_ocr_document_id: doc.id,
        batch_id: batchId,
        company_id: company.id,
        document_type: 'nomina',
        employee_name: result?.employee_name,
        period: result?.period_label,
        status: 'propuesto',
        lines: [
          { cuenta: '640', descripcion: 'Sueldos y salarios', debe: grossSalary, haber: 0, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 640' },
          { cuenta: '4751', descripcion: 'HP Acreedora IRPF', debe: 0, haber: irpf, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 4751' },
          { cuenta: '476', descripcion: 'SS Organismos Acreedores', debe: 0, haber: ssWorker, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 476' },
          { cuenta: '465', descripcion: 'Remuneraciones Pendientes de Pago', debe: 0, haber: netPay, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 465' },
        ],
        debit_total: debitTotal,
        credit_total: creditTotal,
        balanced,
        warnings: !balanced ? ['El asiento no cuadra. Revisa los importes.'] : [],
      });
      }
      } catch (err) {
      console.error('OCR error for doc', doc.id, err);
      await base44.entities.LaborOcrDocument.update(doc.id, {
        ocr_status: 'error',
        notes: err?.message || 'Error desconocido durante el análisis OCR',
      });
      }
      };

  if (view === 'batch' && selectedBatch) {
    return (
      <LaborOcrBatchProcessor
        batch={selectedBatch}
        company={company}
        onBack={() => { setView('home'); setSelectedBatch(null); loadBatches(); }}
        onReviewDoc={(doc) => { setSelectedDocument(doc); setView('review'); }}
      />
    );
  }

  if (view === 'review' && selectedDocument) {
    return (
      <PayrollOcrReviewWorkspace
        document={selectedDocument}
        company={company}
        user={user}
        onBack={() => { setView('batch'); setSelectedDocument(null); }}
        onRefresh={() => {}}
      />
    );
  }

  if (view === 'rules') {
    return (
      <LaborAccountingRulesPanel
        company={company}
        onBack={() => setView('home')}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-taxea-red/10 flex items-center justify-center">
            <ScanText className="w-5 h-5 text-taxea-red" />
          </div>
          <div>
            <h1 className="font-jakarta font-bold text-foreground text-lg">OCR Laboral</h1>
            <p className="text-xs text-muted-foreground">Nóminas y seguros sociales con propuesta contable</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('rules')}>
            <Settings className="w-3.5 h-3.5" /> Reglas contables
          </Button>
          {batches.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSelectedBatch(batches[0]); setView('batch'); }}>
              <History className="w-3.5 h-3.5" /> Lotes anteriores
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Mode selector */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Tipo de procesamiento</p>
          <div className="grid grid-cols-3 gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'text-left p-4 rounded-xl border-2 transition-all',
                  mode === m.id ? m.color : 'border-border bg-card hover:bg-secondary/50 text-foreground'
                )}
              >
                <m.icon className="w-5 h-5 mb-2" />
                <p className="font-semibold text-sm">{m.label}</p>
                <p className="text-xs mt-1 opacity-70 leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Period */}
        <div className="flex items-center gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Periodo del lote (opcional)</label>
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Upload zone */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Zona de carga</p>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
              dragging ? 'border-taxea-red bg-taxea-red/5' : 'border-border hover:border-taxea-red/50 hover:bg-secondary/30'
            )}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold text-foreground">Arrastra o selecciona documentos</p>
            <p className="text-sm text-muted-foreground mt-1">PDF digital, escaneado o imagen JPG/PNG · Máx. 200 documentos por lote</p>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="bg-secondary px-2 py-0.5 rounded">PDF</span>
              <span className="bg-secondary px-2 py-0.5 rounded">JPG</span>
              <span className="bg-secondary px-2 py-0.5 rounded">PNG</span>
              <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Documentación sensible — acceso restringido
              </span>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">{files.length} documento{files.length !== 1 ? 's' : ''} listos para procesar</p>
              <Button variant="ghost" size="sm" onClick={() => setFiles([])}>Limpiar</Button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/30">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border bg-secondary/20">
              <Button onClick={handleStartBatch} disabled={processing} className="bg-taxea-red hover:bg-taxea-red/90 gap-2">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                {processing ? 'Iniciando procesamiento...' : `Procesar ${files.length} documento${files.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}

        {/* Recent batches */}
        {batches.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Lotes recientes</p>
            <div className="space-y-2">
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBatch(b); setView('batch'); }}
                  className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:bg-secondary/30 transition-all flex items-center gap-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <ScanText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{b.mode === 'nominas' ? 'Nóminas' : b.mode === 'seguros_sociales' ? 'Seguros Sociales' : 'Carga Mixta'} · {b.period || 'Sin periodo'}</p>
                    <p className="text-xs text-muted-foreground">{b.total_documents || 0} docs · {new Date(b.created_date).toLocaleDateString('es-ES')}</p>
                  </div>
                  <BatchStatusBadge status={b.status} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchStatusBadge({ status }) {
  const map = {
    creado: 'bg-slate-100 text-slate-600',
    procesando: 'bg-blue-100 text-blue-700',
    completado: 'bg-emerald-100 text-emerald-700',
    con_incidencias: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };
  const labels = { creado: 'Creado', procesando: 'Procesando', completado: 'Completado', con_incidencias: 'Con incidencias', error: 'Error' };
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', map[status] || map.creado)}>{labels[status] || status}</span>;
}