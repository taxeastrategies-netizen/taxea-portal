import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const clean = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => clean(value).toLowerCase();
const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const REVIEW_ROLES = new Set(['admin', 'super_admin', 'advisor', 'asesor']);
const GLOBAL_ROLES = new Set(['admin', 'super_admin']);
const OPEN_FISCAL_STATES = new Set(['detectado', 'en_revision', 'pendiente_cliente']);
const READY_INVOICE_STATES = new Set(['contabilizada', 'revisada']);
const READY_DRAFT_STATES = new Set(['revisado', 'aprobado']);
const READY_PERIOD_STATES = new Set(['revisado', 'listo_presentar', 'presentado', 'no_aplica']);
const READY_OBLIGATION_STATES = new Set(['revisado', 'listo_presentar', 'presentado', 'domiciliado', 'pagado', 'finalizado', 'no_aplica']);

function roleOf(user: any) { return lower(user?.role); }
function isReviewer(user: any) { return REVIEW_ROLES.has(roleOf(user)); }
function isoDate(value: unknown) { return clean(value).slice(0, 10); }
function yearOf(value: unknown) { return Number(isoDate(value).slice(0, 4)) || 0; }
function daysUntil(value: unknown) {
  const target = new Date(isoDate(value) + 'T00:00:00Z').getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - Date.now()) / 86400000);
}
function companyName(company: any) {
  return clean(company?.nombre_comercial || company?.razon_social || company?.name || company?.owner_email || company?.id);
}
function accountEmail(client: any) { return lower(client?.email); }
function companyOwner(company: any) { return lower(company?.owner_email); }

