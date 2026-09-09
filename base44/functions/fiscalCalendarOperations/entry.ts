import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const RULESET = 'taxea-fiscal-calendar-es-2026.09.09-v1';
const VERIFIED_CALENDAR_YEAR = 2026;
const clean = (value: unknown) => String(value ?? '').trim();
const iso = (date: Date) => date.toISOString().slice(0, 10);
const normalizeCode = (value: unknown) => clean(value).toLowerCase().replace(/^modelo_/, '').replace(/_igic$/, '').replace(/\D/g, '');
const normalizePeriod = (value: unknown) => {
  const raw = clean(value).toUpperCase().replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.includes('ANUAL') || raw === 'A') return 'ANUAL';
  const quarter = raw.match(/(?:T([1-4])|([1-4])T)/);
  if (quarter) return `T${quarter[1] || quarter[2]}`;
  const month = raw.match(/(?:M)?(0[1-9]|1[0-2])(?:M)?/);
  if (month) return `M${month[1]}`;
  if (/^P[123]$/.test(raw)) return raw;
  return raw;
};
const roleOf = (user: any) => clean(user?.role || user?.data?.role).toLowerCase();
const privileged = (user: any) => ['admin', 'super_admin', 'advisor', 'asesor'].includes(roleOf(user));

const SOURCES = [
  { authority: 'AEAT', year: 2026, title: 'Calendario del contribuyente 2026', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026.html' },
  { authority: 'AEAT', year: 2026, title: 'Plazos de autoliquidaciones con domiciliacion bancaria 2026', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/plazos-presentacion-autoliquidaciones-domiciliacion-bancaria.html' },
  { authority: 'ATC', year: 2026, title: 'Calendario tributario 2026', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/calendario-tributario-2026' },
  { authority: 'ATC', year: 2026, title: 'Plazos de presentacion telematica con domiciliacion bancaria 2026', url: 'https://www3.gobiernodecanarias.org/tributos/atc/es/2026-/-plazos-de-presentaci%C3%B3n-telem%C3%A1tica-con-domiciliaci%C3%B3n-bancaria' },
];

const MODEL_META: Record<string, any> = {
  '036': ['Declaracion censal', 'AEAT', 'censal'], '037': ['Declaracion censal simplificada', 'AEAT', 'censal'],
  '111': ['Retenciones de trabajo y actividades economicas', 'AEAT', 'retenciones'], '115': ['Retenciones por alquileres urbanos', 'AEAT', 'retenciones'],
  '123': ['Retenciones de capital mobiliario', 'AEAT', 'retenciones'], '130': ['Pago fraccionado IRPF estimacion directa', 'AEAT', 'irpf'],
  '131': ['Pago fraccionado IRPF estimacion objetiva', 'AEAT', 'irpf'], '180': ['Resumen anual de alquileres', 'AEAT', 'retenciones'],
  '190': ['Resumen anual de retenciones', 'AEAT', 'retenciones'], '193': ['Resumen anual de capital mobiliario', 'AEAT', 'retenciones'],
  '200': ['Impuesto sobre Sociedades', 'AEAT', 'sociedades'], '202': ['Pagos fraccionados de Sociedades', 'AEAT', 'sociedades'],
  '210': ['IRNR sin establecimiento permanente', 'AEAT', 'no_residentes'], '216': ['Retenciones de no residentes', 'AEAT', 'no_residentes'],
  '296': ['Resumen anual de retenciones de no residentes', 'AEAT', 'no_residentes'], '303': ['Autoliquidacion IVA', 'AEAT', 'iva'],
  '309': ['Autoliquidacion IVA no periodica', 'AEAT', 'iva'], '322': ['IVA grupo de entidades individual', 'AEAT', 'iva'],
  '347': ['Operaciones con terceras personas', 'AEAT', 'informativa'], '349': ['Operaciones intracomunitarias', 'AEAT', 'iva'],
  '353': ['IVA grupo de entidades agregado', 'AEAT', 'iva'], '368': ['IVA servicios electronicos - regimen anterior', 'AEAT', 'iva'],
  '369': ['IVA ventanilla unica OSS/IOSS', 'AEAT', 'iva'], '390': ['Resumen anual IVA', 'AEAT', 'iva'],
  '400': ['Declaracion censal IGIC', 'ATC', 'censal'], '412': ['Autoliquidacion ocasional IGIC', 'ATC', 'igic'],
  '414': ['Devolucion IGIC a no establecidos', 'ATC', 'igic'], '415': ['Operaciones con terceras personas', 'ATC', 'informativa'],
  '416': ['Operaciones exentas vinculadas al REF', 'ATC', 'informativa'], '417': ['Autoliquidacion IGIC SII', 'ATC', 'igic'],
  '418': ['IGIC grupo de entidades individual', 'ATC', 'igic'], '419': ['IGIC grupo de entidades agregado', 'ATC', 'igic'],
  '420': ['Autoliquidacion IGIC regimen general', 'ATC', 'igic'], '421': ['Autoliquidacion IGIC regimen simplificado', 'ATC', 'igic'],
  '422': ['Reintegro de compensaciones REAGP', 'ATC', 'igic'], '424': ['Comerciante minorista IGIC', 'ATC', 'igic'],
  '425': ['Resumen anual IGIC', 'ATC', 'igic'],
};

function authorize(user: any, companyId: string) {
  if (privileged(user)) return;
  if (clean(user?.data?.company_id) !== companyId) throw Object.assign(new Error('No tienes permiso para consultar esta empresa.'), { status: 403 });
}

function atUtc(year: number, month: number, day: number) { return new Date(Date.UTC(year, month - 1, day, 12)); }
function shiftWeekend(date: Date) {
  const copy = new Date(date);
  while ([0, 6].includes(copy.getUTCDay())) copy.setUTCDate(copy.getUTCDate() + 1);
  return copy;
}
function minusDays(date: Date, days: number) { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() - days); return copy; }
function endOfNextMonth(year: number, month: number) { return shiftWeekend(atUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 0)).getUTCDate())); }
function dayNextMonth(year: number, month: number, day: number) { return shiftWeekend(atUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, day)); }

