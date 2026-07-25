import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, FileText, Shield, Loader2, Upload, Play, FileCheck,
  AlertTriangle, Download, Mail, RefreshCw, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import AuditInvestigationTab from '@/components/audit/AuditInvestigationTab';
import AuditHistoryTab from '@/components/audit/AuditHistoryTab';
import AuditEmailTab from '@/components/audit/AuditEmailTab';

const VERDICT_LABELS = {
  ok: { label: 'OK', color: 'bg-green-50 text-green-700 border-green-200' },
  ok_parcial: { label: 'OK Parcial', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  error: { label: 'ERROR', color: 'bg-red-50 text-red-700 border-red-200' },
  diferencia: { label: 'DIFERENCIA', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  no_verificable: { label: 'NO VERIFICABLE', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  falta_doc: { label: 'FALTA DOC', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  criterio: { label: 'CRITERIO', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  aviso: { label: 'AVISO', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  opcion: { label: 'OPCIÓN', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  riesgo: { label: 'RIESGO', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  bloquea: { label: 'BLOQUEA', color: 'bg-red-100 text-red-800 border-red-300' },
};

const PRIORITY_LABELS = {
  bloquea: { label: 'BLOQUEA', color: 'bg-red-600 text-white' },
  alta: { label: 'ALTA', color: 'bg-orange-500 text-white' },
  media: { label: 'MEDIA', color: 'bg-amber-400 text-amber-900' },
  baja: { label: 'BAJA', color: 'bg-slate-300 text-slate-700' },
  posterior: { label: 'POSTERIOR', color: 'bg-blue-300 text-blue-800' },
  ccaa: { label: 'CCAA', color: 'bg-indigo-300 text-indigo-800' },
  menor: { label: 'MENOR', color: 'bg-slate-200 text-slate-600' },
};

const FILE_STATUS_COLORS = {
  subido: 'bg-blue-50 text-blue-700',
  procesando: 'bg-amber-50 text-amber-700',
  ocr_pendiente: 'bg-orange-50 text-orange-700',
  ocr_procesado: 'bg-teal-50 text-teal-700',
  extraido: 'bg-indigo-50 text-indigo-700',
  clasificado: 'bg-green-50 text-green-700',
  con_error: 'bg-red-50 text-red-700',
  duplicado_posible: 'bg-purple-50 text-purple-700',
  requiere_revision_manual: 'bg-yellow-50 text-yellow-700',
  excluido_admin: 'bg-slate-100 text-slate-500',
};

export default function AuditCaseDetail({ caseId, onBack }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportType, setReportType] = useState('informe_completo');
  const [expandedFindings, setExpandedFindings] = useState({});

  const { data: auditCase, isLoading } = useQuery({
    queryKey: ['auditCase', caseId],
    queryFn: () => base44.entities.TaxeaAuditCase.get(caseId),
    enabled: !!caseId,
  });

  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ['auditFiles', caseId],
    queryFn: () => base44.entities.TaxeaAuditFile.filter({ auditCaseId: caseId }),
    enabled: !!caseId,
  });

  const { data: findings = [] } = useQuery({
    queryKey: ['auditFindings', caseId],
    queryFn: () => base44.entities.TaxeaAuditFinding.filter({ auditCaseId: caseId }),
    enabled: !!caseId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['auditReports', caseId],
    queryFn: () => base44.entities.TaxeaAuditReport.filter({ auditCaseId: caseId }, '-version'),
    enabled: !!caseId,
  });

  const handleUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    if (fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of fileList) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const ext = file.name.split('.').pop().toLowerCase();
        const mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', xlsx: 'application/vnd.openxmlformats', xls: 'application/vnd.ms-excel', csv: 'text/csv', docx: 'application/vnd.openxmlformats', txt: 'text/plain', xml: 'application/xml', zip: 'application/zip' };
        await base44.entities.TaxeaAuditFile.create({
          auditCaseId: caseId,
          originalName: file.name,
          storagePath: file_url,
          mimeType: mimeMap[ext] || file.type || 'application/octet-stream',
          extension: ext,
          size: file.size,
          uploadStatus: 'subido',
          requiresOcr: ['jpg', 'jpeg', 'png'].includes(ext),
          hasTextLayer: ext === 'pdf'
        });
      }
      toast.success(`${fileList.length} archivo(s) subido(s)`);
      await base44.entities.TaxeaAuditCase.update(caseId, { status: 'documentos_subidos' });
      refetchFiles();
      queryClient.invalidateQueries({ queryKey: ['auditCase', caseId] });
    } catch (err) {
      toast.error('Error subiendo archivos: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke('runAuditAnalysis', { auditCaseId: caseId });
      const data = res.data || res;
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Análisis completado: ${data.findingsCreated} hallazgos, riesgo ${data.riskLevel}`);
        queryClient.invalidateQueries({ queryKey: ['auditCase', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditFiles', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditFindings', caseId] });
      }
    } catch (err) {
      toast.error('Error en análisis: ' + err.message);
    }
    setAnalyzing(false);
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await base44.functions.invoke('generateAuditReport', { auditCaseId: caseId, reportType });
      const data = res.data || res;
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Informe v${data.version} generado`);
        queryClient.invalidateQueries({ queryKey: ['auditReports', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditCase', caseId] });
      }
    } catch (err) {
      toast.error('Error generando informe: ' + err.message);
    }
    setGeneratingReport(false);
  };

  const updateFindingStatus = async (findingId, newStatus) => {
    try {
      await base44.entities.TaxeaAuditFinding.update(findingId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['auditFindings', caseId] });
      toast.success('Hallazgo actualizado');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const downloadReport = (report) => {
    const blob = new Blob([report.markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !auditCase) {
    return <div className="p-12 text-center"><Loader2 className="w-6 h-6 text-teal animate-spin mx-auto" /></div>;
  }

  const bloqueos = findings.filter(f => f.priority === 'bloquea' || f.verdict === 'bloquea').length;
  const errores = findings.filter(f => f.verdict === 'error').length;
  const riesgos = findings.filter(f => f.verdict === 'riesgo').length;
  const noVerif = findings.filter(f => ['no_verificable', 'falta_doc'].includes(f.verdict)).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-jakarta font-bold text-foreground truncate">{auditCase.title}</h1>
          <p className="text-sm text-muted-foreground">
            {auditCase.clientName || 'Sin cliente'} · {auditCase.clientNif || 'N/A'} · Ej. {auditCase.taxYear}
          </p>
        </div>
        <Badge variant="outline" className={`capitalize ${auditCase.riskLevel === 'critico' ? 'border-red-300 text-red-700' : auditCase.riskLevel === 'alto' ? 'border-orange-300 text-orange-700' : ''}`}>
          Riesgo: {auditCase.riskLevel}
        </Badge>
      </div>

      {/* Tarjetas iniciales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className={`rounded-xl border p-3 ${auditCase.recommendation === 'no_presentar' ? 'bg-red-50 border-red-200' : auditCase.recommendation === 'parar_24_48h' ? 'bg-orange-50 border-orange-200' : auditCase.recommendation === 'pendiente_documentacion' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recomendación</p>
          <p className="text-sm font-bold mt-0.5">
            {auditCase.recommendation === 'ok_continuar' ? 'OK para continuar' :
             auditCase.recommendation === 'revisar_antes_cerrar' ? 'Revisar antes de cerrar' :
             auditCase.recommendation === 'parar_24_48h' ? 'Parar 24-48h' :
             auditCase.recommendation === 'no_presentar' ? 'No presentar' :
             auditCase.recommendation === 'pendiente_documentacion' ? 'Pendiente documentación' :
             'Solo borrador'}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Impacto estimado</p>
          <p className="text-xs font-medium mt-0.5 text-foreground">{auditCase.impactEstimated || 'Sin cuantificar'}</p>
        </div>
        <div className={`rounded-xl border p-3 ${auditCase.riskLevel === 'critico' ? 'bg-red-50 border-red-200' : auditCase.riskLevel === 'alto' ? 'bg-orange-50 border-orange-200' : auditCase.riskLevel === 'medio' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Riesgo</p>
          <p className="text-sm font-bold mt-0.5 capitalize">{auditCase.riskLevel}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estado</p>
          <p className="text-sm font-bold mt-0.5 capitalize">{auditCase.status.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Documentos</p>
          <p className="text-xl font-bold text-foreground">{files.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hallazgos</p>
          <p className="text-xl font-bold text-foreground">{findings.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-[10px] text-red-600 uppercase tracking-wide">Bloqueos</p>
          <p className="text-xl font-bold text-red-700">{bloqueos}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-[10px] text-orange-600 uppercase tracking-wide">Errores/Riesgos</p>
          <p className="text-xl font-bold text-orange-700">{errores + riesgos}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">No verificable</p>
          <p className="text-xl font-bold text-slate-600">{noVerif}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="cursor-pointer">
          <input type="file" multiple className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.docx,.txt,.xml,.zip" />
          <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Subir documentos
          </span>
        </label>
        <Button onClick={handleAnalyze} disabled={analyzing || files.length === 0} className="bg-teal hover:bg-teal-dark h-9">
          {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          {analyzing ? 'Analizando...' : 'Ejecutar análisis'}
        </Button>
        <div className="flex items-center gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="informe_completo">Informe completo</SelectItem>
              <SelectItem value="resumen_ejecutivo">Resumen ejecutivo</SelectItem>
              <SelectItem value="solo_bloqueos">Solo bloqueos</SelectItem>
              <SelectItem value="informe_gestoria">Informe para gestoría</SelectItem>
              <SelectItem value="informe_cliente">Informe para cliente</SelectItem>
              <SelectItem value="anexo_juridico">Anexo jurídico</SelectItem>
              <SelectItem value="inventario_documental">Inventario documental</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateReport} disabled={generatingReport || findings.length === 0} variant="outline" className="h-9">
            {generatingReport ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileCheck className="w-4 h-4 mr-1.5" />}
            Generar informe
          </Button>
        </div>
      </div>

      {auditCase.summaryMarkdown && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Resumen ejecutivo del análisis
          </p>
          <div className="prose prose-sm max-w-none text-amber-900">
            <ReactMarkdown>{auditCase.summaryMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}

      <Tabs defaultValue="documentos" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="documentos">Documentos ({files.length})</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos ({findings.length})</TabsTrigger>
          <TabsTrigger value="investigacion">Investigación</TabsTrigger>
          <TabsTrigger value="informe">Informe ({reports.length})</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* Documentos */}
        <TabsContent value="documentos" className="mt-4">
          <div className="bg-card rounded-xl border border-border shadow-card">
            {files.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Sin documentos. Sube archivos para comenzar el análisis.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {files.map((f, i) => (
                  <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-6">{i + 1}.</span>
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.originalName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {f.documentType || 'Sin clasificar'} · {f.whatItAccredits || 'Sin acreditar'}
                        {f.pageCount ? ` · ${f.pageCount} pág.` : ''}
                        {f.requiresOcr ? ' · Requiere OCR' : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${FILE_STATUS_COLORS[f.uploadStatus] || 'bg-slate-100 text-slate-600'}`}>
                      {f.uploadStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Hallazgos */}
        <TabsContent value="hallazgos" className="mt-4">
          {findings.length === 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-8 text-center">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Sin hallazgos. Ejecuta el análisis para detectarlos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map(f => {
                const verdict = VERDICT_LABELS[f.verdict] || VERDICT_LABELS.no_verificable;
                const priority = PRIORITY_LABELS[f.priority] || PRIORITY_LABELS.media;
                const isExpanded = expandedFindings[f.id];
                return (
                  <div key={f.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                    <div className="px-4 py-3 cursor-pointer" onClick={() => setExpandedFindings(s => ({ ...s, [f.id]: !s[f.id] }))}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-slate-500">{f.findingCode}</span>
                        <span className="text-sm font-medium text-foreground flex-1">{f.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${verdict.color}`}>{verdict.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${priority.color}`}>{priority.label}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-border bg-slate-50/50">
                        {f.documentClaim && <div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Documento afirma</p><p className="text-sm">{f.documentClaim}</p></div>}
                        {f.verification && <div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Verificado</p><p className="text-sm">{f.verification}</p></div>}
                        {f.exactEvidence && <div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Evidencia exacta</p><p className="text-sm font-mono bg-amber-50 border border-amber-100 rounded p-2">{f.exactEvidence}</p></div>}
                        {f.economicEffect && <div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Efecto económico</p><p className="text-sm">{f.economicEffect}</p></div>}
                        {f.actionRecommended && <div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Acción recomendada</p><p className="text-sm">{f.actionRecommended}</p></div>}
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Estado:</span>
                          <Select value={f.status} onValueChange={(v) => updateFindingStatus(f.id, v)}>
                            <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="detectado">Detectado</SelectItem>
                              <SelectItem value="en_revision">En revisión</SelectItem>
                              <SelectItem value="aceptado">Aceptado</SelectItem>
                              <SelectItem value="descartado">Descartado</SelectItem>
                              <SelectItem value="excluido_informe">Excluido informe</SelectItem>
                              <SelectItem value="resuelto">Resuelto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Investigación jurídica */}
        <TabsContent value="investigacion" className="mt-4">
          <AuditInvestigationTab caseId={caseId} />
        </TabsContent>

        {/* Informe */}
        <TabsContent value="informe" className="mt-4">
          {reports.length === 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-8 text-center">
              <FileCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Sin informes generados. Ejecuta el análisis primero y luego genera el informe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map(r => (
                <div key={r.id} className="bg-card rounded-xl border border-border shadow-card">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">v{r.version} · {r.reportType} · {r.generatedBy}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadReport(r)} className="h-8">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Markdown
                    </Button>
                  </div>
                  <div className="p-4 prose prose-sm max-w-none">
                    <ReactMarkdown>{r.markdownContent}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        {/* Email */}
        <TabsContent value="email" className="mt-4">
          <AuditEmailTab caseId={caseId} />
        </TabsContent>

        {/* Historial */}
        <TabsContent value="historial" className="mt-4">
          <AuditHistoryTab caseId={caseId} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Borrador pendiente de revisión profesional. No sustituye asesoramiento fiscal, contable ni jurídico. Basado exclusivamente en la documentación aportada.
        </p>
      </div>
    </div>
  );
}