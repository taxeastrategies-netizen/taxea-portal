import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { companyId } = body;
    if (!companyId) return Response.json({ error: 'Falta companyId' }, { status: 400 });

    // 1. Fix fiscal profile: remove isPropertyLessor and subjectToIRPF for comerciante minorista
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

    // 2. Load company to get issuer info
    const company = await base44.asServiceRole.entities.Company.get(companyId);
    const issuerName = company?.razon_social || company?.nombre_comercial || '';
    const issuerNif = company?.nif_cif || '';

    // 3. Get all review_required income docs
    const docs = await base44.asServiceRole.entities.OcrInvoiceDocument.filter({
      company_id: companyId,
      documentType: 'income_invoice',
      status: 'review_required'
    }, '-uploadedAt', 200);

    let fixed = 0;
    let clientCorrected = 0;

    for (const doc of docs) {
      if (!doc.extractedData) continue;
      let extracted;
      try { extracted = JSON.parse(doc.extractedData); } catch { continue; }

      let modified = false;

      // Parse client name from filename: YYYY-MM_EMITIDA_DD-MM-YYYY_CLIENT-NAME_AMOUNT.pdf
      const fname = doc.originalFileName || '';
      const baseName = fname.replace(/\.pdf$/i, '');
      const parts = baseName.split('_');
      // parts: [0]=YYYY-MM, [1]=EMITIDA, [2]=DD-MM-YYYY, [3...n-1]=CLIENT_NAME, [n]=AMOUNT
      let parsedClient = '';
      if (parts.length >= 4) {
        const nameParts = parts.slice(3, -1);
        parsedClient = nameParts.join(' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        // Fix common abbreviations: S.L.U -> S.L.U., S.A -> S.A.
        parsedClient = parsedClient.replace(/\bS\.?L\.?U\.?$/i, 'S.L.U.');
        // If starts with lowercase, capitalize first letter
        if (parsedClient && parsedClient[0] === parsedClient[0].toLowerCase()) {
          parsedClient = parsedClient[0].toUpperCase() + parsedClient.slice(1);
        }
      }

      // Check if current client is wrong (matches issuer/Carolina)
      const currentClient = (extracted.cliente_nombre || '').toUpperCase().trim();
      const currentNif = (extracted.cliente_nif || '').toUpperCase().trim();
      const isIssuerAsClient = currentClient.includes('CAROLINA') ||
        currentClient.includes('MARTIN HERNANDEZ') ||
        currentNif === '07871758P' ||
        currentClient === issuerName.toUpperCase();

      if (isIssuerAsClient && parsedClient) {
        extracted.cliente_nombre = parsedClient;
        extracted.cliente_nif = null;
        modified = true;
        clientCorrected++;
      }

      // Ensure no retentions (comerciante minorista canarias - no retentions)
      if (extracted.retencion_irpf && extracted.retencion_irpf !== 0) {
        extracted.retencion_irpf = 0;
        extracted.importe_retencion = 0;
        extracted.retencion_tipo = 'ninguna';
        modified = true;
      }
      if (extracted.importe_retencion && extracted.importe_retencion !== 0) {
        extracted.importe_retencion = 0;
        extracted.retencion_tipo = 'ninguna';
        extracted.retencion_irpf = 0;
        modified = true;
      }

      // Ensure no IGIC/IVA repercuted (comerciante minorista doesn't pass indirect tax)
      if (extracted.tipo_iva && extracted.tipo_iva !== 0) {
        extracted.tipo_iva = 0;
        extracted.cuota_iva = 0;
        modified = true;
      }
      if (extracted.cuota_iva && extracted.cuota_iva !== 0) {
        extracted.cuota_iva = 0;
        modified = true;
      }

      // Set detected tax to IGIC (Canarias)
      if (extracted.impuesto_detectado !== 'IGIC') {
        extracted.impuesto_detectado = 'IGIC';
        modified = true;
      }

      // Fix factura_rectificada null strings
      if (extracted.factura_rectificada === 'null' || extracted.factura_rectificada === null) {
        extracted.factura_rectificada = '';
        modified = true;
      }
      if (extracted.nif_vies === 'null' || extracted.nif_vies === null) {
        extracted.nif_vies = '';
        modified = true;
      }

      if (modified) {
        await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
          extractedData: JSON.stringify(extracted),
        });
        fixed++;
      }
    }

    return Response.json({
      success: true,
      totalDocs: docs.length,
      fixed,
      clientCorrected,
      fiscalProfileFixed: !!profile,
    });
  } catch (error) {
    console.error('[fixOcrIncomeDocs] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});