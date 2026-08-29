import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { History, FileCheck, FileText, Clock } from 'lucide-react';

const RUN_TYPE_LABELS = {
  inventario: 'Inventario',
  extraccion: 'Extracción',
  ocr: 'OCR',
  cruces: 'Cruces',
  riesgos: 'Patrones de riesgo',
  investigacion_juridica: 'Investigación jurídica',
  informe: 'Informe',
  email: 'Email',
};

const STATUS_COLORS = {
  en_progreso: 'bg-amber-50 text-amber-700',
  completado: 'bg-green-50 text-green-700',
  con_error: 'bg-red-50 text-red-700',
};

export default function AuditHistoryTab({ caseId }) {
  const { data: runLogs = [] } = useQuery({
    queryKey: ['auditRunLogs', caseId],
    queryFn: () => base44.entities.TaxeaAuditRunLog.filter({ auditCaseId: caseId }, '-started_at'),
    enabled: !!caseId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['auditReports', caseId],
    queryFn: () => base44.entities.TaxeaAuditReport.filter({ auditCaseId: caseId }, '-version'),
    enabled: !!caseId,
  });

  const { data: extractions = [] } = useQuery({
    queryKey: ['auditExtractions', caseId],
    queryFn: () => base44.entities.TaxeaAuditExtraction.filter({ auditCaseId: caseId }),
    enabled: !!caseId,
  });

  return (
    <div className="space-y-4">
      {/* Run logs */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">Log de ejecuciones</h3>
        </div>
        {runLogs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin ejecuciones registradas.</div>
        ) : (
          <div className="divide-y divide-border">
            {runLogs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'completado' ? 'bg-green-500' : log.status === 'con_error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{RUN_TYPE_LABELS[log.runType] || log.runType}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.startedAt).toLocaleString('es-ES')}
                    {log.triggeredBy ? ` · ${log.triggeredBy}` : ''}
                    {log.modelUsed ? ` · ${log.modelUsed}` : ''}
                  </p>
                  {log.notes && <p className="text-xs text-slate-500 mt-0.5">{log.notes}</p>}
                  {log.errorMessage && <p className="text-xs text-red-600 mt-0.5">{log.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  {log.filesProcessed > 0 && <span>{log.filesProcessed} archivos</span>}
                  {log.findingsCreated > 0 && <span>{log.findingsCreated} hallazgos</span>}
                  {log.sourcesFound > 0 && <span>{log.sourcesFound} fuentes</span>}
                  <span className={`px-2 py-0.5 rounded font-medium ${STATUS_COLORS[log.status] || STATUS_COLORS.en_progreso}`}>{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report versions */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-slate-500" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">Versiones de informe</h3>
        </div>
        {reports.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin informes generados.</div>
        ) : (
          <div className="divide-y divide-border">
            {reports.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">v{r.version} · {r.reportType}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_date).toLocaleString('es-ES')}
                    {r.generatedBy ? ` · ${r.generatedBy}` : ''}
                    {r.approvedByAdmin ? ` · Aprobado por ${r.approvedByAdmin}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.status === 'aprobado' ? 'bg-green-50 text-green-700' : r.status === 'obsoleto' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extractions */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">Extracciones documentales ({extractions.length})</h3>
        </div>
        {extractions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin extracciones. Ejecuta el análisis primero.</div>
        ) : (
          <div className="divide-y divide-border">
            {extractions.map(ext => (
              <div key={ext.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-sm font-medium text-foreground truncate">{ext.fileName}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    ext.reliability === 'fiable' ? 'bg-green-50 text-green-700' :
                    ext.reliability === 'ocr_dudoso' ? 'bg-orange-50 text-orange-700' :
                    ext.reliability === 'no_verificable' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>{ext.reliability}</span>
                </div>
                {ext.extractedData && ext.extractedData.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ext.extractedData.slice(0, 5).map((d, i) => (
                      <span key={i} className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded font-mono">{d}</span>
                    ))}
                    {ext.extractedData.length > 5 && <span className="text-[10px] text-muted-foreground">+{ext.extractedData.length - 5} más</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}