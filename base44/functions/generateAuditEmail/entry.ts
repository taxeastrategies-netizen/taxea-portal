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
    const { auditCaseId, recipientType } = body;
    if (!auditCaseId) return Response.json({ error: 'auditCaseId requerido' }, { status: 400 });

    const auditCase = await base44.asServiceRole.entities.TaxeaAuditCase.get(auditCaseId);
    if (!auditCase) return Response.json({ error: 'Expediente no encontrado' }, { status: 404 });

    const [findings, legalSources] = await Promise.all([
      base44.asServiceRole.entities.TaxeaAuditFinding.filter({ auditCaseId }),
      base44.asServiceRole.entities.TaxeaAuditLegalSource.filter({ auditCaseId })
    ]);

    const bloqueos = findings.filter(f => f.priority === 'bloquea' || f.verdict === 'bloquea');
    const errores = findings.filter(f => f.verdict === 'error');
    const riesgos = findings.filter(f => f.verdict === 'riesgo');
    const noVerif = findings.filter(f => ['no_verificable', 'falta_doc'].includes(f.verdict));

    const recipientLabel = {
      gestoria: 'equipo de gestoría',
      cliente: 'cliente',
      asesor: 'asesor externo',
      notaria: 'notaría',
      tercero: 'tercero',
      interna: 'administración interna'
    }[recipientType || 'gestoria'];

    const prompt = `Genera un borrador de email profesional y natural dirigido a: ${recipientLabel}.

Expediente: ${auditCase.title}
Cliente: ${auditCase.clientName || 'N/A'} - NIF: ${auditCase.clientNif || 'N/A'}
Ejercicio: ${auditCase.taxYear}

Hallazgos:
- ${bloqueos.length} bloqueos
- ${errores.length} errores
- ${riesgos.length} riesgos
- ${noVerif.length} no verificables / falta documentación

Detalle de bloqueos y errores:
${bloqueos.concat(errores).map(f => `- [${f.findingCode}] ${f.title}: ${f.actionRecommended}`).join('\n')}

Documentación pendiente:
${noVerif.map(f => `- [${f.findingCode}] ${f.title}: ${f.actionRecommended}`).join('\n')}

Reglas del email:
- Reconocer lo que está correcto si procede
- Ir directo a los puntos que importan
- Separar bloqueos de temas posteriores
- Pedir documentos concretos
- No sonar acusatorio
- No usar lenguaje robótico
- No afirmar como cerrado lo que depende de revisión profesional
- Tono profesional, directo y cordial
- Terminar indicando disponibilidad para resolver dudas

Genera SOLO el cuerpo del email (sin asunto ni "Estimado/a" como cabecera separada, empieza directamente con el saludo).`;

    const emailResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      model: "claude_sonnet_4_6"
    });

    const emailContent = typeof emailResponse === 'string' ? emailResponse : JSON.stringify(emailResponse);

    return Response.json({
      success: true,
      emailContent,
      recipientType: recipientType || 'gestoria'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});