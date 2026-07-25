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
    const { auditCaseId, reportType } = body;
    if (!auditCaseId) return Response.json({ error: 'auditCaseId requerido' }, { status: 400 });

    const auditCase = await base44.asServiceRole.entities.TaxeaAuditCase.get(auditCaseId);
    if (!auditCase) return Response.json({ error: 'Expediente no encontrado' }, { status: 404 });

    const [files, findings] = await Promise.all([
      base44.asServiceRole.entities.TaxeaAuditFile.filter({ auditCaseId }),
      base44.asServiceRole.entities.TaxeaAuditFinding.filter({ auditCaseId })
    ]);

    const typeLabel = reportType || 'informe_completo';

    const prompt = `Genera un informe profesional de auditoría en Markdown.

ESTRUCTURA REQUERIDA:
REVISIÓN INDEPENDIENTE - ${auditCase.auditType} - CONFIDENCIAL
Expediente: ${auditCase.title}
Cliente: ${auditCase.clientName || 'N/A'} - NIF: ${auditCase.clientNif || 'N/A'}
Ejercicio: ${auditCase.taxYear} - Período: ${auditCase.period || 'N/A'}
Jurisdicción: ${auditCase.jurisdiction}
Informe v1 - ${new Date().toLocaleDateString('es-ES')}
Preparado para: Administración Taxea

TARJETAS INICIALES:
- Resultado según documentación
- Resultado recalculado (si aplica)
- Impacto estimado
- Riesgo: ${auditCase.riskLevel}
- Recomendación: ${auditCase.recommendation}

1. RESUMEN EJECUTIVO (numerado, accionable)

2. TABLA DE VERIFICACIÓN COMPLETA con columnas: ID | Área | Documento afirma | Verificado | Evidencia | Veredicto | Prioridad | Acción

3. PREGUNTAS CONCRETAS para cerrar la revisión (divididas en: bloqueos, criterio, documentales, posteriores)

4. BORRADOR DE EMAIL profesional para gestoria/cliente

Anexo A - Inventario forense documental:
${files.map((f, i) => `${i + 1}. ${f.originalName} | ${f.documentType || 'Sin clasificar'} | ${f.whatItAccredits || 'N/A'}`).join('\n')}

Hallazgos detectados (${findings.length}):
${findings.map(f => `[${f.findingCode}] ${f.area} | ${f.verdict} | ${f.priority} | ${f.title} | ${f.exactEvidence} | ${f.actionRecommended}`).join('\n')}

LIMITACIÓN: Este informe es una revisión asistida por IA basada en la documentación aportada. No sustituye revisión profesional ni asesoramiento fiscal, contable o jurídico formal.

Reglas:
- No inventar datos que no estén en los hallazgos.
- Si hay hallazgos no_verificables o falta_doc, indicarlo claramente.
- Tono directo, técnico, prudente.`;

    const reportResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      model: "claude_sonnet_4_6"
    });

    const markdownContent = typeof reportResponse === 'string' ? reportResponse : JSON.stringify(reportResponse, null, 2);

    // Count existing reports for versioning
    const existingReports = await base44.asServiceRole.entities.TaxeaAuditReport.filter({ auditCaseId });
    const version = existingReports.length + 1;

    const report = await base44.asServiceRole.entities.TaxeaAuditReport.create({
      auditCaseId,
      version,
      title: `Informe ${typeLabel} - ${auditCase.title} - v${version}`,
      reportType: typeLabel,
      markdownContent,
      status: 'generado',
      generatedBy: user.email
    });

    // Update case status
    await base44.asServiceRole.entities.TaxeaAuditCase.update(auditCaseId, {
      status: 'informe_generado'
    });

    return Response.json({
      success: true,
      reportId: report.id,
      version,
      markdownContent
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});