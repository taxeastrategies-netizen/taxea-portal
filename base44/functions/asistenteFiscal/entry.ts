import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─────────────────────────────────────────────
// JERARQUÍA DE FUENTES OFICIALES PRIORITARIAS
// ─────────────────────────────────────────────
const FUENTES_OFICIALES = [
  { nombre: 'Agencia Tributaria (AEAT)', url: 'sede.agenciatributaria.gob.es', dominio: 'agenciatributaria.gob.es' },
  { nombre: 'BOE', url: 'boe.es', dominio: 'boe.es' },
  { nombre: 'Agencia Tributaria Canaria (ATC)', url: 'gobiernodecanarias.org/tributos', dominio: 'gobiernodecanarias.org' },
  { nombre: 'Seguridad Social / Importass', url: 'importass.seg-social.es', dominio: 'seg-social.es' },
  { nombre: 'Ministerio de Hacienda', url: 'hacienda.gob.es', dominio: 'hacienda.gob.es' },
  { nombre: 'SEPE', url: 'sepe.es', dominio: 'sepe.es' },
  { nombre: 'ICAC', url: 'icac.gob.es', dominio: 'icac.gob.es' },
  { nombre: 'DGT (Consultas vinculantes)', url: 'petete.hacienda.gob.es', dominio: 'petete.hacienda.gob.es' },
];

// ─────────────────────────────────────────────
// DETECCIÓN DE INTENCIÓN / IMPUESTO
// ─────────────────────────────────────────────
function detectarImpuesto(pregunta) {
  const p = pregunta.toLowerCase();
  if (/igic|canarias?|modelo 4[0-9]{2}|repep|atc/.test(p)) return 'igic';
  if (/irpf|modelo 130|modelo 111|modelo 190|renta|declaraci[oó]n anual|retenci[oó]n|módulos|estimaci[oó]n directa/.test(p)) return 'irpf';
  if (/iva|modelo 303|modelo 390|modelo 349|repercutido|soportado|intracomunitari|inversi[oó]n del sujeto/.test(p)) return 'iva';
  if (/sociedad|impuesto sobre sociedades|modelo 200|modelo 202|sl\b|sa\b|administrador/.test(p)) return 'sociedades';
  if (/factur|ticket|proforma|rectificativa|numeraci[oó]n/.test(p)) return 'facturacion';
  if (/deducible|deducir|gasto|m[oó]vil|tel[eé]fono|coche|veh[ií]culo|gasolina|dieta|comida|ropa|formaci[oó]n|software|ordenador/.test(p)) return 'gastos_deducibles';
  if (/alta aut[oó]nomo|darme de alta|reta|cuota|seguridad social|importass|modelo 036|modelo 037|modelo 400|epigrafe|iae/.test(p)) return 'general';
  if (/modelo|plazo|calendario|declaraci[oó]n|presentar|trimestral/.test(p)) return 'modelos';
  if (/retenci[oó]n|retener/.test(p)) return 'retenciones';
  return 'general';
}

// ─────────────────────────────────────────────
// GENERACIÓN DE CONSULTAS DE BÚSQUEDA
// ─────────────────────────────────────────────
function generarConsultasBusqueda(pregunta, impuesto) {
  const base = pregunta.trim();
  const queries = [];

  // Consulta 1: fuente oficial prioritaria según impuesto
  if (impuesto === 'igic') {
    queries.push(`site:gobiernodecanarias.org IGIC ${base}`);
    queries.push(`site:agenciatributaria.gob.es IGIC Canarias ${base}`);
  } else if (impuesto === 'irpf') {
    queries.push(`site:sede.agenciatributaria.gob.es IRPF autónomo ${base}`);
    queries.push(`site:boe.es Ley 35/2006 IRPF ${base}`);
  } else if (impuesto === 'iva') {
    queries.push(`site:sede.agenciatributaria.gob.es IVA ${base}`);
    queries.push(`site:boe.es Ley 37/1992 IVA ${base}`);
  } else if (impuesto === 'sociedades') {
    queries.push(`site:sede.agenciatributaria.gob.es impuesto sociedades ${base}`);
    queries.push(`site:boe.es Ley 27/2014 Impuesto sobre Sociedades ${base}`);
  } else if (impuesto === 'gastos_deducibles') {
    queries.push(`site:sede.agenciatributaria.gob.es gastos deducibles autónomo ${base}`);
    queries.push(`AEAT manual práctico IRPF gastos deducibles actividades económicas ${base}`);
  } else {
    queries.push(`site:sede.agenciatributaria.gob.es ${base}`);
    queries.push(`site:boe.es ${base} fiscalidad España`);
  }

  // Consulta genérica siempre
  queries.push(`AEAT ${base} España autónomo pyme 2024 2025`);

  return queries;
}

