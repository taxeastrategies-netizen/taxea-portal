import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const MONEY_EPSILON = 0.01;
const MAX_TEXT = 500;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_INVOICE = 25;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const asMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const cleanText = (value, max = MAX_TEXT) => String(value || '').trim().slice(0, max);
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isPrivateFileUri = (value) => /^private\/[A-Za-z0-9/_\-.]+$/.test(String(value || ''))
  && !String(value).includes('..');
const isSafeHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

function secureToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

async function getOwnedInvoice(base44, user, invoiceId, requestedCompanyId) {
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const companyId = requestedCompanyId || user.data?.company_id;
  if (!companyId) {
    throw Object.assign(new Error('Selecciona una empresa activa.'), { status: 403 });
  }
  if (!isAdmin && requestedCompanyId && requestedCompanyId !== user.data?.company_id) {
    throw Object.assign(new Error('La empresa indicada no coincide con la empresa activa.'), { status: 403 });
  }
  if (!invoiceId) throw Object.assign(new Error('invoice_id es obligatorio.'), { status: 400 });
  const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId).catch(() => null);
  if (!invoice) throw Object.assign(new Error('Factura no encontrada.'), { status: 404 });
  if (invoice.company_id !== companyId) {
    throw Object.assign(new Error('No puedes operar con facturas de otra empresa.'), { status: 403 });
  }
  return { invoice, companyId };
}

async function listPayments(base44, companyId, invoiceId) {
  return await base44.asServiceRole.entities.InvoicePayment.filter(
    { company_id: companyId, invoice_id: invoiceId },
    '-payment_date',
    500,
  );
}

async function refreshInvoicePaymentState(base44, invoice, companyId) {
  const payments = await listPayments(base44, companyId, invoice.id);
  const total = asMoney(Math.abs(Number(invoice.total_factura) || 0));
  // Conserva facturas históricas marcadas como cobradas/pagadas antes de existir
  // el nuevo registro detallado de pagos. No se reabre ninguna factura legado.
  const legacySettled = (payments || []).length === 0 && invoice.estado_cobro === 'cobrada';
  const paid = legacySettled
    ? total
    : asMoney((payments || []).reduce((sum, payment) => sum + Math.abs(Number(payment.amount) || 0), 0));
  const outstanding = asMoney(Math.max(0, total - paid));
  const estado = outstanding <= MONEY_EPSILON
    ? 'cobrada'
    : paid > MONEY_EPSILON
      ? 'parcial'
      : invoice.estado_cobro === 'vencida' ? 'vencida' : 'pendiente';
  const lastPayment = (payments || [])
    .slice()
    .sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')))[0];

  await base44.asServiceRole.entities.Invoice.update(invoice.id, {
    estado_cobro: estado,
    importe_pagado: paid,
    importe_pendiente: outstanding,
    ultimo_pago_at: lastPayment?.created_at || null,
  });
  return { payments, paid, outstanding, estado_cobro: estado };
}

