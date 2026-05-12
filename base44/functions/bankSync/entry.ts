import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if ((ch === ';' || ch === ',') && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/[€$£\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function parseDate(str) {
  if (!str) return null;
  const formats = [
    { re: /^(\d{2})\/(\d{2})\/(\d{4})$/, fn: m => `${m[3]}-${m[2]}-${m[1]}` },
    { re: /^(\d{4})-(\d{2})-(\d{2})/, fn: m => `${m[1]}-${m[2]}-${m[3]}` },
    { re: /^(\d{2})-(\d{2})-(\d{4})$/, fn: m => `${m[3]}-${m[2]}-${m[1]}` },
  ];
  for (const { re, fn } of formats) {
    const m = str.match(re);
    if (m) return fn(m);
  }
  return str.substring(0, 10);
}

function detectCSVFormat(headers) {
  const h = headers.map(s => s.toLowerCase().replace(/\s/g, ''));
  if (h.some(x => x.includes('completeddate'))) return 'revolut';
  if (h.some(x => x.includes('transferid'))) return 'wise';
  if (h.some(x => x.includes('emitteddate'))) return 'qonto';
  return 'generic_es';
}

function normalizeRow(row, headers, format, bank_account_id, company_id) {
  const h = headers.map(s => s.toLowerCase().trim());
  const get = (keys) => {
    for (const k of keys) {
      const idx = h.findIndex(x => x.includes(k));
      if (idx >= 0 && row[idx] !== undefined) return row[idx];
    }
    return '';
  };

  let fecha_operacion, fecha_valor, concepto, importe, saldo, referencia, contraparte, iban_contraparte;

  if (format === 'revolut') {
    fecha_operacion = parseDate(get(['completed date', 'started date']));
    concepto = get(['description']);
    importe = parseAmount(get(['amount']));
    saldo = parseAmount(get(['balance']));
    referencia = get(['reference', 'id']);
  } else if (format === 'wise') {
    fecha_operacion = parseDate(get(['date']));
    concepto = get(['description']);
    importe = parseAmount(get(['amount', 'source amount']));
    saldo = parseAmount(get(['running balance', 'balance']));
    referencia = get(['transferid', 'id', 'reference']);
  } else if (format === 'qonto') {
    fecha_operacion = parseDate(get(['emitted date', 'settled date']));
    concepto = get(['label', 'description']);
    importe = parseAmount(get(['amount (eur)', 'amount']));
    saldo = parseAmount(get(['balance']));
    referencia = get(['id', 'reference']);
    contraparte = get(['counterpart name']);
  } else {
    fecha_operacion = parseDate(get(['fecha operacion', 'foperacion', 'fecha', 'fecha mov', 'date']));
    fecha_valor = parseDate(get(['fecha valor', 'fvalor', 'value date'])) || fecha_operacion;
    concepto = get(['concepto', 'descripcion', 'description', 'concepto movimiento', 'movimiento']);
    const cargo = parseAmount(get(['cargo', 'debito', 'debit', 'salida']));
    const abono = parseAmount(get(['abono', 'credito', 'credit', 'entrada', 'ingreso']));
    const importeRaw = parseAmount(get(['importe', 'amount']));
    importe = importeRaw !== 0 ? importeRaw : (abono > 0 ? abono : -cargo);
    saldo = parseAmount(get(['saldo', 'balance', 'saldo disponible']));
    referencia = get(['referencia', 'numero', 'ref', 'id']);
    contraparte = get(['beneficiario', 'ordenante', 'contraparte', 'nombre contraparte']);
    iban_contraparte = get(['iban', 'cuenta', 'iban contraparte']);
  }

  if (!fecha_operacion || !concepto) return null;
  const tipo = importe >= 0 ? 'entrada' : 'salida';

  return {
    company_id, bank_account_id,
    fecha_operacion,
    fecha_valor: fecha_valor || fecha_operacion,
    concepto: concepto.trim(),
    importe: Math.abs(importe),
    tipo, saldo_posterior: saldo || null,
    referencia: referencia || null,
    nombre_contraparte: contraparte || null,
    iban_contraparte: iban_contraparte || null,
    estado_conciliacion: 'sin_conciliar',
    moneda: 'EUR',
  };
}

function isDuplicate(tx, existing) {
  return existing.some(e =>
    e.fecha_operacion === tx.fecha_operacion &&
    Math.abs((e.importe || 0) - (tx.importe || 0)) < 0.01 &&
    e.tipo === tx.tipo &&
    (e.concepto || '').toLowerCase().substring(0, 20) === (tx.concepto || '').toLowerCase().substring(0, 20)
  );
}

function categorizeTx(tx) {
  const c = (tx.concepto || '').toLowerCase();
  if (/hacienda|aeat|tribut|iva|irpf|igic|seguridad social/.test(c)) return 'impuesto';
  if (/nomina|salario|sueldo|payroll/.test(c)) return 'nomina';
  if (/comision|mantenimiento cuenta|servicio bancario/.test(c)) return 'comision_bancaria';
  if (/transferencia interna|traspaso|between accounts/.test(c)) return 'transferencia_interna';
  if (/devolucion|refund|reembolso/.test(c)) return 'devolucion';
  if (/prestamo|hipoteca|leasing|credito/.test(c)) return 'prestamo';
  if (tx.tipo === 'entrada') return 'ingreso';
  return 'gasto';
}

// ─── API: Revolut Business ────────────────────────────────────────────────────
async function syncRevolut(accessToken, bank_account_id, company_id, base44, startMs) {
  // Obtener cuentas Revolut
  const accountsRes = await fetch('https://b2b.revolut.com/api/1.0/accounts', {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  if (!accountsRes.ok) throw new Error(`Revolut accounts error: ${accountsRes.status} ${await accountsRes.text()}`);
  const revAccounts = await accountsRes.json();

  // Tomar la primera cuenta EUR (o la que corresponda)
  const revAcc = revAccounts.find(a => a.currency === 'EUR') || revAccounts[0];
  if (!revAcc) throw new Error('No se encontró cuenta EUR en Revolut');

  const balance = revAcc.balance;

  // Obtener transacciones últimos 90 días
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const txRes = await fetch(
    `https://b2b.revolut.com/api/1.0/transactions?from=${from.toISOString()}&count=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!txRes.ok) throw new Error(`Revolut transactions error: ${txRes.status}`);
  const revTxs = await txRes.json();

  const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);

  const normalized = revTxs
    .filter(t => t.state === 'completed' && t.legs && t.legs.length > 0)
    .map(t => {
      const leg = t.legs[0];
      const importe = Math.abs(leg.amount);
      const tipo = leg.amount >= 0 ? 'entrada' : 'salida';
      return {
        company_id, bank_account_id,
        fecha_operacion: t.completed_at?.substring(0, 10) || t.created_at?.substring(0, 10),
        fecha_valor: t.completed_at?.substring(0, 10),
        concepto: t.reference || leg.description || t.type || 'Movimiento Revolut',
        importe, tipo,
        saldo_posterior: leg.balance !== undefined ? leg.balance : null,
        referencia: t.id,
        nombre_contraparte: leg.counterpart?.name || null,
        iban_contraparte: leg.counterpart?.account_number || null,
        moneda: leg.currency || 'EUR',
        estado_conciliacion: 'sin_conciliar',
        categoria_ia: categorizeTx({ concepto: t.reference || leg.description, tipo }),
      };
    })
    .filter(tx => tx.fecha_operacion && !isDuplicate(tx, existing));

  if (normalized.length > 0) await base44.entities.BankTransaction.bulkCreate(normalized);

  await base44.entities.BankAccount.update(bank_account_id, {
    saldo_disponible: balance,
    saldo_contable: balance,
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
  });

  return { movimientos_nuevos: normalized.length, saldo: balance, proveedor: 'revolut' };
}

// ─── API: Wise Business ───────────────────────────────────────────────────────
async function syncWise(apiToken, bank_account_id, company_id, base44) {
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

  // Obtener perfiles
  const profilesRes = await fetch('https://api.wise.com/v1/profiles', { headers });
  if (!profilesRes.ok) throw new Error(`Wise profiles error: ${profilesRes.status}`);
  const profiles = await profilesRes.json();
  const bizProfile = profiles.find(p => p.type === 'BUSINESS') || profiles[0];
  if (!bizProfile) throw new Error('No se encontró perfil Business en Wise');

  // Obtener borderless accounts
  const balancesRes = await fetch(`https://api.wise.com/v4/profiles/${bizProfile.id}/balances?types=STANDARD`, { headers });
  if (!balancesRes.ok) throw new Error(`Wise balances error: ${balancesRes.status}`);
  const balances = await balancesRes.json();
  const eurBalance = balances.find(b => b.currency === 'EUR') || balances[0];
  const balance = eurBalance?.amount?.value || 0;

  // Obtener transacciones
  const from = new Date(); from.setDate(from.getDate() - 90);
  const txRes = await fetch(
    `https://api.wise.com/v1/profiles/${bizProfile.id}/transfers?status=outgoing_payment_sent&createdDateStart=${from.toISOString().split('T')[0]}&limit=100`,
    { headers }
  );

  const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);
  let normalized = [];

  if (txRes.ok) {
    const wiseTxs = await txRes.json();
    normalized = wiseTxs
      .filter(t => t.status === 'outgoing_payment_sent' || t.status === 'funds_converted')
      .map(t => ({
        company_id, bank_account_id,
        fecha_operacion: t.created?.substring(0, 10),
        fecha_valor: t.created?.substring(0, 10),
        concepto: t.details?.reference || `Transferencia Wise ${t.id}`,
        importe: Math.abs(t.sourceValue || t.targetValue || 0),
        tipo: 'salida',
        referencia: String(t.id),
        nombre_contraparte: t.targetAccount || null,
        moneda: t.sourceCurrency || 'EUR',
        estado_conciliacion: 'sin_conciliar',
        categoria_ia: 'gasto',
      }))
      .filter(tx => tx.fecha_operacion && !isDuplicate(tx, existing));

    if (normalized.length > 0) await base44.entities.BankTransaction.bulkCreate(normalized);
  }

  await base44.entities.BankAccount.update(bank_account_id, {
    saldo_disponible: balance,
    saldo_contable: balance,
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
  });

  return { movimientos_nuevos: normalized.length, saldo: balance, proveedor: 'wise' };
}

// ─── API: Qonto ───────────────────────────────────────────────────────────────
async function syncQonto(login, secretKey, bank_account_id, company_id, base44) {
  const auth = btoa(`${login}:${secretKey}`);
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // Obtener organización y cuenta
  const orgRes = await fetch('https://thirdparty.qonto.com/v2/organization', { headers });
  if (!orgRes.ok) throw new Error(`Qonto org error: ${orgRes.status} ${await orgRes.text()}`);
  const orgData = await orgRes.json();
  const bankAccount = orgData.organization?.bank_accounts?.[0];
  const balance = bankAccount?.balance_cents ? bankAccount.balance_cents / 100 : 0;
  const ibanQonto = bankAccount?.iban || '';

  // Obtener transacciones
  const from = new Date(); from.setDate(from.getDate() - 90);
  const txRes = await fetch(
    `https://thirdparty.qonto.com/v2/transactions?iban=${ibanQonto}&settled_at_from=${from.toISOString()}&per_page=100`,
    { headers }
  );
  if (!txRes.ok) throw new Error(`Qonto transactions error: ${txRes.status}`);
  const txData = await txRes.json();

  const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);

  const normalized = (txData.transactions || [])
    .filter(t => t.status === 'completed')
    .map(t => {
      const importe = Math.abs(t.amount_cents / 100);
      const tipo = t.side === 'credit' ? 'entrada' : 'salida';
      return {
        company_id, bank_account_id,
        fecha_operacion: t.settled_at?.substring(0, 10) || t.emitted_at?.substring(0, 10),
        fecha_valor: t.settled_at?.substring(0, 10),
        concepto: t.label || t.reference || `Movimiento Qonto ${t.transaction_id}`,
        importe, tipo,
        referencia: t.transaction_id,
        nombre_contraparte: t.counterparty_name || null,
        moneda: t.currency || 'EUR',
        estado_conciliacion: 'sin_conciliar',
        categoria_ia: categorizeTx({ concepto: t.label || t.reference, tipo }),
      };
    })
    .filter(tx => tx.fecha_operacion && !isDuplicate(tx, existing));

  if (normalized.length > 0) await base44.entities.BankTransaction.bulkCreate(normalized);

  await base44.entities.BankAccount.update(bank_account_id, {
    saldo_disponible: balance,
    saldo_contable: balance,
    iban: ibanQonto,
    ultimos_4: ibanQonto.slice(-4),
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
  });

  return { movimientos_nuevos: normalized.length, saldo: balance, proveedor: 'qonto' };
}

// ─── API: GoCardless/Nordigen (BBVA, Santander, CaixaBank via Open Banking) ──
async function getGoCardlessToken() {
  const clientId = Deno.env.get('NORDIC_API_CLIENT_ID');
  const clientSecret = Deno.env.get('NORDIC_API_SECRET');
  const res = await fetch('https://bankaccountdata.gocardless.com/api/v2/token/new/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: clientId, secret_key: clientSecret }),
  });
  if (!res.ok) throw new Error(`GoCardless token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access;
}

async function syncGoCardless(requisitionId, bank_account_id, company_id, base44) {
  const token = await getGoCardlessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Obtener accounts del requisition
  const reqRes = await fetch(`https://bankaccountdata.gocardless.com/api/v2/requisitions/${requisitionId}/`, { headers });
  if (!reqRes.ok) throw new Error(`GoCardless requisition error: ${reqRes.status}`);
  const reqData = await reqRes.json();
  const accountId = reqData.accounts?.[0];
  if (!accountId) throw new Error('No se encontraron cuentas en el requisition');

  // Obtener saldo
  const balRes = await fetch(`https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/balances/`, { headers });
  if (!balRes.ok) throw new Error(`GoCardless balance error: ${balRes.status}`);
  const balData = await balRes.json();
  const bal = balData.balances?.find(b => b.balanceType === 'interimAvailable' || b.balanceType === 'closingBooked');
  const balance = parseFloat(bal?.balanceAmount?.amount || 0);

  // Obtener transacciones
  const from = new Date(); from.setDate(from.getDate() - 90);
  const txRes = await fetch(
    `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/transactions/?date_from=${from.toISOString().split('T')[0]}`,
    { headers }
  );
  if (!txRes.ok) throw new Error(`GoCardless transactions error: ${txRes.status}`);
  const txData = await txRes.json();

  const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);
  const allTxs = [
    ...(txData.transactions?.booked || []).map(t => ({ ...t, _status: 'booked' })),
    ...(txData.transactions?.pending || []).map(t => ({ ...t, _status: 'pending' })),
  ];

  const normalized = allTxs.map(t => {
    const importeRaw = parseFloat(t.transactionAmount?.amount || 0);
    const tipo = importeRaw >= 0 ? 'entrada' : 'salida';
    return {
      company_id, bank_account_id,
      fecha_operacion: t.bookingDate || t.valueDate,
      fecha_valor: t.valueDate || t.bookingDate,
      concepto: t.remittanceInformationUnstructured || t.creditorName || t.debtorName || 'Movimiento bancario',
      importe: Math.abs(importeRaw),
      tipo,
      referencia: t.transactionId || t.entryReference,
      nombre_contraparte: tipo === 'salida' ? t.creditorName : t.debtorName,
      iban_contraparte: tipo === 'salida' ? t.creditorAccount?.iban : t.debtorAccount?.iban,
      moneda: t.transactionAmount?.currency || 'EUR',
      estado_conciliacion: 'sin_conciliar',
      categoria_ia: categorizeTx({ concepto: t.remittanceInformationUnstructured || t.creditorName, tipo }),
    };
  }).filter(tx => tx.fecha_operacion && !isDuplicate(tx, existing));

  if (normalized.length > 0) await base44.entities.BankTransaction.bulkCreate(normalized);

  await base44.entities.BankAccount.update(bank_account_id, {
    saldo_disponible: balance,
    saldo_contable: balance,
    estado_conexion: 'conectado',
    fecha_ultima_sync: new Date().toISOString(),
  });

  return { movimientos_nuevos: normalized.length, saldo: balance };
}

// ─── Crear link de autorización GoCardless ───────────────────────────────────
async function createGoCardlessRequisition(bankId, redirectUrl, company_id) {
  const token = await getGoCardlessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Crear end user agreement
  const agreementRes = await fetch('https://bankaccountdata.gocardless.com/api/v2/agreements/enduser/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ institution_id: bankId, max_historical_days: 90, access_valid_for_days: 90, access_scope: ['balances', 'details', 'transactions'] }),
  });
  if (!agreementRes.ok) throw new Error(`GoCardless agreement error: ${agreementRes.status} ${await agreementRes.text()}`);
  const agreement = await agreementRes.json();

  // Crear requisition
  const reqRes = await fetch('https://bankaccountdata.gocardless.com/api/v2/requisitions/', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: bankId,
      reference: `taxea_${company_id}_${Date.now()}`,
      agreement: agreement.id,
      language: 'ES',
    }),
  });
  if (!reqRes.ok) throw new Error(`GoCardless requisition error: ${reqRes.status} ${await reqRes.text()}`);
  const req = await reqRes.json();

  return { link: req.link, requisition_id: req.id };
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startMs = Date.now();
  const base44 = createClientFromRequest(req);

  let user;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, bank_account_id, company_id } = body;

  if (!bank_account_id || !company_id) {
    return Response.json({ error: 'bank_account_id y company_id son requeridos' }, { status: 400 });
  }

  // ── Sync API real (Revolut, Wise, Qonto, bancos GoCardless) ─────────────
  if (action === 'api_sync') {
    const { proveedor, access_token, requisition_id } = body;

    let syncLog;
    try {
      syncLog = await base44.entities.BankSyncLog.create({
        company_id, bank_account_id,
        tipo: 'api_direct', estado: 'en_proceso',
        proveedor_api: proveedor, iniciado_por: user.email,
      });

      await base44.entities.BankAccount.update(bank_account_id, { estado_conexion: 'sincronizando' });

      let result;

      if (proveedor === 'revolut') {
        const token = access_token || Deno.env.get('REVOLUT_CLIENT_SECRET');
        result = await syncRevolut(token, bank_account_id, company_id, base44, startMs);
      } else if (proveedor === 'wise') {
        const token = access_token || Deno.env.get('WISE_API_TOKEN');
        result = await syncWise(token, bank_account_id, company_id, base44);
      } else if (proveedor === 'qonto') {
        const login = Deno.env.get('QONTO_LOGIN');
        const secret = Deno.env.get('QONTO_SECRET_KEY');
        result = await syncQonto(login, secret, bank_account_id, company_id, base44);
      } else if (['bbva', 'santander', 'caixabank', 'sabadell', 'bankinter', 'ing'].includes(proveedor)) {
        const reqId = requisition_id || body.requisition_id;
        if (!reqId) return Response.json({ error: 'requisition_id requerido para bancos PSD2' }, { status: 400 });
        result = await syncGoCardless(reqId, bank_account_id, company_id, base44);
      } else {
        return Response.json({ error: `Proveedor ${proveedor} no soportado para sync API` }, { status: 400 });
      }

      const duracion = Date.now() - startMs;
      await base44.entities.BankSyncLog.update(syncLog.id, {
        estado: 'completado', movimientos_nuevos: result.movimientos_nuevos,
        saldo_despues: result.saldo, duracion_ms: duracion,
      });

      return Response.json({ ok: true, ...result, duracion_ms: duracion });

    } catch (err) {
      if (syncLog) {
        await base44.entities.BankSyncLog.update(syncLog.id, { estado: 'error', error_detalle: err.message });
      }
      await base44.entities.BankAccount.update(bank_account_id, { estado_conexion: 'error' });
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ── Crear link OAuth GoCardless ───────────────────────────────────────────
  if (action === 'create_gocardless_link') {
    const { institution_id, redirect_url } = body;
    if (!institution_id) return Response.json({ error: 'institution_id requerido' }, { status: 400 });
    const redirectUrl = redirect_url || 'https://app.taxea.es/finance/treasury';
    const result = await createGoCardlessRequisition(institution_id, redirectUrl, company_id);
    // Guardar requisition_id en la cuenta para futura sincronización
    await base44.entities.BankAccount.update(bank_account_id, {
      proveedor_integracion: result.requisition_id,
      estado_conexion: 'pendiente',
    });
    return Response.json({ ok: true, ...result });
  }

  // ── Importar CSV ──────────────────────────────────────────────────────────
  if (action === 'import_csv') {
    const { csv_content, csv_filename } = body;
    if (!csv_content) return Response.json({ error: 'csv_content requerido' }, { status: 400 });

    const syncLog = await base44.entities.BankSyncLog.create({
      company_id, bank_account_id, tipo: 'csv_import', estado: 'en_proceso',
      fuente_archivo: csv_filename || 'extracto.csv', iniciado_por: user.email,
    });

    const lines = csv_content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      await base44.entities.BankSyncLog.update(syncLog.id, { estado: 'error', error_detalle: 'CSV vacío' });
      return Response.json({ error: 'CSV vacío' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const format = detectCSVFormat(headers);
    const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);

    const parsed = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue;
      const tx = normalizeRow(row, headers, format, bank_account_id, company_id);
      if (!tx) { errors.push(`Línea ${i + 1}: no parseable`); continue; }
      tx.categoria_ia = categorizeTx(tx);
      parsed.push(tx);
    }

    const nuevos = parsed.filter(tx => !isDuplicate(tx, existing));
    const duplicados = parsed.length - nuevos.length;
    if (nuevos.length > 0) await base44.entities.BankTransaction.bulkCreate(nuevos);

    const lastWithSaldo = [...nuevos].reverse().find(t => t.saldo_posterior !== null);
    await base44.entities.BankAccount.update(bank_account_id, {
      ...(lastWithSaldo?.saldo_posterior ? { saldo_disponible: lastWithSaldo.saldo_posterior, saldo_contable: lastWithSaldo.saldo_posterior } : {}),
      fecha_ultima_sync: new Date().toISOString(),
      estado_conexion: 'conectado',
    });

    const duracion = Date.now() - startMs;
    await base44.entities.BankSyncLog.update(syncLog.id, {
      estado: 'completado', movimientos_nuevos: nuevos.length,
      movimientos_duplicados: duplicados, duracion_ms: duracion,
      error_detalle: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });

    return Response.json({ ok: true, format_detectado: format, movimientos_nuevos: nuevos.length, movimientos_duplicados: duplicados, duracion_ms: duracion });
  }

  // ── Sync mock ────────────────────────────────────────────────────────────
  if (action === 'sync_mock') {
    const accounts = await base44.asServiceRole.entities.BankAccount.filter({ id: bank_account_id });
    if (!accounts.length) return Response.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    await base44.entities.BankAccount.update(bank_account_id, { estado_conexion: 'sincronizando' });
    await new Promise(r => setTimeout(r, 1200));
    const syncLog = await base44.entities.BankSyncLog.create({
      company_id, bank_account_id, tipo: 'manual', estado: 'completado',
      movimientos_nuevos: 0, saldo_antes: accounts[0].saldo_disponible,
      saldo_despues: accounts[0].saldo_disponible, duracion_ms: Date.now() - startMs, iniciado_por: user.email,
    });
    await base44.entities.BankAccount.update(bank_account_id, { fecha_ultima_sync: new Date().toISOString(), estado_conexion: 'conectado' });
    return Response.json({ ok: true, sync_log_id: syncLog.id });
  }

  // ── Revocar consentimiento ────────────────────────────────────────────────
  if (action === 'revoke_consent') {
    const consents = await base44.entities.BankConsent.filter({ bank_account_id, estado: 'activo' });
    for (const c of consents) {
      await base44.entities.BankConsent.update(c.id, {
        estado: 'revocado', revocado_por: user.email,
        fecha_revocacion: new Date().toISOString(), motivo_revocacion: body.motivo || 'Revocado por usuario',
      });
    }
    await base44.entities.BankAccount.update(bank_account_id, { estado_conexion: 'desconectado' });
    return Response.json({ ok: true, consents_revoked: consents.length });
  }

  // ── Crear consentimiento ──────────────────────────────────────────────────
  if (action === 'create_consent') {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 90);
    const consent = await base44.entities.BankConsent.create({
      company_id, bank_account_id,
      proveedor: body.proveedor || 'psd2',
      tipo_conexion: body.tipo_conexion || 'psd2',
      estado: 'activo',
      permisos: body.permisos || ['saldos', 'movimientos', 'identificacion'],
      fecha_consentimiento: new Date().toISOString(),
      fecha_expiracion: expiration.toISOString().split('T')[0],
      nota_auditoria: `Consentimiento creado por ${user.email} desde Taxea Treasury`,
    });
    return Response.json({ ok: true, consent_id: consent.id });
  }

  return Response.json({ error: 'Acción no reconocida' }, { status: 400 });
});