async function listAll(entity: any, filter: any = null, sort = '-created_date', maximum = 5000) {
  const rows: any[] = [];
  const pageSize = Math.min(500, maximum);
  for (let skip = 0; skip < maximum; skip += pageSize) {
    let page: any[] = [];
    try {
      page = filter == null
        ? await entity.list(sort, pageSize, skip)
        : await entity.filter(filter, sort, pageSize, skip);
    } catch {
      return rows;
    }
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows.slice(0, maximum);
}

function explicitlyAssigned(user: any, company: any) {
  const email = lower(user?.email);
  if (!email) return false;
  if (companyOwner(company) === email) return true;
  const authorized = Array.isArray(company?.usuarios_autorizados) ? company.usuarios_autorizados.map(lower) : [];
  return authorized.includes(email);
}

async function accessContext(svc: any, user: any) {
  if (!isReviewer(user)) throw Object.assign(new Error('La bandeja multiempresa está reservada a asesoría y administración.'), { status: 403 });
  const [companies, clients] = await Promise.all([
    listAll(svc.entities.Company, null, '-updated_date', 5000),
    listAll(svc.entities.ClientAccount, null, '-updated_date', 5000),
  ]);
  const clientByEmail = new Map(clients.map((item: any) => [accountEmail(item), item]));
  const visible = GLOBAL_ROLES.has(roleOf(user))
    ? companies
    : companies.filter((company: any) => explicitlyAssigned(user, company));
  return { companies: visible.filter((company: any) => company?.activa !== false), clients, clientByEmail };
}

function pushAlert(alerts: any[], companyId: string, input: any) {
  alerts.push({
    id: input.id || [companyId, input.category, input.sourceType, input.sourceId].map(clean).join(':'),
    companyId,
    severity: input.severity || 'medium',
    category: input.category || 'general',
    title: input.title,
    detail: input.detail || '',
    sourceType: input.sourceType || '',
    sourceId: input.sourceId || '',
    detectedAt: input.detectedAt || new Date().toISOString(),
    deepLink: input.deepLink || '/tax-accounting/dashboard',
  });
}

async function companyWorkload(svc: any, company: any, client: any, year: number) {
  const companyId = company.id;
  const [profiles, invoices, entries, bankTransactions, drafts, periods, obligations, fiscalErrors, configurations] = await Promise.all([
    listAll(svc.entities.FiscalProfile, { company_id: companyId }, '-reviewedAt', 50),
    listAll(svc.entities.Invoice, { company_id: companyId }, '-fecha_emision', 5000),
    listAll(svc.entities.JournalEntry, { companyId }, '-date', 5000),
    listAll(svc.entities.BankTransaction, { company_id: companyId }, '-fecha_operacion', 5000),
    listAll(svc.entities.TaxDraft, { companyId, ejercicio: year }, '-created_date', 2000),
    listAll(svc.entities.TaxPeriod, { companyId, ejercicio: year }, '-created_date', 2000),
    listAll(svc.entities.TaxObligation, { company_id: companyId, anio: year }, 'fecha_limite_presentacion', 2000),
    listAll(svc.entities.FiscalError, { company_id: companyId }, '-created_date', 2000),
    listAll(svc.entities.AccountingConfiguration, { companyId }, '-updated_date', 20),
  ]);
  const activeInvoices = invoices.filter((row: any) => !row.anulada && (!year || Number(row.anio || yearOf(row.fecha_emision)) === year));
  const yearEntries = entries.filter((row: any) => !year || Number(row.ejercicio || yearOf(row.date)) === year);
  const yearBank = bankTransactions.filter((row: any) => !year || yearOf(row.fecha_operacion) === year);
  const profile = profiles.find((row: any) => row.active !== false) || profiles[0] || null;
  const configuration = configurations[0] || null;
  const alerts: any[] = [];

  if (!profile) pushAlert(alerts, companyId, { severity: 'critical', category: 'fiscal_profile', title: 'Perfil fiscal sin configurar', detail: 'La empresa no tiene una fuente fiscal maestra activa.', sourceType: 'FiscalProfile', deepLink: '/tax-accounting/impuestos?tab=configuracion' });
  else if (profile.profileStatus !== 'validado_asesor') pushAlert(alerts, companyId, { severity: 'high', category: 'fiscal_profile', title: 'Perfil fiscal pendiente de validar', detail: 'Debe revisarse antes de cerrar modelos.', sourceType: 'FiscalProfile', sourceId: profile.id, detectedAt: profile.updated_date || profile.reviewedAt, deepLink: '/tax-accounting/impuestos?tab=configuracion' });

  for (const invoice of activeInvoices) {
    if (!READY_INVOICE_STATES.has(clean(invoice.estado_contable))) pushAlert(alerts, companyId, { severity: 'high', category: 'accounting', title: 'Factura pendiente de contabilizar', detail: [invoice.numero_factura, invoice.cliente_nombre || invoice.proveedor_nombre].filter(Boolean).join(' · '), sourceType: 'Invoice', sourceId: invoice.id, detectedAt: invoice.updated_date || invoice.created_date, deepLink: '/tax-accounting/facturas' });
    if (!invoice.fiscal_treatment || invoice.fiscal_review_status !== 'validado') pushAlert(alerts, companyId, { severity: 'high', category: 'fiscal_treatment', title: 'Factura sin tratamiento fiscal validado', detail: invoice.numero_factura || 'Factura sin número', sourceType: 'Invoice', sourceId: invoice.id, detectedAt: invoice.updated_date || invoice.created_date, deepLink: '/tax-accounting/facturas' });
  }

  for (const entry of yearEntries) {
    if (entry.status !== 'anulado' && (entry.isBalanced !== true || ['borrador', 'pendiente_revision'].includes(entry.status))) pushAlert(alerts, companyId, { severity: entry.isBalanced === false ? 'critical' : 'medium', category: 'accounting', title: entry.isBalanced === false ? 'Asiento descuadrado' : 'Asiento pendiente de revisión', detail: [entry.entryNumber, entry.description].filter(Boolean).join(' · '), sourceType: 'JournalEntry', sourceId: entry.id, detectedAt: entry.updated_date || entry.created_date, deepLink: '/tax-accounting/contabilidad' });
  }

  for (const transaction of yearBank) {
    const pending = ['sin_conciliar', 'sugerida_ia', 'revisar'].includes(transaction.estado_conciliacion);
    const suspense = clean(transaction.accounting_account_code).startsWith('555');
    if (pending || suspense) pushAlert(alerts, companyId, { severity: suspense ? 'high' : 'medium', category: 'bank', title: suspense ? 'Movimiento pendiente en 555' : 'Movimiento bancario sin conciliar', detail: [isoDate(transaction.fecha_operacion), transaction.concepto, money(transaction.importe).toFixed(2) + ' EUR'].filter(Boolean).join(' · '), sourceType: 'BankTransaction', sourceId: transaction.id, detectedAt: transaction.updated_date || transaction.importado_at, deepLink: '/tax-accounting/contabilidad' });
  }

  for (const draft of drafts) if (!READY_DRAFT_STATES.has(draft.estado)) pushAlert(alerts, companyId, { severity: 'medium', category: 'tax_model', title: `Borrador ${draft.modeloCodigo} pendiente`, detail: `${draft.periodo} ${draft.ejercicio} · ${draft.estado || 'borrador'}`, sourceType: 'TaxDraft', sourceId: draft.id, detectedAt: draft.updated_date || draft.created_date, deepLink: '/tax-accounting/impuestos?tab=borradores' });
  for (const period of periods) if (!READY_PERIOD_STATES.has(period.estado)) pushAlert(alerts, companyId, { severity: period.estado === 'rechazado' ? 'critical' : 'medium', category: 'tax_model', title: `Período ${period.modeloCodigo} por completar`, detail: `${period.periodo} ${period.ejercicio} · ${period.estado || 'sin datos'}`, sourceType: 'TaxPeriod', sourceId: period.id, detectedAt: period.updated_date || period.created_date, deepLink: '/tax-accounting/impuestos' });
  for (const obligation of obligations) {
    if (!READY_OBLIGATION_STATES.has(obligation.estado)) pushAlert(alerts, companyId, { severity: 'medium', category: 'deadline', title: `Obligación ${obligation.modelo_codigo || obligation.modelo || ''} pendiente`, detail: `${obligation.periodo || obligation.trimestre || ''} · ${obligation.estado || 'pendiente'}`, sourceType: 'TaxObligation', sourceId: obligation.id, detectedAt: obligation.updated_date || obligation.created_date, deepLink: '/tax-accounting/obligaciones' });
    const deadline = obligation.fecha_limite_presentacion || obligation.fecha_limite;
    const remaining = daysUntil(deadline);
    if (!READY_OBLIGATION_STATES.has(obligation.estado) && remaining != null && remaining >= 0 && remaining <= 30) pushAlert(alerts, companyId, { severity: remaining <= 7 ? 'critical' : 'high', category: 'deadline', title: `Vencimiento en ${remaining} día(s)`, detail: `${obligation.modelo_codigo || obligation.modelo || 'Obligación'} · ${isoDate(deadline)}`, sourceType: 'TaxObligation', sourceId: obligation.id, detectedAt: obligation.updated_date || obligation.created_date, deepLink: '/tax-accounting/obligaciones' });
  }
  for (const issue of fiscalErrors.filter((row: any) => OPEN_FISCAL_STATES.has(row.estado))) pushAlert(alerts, companyId, { severity: issue.severidad === 'critica' ? 'critical' : issue.severidad === 'alta' ? 'high' : 'medium', category: 'incident', title: issue.tipo || 'Incidencia fiscal', detail: issue.descripcion || issue.accion_recomendada || '', sourceType: issue.entidad_tipo || 'FiscalError', sourceId: issue.entidad_id || issue.id, detectedAt: issue.updated_date || issue.created_date, deepLink: '/tax-accounting/impuestos?tab=errores' });
  if (!configuration || configuration.frameworkReviewStatus !== 'validated') pushAlert(alerts, companyId, { severity: 'medium', category: 'configuration', title: 'Configuración contable pendiente', detail: 'Revisa marco PGC, ejercicio y cuentas por defecto.', sourceType: 'AccountingConfiguration', sourceId: configuration?.id || '', detectedAt: configuration?.updated_date, deepLink: '/tax-accounting/contabilidad' });

  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  alerts.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0) || clean(b.detectedAt).localeCompare(clean(a.detectedAt)));
  const counts = {
    critical: alerts.filter(item => item.severity === 'critical').length,
    high: alerts.filter(item => item.severity === 'high').length,
    medium: alerts.filter(item => item.severity === 'medium').length,
    pendingAccounting: alerts.filter(item => item.category === 'accounting').length,
    suspense555: alerts.filter(item => item.title.includes('555')).length,
    invoicesWithoutTax: alerts.filter(item => item.category === 'fiscal_treatment').length,
    pendingModels: alerts.filter(item => item.category === 'tax_model' || item.category === 'deadline').length,
    incidents: alerts.filter(item => item.category === 'incident').length,
  };
  const score = counts.critical * 100 + counts.high * 10 + counts.medium;
  return {
    company: { id: company.id, name: companyName(company), taxId: clean(company.nif_cif), ownerEmail: clean(company.owner_email), active: company.activa !== false },
    client: client ? { id: client.id, name: clean(client.displayName || client.legalName), email: clean(client.email), internalOwner: clean(client.internalOwner), accessStatus: clean(client.accessStatus) } : null,
    profile: profile ? { id: profile.id, status: profile.profileStatus, territory: profile.mainTerritory, tax: profile.indirectTaxDefault, version: Number(profile.version || 0), effectiveFrom: profile.effectiveFrom || '' } : null,
    counts, score, alerts, updatedAt: new Date().toISOString(),
  };
}

