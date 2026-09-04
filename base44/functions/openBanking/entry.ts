import { createClientFromRequest } from 'npm:@base44/sdk@0.8.46';

const API_ROOT = 'https://bankaccountdata.gocardless.com/api/v2';
const DEFAULT_COUNTRY = 'ES';
const MAX_LIST = 5000;
const REQUESTED_HISTORY_DAYS = 365;
const REQUESTED_ACCESS_DAYS = 90;
const MANUAL_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const SCHEDULED_SYNC_MIN_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_SCHEDULED_ACCOUNTS = 25;

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function providerCredentials() {
  return {
    secretId: Deno.env.get('GOCARDLESS_SECRET_ID') || Deno.env.get('NORDIC_API_CLIENT_ID'),
    secretKey: Deno.env.get('GOCARDLESS_SECRET_KEY') || Deno.env.get('NORDIC_API_SECRET'),
  };
}

function providerConfigured() {
  const { secretId, secretKey } = providerCredentials();
  return Boolean(secretId && secretKey);
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Error interno');
  return message.replace(/secret_[a-z0-9_-]+/gi, '[credencial]').slice(0, 700);
}

function providerSlug(institutionId: string) {
  const value = institutionId.toUpperCase();
  if (value.includes('REVOLUT')) return 'revolut';
  if (value.includes('WISE')) return 'wise';
  if (value.includes('QONTO')) return 'qonto';
  if (value.includes('BBVA')) return 'bbva';
  if (value.includes('SANTANDER') || value.includes('BSCH')) return 'santander';
  if (value.includes('CAIXA')) return 'caixabank';
  if (value.includes('SABADELL') || value.includes('BSAB')) return 'sabadell';
  if (value.includes('BANKINTER') || value.includes('BKBK')) return 'bankinter';
  if (value.startsWith('ING_') || value.includes('INGD')) return 'ing';
  return 'otro';
}

