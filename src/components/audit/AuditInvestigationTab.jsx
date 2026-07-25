import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Search, ExternalLink, BookOpen, FileText, Gavel, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SOURCE_TYPE_LABELS = {
  normativa: { label: 'Normativa', icon: BookOpen, color: 'text-blue-600' },
  consulta_vinculante: { label: 'Consulta DGT', icon: FileText, color: 'text-indigo-600' },
  resolucion_teac: { label: 'Resolución TEAC', icon: Scale, color: 'text-purple-600' },
  jurisprudencia: { label: 'Jurisprudencia', icon: Gavel, color: 'text-rose-600' },
  doctrina_administrativa: { label: 'Doctrina', icon: FileText, color: 'text-amber-600' },
  manual_oficial: { label: 'Manual', icon: BookOpen, color: 'text-teal-600' },
  otra: { label: 'Otra', icon: FileText, color: 'text-slate-600' },
};

const AUTHORITY_LEVEL_BADGE = {
  oficial_primario: 'bg-green-50 text-green-700 border-green-200',
  oficial_secundario: 'bg-blue-50 text-blue-700 border-blue-200',
  contexto: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function AuditInvestigationTab({ caseId }) {
  const queryClient = useQueryClient();
  const [researching, setResearching] = useState(false);

  const { data: findings = [] } = useQuery({
    queryKey: ['auditFindings', caseId],
    queryFn: () => base44.entities.TaxeaAuditFinding.filter({ auditCaseId: caseId }),
  });

  const { data: legalSources = [], refetch: refetchSources } = useQuery({
    queryKey: ['auditLegalSources', caseId],
    queryFn: () => base44.entities.TaxeaAuditLegalSource.filter({ auditCaseId: caseId }),
  });

  const { data: researchQueries = [] } = useQuery({
    queryKey: ['auditResearchQueries', caseId],
    queryFn: () => base44.entities.TaxeaAuditResearchQuery.filter({ auditCaseId: caseId }),
  });

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await base44.functions.invoke('runLegalResearch', { auditCaseId: caseId });
      const data = res.data || res;
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Investigación completada: ${data.sourcesFound} fuentes encontradas`);
        queryClient.invalidateQueries({ queryKey: ['auditLegalSources', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditResearchQueries', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditFindings', caseId] });
        queryClient.invalidateQueries({ queryKey: ['auditCase', caseId] });
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setResearching(false);
  };

  const toggleDiscardSource = async (sourceId, currentDiscarded) => {
    try {
      await base44.entities.TaxeaAuditLegalSource.update(sourceId, { discarded: !currentDiscarded });
      refetchSources();
      toast.success(currentDiscarded ? 'Fuente recuperada' : 'Fuente descartada');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const materialFindings = findings.filter(f => !['ok', 'ok_parcial'].includes(f.verdict) && f.status !== 'descartado');

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-jakarta font-semibold text-foreground">Motor de Investigación Jurídica</h3>
            <p className="text-sm text-muted-foreground">
              {materialFindings.length} hallazgos materiales · {legalSources.filter(s => !s.discarded).length} fuentes encontradas · {researchQueries.length} consultas ejecutadas
            </p>
          </div>
          <Button onClick={handleResearch} disabled={researching || materialFindings.length === 0} className="bg-teal hover:bg-teal-dark h-9">
            {researching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
            {researching ? 'Investigando...' : 'Investigar fuentes'}
          </Button>
        </div>
      </div>

      {legalSources.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8 text-center">
          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Sin fuentes jurídicas. Ejecuta la investigación para buscar normativa, doctrina y jurisprudencia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {legalSources.map(src => {
            const typeInfo = SOURCE_TYPE_LABELS[src.sourceType] || SOURCE_TYPE_LABELS.otra;
            const TypeIcon = typeInfo.icon;
            return (
              <div key={src.id} className={`bg-card rounded-xl border border-border shadow-card p-4 ${src.discarded ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0`}>
                    <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-foreground text-sm">{src.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${AUTHORITY_LEVEL_BADGE[src.authorityLevel] || AUTHORITY_LEVEL_BADGE.contexto}`}>
                        {src.authorityLevel}
                      </span>
                      {src.discarded && <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">Descartada</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{src.authority} · {typeInfo.label}{src.publicationDate ? ` · ${src.publicationDate}` : ''}</p>
                    {src.articleOrReference && <p className="text-xs font-mono text-slate-600 mb-1">{src.articleOrReference}</p>}
                    {src.shortExcerpt && <p className="text-sm text-foreground italic border-l-2 border-slate-200 pl-2 mb-1">{src.shortExcerpt}</p>}
                    {src.summary && <p className="text-xs text-muted-foreground mb-1">{src.summary}</p>}
                    {src.relevance && <p className="text-xs text-teal"><strong>Relevancia:</strong> {src.relevance}</p>}
                    {src.validityWarning && <p className="text-xs text-amber-600 mt-1"><strong>Vigencia:</strong> {src.validityWarning}</p>}
                    {src.url && (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                        <ExternalLink className="w-3 h-3" /> Abrir fuente
                      </a>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleDiscardSource(src.id, src.discarded)} className="h-7 text-xs flex-shrink-0">
                    {src.discarded ? 'Recuperar' : 'Descartar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {researchQueries.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Log de consultas</h4>
          <div className="space-y-1">
            {researchQueries.map(q => (
              <div key={q.id} className="text-xs text-muted-foreground flex items-center gap-2 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${q.status === 'ejecutada' ? 'bg-green-500' : q.status === 'sin_resultados' ? 'bg-slate-300' : 'bg-amber-500'}`} />
                <span className="font-mono flex-1 truncate">{q.query}</span>
                <span className="text-[10px]">{q.resultsCount} resultados</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}