import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Acceso no autorizado.' }, { status: 403 });
    }

    const body = await req.json();
    const { auditCaseId, findingIds } = body;
    if (!auditCaseId) return Response.json({ error: 'auditCaseId requerido' }, { status: 400 });

    const auditCase = await base44.asServiceRole.entities.TaxeaAuditCase.get(auditCaseId);
    if (!auditCase) return Response.json({ error: 'Expediente no encontrado' }, { status: 404 });

    // Get findings to investigate (all or specific ones)
    let findingsToInvestigate = [];
    if (findingIds && findingIds.length > 0) {
      for (const fid of findingIds) {
        const f = await base44.asServiceRole.entities.TaxeaAuditFinding.get(fid);
        if (f) findingsToInvestigate.push(f);
      }
    } else {
      findingsToInvestigate = await base44.asServiceRole.entities.TaxeaAuditFinding.filter({ auditCaseId });
    }

    // Only investigate material findings (exclude OK, ok_parcial)
    const materialFindings = findingsToInvestigate.filter(f =>
      !['ok', 'ok_parcial'].includes(f.verdict) && f.status !== 'descartado' && f.status !== 'excluido_informe'
    );

    if (materialFindings.length === 0) {
      return Response.json({ success: true, message: 'No hay hallazgos materiales que requieran investigación jurídica.' });
    }

    // Create run log
    const runLog = await base44.asServiceRole.entities.TaxeaAuditRunLog.create({
      auditCaseId,
      runType: 'investigacion_juridica',
      startedAt: new Date().toISOString(),
      status: 'en_progreso',
      triggeredBy: user.email,
      modelUsed: 'gemini_3_flash'
    });

    await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
      status: 'investigacion_pendiente'
    });

    let sourcesFound = 0;
    let queriesCreated = 0;

    for (const finding of materialFindings) {
      // Generate research queries for this finding
      const queryPrompt = `Eres un investigador jurídico fiscal experto en normativa española y canaria.
Para el siguiente hallazgo de auditoría, genera 2-3 consultas de búsqueda web precisas para encontrar fuentes oficiales.

Hallazgo: ${finding.title}
Área: ${finding.area}
Veredicto: ${finding.verdict}
Evidencia: ${finding.exactEvidence}
Acción recomendada: ${finding.actionRecommended}

Tipo de auditoría: ${auditCase.auditType}
Jurisdicción: ${auditCase.jurisdiction}
Ejercicio: ${auditCase.taxYear}

Las consultas deben priorizar fuentes oficiales: BOE, AEAT, DGT (consultas vinculantes), TEAC, CENDOJ (jurisprudencia), ATC/BOC para Canarias.
Genera consultas específicas y técnicas.

Responde en JSON: { "queries": ["consulta1", "consulta2", "consulta3"] }`;

      const queryResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: queryPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            queries: { type: "array", items: { type: "string" } }
          }
        },
        model: "gpt_5_mini"
      });

      const queries = queryResponse.queries || [];
      queriesCreated += queries.length;

      for (const queryText of queries) {
        // Create research query record
        const researchQuery = await base44.asServiceRole.entities.TaxeaAuditResearchQuery.create({
          auditCaseId,
          findingId: finding.id,
          query: queryText,
          searchDate: new Date().toISOString(),
          status: 'pendiente'
        });

        // Execute web search using InvokeLLM with internet context
        const searchPrompt = `Busca información sobre: "${queryText}"

Contexto: hallazgo de auditoría "${finding.title}" en expediente ${auditCase.title} (jurisdicción: ${auditCase.jurisdiction}).

Devuelve las fuentes oficiales más relevantes encontradas (máximo 3).

Responde en JSON con esta estructura:
{
  "sources": [
    {
      "title": "título de la fuente",
      "authority": "organismo (BOE, AEAT, DGT, TEAC, Tribunal Supremo, ATC, etc.)",
      "sourceType": "normativa|consulta_vinculante|resolucion_teac|jurisprudencia|doctrina_administrativa|manual_oficial|otra",
      "url": "URL verificable",
      "publicationDate": "fecha si existe",
      "articleOrReference": "artículo, consulta o referencia concreta",
      "shortExcerpt": "fragmento corto relevante",
      "summary": "resumen propio",
      "relevance": "por qué es relevante para el hallazgo",
      "authorityLevel": "oficial_primario|oficial_secundario|contexto",
      "validityWarning": "advertencia sobre vigencia si procede"
    }
  ]
}

Reglas:
- Solo incluir fuentes reales encontradas con URL verificable.
- Si no se encuentra fuente oficial suficiente, devolver array vacío.
- No inventar sentencias, consultas ni artículos.
- Marcar "validityWarning" si la norma puede estar desactualizada.`;

        const searchResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: searchPrompt,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    authority: { type: "string" },
                    sourceType: { type: "string" },
                    url: { type: "string" },
                    publicationDate: { type: "string" },
                    articleOrReference: { type: "string" },
                    shortExcerpt: { type: "string" },
                    summary: { type: "string" },
                    relevance: { type: "string" },
                    authorityLevel: { type: "string" },
                    validityWarning: { type: "string" }
                  }
                }
              }
            }
          },
          model: "gemini_3_flash"
        });

        const sources = searchResponse.sources || [];
        const sourceIds = [];

        for (const src of sources) {
          if (!src.url || src.url === '') continue;
          const legalSource = await base44.asServiceRole.entities.TaxeaAuditLegalSource.create({
            auditCaseId,
            findingId: finding.id,
            title: src.title || 'Sin título',
            authority: src.authority || 'Desconocido',
            sourceType: src.sourceType || 'otra',
            url: src.url,
            publicationDate: src.publicationDate || '',
            consultedAt: new Date().toISOString(),
            articleOrReference: src.articleOrReference || '',
            shortExcerpt: src.shortExcerpt || '',
            summary: src.summary || '',
            relevance: src.relevance || '',
            authorityLevel: src.authorityLevel || 'oficial_primario',
            validityWarning: src.validityWarning || ''
          });
          sourceIds.push(legalSource.id);
          sourcesFound++;
        }

        // Update research query
        await base44.asServiceRole.entities.TaxeaAuditResearchQuery.update(researchQuery.id, {
          status: sources.length > 0 ? 'ejecutada' : 'sin_resultados',
          resultsCount: sources.length,
          sourceIds
        });
      }

      // Update finding with legal basis summary from sources
      const findingSources = await base44.asServiceRole.entities.TaxeaAuditLegalSource.filter({ findingId: finding.id });
      if (findingSources.length > 0) {
        const legalSummary = findingSources.map(s =>
          `${s.authority} - ${s.articleOrReference}: ${s.shortExcerpt || s.summary || ''} (${s.url})`
        ).join('\n');
        await base44.asServiceRole.entities.TaxeaAuditFinding.update(finding.id, {
          legalBasisSummary: legalSummary,
          legalSourceIds: findingSources.map(s => s.id)
        });
      }
    }

    // Update case status
    await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
      status: 'investigacion_completada'
    });

    // Update run log
    await base44.asServiceRole.entities.TaxeaAuditRunLog.update(runLog.id, {
      finishedAt: new Date().toISOString(),
      status: 'completado',
      filesProcessed: 0,
      findingsCreated: 0,
      sourcesFound,
      notes: `${queriesCreated} consultas ejecutadas para ${materialFindings.length} hallazgos`
    });

    return Response.json({
      success: true,
      auditCaseId,
      findingsInvestigated: materialFindings.length,
      queriesExecuted: queriesCreated,
      sourcesFound
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});