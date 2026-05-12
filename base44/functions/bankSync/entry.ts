import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Normalización de movimientos CSV ───────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ';' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/[€$£\s]/g, '').replace('.', '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function parseDate(str) {
  if (!str) return null;
  // Try DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const formats = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];
  for (const fmt of formats) {
    const m = str.match(fmt);
    if (m) {
      if (str.includes('-') && m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
      if (str.includes('/')) return `${m[3]}-${m[2]}-${m[1]}`;
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
  }
  return str.substring(0, 10);
}

function detectCSVFormat(headers) {
  const h = headers.map(s => s.toLowerCase().replace(/[^a-záéíóúñ]/g, ''));
  // Revolut format
  if (h.some(x => x.includes('completeddate'))) return 'revolut';
  // Wise format
  if (h.some(x => x.includes('transferid'))) return 'wise';
  // Qonto format
  if (h.some(x => x.includes('emitteddate'))) return 'qonto';
  // BBVA / generic Spanish bank
  if (h.some(x => x.includes('foperacion') || x.includes('fecha'))) return 'generic_es';
  return 'generic';
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
    fecha_operacion = parseDate(get(['completed date', 'completeddate', 'started date']));
    fecha_valor = fecha_operacion;
    concepto = get(['description', 'descripcion']);
    importe = parseAmount(get(['amount', 'importe']));
    saldo = parseAmount(get(['balance', 'saldo']));
    referencia = get(['reference', 'referencia', 'id']);
  } else if (format === 'wise') {
    fecha_operacion = parseDate(get(['date', 'fecha']));
    fecha_valor = fecha_operacion;
    concepto = get(['description', 'descripcion']);
    importe = parseAmount(get(['amount', 'source amount']));
    saldo = parseAmount(get(['balance', 'running balance']));
    referencia = get(['transferid', 'id', 'reference']);
  } else if (format === 'qonto') {
    fecha_operacion = parseDate(get(['emitted date', 'emitteddate', 'settled date']));
    fecha_valor = fecha_operacion;
    concepto = get(['label', 'description']);
    importe = parseAmount(get(['amount', 'amount (eur)']));
    saldo = parseAmount(get(['balance', 'vat amount']));
    referencia = get(['id', 'reference']);
    contraparte = get(['counterpart name', 'counterpartname']);
  } else {
    // Generic Spanish bank (BBVA, Santander, CaixaBank, etc.)
    fecha_operacion = parseDate(get(['fecha operacion', 'foperacion', 'fecha', 'date', 'fecha mov']));
    fecha_valor = parseDate(get(['fecha valor', 'fvalor', 'value date'])) || fecha_operacion;
    concepto = get(['concepto', 'descripcion', 'description', 'concepto movimiento', 'movimiento']);
    const cargo = parseAmount(get(['cargo', 'debito', 'debit', 'salida']));
    const abono = parseAmount(get(['abono', 'credito', 'credit', 'entrada', 'ingreso']));
    const importeRaw = parseAmount(get(['importe', 'amount', 'impor']));
    importe = importeRaw !== 0 ? importeRaw : (abono > 0 ? abono : -cargo);
    saldo = parseAmount(get(['saldo', 'balance', 'saldo disponible']));
    referencia = get(['referencia', 'numero', 'ref', 'id']);
    contraparte = get(['beneficiario', 'ordenante', 'contraparte', 'nombre contraparte']);
    iban_contraparte = get(['iban', 'cuenta', 'iban contraparte']);
  }

  if (!fecha_operacion || !concepto) return null;

  const tipo = importe >= 0 ? 'entrada' : 'salida';

  return {
    company_id,
    bank_account_id,
    fecha_operacion,
    fecha_valor: fecha_valor || fecha_operacion,
    concepto: concepto.trim(),
    importe: Math.abs(importe),
    tipo,
    saldo_posterior: saldo || null,
    referencia: referencia || null,
    nombre_contraparte: contraparte || null,
    iban_contraparte: iban_contraparte || null,
    estado_conciliacion: 'sin_conciliar',
    moneda: 'EUR',
  };
}

// ─── Detección de duplicados ─────────────────────────────────────────────────

function isDuplicate(tx, existing) {
  return existing.some(e =>
    e.fecha_operacion === tx.fecha_operacion &&
    Math.abs((e.importe || 0) - (tx.importe || 0)) < 0.01 &&
    e.tipo === tx.tipo &&
    (e.concepto || '').toLowerCase().substring(0, 20) === (tx.concepto || '').toLowerCase().substring(0, 20)
  );
}

// ─── Categorización IA básica (sin llamada externa) ──────────────────────────

function categorizeTx(tx) {
  const c = (tx.concepto || '').toLowerCase();
  if (/hacienda|aeat|tribut|iva|irpf|igic|seguridad social/.test(c)) return 'impuesto';
  if (/nomina|salario|sueldo|payroll/.test(c)) return 'nomina';
  if (/comision|mantenimiento cuenta|servicio bancario/.test(c)) return 'comision_bancaria';
  if (/transferencia interna|traspaso|between accounts/.test(c)) return 'transferencia_interna';
  if (/devolucion|refund|reembolso/.test(c)) return 'devolucion';
  if (/prestamo|hipoteca|leasing|credito/.test(c)) return 'prestamo';
  if (tx.tipo === 'entrada') return 'ingreso';
  if (tx.tipo === 'salida') return 'gasto';
  return 'otro';
}

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startMs = Date.now();

  const base44 = createClientFromRequest(req);

  let user;
  try {
    user = await base44.auth.me();
  } catch {
    user = null;
  }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, bank_account_id, company_id, csv_content, csv_filename } = body;

  if (!bank_account_id || !company_id) {
    return Response.json({ error: 'bank_account_id y company_id son requeridos' }, { status: 400 });
  }

  // ── Acción: importar CSV ─────────────────────────────────────────────────
  if (action === 'import_csv') {
    if (!csv_content) return Response.json({ error: 'csv_content requerido' }, { status: 400 });

    // Crear log de sincronización
    const syncLog = await base44.entities.BankSyncLog.create({
      company_id,
      bank_account_id,
      tipo: 'csv_import',
      estado: 'en_proceso',
      fuente_archivo: csv_filename || 'extracto.csv',
      iniciado_por: user.email,
    });

    const lines = csv_content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      await base44.entities.BankSyncLog.update(syncLog.id, { estado: 'error', error_detalle: 'Archivo CSV vacío o sin datos' });
      return Response.json({ error: 'CSV vacío o sin datos' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const format = detectCSVFormat(headers);

    // Obtener movimientos existentes para deduplicar
    const existing = await base44.entities.BankTransaction.filter({ bank_account_id }, '-fecha_operacion', 500);

    const parsed = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue;
      const tx = normalizeRow(row, headers, format, bank_account_id, company_id);
      if (!tx) { errors.push(`Línea ${i + 1}: no se pudo parsear`); continue; }
      tx.categoria_ia = categorizeTx(tx);
      parsed.push(tx);
    }

    // Filtrar duplicados
    const nuevos = parsed.filter(tx => !isDuplicate(tx, existing));
    const duplicados = parsed.length - nuevos.length;

    if (nuevos.length > 0) {
      await base44.entities.BankTransaction.bulkCreate(nuevos);
    }

    // Actualizar saldo de la cuenta si hay movimientos con saldo posterior
    const lastWithSaldo = [...nuevos].reverse().find(t => t.saldo_posterior !== null);
    if (lastWithSaldo?.saldo_posterior) {
      await base44.entities.BankAccount.update(bank_account_id, {
        saldo_disponible: lastWithSaldo.saldo_posterior,
        saldo_contable: lastWithSaldo.saldo_posterior,
        fecha_ultima_sync: new Date().toISOString(),
        estado_conexion: 'conectado',
      });
    } else {
      await base44.entities.BankAccount.update(bank_account_id, {
        fecha_ultima_sync: new Date().toISOString(),
        estado_conexion: 'conectado',
      });
    }

    const duracion = Date.now() - startMs;
    await base44.entities.BankSyncLog.update(syncLog.id, {
      estado: errors.length > 0 && nuevos.length === 0 ? 'error' : 'completado',
      movimientos_nuevos: nuevos.length,
      movimientos_duplicados: duplicados,
      error_detalle: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      duracion_ms: duracion,
    });

    return Response.json({
      ok: true,
      format_detectado: format,
      movimientos_nuevos: nuevos.length,
      movimientos_duplicados: duplicados,
      errores: errors.slice(0, 5),
      duracion_ms: duracion,
    });
  }

  // ── Acción: sync manual (mock/demo) ──────────────────────────────────────
  if (action === 'sync_mock') {
    const account = await base44.asServiceRole.entities.BankAccount.filter({ id: bank_account_id });
    if (!account.length) return Response.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    await base44.entities.BankAccount.update(bank_account_id, {
      estado_conexion: 'sincronizando',
    });

    // Simular latencia de API real
    await new Promise(r => setTimeout(r, 1500));

    const syncLog = await base44.entities.BankSyncLog.create({
      company_id,
      bank_account_id,
      tipo: 'auto',
      estado: 'completado',
      movimientos_nuevos: 0,
      movimientos_duplicados: 0,
      saldo_antes: account[0].saldo_disponible,
      saldo_despues: account[0].saldo_disponible,
      duracion_ms: Date.now() - startMs,
      iniciado_por: user.email,
    });

    await base44.entities.BankAccount.update(bank_account_id, {
      fecha_ultima_sync: new Date().toISOString(),
      estado_conexion: 'conectado',
    });

    return Response.json({ ok: true, sync_log_id: syncLog.id, mensaje: 'Sincronización completada (modo demo)' });
  }

  // ── Acción: revocar consentimiento ───────────────────────────────────────
  if (action === 'revoke_consent') {
    const consents = await base44.entities.BankConsent.filter({ bank_account_id, estado: 'activo' });
    for (const c of consents) {
      await base44.entities.BankConsent.update(c.id, {
        estado: 'revocado',
        revocado_por: user.email,
        fecha_revocacion: new Date().toISOString(),
        motivo_revocacion: body.motivo || 'Revocado por usuario',
      });
    }
    await base44.entities.BankAccount.update(bank_account_id, { estado_conexion: 'desconectado' });

    return Response.json({ ok: true, consents_revoked: consents.length });
  }

  // ── Acción: crear consentimiento ─────────────────────────────────────────
  if (action === 'create_consent') {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 90);
    const consent = await base44.entities.BankConsent.create({
      company_id,
      bank_account_id,
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

  return Response.json({ error: 'Acción no reconocida. Acciones válidas: import_csv, sync_mock, revoke_consent, create_consent' }, { status: 400 });
});