import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { companyId } = body;
    if (!companyId) return Response.json({ error: 'Falta companyId' }, { status: 400 });

    // 1. Fix fiscal profile
    const profiles = await base44.asServiceRole.entities.FiscalProfile.filter({ company_id: companyId, active: true });
    const profile = profiles?.[0];
    if (profile) {
      await base44.asServiceRole.entities.FiscalProfile.update(profile.id, {
        isPropertyLessor: false,
        isProfessionalWithRetention: false,
        subjectToIRPF: false,
        irpfEstimation: 'no_aplica',
        defaultWithholdingRate: 0,
      });
    }

    // 2. Load company + activity for prompt context
    const company = await base44.asServiceRole.entities.Company.get(companyId);
    const issuerName = company?.razon_social || company?.nombre_comercial || '';
    const issuerNif = company?.nif_cif || '';
    const activities = await base44.asServiceRole.entities.FiscalActivity.filter({ company_id: companyId, active: true });
    const activity = activities?.[0];

    // 3. Get all review_required income docs
    const docs = await base44.asServiceRole.entities.OcrInvoiceDocument.filter({
      company_id: companyId,
      documentType: 'income_invoice',
      status: 'review_required'
    }, '-uploadedAt', 200);

    const REOCRPT = `Analiza esta factura EMITIDA por ${issuerName} (NIF: ${issuerNif}) y extrae SOLO los datos del CLIENTE (destinatario).
El EMISOR es ${issuerName}, NIF ${issuerNif}. El CLIENTE es la OTRA parte.
Devuelve JSON con: cliente_nombre (string), cliente_nif (string, el NIF/CIF del cliente tal como aparece en la factura).`;

    const REOCR_SCHEMA = {
      type: 'object',
      properties: {
        cliente_nombre: { type: 'string' },
        cliente_nif: { type: 'string' },
      }
    };

    let fixed = 0;
    let reOcrCount = 0;

    // Process docs in batches for re-OCR
    const docsNeedingReOcr = [];

    for (const doc of docs) {
      if (!doc.extractedData) continue;
      let extracted;
      try { extracted = JSON.parse(doc.extractedData); } catch { continue; }

      let modified = false;

      // Check if NIF is missing - need re-OCR
      const needsReOcr = !extracted.cliente_nif || extracted.cliente_nif === 'null' || extracted.cliente_nif === '';
      if (needsReOcr && doc.fileStorageUrl) {
        docsNeedingReOcr.push({ doc, extracted });
      }

      // Ensure no retentions
      if (extracted.retencion_irpf && extracted.retencion_irpf !== 0) {
        extracted.retencion_irpf = 0; extracted.importe_retencion = 0; extracted.retencion_tipo = 'ninguna'; modified = true;
      }
      if (extracted.importe_retencion && extracted.importe_retencion !== 0) {
        extracted.importe_retencion = 0; extracted.retencion_tipo = 'ninguna'; extracted.retencion_irpf = 0; modified = true;
      }

      // Ensure no IGIC/IVA repercuted (comerciante minorista)
      if (extracted.tipo_iva && extracted.tipo_iva !== 0) { extracted.tipo_iva = 0; extracted.cuota_iva = 0; modified = true; }
      if (extracted.cuota_iva && extracted.cuota_iva !== 0) { extracted.cuota_iva = 0; modified = true; }

      // Set detected tax
      if (extracted.impuesto_detectado !== 'IGIC') { extracted.impuesto_detectado = 'IGIC'; modified = true; }

      // Add situacion_impuesto = sujeta_exenta for comerciante minorista
      if (extracted.situacion_impuesto !== 'sujeta_exenta') {
        extracted.situacion_impuesto = 'sujeta_exenta'; modified = true;
      }

      // Clean nulls
      if (extracted.factura_rectificada === 'null' || extracted.factura_rectificada === null) { extracted.factura_rectificada = ''; modified = true; }
      if (extracted.nif_vies === 'null' || extracted.nif_vies === null) { extracted.nif_vies = ''; modified = true; }

      if (modified && !needsReOcr) {
        await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
          extractedData: JSON.stringify(extracted),
        });
        fixed++;
      }
    }

    // Re-OCR docs with missing NIFs (batch with concurrency 3)
    const concurrency = 3;
    for (let i = 0; i < docsNeedingReOcr.length; i += concurrency) {
      const batch = docsNeedingReOcr.slice(i, i + concurrency);
      await Promise.all(batch.map(async ({ doc, extracted }) => {
        try {
          const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: REOCRPT,
            file_urls: [doc.fileStorageUrl],
            response_json_schema: REOCR_SCHEMA,
          });

          if (result?.cliente_nif && result.cliente_nif !== 'null') {
            extracted.cliente_nif = result.cliente_nif;
            reOcrCount++;
          }
          if (result?.cliente_nombre && result.cliente_nombre !== 'null') {
            // Only update if current name looks wrong (Carolina)
            const currentName = (extracted.cliente_nombre || '').toUpperCase();
            if (currentName.includes('CAROLINA') || currentName.includes(issuerName.toUpperCase())) {
              extracted.cliente_nombre = result.cliente_nombre;
            }
          }

          // Also apply all fixes
          extracted.retencion_irpf = 0;
          extracted.importe_retencion = 0;
          extracted.retencion_tipo = 'ninguna';
          extracted.tipo_iva = 0;
          extracted.cuota_iva = 0;
          extracted.impuesto_detectado = 'IGIC';
          extracted.situacion_impuesto = 'sujeta_exenta';

          await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
            extractedData: JSON.stringify(extracted),
          });
          fixed++;
        } catch (e) {
          console.error(`[fixOcrIncomeDocs] Re-OCR failed for ${doc.id}: ${e.message}`);
          // Still apply other fixes
          extracted.retencion_irpf = 0;
          extracted.importe_retencion = 0;
          extracted.retencion_tipo = 'ninguna';
          extracted.tipo_iva = 0;
          extracted.cuota_iva = 0;
          extracted.impuesto_detectado = 'IGIC';
          extracted.situacion_impuesto = 'sujeta_exenta';
          await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
            extractedData: JSON.stringify(extracted),
          });
          fixed++;
        }
      }));
    }

    return Response.json({
      success: true,
      totalDocs: docs.length,
      fixed,
      nifReOcr: reOcrCount,
      fiscalProfileFixed: !!profile,
    });
  } catch (error) {
    console.error('[fixOcrIncomeDocs] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});