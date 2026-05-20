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

    const prompt = `Eres un experto en nóminas y seguros sociales españoles. Analiza este documento y extrae los datos.

Devuelve SOLO un JSON válido con esta estructura:
{
  "document_type": "nomina" o "seguro_social" o "desconocido",
  "confidence": número 0-100,
  "employee_name": string o null,
  "employee_tax_id": string o null,
  "social_security_number": string o null,
  "company_name": string o null,
  "company_tax_id": string o null,
  "period_label": string o null,
  "worked_days": número o null,
  "gross_salary": número o null,
  "total_accruals": número o null,
  "total_deductions": número o null,
  "net_pay": número o null,
  "irpf_rate": número o null,
  "irpf_amount": número o null,
  "employee_ss_amount": número o null,
  "employer_ss_amount": número o null,
  "contribution_base_common": número o null,
  "devengos": [{"descripcion": string, "importe": número}],
  "deducciones": [{"descripcion": string, "importe": número}],
  "total_to_pay": número o null,
  "settlement_period": string o null,
  "warnings": []
}
Si no encuentras un dato, pon null. No inventes importes.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [doc.file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string' },
          confidence: { type: 'number' },
          employee_name: { type: 'string' },
          employee_tax_id: { type: 'string' },
          social_security_number: { type: 'string' },
          company_name: { type: 'string' },
          company_tax_id: { type: 'string' },
          period_label: { type: 'string' },
          worked_days: { type: 'number' },
          gross_salary: { type: 'number' },
          total_accruals: { type: 'number' },
          total_deductions: { type: 'number' },
          net_pay: { type: 'number' },
          irpf_rate: { type: 'number' },
          irpf_amount: { type: 'number' },
          employee_ss_amount: { type: 'number' },
          employer_ss_amount: { type: 'number' },
          contribution_base_common: { type: 'number' },
          devengos: { type: 'array', items: { type: 'object' } },
          deducciones: { type: 'array', items: { type: 'object' } },
          total_to_pay: { type: 'number' },
          settlement_period: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      }
    });

    const conf = result?.confidence || 0;
    const ocr_status = conf >= 80 ? 'procesado_alta_confianza' : conf >= 50 ? 'procesado_con_advertencias' : 'requiere_revision';

    await base44.asServiceRole.entities.LaborOcrDocument.update(doc.id, {
      document_type: result?.document_type || doc.document_type,
      employee_name: result?.employee_name || null,
      period_label: result?.period_label || null,
      ocr_status,
      confidence_global: conf,
      extracted_fields: result,
      validation_status: 'pendiente',
    });

    // Create extraction record
    const isNomina = (result?.document_type || doc.document_type) === 'nomina';

    if (isNomina) {
      const existing = await base44.asServiceRole.entities.PayrollExtraction.filter({ labor_ocr_document_id: doc.id });
      const extractionData = {
        labor_ocr_document_id: doc.id,
        company_id: doc.company_id,
        employee_name: result?.employee_name,
        employee_tax_id: result?.employee_tax_id,
        social_security_number: result?.social_security_number,
        company_name: result?.company_name,
        company_tax_id: result?.company_tax_id,
        period_label: result?.period_label,
        worked_days: result?.worked_days,
        gross_salary: result?.gross_salary,
        total_accruals: result?.total_accruals,
        total_deductions: result?.total_deductions,
        net_pay: result?.net_pay,
        irpf_rate: result?.irpf_rate,
        irpf_amount: result?.irpf_amount,
        employee_ss_amount: result?.employee_ss_amount,
        employer_ss_amount: result?.employer_ss_amount,
        contribution_base_common: result?.contribution_base_common,
        devengos: result?.devengos || [],
        deducciones: result?.deducciones || [],
        validation_warnings: result?.warnings || [],
        confidence_global: conf,
      };
      if (existing[0]) {
        await base44.asServiceRole.entities.PayrollExtraction.update(existing[0].id, extractionData);
      } else {
        await base44.asServiceRole.entities.PayrollExtraction.create(extractionData);
      }

      // Accounting entry
      const gross = result?.total_accruals || result?.gross_salary || 0;
      const irpf = result?.irpf_amount || 0;
      const ssW = result?.employee_ss_amount || 0;
      const net = result?.net_pay || 0;
      const debitTotal = gross;
      const creditTotal = irpf + ssW + net;
      const balanced = Math.abs(debitTotal - creditTotal) < 1;

      const existingEntry = await base44.asServiceRole.entities.LaborAccountingEntryProposal.filter({ labor_ocr_document_id: doc.id });
      const entryData = {
        labor_ocr_document_id: doc.id,
        batch_id: doc.batch_id,
        company_id: doc.company_id,
        document_type: 'nomina',
        employee_name: result?.employee_name,
        period: result?.period_label,
        status: 'propuesto',
        lines: [
          { cuenta: '640', descripcion: 'Sueldos y salarios', debe: gross, haber: 0, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 640' },
          { cuenta: '4751', descripcion: 'HP Acreedora IRPF', debe: 0, haber: irpf, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 4751' },
          { cuenta: '476', descripcion: 'SS Organismos Acreedores', debe: 0, haber: ssW, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 476' },
          { cuenta: '465', descripcion: 'Remuneraciones Pendientes', debe: 0, haber: net, origen: 'OCR', confianza: conf >= 70 ? 'alta' : 'media', regla_aplicada: 'Estándar 465' },
        ],
        debit_total: debitTotal,
        credit_total: creditTotal,
        balanced,
        warnings: !balanced ? ['El asiento no cuadra. Revisa los importes.'] : [],
      };

      if (existingEntry[0]) {
        await base44.asServiceRole.entities.LaborAccountingEntryProposal.update(existingEntry[0].id, entryData);
      } else {
        await base44.asServiceRole.entities.LaborAccountingEntryProposal.create(entryData);
      }
    } else if ((result?.document_type || doc.document_type) === 'seguro_social') {
      const existing = await base44.asServiceRole.entities.SocialSecurityExtraction.filter({ labor_ocr_document_id: doc.id });
      const ssData = {
        labor_ocr_document_id: doc.id,
        company_id: doc.company_id,
        company_name: result?.company_name,
        company_tax_id: result?.company_tax_id,
        settlement_period: result?.settlement_period || result?.period_label,
        total_to_pay: result?.total_to_pay,
        confidence_global: conf,
        validation_warnings: result?.warnings || [],
      };
      if (existing[0]) {
        await base44.asServiceRole.entities.SocialSecurityExtraction.update(existing[0].id, ssData);
      } else {
        await base44.asServiceRole.entities.SocialSecurityExtraction.create(ssData);
      }
    }

    return Response.json({ success: true, ocr_status, confidence: conf });

  } catch (err) {
    console.error('OCR error:', err);
    await base44.asServiceRole.entities.LaborOcrDocument.update(doc.id, {
      ocr_status: 'error',
      notes: err?.message || 'Error durante análisis OCR',
    });
    return Response.json({ error: err.message }, { status: 500 });
  }
});