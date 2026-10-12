import { loadOcrDocuments } from './loadOcrDocuments.mjs';
const parsed=(raw,fallback)=>{try{return JSON.parse(raw || JSON.stringify(fallback));}catch{return fallback;}};
export function invoiceSourceData(invoice) {
  return {numero_factura:invoice.numero_factura,fecha:invoice.fecha_emision,fecha_emision:invoice.fecha_emision,
    fecha_recepcion:invoice.fecha_recepcion,fecha_vencimiento:invoice.fecha_vencimiento,
    proveedor:invoice.proveedor_nombre, nif_proveedor:invoice.proveedor_nif,
    cliente:invoice.cliente_nombre,cliente_nombre:invoice.cliente_nombre,nif_cliente:invoice.cliente_nif,cliente_nif:invoice.cliente_nif,
    concepto:invoice.concepto,base_imponible:invoice.base_imponible,tipo_impuesto:invoice.tipo_iva,cuota_impuesto:invoice.cuota_iva,
    tipo_iva:invoice.tipo_iva,cuota_iva:invoice.cuota_iva,total:invoice.total_factura,total_factura:invoice.total_factura,
    retencion_irpf:invoice.retencion_irpf,importe_retencion:invoice.importe_retencion,retencion_tipo:invoice.retencion_tipo,
    categoria_sugerida:invoice.categoria_gasto,es_rectificativa:invoice.es_rectificativa,factura_rectificada:invoice.factura_rectificada,
    fiscal_activity_id:invoice.fiscal_activity_id,cuenta_contable_manual:invoice.revenue_expense_account_code,
    fiscal_criteria:{...(invoice.fiscal_advisor_decision?.criteria || {}),
      ...(invoice.recc_metadata?{recc:parsed(invoice.recc_metadata,{})}:{}),
      ...(invoice.tax_breakdown?{taxBreakdown:parsed(invoice.tax_breakdown,[])}:{}),
      ...(invoice.fiscal_treatment?{operationType:invoice.fiscal_treatment}:{}),
      ...(invoice.fiscal_regime?{regime:invoice.fiscal_regime}:{}),
      ...(invoice.indirect_tax_kind?{taxKind:invoice.indirect_tax_kind}:{}),
      ...(invoice.fiscal_exemption_key?{exemptionKey:invoice.fiscal_exemption_key}:{}),
      ...(invoice.fiscal_legal_basis?{legalBasis:invoice.fiscal_legal_basis}:{}),
      ...(invoice.self_assessed_tax_rate?{selfAssessmentRate:invoice.self_assessed_tax_rate}:{}),
    }};
}
export async function loadOcrWorkspace(client, companyId, documentType) {
  const docs=await loadOcrDocuments(client.entities.OcrInvoiceDocument,{company_id:companyId,documentType});
  const pending=[];
  for(let page=0;page<200;page++){
    const response=await client.functions.invoke('invoiceOperations',{action:'list_source_pending',company_id:companyId,
      type:documentType==='income_invoice'?'emitida':'recibida',page});
    const result=response?.data??response;
    if(!result?.ok) throw new Error(result?.error || 'No se pudieron recuperar documentos incompletos.');
    pending.push(...result.invoices);
    if(!result.hasMore) break;
    if(page===199) throw new Error('Demasiados documentos incompletos: solicita revisión segmentada.');
  }
  const byId=new Map(pending.map(row=>[row.id,row]));
  const byOcrId=new Map(pending.filter(row=>row.ocr_document_id).map(row=>[row.ocr_document_id,row]));
  const mapped=docs.map(doc=>({...doc,invoiceSource:byId.get(doc.linkedInvoiceId) || byOcrId.get(doc.id)}));
  const docIds=new Set(docs.map(doc=>doc.id)), linkedIds=new Set(docs.map(doc=>doc.linkedInvoiceId).filter(Boolean));
  for(const invoice of pending){
    if(linkedIds.has(invoice.id) || (invoice.ocr_document_id && docIds.has(invoice.ocr_document_id))) continue;
    // Los huérfanos heredados se muestran sin crear ni modificar documentos en la carga.
    mapped.push({id:'invoice:'+invoice.id,invoiceOnly:true,invoiceSource:invoice,company_id:companyId,documentType,
      status:'review_required',originalFileName:'Completar factura '+invoice.numero_factura,fileStorageUrl:invoice.archivo_url || '',
      uploadedAt:invoice.created_date,safeErrorMessage:invoice.source_last_error || 'Factura ya guardada: completar su check aquí no creará otra.',
      extractedData:JSON.stringify(invoiceSourceData(invoice))});
  }
  return mapped;
}
async function approveOnce(client, companyId, doc, form, invoiceType) {
  const response=doc?.invoiceOnly
    ? await client.functions.invoke('invoiceOperations',{action:'confirm_source_invoice',company_id:companyId,
      invoice_id:doc.invoiceSource.id,criteria:{...(form.fiscal_criteria || {}),activityId:form.fiscal_activity_id || undefined,accountCode:form.cuenta_contable_manual || undefined}})
    : await client.functions.invoke('approveOcrDocument',{docId:doc.id,form,invoiceType,
      extractedData:typeof doc.extractedData==='string'?JSON.parse(doc.extractedData || '{}'):doc.extractedData,confirm_fiscal_review:true});
  const result=response?.data??response;
  if(!result?.success || result.review_required) throw new Error(result?.error || result?.message || 'La factura todavía no está contabilizada.');
  return result;
}