// ─────────────────────────────────────────────
// CASOS QUE SIEMPRE DERIVAN A TAXEA
// ─────────────────────────────────────────────
function requiereDerivacion(pregunta) {
  const p = pregunta.toLowerCase();
  return /requerimiento|sanción|recurso|prorrata|exent[ao]|roi\b|oss\b|operaci[oó]n vinculada|holding|criptomoneda|cripto|herencia|donaci[oó]n|inspecci[oó]n|reestructurac|fusi[oó]n|dividendo|n[oó]mina.*socio|socio.*n[oó]mina|vivienda.*afect|veh[ií]culo.*deducti/.test(p);
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT PRINCIPAL
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el "Asistente Fiscal Taxea", un especialista en fiscalidad española y canaria integrado en el portal privado de Taxea Strategies, asesoría fiscal profesional.

TU ROL:
- Responder consultas fiscales con información actualizada, basada en fuentes oficiales.
- Actuar como un fiscal especializado, no como un chatbot genérico.
- Siempre tono profesional, prudente, claro y orientativo.
- Nunca emitir criterios vinculantes ni dar planificación fiscal agresiva.

ÁREAS FISCALES QUE DOMINAS:
- IRPF: autónomos, estimación directa, módulos, retenciones, modelo 130, renta anual
- IVA: tipos, modelos 303/390/349, exenciones, inversión sujeto pasivo, intracomunitario
- IGIC (Canarias): tipos (general 7%), modelos 420/425/400, REPEP, diferencias con IVA, ATC
- Impuesto sobre Sociedades: modelo 200/202, pagos fraccionados, gastos deducibles
- Altas de autónomos: modelos 036/037/400, RETA, cuota, epígrafes IAE
- Gastos deducibles: criterios AEAT, afectación, documentación, riesgo
- Facturación: requisitos, numeración, simplificadas, rectificativas, plazos
- Obligaciones periódicas: calendarios, plazos, recargos por extemporaneidad
- Retenciones: tipos (15%, 7% inicio, 19% alquiler), cuándo aplicar
- Operaciones intracomunitarias básicas: ROI, modelo 349, inversión sujeto pasivo

JERARQUÍA DE FUENTES (usar en este orden):
1. BOE (leyes: IRPF 35/2006, IVA 37/1992, IS 27/2014, IGIC 20/1991)
2. AEAT / sede.agenciatributaria.gob.es
3. ATC / Agencia Tributaria Canaria
4. Seguridad Social / Importass
5. Ministerio de Hacienda / hacienda.gob.es
6. SEPE, ICAC, DGT
7. Colegios profesionales, REAF, CEF (solo apoyo)
8. Blogs privados: NUNCA como fuente principal

REGLAS ABSOLUTAS:
1. Nunca asegurar deducibilidad al 100% sin matices.
2. Usar siempre: "Con carácter general…", "Depende del caso…", "Si existe factura…", "Conviene revisar…"
3. NUNCA usar: "Sí, siempre", "No, nunca", "Dedúcelo sin problema", "No pasa nada"
4. Si la consulta implica: inspecciones, operaciones vinculadas, prorrata, criptos, herencias, vehículo con uso mixto o estructura societaria compleja → derivar_asesor: true
5. Responder SIEMPRE en español.
6. Formato claro con secciones cuando proceda.

ESTRUCTURA DE RESPUESTA OBLIGATORIA:
Tu respuesta debe seguir esta estructura en markdown cuando sea apropiado:

**Respuesta directa:** [párrafo claro y conciso]

**Explicación práctica:** [detalle aplicable]

**Requisitos / Condiciones:** [si procede]

**Riesgos o matices:** [si existe ambigüedad o riesgo fiscal]

**Modelos afectados:** [si procede: Modelo 303, 130, etc.]

**Recomendación Taxea:** [conclusión prudente orientada al cliente]

NIVEL DE CONFIANZA:
- alta: norma clara, fuente oficial identificada, criterio consolidado
- media: hay matices, depende de circunstancias o caso concreto
- baja: tema complejo, no se encuentra fuente oficial suficiente → derivar

AVISO: Si el nivel de confianza es bajo, NO dar respuesta cerrada. Derivar a Taxea.

FORMATO JSON DE RESPUESTA:
Responde ÚNICAMENTE con este JSON sin texto adicional:
{
  "respuesta": "texto en markdown con estructura",
  "nivel_riesgo": "verde" | "amarillo" | "rojo",
  "nivel_confianza": "alta" | "media" | "baja",
  "impuesto_detectado": "irpf" | "iva" | "igic" | "sociedades" | "facturacion" | "gastos_deducibles" | "modelos" | "retenciones" | "general" | "otro",
  "derivar_asesor": true | false,
  "fuentes_usadas": [{"nombre": "AEAT", "descripcion": "Manual práctico IRPF 2024", "url": "https://sede.agenciatributaria.gob.es"}],
  "sugerencias": ["acción sugerida corta"],
  "etiquetas": ["etiqueta1"]
}`;

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pregunta, company_id, historial = [], sesion_id } = await req.json().catch(() => ({}));
    if (!pregunta || !company_id) return Response.json({ error: 'Faltan parámetros' }, { status: 400 });

    const impuesto = detectarImpuesto(pregunta);
    const debeDerivarse = requiereDerivacion(pregunta);

    // ── 1. Buscar en base interna primero ──
    const respuestasBase = await base44.asServiceRole.entities.AIRespuestaBase.filter({ activa: true, aprobada: true });
    let respuestaPreaprobada = null;
    const preguntaLower = pregunta.toLowerCase();

    for (const rb of respuestasBase) {
      const palabras = rb.palabras_clave || [];
      const coincidencias = palabras.filter(p => preguntaLower.includes(p.toLowerCase()));
      if (coincidencias.length >= 2 || (palabras.length === 1 && coincidencias.length === 1)) {
        respuestaPreaprobada = rb;
        await base44.asServiceRole.entities.AIRespuestaBase.update(rb.id, { veces_usada: (rb.veces_usada || 0) + 1 });
        break;
      }
    }

    let resultado;

    if (respuestaPreaprobada && !debeDerivarse) {
      // ── Usar respuesta preaprobada + enriquecer con búsqueda web ──
      resultado = {
        respuesta: respuestaPreaprobada.respuesta,
        nivel_riesgo: respuestaPreaprobada.nivel_riesgo,
        nivel_confianza: 'alta',
        impuesto_detectado: respuestaPreaprobada.impuesto || impuesto,
        derivar_asesor: respuestaPreaprobada.nivel_riesgo === 'rojo',
        fuentes_usadas: [
          { nombre: 'Taxea Strategies (criterio interno validado)', descripcion: 'Respuesta revisada y aprobada por el equipo fiscal de Taxea', url: null },
          { nombre: 'Agencia Tributaria (AEAT)', descripcion: 'Normativa fiscal oficial española', url: 'https://sede.agenciatributaria.gob.es' }
        ],
        sugerencias: respuestaPreaprobada.nivel_riesgo === 'rojo'
          ? ['Solicitar revisión al asesor', 'Crear tarea de consulta']
          : ['Consultar con Taxea si tienes dudas sobre tu caso', 'Subir documentación si aplica'],
        etiquetas: [respuestaPreaprobada.impuesto || impuesto],
        fuente: 'preaprobada',
      };
    } else {
      // ── Búsqueda web + IA especializada ──
      const queries = generarConsultasBusqueda(pregunta, impuesto);
      const queryPrincipal = queries[0];

      // Construir prompt enriquecido con instrucción de búsqueda
      const promptEnriquecido = `Eres un especialista fiscal español con acceso a información actualizada.

CONSULTA DEL CLIENTE DE TAXEA:
"${pregunta}"

IMPUESTO DETECTADO: ${impuesto}
REQUIERE DERIVACIÓN OBLIGATORIA: ${debeDerivarse ? 'SÍ' : 'NO'}

INSTRUCCIONES:
${debeDerivarse ? `
⚠️ Esta consulta REQUIERE derivación a Taxea. La respuesta debe:
1. Explicar brevemente por qué es un caso complejo
2. Indicar los riesgos generales conocidos
3. Recomendar firmemente la revisión profesional de Taxea
4. Nivel de riesgo: ROJO
5. derivar_asesor: true
` : `
1. Busca información actualizada sobre: "${queryPrincipal}"
2. También considera: "${queries[1] || queries[0]}"
3. Prioriza fuentes oficiales: AEAT, BOE, ATC (Canarias), Seguridad Social
4. Responde siguiendo la estructura obligatoria del sistema
5. Incluye fuentes_usadas con nombre, descripción y URL donde sea posible
6. Si el impuesto es IGIC/Canarias, menciona ATC y modelos 420/425/400
7. Si es IRPF autónomo, menciona AEAT y modelo 130 cuando aplique
8. Nivel de confianza: ALTA si la norma es clara y oficial, MEDIA si hay matices, BAJA si es complejo
`}

HISTORIAL RECIENTE: ${JSON.stringify(historial.slice(-3).map(m => ({ rol: m.rol, contenido: m.contenido?.slice(0, 200) })))}

Responde ÚNICAMENTE con el JSON definido en tus instrucciones de sistema. Sin texto fuera del JSON.`;

      const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: promptEnriquecido,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            respuesta: { type: 'string' },
            nivel_riesgo: { type: 'string' },
            nivel_confianza: { type: 'string' },
            impuesto_detectado: { type: 'string' },
            derivar_asesor: { type: 'boolean' },
            fuentes_usadas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' },
                  descripcion: { type: 'string' },
                  url: { type: 'string' }
                }
              }
            },
            sugerencias: { type: 'array', items: { type: 'string' } },
            etiquetas: { type: 'array', items: { type: 'string' } }
          }
        },
        model: 'gemini_3_1_pro'
      });

      // Normalizar fuentes: asegurar que las fuentes sean reales y ordenadas
      let fuentes = (aiResponse.fuentes_usadas || []).filter(f => f && f.nombre);

      // Si no hay fuentes suficientes, añadir fuentes base según impuesto
      if (fuentes.length < 2) {
        fuentes = [
          { nombre: 'Agencia Tributaria (AEAT)', descripcion: 'Normativa y guías oficiales IRPF, IVA, IS', url: 'https://sede.agenciatributaria.gob.es' },
          ...(impuesto === 'igic' ? [{ nombre: 'Agencia Tributaria Canaria (ATC)', descripcion: 'IGIC, modelos 420, 425, 400, REPEP', url: 'https://www.gobiernodecanarias.org/tributos' }] : []),
          { nombre: 'BOE', descripcion: 'Leyes tributarias vigentes', url: 'https://www.boe.es' },
        ];
      }

      // Normalizar valores al esquema de la entidad
      const normalizeRiesgo = (v) => {
        const map = { 'medio': 'amarillo', 'medio-alto': 'amarillo', 'alto': 'rojo', 'bajo': 'verde' };
        const s = (v || '').toLowerCase().trim();
        return map[s] || (['verde','amarillo','rojo'].includes(s) ? s : 'amarillo');
      };
      const normalizeConfianza = (v) => {
        const s = (v || '').toLowerCase().trim();
        return ['alta','media','baja'].includes(s) ? s : 'media';
      };
      const normalizeImpuesto = (v) => {
        const s = (v || '').toLowerCase();
        const validos = ['irpf','iva','igic','sociedades','facturacion','gastos_deducibles','modelos','retenciones','general','otro'];
        if (validos.includes(s)) return s;
        if (s.includes('irpf') || s.includes('iva') || s.includes('igic')) return 'irpf';
        return impuesto || 'general';
      };

      resultado = {
        ...aiResponse,
        nivel_riesgo: normalizeRiesgo(aiResponse.nivel_riesgo),
        nivel_confianza: normalizeConfianza(aiResponse.nivel_confianza),
        impuesto_detectado: normalizeImpuesto(aiResponse.impuesto_detectado),
        fuentes_usadas: fuentes.slice(0, 5),
        fuente: 'ia_generada',
      };
    }

    // ── Guardar consulta ──
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
      requiere_entrenamiento: resultado.nivel_confianza === 'baja' || resultado.nivel_riesgo === 'rojo',
    });

    return Response.json({
      ...resultado,
      consulta_id: consulta.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});