async function recordTimeline(base44, data) {
  await base44.asServiceRole.entities.InvoiceTimelineEvent.create(data).catch(error => {
    console.warn('[invoiceOperations] timeline skipped:', error?.message || error);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, 80);
    const { invoice, companyId } = await getOwnedInvoice(base44, user, body.invoice_id, body.company_id);

    if (action === 'create_public_link') {
      if (invoice.anulada) {
        return Response.json({ error: 'No se puede publicar una factura anulada.' }, { status: 409 });
      }
      const tokenIsUsable = /^[a-f0-9]{64}$/i.test(invoice.public_token || '')
        && !invoice.public_token_revoked_at
        && (!invoice.public_token_expires_at || new Date(invoice.public_token_expires_at) > new Date());
      const token = tokenIsUsable ? invoice.public_token : secureToken();
      const expiresAt = tokenIsUsable && invoice.public_token_expires_at
        ? invoice.public_token_expires_at
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      if (!tokenIsUsable) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          public_token: token,
          public_token_expires_at: expiresAt,
          public_token_revoked_at: null,
        });
        await recordTimeline(base44, {
          invoice_id: invoice.id,
          company_id: companyId,
          event_type: 'enlace_publico_creado',
          event_label: 'Enlace público creado',
          event_detail: `Enlace seguro activo hasta ${expiresAt.slice(0, 10)}.`,
          created_at: new Date().toISOString(),
          created_by: user.full_name || user.email || 'Usuario',
          origin: 'manual',
        });
      }
      return Response.json({ ok: true, token, expires_at: expiresAt, created: !tokenIsUsable });
    }

    if (action === 'list_attachments') {
      const attachments = await base44.asServiceRole.entities.InvoiceAttachment.filter({
        company_id: companyId,
        invoice_id: invoice.id,
      }, '-uploaded_at', MAX_ATTACHMENTS_PER_INVOICE);
      const signed = await Promise.all((attachments || []).map(async attachment => {
        const signedResult = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: attachment.file_uri,
          expires_in: 900,
        }).catch(() => null);
        return { ...attachment, signed_url: signedResult?.signed_url || '' };
      }));
      return Response.json({ ok: true, attachments: signed });
    }

    if (action === 'set_primary_pdf') {
      if (invoice.anulada) return Response.json({ error: 'No se puede adjuntar un PDF a una factura anulada.' }, { status: 409 });
      if (invoice.archivo_url) return Response.json({ error: 'La factura ya tiene un PDF principal. No se ha sobrescrito.' }, { status: 409 });
      const fileUrl = cleanText(body.file_url, 1600);
      const sizeBytes = Math.round(Number(body.size_bytes) || 0);
      if (!isSafeHttpsUrl(fileUrl)) return Response.json({ error: 'La URL del PDF no es válida.' }, { status: 400 });
      if (cleanText(body.mime_type, 100).toLowerCase() !== 'application/pdf') return Response.json({ error: 'El documento principal debe ser PDF.' }, { status: 400 });
      if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) return Response.json({ error: 'El PDF debe ocupar entre 1 byte y 10 MB.' }, { status: 400 });
      await base44.asServiceRole.entities.Invoice.update(invoice.id, { archivo_url: fileUrl });
      await recordTimeline(base44, {
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: 'pdf_principal_adjuntado',
        event_label: 'PDF principal adjuntado',
        event_detail: cleanText(body.filename, 180) || 'Factura.pdf',
        created_at: new Date().toISOString(),
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
      return Response.json({ ok: true, file_url: fileUrl });
    }

    if (action === 'add_attachment') {
      if (invoice.anulada) return Response.json({ error: 'No se pueden añadir archivos a una factura anulada.' }, { status: 409 });
      const current = await base44.asServiceRole.entities.InvoiceAttachment.filter({
        company_id: companyId,
        invoice_id: invoice.id,
      }, '-uploaded_at', MAX_ATTACHMENTS_PER_INVOICE + 1);
      if ((current || []).length >= MAX_ATTACHMENTS_PER_INVOICE) {
        return Response.json({ error: `La factura ya tiene el máximo de ${MAX_ATTACHMENTS_PER_INVOICE} adjuntos.` }, { status: 409 });
      }
      const fileUri = cleanText(body.file_uri, 1000);
      const filename = cleanText(body.filename, 180).replace(/[\r\n]/g, '');
      const mimeType = cleanText(body.mime_type, 150).toLowerCase();
      const sizeBytes = Math.round(Number(body.size_bytes) || 0);
      if (!isPrivateFileUri(fileUri)) return Response.json({ error: 'La referencia del archivo no es válida.' }, { status: 400 });
      if (!filename || filename.includes('/') || filename.includes('\\')) return Response.json({ error: 'El nombre del archivo no es válido.' }, { status: 400 });
      if (!ALLOWED_ATTACHMENT_TYPES.has(mimeType)) return Response.json({ error: 'Este tipo de archivo no está permitido.' }, { status: 400 });
      if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) return Response.json({ error: 'El archivo debe ocupar entre 1 byte y 10 MB.' }, { status: 400 });
      const attachment = await base44.asServiceRole.entities.InvoiceAttachment.create({
        company_id: companyId,
        invoice_id: invoice.id,
        file_uri: fileUri,
        filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.full_name || user.email || 'Usuario',
      });
      await recordTimeline(base44, {
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: 'archivo_adjuntado',
        event_label: 'Archivo adjuntado',
        event_detail: filename,
        created_at: new Date().toISOString(),
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
      return Response.json({ ok: true, attachment });
    }

    if (action === 'remove_attachment') {
      const attachmentId = cleanText(body.attachment_id, 120);
      const attachment = attachmentId
        ? await base44.asServiceRole.entities.InvoiceAttachment.get(attachmentId).catch(() => null)
        : null;
      if (!attachment || attachment.company_id !== companyId || attachment.invoice_id !== invoice.id) {
        return Response.json({ error: 'Adjunto no encontrado en esta factura.' }, { status: 404 });
      }
      await base44.asServiceRole.entities.InvoiceAttachment.delete(attachment.id);
      await recordTimeline(base44, {
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: 'archivo_eliminado',
        event_label: 'Adjunto eliminado',
        event_detail: cleanText(attachment.filename, 180),
        created_at: new Date().toISOString(),
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
      return Response.json({ ok: true });
    }

    if (action === 'list_payments') {
      const state = await refreshInvoicePaymentState(base44, invoice, companyId);
      return Response.json({ ok: true, ...state });
    }

    if (action === 'add_payment') {
      if (invoice.anulada) return Response.json({ error: 'No se pueden registrar pagos en una factura anulada.' }, { status: 409 });
      const amount = asMoney(Math.abs(Number(body.amount)));
      if (!Number.isFinite(amount) || amount <= 0) {
        return Response.json({ error: 'Introduce un importe de pago válido.' }, { status: 400 });
      }
      const paymentDate = cleanText(body.payment_date, 10);
      if (!isIsoDate(paymentDate)) return Response.json({ error: 'La fecha de pago no es válida.' }, { status: 400 });
      const idempotencyKey = cleanText(body.idempotency_key, 100);
      if (!idempotencyKey) return Response.json({ error: 'Falta la clave de seguridad de la operación.' }, { status: 400 });

      const duplicate = await base44.asServiceRole.entities.InvoicePayment.filter({
        company_id: companyId,
        invoice_id: invoice.id,
        idempotency_key: idempotencyKey,
      }, '-created_at', 1);
      if (duplicate?.[0]) {
        const state = await refreshInvoicePaymentState(base44, invoice, companyId);
        return Response.json({ ok: true, duplicate: true, payment: duplicate[0], ...state });
      }

      const current = await refreshInvoicePaymentState(base44, invoice, companyId);
      if (amount - current.outstanding > MONEY_EPSILON) {
        return Response.json({
          error: `El pago supera el importe pendiente (${current.outstanding.toFixed(2)} EUR).`,
          outstanding: current.outstanding,
        }, { status: 409 });
      }
      const allowedMethods = ['transferencia', 'tarjeta', 'efectivo', 'domiciliacion', 'otro'];
      const method = allowedMethods.includes(body.method) ? body.method : 'transferencia';
      const payment = await base44.asServiceRole.entities.InvoicePayment.create({
        company_id: companyId,
        invoice_id: invoice.id,
        amount,
        currency: invoice.moneda || 'EUR',
        payment_date: paymentDate,
        method,
        reference: cleanText(body.reference, 160),
        notes: cleanText(body.notes),
        origin: 'manual',
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
        created_by: user.full_name || user.email || 'Usuario',
      });
      const state = await refreshInvoicePaymentState(base44, invoice, companyId);
      await recordTimeline(base44, {
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: invoice.tipo === 'recibida' ? 'pago_registrado' : 'cobro_registrado',
        event_label: invoice.tipo === 'recibida' ? 'Pago registrado' : 'Cobro registrado',
        event_detail: `${amount.toFixed(2)} ${invoice.moneda || 'EUR'} · ${method}${body.reference ? ` · Ref. ${cleanText(body.reference, 80)}` : ''}`,
        created_at: new Date().toISOString(),
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
      return Response.json({ ok: true, payment, ...state });
    }

    if (action === 'list_reconciliation_candidates') {
      const isCreditNote = Number(invoice.total_factura) < 0;
      const expectedType = invoice.tipo === 'recibida'
        ? (isCreditNote ? 'entrada' : 'salida')
        : (isCreditNote ? 'salida' : 'entrada');
      const transactions = await base44.asServiceRole.entities.BankTransaction.filter({
        company_id: companyId,
        tipo: expectedType,
      }, '-fecha_operacion', 500);
      const candidates = (transactions || [])
        .filter(tx => !tx.es_demo)
        .filter(tx => tx.estado_proveedor !== 'pending')
        .filter(tx => !tx.entidad_id || (tx.entidad_tipo === 'invoice' && tx.entidad_id === invoice.id))
        .filter(tx => !['descartada', 'duplicada', 'movimiento_interno'].includes(tx.estado_conciliacion))
        .map(tx => ({
          id: tx.id,
          fecha_operacion: tx.fecha_operacion,
          concepto: tx.concepto,
          importe: Math.abs(Number(tx.importe) || 0),
          tipo: tx.tipo,
          nombre_contraparte: tx.nombre_contraparte,
          referencia: tx.referencia,
          estado_conciliacion: tx.estado_conciliacion,
          already_linked: tx.entidad_id === invoice.id,
        }))
        .sort((a, b) => {
          const target = Math.abs(Number(invoice.total_factura) || 0);
          return Math.abs(a.importe - target) - Math.abs(b.importe - target);
        });
      const state = await refreshInvoicePaymentState(base44, invoice, companyId);
      return Response.json({ ok: true, candidates, ...state });
    }

    if (action === 'reconcile') {
      if (invoice.anulada) return Response.json({ error: 'No se puede conciliar una factura anulada.' }, { status: 409 });
      const transactionId = cleanText(body.bank_transaction_id, 120);
      if (!transactionId) return Response.json({ error: 'Selecciona un movimiento bancario.' }, { status: 400 });
      const transaction = await base44.asServiceRole.entities.BankTransaction.get(transactionId).catch(() => null);
      if (!transaction || transaction.company_id !== companyId) {
        return Response.json({ error: 'Movimiento bancario no encontrado en la empresa activa.' }, { status: 404 });
      }
      if (transaction.es_demo) return Response.json({ error: 'No se puede conciliar un movimiento de demostración.' }, { status: 409 });
      if (transaction.estado_proveedor === 'pending') return Response.json({ error: 'El movimiento aún está pendiente en el banco. Espera a que quede contabilizado.' }, { status: 409 });
      const isCreditNote = Number(invoice.total_factura) < 0;
      const expectedType = invoice.tipo === 'recibida'
        ? (isCreditNote ? 'entrada' : 'salida')
        : (isCreditNote ? 'salida' : 'entrada');
      if (transaction.tipo !== expectedType) {
        return Response.json({ error: `Esta factura requiere un movimiento de ${expectedType}.` }, { status: 409 });
      }
      if (transaction.entidad_id && !(transaction.entidad_tipo === 'invoice' && transaction.entidad_id === invoice.id)) {
        return Response.json({ error: 'El movimiento ya está conciliado con otro documento.' }, { status: 409 });
      }
      const previousPayment = await base44.asServiceRole.entities.InvoicePayment.filter({
        company_id: companyId,
        invoice_id: invoice.id,
        bank_transaction_id: transaction.id,
      }, '-created_at', 1);
      if (previousPayment?.[0]) {
        // Repara de forma idempotente una operación que hubiera guardado el pago
        // pero se hubiera interrumpido antes de enlazar el movimiento.
        await base44.asServiceRole.entities.BankTransaction.update(transaction.id, {
          estado_conciliacion: 'conciliada_manual',
          confianza_conciliacion: 'alta',
          entidad_tipo: 'invoice',
          entidad_id: invoice.id,
        });
        const state = await refreshInvoicePaymentState(base44, invoice, companyId);
        return Response.json({ ok: true, duplicate: true, payment: previousPayment[0], ...state });
      }
      const current = await refreshInvoicePaymentState(base44, invoice, companyId);
      const amount = asMoney(Math.abs(Number(transaction.importe) || 0));
      if (amount <= 0) return Response.json({ error: 'El movimiento no tiene un importe válido.' }, { status: 409 });
      if (amount - current.outstanding > MONEY_EPSILON) {
        return Response.json({
          error: `El movimiento (${amount.toFixed(2)} EUR) supera el pendiente (${current.outstanding.toFixed(2)} EUR). No se concilia automáticamente.`,
        }, { status: 409 });
      }
      const now = new Date().toISOString();
      const payment = await base44.asServiceRole.entities.InvoicePayment.create({
        company_id: companyId,
        invoice_id: invoice.id,
        amount,
        currency: transaction.moneda || invoice.moneda || 'EUR',
        payment_date: transaction.fecha_operacion,
        method: 'transferencia',
        reference: cleanText(transaction.referencia || transaction.concepto, 160),
        notes: 'Registrado mediante conciliación bancaria manual.',
        origin: 'bank_reconciliation',
        bank_transaction_id: transaction.id,
        idempotency_key: `bank:${transaction.id}`,
        created_at: now,
        created_by: user.full_name || user.email || 'Usuario',
      });
      await base44.asServiceRole.entities.BankTransaction.update(transaction.id, {
        estado_conciliacion: 'conciliada_manual',
        confianza_conciliacion: 'alta',
        entidad_tipo: 'invoice',
        entidad_id: invoice.id,
        contacto_id: transaction.contacto_id || null,
        notas: cleanText(`${transaction.notas ? `${transaction.notas}\n` : ''}Conciliado con factura ${invoice.numero_factura}.`, MAX_TEXT),
      });
      const state = await refreshInvoicePaymentState(base44, invoice, companyId);
      await recordTimeline(base44, {
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: 'conciliacion_bancaria',
        event_label: 'Factura conciliada',
        event_detail: `${amount.toFixed(2)} ${transaction.moneda || invoice.moneda || 'EUR'} · ${cleanText(transaction.concepto, 120)}`,
        created_at: now,
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
      return Response.json({ ok: true, payment, transaction_id: transaction.id, ...state });
    }

    return Response.json({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('[invoiceOperations]', error);
    return Response.json({ error: error?.message || 'Error interno.' }, { status: error?.status || 500 });
  }
});

