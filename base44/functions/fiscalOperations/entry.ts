import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { guardIssuedQrInvoiceTaxChange } from './issuedInvoiceQrGuard.ts';
import { reccDate, reccMetadata, reccSchedule, reccCorrections, checkReccEligibility } from './reccRules.mjs';
import { calculateSpecialRegimePreview } from './specialRegimePreview.mjs';

const RULESET = 'taxea-fiscal-es-2026.10.04-v3';
// Los regímenes especiales necesitan cálculo, libro y modelo específicos antes del asiento.
const SPECIAL_POSTING_PENDING = new Set(['mixto', 'simplificado', 'agricola_ganadera', 'agricultura_ganaderia_pesca', 'recargo_equivalencia', 'criterio_caja', 'rebu', 'agencias_viajes', 'oro_inversion', 'oss_exterior_union', 'oss_union', 'ioss_importacion', 'grupo_entidades', 'comerciante_minorista_igic']);
const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

async function listFiscalRows(entity: any, filter: any, sort = '-created_date') {
  const rows: any[] = [];
  const pageSize = 500;
  for (let skip = 0; skip < 100000; skip += pageSize) {
    const page = await entity.filter(filter, sort, pageSize, skip);
    rows.push(...(page || []));
    if (!page || page.length < pageSize) return rows;
  }
  throw Object.assign(new Error('El libro fiscal supera el límite seguro de consulta. Filtra o solicita una exportación segmentada.'), { status: 422 });
}
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
  no_aplica: [['no_sujeta', 'No sujeta · fundamento legal obligatorio']],
  mixto: [['mixto', 'Mixto · elegir impuesto y régimen por operación']],
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
  ['368', 'IVA servicios electronicos - regimenes anteriores', 'AEAT', 'segun_modelo'], ['369', 'IVA ventanilla unica OSS/IOSS', 'AEAT', 'segun_regimen'],
  ['390', 'Resumen anual IVA', 'AEAT', 'anual'], ['349', 'Operaciones intracomunitarias', 'AEAT', 'mensual'], ['347', 'Operaciones con terceros', 'AEAT', 'anual'],
  ['130', 'Pago fraccionado IRPF - estimacion directa', 'AEAT', 'trimestral'], ['131', 'Pago fraccionado IRPF - estimacion objetiva', 'AEAT', 'trimestral'],
  ['111', 'Retenciones trabajo y actividades economicas', 'AEAT', 'trimestral'], ['190', 'Resumen anual modelo 111', 'AEAT', 'anual'],
  ['115', 'Retenciones por alquiler urbano', 'AEAT', 'trimestral'], ['180', 'Resumen anual modelo 115', 'AEAT', 'anual'],
  ['123', 'Retenciones de capital mobiliario y otras rentas', 'AEAT', 'trimestral'], ['193', 'Resumen anual modelo 123', 'AEAT', 'anual'],
  ['200', 'Impuesto sobre Sociedades', 'AEAT', 'anual'], ['202', 'Pago fraccionado Impuesto sobre Sociedades', 'AEAT', 'segun_modelo'],
  ['232', 'Operaciones vinculadas y paraísos fiscales', 'AEAT', 'anual'],
  ['210', 'IRNR sin establecimiento permanente', 'AEAT', 'segun_modelo'], ['216', 'Retenciones IRNR', 'AEAT', 'trimestral'], ['296', 'Resumen anual modelo 216', 'AEAT', 'anual'],
  ['400', 'Declaracion censal IGIC', 'ATC', 'segun_modelo'], ['412', 'Autoliquidacion ocasional IGIC', 'ATC', 'ocasional'],
  ['414', 'Solicitud de devolucion IGIC a no establecidos', 'ATC', 'segun_modelo'],
  ['415', 'Operaciones economicas con terceras personas', 'ATC', 'anual'], ['416', 'Operaciones exentas art. 25 Ley 19/1994', 'ATC', 'anual'],
  ['417', 'Autoliquidacion IGIC SII', 'ATC', 'mensual'], ['418', 'IGIC grupo entidades individual', 'ATC', 'mensual'],
  ['419', 'IGIC grupo entidades agregado', 'ATC', 'mensual'], ['420', 'Autoliquidacion IGIC regimen general', 'ATC', 'trimestral'],
  ['421', 'Autoliquidacion IGIC regimen simplificado', 'ATC', 'trimestral'], ['422', 'IGIC agricultura y ganaderia - reintegro compensaciones', 'ATC', 'segun_modelo'],
  ['424', 'IGIC comerciantes minoristas', 'ATC', 'segun_modelo'], ['425', 'Resumen anual IGIC', 'ATC', 'anual'],
];