function node(type: string, item: any, extra: any = {}) {
  if (!item) return null;
  const id = item.id;
  const definitions: any = {
    Invoice: { label: `Factura ${clean(item.numero_factura) || id}`, subtitle: clean(item.cliente_nombre || item.proveedor_nombre || item.concepto), amount: money(item.total_factura), date: item.fecha_emision, status: item.estado_contable, deepLink: '/tax-accounting/facturas' },
    InvoiceTaxLine: { label: `Línea fiscal ${item.lineNumber || ''}`, subtitle: [item.taxKind, item.operationType || item.regime].filter(Boolean).join(' · '), amount: money(item.quota), date: item.operationDate, status: item.reviewStatus, deepLink: '/tax-accounting/facturas' },
    JournalEntry: { label: `Asiento ${clean(item.entryNumber) || id}`, subtitle: clean(item.description), amount: money(item.totalDebit), date: item.date, status: item.status, deepLink: '/tax-accounting/contabilidad' },
    JournalEntryLine: { label: `Apunte ${clean(item.accountCode)}`, subtitle: clean(item.accountName || item.description), amount: money(item.debit || item.credit), date: item.entryDate, status: item.entryStatus, deepLink: '/tax-accounting/contabilidad' },
    InvoicePayment: { label: `Pago ${clean(item.reference) || id}`, subtitle: clean(item.method), amount: money(item.amount), date: item.payment_date, status: item.operation_status || 'committed', deepLink: '/tax-accounting/facturas' },
    BankTransaction: { label: clean(item.concepto) || 'Movimiento bancario', subtitle: clean(item.nombre_contraparte || item.referencia), amount: money(item.importe), date: item.fecha_operacion, status: item.estado_conciliacion, deepLink: '/finance/treasury' },
  };
  return { id: `${type}:${id}`, entityId: id, type, ...(definitions[type] || {}), ...extra };
}