function item(code: string, fiscalYear: number, period: string, filing: Date, domicile: Date | null, extra: any = {}) {
  const meta = MODEL_META[code] || [`Modelo ${code}`, extra.authority || 'Otro', 'otro'];
  const official = filing.getUTCFullYear() <= VERIFIED_CALENDAR_YEAR || extra.officialOverride === true;
  const filingIso = iso(filing);
  const domicileIso = domicile ? iso(domicile) : '';
  return {
    key: `${code}:${fiscalYear}:${period}`,
    code, modelKey: meta[1] === 'ATC' ? `modelo_${code}_igic` : `modelo_${code}`,
    name: meta[0], authority: meta[1], category: meta[2], fiscalYear, period,
    filingStart: extra.filingStart || '', filingDeadline: filingIso, domicileDeadline: domicileIso,
    internalDeadline: iso(minusDays(domicile || filing, 7)),
    deadlineBasis: official ? 'calendario_oficial' : 'regla_normativa_pendiente_calendario_oficial',
    deadlineStatus: official ? 'verificado' : 'provisional',
    ruleSetVersion: RULESET, notes: extra.notes || '',
  };
}

function quarterly(code: string, fiscalYear: number, family: 'retention' | 'aeat_jan30' | 'atc') {
  const rows: any[] = [];
  const quarters = [
    ['T1', atUtc(fiscalYear, 4, 20), atUtc(fiscalYear, 4, 15)],
    ['T2', atUtc(fiscalYear, 7, 20), atUtc(fiscalYear, 7, 15)],
    ['T3', atUtc(fiscalYear, 10, 20), atUtc(fiscalYear, 10, 15)],
  ];
  for (const [period, filing, domicile] of quarters as any[]) rows.push(item(code, fiscalYear, period, shiftWeekend(filing), shiftWeekend(domicile)));
  if (family === 'retention') rows.push(item(code, fiscalYear, 'T4', shiftWeekend(atUtc(fiscalYear + 1, 1, 20)), shiftWeekend(atUtc(fiscalYear + 1, 1, 15))));
  if (family === 'aeat_jan30') rows.push(item(code, fiscalYear, 'T4', shiftWeekend(atUtc(fiscalYear + 1, 1, 30)), shiftWeekend(atUtc(fiscalYear + 1, 1, 25))));
  if (family === 'atc') {
    const official2026 = fiscalYear === 2026;
    rows.push(item(code, fiscalYear, 'T4', official2026 ? atUtc(2027, 2, 1) : shiftWeekend(atUtc(fiscalYear + 1, 1, 31)), official2026 ? atUtc(2027, 1, 26) : shiftWeekend(atUtc(fiscalYear + 1, 1, 25)), { officialOverride: official2026 }));
  }
  return rows;
}

