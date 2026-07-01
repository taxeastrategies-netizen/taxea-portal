import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Date helpers ──

function getCanaryToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Canary',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  let newMonth = month + n;
  let newYear = year + Math.floor(newMonth / 12);
  newMonth = ((newMonth % 12) + 12) % 12;
  const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, lastDay);
  return new Date(newYear, newMonth, newDay).toISOString().slice(0, 10);
}

function addYears(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear() + n;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const newDay = Math.min(day, lastDay);
  return new Date(year, month, newDay).toISOString().slice(0, 10);
}

function getTrimestre(dateStr) {
  const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
  return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
}

function calculateNextRun(template, currentDate) {
  const { frequency, interval, dayOfMonth } = template;
  const intv = Math.max(1, interval || 1);
  if (frequency === 'daily') return addDays(currentDate, intv);
  if (frequency === 'weekly') return addDays(currentDate, intv * 7);
  if (frequency === 'monthly') {
    if (dayOfMonth && dayOfMonth > 0) {
      const d = new Date(currentDate + 'T00:00:00');
      const lastDayThisMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const dayThisMonth = Math.min(dayOfMonth, lastDayThisMonth);
      const baseDate = new Date(d.getFullYear(), d.getMonth(), dayThisMonth).toISOString().slice(0, 10);
      return addMonths(baseDate, intv);
    }
    return addMonths(currentDate, intv);
  }
  if (frequency === 'yearly') return addYears(currentDate, intv);
  return addMonths(currentDate, 1);
}

function calculateDueDate(template, issueDate) {
  const { dueDateMode, dueDaysAfterIssue, dueDayOfMonth } = template;
  if (dueDateMode === 'same_day') return issueDate;
  if (dueDateMode === 'days_after') return addDays(issueDate, dueDaysAfterIssue || 30);
  if (dueDateMode === 'fixed_day') {
    const d = new Date(issueDate + 'T00:00:00');
    const day = dueDayOfMonth || 15;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const newDay = Math.min(day, lastDay);
    return new Date(d.getFullYear(), d.getMonth(), newDay).toISOString().slice(0, 10);
  }
  return issueDate;
}

function validateTemplate(t) {
  if (!t.concept || !t.concept.trim()) return { valid: false, message: 'Falta concepto' };
  if (!t.baseAmount || t.baseAmount <= 0) return { valid: false, message: 'Base imponible inválida' };
  if (!t.clientName || !t.clientName.trim()) return { valid: false, message: 'Falta nombre del cliente' };
  if (t.mode === 'auto_issue' && !t.clientNif) return { valid: false, message: 'Falta NIF/CIF del cliente (requerido para emisión automática)' };
  return { valid: true };
}