export async function approveWorkspaceDocument(client,companyId,doc,form,invoiceType) {
  for(let attempt=0;attempt<3;attempt++){
    try{return await approveOnce(client,companyId,doc,form,invoiceType);}
    catch(error){
      const status=Number(error?.response?.status || error.status);
      if(![429,502,503,504].includes(status) || attempt===2)throw error;
      await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
  }
}

// A bulk click only confirms each document's persisted OCR proposal. It never
// applies the first document's fiscal treatment or account to its neighbours.
export async function approveStoredOcrBatch(client,companyId,documents,ids,mapForm,invoiceType,options={}) {
  const selected=[...new Set(ids || [])];
  const byId=new Map((documents || []).map(doc=>[doc.id,doc]));
  const activeActivities=(options.activities || []).filter(row=>row.active!==false);
  let done=0,failed=0,stopped=false;
  const issues=[];
  for(const id of selected) {
    if(options.shouldStop?.()) { stopped=true; break; }
    const doc=byId.get(id);
    try {
      if(!doc || doc.company_id!==companyId || !['review_required','validated'].includes(doc.status))
        throw new Error('El documento ya no está pendiente en esta empresa. Actualiza la cola.');
      const source=doc.invoiceSource ? invoiceSourceData(doc.invoiceSource) : parsed(doc.extractedData,null);
      if(!source || typeof source!=='object') throw new Error('Faltan los datos OCR guardados. Revísalo individualmente.');
      const form=mapForm(source);
      if(!form.fiscal_activity_id && activeActivities.length===1) form.fiscal_activity_id=activeActivities[0].id;
      if(!form.fiscal_activity_id && activeActivities.length>1)
        throw new Error('Hay varias actividades fiscales y este OCR no tiene una asignada. Revísalo individualmente.');
      await approveWorkspaceDocument(client,companyId,doc,form,invoiceType);
      done++;
      options.onSuccess?.(doc);
    } catch(error) {
      failed++;
      const reason=error?.response?.data?.error || error?.message || 'No se pudo aprobar el documento.';
      issues.push({id,reason});
      options.onFailure?.(doc,reason);
      if(Number(error?.response?.status || error?.status)===409 && /otra aprobaci[oó]n|siendo confirmado/i.test(reason)) stopped=true;
    }
    options.onProgress?.({done,failed,total:selected.length,remaining:selected.length-done-failed,stopped,issues});
    if(stopped) break;
  }
  return {done,failed,total:selected.length,remaining:selected.length-done-failed,stopped,issues};
}