function monthly(code: string, fiscalYear: number, family: 'aeat20' | 'aeat30' | 'atcEnd') {
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    let filing: Date; let domicile: Date | null;
    if (family === 'aeat20') { filing = dayNextMonth(fiscalYear, month, 20); domicile = dayNextMonth(fiscalYear, month, 15); }
    else if (family === 'aeat30') { filing = dayNextMonth(fiscalYear, month, 30); domicile = dayNextMonth(fiscalYear, month, 25); }
    else { filing = endOfNextMonth(fiscalYear, month); domicile = dayNextMonth(fiscalYear, month, 25); }
    rows.push(item(code, fiscalYear, `M${String(month).padStart(2, '0')}`, filing, domicile));
  }
  return rows;
}

function generateSchedule(model: any, fiscalYear: number) {
  const code = normalizeCode(model.codigo || model.modelo);
  const frequency = clean(model.periodicidad || model.frequency).toLowerCase();
  if (!code || !MODEL_META[code]) return [];
  if (code === '202') return [
    item(code, fiscalYear, 'P1', shiftWeekend(atUtc(fiscalYear, 4, 20)), shiftWeekend(atUtc(fiscalYear, 4, 15))),
    item(code, fiscalYear, 'P2', shiftWeekend(atUtc(fiscalYear, 10, 20)), shiftWeekend(atUtc(fiscalYear, 10, 15))),
    item(code, fiscalYear, 'P3', shiftWeekend(atUtc(fiscalYear, 12, 20)), shiftWeekend(atUtc(fiscalYear, 12, 15))),
  ];
  if (code === '200') { const due = shiftWeekend(atUtc(fiscalYear + 1, 7, 25)); return [item(code, fiscalYear, 'ANUAL', due, shiftWeekend(minusDays(due, 5)), { notes: 'Entidad con periodo impositivo coincidente con el ano natural; otros cierres requieren calculo especifico.' })]; }
  if (['180', '190', '193', '296'].includes(code)) return [item(code, fiscalYear, 'ANUAL', shiftWeekend(atUtc(fiscalYear + 1, 1, 31)), null)];
  if (code === '390') return [item(code, fiscalYear, 'ANUAL', shiftWeekend(atUtc(fiscalYear + 1, 1, 30)), null)];
  if (['347', '415'].includes(code)) return [item(code, fiscalYear, 'ANUAL', shiftWeekend(atUtc(fiscalYear + 1, 2, 28)), null)];
  if (code === '416') return [item(code, fiscalYear, 'ANUAL', shiftWeekend(atUtc(fiscalYear + 1, 1, 31)), null)];
  if (code === '425') {
    const official2025 = fiscalYear === 2025;
    return [item(code, fiscalYear, 'ANUAL', official2025 ? atUtc(2026, 2, 3) : shiftWeekend(atUtc(fiscalYear + 1, 1, 31)), null, { officialOverride: official2025 })];
  }
  if (code === '210') return quarterly(code, fiscalYear, 'retention').map(row => ({ ...row, deadlineStatus: 'revisar', notes: 'El plazo del modelo 210 depende del tipo de renta, resultado y posibilidad de agrupacion; confirmar cada supuesto.' }));
  if (['111', '115', '123', '216'].includes(code)) return frequency === 'mensual' ? monthly(code, fiscalYear, 'aeat20') : quarterly(code, fiscalYear, 'retention');
  if (['130', '131', '303', '309'].includes(code)) return frequency === 'mensual' ? monthly(code, fiscalYear, 'aeat30') : quarterly(code, fiscalYear, 'aeat_jan30');
  if (code === '349') return frequency === 'mensual' ? monthly(code, fiscalYear, 'aeat20') : quarterly(code, fiscalYear, 'aeat_jan30');
  if (['322', '353'].includes(code)) return monthly(code, fiscalYear, 'aeat30');
  if (code === '369') return frequency === 'mensual' ? monthly(code, fiscalYear, 'aeat30') : quarterly(code, fiscalYear, 'aeat_jan30').map(row => ({ ...row, notes: 'Periodicidad segun regimen OSS/IOSS informado.' }));
  if (['417', '418', '419'].includes(code)) return monthly(code, fiscalYear, 'atcEnd');
  if (['420', '421'].includes(code)) return quarterly(code, fiscalYear, 'atc');
  return [];
}

