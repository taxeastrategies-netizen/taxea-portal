import {recurringCallerIdentity} from './recurringCallerIdentity.mjs';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.31';
import {recurringCriteria,RecurringDomainError} from './recurringIssuance.mjs';
import {generateRecurringBatch} from './recurringGeneration.mjs';
const publicTemplate=({generation_lock_token,generation_lock_started_at,...template})=>template;
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    const identity=await recurringCallerIdentity(user,id=>base44.asServiceRole.entities.User.get(id));
    if(!identity.allowed)return Response.json({error:'Identidad no habilitada.'},{status:403});
    const {isService,isAdminUser,freshUser}=identity;

    // La sesión puede traer permisos caducados: resolver la empresa desde la base de datos.
    let activeCompanyId = '';
    if (!isService) {
      activeCompanyId = freshUser?.company_id || freshUser?.data?.company_id || '';
      if (!isAdminUser && activeCompanyId) {
        const company = await base44.asServiceRole.entities.Company.get(activeCompanyId).catch(() => null);
        const email = String(user.email || '').trim().toLowerCase();
        const allowedEmails = Array.isArray(company?.usuarios_autorizados)
          ? company.usuarios_autorizados.map(value => String(value || '').trim().toLowerCase())
          : [];
        if (!company || !email || (String(company.owner_email || '').trim().toLowerCase() !== email
          && !allowedEmails.includes(email))) {
          return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
        }
      }
    }

    // ── Gestión de plantillas verificada en servidor (sin depender de la sesión) ──
    if (action === 'create_template' || action === 'list_templates' || action === 'set_template_status') {
      if (isService) return Response.json({ error: 'No autorizado' }, { status: 401 });

      if (action === 'create_template') {
        const t = body.template || {};
        if (!t.ownerAccountId || t.ownerAccountId !== activeCompanyId) {
          return Response.json({ error: 'La plantilla debe pertenecer a la empresa activa.' }, { status: 403 });
        }
        if (!t.frequency || !t.startDate || !t.nextRunDate || !t.concept || !(Number(t.baseAmount) > 0)) {
          return Response.json({ error: 'Faltan datos obligatorios de la plantilla (concepto, base imponible o fechas).' }, { status: 400 });
        }
        const created = await base44.asServiceRole.entities.RecurringInvoiceTemplate.create({
          ownerAccountId: t.ownerAccountId,
          createdByUserId: user.id,
          createdByEmail: user.email,
          status: 'active',
          mode: t.mode || 'auto_issue',
          frequency: t.frequency,
          interval: t.interval || 1,
          startDate: t.startDate,
          endDate: t.endDate || null,
          nextRunDate: t.nextRunDate,
          dayOfWeek: t.dayOfWeek,
          dayOfMonth: t.dayOfMonth,
          monthOfYear: t.monthOfYear,
          dueDateMode: t.dueDateMode || 'days_after',
          dueDaysAfterIssue: t.dueDaysAfterIssue,
          dueDayOfMonth: t.dueDayOfMonth,
          invoiceType: 'emitida',
          concept: t.concept,
          baseAmount: Number(t.baseAmount) || 0,
          taxRate: Number(t.taxRate) || 0,
          taxType: t.taxType || 'iva',
          fiscalActivityId: t.fiscalActivityId || '',
          fiscalCriteria: recurringCriteria(t.fiscalCriteria || {}),
          retentionRate: Number(t.retentionRate) || 0,
          totalAmount: Number(t.totalAmount) || 0,
          currency: t.currency || 'EUR',
          sendEmailAutomatically: false,
          clientName: t.clientName,
          clientNif: t.clientNif,
          clientAddress: t.clientAddress,
          clientEmail: t.clientEmail,
          formaPago: t.formaPago,
          coletillaFiscal: t.coletillaFiscal || '',
          totalGenerated: 0,
        });
        return Response.json({ ok: true, template: publicTemplate(created) });
      }

      if (action === 'list_templates') {
        const companyId = String(body.companyId || activeCompanyId);
        if (!companyId) return Response.json({ error: 'Falta empresa' }, { status: 400 });
        if (!isAdminUser && companyId !== activeCompanyId) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        const [tmpls, rns] = await Promise.all([
          base44.asServiceRole.entities.RecurringInvoiceTemplate.filter({ ownerAccountId: companyId }, '-created_date'),
          base44.asServiceRole.entities.RecurringInvoiceRun.filter({ ownerAccountId: companyId }, '-created_date', 200),
        ]);
        return Response.json({ ok: true, templates: (tmpls || []).map(publicTemplate), runs: rns || [] });
      }

      const tmpl = await base44.asServiceRole.entities.RecurringInvoiceTemplate.get(body.templateId);
      if (!tmpl) return Response.json({ error: 'Plantilla no encontrada' }, { status: 404 });
      if (!isAdminUser && tmpl.ownerAccountId !== activeCompanyId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if(!['active','paused','finished'].includes(body.status))return Response.json({error:'Selecciona un estado válido.'},{status:400});
      const updated = await base44.asServiceRole.entities.RecurringInvoiceTemplate.update(tmpl.id, { status: body.status });
      return Response.json({ ok: true, template: publicTemplate(updated) });
    }

    return Response.json(await generateRecurringBatch({base44,user,identity,activeCompanyId,body}));
  }catch(error){
    if(error instanceof RecurringDomainError)return Response.json({error:error.message,status:'error'},{status:error.status});
    console.error('[generateRecurringInvoices]',{code:'RECURRING_UNAVAILABLE',status:Number(error?.response?.status||error?.status||500)});
    return Response.json({error:'No se pudo completar la operación de facturación recurrente. Reintenta o contacta con Taxea.',code:'RECURRING_UNAVAILABLE',status:'error'},{status:500});
  }
});