function authorize(user: any, companyId: string, company: any) {
  const role = clean(user?.role).toLowerCase();
  const own = clean(user?.data?.company_id || user?.company_id);
  if (['admin', 'super_admin'].includes(role)) return;
  const email = clean(user?.email).toLowerCase();
  const owner = clean(company?.owner_email).toLowerCase();
  const authorized = Array.isArray(company?.usuarios_autorizados)
    ? company.usuarios_autorizados.map((value: unknown) => clean(value).toLowerCase())
    : [];
  if (['advisor', 'asesor'].includes(role)) {
    if ((email && owner === email) || (email && authorized.includes(email))) return;
    throw Object.assign(new Error('El asesor no está asignado explícitamente a esta empresa.'), { status: 403 });
  }
  if (own === companyId || (email && owner === email) || (email && authorized.includes(email))) return;
  throw Object.assign(new Error('No tienes permiso para operar en la empresa seleccionada.'), { status: 403 });
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

async function sha256(value: any) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function canProfessionallyValidate(user: any) {
  const role = clean(user?.role).toLowerCase();
  return role === 'admin' || role === 'super_admin' || role === 'advisor' || role === 'asesor';
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
    const ivaRegimes = new Set(iva.map(item => item.indirectTaxRegime));
    if (ivaRegimes.has('grupo_entidades')) {
      add('322', 'Autoliquidación individual mensual del grupo IVA');
      if (profile?.taxGroupId && profile?.taxGroupRole === 'dominante') add('353', 'Entidad dominante: agregado mensual después de las declaraciones individuales 322', 'review');
    } else {
      if (['oss_union', 'oss_exterior_union', 'ioss_importacion'].some(code => ivaRegimes.has(code))) add('369', 'Operaciones de ventanilla única OSS/IOSS; no mezclar con el 303');
      if (iva.some(item => !['recargo_equivalencia', 'agricultura_ganaderia_pesca', 'exenta_limitada', 'no_sujeta', 'oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(item.indirectTaxRegime))) add('303', 'Operaciones nacionales liquidables; las OSS/IOSS mantienen su 369 separado');
    }
    if (['recargo_equivalencia', 'agricultura_ganaderia_pesca'].some(code => ivaRegimes.has(code))) add('309', 'Supuestos ocasionales de autoliquidación; revisar inversión del sujeto pasivo o adquisiciones intracomunitarias', 'review');
    if (iva.some(item => !['oss_union', 'oss_exterior_union', 'ioss_importacion', 'recargo_equivalencia', 'agricultura_ganaderia_pesca', 'exenta_limitada', 'no_sujeta', 'grupo_entidades'].includes(item.indirectTaxRegime))) add('390', 'Resumen anual IVA; confirmar exoneraciones aplicables', 'review');
  }
  if (igic.length) {
    const igicRegimes = new Set(igic.map(item => item.indirectTaxRegime));
    if (igicRegimes.has('grupo_entidades')) {
      add('418', 'Autoliquidación individual mensual del grupo IGIC');
      if (profile?.taxGroupId && profile?.taxGroupRole === 'dominante') add('419', 'Entidad dominante: agregado mensual del grupo IGIC después de los modelos 418 individuales', 'review');
    } else {
      if (igicRegimes.has('simplificado')) add('421', 'Actividad en régimen simplificado IGIC');
      if (igic.some(item => !['simplificado', 'pequeno_empresario_igic', 'agricultura_ganaderia_pesca', 'comerciante_minorista_igic'].includes(item.indirectTaxRegime))) add(profile?.usesSII ? '417' : '420', profile?.usesSII ? 'IGIC con SII' : 'Actividad IGIC liquidable fuera de los regímenes especiales separados');
    }
    if (igicRegimes.has('agricultura_ganaderia_pesca')) add('422', 'Reintegro de compensaciones cuando proceda', 'review');
    if (igicRegimes.has('comerciante_minorista_igic')) add('424', 'Operaciones/importaciones de comerciante minorista cuando proceda', 'review');
    add('425', igicRegimes.has('pequeno_empresario_igic') ? 'REPEP: declaración anual de volumen de operaciones, sin 420 por esa actividad' : 'Resumen anual IGIC');
    if (igicRegimes.has('pequeno_empresario_igic')) add('412', 'Solo si existe devengo ocasional, por ejemplo inversión del sujeto pasivo', 'review');
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
  const activeActivities = (activities || []).filter(item => item.active !== false);
  const activity = body.activityId
    ? activeActivities.find(item => item.id === body.activityId)
    : body.requireExactActivity === true && activeActivities.length !== 1 ? null : activeActivities[0] || null;
  if (!profile || !activity) return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: [activeActivities.length > 1 && body.requireExactActivity === true ? 'Selecciona expresamente la actividad fiscal de esta factura.' : 'Falta perfil fiscal o actividad económica para la factura.'], ruleSetVersion: RULESET };
  if (body.requireValidatedProfile === true && profile.profileStatus !== 'validado_asesor') return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['El perfil fiscal debe estar validado por el asesor antes de automatizar una factura nueva.'], ruleSetVersion: RULESET };
  const operationDate = clean(body.operationDate);
  if (body.requireValidatedProfile === true && operationDate && ((profile.effectiveFrom && operationDate < profile.effectiveFrom) || (activity.startDate && operationDate < activity.startDate))) return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['La operación es anterior a la vigencia del perfil o actividad seleccionada; requiere revisión histórica del asesor.'], ruleSetVersion: RULESET };
  const direction = body.direction === 'gasto' ? 'gasto' : 'ingreso';
  const taxKind = body.taxKind || activity.indirectTax || profile.indirectTaxDefault || 'iva';
  const regime = body.regime || activity.indirectTaxRegime || 'general';
  if (taxKind === 'mixto') return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['La actividad mixta exige elegir IVA, IGIC o no aplica para esta operación.'], ruleSetVersion: RULESET };
  if (taxKind !== 'no_aplica' && !REGIMES[taxKind]?.some(([code]) => code === regime)) return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['El régimen elegido no corresponde al impuesto de esta operación.'], ruleSetVersion: RULESET };
  if (taxKind === 'no_aplica' && regime !== 'no_sujeta') return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['Sin impuesto indirecto solo se admite una operación no sujeta, con fundamento legal.'], ruleSetVersion: RULESET };
  let operationType = body.operationType || activity[direction === 'ingreso' ? 'incomeDefaultTreatment' : 'expenseDefaultTreatment'] || 'subject_taxed';
  const manualOverride = body.manualOverride === true;
  const reasons: string[] = [];
  const alerts: string[] = [];
  let reviewRequired = activity.automationLevel !== 'automatico';
  let confidence = manualOverride ? 100 : 85;
  let taxRate = Number(body.taxRate ?? activity.defaultTaxRate ?? (taxKind === 'igic' ? profile.defaultIgicRate : profile.defaultVatRate) ?? 0);
  const base = money(body.base);
  let taxAmount = money(body.taxAmount ?? base * taxRate / 100);
  if (body.requireValidatedProfile === true && !manualOverride && direction === 'ingreso' && operationType === 'subject_taxed') {
    taxRate = Number(activity.defaultTaxRate ?? (taxKind === 'igic' ? profile.defaultIgicRate : profile.defaultVatRate) ?? 0);
  }
  if (body.requireValidatedProfile === true && !manualOverride && operationType === 'subject_taxed') taxAmount = money(base * taxRate / 100);
  let deductiblePercent = clamp(body.deductiblePercent ?? (activity.deductionRight === 'sin_derecho' ? 0 : activity.proRataPercent ?? 100));
  if (direction === 'gasto' && activity.deductionRight === 'sin_derecho') deductiblePercent = 0;
  if (direction === 'gasto' && ['prorrata_general', 'limitado'].includes(activity.deductionRight) && body.deductiblePercent == null) deductiblePercent = clamp(activity.proRataPercent);
  let exemptionKey = clean(body.exemptionKey || activity.exemptionKey);
  let legalBasis = clean(body.legalBasis || activity.exemptionLegalBasis);

  if (regime === 'pequeno_empresario_igic') {
    if (direction === 'ingreso' && !['reverse_charge', 'import'].includes(operationType)) { operationType = 'exempt_limited'; exemptionKey = exemptionKey || 'IGIC_REPEP'; taxRate = 0; taxAmount = 0; deductiblePercent = 0; }
    if (direction === 'gasto') deductiblePercent = 0;
    reasons.push('REPEP: operaciones propias exentas y cuotas soportadas sin derecho a deduccion.');
    if (operationType === 'reverse_charge' || operationType === 'import') alerts.push('Puede existir autoliquidacion ocasional IGIC modelo 412.');
  }
  if (['exenta_limitada', 'exenta_plena', 'no_sujeta'].includes(regime) && !manualOverride && direction === 'ingreso') {
    operationType = regime === 'exenta_limitada' ? 'exempt_limited' : regime === 'exenta_plena' ? 'exempt_full' : 'non_subject_article';
  }
  if (direction === 'gasto' && regime === 'exenta_limitada') {
    deductiblePercent = 0;
    reasons.push('Actividad exenta limitada: la cuota soportada se conserva, pero no se deduce y aumenta el coste o gasto.');
  }
  if (direction === 'gasto' && taxKind === 'iva' && ['recargo_equivalencia', 'agricultura_ganaderia_pesca'].includes(regime)) {
    deductiblePercent = 0;
    reasons.push('En esta actividad especial el IVA soportado no se deduce en la autoliquidación periódica; integra el coste o gasto según la naturaleza de la adquisición.');
    if (regime === 'recargo_equivalencia') alerts.push('Comprueba el recargo repercutido por el proveedor: su cuota y el mayor coste requieren desglose específico antes de contabilizar.');
  }
  if (operationType === 'exempt_limited') { taxRate = 0; taxAmount = 0; deductiblePercent = direction === 'gasto' ? 0 : deductiblePercent; if (!exemptionKey || !legalBasis) { reviewRequired = true; reasons.push('La exencion exige clave y fundamento legal revisado.'); } }
  if (operationType === 'exempt_full' || operationType === 'export' || operationType === 'intra_eu_supply') { taxRate = 0; taxAmount = 0; }
  if (['non_subject_article', 'non_subject_location', 'outside_scope'].includes(operationType)) { taxRate = 0; taxAmount = 0; deductiblePercent = 0; if (!legalBasis) { reviewRequired = true; reasons.push('La no sujecion exige motivo y fundamento legal.'); } }
  if (operationType === 'subject_zero') { taxRate = 0; taxAmount = 0; }
  if (['reverse_charge', 'intra_eu_acquisition'].includes(operationType)) { reviewRequired = true; alerts.push(`Autorrepercusion de ${taxKind.toUpperCase()}: registrar cuota devengada y deducible solo en la proporcion permitida.`); }
  if (['canary_peninsula_goods', 'canary_peninsula_service'].includes(operationType)) { reviewRequired = true; confidence -= 20; alerts.push('Canarias no forma parte del territorio IVA: revisar localizacion, importacion/exportacion e inversion del sujeto pasivo.'); }
  if (['recargo_equivalencia', 'comerciante_minorista_igic', 'agricultura_ganaderia_pesca', 'simplificado', 'rebu', 'agencias_viajes', 'oro_inversion', 'grupo_entidades', 'criterio_caja', 'oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(regime)) {
    reviewRequired = true;
    reasons.push('Regimen especial: la regla general no basta para validar esta operacion.');
  }
  if (taxKind === 'mixto' || activity.deductionRight === 'sector_diferenciado') { reviewRequired = true; reasons.push('Actividad mixta o sector diferenciado: seleccionar impuesto y sector en la operacion.'); }
  if (direction === 'gasto' && activity.deductionRight === 'prorrata_especial') {
    const use = clean(body.deductionUse);
    if (!['exclusive_right', 'exclusive_no_right', 'shared'].includes(use)) return { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['Prorrata especial: clasifica el destino del gasto como exclusivo con derecho, exclusivo sin derecho o común.'], ruleSetVersion: RULESET };
    deductiblePercent = use === 'exclusive_right' ? 100 : use === 'exclusive_no_right' ? 0 : clamp(activity.proRataPercent);
    reviewRequired = true;
    reasons.push(`Prorrata especial: destino ${use}; deducción propuesta ${deductiblePercent}%, sujeta a revisión del asesor.`);
  }
  if (SPECIAL_POSTING_PENDING.has(regime)) { reviewRequired = true; alerts.push('Régimen especial pendiente de circuito específico de cálculo, libro y modelo.'); }
  let specialPreview = null;
  let specialPreviewError = '';
  if (body.specialInputs && typeof body.specialInputs === 'object') {
    try {
      specialPreview = calculateSpecialRegimePreview({ ...body.specialInputs, regime, direction, taxKind, taxRate, base, taxAmount, operationDate });
    } catch (error) {
      specialPreviewError = error?.message || 'No se pudo calcular la propuesta especial.';
      reviewRequired = true;
      alerts.push(specialPreviewError);
    }
  }
  const deductibleTax = direction === 'gasto' ? money(taxAmount * deductiblePercent / 100) : 0;
  const nonDeductibleTax = direction === 'gasto' ? money(taxAmount - deductibleTax) : 0;

  let withholdingRate = 0;
  if (direction === 'ingreso' && profile.subjectToIRPF && activity.activityType === 'profesional') {
    const startYear = Number(String(activity.startDate || profile.professionalActivityStartDate || '').slice(0, 4));
    const invoiceYear = Number(String(body.operationDate || new Date().toISOString()).slice(0, 4));
    const newProfessional = startYear && invoiceYear >= startYear && invoiceYear <= startYear + 2 && activity.newProfessionalRateConfirmed === true;
    withholdingRate = Number(body.withholdingRate ?? (Number(activity.defaultWithholdingRate) > 0 ? activity.defaultWithholdingRate : (newProfessional ? 7 : 15)));
    if (!body.counterpartyIsWithholdingAgent) { withholdingRate = 0; alerts.push('La retencion profesional solo se propone cuando el destinatario esta obligado a retener.'); }
  } else if (body.withholdingRate != null) withholdingRate = Number(body.withholdingRate);
  const withholdingAmount = money(base * withholdingRate / 100);
  if (manualOverride && !clean(body.manualOverrideReason)) throw new Error('Indica el motivo de la modificacion manual.');
  const bookImpact = operationType === 'outside_scope' ? [] : [direction === 'ingreso' ? 'facturas_emitidas' : 'facturas_recibidas'];
  const modelImpact: string[] = [];
  if (taxKind === 'iva') {
    if (['intra_eu_supply', 'intra_eu_acquisition'].includes(operationType)) modelImpact.push('349');
    if (['oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(regime)) modelImpact.push('369');
    else if (regime === 'grupo_entidades') modelImpact.push('322');
    else if (['recargo_equivalencia', 'agricultura_ganaderia_pesca'].includes(regime)) {
      if (['reverse_charge', 'intra_eu_acquisition'].includes(operationType)) modelImpact.push('309');
    } else modelImpact.push('303');
  }
  if (taxKind === 'igic') {
    if (regime === 'pequeno_empresario_igic') modelImpact.push('425');
    else if (regime === 'simplificado') modelImpact.push('421', '425');
    else if (regime === 'grupo_entidades') modelImpact.push('418', '425');
    else if (regime === 'comerciante_minorista_igic') modelImpact.push('424', '425');
    else modelImpact.push(profile.usesSII ? '417' : '420', '425');
    if (regime === 'pequeno_empresario_igic' && ['reverse_charge', 'import'].includes(operationType)) modelImpact.push('412');
  }
  return {
    status: reviewRequired ? 'review_required' : 'ready', reviewRequired, postingBlocked: SPECIAL_POSTING_PENDING.has(regime) || (direction === 'gasto' && activity.deductionRight === 'sector_diferenciado'), confidence: Math.max(0, confidence),
    ruleSetVersion: RULESET, activityId: activity.id, taxKind, regime, operationType, exemptionKey, legalBasis,
    deductionCategory: clean(body.deductionCategory), deductionUse: clean(body.deductionUse),
    base, taxRate, taxAmount, deductiblePercent, deductibleTax, nonDeductibleTax,
    withholdingRate, withholdingAmount, total: money(base + taxAmount - withholdingAmount),
    manualOverride, manualOverrideReason: clean(body.manualOverrideReason), reasons, alerts, specialPreview, specialPreviewError, bookImpact, modelImpact: [...new Set(modelImpact)],
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
    const svc = base44.asServiceRole;
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    const action = clean(body.action || 'bundle');
    const internalServiceEvaluation = action === 'evaluate' && user.is_service === true
      && /^service\+[a-f0-9-]+@no-reply\.base44\.com$/i.test(clean(user.email));
    if (!internalServiceEvaluation) authorize(user, companyId, company);

    if (action === 'catalog') return Response.json({ success: true, ruleSetVersion: RULESET, regimes: REGIMES, postingSupport: Object.fromEntries(Object.values(REGIMES).flat().map(([code]) => [code, code === 'criterio_caja' ? 'revision_asesor_factura_simple' : SPECIAL_POSTING_PENDING.has(code) || code === 'mixto' ? 'pendiente_circuito_especial' : 'revision_asesor'])), operations: OPERATIONS, exemptionKeys: EXEMPTION_KEYS, models: MODEL_CATALOG.map(([code, name, authority, frequency]) => ({ code, name, authority, frequency })), sources: SOURCES });

    const [profiles, activities, models, profileVersions] = await Promise.all([
      svc.entities.FiscalProfile.filter({ company_id: companyId, active: true }, '-reviewedAt', 20),
      svc.entities.FiscalActivity.filter({ company_id: companyId }, 'name', 5000),
      svc.entities.TaxModel.filter({ companyId }, 'codigo', 5000),
      svc.entities.FiscalProfileVersion.filter({ company_id: companyId }, '-version', 100),
    ]);
    const profile = profiles?.[0] || null;

    if (action === 'bundle') {
      const invoiceTaxLines=body.invoiceId?await svc.entities.InvoiceTaxLine.filter({companyId,invoiceId:clean(body.invoiceId)},'lineNumber',100):[];
      const invoicePayments=body.invoiceId?await svc.entities.InvoicePayment.filter({company_id:companyId,invoice_id:clean(body.invoiceId)},'payment_date',501):[];
      const invoicePaymentsTruncated=invoicePayments.length>500;
      const issuerSetups = await svc.entities.VerifactuIssuerSetup.filter({ company_id: companyId }, '-registered_at', 20).catch(() => null);
      const activeSetup = (issuerSetups || []).find((item: any) => item.custody_status !== 'revocada') || null;
      const certificateStatus = issuerSetups === null ? 'estado_no_disponible' : activeSetup ? 'referencia_registrada_sin_verificar' : 'sin_certificado_verificado';
      return Response.json({ success: true, ruleSetVersion: RULESET, profile, profileVersions, activities, models, invoiceTaxLines, invoicePayments: invoicePaymentsTruncated ? [] : invoicePayments, invoicePaymentsTruncated, recommendations: recommendedObligations(profile, activities), verifactuReadiness: { requested: profile?.usesVeriFactu === true, obligation: profile?.verifactuObligation || 'pendiente_confirmar', authentication: 'certificado_individual_del_emisor', certificateStatus, custodyRegion: 'europe-southwest1', gatewayStatus: 'no_desplegado', aeatTestStatus: 'no_validado', transmissionStatus: 'desactivada', activationAllowed: false, secretResource: ['admin','super_admin'].includes(clean(user?.role).toLowerCase()) ? activeSetup?.secret_resource || '' : undefined }, sources: SOURCES });
    }
    if (action === 'recc_book') {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2014 || year > 2100) return Response.json({ error: 'Ejercicio no válido.' }, { status: 400 });
      const allInvoices = await listFiscalRows(svc.entities.Invoice, { company_id: companyId, fiscal_regime: 'criterio_caja' });
      const invoices = allInvoices.filter((invoice: any) => !invoice.anulada
        && ['iva', ''].includes(clean(invoice.indirect_tax_kind))
        && Number(clean(invoice.fecha_operacion || invoice.fecha_emision).slice(0, 4)) <= year);
      // Cobros posteriores al límite legal también deben permanecer trazables en el libro del año del cobro.
      if (!invoices.length) return Response.json({ success: true, year, invoices: [], payments: [], issues: [], source: 'Invoice + InvoiceTaxLine + InvoicePayment', generatedAt: new Date().toISOString() });
      const ids = new Set(invoices.map((invoice: any) => invoice.id));
      const [allLines, allPayments] = await Promise.all([
        listFiscalRows(svc.entities.InvoiceTaxLine, { companyId }),
        listFiscalRows(svc.entities.InvoicePayment, { company_id: companyId }, 'payment_date'),
      ]);
      const lines = allLines.filter((line: any) => ids.has(line.invoiceId));
      const payments = allPayments.filter((payment: any) => ids.has(payment.invoice_id));
      const linesByInvoice = new Map<string, any[]>();
      const paymentsByInvoice = new Map<string, any[]>();
      for (const line of lines) {
        if (!linesByInvoice.has(line.invoiceId)) linesByInvoice.set(line.invoiceId, []);
        linesByInvoice.get(line.invoiceId)!.push(line);
      }
      for (const payment of payments) {
        if (!paymentsByInvoice.has(payment.invoice_id)) paymentsByInvoice.set(payment.invoice_id, []);
        paymentsByInvoice.get(payment.invoice_id)!.push(payment);
      }
      const relevantInvoices = invoices.filter((invoice: any) => {
        const operationYear = Number(clean(invoice.fecha_operacion || invoice.fecha_emision).slice(0, 4));
        return operationYear === year || operationYear === year - 1
          || (paymentsByInvoice.get(invoice.id) || []).some((payment: any) => clean(payment.payment_date).slice(0, 4) === String(year));
      });
      const relevantIds = new Set(relevantInvoices.map((invoice: any) => invoice.id));
      const relevantPayments = payments.filter((payment: any) => relevantIds.has(payment.invoice_id));
      const operationIds = [...new Set(relevantPayments.map((payment: any) => clean(payment.accounting_operation_id)).filter(Boolean))];
      const operations = await Promise.all(operationIds.map((id: string) => svc.entities.AccountingPostingOperation.get(id).catch(() => null)));
      const operationById = new Map(operations.filter((operation: any) => operation?.companyId === companyId).map((operation: any) => [operation.id, operation]));
      const transactionIds = [...new Set(relevantPayments.map((payment: any) => clean(payment.bank_transaction_id)).filter(Boolean))];
      const transactions = await Promise.all(transactionIds.map((id: string) => svc.entities.BankTransaction.get(id).catch(() => null)));
      const transactionById = new Map(transactions.filter((transaction: any) => transaction?.company_id === companyId).map((transaction: any) => [transaction.id, transaction]));
      const bankIds = [...new Set([...transactionById.values()].map((transaction: any) => clean(transaction.bank_account_id)).filter(Boolean))];
      const banks = await Promise.all(bankIds.map((id: string) => svc.entities.BankAccount.get(id).catch(() => null)));
      const bankById = new Map(banks.filter((bank: any) => bank?.company_id === companyId).map((bank: any) => [bank.id, bank]));
      const issues: any[] = [];
      const bookInvoices = relevantInvoices.map((invoice: any) => {
        const invoiceLines = linesByInvoice.get(invoice.id) || [];
        const taxBreakdown = invoiceLines.map((line: any) => ({ lineNumber: Number(line.lineNumber || 1), rate: Number(line.rate || 0),
          base: money(line.base), quota: money(line.quota), deductibleQuota: money(line.deductibleQuota) }));
        const lineTotalsMatch = Math.abs(money(taxBreakdown.reduce((sum: number, item: any) => sum + item.base + item.quota, 0)) - money(invoice.total_factura)) <= 0.02
          && Math.abs(money(taxBreakdown.reduce((sum: number, item: any) => sum + item.base, 0)) - money(invoice.base_imponible)) <= 0.02
          && Math.abs(money(taxBreakdown.reduce((sum: number, item: any) => sum + item.quota, 0)) - money(invoice.cuota_iva)) <= 0.02;
        const uniqueLineNumbers = new Set(taxBreakdown.map((item: any) => item.lineNumber)).size === taxBreakdown.length;
        const valid = clean(invoice.fiscal_review_status) === 'validado' && invoiceLines.length > 0 && uniqueLineNumbers
          && invoiceLines.every((line: any) => clean(line.reviewStatus) === 'validado'
            && clean(line.regime) === 'criterio_caja' && clean(line.taxKind) === 'iva')
          && (invoiceLines.length === 1 || (lineTotalsMatch && money(invoice.importe_retencion) === 0
            && invoiceLines.every((line: any) => clean(line.operationType) === 'subject_taxed')));
        if (!valid) issues.push({ invoiceId: invoice.id, reason: 'Factura RECC sin desglose IVA completo, coherente y validado por asesor.' });
        if (invoice.tipo === 'emitida' && !clean(invoice.coletilla_fiscal).toLocaleLowerCase('es-ES').includes('régimen especial del criterio de caja')) {
          issues.push({ invoiceId: invoice.id, reason: 'Factura emitida RECC sin la mención obligatoria en el documento guardado; revisar el PDF existente sin sobrescribirlo.' });
        }
        if (invoice.tipo === 'recibida' && !clean(invoice.fecha_recepcion)) issues.push({ invoiceId: invoice.id, reason: 'Falta fecha de recepción de la factura recibida.' });
        const invoicePayments = paymentsByInvoice.get(invoice.id) || [];
        const totalPaid = money(invoicePayments.filter((payment: any) => !payment.operation_status || payment.operation_status === 'committed')
          .reduce((sum: number, payment: any) => sum + Math.abs(Number(payment.amount) || 0), 0));
        if (totalPaid > money(invoice.total_factura) + 0.01) issues.push({ invoiceId: invoice.id, reason: 'Los pagos superan el total de la factura.' });
        if (!invoicePayments.length && ['cobrada', 'parcial'].includes(clean(invoice.estado_cobro))) issues.push({ invoiceId: invoice.id, reason: 'La factura figura cobrada/pagada sin detalle de movimientos trazables.' });
        return { id: invoice.id, type: invoice.tipo, number: invoice.numero_factura, operationDate: invoice.fecha_operacion || invoice.fecha_emision,
          issueDate: invoice.fecha_emision, receiptDate: invoice.fecha_recepcion || '', counterpartyName: invoice.tipo === 'emitida' ? invoice.cliente_nombre : (invoice.proveedor_nombre || invoice.cliente_nombre),
          counterpartyNif: invoice.tipo === 'emitida' ? invoice.cliente_nif : (invoice.proveedor_nif || invoice.cliente_nif),
          base: money(invoice.base_imponible), quota: money(invoice.cuota_iva), deductibleQuota: money(invoice.deductible_tax_amount), total: money(invoice.total_factura), taxBreakdown,
          forcedRecognitionDate: `${Number(clean(invoice.fecha_operacion || invoice.fecha_emision).slice(0, 4)) + 1}-12-31`, reviewStatus: valid ? 'validado' : 'pendiente_revision' };
      });
      const paymentIds = new Set<string>();
      const invoiceById = new Map(relevantInvoices.map((invoice: any) => [invoice.id, invoice]));
      const bookPayments = relevantPayments.map((payment: any) => {
        const invoice = invoiceById.get(payment.invoice_id);
        const operationDate = clean(invoice?.fecha_operacion || invoice?.fecha_emision).slice(0, 10);
        const paymentDate = clean(payment.payment_date).slice(0, 10);
        if (!clean(payment.id) || paymentIds.has(payment.id)) issues.push({ invoiceId: payment.invoice_id, paymentId: payment.id, reason: 'Identificador de pago duplicado o vacío.' });
        paymentIds.add(payment.id);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate))
          || new Date(paymentDate).toISOString().slice(0, 10) !== paymentDate || paymentDate < operationDate
          || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0
          || (clean(payment.currency) && clean(payment.currency).toUpperCase() !== 'EUR')) {
          issues.push({ invoiceId: payment.invoice_id, paymentId: payment.id, reason: 'Fecha, importe o moneda del pago incompatible con RECC.' });
        }
        const operationId = clean(payment.accounting_operation_id);
        const operationConfirmed = !operationId || operationById.get(operationId)?.status === 'committed';
        const confirmed = (!payment.operation_status || payment.operation_status === 'committed') && operationConfirmed;
        const transaction = transactionById.get(clean(payment.bank_transaction_id));
        const bank = transaction ? bankById.get(clean(transaction.bank_account_id)) : null;
        if (!confirmed) issues.push({ invoiceId: payment.invoice_id, paymentId: payment.id, reason: 'Pago o asiento asociado no confirmado.' });
        if (payment.bank_transaction_id && !transaction) issues.push({ invoiceId: payment.invoice_id, paymentId: payment.id, reason: 'Movimiento bancario de origen no localizado.' });
        if (!clean(payment.method)) issues.push({ invoiceId: payment.invoice_id, paymentId: payment.id, reason: 'Falta el medio de cobro o pago.' });
        return { id: payment.id, invoiceId: payment.invoice_id, date: payment.payment_date, amount: money(payment.amount), method: payment.method || '',
          reference: payment.reference || '', origin: payment.origin || '', bankTransactionId: payment.bank_transaction_id || '',
          bankAccount: bank?.iban || '', confirmed };
      });
      return Response.json({ success: true, year, invoices: bookInvoices, payments: bookPayments, issues,
        source: 'Invoice + InvoiceTaxLine + InvoicePayment + BankTransaction', generatedAt: new Date().toISOString() });
    }
    if (action === 'register_verifactu_vault_reference') {
      if (!['admin', 'super_admin'].includes(clean(user?.role).toLowerCase())) return Response.json({ error: 'Solo administración puede registrar la referencia de custodia.' }, { status: 403 });
      const secretResource = clean(body.secretResource);
      if (!/^projects\/plasma-minutia-510419-c4\/locations\/europe-southwest1\/secrets\/[A-Za-z0-9_-]{1,255}$/.test(secretResource)) {
        return Response.json({ error: 'Indica solo el identificador del secreto regional de Taxea en Madrid; nunca el certificado ni su contraseña.' }, { status: 400 });
      }
      const rows = await svc.entities.VerifactuIssuerSetup.filter({ company_id: companyId }, '-registered_at', 20);
      const current = (rows || []).find((item: any) => item.custody_status !== 'revocada');
      if (current?.secret_resource === secretResource) return Response.json({ success: true, duplicate: true, certificateStatus: 'referencia_registrada_sin_verificar' });
      if (current) return Response.json({ error: 'Ya existe una referencia activa. Revócala y verifica la rotación antes de asociar otra.' }, { status: 409 });
      await svc.entities.VerifactuIssuerSetup.create({ company_id: companyId, secret_resource: secretResource, custody_status: 'referencia_registrada_sin_verificar', registered_at: new Date().toISOString(), registered_by: user.email });
      return Response.json({ success: true, certificateStatus: 'referencia_registrada_sin_verificar', activationAllowed: false });
    }
    if (action === 'evaluate') {
      const evaluation = body.requireValidatedProfile === true && (profiles || []).length !== 1
        ? { status: 'blocked', reviewRequired: true, confidence: 0, reasons: ['Debe existir un único perfil fiscal activo y validado para esta empresa.'], ruleSetVersion: RULESET }
        : evaluate(profile, activities, body);
      return Response.json({ success: true, evaluation, ruleSetVersion: RULESET });
    }

    if (action === 'save_profile') {
      const data = body.profile || {};
      const allowed = ['fiscalName','taxId','entityType','mainTerritory','taxGroupId','taxGroupRole','taxAuthority','filingFrequency','fiscalYear','active','isLargeCompany','isREDEME','usesSII','usesVeriFactu','verifactuObligation','indirectTaxDefault','defaultVatRate','defaultIgicRate','subjectToIRPF','irpfEstimation','irpfImputationMethod','irpfImputationMethodConfirmed','irpfCashMethodEffectiveFrom','irpfCashMethodMinimumUntil','defaultWithholdingRate','professionalActivityStartDate','isProfessionalWithRetention','isPropertyLessor','retainedIncomePercent','model130ExemptionConfirmed','model130TerritorialRelief','model130TerritorialReliefConfirmed','repepStatus','repepEffectiveFrom','repepEffectiveUntil','paysEmploymentOrProfessionalIncome','paysUrbanRent','paysCapitalIncome','hasNonResidentOperations','hasThirdPartyReporting','profileStatus','censusValidationSource','notes','effectiveFrom','lastChangeReason'];
      if (data.taxGroupRole && !['sin_grupo','dominante','dependiente'].includes(data.taxGroupRole)) throw new Error('Rol del grupo fiscal no admitido.');
      if (['dominante','dependiente'].includes(data.taxGroupRole ?? profile?.taxGroupRole) && !clean(data.taxGroupId ?? profile?.taxGroupId)) throw new Error('Indica el identificador del grupo fiscal antes de confirmar el rol.');
      if (data.verifactuObligation !== undefined && !['pendiente_confirmar','obligado','voluntario','excluido'].includes(data.verifactuObligation)) throw new Error('Clasificación VERI*FACTU no admitida.');
      if ((data.usesVeriFactu ?? profile?.usesVeriFactu) === true && (data.verifactuObligation ?? profile?.verifactuObligation) === 'excluido') throw new Error('No puede solicitarse VERI*FACTU para un perfil clasificado como excluido.');
      const now = new Date().toISOString();
      const effectiveFrom = clean(data.effectiveFrom || profile?.effectiveFrom || now.slice(0, 10));
      const changeSummary = clean(data.lastChangeReason || body.changeSummary || 'Actualización del perfil fiscal').slice(0, 1000);
      const payload: any = { company_id: companyId, active: data.active !== false, ruleSetVersion: RULESET, effectiveFrom, lastChangeReason: changeSummary, reviewedAt: now, reviewedBy: user.email };
      for (const key of allowed) if (data[key] !== undefined) payload[key] = data[key];
      if (!canProfessionallyValidate(user)) {
        payload.profileStatus = 'pendiente_revision';
        payload.reviewedBy = '';
        payload.reviewedAt = undefined;
      }
      if (!clean(payload.fiscalName || profile?.fiscalName) || !clean(payload.mainTerritory || profile?.mainTerritory)) throw new Error('Nombre fiscal y territorio son obligatorios.');
      const snapshot = Object.fromEntries(allowed.filter(key => key !== 'lastChangeReason').map(key => [key, payload[key] !== undefined ? payload[key] : profile?.[key]]));
      snapshot.ruleSetVersion = RULESET;
      const contentHash = await sha256(snapshot);
      const latestVersion = [...(profileVersions || [])].sort((a: any, b: any) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
      const version = latestVersion?.snapshot_hash === contentHash ? Number(latestVersion.version || 1) : Number(latestVersion?.version || 0) + 1;
      payload.version = version;
      payload.contentHash = contentHash;
      const saved = profile ? await svc.entities.FiscalProfile.update(profile.id, payload) : await svc.entities.FiscalProfile.create(payload);
      let versionRecord = latestVersion;
      let versionCreated = false;
      if (!latestVersion || latestVersion.snapshot_hash !== contentHash) {
        for (const row of (profileVersions || []).filter((item: any) => item.status === 'active')) {
          await svc.entities.FiscalProfileVersion.update(row.id, { status: 'superseded', effective_until: effectiveFrom, reviewed_at: now, reviewed_by: user.email });
        }
        versionRecord = await svc.entities.FiscalProfileVersion.create({
          company_id: companyId, fiscal_profile_id: saved.id, version, effective_from: effectiveFrom, status: 'active',
          snapshot, snapshot_hash: contentHash, change_summary: changeSummary, changed_by: user.email, changed_at: now,
          reviewed_by: payload.profileStatus === 'validado_asesor' ? user.email : '', reviewed_at: payload.profileStatus === 'validado_asesor' ? now : undefined,
          rule_set_version: RULESET,
        });
        versionCreated = true;
      }
      return Response.json({ success: true, profile: saved, profileVersion: versionRecord, versionCreated, recommendations: recommendedObligations(saved, activities), ruleSetVersion: RULESET });
    }

    if (action === 'save_activity') {
      const data = body.activity || {};
      const existing = data.id ? activities.find(item => item.id === data.id) : null;
      const allowed = ['fiscalProfileId','name','iaeCode','iaeActivityCode','cnaeCode','startDate','territory','activityType','indirectTax','indirectTaxRegime','incomeDefaultTreatment','expenseDefaultTreatment','deductionRight','proRataPercent','defaultTaxRate','defaultWithholdingRate','exemptionKey','exemptionLegalBasis','newProfessionalRateConfirmed','retentionIncomePercent','model130Treatment','hasIntraCommunityOperations','accountingDefaults','expectedModels','automationLevel','active','notes'];
      const payload: any = { company_id: companyId, fiscalProfileId: profile?.id || data.fiscalProfileId || '', active: data.active !== false, ruleSetVersion: RULESET, reviewedAt: new Date().toISOString(), reviewedBy: user.email };
      for (const key of allowed) if (data[key] !== undefined) payload[key] = data[key];
      if (!clean(payload.name || existing?.name) || !clean(payload.activityType || existing?.activityType) || !clean(payload.indirectTax || existing?.indirectTax)) throw new Error('Nombre, tipo de actividad e impuesto indirecto son obligatorios.');
      const selectedTax = clean(payload.indirectTax || existing?.indirectTax);
      const selectedRegime = clean(payload.indirectTaxRegime || existing?.indirectTaxRegime || 'general');
      if (!REGIMES[selectedTax]?.some(([code]) => code === selectedRegime)) throw Object.assign(new Error('El régimen especial no corresponde al impuesto indirecto de la actividad.'), { status: 422 });
      if (selectedTax === 'mixto' && selectedRegime !== 'mixto') throw Object.assign(new Error('La actividad mixta debe clasificarse por operación antes de contabilizar.'), { status: 422 });
      const proRata = payload.proRataPercent ?? existing?.proRataPercent;
      if (proRata != null && (!Number.isFinite(Number(proRata)) || Number(proRata) < 0 || Number(proRata) > 100)) throw Object.assign(new Error('La prorrata debe estar entre 0 y 100 %.'), { status: 422 });
      const saved = existing ? await svc.entities.FiscalActivity.update(existing.id, payload) : await svc.entities.FiscalActivity.create(payload);
      if (profile?.profileStatus === 'validado_asesor') await svc.entities.FiscalProfile.update(profile.id, { profileStatus: 'pendiente_revision', lastChangeReason: 'Actividad fiscal modificada; requiere nueva validación del asesor.' });
      const next = existing ? activities.map(item => item.id === saved.id ? saved : item) : [...activities, saved];
      return Response.json({ success: true, activity: saved, recommendations: recommendedObligations(profile, next), ruleSetVersion: RULESET });
    }

    if (action === 'deactivate_activity') {
      const existing = activities.find(item => item.id === body.activityId);
      if (!existing) throw new Error('Actividad no encontrada.');
      const saved = await svc.entities.FiscalActivity.update(existing.id, { active: false, reviewedAt: new Date().toISOString(), reviewedBy: user.email, notes: `${existing.notes ? `${existing.notes}\n` : ''}Desactivada sin borrar historico.`.slice(0, 4000) });
      if (profile?.profileStatus === 'validado_asesor') await svc.entities.FiscalProfile.update(profile.id, { profileStatus: 'pendiente_revision', lastChangeReason: 'Actividad fiscal desactivada; requiere nueva validación del asesor.' });
      return Response.json({ success: true, activity: saved });
    }

    if (action === 'sync_obligations') {
      const recommendations = recommendedObligations(profile, activities);
      if (body.apply !== true) return Response.json({ success: true, mode: 'dry_run', recommendations });
      const existingByCode = new Map((models || []).map(item => [clean(item.codigo), item]));
      const created: string[] = [];
      const preserved: string[] = [];
      for (const item of recommendations) {
        const current = existingByCode.get(item.code);
        if (current) { preserved.push(current.id); continue; }
        const payload = { nombre: item.name, impuesto: ['303','309','322','353','369','390'].includes(item.code) ? 'IVA' : ['400','412','415','416','417','418','419','420','421','422','424','425'].includes(item.code) ? 'IGIC' : ['130','131','210','216','296'].includes(item.code) ? 'IRPF' : ['111','115','123','180','190','193'].includes(item.code) ? 'Retenciones' : 'Otro', administracion: item.authority, periodicidad: item.frequency, activo: false, fuenteValidacion: 'pendiente_confirmar', estadoImplementacion: 'propuesta', observaciones: `Propuesta ${RULESET}: ${item.reasons.join('; ')}` };
        const row = await svc.entities.TaxModel.create({ companyId, codigo: item.code, ...payload });
        created.push(row.id);
      }
      return Response.json({ success: true, mode: 'apply', created: created.length, preserved: preserved.length, recommendations });
    }

    if (action === 'save_manual_obligation') {
      if (!canProfessionallyValidate(user)) return Response.json({ error: 'Solo el asesor o administrador puede confirmar una obligación fiscal.' }, { status: 403 });
      if (!clean(body.reason)) return Response.json({ error: 'La confirmación o desactivación exige motivo trazable.' }, { status: 422 });
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
      if (!canProfessionallyValidate(user)) return Response.json({ error: 'Solo el asesor o administrador puede confirmar la clasificación fiscal de una factura.' }, { status: 403 });
      if ((profiles || []).length !== 1 || profile?.profileStatus !== 'validado_asesor') return Response.json({ error: 'Debe existir un único perfil fiscal activo y validado por asesor antes de confirmar la factura.' }, { status: 422 });
      const invoice = await svc.entities.Invoice.get(body.invoiceId).catch(() => null);
      if (!invoice || invoice.company_id !== companyId) throw new Error('Factura no encontrada en esta empresa.');
      const selectedActivity = activities.find(item => item.id === (body.activityId || invoice.fiscal_activity_id) && item.active !== false);
      if (invoice.accounting_migration_hold_reason === 'FISCAL_ADVISOR_REVIEW_PHASE1' && selectedActivity && body.manualOverride !== true) {
        const defaultOperation = selectedActivity[invoice.tipo === 'recibida' ? 'expenseDefaultTreatment' : 'incomeDefaultTreatment'] || 'subject_taxed';
        if ((body.taxKind && body.taxKind !== selectedActivity.indirectTax)
          || (body.regime && body.regime !== selectedActivity.indirectTaxRegime)
          || (body.operationType && body.operationType !== defaultOperation)) {
          return Response.json({ error: 'La clasificación difiere de la actividad validada. Marca modificación manual e indica su motivo.' }, { status: 422 });
        }
      }
      const specialInputs = { ...(body.specialInputs && typeof body.specialInputs === 'object' ? body.specialInputs : {}) };
      if (clean(body.regime || selectedActivity?.indirectTaxRegime) === 'criterio_caja') {
        const payments = await svc.entities.InvoicePayment.filter({ company_id: companyId, invoice_id: invoice.id }, 'payment_date', 501);
        if (payments.length > 500) return Response.json({ error: 'La factura supera 500 cobros o pagos. No se valida criterio de caja con una lista truncada; el asesor debe revisar el histórico completo.' }, { status: 422 });
        specialInputs.invoiceGross = Number(invoice.total_factura || 0);
        specialInputs.withholdingAmount = Number(invoice.importe_retencion || 0);
        specialInputs.surchargeAmount = Number(invoice.cuota_recargo || 0);
        specialInputs.advanceConfirmed = body.recc?.advanceConfirmed === true || reccMetadata(invoice).advanceConfirmed === true;
        specialInputs.insolvencyDate = body.recc?.insolvencyDate || reccMetadata(invoice).insolvencyDate || '';
        specialInputs.payments = (payments || []).filter(item => !item.operation_status || item.operation_status === 'committed').map(item => ({ id: item.id, date: item.payment_date, amount: item.amount }));
      }
      if (clean(body.regime || selectedActivity?.indirectTaxRegime) === 'grupo_entidades') {
        specialInputs.groupId = profile.taxGroupId || '';
        specialInputs.groupRole = profile.taxGroupRole || '';
      }
      if (clean(body.regime || selectedActivity?.indirectTaxRegime) === 'recargo_equivalencia' && invoice.tipo === 'recibida') {
        specialInputs.surchargeRate = Number(invoice.tipo_recargo || 0);
      }
      const proposedEvaluation = evaluate(profile, activities, { ...body, specialInputs,
        requireValidatedProfile: true, requireExactActivity: true,
        activityId: body.activityId || invoice.fiscal_activity_id,
        direction: invoice.tipo === 'recibida' ? 'gasto' : 'ingreso',
        base: body.base ?? invoice.base_imponible, taxRate: body.taxRate ?? invoice.tipo_iva,
        taxAmount: body.taxAmount ?? invoice.cuota_iva,
        operationDate: body.operationDate ?? invoice.fecha_operacion ?? invoice.fecha_emision,
      });
      if (proposedEvaluation.status === 'blocked') return Response.json({ error: proposedEvaluation.reasons?.join(' ') || 'Tratamiento fiscal bloqueado.', evaluation: proposedEvaluation }, { status: 422 });
      const recargoPurchase = invoice.tipo === 'recibida' && selectedActivity?.indirectTaxRegime === 'recargo_equivalencia'
        && proposedEvaluation.regime === 'recargo_equivalencia' && proposedEvaluation.taxKind === 'iva'
        && proposedEvaluation.operationType === 'subject_taxed' && Number(invoice.cuota_recargo || 0) > 0;
      if (recargoPurchase) {
        const expectedRate = ({ 21: 5.2, 10: 1.4, 4: 0.5 } as Record<number, number>)[Number(invoice.tipo_iva || 0)];
        const surcharge = money(Number(invoice.base_imponible || 0) * Number(invoice.tipo_recargo || 0) / 100);
        const expectedTotal = money(Number(invoice.base_imponible || 0) + Number(invoice.cuota_iva || 0) + Number(invoice.cuota_recargo || 0));
        const valid = expectedRate != null && Math.abs(expectedRate - Number(invoice.tipo_recargo || 0)) < 0.001
          && Math.abs(surcharge - Number(invoice.cuota_recargo || 0)) <= 0.01
          && Math.abs(expectedTotal - Number(invoice.total_factura || 0)) <= 0.02
          && Math.abs(Number(invoice.importe_retencion || 0)) <= 0.001
          && Math.abs(proposedEvaluation.base - Number(invoice.base_imponible || 0)) <= 0.02
          && Math.abs(proposedEvaluation.taxAmount - Number(invoice.cuota_iva || 0)) <= 0.02
          && Math.abs(proposedEvaluation.taxRate - Number(invoice.tipo_iva || 0)) < 0.001
          && proposedEvaluation.deductibleTax === 0
          && proposedEvaluation.specialPreview?.status === 'proposal_only';
        if (!valid) return Response.json({ error: 'La compra en recargo no cuadra con factura, IVA, tipo de recargo o total. Solo se admite compra nacional ordinaria a tipos vigentes, sin retención; el asesor debe corregir el documento antes de contabilizar.' }, { status: 422 });
        proposedEvaluation.postingBlocked = false;
        proposedEvaluation.modelImpact = [];
        proposedEvaluation.alerts = [...(proposedEvaluation.alerts || []), 'Compra del minorista: IVA y recargo íntegros como mayor coste, sin 472 ni deducción en 303. Asiento y libro separados tras confirmar el asesor.'];
      } else if (invoice.tipo === 'emitida' && selectedActivity?.indirectTaxRegime === 'recargo_equivalencia'
        && proposedEvaluation.regime === 'recargo_equivalencia' && proposedEvaluation.taxKind === 'iva'
        && proposedEvaluation.operationType === 'subject_taxed') {
        const base = Number(invoice.base_imponible || 0);
        const rate = Number(invoice.tipo_iva || 0);
        const quota = Number(invoice.cuota_iva || 0);
        const valid = clean(selectedActivity.activityType) === 'comercial_minorista'
          && [21, 10, 4].includes(rate) && base > 0
          && Math.abs(money(base * rate / 100) - quota) <= 0.01
          && Math.abs(Number(invoice.tipo_recargo || 0)) <= 0.001
          && Math.abs(Number(invoice.cuota_recargo || 0)) <= 0.001
          && Math.abs(Number(invoice.importe_retencion || 0)) <= 0.001
          && Math.abs(Number(invoice.total_factura || 0) - money(base + quota)) <= 0.02
          && Math.abs(proposedEvaluation.base - base) <= 0.02
          && Math.abs(proposedEvaluation.taxAmount - quota) <= 0.02
          && Math.abs(proposedEvaluation.taxRate - rate) < 0.001
          && proposedEvaluation.specialPreview?.status === 'proposal_only';
        if (!valid) return Response.json({ error: 'La venta minorista en recargo no cuadra con el IVA o la factura, o su actividad no está confirmada. Solo se admite venta nacional ordinaria sin retención ni recargo repercutido al cliente.' }, { status: 422 });
        proposedEvaluation.postingBlocked = false;
        proposedEvaluation.modelImpact = [];
        proposedEvaluation.alerts = [...(proposedEvaluation.alerts || []), 'Venta minorista ordinaria: el IVA repercutido forma parte del ingreso contable; no se usa 477 ni se liquida en 303. Confirmación del asesor obligatoria.'];
      } else if (proposedEvaluation.regime === 'criterio_caja' && proposedEvaluation.taxKind === 'iva'
        && proposedEvaluation.operationType === 'subject_taxed') {
        const base = Number(invoice.base_imponible || 0);
        const rate = Number(invoice.tipo_iva || 0);
        const quota = Number(invoice.cuota_iva || 0);
        const metadata = { ...reccMetadata(invoice), ...(body.recc || {}) };
        const breakdown = Array.isArray(body.taxBreakdown) && body.taxBreakdown.length ? body.taxBreakdown : [{ base, rate, quota }];
        const validBreakdown = breakdown.length <= 20 && breakdown.every((row: any) => [21,10,4].includes(Number(row.rate))
          && Number.isFinite(Number(row.base)) && Number.isFinite(Number(row.quota))
          && Math.abs(money(Number(row.base) * Number(row.rate) / 100) - Number(row.quota)) <= 0.01)
          && Math.abs(money(breakdown.reduce((sum: number, row: any) => sum + Number(row.base), 0)) - base) <= 0.01
          && Math.abs(money(breakdown.reduce((sum: number, row: any) => sum + Number(row.quota), 0)) - quota) <= 0.01;
        const validRecc = (invoice.tipo === 'recibida' || selectedActivity?.indirectTaxRegime === 'criterio_caja')
          && (invoice.tipo === 'emitida' || selectedActivity?.indirectTaxRegime === 'criterio_caja'
            || (proposedEvaluation.manualOverride && !!proposedEvaluation.manualOverrideReason))
          && selectedActivity?.indirectTax === 'iva' && validBreakdown && Math.abs(base) > 0
          && Math.abs(Number(invoice.total_factura || 0) - money(base + quota - Number(invoice.importe_retencion || 0))) <= 0.02
          && Math.abs(Number(invoice.cuota_recargo || 0)) <= 0.001
          && clean(invoice.moneda || 'EUR').toUpperCase() === 'EUR'
          && Math.abs(proposedEvaluation.base - base) <= 0.02
          && Math.abs(proposedEvaluation.taxAmount - quota) <= 0.02
          && Math.abs(proposedEvaluation.deductibleTax) <= Math.abs(quota)
          && (invoice.es_rectificativa === true || (!proposedEvaluation.specialPreviewError
            && (!proposedEvaluation.specialPreview || proposedEvaluation.specialPreview.status === 'proposal_only')));
        if (!validRecc) return Response.json({ error: 'RECC: desglose, precio, retención o clasificación incoherentes. Corrige la factura antes de confirmar.', evaluation: proposedEvaluation }, { status: 422 });
        if (body.recc?.eligibility) checkReccEligibility(body.recc.eligibility, body.operationDate || invoice.fecha_operacion || invoice.fecha_emision);
        if (metadata.insolvencyDate && !clean(metadata.reason)) return Response.json({ error: 'El auto de concurso requiere fecha y referencia documental confirmadas por asesor.' }, { status: 422 });
        if (invoice.es_rectificativa === true) {
          const original = await svc.entities.Invoice.get(metadata.originalInvoiceId).catch(() => null);
          if (!original || original.company_id !== companyId || original.tipo !== invoice.tipo || original.anulada
            || original.fiscal_review_status !== 'validado' || original.fiscal_regime !== 'criterio_caja'
            || !clean(metadata.reason) || !metadata.adjustmentDate || base >= 0)
            return Response.json({ error: 'La rectificativa RECC de reducción exige original validado de la misma empresa y tipo, fecha del ajuste y causa documentada por asesor.' }, { status: 422 });
          reccDate(metadata.adjustmentDate);
          const previousCorrections = await listFiscalRows(svc.entities.Invoice, { company_id: companyId, fiscal_regime: 'criterio_caja' });
          const proposed = { ...invoice, recc_metadata: JSON.stringify(metadata), fiscal_review_status: 'validado', fiscal_regime: 'criterio_caja' };
          const corrections = reccCorrections(original, [...previousCorrections.filter((row: any) => row.id !== invoice.id), proposed]);
          const originalPayments = await listFiscalRows(svc.entities.InvoicePayment, { company_id: companyId, invoice_id: original.id }, 'payment_date');
          reccSchedule({ invoiceNet: Math.abs(Number(original.total_factura)), operationDate: original.fecha_operacion || original.fecha_emision,
            ...reccMetadata(original), corrections, payments: originalPayments.map((row: any) => ({ id: row.id, date: row.payment_date, amount: row.amount, status: row.operation_status })) });
          proposedEvaluation.specialPreview = { regime: 'criterio_caja', status: 'proposal_only',
            reason: 'Rectificativa vinculada: se corrige solo IVA reconocido; la reducción no cobrada cancela cuota diferida del original. No se sobrescribe el asiento histórico.' };
          proposedEvaluation.specialPreviewError = '';
        }
        proposedEvaluation.postingBlocked = false;
        proposedEvaluation.alerts = [...(proposedEvaluation.alerts || []), 'RECC: factura al devengo contable y cuota del 303 por cobros o pagos trazados, con límite del 31 de diciembre del año siguiente. El desglose de 472/477 en subcuentas es opcional según el ICAC.'];
      } else if (Math.abs(Number(invoice.cuota_recargo || 0)) > 0.001) {
        proposedEvaluation.postingBlocked = true;
        proposedEvaluation.alerts = [...(proposedEvaluation.alerts || []), 'La factura con recargo no reúne el circuito validado de compra minorista; queda pendiente de asiento, libro y liquidación específicos.'];
      }
      if (proposedEvaluation.postingBlocked) {
        if (body.confirmReviewed !== true) return Response.json({ success: true, mode: 'preview', evaluation: proposedEvaluation });
        return Response.json({ error: 'Este régimen o sector diferenciado requiere un circuito específico de cálculo, libro y modelo. La factura queda pendiente; no se contabilizará con reglas ordinarias.', evaluation: proposedEvaluation }, { status: 422 });
      }
      if (invoice.tipo === 'emitida' && proposedEvaluation.regime === 'criterio_caja'
        && invoice.qr_pdf_url && clean(invoice.fiscal_regime) !== 'criterio_caja') {
        return Response.json({ error: 'La factura ya tiene un PDF emitido sin la mención del criterio de caja. No se reclasifica silenciosamente: revisa y rectifica el documento antes de confirmar el régimen.' }, { status: 409 });
      }
      const evaluation = guardIssuedQrInvoiceTaxChange(invoice, proposedEvaluation, body);
      if (evaluation.reviewRequired && body.confirmReviewed !== true) return Response.json({ success: true, mode: 'preview', evaluation });
      const phaseOnePending = ['FISCAL_ADVISOR_REVIEW_PHASE1', 'FISCAL_POSTING_ERROR'].includes(invoice.accounting_migration_hold_reason);
      if (Math.abs(Number(invoice.base_imponible || 0) - evaluation.base) > 0.02) return Response.json({ error: 'La base de la propuesta no coincide con la factura. Corrige primero el documento origen.' }, { status: 422 });
      if (phaseOnePending && Number(invoice.importe_pagado || 0) > 0) return Response.json({ error: 'La factura pendiente de revisión no puede tener cobros o pagos antes de su validación.' }, { status: 409 });
      if (invoice.linked_journal_entry_id && (
        Math.abs(Number(invoice.cuota_iva || 0) - evaluation.taxAmount) > 0.01 ||
        Math.abs(Number(invoice.deductible_tax_amount ?? (invoice.tipo === 'recibida' ? invoice.cuota_iva : 0)) - evaluation.deductibleTax) > 0.01 ||
        Math.abs(Number(invoice.importe_retencion || 0) - evaluation.withholdingAmount) > 0.01 ||
        clean(invoice.indirect_tax_kind || evaluation.taxKind) !== evaluation.taxKind ||
        evaluation.accounting?.reverseCharge
      )) return Response.json({ error: 'La factura ya tiene un asiento. No se puede cambiar su cuota, deducción, retención o impuesto sin un ajuste contable trazado; la factura y el diario permanecen intactos.' }, { status: 409 });
      const existing = await svc.entities.InvoiceTaxLine.filter({ companyId, invoiceId: invoice.id, lineNumber: Number(body.lineNumber || 1) }, '-created_date', 20);
      const payload = { companyId, invoiceId: invoice.id, lineNumber: Number(body.lineNumber || 1), operationDate: body.operationDate || invoice.fecha_emision, receiptDate: invoice.tipo === 'recibida' ? (body.receiptDate || invoice.fecha_recepcion || invoice.created_date?.slice(0, 10)) : undefined, taxKind: evaluation.taxKind === 'mixto' ? 'no_aplica' : evaluation.taxKind, rate: evaluation.taxRate, base: evaluation.base, quota: evaluation.taxAmount, deductibleQuota: evaluation.deductibleTax, deductionCategory: clean(body.deductionCategory)||undefined, deductionUse: clean(body.deductionUse)||undefined, nonDeductibleQuota: evaluation.nonDeductibleTax, surchargeRate: recargoPurchase ? Number(invoice.tipo_recargo || 0) : 0, surchargeQuota: recargoPurchase ? Number(invoice.cuota_recargo || 0) : 0, regime: evaluation.regime, operationType: evaluation.operationType, exemptionKey: evaluation.exemptionKey, legalBasis: evaluation.legalBasis, deductible: invoice.tipo === 'recibida' && Math.abs(evaluation.nonDeductibleTax) <= 0.01, deductiblePercent: evaluation.deductiblePercent, activityId: evaluation.activityId, manualOverride: evaluation.manualOverride, manualOverrideReason: evaluation.manualOverrideReason, source: evaluation.manualOverride ? 'manual' : 'sistema', reviewStatus: 'validado', reviewedAt: new Date().toISOString(), reviewedBy: user.email, ruleSetVersion: RULESET, schemaVersion: 'pgc8-v1' };
      const taxLine = existing?.[0] ? await svc.entities.InvoiceTaxLine.update(existing[0].id, payload) : await svc.entities.InvoiceTaxLine.create(payload);
      const reccLegend = 'Régimen especial del criterio de caja';
      const existingLegend = String(invoice.coletilla_fiscal || '').trim();
      const issuedReccLegend = invoice.tipo === 'emitida' && payload.taxKind === 'iva' && payload.regime === 'criterio_caja'
        ? { coletilla_fiscal: existingLegend.toLocaleLowerCase('es-ES').includes(reccLegend.toLocaleLowerCase('es-ES'))
          ? existingLegend : [reccLegend, existingLegend].filter(Boolean).join(' · ') }
        : {};
      await svc.entities.Invoice.update(invoice.id, { ...issuedReccLegend, indirect_tax_kind: payload.taxKind, fiscal_treatment: payload.operationType, fiscal_regime: payload.regime, fiscal_exemption_key: payload.exemptionKey, fiscal_legal_basis: payload.legalBasis, deductible_tax_amount: payload.deductibleQuota, non_deductible_tax_amount: payload.nonDeductibleQuota, tipo_iva: payload.rate, cuota_iva: payload.quota, retencion_irpf: evaluation.withholdingRate, importe_retencion: evaluation.withholdingAmount, fiscal_activity_id: evaluation.activityId, fiscal_rule_set_version: RULESET, fiscal_review_status: 'validado', fiscal_reviewed_at: new Date().toISOString(), fiscal_reviewed_by: user.email, fiscal_manual_override: evaluation.manualOverride, fiscal_manual_override_reason: evaluation.manualOverrideReason, ...(phaseOnePending ? { total_factura: recargoPurchase ? money(evaluation.total + Number(invoice.cuota_recargo || 0)) : evaluation.total, importe_pendiente: Math.abs(recargoPurchase ? money(evaluation.total + Number(invoice.cuota_recargo || 0)) : evaluation.total) } : {}) });
      return Response.json({ success: true, mode: 'saved', taxLine, evaluation });
    }

    return Response.json({ error: 'Accion fiscal no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('[fiscalOperations]', error?.message || error);
    return Response.json({ error: error?.message || 'Error fiscal interno.' }, { status: error?.status || 500 });
  }
});