async function generateInvoiceNumber(base44, companyId) {
  const year = new Date().getFullYear();
  let maxNum = 0;
  let skip = 0;
  while (true) {
    let batch;
    try {
      batch = await base44.asServiceRole.entities.Invoice.filter({
        company_id: companyId,
        anio: year,
        tipo: 'emitida'
      }, '-numero_factura', 200, skip);
    } catch { break; }
    if (!batch || batch.length === 0) break;
    for (const inv of batch) {
      const match = (inv.numero_factura || '').match(/(\d+)\s*$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    }
    if (batch.length < 200) break;
    skip += 200;
  }
  const nextNum = maxNum + 1;
  return `F-${year}-${String(nextNum).padStart(3, '0')}`;
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';
    const today = getCanaryToday();

    let user = null;
    let isManual = false;
    try {
      user = await base44.auth.me();
      if (user) isManual = true;
    } catch { /* scheduled — no user */ }

    // Load active templates
    let templates = [];
    if (body.templateId) {
      const tmpl = await base44.asServiceRole.entities.RecurringInvoiceTemplate.get(body.templateId);
      if (tmpl) templates = [tmpl];
    } else {
      templates = await base44.asServiceRole.entities.RecurringInvoiceTemplate.filter({ status: 'active' });
    }

    const results = {
      status: 'ok',
      preview: [],
      generated: 0,
      skipped: 0,
      errors: 0,
      drafts: 0,
      generatedInvoiceNumber: null,
    };

    for (const tmpl of templates) {
      if (tmpl.status === 'paused' || tmpl.status === 'finished') continue;
      if (tmpl.endDate && tmpl.endDate < today) {
        await base44.asServiceRole.entities.RecurringInvoiceTemplate.update(tmpl.id, { status: 'finished' });
        continue;
      }

      let runDate = tmpl.nextRunDate || tmpl.startDate;
      if (!runDate) continue;

      const runType = body.runType || 'scheduled';
      const triggeredByUserId = user?.id || '';
      const triggeredByEmail = user?.email || '';

      // Process all missed periods up to today (catch-up)
      while (runDate <= today) {
        if (tmpl.endDate && runDate > tmpl.endDate) break;

        const periodEnd = calculateNextRun(tmpl, runDate);
        const periodKey = `${tmpl.id}_${runDate}_${periodEnd}`;

        // Idempotency check — search for existing invoice with this periodKey
        const existing = await base44.asServiceRole.entities.Invoice.filter({
          recurringInvoiceTemplateId: tmpl.id,
          recurringPeriodKey: periodKey
        });
        if (existing && existing.length > 0) {
          results.skipped++;
          if (action === 'preview') {
            results.preview.push({
              templateId: tmpl.id,
              clientName: tmpl.clientName,
              concept: tmpl.concept,
              frequency: tmpl.frequency,
              interval: tmpl.interval,
              dayOfWeek: tmpl.dayOfWeek,
              dayOfMonth: tmpl.dayOfMonth,
              monthOfYear: tmpl.monthOfYear,
              periodStart: runDate,
              periodEnd,
              status: 'skipped_duplicate'
            });
          }
          // Still create a run record for audit
          await base44.asServiceRole.entities.RecurringInvoiceRun.create({
            recurringInvoiceTemplateId: tmpl.id,
            ownerAccountId: tmpl.ownerAccountId,
            runType,
            status: 'skipped_duplicate',
            runAt: new Date().toISOString(),
            triggeredByUserId,
            triggeredByEmail,
            periodStart: runDate,
            periodEnd,
            periodKey,
            skippedReason: 'Invoice already exists for this period'
          });

          // Advance
          runDate = periodEnd;
          continue;
        }

        // Validate
        const validation = validateTemplate(tmpl);
        if (!validation.valid) {
          results.errors++;
          await base44.asServiceRole.entities.RecurringInvoiceRun.create({
            recurringInvoiceTemplateId: tmpl.id,
            ownerAccountId: tmpl.ownerAccountId,
            runType,
            status: 'error',
            runAt: new Date().toISOString(),
            triggeredByUserId,
            triggeredByEmail,
            periodStart: runDate,
            periodEnd,
            periodKey,
            safeErrorMessage: validation.message
          });

          if (action === 'preview') {
            results.preview.push({
              templateId: tmpl.id,
              clientName: tmpl.clientName,
              concept: tmpl.concept,
              frequency: tmpl.frequency,
              interval: tmpl.interval,
              dayOfWeek: tmpl.dayOfWeek,
              dayOfMonth: tmpl.dayOfMonth,
              monthOfYear: tmpl.monthOfYear,
              periodStart: runDate,
              periodEnd,
              status: 'error',
              error: validation.message
            });
          }

          // Don't advance — leave at this date so user can fix
          break;
        }

        if (action === 'preview') {
          results.preview.push({
            templateId: tmpl.id,
            clientName: tmpl.clientName,
            concept: tmpl.concept,
            frequency: tmpl.frequency,
            interval: tmpl.interval,
            dayOfWeek: tmpl.dayOfWeek,
            dayOfMonth: tmpl.dayOfMonth,
            monthOfYear: tmpl.monthOfYear,
            periodStart: runDate,
            periodEnd,
            status: 'pending',
            baseAmount: tmpl.baseAmount,
            totalAmount: tmpl.totalAmount
          });
          runDate = periodEnd;
          continue;
        }

        // Generate
        const invoiceNumber = await generateInvoiceNumber(base44, tmpl.ownerAccountId);
        const dueDate = calculateDueDate(tmpl, runDate);
        const base = parseFloat(tmpl.baseAmount) || 0;
        const taxRate = parseFloat(tmpl.taxRate) || 0;
        const retentionRate = parseFloat(tmpl.retentionRate) || 0;
        const cuota = base * taxRate / 100;
        const retencion = base * retentionRate / 100;
        const total = base + cuota - retencion;

        const invoiceData = {
          company_id: tmpl.ownerAccountId,
          numero_factura: invoiceNumber,
          tipo: 'emitida',
          fecha_emision: runDate,
          fecha_vencimiento: dueDate,
          cliente_nombre: tmpl.clientName,
          cliente_nif: tmpl.clientNif,
          cliente_email: tmpl.clientEmail,
          cliente_direccion: tmpl.clientAddress,
          concepto: tmpl.concept,
          base_imponible: base,
          tipo_iva: taxRate,
          cuota_iva: cuota,
          retencion_irpf: retentionRate,
          total_factura: total,
          moneda: tmpl.currency || 'EUR',
          trimestre: getTrimestre(runDate),
          anio: new Date(runDate + 'T00:00:00').getFullYear(),
          estado_cobro: 'pendiente',
          estado_contable: 'pendiente',
          forma_pago: tmpl.formaPago || 'Transferencia bancaria',
          coletilla_fiscal: tmpl.coletillaFiscal || '',
          subido_por: triggeredByEmail || 'sistema',
          isRecurringGenerated: true,
          recurringInvoiceTemplateId: tmpl.id,
          recurringPeriodStart: runDate,
          recurringPeriodEnd: periodEnd,
          recurringPeriodKey: periodKey,
          origin: 'recurring_invoice'
        };

        const invoice = await base44.asServiceRole.entities.Invoice.create(invoiceData);

        // Create run record
        await base44.asServiceRole.entities.RecurringInvoiceRun.create({
          recurringInvoiceTemplateId: tmpl.id,
          ownerAccountId: tmpl.ownerAccountId,
          runType,
          status: tmpl.mode === 'auto_issue' ? 'generated' : 'draft_created',
          runAt: new Date().toISOString(),
          triggeredByUserId,
          triggeredByEmail,
          periodStart: runDate,
          periodEnd,
          periodKey,
          generatedInvoiceId: invoice.id,
          generatedInvoiceNumber: invoiceNumber
        });

        // Timeline event
        await base44.asServiceRole.entities.TimelineEvent.create({
          company_id: tmpl.ownerAccountId,
          tipo: 'factura_recurrente',
          titulo: `Factura recurrente generada: ${invoiceNumber}`,
          descripcion: `${tmpl.clientName} · ${tmpl.concept} · ${total.toFixed(2)} €`,
          color: 'verde',
          usuario_email: triggeredByEmail || 'sistema',
          automatico: true,
          visibilidad: 'ambos'
        }).catch(() => {});

        if (tmpl.mode === 'auto_issue') {
          results.generated++;
        } else {
          results.drafts++;
        }
        if (!results.generatedInvoiceNumber) {
          results.generatedInvoiceNumber = invoiceNumber;
        }

        // Advance
        runDate = periodEnd;
      }

      // Update template
      const updateData = {
        nextRunDate: runDate,
        lastRunDate: new Date().toISOString(),
        totalGenerated: (tmpl.totalGenerated || 0) + results.generated + results.drafts
      };
      if (tmpl.endDate && runDate > tmpl.endDate) {
        updateData.status = 'finished';
      }
      await base44.asServiceRole.entities.RecurringInvoiceTemplate.update(tmpl.id, updateData);
    }

    return Response.json(results);
  } catch (error) {
    console.error('[generateRecurringInvoices]', error);
    return Response.json({ error: error.message, status: 'error' }, { status: 500 });
  }
});