import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Acceso no autorizado. Solo administradores.' }, { status: 403 });
    }

    const body = await req.json();
    const { auditCaseId, phase } = body;
    if (!auditCaseId) return Response.json({ error: 'auditCaseId requerido' }, { status: 400 });

    const auditCase = await base44.asServiceRole.entities.TaxeaAuditCase.get(auditCaseId);
    if (!auditCase) return Response.json({ error: 'Expediente no encontrado' }, { status: 404 });

    // Update case status to processing
    await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
      status: 'procesando',
      notes: (auditCase.notes || '') + `\n[Análisis iniciado por ${user.email} el ${new Date().toISOString()}]`
    });

    // Create run log
    const runLog = await base44.asServiceRole.entities.TaxeaAuditRunLog.create({
      auditCaseId,
      runType: 'extraccion',
      startedAt: new Date().toISOString(),
      status: 'en_progreso',
      triggeredBy: user.email,
      modelUsed: 'claude_sonnet_4_6'
    });

    // Get all files for this case
    const files = await base44.asServiceRole.entities.TaxeaAuditFile.filter({ auditCaseId });
    if (!files || files.length === 0) {
      await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
        status: 'con_error',
        notes: 'No hay documentos para analizar.'
      });
      return Response.json({ error: 'No hay documentos cargados en el expediente.' }, { status: 400 });
    }

    const findingsCreated = [];
    let filesProcessed = 0;

    // Phase 1: Extract and classify each file
    for (const file of files) {
      if (file.uploadStatus === 'excluido_admin') continue;

      try {
        await base44.asServiceRole.entities.TaxeaAuditFile.update(file.id, {
          uploadStatus: 'procesando',
          processingStatus: 'Extrayendo contenido con IA...'
        });

        // Use LLM to extract and classify document content
        const extractionPrompt = `Eres un analista documental forense experto en fiscalidad española y contabilidad. 
Analiza el siguiente documento (archivo: ${file.originalName}, tipo: ${file.mimeType}) del expediente de auditoría "${auditCase.title}".

Tipo de auditoría: ${auditCase.auditType}
Cliente: ${auditCase.clientName || 'N/A'} - NIF: ${auditCase.clientNif || 'N/A'}
Ejercicio: ${auditCase.taxYear || 'N/A'}
Período: ${auditCase.period || 'N/A'}
Jurisdicción: ${auditCase.jurisdiction}

Realiza:
1. CLASIFICA el documento por tipo (modelo fiscal, factura, balance, PyG, extracto bancario, escritura, contrato, etc.)
2. EXTRAE datos clave: importes, fechas, NIF/CIF, razones sociales, casillas de modelos, referencias, cuentas contables, saldos
3. IDENTIFICA qué acredita o prueba este documento
4. DETECTA posibles problemas, inconsistencias, faltas, errores, riesgos fiscales/contables
5. Genera hallazgos concretos con evidencia exacta

Responde en JSON con esta estructura:
{
  "documentType": "tipo de documento clasificado",
  "pageCount": número o null,
  "hasTextLayer": true/false,
  "whatItAccredits": "qué acredita el documento",
  "extractedData": ["lista de datos clave extraídos con valor"],
  "findings": [
    {
      "area": "liquidacion|cruces|riesgo|formulario|juridico|documentacion",
      "title": "título breve del hallazgo",
      "documentClaim": "qué afirma el documento",
      "verification": "qué se pudo verificar",
      "exactEvidence": "evidencia exacta (página, casilla, importe)",
      "economicEffect": "efecto económico si aplica",
      "verdict": "ok|ok_parcial|error|diferencia|no_verificable|falta_doc|criterio|aviso|opcion|riesgo|bloquea",
      "priority": "bloquea|alta|media|baja|posterior|ccaa|menor",
      "actionRecommended": "acción recomendada concreta"
    }
  ]
}

Reglas críticas:
- NO inventes datos, importes, fechas ni referencias que no estén en el documento.
- Si no puedes verificar algo, usa veredicto "no_verificable" o "falta_doc".
- Cada hallazgo debe tener evidencia exacta rastreable.
- No emitir conclusiones definitivas sin base documental.`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: extractionPrompt,
          file_urls: [file.storagePath],
          response_json_schema: {
            type: "object",
            properties: {
              documentType: { type: "string" },
              pageCount: { type: "number" },
              hasTextLayer: { type: "boolean" },
              whatItAccredits: { type: "string" },
              extractedData: { type: "array", items: { type: "string" } },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    area: { type: "string" },
                    title: { type: "string" },
                    documentClaim: { type: "string" },
                    verification: { type: "string" },
                    exactEvidence: { type: "string" },
                    economicEffect: { type: "string" },
                    verdict: { type: "string" },
                    priority: { type: "string" },
                    actionRecommended: { type: "string" }
                  }
                }
              }
            }
          },
          model: "claude_sonnet_4_6"
        });

        // Update file with extraction results
        await base44.asServiceRole.entities.TaxeaAuditFile.update(file.id, {
          uploadStatus: 'clasificado',
          processingStatus: 'Extracción completada',
          documentType: llmResponse.documentType || 'Sin clasificar',
          pageCount: llmResponse.pageCount || null,
          hasTextLayer: llmResponse.hasTextLayer ?? true,
          requiresOcr: !llmResponse.hasTextLayer,
          whatItAccredits: llmResponse.whatItAccredits || '',
          extractedAt: new Date().toISOString()
        });

        // Create extraction record with structured data
        await base44.asServiceRole.entities.TaxeaAuditExtraction.create({
          auditCaseId,
          fileId: file.id,
          fileName: file.originalName,
          extractionType: 'document_intelligence',
          rawText: '',
          structuredDataJson: JSON.stringify(llmResponse.extractedData || []),
          tablesJson: '',
          extractedData: llmResponse.extractedData || [],
          confidence: llmResponse.hasTextLayer ? 0.9 : 0.6,
          reliability: llmResponse.hasTextLayer === false ? 'ocr_dudoso' : 'fiable'
        });

        // Create findings
        if (llmResponse.findings && llmResponse.findings.length > 0) {
          const findingRecords = llmResponse.findings.map((f, idx) => {
            const areaCode = f.area === 'liquidacion' ? 'A' : f.area === 'cruces' ? 'B' : f.area === 'riesgo' ? 'C' : f.area === 'formulario' ? 'D' : f.area === 'juridico' ? 'E' : 'F';
            return {
              auditCaseId: auditCaseId,
              findingCode: `${areaCode}${String(idx + 1).padStart(2, '0')}`,
              area: f.area || 'documentacion',
              title: f.title || 'Hallazgo sin título',
              documentClaim: f.documentClaim || '',
              verification: f.verification || '',
              exactEvidence: f.exactEvidence || '',
              legalBasisSummary: '',
              economicEffect: f.economicEffect || '',
              verdict: f.verdict || 'no_verificable',
              priority: f.priority || 'media',
              actionRecommended: f.actionRecommended || ''
            };
          });
          const created = await base44.asServiceRole.entities.TaxeaAuditFinding.bulkCreate(findingRecords);
          findingsCreated.push(...created);
        }

        filesProcessed++;
      } catch (fileErr) {
        await base44.asServiceRole.entities.TaxeaAuditFile.update(file.id, {
          uploadStatus: 'con_error',
          processingStatus: 'Error en extracción',
          errorMessage: fileErr.message
        });
      }
    }

    // Generate executive summary
    const allFindings = await base44.asServiceRole.entities.TaxeaAuditFinding.filter({ auditCaseId });
    const bloqueos = allFindings.filter(f => f.priority === 'bloquea' || f.verdict === 'bloquea');
    const errores = allFindings.filter(f => f.verdict === 'error');
    const riesgos = allFindings.filter(f => f.verdict === 'riesgo');
    const noVerificables = allFindings.filter(f => f.verdict === 'no_verificable' || f.verdict === 'falta_doc');

    let riskLevel = 'bajo';
    if (bloqueos.length > 0 || errores.length > 0) riskLevel = 'critico';
    else if (riesgos.length > 0) riskLevel = 'alto';
    else if (noVerificables.length > 0) riskLevel = 'medio';

    let recommendation = 'ok_continuar';
    if (bloqueos.length > 0) recommendation = 'no_presentar';
    else if (riesgos.length > 0 || errores.length > 0) recommendation = 'parar_24_48h';
    else if (noVerificables.length > 0) recommendation = 'pendiente_documentacion';

    const summaryPrompt = `Genera un resumen ejecutivo profesional en Markdown para un expediente de auditoría.

Expediente: ${auditCase.title}
Cliente: ${auditCase.clientName || 'N/A'}
Tipo: ${auditCase.auditType}
Ejercicio: ${auditCase.taxYear}
Documentos analizados: ${filesProcessed}
Hallazgos totales: ${allFindings.length}
- Bloqueos: ${bloqueos.length}
- Errores: ${errores.length}
- Riesgos: ${riesgos.length}
- No verificables / Falta doc: ${noVerificables.length}

Lista de hallazgos:
${allFindings.map(f => `- [${f.findingCode}] ${f.area} | ${f.verdict} | ${f.priority} | ${f.title} | ${f.exactEvidence}`).join('\n')}

Genera un resumen ejecutivo numerado que incluya:
1. Conclusión principal
2. Impacto estimado
3. Bloqueos antes de cerrar/presentar
4. Riesgos materiales
5. Recomendación operativa
6. Limitaciones de la revisión

Incluye al final: "Borrador pendiente de revisión profesional. No sustituye asesoramiento fiscal, contable ni jurídico."`;

    const summaryResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: summaryPrompt,
      model: "claude_sonnet_4_6"
    });

    // Update case with results
    await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
      status: 'analisis_completado',
      riskLevel: riskLevel,
      recommendation: recommendation,
      impactEstimated: `${allFindings.length} hallazgos: ${bloqueos.length} bloqueos, ${errores.length} errores, ${riesgos.length} riesgos, ${noVerificables.length} no verificables`,
      summaryMarkdown: typeof summaryResponse === 'string' ? summaryResponse : JSON.stringify(summaryResponse)
    });

    // Update run log
    await base44.asServiceRole.entities.TaxeaAuditRunLog.update(runLog.id, {
      finishedAt: new Date().toISOString(),
      status: 'completado',
      filesProcessed,
      findingsCreated: findingsCreated.length
    });

    return Response.json({
      success: true,
      auditCaseId,
      filesProcessed,
      findingsCreated: findingsCreated.length,
      riskLevel,
      recommendation,
      bloqueos: bloqueos.length,
      errores: errores.length,
      riesgos: riesgos.length,
      noVerificables: noVerificables.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});