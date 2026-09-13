import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { buildFinancialSummary, reconcileFinancialSources } from './financialSourceTruth.js';

const clean = value => String(value ?? '').trim();
const roleOf = user => clean(user?.role || user?.data?.role).toLowerCase();

async function authorizeCompany(svc, user, companyId) {
  const company = await svc.entities.Company.get(companyId).catch(() => null);
  if (!company) throw Object.assign(new Error('Empresa no encontrada.'), { status: 404 });
  const email = clean(user?.email).toLowerCase();
  const authorized = Array.isArray(company.usuarios_autorizados)
    ? company.usuarios_autorizados.map(value => clean(value).toLowerCase())
    : [];
  const allowed = ['admin', 'super_admin'].includes(roleOf(user))
    || clean(user?.data?.company_id || user?.company_id) === companyId
    || (email && clean(company.owner_email).toLowerCase() === email)
    || (email && authorized.includes(email));
  if (!allowed) throw Object.assign(new Error('No tienes permiso para consultar esta empresa.'), { status: 403 });
  return company;
}

async function fetchAll(entity, query = {}, sort = '-created_date', max = 100000) {
  const rows = [];
  const pageSize = 5000;
  let offset = 0;
  while (rows.length < max) {
    const page = await entity.filter(query, sort, Math.min(pageSize, max - rows.length), offset);
    if (!page?.length) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }
  if (rows.length >= max) throw new Error(`El volumen supera el limite de seguridad de ${max} registros. Acota el ejercicio.`);
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, anio } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id es obligatorio' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    await authorizeCompany(svc, user, company_id);

    const requestedYear = anio === undefined || anio === null || anio === '' ? null : Number(anio);
    if (requestedYear !== null && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) {
      return Response.json({ error: 'El ejercicio solicitado no es válido.' }, { status: 400 });
    }
    const filter = { company_id };

    // Fetch with service role to bypass RLS issues with stale user tokens
    const [rawInvoices, rawExpenses] = await Promise.all([
      fetchAll(svc.entities.Invoice, filter, '-fecha_emision'),
      fetchAll(svc.entities.Expense, filter, '-fecha'),
    ]);

    const belongsToYear = (row, dateFields) => {
      if (requestedYear === null) return true;
      const explicitYear = Number(row?.anio);
      if (Number.isInteger(explicitYear)) return explicitYear === requestedYear;
      const date = dateFields.map(field => clean(row?.[field])).find(Boolean);
      return Number(String(date || '').slice(0, 4)) === requestedYear;
    };
    const invs = (rawInvoices || []).filter(row => belongsToYear(row, ['fecha_emision', 'fecha_operacion', 'created_date']));
    const exps = (rawExpenses || []).filter(row => belongsToYear(row, ['fecha', 'created_date']));
    const reconciled = reconcileFinancialSources(invs, exps);
    const coreSummary = buildFinancialSummary(invs, exps);
    const activeInvs = reconciled.invoices.filter(invoice => !invoice.anulada);
    const emitidas = activeInvs.filter(invoice => invoice.tipo !== 'recibida');
    const recibidas = activeInvs.filter(invoice => invoice.tipo === 'recibida');
    const now = new Date();
    const facturasVencidas = emitidas.filter(i =>
      i.fecha_vencimiento && new Date(i.fecha_vencimiento) < now &&
      !['cobrada'].includes(i.estado_cobro)
    );

    return Response.json({
      invoices: reconciled.invoices,
      expenses: reconciled.expenses,
      source_truth: {
        ...reconciled.sourceTruth,
        duplicate_links: reconciled.duplicateLinks,
        review_candidates: reconciled.reviewCandidates,
      },
      count: {
        invoices: reconciled.invoices.length,
        expenses: reconciled.expenses.length,
        raw_expenses: exps.length,
      },
      summary: {
        totalIngresos: coreSummary.total_ingresos,
        totalGastos: coreSummary.total_gastos,
        resultado: coreSummary.resultado,
        baseIngresos: coreSummary.base_ingresos,
        baseGastos: coreSummary.base_gastos,
        ivaRepercutido: coreSummary.iva_repercutido,
        ivaSoportado: coreSummary.iva_soportado,
        ivaNeto: coreSummary.iva_repercutido - coreSummary.iva_soportado,
        cobrosPendientes: coreSummary.cobros_pendientes,
        pagosPendientes: coreSummary.pagos_pendientes,
        facturasVencidas: facturasVencidas.length,
        facturasPendientesContabilizar: activeInvs.filter(i => i.estado_contable === 'pendiente').length,
        numFacturasEmitidas: emitidas.length,
        numFacturasRecibidas: recibidas.length,
        numGastos: reconciled.expenses.filter(expense => !expense.anulada && expense.tipo !== 'ingreso').length,
        numAnuladas: invs.filter(i => i.anulada).length,
        excludeAnulada: true,
        generatedAt: now.toISOString(),
      }
    });

  } catch (error) {
    console.error('[getCompanyFinancials] Error:', error.message);
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
});
