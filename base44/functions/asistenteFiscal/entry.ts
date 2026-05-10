import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SYSTEM_PROMPT = `Eres el "Asistente Fiscal Taxea", un copiloto fiscal inteligente integrado en el portal de Taxea Strategies, una asesoría fiscal y contable profesional española.

TU ROL:
- Eres un asistente fiscal operativo, NO un asesor fiscal autónomo.
- Respondes consultas frecuentes de autónomos y pymes sobre fiscalidad española.
- Siempre con tono profesional, claro, prudente y orientativo.
- Nunca emites criterios vinculantes ni das planificación fiscal avanzada.

ÁREAS QUE DOMINAS:
- IRPF (autónomos, módulos, estimación directa, retenciones, declaración de la renta)
- IVA (tipos, modelos 303, 390, exenciones, inversión sujeto pasivo)
- IGIC (Canarias, modelos 420, 425)
- Impuesto sobre Sociedades (modelo 200, 202, pagos fraccionados)
- Facturación (facturas simplificadas, requisitos, numeración, plazos)
- Gastos deducibles (software, vehículo, home office, dietas, formación, suministros)
- Modelos tributarios (111, 115, 130, 131, 303, 347, 349, 180, 190, 200, 202, 390)
- Obligaciones periódicas (plazos, calendarios fiscales)
- Retenciones (cuándo retener, tipos, profesionales, alquileres)
- Operaciones intracomunitarias básicas
- Conservación de documentación
- Libros registros obligatorios

REGLAS ABSOLUTAS:
1. Nunca asegures deducibilidad al 100% sin matices.
2. Nunca des respuestas vinculantes en casos complejos.
3. Si la consulta implica inspecciones, litigios, reestructuraciones, fusiones, operaciones vinculadas, estructuras holding o planificación agresiva: PARA y deriva al equipo Taxea.
4. Siempre termina indicando que la información es orientativa.
5. Responde siempre en español.
6. Sé conciso pero completo. Usa listas cuando ayude.

FORMATO DE RESPUESTA:
Debes responder en JSON con esta estructura exacta:
{
  "respuesta": "texto de la respuesta en markdown",
  "nivel_riesgo": "verde" | "amarillo" | "rojo",
  "impuesto_detectado": "irpf" | "iva" | "igic" | "sociedades" | "facturacion" | "gastos_deducibles" | "modelos" | "retenciones" | "general" | "otro",
  "derivar_asesor": true | false,
  "sugerencias": ["acción sugerida 1", "acción sugerida 2"],
  "etiquetas": ["etiqueta1", "etiqueta2"]
}

NIVELES DE RIESGO:
- verde: Consulta general segura, respuesta clara y habitual.
- amarillo: Depende de circunstancias, documentación o afectación. Matizar.
- rojo: Requiere revisión profesional obligatoria o caso complejo.

EJEMPLOS DE RESPUESTAS:
- "¿Qué gastos puedo deducirme?" → verde, gastos_deducibles
- "¿El vehículo es deducible?" → amarillo, gastos_deducibles (depende de afectación)
- "¿Cómo puedo reorganizar mi estructura societaria?" → rojo, derivar_asesor: true

Si la consulta es de riesgo rojo o derivar_asesor es true, la respuesta debe empezar con:
"⚠️ Esta consulta requiere revisión profesional personalizada por parte del equipo Taxea Strategies."`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pregunta, company_id, historial = [], sesion_id } = await req.json();
    if (!pregunta || !company_id) return Response.json({ error: 'Faltan parámetros' }, { status: 400 });

    // Buscar respuesta preaprobada primero
    const respuestasBase = await base44.asServiceRole.entities.AIRespuestaBase.filter({ activa: true, aprobada: true });
    let respuestaPreaprobada = null;
    const preguntaLower = pregunta.toLowerCase();
    
    for (const rb of respuestasBase) {
      const palabras = rb.palabras_clave || [];
      const coincidencias = palabras.filter(p => preguntaLower.includes(p.toLowerCase()));
      if (coincidencias.length >= 2 || (palabras.length === 1 && coincidencias.length === 1)) {
        respuestaPreaprobada = rb;
        // Incrementar contador de uso
        await base44.asServiceRole.entities.AIRespuestaBase.update(rb.id, { veces_usada: (rb.veces_usada || 0) + 1 });
        break;
      }
    }

    let resultado;

    if (respuestaPreaprobada) {
      resultado = {
        respuesta: respuestaPreaprobada.respuesta,
        nivel_riesgo: respuestaPreaprobada.nivel_riesgo,
        impuesto_detectado: respuestaPreaprobada.impuesto,
        derivar_asesor: respuestaPreaprobada.nivel_riesgo === 'rojo',
        sugerencias: ['Solicitar revisión al asesor', 'Subir documentación relevante'],
        etiquetas: [respuestaPreaprobada.impuesto],
        fuente: 'preaprobada',
      };
    } else {
      // Usar IA
      const mensajes = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historial.slice(-6).map(m => ({ role: m.rol, content: m.contenido })),
        { role: 'user', content: pregunta }
      ];

      const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Contexto: consulta fiscal de un cliente de Taxea Strategies.
Pregunta del cliente: "${pregunta}"
Historial reciente: ${JSON.stringify(historial.slice(-3))}

Responde ÚNICAMENTE con el JSON indicado en tus instrucciones. Sin texto adicional fuera del JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            respuesta: { type: 'string' },
            nivel_riesgo: { type: 'string' },
            impuesto_detectado: { type: 'string' },
            derivar_asesor: { type: 'boolean' },
            sugerencias: { type: 'array', items: { type: 'string' } },
            etiquetas: { type: 'array', items: { type: 'string' } }
          }
        },
        file_urls: null,
        model: 'claude_sonnet_4_6'
      });

      resultado = { ...aiResponse, fuente: 'ia_generada' };
    }

    // Guardar consulta
    const consulta = await base44.asServiceRole.entities.AIConsulta.create({
      company_id,
      pregunta,
      respuesta: resultado.respuesta,
      nivel_riesgo: resultado.nivel_riesgo || 'verde',
      impuesto_detectado: resultado.impuesto_detectado || 'general',
      fuente: resultado.fuente,
      estado: resultado.derivar_asesor ? 'derivada_asesor' : 'respondida',
      etiquetas: resultado.etiquetas || [],
      sesion_id: sesion_id || `ses_${Date.now()}`,
      requiere_entrenamiento: resultado.nivel_riesgo === 'rojo',
    });

    return Response.json({
      ...resultado,
      consulta_id: consulta.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});