function safeRedirect(raw: unknown) {
  const fallback = new URL('https://taxeaportal.com/finance/treasury');
  try {
    const parsed = new URL(clean(raw, 1000));
    if (parsed.protocol === 'https:' && ['taxeaportal.com', 'www.taxeaportal.com'].includes(parsed.hostname)) {
      return parsed;
    }
  } catch { /* use production fallback */ }
  return fallback;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getToken() {
  const { secretId, secretKey } = providerCredentials();
  if (!secretId || !secretKey) {
    throw Object.assign(new Error('Open Banking aún no está configurado. Faltan las credenciales del proveedor en Base44.'), { status: 503, code: 'provider_not_configured' });
  }
  const response = await fetch(`${API_ROOT}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!response.ok) throw Object.assign(new Error(`El proveedor bancario rechazó la autenticación (${response.status}).`), { status: 502 });
  const payload = await response.json();
  return payload.access;
}

async function providerRequest(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = clean(await response.text().catch(() => ''), 500);
    throw Object.assign(new Error(`Open Banking respondió ${response.status}${detail ? `: ${detail}` : ''}`), { status: response.status === 429 ? 429 : 502 });
  }
  if (response.status === 204) return null;
  return await response.json();
}

async function assertCompany(base44: any, user: any, requestedCompanyId: unknown) {
  const companyId = clean(requestedCompanyId, 120) || clean(user.data?.company_id, 120);
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  if (!companyId) throw Object.assign(new Error('Selecciona una empresa activa.'), { status: 403 });
  if (!isAdmin && companyId !== user.data?.company_id) {
    throw Object.assign(new Error('La empresa indicada no coincide con el perfil activo.'), { status: 403 });
  }
  return companyId;
}

async function ownedAccount(base44: any, companyId: string, accountId: unknown) {
  const id = clean(accountId, 120);
  if (!id) throw Object.assign(new Error('bank_account_id es obligatorio.'), { status: 400 });
  const account = await base44.asServiceRole.entities.BankAccount.get(id).catch(() => null);
  if (!account || account.company_id !== companyId) {
    throw Object.assign(new Error('Cuenta bancaria no encontrada en la empresa activa.'), { status: 404 });
  }
  return account;
}

function availableBalance(balances: any[]) {
  const ordered = ['interimAvailable', 'expected', 'closingBooked', 'interimBooked', 'openingBooked'];
  for (const type of ordered) {
    const match = (balances || []).find(item => item.balanceType === type);
    if (match?.balanceAmount?.amount !== undefined) return Number(match.balanceAmount.amount) || 0;
  }
  return Number(balances?.[0]?.balanceAmount?.amount) || 0;
}

function transactionDescription(transaction: any) {
  const structured = transaction.remittanceInformationStructured;
  return clean(
    transaction.remittanceInformationUnstructured ||
    (Array.isArray(transaction.remittanceInformationUnstructuredArray) ? transaction.remittanceInformationUnstructuredArray.join(' · ') : '') ||
    structured || transaction.additionalInformation || transaction.creditorName || transaction.debtorName || 'Movimiento bancario',
    500,
  );
}

function categorize(concept: string, type: string) {
  const value = concept.toLowerCase();
  if (/hacienda|aeat|tribut|iva|irpf|igic|seguridad social/.test(value)) return 'impuesto';
  if (/n[oó]mina|salario|sueldo|payroll/.test(value)) return 'nomina';
  if (/comisi[oó]n|mantenimiento cuenta|servicio bancario/.test(value)) return 'comision_bancaria';
  if (/transferencia interna|traspaso|between accounts/.test(value)) return 'transferencia_interna';
  if (/devoluci[oó]n|refund|reembolso/.test(value)) return 'devolucion';
  if (/pr[eé]stamo|hipoteca|leasing|cr[eé]dito/.test(value)) return 'prestamo';
  return type === 'entrada' ? 'ingreso' : 'gasto';
}

async function normalizeTransaction(transaction: any, status: 'booked' | 'pending', companyId: string, bankAccountId: string, providerAccountId: string) {
  const rawAmount = Number(transaction.transactionAmount?.amount || 0);
  const type = rawAmount >= 0 ? 'entrada' : 'salida';
  const concept = transactionDescription(transaction);
  const providerId = clean(transaction.transactionId || transaction.internalTransactionId || transaction.entryReference || transaction.endToEndId, 300);
  const operationDate = clean(transaction.bookingDate || transaction.valueDate || transaction.bookingDateTime || transaction.valueDateTime, 30).slice(0, 10) || isoDate();
  const currency = clean(transaction.transactionAmount?.currency, 8) || 'EUR';
  const fallbackIdentity = [providerAccountId, operationDate, rawAmount.toFixed(2), currency, concept, transaction.creditorName, transaction.debtorName].join('|');
  const transactionKey = await sha256(`${providerAccountId}|${providerId || fallbackIdentity}`);
  return {
    company_id: companyId,
    bank_account_id: bankAccountId,
    fecha_operacion: operationDate,
    fecha_valor: clean(transaction.valueDate || transaction.bookingDate, 30).slice(0, 10) || operationDate,
    concepto: concept,
    importe: Math.abs(rawAmount),
    tipo: type,
    moneda: currency,
    referencia: providerId || clean(transaction.endToEndId || transaction.bankTransactionCode, 300),
    nombre_contraparte: clean(type === 'salida' ? transaction.creditorName : transaction.debtorName, 300) || null,
    iban_contraparte: clean(type === 'salida' ? transaction.creditorAccount?.iban : transaction.debtorAccount?.iban, 80) || null,
    estado_conciliacion: 'sin_conciliar',
    categoria_ia: categorize(concept, type),
    es_demo: false,
    origen_datos: 'open_banking',
    proveedor_transaccion_id: providerId || null,
    clave_transaccion: transactionKey,
    estado_proveedor: status,
    importado_at: new Date().toISOString(),
  };
}

async function upsertTransactions(base44: any, account: any, rows: any[]) {
  const existing = await base44.asServiceRole.entities.BankTransaction.filter(
    { company_id: account.company_id, bank_account_id: account.id },
    '-fecha_operacion',
    MAX_LIST,
  );
  const byKey = new Map((existing || []).filter((item: any) => item.clave_transaccion).map((item: any) => [item.clave_transaccion, item]));
  const byLegacyRef = new Map((existing || []).filter((item: any) => item.referencia).map((item: any) => [String(item.referencia), item]));
  const additions = [];
  let updated = 0;
  let duplicates = 0;
  for (const row of rows) {
    const found = byKey.get(row.clave_transaccion) || (row.proveedor_transaccion_id ? byLegacyRef.get(row.proveedor_transaccion_id) : null);
    if (found) {
      duplicates += 1;
      const changed = found.estado_proveedor !== row.estado_proveedor || found.concepto !== row.concepto || Number(found.importe) !== Number(row.importe);
      if (changed) {
        await base44.asServiceRole.entities.BankTransaction.update(found.id, {
          fecha_operacion: row.fecha_operacion,
          fecha_valor: row.fecha_valor,
          concepto: row.concepto,
          importe: row.importe,
          tipo: row.tipo,
          moneda: row.moneda,
          referencia: row.referencia,
          nombre_contraparte: row.nombre_contraparte,
          iban_contraparte: row.iban_contraparte,
          categoria_ia: found.categoria_ia || row.categoria_ia,
          origen_datos: 'open_banking',
          proveedor_transaccion_id: row.proveedor_transaccion_id,
          clave_transaccion: row.clave_transaccion,
          estado_proveedor: row.estado_proveedor,
          importado_at: row.importado_at,
        });
        updated += 1;
      }
      continue;
    }
    additions.push(row);
    byKey.set(row.clave_transaccion, row);
  }
  if (additions.length) await base44.asServiceRole.entities.BankTransaction.bulkCreate(additions);
  return { created: additions.length, updated, duplicates };
}

async function syncProviderAccount(base44: any, token: string, account: any, requestedFrom?: string) {
  const providerAccountId = clean(account.provider_account_id, 200);
  if (!providerAccountId) throw Object.assign(new Error('La cuenta aún no está vinculada al proveedor bancario.'), { status: 409 });
  const from = clean(requestedFrom, 10) || account.sync_desde || `${new Date().getUTCFullYear()}-01-01`;
  const [detailsData, balanceData, transactionData] = await Promise.all([
    providerRequest(`/accounts/${providerAccountId}/details/`, token),
    providerRequest(`/accounts/${providerAccountId}/balances/`, token),
    providerRequest(`/accounts/${providerAccountId}/transactions/?date_from=${encodeURIComponent(from)}&date_to=${isoDate()}`, token),
  ]);
  const details = detailsData?.account || {};
  const balance = availableBalance(balanceData?.balances || []);
  const booked = transactionData?.transactions?.booked || [];
  const pending = transactionData?.transactions?.pending || [];
  const normalized = await Promise.all([
    ...booked.map((item: any) => normalizeTransaction(item, 'booked', account.company_id, account.id, providerAccountId)),
    ...pending.map((item: any) => normalizeTransaction(item, 'pending', account.company_id, account.id, providerAccountId)),
  ]);
  const result = await upsertTransactions(base44, account, normalized);
  await base44.asServiceRole.entities.BankAccount.update(account.id, {
    nombre_banco: account.nombre_banco || details.name || 'Cuenta bancaria',
    iban: clean(details.iban, 80) || account.iban || '',
    ultimos_4: clean(details.iban, 80).slice(-4) || account.ultimos_4 || '',
    titular: clean(details.ownerName || details.name, 300) || account.titular || '',
    moneda: clean(details.currency, 8) || account.moneda || 'EUR',
    saldo_disponible: balance,
    saldo_contable: balance,
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
    ultimo_error_sync: null,
    sync_desde: from,
    origen_datos: 'open_banking',
  });
  return { ...result, balance, booked: booked.length, pending: pending.length, from };
}

function syncAgeMs(account: any) {
  const timestamp = Date.parse(account.fecha_ultima_sync || '');
  return Number.isFinite(timestamp) ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
}

async function createLog(base44: any, account: any, user: any, logType: 'psd2' | 'auto' = 'psd2') {
  return await base44.asServiceRole.entities.BankSyncLog.create({
    company_id: account.company_id,
    bank_account_id: account.id,
    tipo: logType,
    estado: 'en_proceso',
    proveedor_api: 'gocardless_bank_account_data',
    fecha_inicio_sync: isoDate(),
    iniciado_por: user.email,
  });
}

async function syncWithLog(base44: any, token: string, account: any, user: any, from?: string, logType: 'psd2' | 'auto' = 'psd2') {
  const started = Date.now();
  const log = await createLog(base44, account, user, logType);
  await base44.asServiceRole.entities.BankAccount.update(account.id, { estado_conexion: 'sincronizando' });
  try {
    const result = await syncProviderAccount(base44, token, account, from);
    await base44.asServiceRole.entities.BankSyncLog.update(log.id, {
      estado: 'completado',
      movimientos_nuevos: result.created,
      movimientos_duplicados: result.duplicates,
      movimientos_actualizados: result.updated,
      historico_desde: result.from,
      saldo_despues: result.balance,
      fecha_fin_sync: isoDate(),
      duracion_ms: Date.now() - started,
    });
    return result;
  } catch (error) {
    const detail = publicError(error);
    await base44.asServiceRole.entities.BankSyncLog.update(log.id, {
      estado: 'error', error_detalle: detail, fecha_fin_sync: isoDate(), duracion_ms: Date.now() - started,
    }).catch(() => null);
    await base44.asServiceRole.entities.BankAccount.update(account.id, {
      estado_conexion: /expired|consent|requisition|access/i.test(detail) ? 'requiere_renovacion' : 'error',
      ultimo_error_sync: detail,
    }).catch(() => null);
    throw error;
  }
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 80);

    if (action === 'status') {
      return Response.json({
        ok: true,
        configured: providerConfigured(),
        provider: 'GoCardless Bank Account Data',
        country: DEFAULT_COUNTRY,
        requested_history_days: REQUESTED_HISTORY_DAYS,
        requested_access_days: REQUESTED_ACCESS_DAYS,
      });
    }

    if (action === 'scheduled_sync_all') {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (!isAdmin) return Response.json({ error: 'Solo una automatización administrativa puede ejecutar la sincronización global.' }, { status: 403 });
      if (!providerConfigured()) {
        return Response.json({ ok: true, skipped: true, reason: 'provider_not_configured', processed: 0 });
      }
      const token = await getToken();
      const allAccounts = await base44.asServiceRole.entities.BankAccount.filter(
        { origen_datos: 'open_banking', activa: true },
        'fecha_ultima_sync',
        MAX_LIST,
      );
      const eligible = (allAccounts || [])
        .filter((account: any) => account.provider_account_id)
        .filter((account: any) => ['conectado', 'error'].includes(account.estado_conexion))
        .filter((account: any) => syncAgeMs(account) >= SCHEDULED_SYNC_MIN_AGE_MS)
        .slice(0, MAX_SCHEDULED_ACCOUNTS);
      const summary = { processed: 0, created: 0, updated: 0, failed: 0 };
      for (const account of eligible) {
        try {
          const result = await syncWithLog(base44, token, account, user, account.sync_desde, 'auto');
          summary.processed += 1;
          summary.created += Number(result.created || 0);
          summary.updated += Number(result.updated || 0);
        } catch {
          summary.processed += 1;
          summary.failed += 1;
        }
        await sleep(350);
      }
      return Response.json({
        ok: true,
        ...summary,
        eligible_remaining: Math.max(0, (allAccounts?.length || 0) - eligible.length),
        min_account_age_hours: SCHEDULED_SYNC_MIN_AGE_MS / 3600000,
      });
    }

    const companyId = await assertCompany(base44, user, body.company_id);
    const token = await getToken();

    if (action === 'institutions') {
      const country = /^[A-Z]{2}$/.test(clean(body.country, 2).toUpperCase()) ? clean(body.country, 2).toUpperCase() : DEFAULT_COUNTRY;
      const institutions = await providerRequest(`/institutions/?country=${country}`, token);
      return Response.json({
        ok: true,
        institutions: (institutions || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          bic: item.bic || '',
          logo: item.logo || '',
          transaction_total_days: Number(item.transaction_total_days) || null,
          max_access_valid_for_days: Number(item.max_access_valid_for_days) || null,
        })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'es')),
      });
    }

    if (action === 'create_link') {
      const institutionId = clean(body.institution_id, 200);
      if (!institutionId) return Response.json({ error: 'Selecciona un banco.' }, { status: 400 });
      const institution = await providerRequest(`/institutions/${encodeURIComponent(institutionId)}/`, token);
      const transactionDays = Math.max(1, Number(institution.transaction_total_days) || 90);
      const accessDays = Math.max(1, Number(institution.max_access_valid_for_days) || REQUESTED_ACCESS_DAYS);
      const historicalDays = Math.min(REQUESTED_HISTORY_DAYS, transactionDays);
      const validDays = Math.min(REQUESTED_ACCESS_DAYS, accessDays);
      const startOfYear = `${new Date().getUTCFullYear()}-01-01`;
      const earliestAvailable = new Date(Date.now() - transactionDays * 86400000);
      const syncFrom = new Date(startOfYear) > earliestAvailable ? startOfYear : isoDate(earliestAvailable);
      const provider = providerSlug(institutionId);
      const account = await base44.asServiceRole.entities.BankAccount.create({
        company_id: companyId,
        nombre_banco: clean(institution.name, 300) || 'Banco',
        tipo_banco: 'tradicional',
        proveedor: provider,
        moneda: 'EUR',
        saldo_disponible: 0,
        saldo_contable: 0,
        estado_conexion: 'pendiente',
        proveedor_integracion: 'gocardless_bank_account_data',
        institution_id: institutionId,
        origen_datos: 'open_banking',
        sync_desde: syncFrom,
        dias_historico_disponibles: transactionDays,
        permisos_concedidos: ['saldos', 'datos de cuenta', 'movimientos'],
      });
      try {
        const agreement = await providerRequest('/agreements/enduser/', token, {
          method: 'POST',
          body: JSON.stringify({
            institution_id: institutionId,
            max_historical_days: historicalDays,
            access_valid_for_days: validDays,
            access_scope: ['balances', 'details', 'transactions'],
          }),
        });
        const redirect = safeRedirect(body.redirect_url);
        redirect.searchParams.set('bank_link', 'return');
        redirect.searchParams.set('bank_account_id', account.id);
        const requisition = await providerRequest('/requisitions/', token, {
          method: 'POST',
          body: JSON.stringify({
            redirect: redirect.toString(),
            institution_id: institutionId,
            reference: `taxea_${companyId}_${account.id}`.slice(0, 120),
            agreement: agreement.id,
            user_language: 'ES',
          }),
        });
        const expires = new Date(Date.now() + validDays * 86400000);
        await base44.asServiceRole.entities.BankAccount.update(account.id, {
          requisition_id: requisition.id,
          agreement_id: agreement.id,
          proveedor_integracion: requisition.id,
          fecha_consentimiento_expira: isoDate(expires),
        });
        await base44.asServiceRole.entities.BankConsent.create({
          company_id: companyId,
          bank_account_id: account.id,
          proveedor: 'gocardless_bank_account_data',
          tipo_conexion: 'psd2',
          estado: 'pendiente',
          permisos: ['saldos', 'datos de cuenta', 'movimientos'],
          fecha_consentimiento: new Date().toISOString(),
          fecha_expiracion: isoDate(expires),
          token_referencia: requisition.id,
          requisition_id: requisition.id,
          agreement_id: agreement.id,
          institution_id: institutionId,
          nota_auditoria: `Consentimiento PSD2 iniciado por ${user.email}.`,
        });
        return Response.json({
          ok: true,
          link: requisition.link,
          bank_account_id: account.id,
          requisition_id: requisition.id,
          history_days: historicalDays,
          full_current_year_expected: transactionDays >= Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 86400000),
        });
      } catch (error) {
        await base44.asServiceRole.entities.BankAccount.update(account.id, { estado_conexion: 'error', ultimo_error_sync: publicError(error) }).catch(() => null);
        throw error;
      }
    }

    if (action === 'finalize') {
      const placeholder = await ownedAccount(base44, companyId, body.bank_account_id);
      const requisitionId = clean(placeholder.requisition_id || placeholder.proveedor_integracion, 200);
      if (!requisitionId || requisitionId === 'gocardless_bank_account_data') {
        return Response.json({ error: 'La autorización bancaria no tiene una referencia válida.' }, { status: 409 });
      }
      const requisition = await providerRequest(`/requisitions/${encodeURIComponent(requisitionId)}/`, token);
      if (requisition.status !== 'LN') {
        const terminal = ['RJ', 'EX', 'SU'].includes(requisition.status);
        await base44.asServiceRole.entities.BankAccount.update(placeholder.id, {
          estado_conexion: terminal ? 'requiere_renovacion' : 'pendiente',
          ultimo_error_sync: `Estado de autorización: ${requisition.status}`,
        });
        return Response.json({ ok: false, pending: !terminal, status: requisition.status, error: terminal ? 'La autorización fue rechazada, suspendida o ha expirado.' : 'El banco todavía no ha completado la autorización.' }, { status: terminal ? 409 : 202 });
      }
      const providerAccountIds = Array.isArray(requisition.accounts) ? requisition.accounts : [];
      if (!providerAccountIds.length) return Response.json({ error: 'El banco no devolvió ninguna cuenta autorizada.' }, { status: 409 });
      const accounts = [];
      for (let index = 0; index < providerAccountIds.length; index += 1) {
        const providerAccountId = clean(providerAccountIds[index], 200);
        let account = index === 0 ? placeholder : null;
        if (!account) {
          const matches = await base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId, provider_account_id: providerAccountId }, '-created_date', 1);
          account = matches?.[0] || await base44.asServiceRole.entities.BankAccount.create({
            company_id: companyId,
            nombre_banco: placeholder.nombre_banco,
            tipo_banco: placeholder.tipo_banco || 'tradicional',
            proveedor: placeholder.proveedor || 'otro',
            moneda: 'EUR',
            saldo_disponible: 0,
            saldo_contable: 0,
            estado_conexion: 'pendiente',
            proveedor_integracion: requisitionId,
            requisition_id: requisitionId,
            agreement_id: placeholder.agreement_id,
            institution_id: placeholder.institution_id,
            provider_account_id: providerAccountId,
            origen_datos: 'open_banking',
            sync_desde: placeholder.sync_desde,
            fecha_consentimiento_expira: placeholder.fecha_consentimiento_expira,
            permisos_concedidos: placeholder.permisos_concedidos || ['saldos', 'datos de cuenta', 'movimientos'],
          });
        }
        await base44.asServiceRole.entities.BankAccount.update(account.id, { provider_account_id: providerAccountId, requisition_id: requisitionId, proveedor_integracion: requisitionId });
        account = { ...account, provider_account_id: providerAccountId, requisition_id: requisitionId, proveedor_integracion: requisitionId };
        const result = await syncWithLog(base44, token, account, user, account.sync_desde);
        accounts.push({ id: account.id, ...result });
        if (index < providerAccountIds.length - 1) await sleep(250);
      }
      const consents = await base44.asServiceRole.entities.BankConsent.filter({ company_id: companyId, requisition_id: requisitionId }, '-created_date', 20);
      for (const consent of consents || []) {
        await base44.asServiceRole.entities.BankConsent.update(consent.id, { estado: 'activo', nota_auditoria: `Consentimiento PSD2 activo. Autorizado por ${user.email}.` });
      }
      return Response.json({ ok: true, accounts, requisition_status: requisition.status });
    }

    if (action === 'sync') {
      const account = await ownedAccount(base44, companyId, body.bank_account_id);
      const ageMs = syncAgeMs(account);
      if (!body.force && ageMs < MANUAL_SYNC_COOLDOWN_MS) {
        return Response.json({
          ok: true,
          skipped: true,
          reason: 'recently_synced',
          created: 0,
          updated: 0,
          next_sync_at: new Date(Date.now() + (MANUAL_SYNC_COOLDOWN_MS - ageMs)).toISOString(),
        });
      }
      const result = await syncWithLog(base44, token, account, user, account.sync_desde || `${new Date().getUTCFullYear()}-01-01`);
      return Response.json({ ok: true, ...result });
    }

    if (action === 'disconnect') {
      const account = await ownedAccount(base44, companyId, body.bank_account_id);
      const requisitionId = clean(account.requisition_id || account.proveedor_integracion, 200);
      if (requisitionId && requisitionId !== 'gocardless_bank_account_data') {
        await providerRequest(`/requisitions/${encodeURIComponent(requisitionId)}/`, token, { method: 'DELETE' }).catch(error => {
          console.warn('[openBanking] remote revoke failed:', publicError(error));
        });
      }
      const linked = requisitionId
        ? await base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId, requisition_id: requisitionId }, '-created_date', 50)
        : [account];
      for (const linkedAccount of linked || [account]) {
        await base44.asServiceRole.entities.BankAccount.update(linkedAccount.id, { estado_conexion: 'desconectado', activa: false });
      }
      const consents = await base44.asServiceRole.entities.BankConsent.filter({ company_id: companyId, requisition_id: requisitionId }, '-created_date', 100);
      for (const consent of consents || []) {
        await base44.asServiceRole.entities.BankConsent.update(consent.id, {
          estado: 'revocado',
          revocado_por: user.email,
          fecha_revocacion: new Date().toISOString(),
          motivo_revocacion: clean(body.reason, 300) || 'Revocado por el usuario desde Taxea.',
        });
      }
      return Response.json({ ok: true, accounts_disconnected: linked?.length || 1, consents_revoked: consents?.length || 0 });
    }

    return Response.json({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error: any) {
    console.error('[openBanking]', publicError(error));
    return Response.json({ error: publicError(error), code: error?.code || null }, { status: Number(error?.status) || 500 });
  }
});

