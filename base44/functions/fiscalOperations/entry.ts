import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const RULESET = 'taxea-fiscal-es-2026.09.09-v1';
const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const clean = (value: unknown) => String(value ?? '').trim();
const clamp = (value: unknown, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

const SOURCES = [
  { id: 'iva-regimes', title: 'AEAT - Regimenes de tributacion en el IVA', url: 'https://sede.agenciatributaria.gob.es/Sede/iva/regimenes-tributacion-iva.html' },
  { id: 'iva-law', title: 'Ley 37/1992 del IVA, texto consolidado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740' },
  { id: 'igic-law', title: 'Decreto Legislativo 1/2025, texto refundido IGIC', url: 'https://www.boe.es/buscar/act.php?id=BOC-j-2025-90249' },
  { id: 'repep', title: 'ATC - Regimen especial del pequeno empresario o profesional', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/regimen-especial-peque%C3%B1o-empresario-o-profesional-repep' },
  { id: 'igic-models', title: 'ATC - Modelos IGIC', url: 'https://www3.gobiernodecanarias.org/tributos/atc/es/modelos-presentacion-telematica' },
  { id: 'irpf-payments', title: 'AEAT - Pagos fraccionados de actividades economicas', url: 'https://sede.agenciatributaria.gob.es/Sede/irpf/retenciones-ingresos-cuenta-pagos-fraccionados/pagos-fraccionados.html' },
  { id: 'irpf-rates', title: 'AEAT - Retenciones 2026', url: 'https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml' },
  { id: 'iae', title: 'AEAT - Listado oficial de actividades economicas e IAE', url: 'https://sede.agenciatributaria.gob.es/Sede/iva/pre-303/nuevo-servicio-pre303-importacion-libros-electronico/listado-actividades-economicas.html' },
];

const REGIMES = {
  iva: [
    ['general', 'Regimen general'], ['simplificado', 'Regimen simplificado'],
    ['agricultura_ganaderia_pesca', 'Agricultura, ganaderia y pesca'], ['recargo_equivalencia', 'Recargo de equivalencia'],
    ['criterio_caja', 'Criterio de caja'], ['rebu', 'Bienes usados, arte, antiguedades y coleccion'],
    ['agencias_viajes', 'Agencias de viajes'], ['oro_inversion', 'Oro de inversion'],
    ['oss_exterior_union', 'Ventanilla unica - regimen exterior de la Union'], ['oss_union', 'Ventanilla unica - regimen de la Union'],
    ['ioss_importacion', 'Ventanilla unica - regimen de importacion'], ['grupo_entidades', 'Grupo de entidades'],
    ['exenta_limitada', 'Actividad con exencion limitada'], ['exenta_plena', 'Actividad con exencion plena'],
    ['no_sujeta', 'Actividad no sujeta'], ['mixto', 'Sectores o tratamientos mixtos'],
  ],
  igic: [
    ['general', 'Regimen general'], ['simplificado', 'Regimen simplificado'],
    ['agricultura_ganaderia_pesca', 'Agricultura, ganaderia y pesca'], ['rebu', 'Bienes usados, arte, antiguedades y coleccion'],
    ['agencias_viajes', 'Agencias de viajes'], ['comerciante_minorista_igic', 'Comerciante minorista'],
    ['oro_inversion', 'Oro de inversion'], ['grupo_entidades', 'Grupo de entidades'],
    ['criterio_caja', 'Criterio de caja'], ['pequeno_empresario_igic', 'REPEP - pequeno empresario o profesional'],
    ['exenta_limitada', 'Actividad con exencion limitada'], ['exenta_plena', 'Actividad con exencion plena'],
    ['no_sujeta', 'Actividad no sujeta'], ['mixto', 'Sectores o tratamientos mixtos'],
  ],
};

const OPERATIONS = [
  ['subject_taxed', 'Sujeta y no exenta'], ['subject_zero', 'Sujeta a tipo cero'],
  ['exempt_limited', 'Sujeta y exenta sin derecho a deduccion'], ['exempt_full', 'Exenta con derecho a deduccion'],
  ['non_subject_article', 'No sujeta por supuesto legal'], ['non_subject_location', 'No sujeta por reglas de localizacion'],
  ['reverse_charge', 'Inversion del sujeto pasivo'], ['intra_eu_supply', 'Entrega intracomunitaria'],
  ['intra_eu_acquisition', 'Adquisicion intracomunitaria'], ['export', 'Exportacion'], ['import', 'Importacion'],
  ['canary_peninsula_goods', 'Bienes Canarias-Peninsula/Baleares'], ['canary_peninsula_service', 'Servicios Canarias-Peninsula/Baleares'],
  ['special_margin', 'Regimen especial de margen'], ['outside_scope', 'Fuera del ambito del impuesto'],
];

const EXEMPTION_KEYS = {
  iva: [
    ['IVA_ART_20_SANITARIA', 'Asistencia sanitaria - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_EDUCACION', 'Educacion y ensenanza - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_SOCIAL', 'Asistencia social - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_FINANCIERA', 'Operaciones financieras - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_SEGUROS', 'Seguros - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_VIVIENDA', 'Arrendamiento de vivienda - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_POSTAL', 'Servicios postales - art. 20 LIVA', 'limitada'],
    ['IVA_ART_20_CULTURAL_DEPORTIVA', 'Determinadas actividades culturales/deportivas - art. 20 LIVA', 'limitada'],
    ['IVA_ART_21_EXPORTACION', 'Exportaciones - art. 21 LIVA', 'plena'],
    ['IVA_ART_25_ENTREGA_UE', 'Entregas intracomunitarias - art. 25 LIVA', 'plena'],
    ['IVA_ART_7_NO_SUJETA', 'Operacion no sujeta - art. 7 LIVA', 'no_aplica'],
    ['IVA_LOCALIZACION', 'No sujeta por reglas de localizacion - arts. 68 a 72 LIVA', 'no_aplica'],
    ['IVA_OTRA_REVISADA', 'Otra causa revisada por asesor', 'revisar'],
  ],
  igic: [
    ['IGIC_SANITARIA', 'Asistencia sanitaria exenta - texto refundido IGIC', 'limitada'],
    ['IGIC_EDUCACION', 'Educacion y ensenanza exenta - texto refundido IGIC', 'limitada'],
    ['IGIC_SOCIAL', 'Asistencia social exenta - texto refundido IGIC', 'limitada'],
    ['IGIC_FINANCIERA_SEGUROS', 'Operaciones financieras y seguros exentas - texto refundido IGIC', 'limitada'],
    ['IGIC_VIVIENDA', 'Arrendamiento de vivienda exento - texto refundido IGIC', 'limitada'],
    ['IGIC_REPEP', 'REPEP - entregas y servicios exentos', 'limitada'],
    ['IGIC_COMERCIANTE_MINORISTA', 'Entregas del comerciante minorista - regimen especial', 'limitada'],
    ['IGIC_EXPORTACION', 'Exportacion exenta', 'plena'],
    ['IGIC_NO_SUJETA', 'Operacion no sujeta por supuesto legal', 'no_aplica'],
    ['IGIC_LOCALIZACION', 'No sujeta por reglas de localizacion', 'no_aplica'],
    ['IGIC_OTRA_REVISADA', 'Otra causa revisada por asesor', 'revisar'],
  ],
};

const MODEL_CATALOG = [
  ['036', 'Declaracion censal AEAT', 'AEAT', 'segun_modelo'], ['037', 'Declaracion censal simplificada AEAT', 'AEAT', 'segun_modelo'],
  ['303', 'Autoliquidacion IVA', 'AEAT', 'trimestral'], ['309', 'IVA - autoliquidacion no periodica', 'AEAT', 'ocasional'],
  ['322', 'IVA - grupo de entidades individual', 'AEAT', 'mensual'], ['353', 'IVA - grupo de entidades agregado', 'AEAT', 'mensual'],
  ['368', 'IVA servicios electronicos - regimenes anteriores', 'AEAT', 'segun_modelo'], ['369', 'IVA ventanilla unica OSS/IOSS', 'AEAT', 'trimestral'],
  ['390', 'Resumen anual IVA', 'AEAT', 'anual'], ['349', 'Operaciones intracomunitarias', 'AEAT', 'mensual'], ['347', 'Operaciones con terceros', 'AEAT', 'anual'],
  ['130', 'Pago fraccionado IRPF - estimacion directa', 'AEAT', 'trimestral'], ['131', 'Pago fraccionado IRPF - estimacion objetiva', 'AEAT', 'trimestral'],
  ['111', 'Retenciones trabajo y actividades economicas', 'AEAT', 'trimestral'], ['190', 'Resumen anual modelo 111', 'AEAT', 'anual'],
  ['115', 'Retenciones por alquiler urbano', 'AEAT', 'trimestral'], ['180', 'Resumen anual modelo 115', 'AEAT', 'anual'],
  ['123', 'Retenciones de capital mobiliario y otras rentas', 'AEAT', 'trimestral'], ['193', 'Resumen anual modelo 123', 'AEAT', 'anual'],
  ['200', 'Impuesto sobre Sociedades', 'AEAT', 'anual'], ['202', 'Pago fraccionado Impuesto sobre Sociedades', 'AEAT', 'segun_modelo'],
  ['210', 'IRNR sin establecimiento permanente', 'AEAT', 'segun_modelo'], ['216', 'Retenciones IRNR', 'AEAT', 'trimestral'], ['296', 'Resumen anual modelo 216', 'AEAT', 'anual'],
  ['400', 'Declaracion censal IGIC', 'ATC', 'segun_modelo'], ['412', 'Autoliquidacion ocasional IGIC', 'ATC', 'ocasional'],
  ['414', 'Solicitud de devolucion IGIC a no establecidos', 'ATC', 'segun_modelo'],
  ['415', 'Operaciones economicas con terceras personas', 'ATC', 'anual'], ['416', 'Operaciones exentas art. 25 Ley 19/1994', 'ATC', 'anual'],
  ['417', 'Autoliquidacion IGIC SII', 'ATC', 'mensual'], ['418', 'IGIC grupo entidades individual', 'ATC', 'mensual'],
  ['419', 'IGIC grupo entidades agregado', 'ATC', 'mensual'], ['420', 'Autoliquidacion IGIC regimen general', 'ATC', 'trimestral'],
  ['421', 'Autoliquidacion IGIC regimen simplificado', 'ATC', 'trimestral'], ['422', 'IGIC agricultura y ganaderia - reintegro compensaciones', 'ATC', 'segun_modelo'],
  ['424', 'IGIC comerciantes minoristas', 'ATC', 'segun_modelo'], ['425', 'Resumen anual IGIC', 'ATC', 'anual'],
];

function authorize(user: any, companyId: string) {
  const role = clean(user?.role).toLowerCase();
  const own = clean(user?.data?.company_id);
  if (['admin', 'super_admin', 'advisor', 'asesor'].includes(role)) return;
  if (!own || own !== companyId) throw Object.assign(new Error('No tienes permiso para operar en la empresa seleccionada.'), { status: 403 });
}

function recommendedObligations(profile: any, activities: any[]) {
  const result = new Map<string, any>();
  const add = (code: string, reason: string, certainty: 'recommended' | 'review' = 'recommended') => {
    const model = MODEL_CATALOG.find(item => item[0] === code);
    if (!model) return;
    const existing = result.get(code);
    result.set(code, { code, name: model[1], authority: model[2], frequency: model[3], certainty: existing?.certainty === 'recommended' ? 'recommended' : certainty, reasons: [...new Set([...(existing?.reasons || []), reason])] });
  };
  const active = (activities || []).filter(item => item.active !== false);
  const iva = active.filter(item => item.indirectTax === 'iva');
  const igic = active.filter(item => item.indirectTax === 'igic');
  const regimes = new Set(active.map(item => item.indirectTaxRegime));
  if (iva.length) {
    if (regimes.has('grupo_entidades')) { add('322', 'Regimen especial de grupo de entidades IVA'); add('353', 'Regimen especial de grupo de entidades IVA'); }
    else if (regimes.has('oss_union') || regimes.has('oss_exterior_union') || regimes.has('ioss_importacion')) add('369', 'Ventanilla unica OSS/IOSS');
    else if (!iva.every(item => ['recargo_equivalencia', 'agricultura_ganaderia_pesca', 'exenta_limitada', 'no_sujeta'].includes(item.indirectTaxRegime))) add('303', 'Actividad en territorio IVA con liquidacion periodica');
    add('390', 'Resumen anual IVA; confirmar exoneraciones aplicables', 'review');
  }
  if (igic.length) {
    if (regimes.has('grupo_entidades')) { add('418', 'Grupo de entidades IGIC'); add('419', 'Grupo de entidades IGIC'); }
    else if (regimes.has('simplificado')) add('421', 'Regimen simplificado IGIC');
    else if (!igic.every(item => item.indirectTaxRegime === 'pequeno_empresario_igic')) add(profile?.usesSII ? '417' : '420', profile?.usesSII ? 'IGIC con SII' : 'Regimen general o especial liquidable IGIC');
    if (regimes.has('agricultura_ganaderia_pesca')) add('422', 'Reintegro de compensaciones cuando proceda', 'review');
    if (regimes.has('comerciante_minorista_igic')) add('424', 'Operaciones/importaciones de comerciante minorista cuando proceda', 'review');
    add('425', regimes.has('pequeno_empresario_igic') ? 'REPEP: declaracion anual de volumen de operaciones, sin 420 periodico' : 'Resumen anual IGIC');
    if (regimes.has('pequeno_empresario_igic')) add('412', 'Solo si existe devengo ocasional, por ejemplo inversion del sujeto pasivo', 'review');
  }
  if (active.some(item => ['intra_eu_supply', 'intra_eu_acquisition'].includes(item.incomeDefaultTreatment) || item.hasIntraCommunityOperations)) add('349', 'Operaciones intracomunitarias');
  if (profile?.subjectToIRPF) {
    if (profile.irpfEstimation === 'objetiva_modulos') add('131', 'Estimacion objetiva');
    else if (profile.irpfEstimation !== 'no_aplica') {
      const retained = clamp(profile.retainedIncomePercent);
      const eligible = active.length > 0 && active.every(item => ['profesional', 'agricola_ganadera', 'forestal'].includes(item.activityType));
      if (!(eligible && retained >= 70 && profile.model130ExemptionConfirmed === true)) add('130', retained >= 70 ? 'Exoneracion del 70% no confirmada por asesor' : 'Estimacion directa sin exoneracion del 70%', retained >= 70 ? 'review' : 'recommended');
    }
  }
  if (profile?.paysEmploymentOrProfessionalIncome) { add('111', 'Satisface rendimientos del trabajo o actividades economicas'); add('190', 'Resumen anual de retenciones del modelo 111'); }
  if (profile?.paysUrbanRent) { add('115', 'Satisface alquileres urbanos sujetos a retencion'); add('180', 'Resumen anual de retenciones del modelo 115'); }
  if (profile?.paysCapitalIncome) { add('123', 'Satisface determinadas rentas de capital'); add('193', 'Resumen anual de retenciones del modelo 123'); }
  if (profile?.hasNonResidentOperations) { add('216', 'Rentas a no residentes sujetas a retencion', 'review'); add('296', 'Resumen anual de retenciones a no residentes', 'review'); add('210', 'Solo cuando el propio supuesto de IRNR lo exija', 'review'); }
  if (profile?.hasThirdPartyReporting) add(profile.mainTerritory === 'canarias' ? '415' : '347', 'Operaciones con terceras personas; comprobar umbrales y exclusiones', 'review');
  if (profile?.entityType === 'sociedad') { add('200', 'Entidad sujeta al Impuesto sobre Sociedades'); add('202', 'Pago fraccionado si procede', 'review'); }
  return [...result.values()].sort((a, b) => Number(a.code) - Number(b.code));
}

function evaluate(profile: any, activities: any[], body: any) {
  const activity = activities.find(item => item.id === body.activityId) || activities.find(item => item.active !== false) || null;
  if (!profile || !activity) return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['Falta perfil fiscal o actividad economica validada.'], ruleSetVersion: RULESET };
  const direction = body.direction === 'gasto' ? 'gasto' : 'ingreso';
  const taxKind = body.taxKind || activity.indirectTax || profile.indirectTaxDefault || 'iva';
  const regime = body.regime || activity.indirectTaxRegime || 'general';
  let operationType = body.operationType || activity[direction === 'ingreso' ? 'incomeDefaultTreatment' : 'expenseDefaultTreatment'] || 'subject_taxed';
  const manualOverride = body.manualOverride === true;
  const reasons: string[] = [];
  const alerts: string[] = [];
  let reviewRequired = activity.automationLevel !== 'automatico';
  let confidence = manualOverride ? 100 : 85;
  let taxRate = Number(body.taxRate ?? activity.defaultTaxRate ?? (taxKind === 'igic' ? profile.defaultIgicRate : profile.defaultVatRate) ?? 0);
  const base = money(body.base);
  let taxAmount = money(body.taxAmount ?? base * taxRate / 100);
  let deductiblePercent = clamp(body.deductiblePercent ?? (activity.deductionRight === 'sin_derecho' ? 0 : activity.proRataPercent ?? 100));
  let exemptionKey = clean(body.exemptionKey || activity.exemptionKey);
  let legalBasis = clean(body.legalBasis || activity.exemptionLegalBasis);

  if (regime === 'pequeno_empresario_igic') {
    if (direction === 'ingreso' && !['reverse_charge', 'import'].includes(operationType)) { operationType = 'exempt_limited'; exemptionKey = exemptionKey || 'IGIC_REPEP'; taxRate = 0; taxAmount = 0; deductiblePercent = 0; }
    if (direction === 'gasto') deductiblePercent = 0;
    reasons.push('REPEP: operaciones propias exentas y cuotas soportadas sin derecho a deduccion.');
    if (operationType === 'reverse_charge' || operationType === 'import') alerts.push('Puede existir autoliquidacion ocasional IGIC modelo 412.');
  }
  if (['exenta_limitada', 'exenta_plena', 'no_sujeta'].includes(regime) && !manualOverride) {
    operationType = regime === 'exenta_limitada' ? 'exempt_limited' : regime === 'exenta_plena' ? 'exempt_full' : 'non_subject_article';
  }
  if (operationType === 'exempt_limited') { taxRate = 0; taxAmount = 0; deductiblePercent = direction === 'gasto' ? 0 : deductiblePercent; if (!exemptionKey || !legalBasis) { reviewRequired = true; reasons.push('La exencion exige clave y fundamento legal revisado.'); } }
  if (operationType === 'exempt_full' || operationType === 'export' || operationType === 'intra_eu_supply') { taxRate = 0; taxAmount = 0; }
  if (['non_subject_article', 'non_subject_location', 'outside_scope'].includes(operationType)) { taxRate = 0; taxAmount = 0; deductiblePercent = 0; if (!legalBasis) { reviewRequired = true; reasons.push('La no sujecion exige motivo y fundamento legal.'); } }
  if (operationType === 'subject_zero') taxRate = 0;
  if (['reverse_charge', 'intra_eu_acquisition'].includes(operationType)) { reviewRequired = true; alerts.push(`Autorrepercusion de ${taxKind.toUpperCase()}: registrar cuota devengada y deducible solo en la proporcion permitida.`); }
  if (['canary_peninsula_goods', 'canary_peninsula_service'].includes(operationType)) { reviewRequired = true; confidence -= 20; alerts.push('Canarias no forma parte del territorio IVA: revisar localizacion, importacion/exportacion e inversion del sujeto pasivo.'); }
  if (['recargo_equivalencia', 'comerciante_minorista_igic', 'agricultura_ganaderia_pesca', 'simplificado', 'rebu', 'agencias_viajes', 'oro_inversion', 'grupo_entidades', 'criterio_caja', 'oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(regime)) {
    reviewRequired = true;
    reasons.push('Regimen especial: la regla general no basta para validar esta operacion.');
  }
  if (taxKind === 'mixto' || activity.deductionRight === 'sector_diferenciado') { reviewRequired = true; reasons.push('Actividad mixta o sector diferenciado: seleccionar impuesto y sector en la operacion.'); }
  if (activity.deductionRight === 'prorrata_especial') { reviewRequired = true; reasons.push('Prorrata especial: la afectacion debe resolverse por operacion.'); }
  const deductibleTax = direction === 'gasto' ? money(taxAmount * deductiblePercent / 100) : 0;
  const nonDeductibleTax = direction === 'gasto' ? money(taxAmount - deductibleTax) : 0;

  let withholdingRate = 0;
  if (direction === 'ingreso' && profile.subjectToIRPF && activity.activityType === 'profesional') {
    const startYear = Number(String(activity.startDate || profile.professionalActivityStartDate || '').slice(0, 4));
    const invoiceYear = Number(String(body.operationDate || new Date().toISOString()).slice(0, 4));
    const newProfessional = startYear && invoiceYear >= startYear && invoiceYear <= startYear + 2 && activity.newProfessionalRateConfirmed === true;
    withholdingRate = Number(body.withholdingRate ?? activity.defaultWithholdingRate ?? (newProfessional ? 7 : 15));
    if (!body.counterpartyIsWithholdingAgent) { withholdingRate = 0; alerts.push('La retencion profesional solo se propone cuando el destinatario esta obligado a retener.'); }
  } else if (body.withholdingRate != null) withholdingRate = Number(body.withholdingRate);
  const withholdingAmount = money(base * withholdingRate / 100);
  if (manualOverride && !clean(body.manualOverrideReason)) throw new Error('Indica el motivo de la modificacion manual.');
  const bookImpact = operationType === 'outside_scope' ? [] : [direction === 'ingreso' ? 'facturas_emitidas' : 'facturas_recibidas'];
  const modelImpact: string[] = [];
  if (taxKind === 'iva') {
    if (['intra_eu_supply', 'intra_eu_acquisition'].includes(operationType)) modelImpact.push('349');
    if (['oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(regime)) modelImpact.push('369');
    else if (!['recargo_equivalencia', 'agricultura_ganaderia_pesca'].includes(regime)) modelImpact.push('303');
  }
  if (taxKind === 'igic') {
    if (regime === 'pequeno_empresario_igic') modelImpact.push('425');
    else if (regime === 'simplificado') modelImpact.push('421', '425');
    else modelImpact.push(profile.usesSII ? '417' : '420', '425');
    if (regime === 'pequeno_empresario_igic' && ['reverse_charge', 'import'].includes(operationType)) modelImpact.push('412');
  }
  return {
    status: reviewRequired ? 'review_required' : 'ready', reviewRequired, confidence: Math.max(0, confidence),
    ruleSetVersion: RULESET, activityId: activity.id, taxKind, regime, operationType, exemptionKey, legalBasis,
    deductionCategory: clean(body.deductionCategory),
    base, taxRate, taxAmount, deductiblePercent, deductibleTax, nonDeductibleTax,
    withholdingRate, withholdingAmount, total: money(base + taxAmount - withholdingAmount),
    manualOverride, manualOverrideReason: clean(body.manualOverrideReason), reasons, alerts, bookImpact, modelImpact: [...new Set(modelImpact)],
    accounting: {
      inputTaxAccount: taxKind === 'igic' ? '47270000' : '47200000', outputTaxAccount: taxKind === 'igic' ? '47770000' : '47700000',
      nonDeductibleTaxToExpense: nonDeductibleTax,
      reverseCharge: ['reverse_charge', 'intra_eu_acquisition'].includes(operationType),
    },
  };
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

    if (action === 'catalog') return Response.json({ success: true, ruleSetVersion: RULESET, regimes: REGIMES, operations: OPERATIONS, exemptionKeys: EXEMPTION_KEYS, models: MODEL_CATALOG.map(([code, name, authority, frequency]) => ({ code, name, authority, frequency })), sources: SOURCES });

    const [profiles, activities, models] = await Promise.all([
      svc.entities.FiscalProfile.filter({ company_id: companyId, active: true }, '-reviewedAt', 20),
      svc.entities.FiscalActivity.filter({ company_id: companyId }, 'name', 5000),
      svc.entities.TaxModel.filter({ companyId }, 'codigo', 5000),
    ]);
    const profile = profiles?.[0] || null;

    if (action === 'bundle') {
      const invoiceTaxLines=body.invoiceId?await svc.entities.InvoiceTaxLine.filter({companyId,invoiceId:clean(body.invoiceId)},'lineNumber',100):[];
      return Response.json({ success: true, ruleSetVersion: RULESET, profile, activities, models, invoiceTaxLines, recommendations: recommendedObligations(profile, activities), sources: SOURCES });
    }
    if (action === 'evaluate') return Response.json({ success: true, evaluation: evaluate(profile, activities, body), ruleSetVersion: RULESET });

    if (action === 'save_profile') {
      const data = body.profile || {};
      const allowed = ['fiscalName','taxId','entityType','mainTerritory','taxAuthority','filingFrequency','fiscalYear','active','isLargeCompany','isREDEME','usesSII','usesVeriFactu','indirectTaxDefault','defaultVatRate','defaultIgicRate','subjectToIRPF','irpfEstimation','defaultWithholdingRate','professionalActivityStartDate','isProfessionalWithRetention','isPropertyLessor','retainedIncomePercent','model130ExemptionConfirmed','repepStatus','repepEffectiveFrom','repepEffectiveUntil','paysEmploymentOrProfessionalIncome','paysUrbanRent','paysCapitalIncome','hasNonResidentOperations','hasThirdPartyReporting','profileStatus','censusValidationSource','notes'];
      const payload: any = { company_id: companyId, active: data.active !== false, ruleSetVersion: RULESET, reviewedAt: new Date().toISOString(), reviewedBy: user.email };
      for (const key of allowed) if (data[key] !== undefined) payload[key] = data[key];
      if (!clean(payload.fiscalName || profile?.fiscalName) || !clean(payload.mainTerritory || profile?.mainTerritory)) throw new Error('Nombre fiscal y territorio son obligatorios.');
      const saved = profile ? await svc.entities.FiscalProfile.update(profile.id, payload) : await svc.entities.FiscalProfile.create(payload);
      return Response.json({ success: true, profile: saved, recommendations: recommendedObligations(saved, activities), ruleSetVersion: RULESET });
    }

    if (action === 'save_activity') {
      const data = body.activity || {};
      const existing = data.id ? activities.find(item => item.id === data.id) : null;
      const allowed = ['fiscalProfileId','name','iaeCode','iaeActivityCode','cnaeCode','startDate','territory','activityType','indirectTax','indirectTaxRegime','incomeDefaultTreatment','expenseDefaultTreatment','deductionRight','proRataPercent','defaultTaxRate','defaultWithholdingRate','exemptionKey','exemptionLegalBasis','newProfessionalRateConfirmed','retentionIncomePercent','model130Treatment','hasIntraCommunityOperations','accountingDefaults','expectedModels','automationLevel','active','notes'];
      const payload: any = { company_id: companyId, fiscalProfileId: profile?.id || data.fiscalProfileId || '', active: data.active !== false, ruleSetVersion: RULESET, reviewedAt: new Date().toISOString(), reviewedBy: user.email };
      for (const key of allowed) if (data[key] !== undefined) payload[key] = data[key];
      if (!clean(payload.name || existing?.name) || !clean(payload.activityType || existing?.activityType) || !clean(payload.indirectTax || existing?.indirectTax)) throw new Error('Nombre, tipo de actividad e impuesto indirecto son obligatorios.');
      const saved = existing ? await svc.entities.FiscalActivity.update(existing.id, payload) : await svc.entities.FiscalActivity.create(payload);
      const next = existing ? activities.map(item => item.id === saved.id ? saved : item) : [...activities, saved];
      return Response.json({ success: true, activity: saved, recommendations: recommendedObligations(profile, next), ruleSetVersion: RULESET });
    }

    if (action === 'deactivate_activity') {
      const existing = activities.find(item => item.id === body.activityId);
      if (!existing) throw new Error('Actividad no encontrada.');
      const saved = await svc.entities.FiscalActivity.update(existing.id, { active: false, reviewedAt: new Date().toISOString(), reviewedBy: user.email, notes: `${existing.notes ? `${existing.notes}\n` : ''}Desactivada sin borrar historico.`.slice(0, 4000) });
      return Response.json({ success: true, activity: saved });
    }

    if (action === 'sync_obligations') {
      const recommendations = recommendedObligations(profile, activities);
      if (body.apply !== true) return Response.json({ success: true, mode: 'dry_run', recommendations });
      const existingByCode = new Map((models || []).map(item => [clean(item.codigo), item]));
      const created: string[] = [];
      const updated: string[] = [];
      for (const item of recommendations) {
        const current = existingByCode.get(item.code);
        const payload = { nombre: item.name, impuesto: ['303','309','322','353','369','390'].includes(item.code) ? 'IVA' : ['400','412','415','416','417','418','419','420','421','422','424','425'].includes(item.code) ? 'IGIC' : ['130','131','210','216','296'].includes(item.code) ? 'IRPF' : ['111','115','123','180','190','193'].includes(item.code) ? 'Retenciones' : 'Otro', administracion: item.authority, periodicidad: item.frequency, activo: true, fuenteValidacion: item.certainty === 'recommended' ? 'criterio_asesor' : 'pendiente_confirmar', estadoImplementacion: 'configuracion', observaciones: `Propuesta ${RULESET}: ${item.reasons.join('; ')}` };
        if (current) { await svc.entities.TaxModel.update(current.id, payload); updated.push(current.id); }
        else { const row = await svc.entities.TaxModel.create({ companyId, codigo: item.code, ...payload }); created.push(row.id); }
      }
      return Response.json({ success: true, mode: 'apply', created: created.length, updated: updated.length, recommendations });
    }

    if (action === 'save_manual_obligation') {
      const code = clean(body.code);
      const model = MODEL_CATALOG.find(item => item[0] === code);
      if (!model) throw new Error('Modelo fiscal no incluido en el catalogo oficial configurado.');
      const current = (models || []).find(item => clean(item.codigo) === code);
      const tax = ['303','309','322','353','368','369','390'].includes(code) ? 'IVA' : ['400','412','414','415','416','417','418','419','420','421','422','424','425'].includes(code) ? 'IGIC' : ['130','131','210','216','296'].includes(code) ? 'IRPF' : ['111','115','123','180','190','193'].includes(code) ? 'Retenciones' : 'Otro';
      const payload = { nombre: model[1], impuesto: tax, administracion: model[2], periodicidad: model[3], activo: body.active !== false, fuenteValidacion: 'criterio_asesor', estadoImplementacion: 'configuracion', observaciones: `Seleccion manual trazada ${RULESET}: ${clean(body.reason) || 'obligacion confirmada por usuario o asesor'}` };
      const saved = current ? await svc.entities.TaxModel.update(current.id, payload) : await svc.entities.TaxModel.create({ companyId, codigo: code, ...payload });
      return Response.json({ success: true, model: saved, mode: current ? 'updated' : 'created' });
    }

    if (action === 'save_invoice_tax_line') {
      const invoice = await svc.entities.Invoice.get(body.invoiceId).catch(() => null);
      if (!invoice || invoice.company_id !== companyId) throw new Error('Factura no encontrada en esta empresa.');
      const evaluation = evaluate(profile, activities, { ...body, direction: invoice.tipo === 'recibida' ? 'gasto' : 'ingreso', base: body.base ?? invoice.base_imponible, taxRate: body.taxRate ?? invoice.tipo_iva, taxAmount: body.taxAmount ?? invoice.cuota_iva, operationDate: body.operationDate ?? invoice.fecha_emision });
      if (evaluation.reviewRequired && body.confirmReviewed !== true) return Response.json({ success: true, mode: 'preview', evaluation });
      const existing = await svc.entities.InvoiceTaxLine.filter({ companyId, invoiceId: invoice.id, lineNumber: Number(body.lineNumber || 1) }, '-created_date', 20);
      const payload = { companyId, invoiceId: invoice.id, lineNumber: Number(body.lineNumber || 1), operationDate: body.operationDate || invoice.fecha_emision, receiptDate: invoice.tipo === 'recibida' ? (body.receiptDate || invoice.fecha_recepcion || invoice.created_date?.slice(0, 10)) : undefined, taxKind: evaluation.taxKind === 'mixto' ? 'no_aplica' : evaluation.taxKind, rate: evaluation.taxRate, base: evaluation.base, quota: evaluation.taxAmount, deductibleQuota: evaluation.deductibleTax, deductionCategory: clean(body.deductionCategory)||undefined, nonDeductibleQuota: evaluation.nonDeductibleTax, regime: evaluation.regime, operationType: evaluation.operationType, exemptionKey: evaluation.exemptionKey, legalBasis: evaluation.legalBasis, deductible: evaluation.deductibleTax >= evaluation.taxAmount, deductiblePercent: evaluation.deductiblePercent, activityId: evaluation.activityId, manualOverride: evaluation.manualOverride, manualOverrideReason: evaluation.manualOverrideReason, source: evaluation.manualOverride ? 'manual' : 'sistema', reviewStatus: 'validado', reviewedAt: new Date().toISOString(), reviewedBy: user.email, ruleSetVersion: RULESET, schemaVersion: 'pgc8-v1' };
      const taxLine = existing?.[0] ? await svc.entities.InvoiceTaxLine.update(existing[0].id, payload) : await svc.entities.InvoiceTaxLine.create(payload);
      await svc.entities.Invoice.update(invoice.id, { indirect_tax_kind: payload.taxKind, fiscal_treatment: payload.operationType, deductible_tax_amount: payload.deductibleQuota, non_deductible_tax_amount: payload.nonDeductibleQuota, tipo_iva: payload.rate, cuota_iva: payload.quota, retencion_irpf: evaluation.withholdingRate, importe_retencion: evaluation.withholdingAmount, fiscal_activity_id: evaluation.activityId, fiscal_rule_set_version: RULESET, fiscal_review_status: 'validado', fiscal_reviewed_at: new Date().toISOString(), fiscal_reviewed_by: user.email, fiscal_manual_override: evaluation.manualOverride, fiscal_manual_override_reason: evaluation.manualOverrideReason });
      return Response.json({ success: true, mode: 'saved', taxLine, evaluation });
    }

    return Response.json({ error: 'Accion fiscal no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('[fiscalOperations]', error?.message || error);
    return Response.json({ error: error?.message || 'Error fiscal interno.' }, { status: error?.status || 500 });
  }
});


