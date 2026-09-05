import { createClientFromRequest } from 'npm:@base44/sdk@0.8.46';

const API_ROOT = 'https://api.enablebanking.com';
const DEFAULT_COUNTRY = 'ES';
const REQUESTED_HISTORY_DAYS = 365;
const REQUESTED_ACCESS_DAYS = 90;
const MAX_LIST = 5000;
const MAX_TRANSACTION_PAGES = 20;
const MANUAL_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const SCHEDULED_SYNC_MIN_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_SCHEDULED_ACCOUNTS = 25;

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const asMoney = (value: number) => Math.round(value * 100) / 100;
const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function credentials() {
  return {
    applicationId: clean(Deno.env.get('ENABLE_BANKING_APPLICATION_ID'), 200),
    privateKey: String(Deno.env.get('ENABLE_BANKING_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim(),
  };
}

function providerConfigured() {
  const { applicationId, privateKey } = credentials();
  return Boolean(applicationId && privateKey);
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Error interno');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [credencial]')
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, '[clave privada]')
    .slice(0, 700);
}

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function providerToken() {
  const { applicationId, privateKey } = credentials();
  if (!applicationId || !privateKey) {
    throw Object.assign(new Error('Open Banking aún no está activado. Faltan las credenciales de Enable Banking en Base44.'), { status: 503, code: 'provider_not_configured' });
  }
  try {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemBytes(privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: applicationId }));
    const payload = base64Url(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }));
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    throw Object.assign(new Error('La clave privada de Enable Banking no tiene un formato PKCS#8 válido.'), { status: 503, code: 'invalid_provider_key' });
  }
}

async function providerRequest(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = clean(await response.text().catch(() => ''), 500);
    const error = Object.assign(new Error(`Enable Banking respondió ${response.status}${detail ? `: ${detail}` : ''}`), {
      status: response.status === 429 ? 429 : 502,
      providerStatus: response.status,
    });
    throw error;
  }
  if (response.status === 204) return null;
  return await response.json();
}

function providerSlug(name: string) {
  const value = name.toUpperCase();
  if (value.includes('REVOLUT')) return 'revolut';
  if (value.includes('WISE')) return 'wise';
  if (value.includes('QONTO')) return 'qonto';
  if (value.includes('BBVA')) return 'bbva';
  if (value.includes('SANTANDER') || value.includes('BSCH')) return 'santander';
  if (value.includes('CAIXA')) return 'caixabank';
  if (value.includes('SABADELL')) return 'sabadell';
  if (value.includes('BANKINTER')) return 'bankinter';
  if (/^ING\b/.test(value)) return 'ing';
  return 'otro';
}