function detectDocument(doc: any) {
  const haystack = [doc.nombre, doc.carpeta, ...(doc.etiquetas || [])].join(' ').toLowerCase();
  let code = normalizeCode(doc.fiscal_model_code);
  if (!code) {
    for (const candidate of Object.keys(MODEL_META).sort((a, b) => b.length - a.length)) {
      if (new RegExp(`(?:modelo[\\s_-]*)?${candidate}(?!\\d)`, 'i').test(haystack)) { code = candidate; break; }
    }
  }
  const yearMatch = haystack.match(/20\d{2}/);
  const fiscalYear = Number(doc.fiscal_year || doc.anio || yearMatch?.[0] || 0);
  const period = normalizePeriod(doc.fiscal_period || doc.trimestre || haystack);
  const isFiscal = clean(doc.carpeta).startsWith('fiscal_') || Boolean(code) || clean(doc.fiscal_document_kind);
  return { isFiscal, code, fiscalYear, period };
}

function stateFrom(period: any, obligation: any, filing: any) {
  if (filing?.estadoPresentacion === 'presentado') return 'presentado';
  if (filing?.estadoPresentacion === 'rechazado') return 'rechazado';
  if (obligation?.estado) return obligation.estado;
  if (period?.estado && period.estado !== 'sin_datos') return period.estado;
  return 'pendiente_documentacion';
}

async function loadBundle(svc: any, companyId: string) {
  const [profiles, activities, models, obligations, periods, filings, documents] = await Promise.all([
    svc.entities.FiscalProfile.filter({ company_id: companyId, active: true }, '-reviewedAt', 20),
    svc.entities.FiscalActivity.filter({ company_id: companyId }, 'name', 5000),
    svc.entities.TaxModel.filter({ companyId }, 'codigo', 5000),
    svc.entities.TaxObligation.filter({ company_id: companyId }, '-fecha_limite', 10000),
    svc.entities.TaxPeriod.filter({ companyId }, '-ejercicio', 10000),
    svc.entities.TaxFiling.filter({ companyId }, '-ejercicio', 10000),
    svc.entities.Document.filter({ company_id: companyId }, '-created_date', 10000),
  ]);
  return { profile: profiles?.[0] || null, activities: activities || [], models: models || [], obligations: obligations || [], periods: periods || [], filings: filings || [], documents: documents || [] };
}