async function buildTrace(svc: any, companyId: string, entityType: string, entityId: string) {
  const entities: any = {
    Invoice: svc.entities.Invoice, InvoiceTaxLine: svc.entities.InvoiceTaxLine, JournalEntry: svc.entities.JournalEntry,
    JournalEntryLine: svc.entities.JournalEntryLine, InvoicePayment: svc.entities.InvoicePayment, BankTransaction: svc.entities.BankTransaction,
  };
  if (!entities[entityType]) throw Object.assign(new Error('Tipo de entidad no trazable.'), { status: 400 });
  const root = await entities[entityType].get(entityId).catch(() => null);
  const rootCompany = root?.company_id || root?.companyId;
  if (!root || rootCompany !== companyId) throw Object.assign(new Error('Registro no encontrado en esta empresa.'), { status: 404 });

  let invoiceId = entityType === 'Invoice' ? root.id : clean(root.invoice_id || root.invoiceId || (root.entidad_tipo === 'Invoice' ? root.entidad_id : ''));
  let entryId = entityType === 'JournalEntry' ? root.id : clean(root.journal_entry_id || root.journalEntryId);
  let transactionId = entityType === 'BankTransaction' ? root.id : clean(root.bank_transaction_id || root.bankTransactionId);
  if (!invoiceId && entryId) {
    const direct = await listAll(svc.entities.Invoice, { company_id: companyId, linked_journal_entry_id: entryId }, '-fecha_emision', 20);
    invoiceId = direct[0]?.id || '';
  }
  if (!entryId && invoiceId) {
    const invoice = await svc.entities.Invoice.get(invoiceId).catch(() => null);
    entryId = clean(invoice?.linked_journal_entry_id);
  }

  const [invoice, taxLines, payments, entry, entryLines, linkedTransactions] = await Promise.all([
    invoiceId ? svc.entities.Invoice.get(invoiceId).catch(() => null) : null,
    invoiceId ? listAll(svc.entities.InvoiceTaxLine, { companyId, invoiceId }, 'lineNumber', 500) : [],
    invoiceId ? listAll(svc.entities.InvoicePayment, { company_id: companyId, invoice_id: invoiceId }, 'payment_date', 500) : [],
    entryId ? svc.entities.JournalEntry.get(entryId).catch(() => null) : null,
    entryId ? listAll(svc.entities.JournalEntryLine, { companyId, journalEntryId: entryId }, 'lineNumber', 1000) : [],
    listAll(svc.entities.BankTransaction, { company_id: companyId }, '-fecha_operacion', 5000),
  ]);
  const paymentTransactionIds = new Set((payments || []).map((item: any) => clean(item.bank_transaction_id)).filter(Boolean));
  if (transactionId) paymentTransactionIds.add(transactionId);
  const bankTransactions = linkedTransactions.filter((item: any) =>
    paymentTransactionIds.has(item.id) || item.journal_entry_id === entryId || (invoiceId && item.entidad_tipo === 'Invoice' && item.entidad_id === invoiceId)
  );
  const nodes = [
    node('Invoice', invoice), ...taxLines.map((item: any) => node('InvoiceTaxLine', item)),
    node('JournalEntry', entry), ...entryLines.map((item: any) => node('JournalEntryLine', item)),
    ...payments.map((item: any) => node('InvoicePayment', item)), ...bankTransactions.map((item: any) => node('BankTransaction', item)),
  ].filter(Boolean);
  if (!nodes.find((item: any) => item.id === `${entityType}:${entityId}`)) nodes.unshift(node(entityType, root));
  const edges: any[] = [];
  const connect = (from: string, to: string, relation: string) => { if (nodes.some((item: any) => item.id === from) && nodes.some((item: any) => item.id === to)) edges.push({ from, to, relation }); };
  for (const line of taxLines) connect(`Invoice:${invoiceId}`, `InvoiceTaxLine:${line.id}`, 'tributa mediante');
  if (invoice && entry) connect(`Invoice:${invoiceId}`, `JournalEntry:${entry.id}`, 'contabiliza en');
  for (const line of entryLines) connect(`JournalEntry:${entryId}`, `JournalEntryLine:${line.id}`, 'contiene');
  for (const payment of payments) connect(`Invoice:${invoiceId}`, `InvoicePayment:${payment.id}`, 'se liquida con');
  for (const payment of payments) if (payment.bank_transaction_id) connect(`InvoicePayment:${payment.id}`, `BankTransaction:${payment.bank_transaction_id}`, 'conciliado con');
  for (const transaction of bankTransactions) if (transaction.journal_entry_id) connect(`BankTransaction:${transaction.id}`, `JournalEntry:${transaction.journal_entry_id}`, 'genera o concilia');
  return { root: `${entityType}:${entityId}`, nodes, edges, complete: nodes.length > 0, generatedAt: new Date().toISOString() };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || 'overview');
    const svc = base44.asServiceRole;

    if (action === 'self_test') {
      const testUser = { email: 'advisor@test.invalid', full_name: 'Asesor Prueba', role: 'advisor' };
      const checks = {
        reviewerRole: isReviewer(testUser),
        normalUserDenied: !isReviewer({ role: 'user' }),
        assignedByCompany: explicitlyAssigned(testUser, { owner_email: 'x@test.invalid', usuarios_autorizados: ['advisor@test.invalid'] }),
        portfolioNameAloneDenied: !explicitlyAssigned(testUser, { owner_email: 'client@test.invalid' }),
        unrelatedDenied: !explicitlyAssigned(testUser, { owner_email: 'other@test.invalid', usuarios_autorizados: [] }),
      };
      return Response.json({ ok: Object.values(checks).every(Boolean), checks });
    }

    if (action === 'trace') {
      const companyId = clean(body.companyId);
      const company = await svc.entities.Company.get(companyId).catch(() => null);
      if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
      const role = roleOf(user);
      const ownCompany = clean(user?.data?.company_id || user?.company_id) === companyId;
      const owner = companyOwner(company) === lower(user.email);
      const authorized = Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.map(lower).includes(lower(user.email));
      const reviewerAssigned = ['advisor', 'asesor'].includes(role) && (owner || authorized);
      const clientAssigned = !['advisor', 'asesor'].includes(role) && (ownCompany || owner || authorized);
      if (!GLOBAL_ROLES.has(role) && !reviewerAssigned && !clientAssigned) return Response.json({ error: 'Registro no encontrado en tu empresa.' }, { status: 404 });
      return Response.json({ ok: true, trace: await buildTrace(svc, companyId, clean(body.entityType), clean(body.entityId)) });
    }

    const context = await accessContext(svc, user);

    if (action === 'saved_views') {
      const rows = await listAll(svc.entities.AdvisorSavedView, { advisor_email: lower(user.email) }, '-updated_at', 100);
      return Response.json({ ok: true, rows });
    }
    if (action === 'save_view') {
      const name = clean(body.name).slice(0, 80);
      if (!name) return Response.json({ error: 'El nombre de la vista es obligatorio.' }, { status: 400 });
      const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
      const rows = await listAll(svc.entities.AdvisorSavedView, { advisor_email: lower(user.email), name }, '-updated_at', 20);
      const payload = { advisor_email: lower(user.email), name, filters, is_default: body.isDefault === true, updated_at: new Date().toISOString() };
      const saved = rows[0] ? await svc.entities.AdvisorSavedView.update(rows[0].id, payload) : await svc.entities.AdvisorSavedView.create(payload);
      return Response.json({ ok: true, view: saved });
    }
    if (action === 'delete_view') {
      const row = await svc.entities.AdvisorSavedView.get(clean(body.viewId)).catch(() => null);
      if (!row || lower(row.advisor_email) !== lower(user.email)) return Response.json({ error: 'Vista no encontrada.' }, { status: 404 });
      await svc.entities.AdvisorSavedView.delete(row.id);
      return Response.json({ ok: true });
    }
    if (action !== 'overview') return Response.json({ error: 'Acción no soportada.' }, { status: 400 });

    const year = Math.max(2000, Math.min(2100, Number(body.year) || new Date().getFullYear()));
    const search = lower(body.search);
    const severity = clean(body.severity || 'all');
    const category = clean(body.category || 'all');
    const pageSize = Math.max(1, Math.min(50, Number(body.pageSize) || 12));
    const page = Math.max(1, Number(body.page) || 1);
    const filtered = context.companies.filter((company: any) => {
      if (!search) return true;
      return [companyName(company), company.nif_cif, company.owner_email].some(value => lower(value).includes(search));
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const selected = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const rows = await Promise.all(selected.map(async (company: any) => {
      const client = context.clientByEmail.get(companyOwner(company));
      const workload = await companyWorkload(svc, company, client, year);
      if (severity !== 'all' || category !== 'all') workload.alerts = workload.alerts.filter((alert: any) => (severity === 'all' || alert.severity === severity) && (category === 'all' || alert.category === category));
      return workload;
    }));
    rows.sort((a: any, b: any) => b.score - a.score || a.company.name.localeCompare(b.company.name));
    const alerts = rows.flatMap((row: any) => row.alerts);
    return Response.json({
      ok: true, generatedAt: new Date().toISOString(), year,
      rows, pagination: { page: safePage, pageSize, total: filtered.length, totalPages },
      summary: {
        companies: filtered.length, loadedCompanies: rows.length, alerts: alerts.length,
        critical: alerts.filter((item: any) => item.severity === 'critical').length,
        high: alerts.filter((item: any) => item.severity === 'high').length,
        suspense555: rows.reduce((sum: number, row: any) => sum + row.counts.suspense555, 0),
        invoicesWithoutTax: rows.reduce((sum: number, row: any) => sum + row.counts.invoicesWithoutTax, 0),
        pendingModels: rows.reduce((sum: number, row: any) => sum + row.counts.pendingModels, 0),
      },
      scope: GLOBAL_ROLES.has(roleOf(user)) ? 'global_admin' : 'assigned_portfolio',
    });
  } catch (error) {
    console.error('[advisorWorkspaceOperations]', error?.message || error);
    return Response.json({ error: error?.message || 'Error en la bandeja de asesoría.' }, { status: error?.status || 500 });
  }
});