function safeRedirect(raw: unknown) {
  const fallback = new URL('https://taxeaportal.com/finance/treasury');
  try {
    const parsed = new URL(clean(raw, 1000));
    parsed.search = '';
    parsed.hash = '';
    if (parsed.toString() === fallback.toString()) return parsed;
  } catch { /* production fallback */ }
  return fallback;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizedEmail(value: unknown) {
  return clean(value, 320).toLowerCase();
}

async function assertCompany(base44: any, user: any, requestedCompanyId: unknown) {
  const profileCompanyId = clean(user.data?.company_id, 120);
  const companyId = clean(requestedCompanyId, 120) || profileCompanyId;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  if (!companyId) throw Object.assign(new Error('Selecciona una empresa activa.'), { status: 403 });
  if (isAdmin || companyId === profileCompanyId) return companyId;

  const company = await base44.asServiceRole.entities.Company.get(companyId).catch(() => null);
  const userEmail = normalizedEmail(user.email);
  const ownerEmail = normalizedEmail(company?.owner_email);
  const authorizedEmails = Array.isArray(company?.usuarios_autorizados)
    ? company.usuarios_autorizados.map(normalizedEmail)
    : [];
  if (!company || !userEmail || (ownerEmail !== userEmail && !authorizedEmails.includes(userEmail))) {
    throw Object.assign(new Error('No tienes acceso a la empresa indicada.'), { status: 403 });
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

async function ownedTransaction(base44: any, companyId: string, transactionId: unknown) {
  const id = clean(transactionId, 120);
  if (!id) throw Object.assign(new Error('bank_transaction_id es obligatorio.'), { status: 400 });
  const transaction = await base44.asServiceRole.entities.BankTransaction.get(id).catch(() => null);
  if (!transaction || transaction.company_id !== companyId) {
    throw Object.assign(new Error('Movimiento bancario no encontrado en la empresa activa.'), { status: 404 });
  }
  return transaction;
}

function accountIban(details: any) {
  return clean(details?.account_id?.iban, 80);
}

function balanceValues(balances: any[]) {
  const availableOrder = ['CLAV', 'ITAV', 'FWAV', 'XPCD', 'CLBD', 'ITBD', 'OPBD'];
  const bookedOrder = ['CLBD', 'ITBD', 'OPBD', 'CLAV', 'ITAV'];
  const find = (order: string[]) => {
    for (const type of order) {
      const match = (balances || []).find(item => item.balance_type === type);
      if (match?.balance_amount?.amount !== undefined) return Number(match.balance_amount.amount) || 0;
    }
    return Number(balances?.[0]?.balance_amount?.amount) || 0;
  };
  return { available: find(availableOrder), booked: find(bookedOrder) };
}

function transactionDescription(transaction: any) {
  return clean(
    (Array.isArray(transaction.remittance_information) ? transaction.remittance_information.join(' · ') : transaction.remittance_information) ||
    transaction.note || transaction.bank_transaction_code?.description || transaction.creditor?.name || transaction.debtor?.name || 'Movimiento bancario',
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

async function normalizeTransaction(transaction: any, companyId: string, bankAccountId: string, providerAccountId: string) {
  const amountValue = Number(transaction.transaction_amount?.amount || 0);
  const indicator = clean(transaction.credit_debit_indicator, 10).toUpperCase();
  const signedAmount = indicator === 'DBIT' ? -Math.abs(amountValue) : indicator === 'CRDT' ? Math.abs(amountValue) : amountValue;
  const type = signedAmount >= 0 ? 'entrada' : 'salida';
  const concept = transactionDescription(transaction);
  const providerId = clean(transaction.transaction_id || transaction.entry_reference || transaction.reference_number, 300);
  const operationDate = clean(transaction.booking_date || transaction.transaction_date || transaction.value_date, 30).slice(0, 10) || isoDate();
  const currency = clean(transaction.transaction_amount?.currency, 8) || 'EUR';
  const fallbackIdentity = [providerAccountId, operationDate, signedAmount.toFixed(2), currency, concept, transaction.creditor?.name, transaction.debtor?.name].join('|');
  const transactionKey = await sha256(`${providerAccountId}|${providerId || fallbackIdentity}`);
  const booked = clean(transaction.status, 10).toUpperCase() === 'BOOK';
  return {
    company_id: companyId,
    bank_account_id: bankAccountId,
    fecha_operacion: operationDate,
    fecha_valor: clean(transaction.value_date || transaction.booking_date, 30).slice(0, 10) || operationDate,
    concepto: concept,
    importe: Math.abs(signedAmount),
    tipo: type,
    moneda: currency,
    referencia: providerId || null,
    nombre_contraparte: clean(type === 'salida' ? transaction.creditor?.name : transaction.debtor?.name, 300) || null,
    iban_contraparte: clean(type === 'salida' ? transaction.creditor_account?.iban : transaction.debtor_account?.iban, 80) || null,
    estado_conciliacion: 'sin_conciliar',
    categoria_ia: categorize(concept, type),
    es_demo: false,
    origen_datos: 'open_banking',
    proveedor_transaccion_id: providerId || null,
    clave_transaccion: transactionKey,
    estado_proveedor: booked ? 'booked' : 'pending',
    importado_at: new Date().toISOString(),
  };
}

function sameProviderMovement(left: any, right: any) {
  return left.fecha_operacion === right.fecha_operacion
    && Number(left.importe) === Number(right.importe)
    && left.tipo === right.tipo
    && clean(left.moneda, 8) === clean(right.moneda, 8)
    && clean(left.concepto, 500) === clean(right.concepto, 500);
}

async function upsertTransactions(base44: any, account: any, rows: any[]) {
  const companyTransactions = await base44.asServiceRole.entities.BankTransaction.filter(
    { company_id: account.company_id }, '-fecha_operacion', MAX_LIST,
  );
  const existing = (companyTransactions || []).filter((item: any) => item.bank_account_id === account.id);
  const byKey = new Map(existing.filter((item: any) => item.clave_transaccion).map((item: any) => [item.clave_transaccion, item]));
  const byReference = new Map(existing.filter((item: any) => item.referencia).map((item: any) => [String(item.referencia), item]));
  const companyByProviderId = new Map<string, any[]>();
  for (const item of companyTransactions || []) {
    const providerId = clean(item.proveedor_transaccion_id || item.referencia, 300);
    if (!providerId) continue;
    const matches = companyByProviderId.get(providerId) || [];
    matches.push(item);
    companyByProviderId.set(providerId, matches);
  }
  const additions = [];
  let updated = 0;
  let duplicates = 0;
  for (const row of rows) {
    const found = byKey.get(row.clave_transaccion) || (row.proveedor_transaccion_id ? byReference.get(row.proveedor_transaccion_id) : null);
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
    const providerMatches = row.proveedor_transaccion_id ? (companyByProviderId.get(row.proveedor_transaccion_id) || []) : [];
    if (providerMatches.some((item: any) => sameProviderMovement(item, row))) {
      duplicates += 1;
      continue;
    }
    additions.push(row);
    byKey.set(row.clave_transaccion, row);
    if (row.proveedor_transaccion_id) {
      companyByProviderId.set(row.proveedor_transaccion_id, [...providerMatches, row]);
    }
  }
  if (additions.length) await base44.asServiceRole.entities.BankTransaction.bulkCreate(additions);
  return { created: additions.length, updated, duplicates };
}

async function fetchTransactions(token: string, providerAccountId: string, requestedFrom: string) {
  let from = requestedFrom;
  const to = isoDate();
  const load = async () => {
    const rows: any[] = [];
    let continuation = '';
    for (let page = 0; page < MAX_TRANSACTION_PAGES; page += 1) {
      const query = new URLSearchParams({ date_from: from, date_to: to });
      if (continuation) query.set('continuation_key', continuation);
      const result = await providerRequest(`/accounts/${encodeURIComponent(providerAccountId)}/transactions?${query}`, token);
      rows.push(...(result?.transactions || []));
      continuation = clean(result?.continuation_key, 1000);
      if (!continuation) break;
    }
    return rows;
  };
  try {
    return { rows: await load(), from };
  } catch (error: any) {
    if (![400, 422].includes(Number(error?.providerStatus))) throw error;
    const fallback = new Date(Date.now() - 90 * 86400000);
    from = isoDate(fallback);
    return { rows: await load(), from };
  }
}

async function syncProviderAccount(base44: any, token: string, account: any, requestedFrom?: string) {
  if (account.proveedor_integracion !== 'enable_banking') {
    throw Object.assign(new Error('Esta cuenta pertenece a una conexión histórica. Debe reconectarse con el proveedor Open Banking actual.'), { status: 409 });
  }
  const providerAccountId = clean(account.provider_account_id, 200);
  if (!providerAccountId) throw Object.assign(new Error('La cuenta todavía no está autorizada por el banco.'), { status: 409 });
  const requested = clean(requestedFrom, 10) || account.sync_desde || `${new Date().getUTCFullYear()}-01-01`;
  const [details, balanceData, transactionData] = await Promise.all([
    providerRequest(`/accounts/${encodeURIComponent(providerAccountId)}/details`, token),
    providerRequest(`/accounts/${encodeURIComponent(providerAccountId)}/balances`, token),
    fetchTransactions(token, providerAccountId, requested),
  ]);
  const balances = balanceValues(balanceData?.balances || []);
  const normalized = await Promise.all((transactionData.rows || []).map((item: any) => normalizeTransaction(item, account.company_id, account.id, providerAccountId)));
  const result = await upsertTransactions(base44, account, normalized);
  const iban = accountIban(details) || account.iban || '';
  const booked = normalized.filter(item => item.estado_proveedor === 'booked').length;
  const pending = normalized.length - booked;
  await base44.asServiceRole.entities.BankAccount.update(account.id, {
    nombre_banco: account.nombre_banco || clean(details?.account_servicer?.name, 300) || 'Cuenta bancaria',
    iban,
    ultimos_4: iban.slice(-4) || account.ultimos_4 || '',
    titular: clean(details?.name, 300) || account.titular || '',
    moneda: clean(details?.currency, 8) || account.moneda || 'EUR',
    saldo_disponible: balances.available,
    saldo_contable: balances.booked,
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
    ultimo_error_sync: null,
    sync_desde: transactionData.from,
    dias_historico_disponibles: Math.max(1, Math.ceil((Date.now() - Date.parse(transactionData.from)) / 86400000)),
    origen_datos: 'open_banking',
  });
  return { ...result, balance: balances.available, booked, pending, from: transactionData.from };
}

const RECONCILIATION_STOP_WORDS = new Set([
  'sl', 'slu', 'sa', 'sau', 'sc', 'scp', 'sociedad', 'limitada', 'anonima',
  'grupo', 'servicios', 'service', 'services', 'the', 'de', 'del', 'la', 'las', 'los', 'y',
]);

function normalizeForReconciliation(value: unknown) {
  return clean(value, 1200)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokensForReconciliation(value: unknown) {
  return clean(value, 1200)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter(token => token.length >= 4 && !RECONCILIATION_STOP_WORDS.has(token));
}

function reconciliationDayGap(from: unknown, to: unknown) {
  const value = Math.round((Date.parse(clean(to, 30)) - Date.parse(clean(from, 30))) / 86400000);
  return Number.isFinite(value) ? value : null;
}

function expectedTransactionType(invoice: any) {
  const creditNote = Number(invoice.total_factura || 0) < 0;
  return invoice.tipo === 'recibida'
    ? (creditNote ? 'entrada' : 'salida')
    : (creditNote ? 'salida' : 'entrada');
}

function invoiceCounterparty(invoice: any) {
  return invoice.tipo === 'recibida'
    ? { name: invoice.proveedor_nombre || invoice.cliente_nombre, taxId: invoice.proveedor_nif || invoice.cliente_nif }
    : { name: invoice.cliente_nombre || invoice.proveedor_nombre, taxId: invoice.cliente_nif || invoice.proveedor_nif };
}

function reconciliationSignal(invoice: any, transaction: any, contact: any) {
  const bankText = `${transaction.nombre_contraparte || ''} ${transaction.concepto || ''} ${transaction.referencia || ''} ${transaction.iban_contraparte || ''}`;
  const compactBankText = normalizeForReconciliation(bankText);
  const party = invoiceCounterparty(invoice);
  const invoiceNumber = normalizeForReconciliation(invoice.numero_factura);
  const taxIds = [party.taxId, contact?.nif_cif].map(normalizeForReconciliation).filter(value => value.length >= 8);
  const names = [party.name, contact?.razon_social, contact?.nombre].map(value => clean(value, 300)).filter(Boolean);
  const bankTokens = new Set(tokensForReconciliation(bankText));
  const matchedTokens = [...new Set(names.flatMap(tokensForReconciliation).filter(token => bankTokens.has(token)))];
  const numberMatch = invoiceNumber.length >= 4 && compactBankText.includes(invoiceNumber);
  const taxIdMatch = taxIds.some(value => compactBankText.includes(value));
  const fullNameMatch = names.some(value => {
    const normalized = normalizeForReconciliation(value);
    return normalized.length >= 6 && compactBankText.includes(normalized);
  });
  const distinctiveTokenMatch = matchedTokens.some(token => token.length >= 8);
  const partyMatch = fullNameMatch || distinctiveTokenMatch || matchedTokens.length >= 2;
  const score = numberMatch ? 140 : taxIdMatch ? 130 : fullNameMatch ? 110 : distinctiveTokenMatch ? 90 : matchedTokens.length >= 2 ? 80 : 0;
  return {
    strong: numberMatch || taxIdMatch || partyMatch,
    score,
    reason: numberMatch ? 'número de factura' : taxIdMatch ? 'NIF' : fullNameMatch ? 'nombre completo' : distinctiveTokenMatch ? 'nombre distintivo' : matchedTokens.length >= 2 ? 'nombre de contraparte' : '',
  };
}

async function autoReconcileCompany(base44: any, companyId: string, actor: string) {
  const [accounts, transactions, invoices, payments, contacts] = await Promise.all([
    base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId }, '-created_date', MAX_LIST),
    base44.asServiceRole.entities.BankTransaction.filter({ company_id: companyId }, '-fecha_operacion', MAX_LIST),
    base44.asServiceRole.entities.Invoice.filter({ company_id: companyId }, '-fecha_emision', MAX_LIST),
    base44.asServiceRole.entities.InvoicePayment.filter({ company_id: companyId }, '-payment_date', MAX_LIST),
    base44.asServiceRole.entities.Contact.filter({ company_id: companyId }, '-created_date', MAX_LIST),
  ]);
  const activeAccountIds = new Set((accounts || []).filter((account: any) => account.activa !== false).map((account: any) => account.id));
  const paymentsByInvoice = new Map<string, number>();
  for (const payment of payments || []) {
    paymentsByInvoice.set(payment.invoice_id, asMoney((paymentsByInvoice.get(payment.invoice_id) || 0) + Math.abs(Number(payment.amount || 0))));
  }
  const contactsByTaxId = new Map<string, any>();
  const contactsByName = new Map<string, any>();
  for (const contact of contacts || []) {
    const taxId = normalizeForReconciliation(contact.nif_cif);
    const names = [contact.razon_social, contact.nombre].map(normalizeForReconciliation).filter(Boolean);
    if (taxId) contactsByTaxId.set(taxId, contact);
    for (const name of names) if (name.length >= 6) contactsByName.set(name, contact);
  }
  const contactForInvoice = (invoice: any) => {
    const party = invoiceCounterparty(invoice);
    const taxId = normalizeForReconciliation(party.taxId);
    const name = normalizeForReconciliation(party.name);
    return (taxId && contactsByTaxId.get(taxId)) || (name && contactsByName.get(name)) || null;
  };
  const eligibleInvoices = (invoices || []).filter((invoice: any) => {
    if (invoice.anulada || invoice.estado_cobro === 'cobrada') return false;
    const total = Math.abs(Number(invoice.total_factura || 0));
    invoice.__outstanding = asMoney(Math.max(0, total - (paymentsByInvoice.get(invoice.id) || 0)));
    return invoice.__outstanding > 0.01;
  });
  const availableTransactions = (transactions || []).filter((transaction: any) =>
    activeAccountIds.has(transaction.bank_account_id)
    && transaction.estado_proveedor !== 'pending'
    && !transaction.es_demo
    && !transaction.entidad_id
    && !['duplicada', 'descartada', 'movimiento_interno'].includes(transaction.estado_conciliacion),
  );
  const candidates: any[] = [];
  for (const invoice of eligibleInvoices) {
    const currency = clean(invoice.moneda || 'EUR', 8).toUpperCase();
    const contact = contactForInvoice(invoice);
    for (const transaction of availableTransactions) {
      if (transaction.tipo !== expectedTransactionType(invoice)) continue;
      if (clean(transaction.moneda || 'EUR', 8).toUpperCase() !== currency) continue;
      if (Math.abs(Number(transaction.importe || 0) - invoice.__outstanding) > 0.01) continue;
      const gap = reconciliationDayGap(invoice.fecha_emision || invoice.fecha_operacion, transaction.fecha_operacion);
      if (gap === null || gap < -3 || gap > 90) continue;
      const signal = reconciliationSignal(invoice, transaction, contact);
      if (!signal.strong || signal.score < 80) continue;
      candidates.push({ invoice, transaction, contact, gap, signal, score: signal.score + Math.max(0, 30 - Math.abs(gap)) });
    }
  }
  const byInvoice = new Map<string, any[]>();
  const byTransaction = new Map<string, any[]>();
  for (const candidate of candidates) {
    byInvoice.set(candidate.invoice.id, [...(byInvoice.get(candidate.invoice.id) || []), candidate]);
    byTransaction.set(candidate.transaction.id, [...(byTransaction.get(candidate.transaction.id) || []), candidate]);
  }
  const sorted = (rows: any[]) => rows.slice().sort((left, right) => right.score - left.score || Math.abs(left.gap) - Math.abs(right.gap));
  const safeMatches = candidates.filter(candidate => {
    const invoiceMatches = sorted(byInvoice.get(candidate.invoice.id) || []);
    const transactionMatches = sorted(byTransaction.get(candidate.transaction.id) || []);
    const invoiceUnique = invoiceMatches[0]?.transaction.id === candidate.transaction.id
      && (!invoiceMatches[1] || invoiceMatches[0].score - invoiceMatches[1].score >= 25);
    const transactionUnique = transactionMatches[0]?.invoice.id === candidate.invoice.id
      && (!transactionMatches[1] || transactionMatches[0].score - transactionMatches[1].score >= 25);
    return invoiceUnique && transactionUnique;
  });
  let reconciled = 0;
  let amount = 0;
  let issued = 0;
  let received = 0;
  for (const match of safeMatches) {
    const previousPayment = await base44.asServiceRole.entities.InvoicePayment.filter({
      company_id: companyId,
      invoice_id: match.invoice.id,
      bank_transaction_id: match.transaction.id,
    }, '-created_at', 1);
    if (previousPayment?.[0]) continue;
    const currentTransaction = await base44.asServiceRole.entities.BankTransaction.get(match.transaction.id).catch(() => null);
    const currentInvoice = await base44.asServiceRole.entities.Invoice.get(match.invoice.id).catch(() => null);
    if (!currentTransaction || currentTransaction.entidad_id || !currentInvoice || currentInvoice.anulada || currentInvoice.estado_cobro === 'cobrada') continue;
    const currentPayments = await base44.asServiceRole.entities.InvoicePayment.filter({ company_id: companyId, invoice_id: currentInvoice.id }, '-payment_date', MAX_LIST);
    const alreadyPaid = asMoney((currentPayments || []).reduce((sum: number, payment: any) => sum + Math.abs(Number(payment.amount || 0)), 0));
    const currentOutstanding = asMoney(Math.max(0, Math.abs(Number(currentInvoice.total_factura || 0)) - alreadyPaid));
    const paymentAmount = asMoney(Math.abs(Number(currentTransaction.importe || 0)));
    if (currentOutstanding <= 0.01 || Math.abs(currentOutstanding - paymentAmount) > 0.01) continue;
    const now = new Date().toISOString();
    const currency = clean(currentTransaction.moneda || currentInvoice.moneda || 'EUR', 8).toUpperCase();
    const note = `Conciliación automática de alta confianza: importe, sentido, moneda, fecha y ${match.signal.reason}.`;
    await base44.asServiceRole.entities.InvoicePayment.create({
      company_id: companyId,
      invoice_id: currentInvoice.id,
      amount: paymentAmount,
      currency,
      payment_date: currentTransaction.fecha_operacion,
      method: 'transferencia',
      reference: clean(currentTransaction.referencia || currentTransaction.concepto, 160),
      notes: note,
      origin: 'bank_reconciliation',
      bank_transaction_id: currentTransaction.id,
      idempotency_key: `bank:${currentTransaction.id}`,
      created_at: now,
      created_by: actor,
    });
    await base44.asServiceRole.entities.BankTransaction.update(currentTransaction.id, {
      estado_conciliacion: 'conciliada_auto',
      confianza_conciliacion: 'alta',
      entidad_tipo: 'invoice',
      entidad_id: currentInvoice.id,
      contacto_id: match.contact?.id || currentTransaction.contacto_id || null,
      notas: clean(`${currentTransaction.notas ? `${currentTransaction.notas}\n` : ''}${note} Factura ${currentInvoice.numero_factura}.`, 2000),
    });
    const paid = asMoney(alreadyPaid + paymentAmount);
    const outstanding = asMoney(Math.max(0, Math.abs(Number(currentInvoice.total_factura || 0)) - paid));
    await base44.asServiceRole.entities.Invoice.update(currentInvoice.id, {
      estado_cobro: outstanding <= 0.01 ? 'cobrada' : 'parcial',
      importe_pagado: paid,
      importe_pendiente: outstanding,
      ultimo_pago_at: now,
    });
    await base44.asServiceRole.entities.InvoiceTimelineEvent.create({
      invoice_id: currentInvoice.id,
      company_id: companyId,
      event_type: 'conciliacion_bancaria',
      event_label: 'Factura conciliada automáticamente',
      event_detail: `${paymentAmount.toFixed(2)} ${currency} · ${clean(currentTransaction.concepto, 120)} · ${match.signal.reason}`,
      created_at: now,
      created_by: actor,
      origin: 'automatizacion',
    }).catch(error => console.warn('[openBanking] reconciliation timeline skipped:', publicError(error)));
    reconciled += 1;
    amount = asMoney(amount + paymentAmount);
    if (currentInvoice.tipo === 'recibida') received += 1;
    else issued += 1;
  }
  return {
    reconciled,
    amount,
    issued,
    received,
    remaining_invoices: Math.max(0, eligibleInvoices.length - reconciled),
    reviewed_invoices: eligibleInvoices.length,
    criteria_version: 'exact-v2-party-evidence',
  };
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
    proveedor_api: 'enable_banking',
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
      estado_conexion: /expired|revoked|closed|consent|session/i.test(detail) ? 'requiere_renovacion' : 'error',
      ultimo_error_sync: detail,
    }).catch(() => null);
    throw error;
  }
}

function consentExpiry(institution: any) {
  const providerSeconds = Math.max(3600, Number(institution?.maximum_consent_validity) || REQUESTED_ACCESS_DAYS * 86400);
  const seconds = Math.min(REQUESTED_ACCESS_DAYS * 86400, providerSeconds);
  return new Date(Date.now() + seconds * 1000);
}

async function startAuthorization(base44: any, token: string, user: any, companyId: string, institution: any, account: any, body: any, renewal = false) {
  const expiry = consentExpiry(institution);
  const state = crypto.randomUUID();
  const redirect = safeRedirect(body.redirect_url);
  const requestedType = clean(body.psu_type, 20).toLowerCase();
  const supportedTypes = Array.isArray(institution?.psu_types) ? institution.psu_types : [];
  const psuType = ['business', 'personal'].includes(requestedType) && (!supportedTypes.length || supportedTypes.includes(requestedType))
    ? requestedType
    : supportedTypes.includes('business') ? 'business' : 'personal';
  const authorization = await providerRequest('/auth', token, {
    method: 'POST',
    body: JSON.stringify({
      access: { valid_until: expiry.toISOString(), balances: true, transactions: true },
      aspsp: { name: institution.name, country: institution.country || DEFAULT_COUNTRY },
      state,
      redirect_url: redirect.toString(),
      psu_type: psuType,
    }),
  });
  await base44.asServiceRole.entities.BankAccount.update(account.id, {
    estado_conexion: 'pendiente',
    proveedor_integracion: 'enable_banking',
    institution_id: clean(institution.name, 300),
    requisition_id: clean(authorization.authorization_id, 200),
    agreement_id: state,
    authorization_id: clean(authorization.authorization_id, 200),
    oauth_state: state,
    fecha_consentimiento_expira: isoDate(expiry),
    ultimo_error_sync: null,
    activa: true,
  });
  await base44.asServiceRole.entities.BankConsent.create({
    company_id: companyId,
    bank_account_id: account.id,
    proveedor: 'enable_banking',
    tipo_conexion: 'psd2',
    estado: 'pendiente',
    permisos: ['saldos', 'datos de cuenta', 'movimientos'],
    fecha_consentimiento: new Date().toISOString(),
    fecha_expiracion: isoDate(expiry),
    token_referencia: clean(authorization.authorization_id, 200),
    requisition_id: clean(authorization.authorization_id, 200),
    agreement_id: state,
    institution_id: clean(institution.name, 300),
    nota_auditoria: `${renewal ? 'Renovación' : 'Consentimiento'} PSD2 iniciado por ${user.email}.`,
  });
  return Response.json({
    ok: true,
    link: authorization.url,
    bank_account_id: account.id,
    authorization_id: authorization.authorization_id,
    history_days: REQUESTED_HISTORY_DAYS,
    renewal,
  });
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 80) || 'scheduled_sync_all';

    if (action === 'status') {
      return Response.json({
        ok: true,
        configured: providerConfigured(),
        provider: 'Enable Banking',
        country: DEFAULT_COUNTRY,
        requested_history_days: REQUESTED_HISTORY_DAYS,
        requested_access_days: REQUESTED_ACCESS_DAYS,
        automatic_sync_hours: SCHEDULED_SYNC_MIN_AGE_MS / 3600000,
        credential_names: ['ENABLE_BANKING_APPLICATION_ID', 'ENABLE_BANKING_PRIVATE_KEY'],
        production_requires_contract: true,
      });
    }

    if (action === 'scheduled_sync_all') {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (!isAdmin) return Response.json({ error: 'Solo una automatización administrativa puede ejecutar la sincronización global.' }, { status: 403 });
      if (!providerConfigured()) return Response.json({ ok: true, skipped: true, reason: 'provider_not_configured', processed: 0 });
      const token = await providerToken();
      const allAccounts = await base44.asServiceRole.entities.BankAccount.filter({ origen_datos: 'open_banking', activa: true }, 'fecha_ultima_sync', MAX_LIST);
      const eligibleAccounts = (allAccounts || [])
        .filter((account: any) => account.proveedor_integracion === 'enable_banking' && account.provider_account_id)
        .filter((account: any) => ['conectado', 'error'].includes(account.estado_conexion))
        .filter((account: any) => syncAgeMs(account) >= SCHEDULED_SYNC_MIN_AGE_MS);
      const eligible = eligibleAccounts.slice(0, MAX_SCHEDULED_ACCOUNTS);
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
      const reconciliations = [];
      for (const companyId of [...new Set(eligible.map((account: any) => account.company_id))]) {
        reconciliations.push({ company_id: companyId, ...(await autoReconcileCompany(base44, companyId, 'Conciliación automática Taxea')) });
      }
      return Response.json({ ok: true, ...summary, reconciliations, eligible_remaining: Math.max(0, eligibleAccounts.length - eligible.length), min_account_age_hours: SCHEDULED_SYNC_MIN_AGE_MS / 3600000 });
    }

    const companyId = await assertCompany(base44, user, body.company_id);

    if (action === 'classify_transaction') {
      const transaction = await ownedTransaction(base44, companyId, body.bank_transaction_id);
      if (transaction.estado_conciliacion === 'duplicada') {
        return Response.json({ error: 'Un movimiento duplicado no puede reclasificarse.' }, { status: 409 });
      }
      if (transaction.entidad_id) {
        return Response.json({ error: 'El movimiento ya está conciliado con un documento.' }, { status: 409 });
      }
      const status = clean(body.status, 40);
      if (!['movimiento_interno', 'descartada'].includes(status)) {
        return Response.json({ error: 'Clasificación bancaria no válida.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.BankTransaction.update(transaction.id, {
        estado_conciliacion: status,
        ...(status === 'movimiento_interno' ? { categoria_ia: 'transferencia_interna' } : {}),
        notas: `${clean(transaction.notas, 1500)}${transaction.notas ? '\n' : ''}${status === 'movimiento_interno' ? 'Marcado como movimiento interno' : 'Descartado de conciliación'} por ${user.email}.`,
      });
      return Response.json({ ok: true, transaction_id: transaction.id, status });
    }

    if (action === 'treasury_snapshot') {
      const [accounts, transactions] = await Promise.all([
        base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId }, '-created_date', MAX_LIST),
        base44.asServiceRole.entities.BankTransaction.filter({ company_id: companyId }, '-fecha_operacion', MAX_LIST),
      ]);
      const activeAccounts = (accounts || []).filter((account: any) => account.activa !== false);
      const activeAccountIds = new Set(activeAccounts.map((account: any) => account.id));
      const visibleTransactions = (transactions || []).filter((transaction: any) =>
        transaction.estado_conciliacion !== 'duplicada' && activeAccountIds.has(transaction.bank_account_id),
      );
      const safeAccounts = activeAccounts.map((account: any) => {
        const { authorization_id: _authorizationId, oauth_state: _oauthState, session_id: _sessionId, ...safe } = account;
        return safe;
      });
      const booked = visibleTransactions.filter((transaction: any) => transaction.estado_proveedor !== 'pending');
      const connected = activeAccounts.filter((account: any) => account.estado_conexion === 'conectado');
      const euroAccounts = connected.filter((account: any) => clean(account.moneda, 8).toUpperCase() === 'EUR');
      const reconciliationStates = new Set(['conciliada_auto', 'conciliada_manual']);
      const resolvedStates = new Set(['conciliada_auto', 'conciliada_manual', 'descartada', 'movimiento_interno']);
      const cashMovements = booked.filter((transaction: any) =>
        transaction.categoria_ia !== 'transferencia_interna' && transaction.estado_conciliacion !== 'movimiento_interno',
      );
      return Response.json({
        ok: true,
        accounts: safeAccounts,
        transactions: visibleTransactions,
        summary: {
          connected_accounts: connected.length,
          available_cash_eur: asMoney(euroAccounts.reduce((sum: number, account: any) => sum + Number(account.saldo_disponible || 0), 0)),
          reconciled_transactions: booked.filter((transaction: any) => reconciliationStates.has(transaction.estado_conciliacion)).length,
          unreconciled_transactions: booked.filter((transaction: any) => !resolvedStates.has(transaction.estado_conciliacion)).length,
          inflows: asMoney(cashMovements.filter((transaction: any) => transaction.tipo === 'entrada').reduce((sum: number, transaction: any) => sum + Number(transaction.importe || 0), 0)),
          outflows: asMoney(cashMovements.filter((transaction: any) => transaction.tipo === 'salida').reduce((sum: number, transaction: any) => sum + Number(transaction.importe || 0), 0)),
          last_sync: connected.map((account: any) => account.fecha_ultima_sync).filter(Boolean).sort().at(-1) || null,
        },
      });
    }

    if (action === 'auto_reconcile') {
      const result = await autoReconcileCompany(base44, companyId, user.full_name || user.email || 'Usuario');
      return Response.json({ ok: true, ...result });
    }

    const token = await providerToken();

    if (action === 'institutions') {
      const country = /^[A-Z]{2}$/.test(clean(body.country, 2).toUpperCase()) ? clean(body.country, 2).toUpperCase() : DEFAULT_COUNTRY;
      const result = await providerRequest(`/aspsps?country=${country}&service=AIS`, token);
      const institutions = (result?.aspsps || []).map((item: any) => ({
        id: `${item.country || country}:${item.name}`,
        name: item.name,
        country: item.country || country,
        bic: item.bic || '',
        logo: item.logo || item.group?.logo || '',
        transaction_total_days: null,
        max_access_valid_for_days: Math.max(1, Math.floor((Number(item.maximum_consent_validity) || REQUESTED_ACCESS_DAYS * 86400) / 86400)),
        psu_types: item.psu_types || [],
        beta: Boolean(item.beta),
      })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'es'));
      return Response.json({ ok: true, institutions });
    }

    if (action === 'create_link') {
      const institutionId = clean(body.institution_id, 500);
      if (!institutionId) return Response.json({ error: 'Selecciona un banco.' }, { status: 400 });
      const [country, ...nameParts] = institutionId.split(':');
      const bankName = nameParts.join(':');
      const result = await providerRequest(`/aspsps?country=${encodeURIComponent(country || DEFAULT_COUNTRY)}&service=AIS`, token);
      const institution = (result?.aspsps || []).find((item: any) => item.name === bankName && item.country === country);
      if (!institution) return Response.json({ error: 'El banco seleccionado ya no figura disponible en el proveedor.' }, { status: 409 });
      const institutionName = clean(institution.name, 300);
      const previousAttempts = await base44.asServiceRole.entities.BankAccount.filter({
        company_id: companyId,
        proveedor_integracion: 'enable_banking',
        institution_id: institutionName,
      }, '-created_date', 20);
      let account = (previousAttempts || []).find((item: any) => item.estado_conexion === 'error' && !item.provider_account_id);
      if (!account) {
        account = await base44.asServiceRole.entities.BankAccount.create({
          company_id: companyId,
          nombre_banco: institutionName || 'Banco',
          tipo_banco: providerSlug(institution.name) === 'revolut' ? 'neobanco' : 'tradicional',
          proveedor: providerSlug(institution.name),
          moneda: 'EUR',
          saldo_disponible: 0,
          saldo_contable: 0,
          estado_conexion: 'pendiente',
          proveedor_integracion: 'enable_banking',
          institution_id: institutionName,
          origen_datos: 'open_banking',
          sync_desde: `${new Date().getUTCFullYear()}-01-01`,
          dias_historico_disponibles: REQUESTED_HISTORY_DAYS,
          permisos_concedidos: ['saldos', 'datos de cuenta', 'movimientos'],
        });
      }
      try {
        return await startAuthorization(base44, token, user, companyId, institution, account, body, false);
      } catch (error) {
        await base44.asServiceRole.entities.BankAccount.update(account.id, { estado_conexion: 'error', ultimo_error_sync: publicError(error) }).catch(() => null);
        throw error;
      }
    }

    if (action === 'renew') {
      const account = await ownedAccount(base44, companyId, body.bank_account_id);
      const bankName = clean(account.institution_id || account.nombre_banco, 300);
      const result = await providerRequest(`/aspsps?country=${DEFAULT_COUNTRY}&service=AIS`, token);
      const institution = (result?.aspsps || []).find((item: any) => item.name === bankName);
      if (!institution) return Response.json({ error: 'El banco ya no figura disponible. Inicia una conexión nueva desde el catálogo.' }, { status: 409 });
      return await startAuthorization(base44, token, user, companyId, institution, account, body, true);
    }

    if (action === 'finalize') {
      const code = clean(body.code, 2000);
      const returnedState = clean(body.state, 200);
      let placeholder = body.bank_account_id
        ? await ownedAccount(base44, companyId, body.bank_account_id)
        : null;
      if (!placeholder && returnedState) {
        const matches = await base44.asServiceRole.entities.BankAccount.filter({
          company_id: companyId, agreement_id: returnedState, proveedor_integracion: 'enable_banking',
        }, '-created_date', 10);
        placeholder = (matches || [])[0] || null;
      }
      if (!placeholder) {
        return Response.json({ error: 'No se encontró la autorización bancaria pendiente. Reintenta la conexión.' }, { status: 404 });
      }
      if (placeholder.proveedor_integracion !== 'enable_banking') {
        return Response.json({ error: 'Esta autorización pertenece al proveedor anterior. Vuelve a conectar el banco.' }, { status: 409 });
      }
      const expectedState = clean(placeholder.oauth_state || placeholder.agreement_id, 200);
      if (!code) return Response.json({ error: 'Falta el código devuelto por el banco. Reintenta la conexión.' }, { status: 409 });
      if (expectedState && returnedState !== expectedState) return Response.json({ error: 'La respuesta bancaria no supera la validación de seguridad.' }, { status: 403 });
      const authorizationId = clean(placeholder.authorization_id || placeholder.requisition_id, 200);
      const finalizedResponse = async (waitAttempts = 1) => {
        let current = placeholder;
        for (let attempt = 0; attempt < waitAttempts; attempt += 1) {
          if (attempt > 0) {
            await sleep(250);
            current = await base44.asServiceRole.entities.BankAccount.get(placeholder.id).catch(() => current);
          }
          const savedState = clean(current.oauth_state, 200);
          const completedSessionId = clean(current.session_id || (current.provider_account_id ? current.requisition_id : ''), 200);
          if (savedState && savedState === returnedState && current.provider_account_id && completedSessionId) {
            let linked = await base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId, session_id: completedSessionId }, '-created_date', 50);
            if (!linked?.length) linked = await base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId, requisition_id: completedSessionId }, '-created_date', 50);
            return {
              ok: true,
              replayed: true,
              session_status: current.estado_conexion === 'conectado' ? 'AUTHORIZED' : 'PROCESSING',
              accounts: (linked?.length ? linked : [current]).map((item: any) => ({
                id: item.id, created: 0, updated: 0, duplicates: 0, balance: Number(item.saldo_disponible || 0),
              })),
            };
          }
        }
        return null;
      };
      const alreadyFinalized = await finalizedResponse();
      if (alreadyFinalized) return Response.json(alreadyFinalized);
      let session;
      try {
        session = await providerRequest('/sessions', token, { method: 'POST', body: JSON.stringify({ code }) });
      } catch (error) {
        if (/WRONG_SESSION_STATUS|Wrong session status/i.test(publicError(error))) {
          const replay = await finalizedResponse(20);
          if (replay) return Response.json(replay);
        }
        throw error;
      }
      const providerAccounts = Array.isArray(session?.accounts) ? session.accounts : [];
      if (!providerAccounts.length) return Response.json({ error: 'El banco no devolvió ninguna cuenta autorizada.' }, { status: 409 });
      const sessionId = clean(session.session_id, 200);
      const expires = new Date(session?.access?.valid_until || Date.now() + REQUESTED_ACCESS_DAYS * 86400000);
      const existingCompanyAccounts = await base44.asServiceRole.entities.BankAccount.filter({
        company_id: companyId, proveedor_integracion: 'enable_banking',
      }, '-created_date', MAX_LIST);
      const placeholderWasFresh = !clean(placeholder.provider_account_id, 200);
      const usedAccountIds = new Set<string>();
      const accounts = [];
      for (let index = 0; index < providerAccounts.length; index += 1) {
        const providerItem = providerAccounts[index];
        const providerAccountId = clean(providerItem.uid, 200);
        const iban = accountIban(providerItem);
        const providerCurrency = clean(providerItem.currency, 8).toUpperCase() || 'EUR';
        let account = (existingCompanyAccounts || []).find((item: any) =>
          !usedAccountIds.has(item.id) && clean(item.provider_account_id, 200) === providerAccountId,
        ) || null;
        if (!account && iban) {
          account = (existingCompanyAccounts || []).find((item: any) =>
            !usedAccountIds.has(item.id)
            && clean(item.iban, 80) === iban
            && clean(item.moneda, 8).toUpperCase() === providerCurrency,
          ) || null;
        }
        if (!account && index === 0 && !usedAccountIds.has(placeholder.id)) account = placeholder;
        if (!account) {
          account = await base44.asServiceRole.entities.BankAccount.create({
            company_id: companyId,
            nombre_banco: clean(session?.aspsp?.name, 300) || placeholder.nombre_banco,
            tipo_banco: placeholder.tipo_banco || 'tradicional',
            proveedor: placeholder.proveedor || 'otro',
            iban,
            ultimos_4: iban.slice(-4),
            titular: clean(providerItem.name, 300),
            moneda: providerCurrency,
            saldo_disponible: 0,
            saldo_contable: 0,
            estado_conexion: 'pendiente',
            proveedor_integracion: 'enable_banking',
            requisition_id: sessionId,
            agreement_id: sessionId,
            authorization_id: authorizationId,
            session_id: sessionId,
            oauth_state: returnedState,
            institution_id: clean(session?.aspsp?.name, 300) || placeholder.institution_id,
            provider_account_id: providerAccountId,
            origen_datos: 'open_banking',
            sync_desde: placeholder.sync_desde,
            fecha_consentimiento_expira: isoDate(expires),
            permisos_concedidos: placeholder.permisos_concedidos || ['saldos', 'datos de cuenta', 'movimientos'],
          });
        }
        await base44.asServiceRole.entities.BankAccount.update(account.id, {
          nombre_banco: clean(session?.aspsp?.name, 300) || account.nombre_banco,
          iban: iban || account.iban || '',
          ultimos_4: iban.slice(-4) || account.ultimos_4 || '',
          titular: clean(providerItem.name, 300) || account.titular || '',
          moneda: providerCurrency,
          estado_conexion: 'pendiente',
          proveedor_integracion: 'enable_banking',
          requisition_id: sessionId,
          agreement_id: sessionId,
          authorization_id: authorizationId,
          session_id: sessionId,
          oauth_state: returnedState,
          provider_account_id: providerAccountId,
          fecha_consentimiento_expira: isoDate(expires),
          activa: true,
        });
        usedAccountIds.add(account.id);
        if (!(existingCompanyAccounts || []).some((item: any) => item.id === account.id)) existingCompanyAccounts.push(account);
        account = { ...account, provider_account_id: providerAccountId, requisition_id: sessionId, agreement_id: sessionId, authorization_id: authorizationId, session_id: sessionId, oauth_state: returnedState, proveedor_integracion: 'enable_banking' };
        const result = await syncWithLog(base44, token, account, user, account.sync_desde);
        accounts.push({ id: account.id, ...result });
        if (index < providerAccounts.length - 1) await sleep(250);
      }
      if (placeholderWasFresh && !usedAccountIds.has(placeholder.id)) {
        await base44.asServiceRole.entities.BankAccount.update(placeholder.id, {
          estado_conexion: 'desconectado',
          activa: false,
          notas: `${clean(placeholder.notas, 1200)}${placeholder.notas ? '\n' : ''}Registro provisional sustituido por una cuenta bancaria ya existente durante la autorización.`,
        });
      }
      const consents = await base44.asServiceRole.entities.BankConsent.filter({ company_id: companyId, requisition_id: authorizationId }, '-created_date', 20);
      for (const consent of consents || []) {
        await base44.asServiceRole.entities.BankConsent.update(consent.id, {
          estado: 'activo',
          token_referencia: sessionId,
          agreement_id: sessionId,
          fecha_expiracion: isoDate(expires),
          nota_auditoria: `Consentimiento PSD2 activo. Autorizado por ${user.email}.`,
        });
      }
      const autoReconciliation = await autoReconcileCompany(base44, companyId, user.full_name || user.email || 'Usuario');
      return Response.json({ ok: true, accounts, session_status: 'AUTHORIZED', auto_reconciliation: autoReconciliation });
    }

    if (action === 'sync') {
      const account = await ownedAccount(base44, companyId, body.bank_account_id);
      const ageMs = syncAgeMs(account);
      if (!body.force && ageMs < MANUAL_SYNC_COOLDOWN_MS) {
        return Response.json({ ok: true, skipped: true, reason: 'recently_synced', created: 0, updated: 0, next_sync_at: new Date(Date.now() + (MANUAL_SYNC_COOLDOWN_MS - ageMs)).toISOString() });
      }
      const result = await syncWithLog(base44, token, account, user, account.sync_desde || `${new Date().getUTCFullYear()}-01-01`);
      const autoReconciliation = await autoReconcileCompany(base44, companyId, user.full_name || user.email || 'Usuario');
      return Response.json({ ok: true, ...result, auto_reconciliation: autoReconciliation });
    }

    if (action === 'disconnect') {
      const account = await ownedAccount(base44, companyId, body.bank_account_id);
      const sessionId = account.proveedor_integracion === 'enable_banking' ? clean(account.session_id || account.requisition_id, 200) : '';
      if (sessionId) {
        await providerRequest(`/sessions/${encodeURIComponent(sessionId)}`, token, { method: 'DELETE' }).catch(error => console.warn('[openBanking] remote revoke failed:', publicError(error)));
      }
      const linked = sessionId
        ? await base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId, requisition_id: sessionId }, '-created_date', 50)
        : [account];
      for (const linkedAccount of linked || [account]) {
        await base44.asServiceRole.entities.BankAccount.update(linkedAccount.id, { estado_conexion: 'desconectado', activa: false });
      }
      const consents = sessionId
        ? await base44.asServiceRole.entities.BankConsent.filter({ company_id: companyId, agreement_id: sessionId }, '-created_date', 100)
        : await base44.asServiceRole.entities.BankConsent.filter({ company_id: companyId, bank_account_id: account.id }, '-created_date', 100);
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