function buildCalendar(data: any, fiscalYear: number) {
  const docs = data.documents.map((doc: any) => ({ ...doc, detected: detectDocument(doc) })).filter((doc: any) => doc.detected.isFiscal);
  const modelMap = new Map<string, any>();
  for (const model of data.models.filter((row: any) => row.activo !== false)) modelMap.set(normalizeCode(model.codigo), { ...model, source: 'perfil_fiscal' });
  for (const obligation of data.obligations) {
    const code = normalizeCode(obligation.modelo_codigo || obligation.modelo);
    if (code && !modelMap.has(code)) modelMap.set(code, { codigo: code, nombre: MODEL_META[code]?.[0] || `Modelo ${code}`, administracion: obligation.administracion || MODEL_META[code]?.[1] || 'Otro', periodicidad: 'segun_modelo', activo: true, source: 'obligacion_asesor' });
  }
  for (const doc of docs) {
    const code = doc.detected.code;
    if (code && !modelMap.has(code)) modelMap.set(code, { codigo: code, nombre: MODEL_META[code]?.[0] || `Modelo ${code}`, administracion: doc.administracion || MODEL_META[code]?.[1] || 'Otro', periodicidad: 'segun_modelo', activo: true, source: 'documento_fiscal' });
  }
  const items: any[] = [];
  for (const model of modelMap.values()) {
    for (const generated of generateSchedule(model, fiscalYear)) {
      const obligation = data.obligations.find((row: any) => normalizeCode(row.modelo_codigo || row.modelo) === generated.code && Number(row.anio || row.fiscal_year) === fiscalYear && normalizePeriod(row.periodo || row.trimestre) === generated.period);
      const period = data.periods.find((row: any) => normalizeCode(row.modeloCodigo) === generated.code && Number(row.ejercicio) === fiscalYear && normalizePeriod(row.periodo) === generated.period);
      const filing = data.filings.find((row: any) => normalizeCode(row.modeloCodigo) === generated.code && Number(row.ejercicio) === fiscalYear && normalizePeriod(row.periodo) === generated.period);
      const linkedDocs = docs.filter((doc: any) => doc.detected.code === generated.code && doc.detected.fiscalYear === fiscalYear && (!doc.detected.period || doc.detected.period === generated.period || generated.period === 'ANUAL'));
      const filingDeadline = obligation?.fecha_limite_presentacion || obligation?.fecha_limite || generated.filingDeadline;
      const domicileDeadline = obligation?.fecha_limite_domiciliacion || generated.domicileDeadline;
      items.push({ ...generated, filingDeadline, domicileDeadline, internalDeadline: obligation?.fecha_limite_interna || generated.internalDeadline, state: stateFrom(period, obligation, filing), amount: Number(filing?.importeFinal ?? period?.importeConfirmado ?? obligation?.importe ?? 0), result: period?.resultado || obligation?.resultado || 'pendiente', comments: obligation?.comentarios_asesor || period?.notas || '', obligation, taxPeriod: period, filing, documents: linkedDocs, modelSource: model.source, calendarKey: generated.key });
    }
  }
  const scheduledKeys = new Set(items.map(row => row.key));
  for (const obligation of data.obligations) {
    const code = normalizeCode(obligation.modelo_codigo || obligation.modelo);
    const year = Number(obligation.anio || obligation.fiscal_year);
    const period = normalizePeriod(obligation.periodo || obligation.trimestre) || 'EVENTO';
    const key = `${code}:${year}:${period}`;
    if (!code || year !== fiscalYear || scheduledKeys.has(key)) continue;
    const meta = MODEL_META[code] || [`Modelo ${code}`, obligation.administracion || 'Otro', 'otro'];
    const linkedDocs = docs.filter((doc: any) => doc.detected.code === code && doc.detected.fiscalYear === fiscalYear && (!doc.detected.period || doc.detected.period === period));
    items.push({ key, calendarKey: key, code, modelKey: obligation.modelo, name: meta[0], authority: obligation.administracion || meta[1], category: meta[2], fiscalYear, period, filingStart: obligation.fecha_inicio_presentacion || '', filingDeadline: obligation.fecha_limite_presentacion || obligation.fecha_limite || '', domicileDeadline: obligation.fecha_limite_domiciliacion || '', internalDeadline: obligation.fecha_limite_interna || '', deadlineBasis: obligation.source || 'asesor', deadlineStatus: obligation.deadline_status || 'revisar', ruleSetVersion: obligation.calendar_rule_version || RULESET, notes: 'Obligacion o evento informado manualmente.', state: obligation.estado, amount: Number(obligation.importe || 0), result: obligation.resultado, comments: obligation.comentarios_asesor || '', obligation, documents: linkedDocs, modelSource: 'obligacion_asesor' });
  }
  items.sort((a, b) => String(a.filingDeadline || '9999').localeCompare(String(b.filingDeadline || '9999')) || a.code.localeCompare(b.code));
  const linkedIds = new Set(items.flatMap(row => row.documents.map((doc: any) => doc.id)));
  return { items, documents: docs, unlinkedDocuments: docs.filter((doc: any) => !linkedIds.has(doc.id)), activeModels: [...modelMap.values()] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const companyId = clean(body.companyId || user.data?.company_id);
    if (!companyId) return Response.json({ error: 'companyId es obligatorio.' }, { status: 400 });
    authorize(user, companyId);
    const svc = base44.asServiceRole;
    const action = clean(body.action || 'bundle');
    const fiscalYear = Number(body.fiscalYear || new Date().getUTCFullYear());
    if (fiscalYear < 2000 || fiscalYear > 2100) throw new Error('Ejercicio fiscal no valido.');
    const data = await loadBundle(svc, companyId);
    const calendar = buildCalendar(data, fiscalYear);

    if (action === 'bundle') {
      const now = new Date().toISOString();
      return Response.json({ success: true, companyId, fiscalYear, generatedAt: now, ruleSetVersion: RULESET, verifiedCalendarYear: VERIFIED_CALENDAR_YEAR, profile: data.profile, activities: data.activities, models: calendar.activeModels, items: calendar.items, documents: calendar.documents, unlinkedDocuments: calendar.unlinkedDocuments, sources: SOURCES });
    }

    if (action === 'synchronize') {
      const existingByKey = new Map<string, any[]>();
      for (const row of data.obligations) {
        const code = normalizeCode(row.modelo_codigo || row.modelo);
        const year = Number(row.anio || row.fiscal_year);
        const period = normalizePeriod(row.periodo || row.trimestre);
        const key = `${code}:${year}:${period}`;
        existingByKey.set(key, [...(existingByKey.get(key) || []), row]);
      }
      let created = 0; let updated = 0; let duplicatesPreserved = 0;
      for (const row of calendar.items.filter((entry: any) => entry.filingDeadline)) {
        const existing = existingByKey.get(row.key) || [];
        duplicatesPreserved += Math.max(0, existing.length - 1);
        const payload = {
          modelo_codigo: row.code, administracion: row.authority, anio: fiscalYear, periodo: row.period,
          fecha_inicio_presentacion: row.filingStart || undefined,
          fecha_limite: row.filingDeadline, fecha_limite_presentacion: row.filingDeadline,
          fecha_limite_domiciliacion: row.domicileDeadline || undefined, fecha_limite_interna: row.internalDeadline,
          calendar_key: row.key, source: existing[0]?.source || 'perfil_fiscal', calendar_rule_version: RULESET,
          calendar_confidence: row.deadlineStatus === 'verificado' ? 'oficial_verificado' : 'provisional',
          deadline_status: row.deadlineStatus, last_synced_at: new Date().toISOString(), last_synced_by: user.email,
          tax_model_id: (data.models.find((model: any) => normalizeCode(model.codigo) === row.code) || {}).id,
        };
        if (existing[0]) { await svc.entities.TaxObligation.update(existing[0].id, payload); updated++; }
        else { await svc.entities.TaxObligation.create({ company_id: companyId, modelo: row.modelKey, estado: 'pendiente_documentacion', resultado: 'pendiente', importe: 0, ...payload }); created++; }
      }
      return Response.json({ success: true, mode: 'idempotent_upsert', fiscalYear, created, updated, duplicatesPreserved, ruleSetVersion: RULESET });
    }

    if (action === 'save_obligation') {
      if (!privileged(user)) throw Object.assign(new Error('Solo el asesor o administrador puede confirmar una obligacion fiscal.'), { status: 403 });
      const current = data.obligations.find((row: any) => row.id === body.obligationId);
      if (!current) throw new Error('Obligacion no encontrada.');
      const allowed = ['estado', 'resultado', 'importe', 'comentarios_asesor', 'fecha_inicio_presentacion', 'fecha_limite_domiciliacion', 'fecha_limite_presentacion', 'fecha_limite_interna', 'deadline_status'];
      const payload: any = { last_synced_at: new Date().toISOString(), last_synced_by: user.email };
      for (const key of allowed) if (body[key] !== undefined) payload[key] = body[key];
      if (payload.fecha_limite_presentacion) payload.fecha_limite = payload.fecha_limite_presentacion;
      const saved = await svc.entities.TaxObligation.update(current.id, payload);
      return Response.json({ success: true, obligation: saved });
    }

    if (action === 'create_obligation') {
      if (!privileged(user)) throw Object.assign(new Error('Solo el asesor o administrador puede crear una obligación fiscal.'), { status: 403 });
      const code = normalizeCode(body.modelCode);
      const period = normalizePeriod(body.period);
      const year = Number(body.fiscalYear || fiscalYear);
      if (!code || !MODEL_META[code] || !period || !body.fecha_limite_presentacion) throw new Error('Modelo, ejercicio, período y fecha máxima de presentación son obligatorios.');
      const duplicate = data.obligations.find((row: any) => normalizeCode(row.modelo_codigo || row.modelo) === code && Number(row.anio || row.fiscal_year) === year && normalizePeriod(row.periodo || row.trimestre) === period);
      if (duplicate) throw new Error('Ya existe esta obligación. Ábrela desde el calendario para actualizarla.');
      const meta = MODEL_META[code];
      let taxModel = data.models.find((row: any) => normalizeCode(row.codigo) === code);
      if (!taxModel) {
        taxModel = await svc.entities.TaxModel.create({
          companyId, codigo: code, nombre: meta[0],
          impuesto: meta[2] === 'iva' ? 'IVA' : meta[2] === 'igic' ? 'IGIC' : ['irpf', 'no_residentes'].includes(meta[2]) ? 'IRPF' : meta[2] === 'retenciones' ? 'Retenciones' : 'Otro',
          administracion: meta[1], periodicidad: 'segun_modelo', activo: true,
          fuenteValidacion: 'criterio_asesor', estadoImplementacion: 'configuracion',
          observaciones: `Obligación incorporada manualmente desde calendario. ${RULESET}`,
        });
      } else if (taxModel.activo === false) {
        taxModel = await svc.entities.TaxModel.update(taxModel.id, { activo: true, fuenteValidacion: 'criterio_asesor' });
      }
      const modelKey = meta[1] === 'ATC' ? `modelo_${code}_igic` : `modelo_${code}`;
      const created = await svc.entities.TaxObligation.create({
        company_id: companyId, modelo: modelKey, modelo_codigo: code, administracion: meta[1],
        anio: year, periodo: period, fecha_limite: body.fecha_limite_presentacion,
        fecha_limite_presentacion: body.fecha_limite_presentacion,
        fecha_limite_domiciliacion: body.fecha_limite_domiciliacion || undefined,
        fecha_limite_interna: body.fecha_limite_interna || undefined,
        estado: body.estado || 'pendiente_documentacion', resultado: body.resultado || 'pendiente',
        importe: Number(body.importe || 0), comentarios_asesor: clean(body.comentarios_asesor),
        calendar_key: `${code}:${year}:${period}`, source: 'asesor',
        calendar_rule_version: RULESET, calendar_confidence: 'criterio_asesor',
        deadline_status: body.deadline_status || 'revisar', tax_model_id: taxModel.id,
        last_synced_at: new Date().toISOString(), last_synced_by: user.email,
      });
      return Response.json({ success: true, obligation: created, taxModel });
    }

    if (action === 'link_document') {
      const doc = data.documents.find((row: any) => row.id === body.documentId);
      if (!doc) throw new Error('Documento no encontrado en esta empresa.');
      const code = normalizeCode(body.modelCode || doc.fiscal_model_code);
      const period = normalizePeriod(body.period || doc.fiscal_period || doc.trimestre) || 'ANUAL';
      const year = Number(body.year || doc.fiscal_year || doc.anio || fiscalYear);
      if (!code || !MODEL_META[code]) throw new Error('Selecciona un modelo fiscal valido para vincular el documento.');
      const kind = clean(body.documentKind || doc.fiscal_document_kind || 'otro');
      const documentPayload = { fiscal_model_code: code, fiscal_period: period, fiscal_year: year, fiscal_document_kind: kind, administracion: MODEL_META[code][1], fiscal_link_status: 'vinculado', fiscal_linked_at: new Date().toISOString(), fiscal_linked_by: user.email };
      const savedDoc = await svc.entities.Document.update(doc.id, documentPayload);
      let obligation = data.obligations.find((row: any) => normalizeCode(row.modelo_codigo || row.modelo) === code && Number(row.anio || row.fiscal_year) === year && normalizePeriod(row.periodo || row.trimestre) === period);
      const generated = generateSchedule({ codigo: code, periodicidad: body.frequency || 'segun_modelo' }, year).find((row: any) => row.period === period);
      if (!obligation && generated) {
        obligation = await svc.entities.TaxObligation.create({ company_id: companyId, modelo: generated.modelKey, modelo_codigo: code, administracion: generated.authority, periodo: period, anio: year, fecha_limite: generated.filingDeadline, fecha_limite_presentacion: generated.filingDeadline, fecha_limite_domiciliacion: generated.domicileDeadline || undefined, fecha_limite_interna: generated.internalDeadline, estado: 'pendiente_documentacion', resultado: 'pendiente', importe: 0, calendar_key: generated.key, source: 'documento_fiscal', calendar_rule_version: RULESET, calendar_confidence: generated.deadlineStatus === 'verificado' ? 'oficial_verificado' : 'provisional', deadline_status: generated.deadlineStatus, document_ids: [doc.id], last_synced_at: new Date().toISOString(), last_synced_by: user.email });
      } else if (obligation) {
        const ids = [...new Set([...(obligation.document_ids || []), doc.id])];
        const update: any = { document_ids: ids, last_synced_at: new Date().toISOString(), last_synced_by: user.email };
        if (kind === 'justificante_presentacion' && privileged(user)) { update.estado = 'presentado'; update.justificante_url = doc.archivo_url; }
        obligation = await svc.entities.TaxObligation.update(obligation.id, update);
      }
      return Response.json({ success: true, document: savedDoc, obligation, presentationConfirmed: kind === 'justificante_presentacion' && privileged(user) });
    }

    return Response.json({ error: 'Accion de calendario fiscal no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('[fiscalCalendarOperations]', error?.message || error);
    return Response.json({ error: error?.message || 'Error interno del calendario fiscal.' }, { status: error?.status || 500 });
  }
});

