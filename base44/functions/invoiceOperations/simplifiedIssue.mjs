function reject(message, status = 422) {
  throw Object.assign(new Error(message), { status });
}

function realDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function prepareSimplifiedIssue(input, actor, company, now = new Date()) {
  if (!['admin', 'super_admin'].includes(actor?.role)) reject('Se requiere un administrador para esta emisión simplificada.', 403);
  if (input.tipo !== 'emitida' || input.es_rectificativa || input.numero_factura) reject('La factura simplificada nueva tiene numeración automática.');
  if (input.cliente_nif || input.cliente_email || input.cliente_direccion || input.cliente_telefono) reject('Esta vía simplificada solo admite el nombre del destinatario particular.');
  const customer = String(input.cliente_nombre || '').trim();
  const concept = String(input.concepto || '').trim();
  const sourceId = String(input.source_record_id || '').trim();
  if (!customer || customer.length > 160 || !concept || concept.length > 200 || !sourceId || sourceId.length > 150) reject('Falta destinatario, descripción o referencia del origen.');
  const issueDate = input.fecha_emision;
  const operationDate = input.fecha_operacion;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (issueDate !== today || !realDate(operationDate) || operationDate > issueDate || operationDate.slice(0, 4) !== issueDate.slice(0, 4)) {
    reject('Indica la fecha real de expedición y la operación efectiva de este mismo ejercicio.');
  }
  const issuerNif = String(company?.nif_cif || '').toUpperCase().replace(/[\s.-]/g, '');
  if (company?.tipo_impuesto !== 'iva' || !/^[A-Z0-9]{9}$/.test(issuerNif) || !String(company?.razon_social || '').trim() || !String(company?.direccion_fiscal || '').trim()) {
    reject('Faltan los datos fiscales del emisor de IVA o no coinciden con el tipo de factura.');
  }
  const gross = Number(input.total_factura);
  const cents = Math.round(gross * 100);
  if (!Number.isFinite(gross) || cents <= 0 || cents > 40000 || Math.abs(gross * 100 - cents) > 0.000001) {
    reject('El importe simplificado con IVA incluido debe ser positivo y no exceder de 400 €.');
  }
  const baseCents = Math.round(cents * 100 / 121);
  const base = baseCents / 100;
  const quota = (cents - baseCents) / 100;
  return {
    invoice: {
      tipo: 'emitida', fiscal_document_type: 'F2', fecha_emision: issueDate, fecha_operacion: operationDate,
      cliente_nombre: customer, concepto: concept, moneda: 'EUR', indirect_tax_kind: 'iva',
      base_imponible: base, tipo_iva: 21, cuota_iva: quota, total_factura: cents / 100,
      retencion_irpf: 0, importe_retencion: 0, tipo_recargo: 0, cuota_recargo: 0,
      origin: 'manual', source_system: 'taxea_simplified_issue', source_record_id: sourceId,
    },
    criteria: {
      operationDate, taxKind: 'iva', regime: 'general', operationType: 'subject_taxed',
      manualOverrideReason: 'Emisión simplificada: IVA ordinario al 21 % incluido en el importe de la operación confirmada.',
    },
  };
}
