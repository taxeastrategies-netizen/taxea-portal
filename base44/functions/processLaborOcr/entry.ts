import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { document_id } = await req.json();
  if (!document_id) return Response.json({ error: 'document_id required' }, { status: 400 });

  const docs = await base44.asServiceRole.entities.LaborOcrDocument.filter({ id: document_id });
  const doc = docs[0];
  if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });

  try {
    await base44.asServiceRole.entities.LaborOcrDocument.update(doc.id, { ocr_status: 'procesando' });

    const prompt = `Eres un motor OCR especializado en nóminas españolas con conocimiento laboral, fiscal y contable. Tu misión es extraer datos con máxima precisión y marcar como dudoso cualquier dato que no puedas leer con claridad.

## REGLA CRÍTICA: NO INVENTAR DATOS
Si no puedes leer un campo con claridad, usa null y marca confidence_level como "no_fiable". Nunca:
- Uses el nombre de la empresa como empleado
- Uses el DNI del trabajador como CIF de empresa ni viceversa
- Confundas NAF/NUSS con DNI/NIE
- Confundas CCC con NAF
- Inventes el periodo desde la fecha de emisión o pago
- Confundas base de cotización con líquido
- Confundas total devengado con neto
- Uses identificadores fiscales como importes
- Generates asiento si las cifras no cuadran matemáticamente

## IDENTIFICADORES - VALIDACIONES ESTRICTAS

### DNI/NIE trabajador
- DNI: exactamente 8 dígitos + 1 letra (ej: 12345678Z)
- NIE: X, Y o Z + 7 dígitos + 1 letra (ej: X1234567L)
- Normalizar espacios y guiones antes de validar
- Si no cumple patrón estricto: confidence_level = "baja", marcar como dudoso
- Nunca aceptar CIF empresa (letra + 7 dígitos) como DNI trabajador
- Nunca aceptar NAF (12 dígitos) como DNI

### CIF/NIF empresa
- Formato: letra inicial (A,B,C,D,E,F,G,H,J,N,P,Q,R,S,U,V,W) + 7 dígitos + dígito/letra control
- Etiquetas cercanas: CIF, NIF empresa, N.I.F., C.I.F.
- Debe estar en el bloque EMPRESA, no en el bloque de trabajador
- Si aparece en zona incorrecta: marcar como conflicto

### NAF/NUSS (número afiliación SS)
- Normalmente 12 dígitos (puede aparecer como 28/1234567890 o agrupado)
- Etiquetas: NAF, NUSS, Nº afiliación, número seguridad social del trabajador
- No confundir con CCC empresa (también numérico)
- No confundir con DNI/NIE
- Validar que está en bloque TRABAJADOR

### CCC empresa
- Código Cuenta Cotización: número de la empresa ante la SS
- Tratar como identificador de empresa, no del trabajador
- Etiquetas: CCC, código cuenta cotización, cuenta de cotización

## ESTRUCTURA DE LA NÓMINA (zonas)
La nómina española tiene estos bloques. Asigna cada dato a su zona correcta:
- company_block: datos empresa (nombre, CIF, CCC, domicilio)
- employee_block: datos trabajador (nombre, DNI/NIE, NAF, grupo, categoría, antigüedad)
- period_block: periodo de liquidación (fechas del periodo, días trabajados)
- employment_block: datos laborales (contrato, jornada, puesto)
- earnings_table: tabla de devengos
- deductions_table: tabla de deducciones
- contribution_bases_block: bases de cotización CC, AT/EP
- tax_block: base IRPF, porcentaje IRPF
- totals_block: total devengado, total deducciones, líquido a percibir
- footer_block: firma, sello, pie

## PERIODO DE NÓMINA
Extraer el periodo de liquidación de estas fuentes (por orden de prioridad):
1. Etiqueta "Periodo de liquidación" o "Periodo"
2. Rango "del DD/MM/YYYY al DD/MM/YYYY"
3. "Nómina de [mes] [año]" o "Recibo de salarios correspondiente a [mes] [año]"
4. Mes/año indicado explícitamente
5. Días cotizados + mes visible

NO usar como periodo: fecha de pago, fecha de emisión, fecha de antigüedad, fecha de alta, fecha de contrato.
NUNCA convertir "del 01/03/2026 al 31/03/2026" en enero ni en fecha actual.

## PARSER NUMÉRICO EUROPEO
Formato español: coma decimal, punto de miles.
- "1.234,56" → 1234.56
- "1234,56" → 1234.56  
- "1 234,56" → 1234.56
- "-123,45" → -123.45
- "(123,45)" → -123.45
NUNCA interpretar DNI, NAF, CCC, porcentajes, días trabajados como importes monetarios.

## DEVENGOS
Etiquetas posibles: salario base, antigüedad, plus convenio, plus transporte, complemento, horas extra, paga extra, prorrata pagas extra, comisiones, incentivos, vacaciones, dietas, kilometraje, indemnización, retribución en especie.
Cada línea: descripcion_original, importe, tipo_salarial (salarial/no_salarial), cuenta_sugerida (640/641/629/...), confianza.

## DEDUCCIONES
Etiquetas posibles: IRPF, retención IRPF, contingencias comunes, desempleo, formación profesional, MEI, Seguridad Social trabajador, anticipo, embargo, valor productos en especie.
La SS trabajador puede estar desglosada en varias líneas (CC + desempleo + FP + MEI). Sumarlas correctamente.
NO confundir SS empresa con SS trabajador.

## VALIDACIONES MATEMÁTICAS OBLIGATORIAS
Verificar con tolerancia de 0.02€:
1. total_accruals ≈ suma(devengos)
2. total_deductions ≈ suma(deducciones)
3. net_pay ≈ total_accruals - total_deductions
4. irpf_amount ≈ irpf_base * (irpf_rate/100) si tienes ambos datos
5. employee_ss_amount ≈ suma(CC + desempleo + FP + MEI)

Si no cuadra: math_validation = false, incluir diferencia exacta en warnings.

## ASIENTO CONTABLE
SOLO generar asiento si: empleado validado, periodo validado, total devengado validado, líquido validado.
NUNCA inventar cuota SS empresa. Si no aparece explícitamente, marcar línea 642 como "pendiente_seguros_sociales".

Asiento devengo de nómina:
DEBE: 640 (sueldos/salarios = total devengado salarial)
HABER: 4751 (IRPF), 476 (SS trabajador), 465 (líquido a percibir)
Solo incluir 642 si aparece explícitamente la cuota patronal.
Para anticipos: usar 460. Para embargos: marcar cuenta configurable.

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto adicional):
{
  "document_type": "nomina" | "seguro_social" | "desconocido",
  "template_detected": string,
  "confidence": número 0-100,
  "processing_notes": string,

  "company": {
    "name": string | null,
    "tax_id": string | null,
    "ccc": string | null,
    "address": string | null,
    "zone": "company_block",
    "name_confidence": "alta" | "media" | "baja" | "no_fiable",
    "tax_id_confidence": "alta" | "media" | "baja" | "no_fiable",
    "tax_id_source": string
  },

  "employee": {
    "full_name": string | null,
    "tax_id": string | null,
    "naf": string | null,
    "professional_group": string | null,
    "seniority_date": string | null,
    "contract_type": string | null,
    "zone": "employee_block",
    "name_confidence": "alta" | "media" | "baja" | "no_fiable",
    "tax_id_confidence": "alta" | "media" | "baja" | "no_fiable",
    "naf_confidence": "alta" | "media" | "baja" | "no_fiable",
    "tax_id_source": string,
    "naf_source": string
  },

  "period": {
    "label": string | null,
    "start": string | null,
    "end": string | null,
    "month": número | null,
    "year": número | null,
    "worked_days": número | null,
    "payment_date": string | null,
    "issue_date": string | null,
    "source": string,
    "confidence": "alta" | "media" | "baja" | "no_fiable"
  },

  "devengos": [
    {
      "descripcion_original": string,
      "concepto_normalizado": string,
      "importe": número,
      "tipo": "salarial" | "no_salarial" | "especie" | "no_clasificado",
      "cuenta_sugerida": string,
      "confianza": número 0-100
    }
  ],

  "deducciones": [
    {
      "descripcion_original": string,
      "tipo": "irpf" | "ss_cc" | "ss_desempleo" | "ss_fp" | "ss_mei" | "ss_total_trabajador" | "anticipo" | "embargo" | "especie" | "otro",
      "porcentaje": número | null,
      "base": número | null,
      "importe": número,
      "cuenta_sugerida": string,
      "confianza": número 0-100
    }
  ],

  "totals": {
    "total_accruals": número | null,
    "total_deductions": número | null,
    "net_pay": número | null,
    "contribution_base_cc": número | null,
    "contribution_base_at": número | null,
    "irpf_base": número | null,
    "irpf_rate": número | null,
    "irpf_amount": número | null,
    "employee_ss_amount": número | null,
    "employer_ss_amount": número | null,
    "advance_payment": número | null
  },

  "math_validation": {
    "total_accruals_matches": boolean,
    "total_deductions_matches": boolean,
    "net_pay_matches": boolean,
    "irpf_matches": boolean,
    "ss_matches": boolean,
    "all_ok": boolean,
    "net_difference": número,
    "accruals_difference": número
  },

  "accounting_entry": {
    "can_generate": boolean,
    "blocked_reason": string | null,
    "lines": [
      {
        "cuenta": string,
        "descripcion": string,
        "debe": número,
        "haber": número,
        "origen": string,
        "confianza": "alta" | "media" | "baja",
        "pendiente": boolean,
        "pendiente_nota": string | null
      }
    ],
    "balanced": boolean,
    "debit_total": número,
    "credit_total": número,
    "ss_empresa_pending": boolean
  },

  "warnings": [string],
  "fields_needing_review": [string],
  "identity_conflicts": [string]
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [doc.file_url],
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string' },
          template_detected: { type: 'string' },
          confidence: { type: 'number' },
          processing_notes: { type: 'string' },
          company: { type: 'object' },
          employee: { type: 'object' },
          period: { type: 'object' },
          devengos: { type: 'array', items: { type: 'object' } },
          deducciones: { type: 'array', items: { type: 'object' } },
          totals: { type: 'object' },
          math_validation: { type: 'object' },
          accounting_entry: { type: 'object' },
          warnings: { type: 'array', items: { type: 'string' } },
          fields_needing_review: { type: 'array', items: { type: 'string' } },
          identity_conflicts: { type: 'array', items: { type: 'string' } },
        }
      }
    });

    if (!result) throw new Error('El LLM no devolvió resultado');
    // InvokeLLM wraps the response in a 'response' key when using response_json_schema
    const data = result.response || result;

    const conf = data.confidence || 0;
    const hasConflicts = (data.identity_conflicts || []).length > 0;
    const mathOk = data.math_validation?.all_ok !== false;
    const hasWarnings = (data.warnings || []).length > 0 || (data.fields_needing_review || []).length > 0;

    let ocr_status;
    if (hasConflicts) ocr_status = 'requiere_revision';
    else if (!mathOk) ocr_status = 'procesado_con_advertencias';
    else if (conf >= 80 && !hasWarnings) ocr_status = 'procesado_alta_confianza';
    else if (conf >= 50) ocr_status = 'procesado_con_advertencias';
    else ocr_status = 'requiere_revision';

    const totals = data.totals || {};
    const emp = data.employee || {};
    const comp = data.company || {};
    const per = data.period || {};

    // Update document — store unwrapped data so frontend can access fields directly
    await base44.asServiceRole.entities.LaborOcrDocument.update(doc.id, {
      document_type: data.document_type || doc.document_type,
      employee_name: emp.full_name || null,
      period_label: per.label || null,
      ocr_status,
      confidence_global: conf,
      extracted_fields: data,
      validation_status: 'pendiente',
    });

    // Payroll extraction
    if ((data.document_type || doc.document_type) === 'nomina') {
      const existing = await base44.asServiceRole.entities.PayrollExtraction.filter({ labor_ocr_document_id: doc.id });

      const extractionData = {
        labor_ocr_document_id: doc.id,
        company_id: doc.company_id,
        employee_name: emp.full_name,
        employee_tax_id: emp.tax_id,
        social_security_number: emp.naf,
        company_name: comp.name,
        company_tax_id: comp.tax_id,
        contribution_account_code: comp.ccc,
        professional_group: emp.professional_group,
        period_label: per.label,
        worked_days: per.worked_days,
        gross_salary: totals.total_accruals,
        total_accruals: totals.total_accruals,
        total_deductions: totals.total_deductions,
        net_pay: totals.net_pay,
        irpf_rate: totals.irpf_rate,
        irpf_amount: totals.irpf_amount,
        employee_ss_amount: totals.employee_ss_amount,
        employer_ss_amount: totals.employer_ss_amount,
        contribution_base_common: totals.contribution_base_cc,
        devengos: result.devengos || [],
        deducciones: result.deducciones || [],
        validation_warnings: result.warnings || [],
        confidence_global: conf,
      };

      if (existing[0]) {
        await base44.asServiceRole.entities.PayrollExtraction.update(existing[0].id, extractionData);
      } else {
        await base44.asServiceRole.entities.PayrollExtraction.create(extractionData);
      }

      // Accounting entry - only if LLM says it can generate
      const ae = data.accounting_entry;
      if (ae && ae.can_generate) {
        const existingEntry = await base44.asServiceRole.entities.LaborAccountingEntryProposal.filter({ labor_ocr_document_id: doc.id });
        const entryData = {
          labor_ocr_document_id: doc.id,
          batch_id: doc.batch_id,
          company_id: doc.company_id,
          document_type: 'nomina',
          employee_name: emp.full_name,
          period: per.label,
          status: 'propuesto',
          lines: (ae.lines || []).map(l => ({
            cuenta: l.cuenta,
            descripcion: l.descripcion,
            debe: l.debe || 0,
            haber: l.haber || 0,
            origen: l.origen || 'OCR',
            confianza: l.confianza || 'media',
            regla_aplicada: l.pendiente ? 'PENDIENTE' : l.origen,
            pendiente: l.pendiente || false,
            pendiente_nota: l.pendiente_nota || null,
          })),
          debit_total: ae.debit_total || 0,
          credit_total: ae.credit_total || 0,
          balanced: ae.balanced || false,
          warnings: [
            ...(ae.ss_empresa_pending ? ['La cuota de SS empresa no aparece en la nómina. Pendiente de validar con seguros sociales.'] : []),
            ...(!ae.balanced ? [`El asiento no cuadra. Diferencia: ${Math.abs((ae.debit_total||0) - (ae.credit_total||0)).toFixed(2)}€`] : []),
          ],
        };

        if (existingEntry[0]) {
          await base44.asServiceRole.entities.LaborAccountingEntryProposal.update(existingEntry[0].id, entryData);
        } else {
          await base44.asServiceRole.entities.LaborAccountingEntryProposal.create(entryData);
        }
      }
    } else if ((data.document_type || doc.document_type) === 'seguro_social') {
      const existing = await base44.asServiceRole.entities.SocialSecurityExtraction.filter({ labor_ocr_document_id: doc.id });
      const ssData = {
        labor_ocr_document_id: doc.id,
        company_id: doc.company_id,
        company_name: comp.name,
        company_tax_id: comp.tax_id,
        contribution_account_code: comp.ccc,
        settlement_period: per.label,
        total_to_pay: totals.total_to_pay,
        confidence_global: conf,
        validation_warnings: result.warnings || [],
      };
      if (existing[0]) {
        await base44.asServiceRole.entities.SocialSecurityExtraction.update(existing[0].id, ssData);
      } else {
        await base44.asServiceRole.entities.SocialSecurityExtraction.create(ssData);
      }
    }

    return Response.json({ success: true, ocr_status, confidence: conf, document_type: data.document_type });

  } catch (err) {
    console.error('OCR error for doc', doc.id, ':', err.message);
    await base44.asServiceRole.entities.LaborOcrDocument.update(doc.id, {
      ocr_status: 'error',
      notes: err?.message || 'Error durante análisis OCR',
    });
    return Response.json({ error: err.message }, { status: 500 });
  }
});