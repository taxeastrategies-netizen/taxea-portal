import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { AlertCircle, AlertTriangle, Calculator, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, FileCheck2, FileJson, FileSearch, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERIODS = {
  anual: ['Anual'],
  trimestral: ['1T', '2T', '3T', '4T'],
  mensual: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
  sociedades: ['1P', '2P', '3P'],
};

const MODEL_130_ADJUSTMENTS = [
  ['additionalComputableIncome', 'Ingresos fiscales adicionales acumulados'],
  ['nonComputableAccountingIncome', 'Ingresos contables no computables acumulados'],
  ['additionalDeductibleExpenses', 'Gastos fiscales adicionales acumulados'],
  ['nonDeductibleAccountingExpenses', 'Gastos contables no deducibles acumulados'],
  ['sectionOnePercentage', 'Porcentaje casilla 04 (20%, 8% o superior)'],
  ['previousPayments', 'Pagos fraccionados anteriores (casilla 05)'],
  ['withholdings', 'Retenciones soportadas acumuladas (casilla 06)'],
  ['previousYearNetIncome', 'Rendimiento neto del ejercicio anterior'],
  ['article110Reduction', 'Minoración art. 110.3 RIRPF (casilla 13)'],
  ['priorNegativeResults', 'Resultados negativos anteriores (casilla 15)'],
  ['housingDeduction', 'Deducción vivienda habitual (casilla 16)'],
  ['previousSamePeriodResult', 'Resultado previo de la misma autoliquidación (casilla 18)'],
  ['agricultureRevenue', 'Ingresos agrícolas/ganaderos del trimestre'],
  ['agriculturePercentage', 'Porcentaje casilla 09 (2%, 0,8% o superior)'],
  ['agricultureWithholdings', 'Retenciones agrícolas/ganaderas'],
];

const INDIRECT_TAX_MODELS = ['303', '417', '420'];
const ADJUSTMENT_MODELS = ['130', '131', '200', '202', '216', '303', '417', '420', '421'];

const STRUCTURED_ADJUSTMENTS = {
  '131': {
    title: 'Datos-base y liquidación del modelo 131',
    help: 'Los módulos no se deducen de las facturas. Informa los rendimientos calculados por actividad con la Orden anual; Taxea aplica y traza las casillas 01 a 15.',
    fields: [
      ['modulesNetYield','Rendimiento neto por módulos · casilla 01','number'],['salariedEmployees','Unidades de personal asalariado','number'],['modulesPaymentRate','Porcentaje de pago por módulos','number'],['modulesQuarterPayment','Pago por módulos ya calculado · casilla 02','number'],
      ['noBaseDataRevenue','Ingresos sin datos-base · casilla 03','number'],['noBaseDataRate','Porcentaje casilla 04 (mínimo 2%)','number'],['agricultureRevenue','Ingresos agrarios · casilla 05','number'],['agricultureRate','Porcentaje casilla 06 (mínimo 2%)','number'],
      ['withholdings','Retenciones · casilla 08','number'],['previousYearNetIncome','Rendimiento neto del ejercicio anterior','number'],['article110Reduction','Minoración coordinada 130/131 · casilla 09','number'],['priorNegativeResults','Negativos anteriores · casilla 11','number'],
      ['housingDeduction','Deducción vivienda · casilla 12','number'],['previousSamePeriodResult','Ingresado previamente · casilla 14','number'],['youngFarmerReduction','Reducción 25% agricultor joven confirmada','checkbox'],
    ],
  },
  '200': {
    title: 'Conciliación contable-fiscal del modelo 200',
    help: 'Parte del cierre contable. Los ajustes, BIN, tipo, deducciones, retenciones y pagos fraccionados necesitan soporte y revisión; el resultado se traslada después a Sociedades WEB.',
    fields: [['taxableIncreases','Ajustes extracontables positivos','number'],['taxableDecreases','Ajustes extracontables negativos','number'],['taxLossCarryforward','BIN a compensar','number'],['taxRate','Tipo de gravamen (%)','number'],['taxCredits','Bonificaciones y deducciones','number'],['withholdings','Retenciones e ingresos a cuenta','number'],['instalmentPayments','Pagos fraccionados 202','number'],['previousSamePeriodResult','Resultado previo complementaria','number']],
  },
  '202': {
    title: 'Modalidad y magnitudes del modelo 202',
    help: 'Confirma la modalidad censal: artículo 40.2 (cuota del último período vencido) o 40.3 (base acumulada de 3, 9 u 11 meses).',
    fields: [['method','Modalidad','select',[['','Seleccionar'],['40_2','Artículo 40.2 LIS'],['40_3','Artículo 40.3 LIS']]],['previousCorporateTaxQuota','Cuota del último período (40.2)','number'],['currentTaxableBase','Base imponible acumulada (40.3)','number'],['paymentPercentage','Porcentaje 40.3 (%)','number'],['bonuses','Bonificaciones','number'],['withholdings','Retenciones','number'],['previousInstalmentPayments','Pagos anteriores del ejercicio','number'],['minimumPayment','Pago mínimo aplicable','number']],
  },
  '216': {
    title: 'Ajuste de autoliquidación del modelo 216', help: 'Los perceptores se introducen abajo de forma individual. Usa este campo únicamente para una complementaria del mismo período.',
    fields: [['previousSamePeriodResult','Resultado ingresado anteriormente · casilla 20','number']],
  },
  '421': {
    title: 'Módulos y regularización del modelo 421',
    help: 'Las cuotas anuales por actividad y los porcentajes proceden de la Orden canaria aplicable. En 4T se recalculan con los datos reales del ejercicio.',
    fields: [['annualActivityQuota1','Cuota anual actividad 1','number'],['annualActivityQuota2','Cuota anual actividad 2','number'],['annualActivityQuota3','Cuota anual actividad 3','number'],['annualActivityQuota4','Cuota anual actividad 4','number'],['annualActivityQuota5','Cuota anual actividad 5','number'],['quarterAdvance','Ingreso a cuenta · casilla 06','number'],['currentInputQuota','Cuotas soportadas corrientes · casilla 08','number'],['minimumQuotaRate','Porcentaje cuota mínima','number'],['seasonalIndex','Índice de temporada','number'],['previousQuarterAdvances','Ingresos anteriores · casilla 10','number'],['fixedAssetAndReverseChargeOutput','Activos fijos e ISP · casilla 12','number'],['propertyRentalOutput','Arrendamientos · casilla 13','number'],['outputRectificationsDecrease','Rectificaciones minoradoras · casilla 14','number'],['fixedAssetInputQuota','IGIC soportado activos fijos · casilla 15','number'],['rentalAndZeroRateInputQuota','IGIC soportado alquiler/tipo cero · casilla 16','number'],['previousCompensationBalance','Saldo a compensar · casilla 17','number'],['previousSamePeriodResult','Resultado previo · casilla 18','number']],
  },
};

const MODEL_190_KEYS = [['A','Trabajo por cuenta ajena'],['B','Pensiones y prestaciones'],['C','Desempleo'],['D','Reintegros de pago único'],['E','Consejeros y administradores'],['F','Cursos, conferencias y obras'],['G','Actividades profesionales'],['H','Actividades agrarias y estimación objetiva'],['I','Otros rendimientos de actividad'],['J','Cesión de derechos de imagen'],['K','Premios y aprovechamientos forestales'],['L','Rentas exentas y dietas']];
const MODEL_190_SUBKEYS = {
  A: [], B: ['01','02','03','04','99'], C: ['01','02','03','04','05','06','07','08','09'], D: [], E: ['01','02','03','04'], F: ['01','02','03','04','05','06','07'], G: ['01','02','03','04','05','06','07','08'], H: ['01','02','03','04'], I: ['01','02','03'], J: [], K: ['01','02','03','04','05'], L: [...Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')), '99'],
};
const MANUAL_190_SCHEMA = [
  ['taxId','NIF del perceptor','text'],['name','Apellidos y nombre / razón social','text'],['provinceCode','Provincia (2 dígitos)','text'],['key','Clave A-L','select',[['','Seleccionar'],...MODEL_190_KEYS.map(([value,label])=>[value,`${value} · ${label}`])]],['subkey','Subclave (vacía si no procede)','text'],
  ['base','Percepción dineraria','number'],['withholding','Retención dineraria','number'],['inKindValue','Valoración en especie','number'],['accountPayment','Ingreso a cuenta efectuado','number'],['passedOnAccountPayment','Ingreso a cuenta repercutido','number'],['accrualYear','Ejercicio de devengo anterior','text'],
  ['birthYear','Año de nacimiento','text'],['familySituation','Situación familiar 1/2/3','text'],['spouseTaxId','NIF cónyuge/titular unidad','text'],['disability','Discapacidad 0/1/2/3','text'],['contractType','Contrato 1/2/3/4','text'],['householdHolder','Titular unidad convivencia 1/2','text'],['ceutaPalmaCode','Territorio 0/1/2','text'],
  ['reductions','Reducciones','number'],['deductibleExpenses','Gastos deducibles','number'],['compensatoryPensions','Pensiones compensatorias','number'],['childSupport','Anualidades por alimentos','number'],['incapacityCash','Incapacidad dineraria','number'],['incapacityWithholding','Retención incapacidad','number'],['incapacityInKindValue','Incapacidad en especie','number'],['incapacityAccountPayment','Ingreso a cuenta incapacidad','number'],
  ['childrenData','Hijos (6 dígitos diseño)','text'],['disabledDescendantsData','Descendientes discapacidad (12 dígitos)','text'],['ascendantsData','Ascendientes (4 dígitos)','text'],['disabledAscendantsData','Ascendientes discapacidad (6 dígitos)','text'],['firstThreeChildrenData','Cómputo 3 primeros hijos (3 dígitos)','text'],['benefitTypesB01','Prestaciones B.01 (5 indicadores 0/1)','text'],
  ['homeLoanReduction','Reducción vivienda habitual','checkbox'],['startupSharesExcess','Exceso acciones empresa emergente','checkbox'],['fundManagementIncome','Rendimientos gestión de fondos','checkbox'],['specialDataConfirmed','Ficha oficial revisada','checkbox'],
];

const DECLARABLE_SCHEMAS = {
  '131': [
    ['iaeCode','Epígrafe IAE (4 caracteres)','text'],['auxIndicator','Indicador auxiliar 659.4/691.9','text'],['netYield','Rendimiento neto actividad','number'],['paymentRate','Porcentaje pago fraccionado','number'],['quarterPayment','Pago fraccionado actividad','number'],['participationRate','Participación en entidad (%)','number'],['seasonalDays','Días actividad de temporada año anterior','number'],['startYear','Año inicio actividad nueva','text'],['quarterDays','Días de ejercicio en el trimestre','number'],
    ['ceutaMelillaCode','Ceuta/Melilla 0/1/2','text'],['singlePremiseCode','Un solo local o sin él 0/1/2','text'],['vehicles','Vehículos afectos','number'],['municipalityCode','Categoría municipio 0-5','text'],['higherPaymentRate','Porcentaje superior voluntario','number'],['tractorWithoutTrailer','Tractocamión sin semirremolque','checkbox'],['singleTractorWithoutTrailer','Único tractocamión sin semirremolque','checkbox'],['loadCapacityCode','Capacidad carga 0/1/2','text'],
    ['salariedAdultHours','Horas asalariados mayores de 19','number'],['salariedMinorHours','Horas menores/formación','number'],['salariedDisabledHours','Horas asalariados con discapacidad','number'],['collectiveAgreementHours','Horas convenio','number'],['otherSalariedAdultHours','Horas resto asalariados mayores','number'],['otherSalariedMinorHours','Horas resto menores/formación','number'],['otherSalariedDisabledHours','Horas resto con discapacidad','number'],['otherCollectiveAgreementHours','Horas convenio resto','number'],['ownerHours','Horas titular','number'],['spouseHours','Horas cónyuge','number'],['minorChildrenHours','Horas hijos menores','number'],
    ...Array.from({ length: 4 }, (_, index) => [[`tableCapacity${index + 1}`,`Mesa ${index + 1} · capacidad`,'number'],[`tableUnits${index + 1}`,`Mesa ${index + 1} · unidades`,'number']]).flat(),
    ...Array.from({ length: 7 }, (_, index) => [[`module${index + 1}Units`,`Módulo ${index + 1} · unidades`,'number'],[`module${index + 1}Amount`,`Módulo ${index + 1} · rendimiento`,'number']]).flat(),
    ['employmentIncentive','Minoración empleo','number'],['investmentIncentive','Minoración inversión','number'],['specialIndex','Índice especial','number'],['smallBusinessIndex','Índice pequeña dimensión','number'],['seasonalIndex','Índice temporada','number'],['excessIndex','Índice exceso','number'],['startupIndex','Índice nueva actividad','number'],['specialDataConfirmed','Datos contrastados con Orden de módulos','checkbox'],
  ],
  '190': MANUAL_190_SCHEMA,
  '303': [
    ['activityType','Tipo de actividad','select',[['other','Simplificada no agraria'],['agriculture','Agrícola, ganadera o forestal']]],['activityCode','Código actividad agraria (2 dígitos)','text'],['iaeCode','Epígrafe IAE (4 caracteres)','text'],['auxIndicator','Indicador 691.9/722 (1 o 2)','text'],
    ...Array.from({ length: 7 }, (_, index) => [[`module${index + 1}Units`,`Módulo ${index + 1} · unidades`,'number'],[`module${index + 1}Amount`,`Módulo ${index + 1} · importe`,'number']]).flat(),
    ['volumeIncome','Volumen de ingresos agrarios','number'],['quotaIndex','Índice de cuota (%)','number'],['currentOutputQuota','Cuota devengada corriente','number'],['reductions','Reducciones','number'],['advancePercentage','Porcentaje ingreso a cuenta','number'],['quarterAdvance','Ingreso a cuenta calculado','number'],
    ['currentInputQuota','Cuotas soportadas corrientes (4T)','number'],['agricultureCompensations','Compensaciones REAGP satisfechas (4T)','number'],['seasonalIndex','Índice corrector temporada','number'],['minimumQuotaPercentage','Porcentaje cuota mínima','number'],['foreignRefunds','Devoluciones de cuotas otros países','number'],['minimumQuota','Cuota mínima','number'],['annualDerivedQuota','Cuota anual derivada confirmada','number'],
    ['intraAcquisitionOutputQuota','Cuota AIB atribuible a esta actividad','number'],['fixedAssetsOutputQuota','Cuota venta de activos fijos','number'],['reverseChargeOutputQuota','Cuota por inversión sujeto pasivo','number'],['fixedAssetsDeductibleQuota','IVA deducible de activos fijos','number'],['investmentRegularization','Regularización bienes de inversión','number'],['specialDataConfirmed','Magnitudes contrastadas con la Orden anual','checkbox'],
  ],
  '216': [['recipientTaxId','NIF/identificador perceptor','text'],['recipientName','Nombre o razón social','text'],['country','País ISO','text'],['incomeKey','Clave de renta','text'],['nature','Naturaleza','text'],['paymentDate','Fecha de pago','date'],['accruedAmount','Importe íntegro','number'],['withholdingBase','Base de retención','number'],['withholdingAmount','Retención','number'],['exemptionCode','Código exención','text'],['treatyCode','Convenio','text'],['dividendOrEquityIncome','Dividendo/participación','checkbox'],['notSubjectToWithholding','Exceptuada de retención','checkbox']],
  '296': [['recipientTaxId','Identificador principal del perceptor','text'],['spanishTaxId','NIF español, si dispone','text'],['foreignTaxId','NIF en país de residencia','text'],['recipientName','Nombre o razón social','text'],['country','País residencia ISO','text'],['personalityKey','Personalidad','select',[['','Seleccionar'],['F','F · Persona física'],['J','J · Persona jurídica/entidad']]],['incomeKey','Clave de renta 01-25','text'],['subkey','Subclave 01-15','text'],['nature','Naturaleza','select',[['','Seleccionar'],['D','D · Dineraria'],['E','E · En especie']]],['paymentDate','Fecha de devengo','date'],['accruedAmount','Importe íntegro de control','number'],['withholdingBase','Base de retención','number'],['withholdingRate','Tipo de retención (%)','number'],['withholdingAmount','Retención','number'],['paymentRole','Papel del pagador 1/2/3','text'],['mediatorCode','Perceptor mediador 1/2','text'],['bic','BIC mediador (6 caracteres)','text'],['issuerCodeType','Tipo código emisor 1/2/3','text'],['issuerCode','Código emisor','text'],['accountCodeType','Tipo cuenta C/O/P','text'],['accountCode','Cuenta/operación','text'],['address','Domicilio extranjero','text'],['addressComplement','Complemento domicilio','text'],['city','Ciudad','text'],['region','Provincia/región','text'],['postalCode','Código postal','text'],['birthDate','Fecha nacimiento (persona física)','date'],['birthCity','Lugar de nacimiento','text'],['birthCountry','País nacimiento ISO','text'],['previousPayerTaxId','NIF pagador anterior','text'],['marketKey','Clave mercado A/B/C/D','text'],['lei','Código LEI','text'],['specialWithholdingProcedure','Procedimiento especial de retención','checkbox'],['requiresSpecialAnnex','Requiere anexo especial A/B/F','checkbox'],['specialDataConfirmed','Ficha 296 revisada','checkbox']],
  '349': [['operatorTaxId','NIF-IVA operador','text'],['operatorName','Nombre o razón social','text'],['country','País ISO','text'],['operationKey','Clave A/E/I/S/T/H/M/R/D/C','text'],['operationDate','Fecha de operación','date'],['amount','Base/importe de operación ordinaria','number'],['rectification','Es una rectificación','checkbox'],['rectificationAmount','Nueva base/importe corregido','number'],['originalAmount','Base/importe declarado anteriormente','number'],['originalYear','Ejercicio original','text'],['originalPeriod','Período original','text'],['replacementOperatorTaxId','NIF-IVA sustituto (solo clave C)','text'],['replacementOperatorName','Nombre sustituto (solo clave C)','text'],['specialDataConfirmed','Datos contrastados con documentación y VIES','checkbox']],
  '232': [['relatedPartyTaxId','NIF parte vinculada','text'],['relatedPartyName','Nombre o razón social','text'],['country','País ISO','text'],['relationType','Tipo de vinculación','text'],['operationType','Tipo de operación','text'],['valuationMethod','Método de valoración','text'],['incomePayment','Ingreso o pago','select',[['income','Ingreso'],['payment','Pago']]],['operationDate','Fecha de operación','date'],['category','Bloque','select',[['related','Operaciones vinculadas'],['patent_box','Patent box'],['tax_haven','Territorio no cooperativo']]],['amount','Importe sin IVA/IGIC','number']],
};

const MODEL_180_FIELDS = [
  ['recipientProvinceCode', 'Provincia perceptor (2 dígitos)', 'text'],
  ['cadastralReference', 'Referencia catastral', 'text'],
  ['roadType', 'Tipo vía INE', 'text'], ['roadName', 'Nombre de la vía', 'text'], ['houseNumber', 'Número', 'text'],
  ['locality', 'Localidad', 'text'], ['municipality', 'Municipio', 'text'], ['municipalityCode', 'Código municipio INE (5 dígitos)', 'text'],
  ['propertyProvinceCode', 'Provincia inmueble (2 dígitos)', 'text'], ['postalCode', 'Código postal', 'text'],
  ['complement', 'Complemento de dirección', 'text'], ['representativeTaxId', 'NIF representante (si procede)', 'text'],
];

const MODEL_190_NUMERIC_FIELDS = [
  ['reductions', 'Reducciones aplicables'], ['deductibleExpenses', 'Gastos deducibles'],
  ['compensatoryPensions', 'Pensiones compensatorias'], ['childSupport', 'Anualidades por alimentos'],
];
const MODEL_190_EXTENDED_MONEY_FIELDS = [
  ['inKindValue','Valoración en especie'],['accountPayment','Ingreso a cuenta efectuado'],['passedOnAccountPayment','Ingreso a cuenta repercutido'],
  ['incapacityCash','Incapacidad laboral dineraria'],['incapacityWithholding','Retención por incapacidad'],['incapacityInKindValue','Incapacidad en especie'],['incapacityAccountPayment','Ingreso a cuenta incapacidad'],['incapacityPassedOnAccountPayment','Ingreso repercutido incapacidad'],
  ['stateWithholding','Hacienda estatal'],['navarraWithholding','Navarra'],['alavaWithholding','Álava'],['gipuzkoaWithholding','Gipuzkoa'],['bizkaiaWithholding','Bizkaia'],
];

const MODEL_193_NATURES = {
  A: [['01', 'Primas por asistencia'], ['02', 'Dividendos y beneficios'], ['03', 'Otros activos con participación'], ['04', 'Derechos de uso sobre valores'], ['05', 'Otras utilidades de socio'], ['06', 'Rendimientos exentos'], ['07', 'Dividendos IIC'], ['08', 'Dividendos sin retención']],
  B: [['01', 'Intereses de títulos privados'], ['02', 'Intereses de títulos públicos'], ['03', 'Intereses de préstamos no bancarios'], ['04', 'Régimen transitorio financiero'], ['05', 'Cesión de crédito por entidad financiera'], ['06', 'Otros rendimientos'], ['07', 'Rendimientos exentos']],
  C: [['01', 'Propiedad intelectual, no autor'], ['02', 'Propiedad industrial'], ['03', 'Asistencia técnica'], ['04', 'Arrendamiento de muebles, negocios o minas'], ['05', 'Rentas vitalicias o temporales'], ['06', 'Derechos de imagen IRPF'], ['07', 'Subarrendamiento urbano IRPF'], ['08', 'Derechos de imagen IS/IRNR-EP'], ['09', 'Premios IS/IRNR-EP'], ['10', 'Administradores IS/IRNR-EP'], ['11', 'Rendimientos exentos'], ['12', 'Otros · base general'], ['13', 'Otros · base del ahorro'], ['14', 'Otros · no IRPF'], ['15', 'Anticipos de derechos de autor']],
  D: [['01', 'Intereses de títulos privados'], ['02', 'Intereses de títulos públicos'], ['03', 'Intereses de préstamos no bancarios'], ['04', 'Régimen transitorio financiero'], ['05', 'Cesión de crédito por entidad financiera'], ['06', 'Otros rendimientos'], ['07', 'Rendimientos exentos']],
};

const MODEL_193_MONEY_FIELDS = [
  ['perceptionAmount', 'Importe íntegro de la percepción'], ['reductions', 'Reducciones'], ['retentionBase', 'Base de retención'], ['retentionRate', 'Último tipo de retención (%)'], ['penalties', 'Penalizaciones'],
];

const THIRD_PARTY_SPECIAL_FIELDS = [
  ['cashAmount', 'Cobros en metálico (> 6.000 €)'], ['cashAccountingAnnualAmount', 'Devengado anual por criterio de caja'],
  ['propertyRentAmount', 'Arrendamientos de locales · anual'], ['propertyTransferAmount', 'Transmisiones de inmuebles · anual'],
];

const PROPERTY_FIELDS = [
  ['cadastralReference', 'Referencia catastral'], ['roadType', 'Tipo de vía'], ['roadName', 'Nombre de la vía'], ['numberingType', 'Tipo número'],
  ['houseNumber', 'Número'], ['numberQualifier', 'Calificador'], ['block', 'Bloque'], ['portal', 'Portal'], ['stair', 'Escalera'], ['floor', 'Piso'], ['door', 'Puerta'],
  ['complement', 'Complemento'], ['locality', 'Localidad'], ['municipality', 'Municipio'], ['municipalityCode', 'Código INE municipio'], ['provinceCode', 'Provincia'], ['postalCode', 'Código postal'],
];

function apiErrorPayload(error) {
  return /** @type {any} */ (error)?.response?.data || {};
}

function apiErrorMessage(error, fallback) {
  const detail = /** @type {any} */ (error);
  return detail?.response?.data?.error || detail?.message || fallback;
}


function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

function periodsFor(definition, fiscalProfile) {
  if (Array.isArray(definition.periodOptions) && definition.periodOptions.length) return definition.periodOptions;
  if (definition.frequency === 'anual') return PERIODS.anual;
  if (definition.code === '202') return PERIODS.sociedades;
  if (definition.frequency === 'mensual') return PERIODS.mensual;
  if (['130', '131', '420', '421'].includes(definition.code)) return PERIODS.trimestral;
  if (definition.frequency.includes('mensual') && (fiscalProfile?.isLargeCompany || fiscalProfile?.isREDEME || fiscalProfile?.usesSII)) return PERIODS.mensual;
  return PERIODS.trimestral;
}

function downloadBase64(file) {
  if (!file?.contentBase64) return;
  const bytes = Uint8Array.from(atob(file.contentBase64), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function boxesToText(boxes = {}) {
  return Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([code, value]) => `${code}=${value}`).join('\n');
}

function boxesFromText(text) {
  return Object.fromEntries(String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [code, ...rest] = line.split(/[=:;]/);
    const normalized = rest.join('.').trim().replace(/\s|€|EUR/gi, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    return [String(code || '').trim().toUpperCase().replace(/^CASILLA\s*/i, ''), Number(normalized)];
  }).filter(([code, value]) => code && Number.isFinite(value)));
}

async function fileSha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function FiledReturnImport({ companyId, modelCode, year, period, onImported }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [form, setForm] = useState({ presentationDate: '', justificationNumber: '', previousJustificationNumber: '', declarationType: 'original', result: '', resultDisposition: '', boxesText: '', confirmed: false });

  const reset = () => { setError(''); setNotice(''); setFileInfo(null); setForm({ presentationDate: '', justificationNumber: '', previousJustificationNumber: '', declarationType: 'original', result: '', resultDisposition: '', boxesText: '', confirmed: false }); };

  async function analyzeFile(file) {
    if (!file) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const [hash, upload] = await Promise.all([fileSha256(file), base44.integrations.Core.UploadFile({ file })]);
      let rawContent = '';
      let extracted = /** @type {any} */ ({});
      if (isPdf) {
        const response = /** @type {any} */ (await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: upload.file_url,
          json_schema: {
            type: 'object',
            properties: {
              modelo: { type: 'string' }, ejercicio: { type: 'number' }, periodo: { type: 'string' }, nif_cif: { type: 'string' },
              fechaPresentacion: { type: 'string' }, numeroJustificante: { type: 'string' }, tipoDeclaracion: { type: 'string' }, importeFinal: { type: 'number' }, resultadoDestino: { type: 'string' },
              fields: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, label: { type: 'string' }, value: { type: 'number' } } } },
            },
          },
        }));
        extracted = response?.output || response || {};
      } else {
        rawContent = await file.text();
        if (rawContent.length > 2000000) throw new Error('El fichero supera el límite de 2 MB para lectura estructurada.');
      }
      const response = await base44.functions.invoke('taxModelOperations', {
        action: 'preview_filed_return', companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period,
        rawContent, extracted, fileUrl: upload.file_url, fileName: file.name, fileHash: hash,
        presentationDate: extracted.fechaPresentacion || '', justificationNumber: extracted.numeroJustificante || '', declarationType: extracted.tipoDeclaracion || 'original',
      });
      const data = response.data;
      setFileInfo({ fileUrl: upload.file_url, fileName: file.name, fileHash: hash, rawContent, extracted, preview: data.preview, warnings: data.warnings || [] });
      setForm(current => ({ ...current, presentationDate: data.preview?.presentationDate || current.presentationDate, justificationNumber: data.preview?.justificationNumber || current.justificationNumber, declarationType: data.preview?.declarationType || 'original', result: data.preview?.result ?? '', resultDisposition: data.preview?.resultDisposition || '', boxesText: boxesToText(data.preview?.boxes), confirmed: false }));
      if (data.errors?.length) setError(data.errors.join(' '));
      if (data.warnings?.length) setNotice(data.warnings.join(' '));
    } catch (caught) {
      setError(apiErrorMessage(caught, 'No se pudo analizar el modelo presentado.'));
    } finally { setWorking(false); }
  }

  async function importSnapshot() {
    if (!fileInfo) return setError('Selecciona el fichero o justificante presentado.');
    if (!form.confirmed) return setError('Confirma que las casillas coinciden con la declaración presentada.');
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await base44.functions.invoke('taxModelOperations', {
        action: 'import_filed_return', companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period,
        rawContent: fileInfo.rawContent, extracted: fileInfo.extracted, fileUrl: fileInfo.fileUrl, fileName: fileInfo.fileName, fileHash: fileInfo.fileHash,
        presentationDate: form.presentationDate, justificationNumber: form.justificationNumber, previousJustificationNumber: form.previousJustificationNumber,
        declarationType: form.declarationType, importeFinal: form.result === '' ? undefined : Number(form.result), resultDisposition: form.resultDisposition, presentedBoxes: boxesFromText(form.boxesText), confirmImport: true,
      });
      setNotice(response.data?.alreadyImported ? 'Este modelo ya estaba guardado; no se creó un duplicado.' : 'Modelo presentado guardado. Los períodos posteriores ya pueden usar su arrastre.');
      onImported?.();
    } catch (caught) {
      const payload = apiErrorPayload(caught);
      setError(payload?.blockers?.join(' ') || payload?.error || caught?.message || 'No se pudo guardar el modelo presentado.');
    } finally { setWorking(false); }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-sm font-semibold text-slate-800">Histórico presentado y arrastres</h3><p className="mt-1 text-xs leading-5 text-slate-600">Importa la declaración realmente presentada. Taxea conserva sus casillas como una foto, evita duplicados y compara las facturas incorporadas después.</p></div>
        <Button type="button" variant="outline" className="gap-2 border-blue-300 bg-white" onClick={() => { setOpen(value => !value); if (open) reset(); }}><Upload className="h-4 w-4" />{open ? 'Cerrar importación' : 'Importar modelo presentado'}</Button>
      </div>
      {open && <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-white p-4">
        <label className="block cursor-pointer rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-4 text-center text-xs text-blue-800"><input type="file" className="hidden" accept=".pdf,.txt,.111,.115,.123,.130,.180,.190,.193,.303,.347,.390,.415,.420,.425,application/pdf,text/plain" onChange={event => analyzeFile(event.target.files?.[0])} />{working ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Analizando…</span> : fileInfo ? fileInfo.fileName : 'Seleccionar fichero oficial o justificante PDF'}</label>
        {fileInfo && <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-600">Fecha de presentación<input type="date" value={form.presentationDate} onChange={event => setForm(current => ({ ...current, presentationDate: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
            <label className="text-xs text-slate-600">Justificante o CSV<input value={form.justificationNumber} onChange={event => setForm(current => ({ ...current, justificationNumber: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
            <label className="text-xs text-slate-600">Tipo de declaración<select value={form.declarationType} onChange={event => setForm(current => ({ ...current, declarationType: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2"><option value="original">Original</option><option value="complementaria">Complementaria</option><option value="rectificativa">Rectificativa</option><option value="sustitutiva">Sustitutiva</option></select></label>
            <label className="text-xs text-slate-600">Resultado presentado<input type="number" step="0.01" value={form.result} onChange={event => setForm(current => ({ ...current, result: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
          </div>
          {['303', '420'].includes(modelCode) && Number(form.result) < 0 && <label className="block text-xs text-slate-600">Destino del resultado negativo presentado<select value={form.resultDisposition} onChange={event => setForm(current => ({ ...current, resultDisposition: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="a_compensar">Quedó a compensar</option><option value="a_devolver">Se solicitó a devolver</option></select></label>}
          {form.declarationType !== 'original' && <label className="block text-xs text-slate-600">Justificante anterior<input value={form.previousJustificationNumber} onChange={event => setForm(current => ({ ...current, previousJustificationNumber: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>}
          <label className="block text-xs text-slate-600">Casillas presentadas · una por línea (`01=1000.00`)<textarea rows={7} value={form.boxesText} onChange={event => setForm(current => ({ ...current, boxesText: event.target.value, confirmed: false }))} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
          <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={form.confirmed} onChange={event => setForm(current => ({ ...current, confirmed: event.target.checked }))} />He contrastado modelo, ejercicio, período, NIF, resultado y casillas con la declaración efectivamente presentada.</label>
          <Button type="button" onClick={importSnapshot} disabled={working || !form.confirmed} className="gap-2 bg-blue-700 hover:bg-blue-800">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar histórico presentado</Button>
        </>}
        {error && <p className="text-xs leading-5 text-red-700">{error}</p>}
        {notice && <p className="text-xs leading-5 text-amber-700">{notice}</p>}
      </div>}
    </section>
  );
}

function HistoryAndCarryforwardPanel({ result, modelCode }) {
  const history = result?.history;
  const carryforward = history?.carryforward || result?.calculation?.carryforward;
  const applied = carryforward?.carry || [];
  const review = carryforward?.review || [];
  const deferred = carryforward?.deferred || [];
  const prior130 = carryforward?.type === 'irpf_cumulative' ? carryforward.previousFilings || [] : [];
  const missing130 = carryforward?.type === 'irpf_cumulative' ? carryforward.missingPeriods || [] : [];
  const indirectCarry = ['iva_deduction', 'igic_deduction'].includes(carryforward?.type) ? carryforward : null;
  const hasContent = history?.presented || history?.importedCount || applied.length || review.length || deferred.length || prior130.length || missing130.length || indirectCarry;
  if (!hasContent) return null;
  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Histórico, diferencias y arrastres</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">La declaración presentada queda congelada. Los documentos posteriores se analizan sin alterar aquella foto ni mover el devengo contable.</p>
        </div>
      </div>

      {history?.presented && <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Período ya presentado</p><p className="mt-1 text-sm text-slate-700">{history.filing?.date || 'Fecha no disponible'} · versión {history.filing?.snapshotVersion || 1}{history.filing?.justificationNumber ? ` · justificante ${history.filing.justificationNumber}` : ''}</p></div>
          <div className="text-right"><p className="text-xs text-slate-500">Presentado / cálculo actual</p><p className="text-sm font-semibold text-slate-900">{formatMoney(history.filing?.result)} / {formatMoney(result.calculation?.result)}</p></div>
        </div>
        {!!history.differences?.length ? <div className="mt-3 overflow-auto rounded-lg border border-amber-100">
          <table className="w-full min-w-[480px] text-xs"><thead className="bg-amber-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Casilla</th><th className="px-3 py-2 text-right">Presentada</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Diferencia</th></tr></thead><tbody>{history.differences.map(row => <tr key={row.code} className="border-t border-amber-100"><td className="px-3 py-2 font-mono font-semibold text-indigo-700">{row.code}</td><td className="px-3 py-2 text-right">{formatMoney(row.presented)}</td><td className="px-3 py-2 text-right">{formatMoney(row.current)}</td><td className={`px-3 py-2 text-right font-semibold ${Number(row.difference) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(row.difference)}</td></tr>)}</tbody></table>
        </div> : <p className="mt-3 text-xs text-emerald-700">El cálculo actual coincide con las casillas importadas.</p>}
      </div>}

      {carryforward?.type === 'irpf_cumulative' && <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-xs font-semibold text-slate-700">Pagos anteriores usados en la casilla 05</p><p className="mt-2 text-xl font-bold text-indigo-800">{prior130.length}</p><p className="mt-1 text-xs text-slate-500">{carryforward.previousPaymentsSource === 'filed_returns' ? 'Suma de casillas 07 positivas menos casillas 16 de los modelos importados.' : carryforward.previousPaymentsSource === 'manual' ? 'Confirmados manualmente para este cálculo.' : 'Falta completar el histórico anterior.'}</p>{prior130.map(row => <p key={row.id} className="mt-1 text-xs text-slate-600">{row.period}: {formatMoney(row.amount)} · {row.date}</p>)}</div>
        <div className={`rounded-xl border p-3 ${missing130.length || carryforward.missingNegativePeriods?.length ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}><p className="text-xs font-semibold text-slate-700">Continuidad acumulativa</p><p className="mt-2 text-xs leading-5 text-slate-600">Los ingresos y gastos de grupos 6 y 7 se recalculan desde el 1 de enero. Una factura tardía conserva su ejercicio de devengo y entra en el siguiente trimestre abierto.</p><p className="mt-2 text-xs text-slate-600">Casilla 15: {formatMoney(carryforward.priorNegativeApplied)} aplicada · {formatMoney(carryforward.priorNegativeRemaining)} pendiente.</p>{!!missing130.length && <p className="mt-2 text-xs font-medium text-red-700">Falta casilla 05: {missing130.join(', ')}.</p>}{!!carryforward.missingNegativePeriods?.length && <p className="mt-2 text-xs font-medium text-red-700">Falta casilla 19: {carryforward.missingNegativePeriods.join(', ')}.</p>}</div>
      </div>}

      {indirectCarry && <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-xs text-slate-500">Saldo anterior</p><p className="mt-1 text-lg font-bold text-indigo-800">{formatMoney(indirectCarry.previousBalance)}</p><p className="text-xs text-slate-500">{indirectCarry.balanceSource === 'filed_return' ? `Importado de ${indirectCarry.previousFiling?.period || ''} ${indirectCarry.previousFiling?.year || ''}` : indirectCarry.balanceSource === 'manual' ? 'Confirmado manualmente' : 'Histórico pendiente'}</p></div>
        <div className="rounded-xl border border-cyan-100 bg-white p-3"><p className="text-xs text-slate-500">Aplicado ahora</p><p className="mt-1 text-lg font-bold text-cyan-800">{formatMoney(indirectCarry.appliedPrevious)}</p></div>
        <div className="rounded-xl border border-amber-100 bg-white p-3"><p className="text-xs text-slate-500">Nuevo saldo generado</p><p className="mt-1 text-lg font-bold text-amber-800">{formatMoney(indirectCarry.newCompensation)}</p><p className="text-xs text-slate-500">{indirectCarry.resultDisposition === 'a_compensar' ? 'A compensar' : indirectCarry.resultDisposition === 'a_devolver' ? 'A devolver' : 'Pendiente de decisión'}</p></div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs text-slate-500">Saldo para el próximo período</p><p className="mt-1 text-lg font-bold text-emerald-800">{formatMoney(indirectCarry.nextBalance)}</p></div>
      </div>}

      {(applied.length > 0 || review.length > 0 || deferred.length > 0) && <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs text-slate-500">Deducciones tardías aplicadas</p><p className="mt-1 text-xl font-bold text-emerald-700">{applied.length}</p><p className="text-xs text-slate-500">{formatMoney(applied.reduce((sum, row) => sum + Number(row.quota || 0), 0))}</p></div>
        <div className="rounded-xl border border-red-200 bg-white p-3"><p className="text-xs text-slate-500">Requieren revisión</p><p className="mt-1 text-xl font-bold text-red-700">{review.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Pendientes de período futuro</p><p className="mt-1 text-xl font-bold text-slate-700">{deferred.length}</p></div>
      </div>}

      {!!history?.lateItems?.length && <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Altas posteriores que afectan al período presentado</p>
        <div className="mt-3 space-y-2">{history.lateItems.map(item => <div key={item.sourceId} className="rounded-lg border border-red-100 bg-white p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{item.document}</span><span className="text-slate-500">Devengo/pago {item.operationDate} · alta {item.addedAt}</span></div><p className="mt-1 leading-5 text-red-700">{item.reason}</p>{Number(item.amount) !== 0 && <p className="mt-1 font-medium text-slate-700">Efecto detectado: {formatMoney(item.amount)}</p>}</div>)}</div>
      </div>}

      {['111', '115', '123', '303', '420'].includes(modelCode) && history?.presented && <p className="rounded-lg border border-indigo-100 bg-white p-3 text-xs leading-5 text-slate-600">Las ventas, cuotas devengadas y retenciones omitidas no se pasan automáticamente a otro período: Taxea las separa para revisar el procedimiento corrector aplicable al período original.</p>}
    </section>
  );
}

function Annual180Editor({ details, values, onChange, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Fichas de inmueble obligatorias del modelo 180</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Cada pago conserva su factura de origen. La ficha debe completarse y quedar validada por asesor antes de habilitar el fichero AEAT.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              return (
                <details key={detail.recordKey} className="rounded-xl border border-violet-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Situación inmueble
                      <select value={payload.propertySituation || ''} onChange={event => onChange(detail.recordKey, 'propertySituation', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm">
                        <option value="">Seleccionar</option><option value="1">1 · España salvo País Vasco/Navarra, con referencia</option><option value="2">2 · País Vasco, con referencia</option><option value="3">3 · Navarra, con referencia</option><option value="4">4 · Sin referencia catastral</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600">Modalidad
                      <select value={payload.modality || '1'} onChange={event => onChange(detail.recordKey, 'modality', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm"><option value="1">1 · Dineraria</option><option value="2">2 · En especie</option></select>
                    </label>
                    {MODEL_180_FIELDS.map(([key, label, type]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type={type} value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm" /></label>)}
                  </div>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join(', ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>
                    {canReview && <Button size="sm" className="bg-violet-700 hover:bg-violet-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Annual190Editor({ details, values, onChange, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Fichas de perceptores del modelo 190</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Taxea agrupa nóminas en clave A y facturas profesionales pagadas en clave G. Los datos personales y fiscales deben confirmarse y quedar validados por asesor antes de generar el fichero AEAT.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const key = payload.key || detail.key || 'A';
              const isPayroll = key === 'A';
              const subkeys = MODEL_190_SUBKEYS[key] || [];
              return (
                <details key={detail.recordKey} className="rounded-xl border border-indigo-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {key} · {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Provincia del perceptor
                      <input inputMode="numeric" maxLength={2} value={payload.provinceCode ?? ''} onChange={event => onChange(detail.recordKey, 'provinceCode', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-slate-600">Clave
                      <select value={key} onChange={event => onChange(detail.recordKey, 'key', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm">{MODEL_190_KEYS.map(([value,label]) => <option key={value} value={value}>{value} · {label}</option>)}</select>
                    </label>
                    {!!subkeys.length && <label className="text-xs font-medium text-slate-600">Subclave {key}
                      <select value={payload.subkey || detail.subkey || subkeys[0]} onChange={event => onChange(detail.recordKey, 'subkey', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm">{subkeys.map(value => <option key={value} value={value}>{value}</option>)}</select>
                    </label>}
                    <label className="text-xs font-medium text-slate-600">Ejercicio de devengo atrasado
                      <input inputMode="numeric" maxLength={4} placeholder="Vacío si es el actual" value={payload.accrualYear ?? ''} onChange={event => onChange(detail.recordKey, 'accrualYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-slate-600">NIF representante (si procede)
                      <input maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm uppercase" />
                    </label>
                    {isPayroll && <>
                      <label className="text-xs font-medium text-slate-600">Año de nacimiento<input inputMode="numeric" maxLength={4} value={payload.birthYear ?? ''} onChange={event => onChange(detail.recordKey, 'birthYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" /></label>
                      <label className="text-xs font-medium text-slate-600">Situación familiar<select value={payload.familySituation ?? ''} onChange={event => onChange(detail.recordKey, 'familySituation', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="">Seleccionar</option><option value="1">1 · Soltero/viudo/divorciado con hijos</option><option value="2">2 · Casado, cónyuge sin rentas suficientes</option><option value="3">3 · Otras situaciones</option></select></label>
                      <label className="text-xs font-medium text-slate-600">NIF del cónyuge (situación 2)<input maxLength={9} value={payload.spouseTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'spouseTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm uppercase" /></label>
                      <label className="text-xs font-medium text-slate-600">Discapacidad<select value={payload.disability || '0'} onChange={event => onChange(detail.recordKey, 'disability', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="0">0 · Sin discapacidad</option><option value="1">1 · Entre 33% y 65%</option><option value="2">2 · Entre 33% y 65% con movilidad reducida</option><option value="3">3 · Igual o superior al 65%</option></select></label>
                      <label className="text-xs font-medium text-slate-600">Contrato o relación<select value={payload.contractType ?? ''} onChange={event => onChange(detail.recordKey, 'contractType', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="">Seleccionar</option><option value="1">1 · General</option><option value="2">2 · Menos de un año</option><option value="3">3 · Relación laboral especial</option><option value="4">4 · Peonadas o jornales diarios</option></select></label>
                    </>}
                    {MODEL_190_NUMERIC_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" /></label>)}
                  </div>
                  <details className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Percepciones en especie, incapacidad y datos avanzados del diseño AEAT</summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {MODEL_190_EXTENDED_MONEY_FIELDS.map(([field, label]) => <label key={field} className="text-xs text-slate-600">{label}<input type="number" step="0.01" value={payload[field] ?? ''} onChange={event => onChange(detail.recordKey, field, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded border border-indigo-200 bg-white px-2" /></label>)}
                      {[['childrenData','Hijos · 6 dígitos'],['disabledDescendantsData','Descendientes con discapacidad · 12 dígitos'],['ascendantsData','Ascendientes · 4 dígitos'],['disabledAscendantsData','Ascendientes con discapacidad · 6 dígitos'],['firstThreeChildrenData','Cómputo tres primeros hijos · 3 dígitos'],['benefitTypesB01','Tipos de prestación B.01 · 5 indicadores 0/1']].map(([field,label]) => <label key={field} className="text-xs text-slate-600">{label}<input inputMode="numeric" value={payload[field] ?? ''} onChange={event => onChange(detail.recordKey, field, event.target.value)} className="mt-1 h-9 w-full rounded border border-indigo-200 bg-white px-2" /></label>)}
                      <label className="text-xs text-slate-600">Ceuta/Melilla/La Palma<select value={payload.ceutaPalmaCode || (payload.ceutaMelilla ? '1' : '0')} onChange={event => onChange(detail.recordKey, 'ceutaPalmaCode', event.target.value)} className="mt-1 h-9 w-full rounded border border-indigo-200 bg-white px-2"><option value="0">0 · No aplica</option><option value="1">1 · Ceuta o Melilla</option><option value="2">2 · Isla de La Palma</option></select></label>
                      {key === 'L' && (payload.subkey || detail.subkey) === '29' && <><label className="text-xs text-slate-600">Titular unidad de convivencia<select value={payload.householdHolder || ''} onChange={event => onChange(detail.recordKey, 'householdHolder', event.target.value)} className="mt-1 h-9 w-full rounded border border-indigo-200 bg-white px-2"><option value="">Seleccionar</option><option value="1">1 · Es titular</option><option value="2">2 · No es titular</option></select></label><label className="text-xs text-slate-600">Complemento ayuda infancia<select value={payload.childhoodSupplementCode || ''} onChange={event => onChange(detail.recordKey, 'childhoodSupplementCode', event.target.value)} className="mt-1 h-9 w-full rounded border border-indigo-200 bg-white px-2"><option value="">Seleccionar</option><option value="1">1 · Incluye complemento</option><option value="2">2 · No incluye complemento</option></select></label></>}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><input type="checkbox" checked={!!payload.homeLoanReduction} onChange={event => onChange(detail.recordKey, 'homeLoanReduction', event.target.checked)} />Reducción por vivienda habitual</label><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><input type="checkbox" checked={!!payload.startupSharesExcess} onChange={event => onChange(detail.recordKey, 'startupSharesExcess', event.target.checked)} />Exceso acciones empresa emergente</label><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><input type="checkbox" checked={!!payload.fundManagementIncome} onChange={event => onChange(detail.recordKey, 'fundManagementIncome', event.target.checked)} />Rendimientos por gestión de fondos</label></div>
                  </details>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.ceutaMelilla} onChange={event => onChange(detail.recordKey, 'ceutaMelilla', event.target.checked)} />Rentas obtenidas en Ceuta o Melilla</label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.mobility} onChange={event => onChange(detail.recordKey, 'mobility', event.target.checked)} />Movilidad geográfica aplicable</label>
                  </div>
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que la clave, subclave, provincia, devengo, datos personales y reducciones de este perceptor han sido revisados.</label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>{canReview && <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Annual193Editor({ details, declaration, expenseDetails = [], values, onChange, onSave, onSaveExpense, onDeleteExpense, saving, canReview }) {
  const [expenseDraft, setExpenseDraft] = useState(/** @type {Record<string, any>} */ ({}));
  if (!details?.length) return null;
  const declarationPayload = values[declaration?.recordKey] || declaration?.manual || {};
  const specialDeclarant = !!declarationPayload.declarantNatureSpecial;
  return (
    <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Clasificación anual del modelo 193</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Las facturas financieras pagadas aportan importes y retenciones. La naturaleza de la renta, emisor, mercado y papel del pagador se completan aquí conforme al diseño AEAT.</p>
          <div className="mt-3 rounded-xl border border-fuchsia-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800">Configuración de la declaración</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700"><input className="mt-1" type="checkbox" checked={specialDeclarant} onChange={event => onChange(declaration.recordKey, 'declarantNatureSpecial', event.target.checked)} />Marcar “S” porque el declarante no pertenece a las categorías especiales indicadas en el diseño 193.</label>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700"><input className="mt-1" type="checkbox" checked={!!declarationPayload.expenseAnnexNotApplicable} disabled={expenseDetails.length > 0} onChange={event => onChange(declaration.recordKey, 'expenseAnnexNotApplicable', event.target.checked)} />Confirmo que no procede la relación de gastos del art. 26.1.a LIRPF.</label>
            </div>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!declarationPayload.specialDataConfirmed} onChange={event => onChange(declaration.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que se ha revisado la naturaleza del declarante y si procede el anexo de gastos.</label>
            {!!declaration?.missingFields?.length && <p className="mt-2 text-xs text-amber-700">Pendiente: {declaration.missingFields.join('; ')}.</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(declaration, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar configuración</Button>{canReview && <Button size="sm" className="bg-fuchsia-700 hover:bg-fuchsia-800" onClick={() => onSave(declaration, 'validado_asesor')} disabled={saving || !!declaration?.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar configuración</Button>}</div>
          </div>
          {!specialDeclarant && <div className="mt-3 rounded-xl border border-fuchsia-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-800">Relación de gastos del artículo 26.1.a LIRPF</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Cada fila se exporta como registro tipo 2 específico, con el importe en las posiciones 195-207 del diseño 193.</p></div>{expenseDraft.recordKey && <Button size="sm" variant="outline" onClick={() => setExpenseDraft({})}><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button>}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="text-xs text-slate-600">NIF contribuyente<input maxLength={9} value={expenseDraft.taxId ?? ''} onChange={event => setExpenseDraft(current => ({...current,taxId:event.target.value.toUpperCase()}))} className="mt-1 h-9 w-full rounded border border-fuchsia-200 px-2" /></label><label className="text-xs text-slate-600">Apellidos y nombre / razón social<input value={expenseDraft.name ?? ''} onChange={event => setExpenseDraft(current => ({...current,name:event.target.value}))} className="mt-1 h-9 w-full rounded border border-fuchsia-200 px-2" /></label><label className="text-xs text-slate-600">NIF representante<input maxLength={9} value={expenseDraft.representativeTaxId ?? ''} onChange={event => setExpenseDraft(current => ({...current,representativeTaxId:event.target.value.toUpperCase()}))} className="mt-1 h-9 w-full rounded border border-fuchsia-200 px-2" /></label><label className="text-xs text-slate-600">Importe de gastos<input type="number" min="0" step="0.01" value={expenseDraft.expenseAmount ?? ''} onChange={event => setExpenseDraft(current => ({...current,expenseAmount:event.target.value === '' ? '' : Number(event.target.value)}))} className="mt-1 h-9 w-full rounded border border-fuchsia-200 px-2" /></label></div>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!expenseDraft.specialDataConfirmed} onChange={event => setExpenseDraft(current => ({...current,specialDataConfirmed:event.target.checked}))} />Confirmo que el contribuyente y el gasto están revisados con soporte documental.</label>
            <Button size="sm" className="mt-3 bg-fuchsia-700 hover:bg-fuchsia-800" disabled={saving} onClick={() => { const recordKey=expenseDraft.recordKey || `Annual193:Expense:${Date.now()}:${Math.random().toString(36).slice(2,8)}`; onSaveExpense({recordKey,recordId:expenseDraft.recordId,payload:expenseDraft,reviewStatus:canReview?'validado_asesor':'pendiente_revision'}); setExpenseDraft({}); }}><Plus className="mr-1 h-4 w-4" />{expenseDraft.recordKey?'Guardar gasto':'Añadir gasto'}</Button>
            {!!expenseDetails.length && <div className="mt-3 overflow-x-auto rounded-lg border border-fuchsia-100"><table className="w-full text-xs"><thead className="bg-fuchsia-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Contribuyente</th><th className="px-3 py-2 text-right">Gasto</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody>{expenseDetails.map(row => <tr key={row.recordKey} className="border-t border-fuchsia-100"><td className="px-3 py-2">{row.name} · {row.taxId}</td><td className="px-3 py-2 text-right">{formatMoney(row.expenseAmount)}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => setExpenseDraft({...(row.manual || row),recordId:row.recordId,recordKey:row.recordKey})}>Editar</Button><Button size="sm" variant="outline" className="text-red-700" disabled={saving} onClick={() => onDeleteExpense(row)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>)}</tbody></table></div>}
          </div>}
          {specialDeclarant && <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Con naturaleza del declarante “S”, el diseño AEAT no admite registros de relación de gastos.</p>}
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const perceptionKey = payload.perceptionKey || detail.perceptionKey || '';
              const capital = ['A', 'B', 'D'].includes(perceptionKey);
              return (
                <details key={detail.recordKey} className="rounded-xl border border-fuchsia-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">{perceptionKey || 'Sin clasificar'} · {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span></summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Provincia<input inputMode="numeric" maxLength={2} value={payload.provinceCode ?? ''} onChange={event => onChange(detail.recordKey, 'provinceCode', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">Clave de percepción<select value={perceptionKey} onChange={event => onChange(detail.recordKey, 'perceptionKey', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="">Seleccionar</option><option value="A">A · Fondos propios</option><option value="B">B · Cesión de capitales</option><option value="C">C · Otros rendimientos</option><option value="D">D · Capitales a entidad vinculada</option></select></label>
                    <label className="text-xs font-medium text-slate-600">Naturaleza<select value={payload.nature || ''} onChange={event => onChange(detail.recordKey, 'nature', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="">Seleccionar</option>{(MODEL_193_NATURES[perceptionKey] || []).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-600">Tipo de percepción<select value={payload.perceptionType || '1'} onChange={event => onChange(detail.recordKey, 'perceptionType', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="1">1 · Dineraria</option><option value="2">2 · En especie</option></select></label>
                    <label className="text-xs font-medium text-slate-600">NIF representante<input maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm uppercase" /></label>
                    <label className="text-xs font-medium text-slate-600">Ejercicio de devengo anterior<input inputMode="numeric" maxLength={4} value={payload.accrualYear ?? ''} onChange={event => onChange(detail.recordKey, 'accrualYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>
                    {MODEL_193_MONEY_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>)}
                  </div>
                  {capital && !specialDeclarant && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3"><p className="text-xs font-semibold text-slate-800">Identificación del emisor y pago</p><div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs text-slate-600">Clave código<select value={payload.keyCode || ''} onChange={event => onChange(detail.recordKey, 'keyCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="1">1 · NIF emisor</option><option value="2">2 · ISIN</option><option value="3">3 · Extranjero sin ISIN</option><option value="4">4 · NIF + ISIN</option></select></label>
                    <label className="text-xs text-slate-600">Código emisor<input value={payload.issuerCode ?? ''} onChange={event => onChange(detail.recordKey, 'issuerCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    <label className="text-xs text-slate-600">ISIN<input maxLength={12} value={payload.isin ?? ''} onChange={event => onChange(detail.recordKey, 'isin', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    <label className="text-xs text-slate-600">Papel del pagador<select value={payload.paymentRole || ''} onChange={event => onChange(detail.recordKey, 'paymentRole', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="1">1 · Emisor</option><option value="2">2 · Mediador nacional</option><option value="3">3 · Mediador extranjero</option><option value="4">4 · Mediador extranjero no retenedor</option><option value="5">5 · Mediador de otras rentas B-06</option></select></label>
                    <label className="text-xs text-slate-600">Tipo código cuenta<select value={payload.accountCodeType || ''} onChange={event => onChange(detail.recordKey, 'accountCodeType', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Sin contenido</option><option value="C">C · Código cuenta</option><option value="O">O · Otra identificación</option><option value="P">P · Préstamo de valores</option></select></label>
                    <label className="text-xs text-slate-600">Cuenta/operación<input maxLength={20} value={payload.accountCode ?? ''} onChange={event => onChange(detail.recordKey, 'accountCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label>
                    <label className="text-xs text-slate-600">Mercado<select value={payload.marketKey || ''} onChange={event => onChange(detail.recordKey, 'marketKey', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="A">A · Mercado español</option><option value="B">B · Mercado UE</option><option value="C">C · Otro mercado oficial extranjero</option><option value="D">D · Otros</option></select></label>
                    <label className="text-xs text-slate-600">NIF pagador anterior<input maxLength={9} value={payload.previousPayerTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'previousPayerTaxId', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    {perceptionKey === 'A' && <label className="text-xs text-slate-600">Fecha de devengo<input type="date" value={payload.accrualDate ?? ''} onChange={event => onChange(detail.recordKey, 'accrualDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label>}
                  </div><label className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.recipientMediator} onChange={event => onChange(detail.recordKey, 'recipientMediator', event.target.checked)} />El perceptor es mediador</label></div>}
                  <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Campos especiales y distribución territorial</summary><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs text-slate-600">Ceuta/Melilla/La Palma<select value={payload.ceutaPalmaCode || '0'} onChange={event => onChange(detail.recordKey, 'ceutaPalmaCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="0">0 · No aplica</option><option value="1">1 · Ceuta o Melilla</option><option value="2">2 · Isla de La Palma</option></select></label>
                    {[['stateWithholding','Hacienda estatal'],['navarraWithholding','Navarra'],['alavaWithholding','Álava'],['gipuzkoaWithholding','Gipuzkoa'],['bizkaiaWithholding','Bizkaia'],['loanCompensation','Compensaciones préstamo'],['loanGuarantees','Garantías préstamo']].map(([key,label]) => <label key={key} className="text-xs text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded border px-2" /></label>)}
                    {payload.accountCodeType === 'P' && <><label className="text-xs text-slate-600">Inicio préstamo<input type="date" value={payload.loanStartDate ?? ''} onChange={event => onChange(detail.recordKey, 'loanStartDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label><label className="text-xs text-slate-600">Vencimiento préstamo<input type="date" value={payload.loanEndDate ?? ''} onChange={event => onChange(detail.recordKey, 'loanEndDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label></>}
                  </div></details>
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que la clasificación, importes, identificación financiera y territorialidad del perceptor han sido revisados.</label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>{canReview && <Button size="sm" className="bg-fuchsia-700 hover:bg-fuchsia-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThirdPartyEditor({ modelCode, details, values, onChange, onPropertyChange, onAddProperty, onRemoveProperty, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Control de declarados del modelo {modelCode}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Taxea propone los importes desde facturas y pagos. Un asesor debe confirmar por tercero el efectivo, el criterio de caja y las operaciones inmobiliarias antes de habilitar el fichero.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const properties = payload.properties || [];
              return (
                <details key={detail.recordKey} className="rounded-xl border border-cyan-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {detail.operationKey} · {detail.name || detail.taxId} · {formatMoney(detail.total)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} control(es) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {THIRD_PARTY_SPECIAL_FIELDS.filter(([key]) => modelCode === '415' || key !== 'propertyRentAmount').map(([key, label]) => (
                      <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm" /></label>
                    ))}
                    <label className="text-xs font-medium text-slate-600">Ejercicio origen del metálico<input type="text" inputMode="numeric" maxLength={4} value={payload.cashYear ?? ''} onChange={event => onChange(detail.recordKey, 'cashYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">NIF representante (si procede)<input type="text" maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm uppercase" /></label>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[['cashAccounting', 'Operación IGIC/IVA de caja'], ['reverseCharge', 'Inversión del sujeto pasivo'], ['exemptArticle13', 'Exenta art. 13 Ley 20/1991']].filter(([key]) => modelCode === '415' || key !== 'exemptArticle13').map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload[key]} onChange={event => onChange(detail.recordKey, key, event.target.checked)} />{label}</label>)}
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Desglose</th>{['T1','T2','T3','T4'].map(q => <th key={q} className="px-3 py-2 text-right">{q}</th>)}</tr></thead><tbody>
                      {modelCode === '415' && <tr className="border-t"><td className="px-3 py-2 font-medium">Arrendamientos</td>{['T1','T2','T3','T4'].map(q => <td key={q} className="px-2 py-1"><input type="number" step="0.01" value={payload[`propertyRent${q}`] ?? ''} onChange={event => onChange(detail.recordKey, `propertyRent${q}`, event.target.value === '' ? '' : Number(event.target.value))} className="h-8 w-full rounded border border-slate-200 px-2 text-right" /></td>)}</tr>}
                      <tr className="border-t"><td className="px-3 py-2 font-medium">Transmisiones de inmuebles</td>{['T1','T2','T3','T4'].map(q => <td key={q} className="px-2 py-1"><input type="number" step="0.01" value={payload[`propertyTransfer${q}`] ?? ''} onChange={event => onChange(detail.recordKey, `propertyTransfer${q}`, event.target.value === '' ? '' : Number(event.target.value))} className="h-8 w-full rounded border border-slate-200 px-2 text-right" /></td>)}</tr>
                    </tbody></table>
                  </div>
                  {modelCode === '415' && detail.operationKey === 'B' && Number(payload.propertyRentAmount || 0) !== 0 && (
                    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">Anexo de locales arrendados</p><p className="mt-0.5 text-[11px] text-slate-500">Obligatorio para el arrendador. Se exporta como registro tipo 3 del importador ATC.</p></div><Button size="sm" variant="outline" onClick={() => onAddProperty(detail.recordKey)}><Plus className="mr-1 h-3.5 w-3.5" />Inmueble</Button></div>
                      <div className="mt-3 space-y-3">{properties.map((property, propertyIndex) => <div key={propertyIndex} className="rounded-lg border border-violet-200 bg-white p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Inmueble {propertyIndex + 1}</p><Button size="icon" variant="ghost" onClick={() => onRemoveProperty(detail.recordKey, propertyIndex)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div><div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-5"><label className="text-[11px] text-slate-600">Importe anual<input type="number" step="0.01" value={property.amount ?? ''} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, 'amount', event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-8 w-full rounded border px-2" /></label>{PROPERTY_FIELDS.map(([key, label]) => <label key={key} className="text-[11px] text-slate-600">{label}<input value={property[key] ?? ''} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, key, event.target.value)} className="mt-1 h-8 w-full rounded border px-2" /></label>)}</div><label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={!!property.cadastralUnavailable} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, 'cadastralUnavailable', event.target.checked)} />Inmueble sin referencia catastral</label></div>)}</div>
                    </div>
                  )}
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} /><span>Confirmo que he revisado efectivo, arrendamientos, transmisiones, criterio de caja, inversión del sujeto pasivo y exención aplicable.</span></label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar control</Button>{canReview && <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}


function StructuredAdjustmentPanel({ modelCode, values, onChange }) {
  const config = STRUCTURED_ADJUSTMENTS[modelCode];
  if (!config) return null;
  return <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><div className="min-w-0 flex-1">
      <h3 className="text-sm font-semibold text-slate-800">{config.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{config.help}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{config.fields.map(([key, label, type, options]) => <label key={key} className={type === 'checkbox' ? 'flex items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700' : 'text-xs font-medium text-slate-600'}>
        {type === 'checkbox' ? <><input type="checkbox" checked={values[key] === true} onChange={event => onChange(key, event.target.checked)} />{label}</> : <>{label}{type === 'select' ? <select value={values[key] ?? ''} onChange={event => onChange(key, event.target.value || undefined)} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : <input type="number" step="0.01" value={values[key] ?? ''} onChange={event => onChange(key, event.target.value === '' ? undefined : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300" />}</>}
      </label>)}</div>
    </div></div>
  </section>;
}

function DeclarableRecordsEditor({ modelCode, details = [], onSave, onDelete, saving, canReview }) {
  const schema = DECLARABLE_SCHEMAS[modelCode];
  const [draft, setDraft] = useState(/** @type {Record<string, any>} */ ({}));
  useEffect(() => setDraft({}), [modelCode]);
  if (!schema) return null;
  const startEdit = detail => setDraft({ ...Object.fromEntries(schema.map(([key]) => [key, detail[key] ?? detail.payload?.[key] ?? ''])), recordId: detail.recordId, recordKey: detail.recordKey });
  const reset = () => setDraft({});
  const submit = () => {
    const prefix = modelCode === '190' ? 'Manual190' : modelCode === '303' ? 'Simplified303' : `M${modelCode}`;
    const recordKey = draft.recordKey || `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    onSave({ recordKey, recordId: draft.recordId, payload: Object.fromEntries(schema.map(([key]) => [key, draft[key]]).filter(([, value]) => value !== '' && value !== undefined && value !== null)), reviewStatus: canReview ? 'validado_asesor' : 'pendiente_revision' });
    reset();
  };
  return <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-800">{modelCode === '303' ? 'Actividades y módulos del régimen simplificado' : `Registros individualizados del modelo ${modelCode}`}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{modelCode === '303' ? 'Informa hasta seis actividades por bloque con las magnitudes de la Orden anual. Taxea genera las páginas 2 y conserva la revisión del asesor.' : 'Añade o corrige solo datos respaldados por factura, contrato, certificado de residencia o documentación societaria. El asesor puede validarlos.'}</p></div>{draft.recordKey && <Button type="button" size="sm" variant="outline" onClick={reset}><X className="mr-1 h-3.5 w-3.5" />Cancelar edición</Button>}</div>
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{schema.map(([key, label, type, options]) => <label key={key} className={type === 'checkbox' ? 'flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-700' : 'text-xs font-medium text-slate-600'}>
      {type === 'checkbox' ? <><input type="checkbox" checked={draft[key] === true} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} />{label}</> : <>{label}{type === 'select' ? <select value={draft[key] ?? ''} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : <input type={type} step={type === 'number' ? '0.01' : undefined} value={draft[key] ?? ''} onChange={event => setDraft(current => ({ ...current, [key]: type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm" />}</>}
    </label>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" className="bg-violet-700 hover:bg-violet-800" onClick={submit} disabled={saving}><Plus className="mr-1 h-4 w-4" />{draft.recordKey ? 'Guardar cambios' : 'Añadir registro'}</Button><span className="text-[11px] text-slate-500">{canReview ? 'Se guardará como validado por asesor.' : 'Se guardará pendiente de revisión.'}</span></div>
    {!!details.length && <div className="mt-4 overflow-x-auto rounded-xl border border-violet-100 bg-white"><table className="w-full text-xs"><thead className="bg-violet-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Registro</th><th className="px-3 py-2 text-left">Contraparte / actividad</th><th className="px-3 py-2 text-right">Importe</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody>{details.map((detail, index) => <tr key={detail.recordKey || detail.sourceId || index} className="border-t border-violet-50"><td className="px-3 py-2 font-mono">{detail.recordKey || detail.operationKey || index + 1}</td><td className="px-3 py-2">{detail.recipientName || detail.operatorName || detail.relatedPartyName || detail.name || detail.iaeCode || detail.activityCode || 'Propuesto desde documentos'}</td><td className="px-3 py-2 text-right">{formatMoney(detail.amount ?? detail.accruedAmount ?? detail.withholdingBase ?? detail.base ?? detail.annualDerivedQuota ?? detail.quarterAdvance)}</td><td className="px-3 py-2"><div className="flex justify-end gap-1">{detail.recordId && <Button type="button" size="sm" variant="outline" onClick={() => startEdit(detail)}>Editar</Button>}{detail.recordId && <Button type="button" size="sm" variant="outline" className="text-red-700" onClick={() => onDelete(detail)} disabled={saving}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function StatusBadge({ model }) {
  if (model.exportMode === 'atc_guided_packet') return <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 border border-cyan-200">Traspaso controlado ATC</span>;
  if (model.handoffExport) return <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 border border-cyan-200">Traspaso controlado {model.authority}</span>;
  if (model.exportMode === 'atc_program_import') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">Importable en ATC</span>;
  if (model.officialExport) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">Diseño AEAT</span>;
  if (model.authority === 'ATC') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">Programa ATC</span>;
  return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">Borrador validable</span>;
}

const SOURCE_LABELS = {
  Invoice: 'Factura', InvoiceTaxLine: 'Línea fiscal', InvoicePayment: 'Pago', PayrollExtraction: 'Nómina', JournalEntryLine: 'Apunte contable', TaxFiling: 'Modelo presentado', TaxDeclarableRecord: 'Registro fiscal manual', ManualAdjustment: 'Ajuste manual',
};

function FieldTraceDrawer({ field, trace, loading, error, onClose, onPage }) {
  if (!field) return null;
  const sourceRows = trace?.sources || [];
  const totals = trace?.totals || {};
  const meaningfulTotals = [
    ['Base', totals.base], ['Cuota', totals.tax], ['Retención', totals.withholding], ['Importe', totals.amount], ['Debe', totals.debit], ['Haber', totals.credit],
  ].filter(([, value]) => Math.abs(Number(value || 0)) > 0.009);
  return <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Trazabilidad de la casilla ${field.code}`}>
    <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="Cerrar trazabilidad" />
    <aside className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Trazabilidad de cálculo</p><h3 className="mt-1 text-lg font-bold">Casilla {field.code} · {field.label}</h3><p className="mt-1 text-sm text-slate-300">{field.section || 'Detalle del modelo'} · {formatMoney(field.value)}</p></div>
          <Button type="button" size="icon" variant="ghost" className="shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {(trace?.field?.formula || field.formula || trace?.field?.dependsOn?.length || field.dependsOn?.length) && <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Cómo se calcula</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{trace?.field?.formula || field.formula || 'Resultado derivado de otras casillas.'}</p>
          {!!(trace?.field?.dependsOn || field.dependsOn)?.length && <p className="mt-2 text-xs text-slate-600">Depende de: {(trace?.field?.dependsOn || field.dependsOn).map(code => `casilla ${code}`).join(', ')}.</p>}
        </section>}

        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
          : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{apiErrorMessage(error, 'No se pudo cargar la trazabilidad.')}</div>
            : <>
              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Fuentes directas</p><p className="mt-1 text-xl font-bold text-slate-900">{trace?.sourceCount ?? field.sourceIds?.length ?? 0}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Resueltas</p><p className="mt-1 text-xl font-bold text-emerald-700">{trace?.total || 0}</p></div>
                <div className={`rounded-xl border p-3 ${trace?.unresolvedCount ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}><p className="text-xs text-slate-500">No localizadas</p><p className={`mt-1 text-xl font-bold ${trace?.unresolvedCount ? 'text-amber-700' : 'text-slate-900'}`}>{trace?.unresolvedCount || 0}</p></div>
              </section>

              {!!meaningfulTotals.length && <section className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totales de las fuentes</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{meaningfulTotals.map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><p className="text-[11px] text-slate-400">{label}</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{formatMoney(value)}</p></div>)}</div></section>}

              {trace?.unresolvedCount > 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{trace.unresolvedCount} fuente(s) del borrador ya no están disponibles. El importe congelado no cambia; conviene revisar esta versión antes de presentar.</span></div>}

              <section className="space-y-3">
                <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-800">Documentos incluidos</h4>{trace?.frozen && <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">Foto guardada</span>}</div>
                {!sourceRows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><FileSearch className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">Sin documentos directos</p><p className="mt-1 text-xs leading-5 text-slate-500">La casilla es cero, manual o se obtiene de otras casillas según la fórmula mostrada.</p></div>
                  : sourceRows.map(source => <article key={source.sourceId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{SOURCE_LABELS[source.type] || source.type}</span>{source.invoiceType && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">{source.invoiceType}</span>}</div><h5 className="mt-2 font-semibold text-slate-900">{source.title}</h5><p className="mt-0.5 text-xs text-slate-500">{[source.date, source.subtitle, source.taxId].filter(Boolean).join(' · ')}</p>{source.concept && <p className="mt-2 text-xs leading-5 text-slate-600">{source.concept}</p>}</div>
                      {source.invoiceId && <a href={`/facturas?factura=${encodeURIComponent(source.invoiceId)}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900">Abrir factura<ExternalLink className="h-3.5 w-3.5" /></a>}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
                      {source.base != null && <div><dt className="text-slate-400">Base</dt><dd className="font-medium text-slate-800">{formatMoney(source.base)}</dd></div>}
                      {source.tax != null && <div><dt className="text-slate-400">Cuota</dt><dd className="font-medium text-slate-800">{formatMoney(source.tax)}</dd></div>}
                      {source.withholding != null && <div><dt className="text-slate-400">Retención</dt><dd className="font-medium text-slate-800">{formatMoney(source.withholding)}</dd></div>}
                      {source.total != null && <div><dt className="text-slate-400">Total factura</dt><dd className="font-medium text-slate-800">{formatMoney(source.total)}</dd></div>}
                      {source.amount != null && <div><dt className="text-slate-400">Importe</dt><dd className="font-medium text-slate-800">{formatMoney(source.amount)}</dd></div>}
                      {source.accountCode && <div><dt className="text-slate-400">Cuenta</dt><dd className="font-medium text-slate-800">{source.accountCode}</dd></div>}
                      {source.debit != null && <div><dt className="text-slate-400">Debe</dt><dd className="font-medium text-slate-800">{formatMoney(source.debit)}</dd></div>}
                      {source.credit != null && <div><dt className="text-slate-400">Haber</dt><dd className="font-medium text-slate-800">{formatMoney(source.credit)}</dd></div>}
                    </dl>
                  </article>)}
              </section>
            </>}
      </div>
      {trace?.totalPages > 1 && <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-600"><span>Página {trace.page} de {trace.totalPages}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onPage(trace.page - 1)} disabled={trace.page <= 1}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" size="sm" variant="outline" onClick={() => onPage(trace.page + 1)} disabled={trace.page >= trace.totalPages}><ChevronRight className="h-4 w-4" /></Button></div></footer>}
    </aside>
  </div>;
}

export default function TaxModelWorkbench({ initialSelection }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [modelCode, setModelCode] = useState(initialSelection?.modelCode || '303');
  const [year, setYear] = useState(Number(initialSelection?.year) || new Date().getFullYear());
  const [period, setPeriod] = useState(initialSelection?.period || '1T');
  const [result, setResult] = useState(/** @type {any} */ (null));
  const [actionError, setActionError] = useState('');
  const [lastExportInfo, setLastExportInfo] = useState(/** @type {any} */ (null));
  const [lastSaveInfo, setLastSaveInfo] = useState('');
  const [adjustments, setAdjustments] = useState(/** @type {Record<string, any>} */ ({}));
  const [annualRecordEdits, setAnnualRecordEdits] = useState(/** @type {Record<string, any>} */ ({}));
  const [annual190RecordEdits, setAnnual190RecordEdits] = useState(/** @type {Record<string, any>} */ ({}));
  const [annual193RecordEdits, setAnnual193RecordEdits] = useState(/** @type {Record<string, any>} */ ({}));
  const [thirdPartyRecordEdits, setThirdPartyRecordEdits] = useState(/** @type {Record<string, any>} */ ({}));
  const [periodCloseInfo, setPeriodCloseInfo] = useState(/** @type {any} */ (null));
  const [confirmClose, setConfirmClose] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [selectedField, setSelectedField] = useState(/** @type {any} */ (null));
  const [tracePage, setTracePage] = useState(1);

  const { data: catalogResponse, isLoading: loadingCatalog } = useQuery({
    queryKey: ['tax-model-engine-catalog'],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'catalog' })).data,
  });

  const { data: fiscalContext } = useQuery({
    queryKey: ['fiscal-profile-tax-models', companyId],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'context', companyId })).data,
    enabled: !!companyId,
  });

  const profile = fiscalContext?.profile;
  const models = catalogResponse?.models || [];
  const definition = models.find(item => item.code === modelCode) || models[0];
  const periodOptions = useMemo(() => definition ? periodsFor(definition, profile) : PERIODS.trimestral, [definition, profile]);

  const fieldTrace = useQuery({
    queryKey: ['tax-model-field-trace', companyId, result?.draft?.id || result?.source?.hash, modelCode, year, period, selectedField?.code, selectedField?.label, selectedField?.section, tracePage],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', {
      action: 'field_trace', companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period,
      draftId: result?.draft?.id || undefined, fieldCode: selectedField.code, fieldLabel: selectedField.label, fieldSection: selectedField.section, page: tracePage, pageSize: 25,
      adjustments: ADJUSTMENT_MODELS.includes(modelCode) ? adjustments : {},
    })).data,
    enabled: !!companyId && !!result && !!selectedField,
  });

  useEffect(() => {
    if (definition && !periodOptions.includes(period)) setPeriod(periodOptions[0]);
    setResult(null);
    setActionError('');
    setLastExportInfo(null);
    setLastSaveInfo('');
    setAdjustments({});
    setPeriodCloseInfo(null);
    setConfirmClose(false);
    setReopenReason('');
    setSelectedField(null);
    setTracePage(1);
  }, [modelCode, year, definition?.frequency, periodOptions]);

  useEffect(() => {
    if (modelCode !== '180' || !result?.calculation?.details) return;
    setAnnualRecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }])));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (modelCode !== '190' || !result?.calculation?.details) return;
    setAnnual190RecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }])));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (modelCode !== '193' || !result?.calculation?.details) return;
    const declaration = result.calculation.declaration;
    setAnnual193RecordEdits(Object.fromEntries([
      ...(declaration ? [[declaration.recordKey, { ...(declaration.manual || {}) }]] : []),
      ...result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }]),
    ]));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (!['347', '415'].includes(modelCode) || !result?.calculation?.details) return;
    setThirdPartyRecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}), properties: (detail.manual?.properties || []).map(property => ({ ...property })) }])));
  }, [modelCode, result?.source?.hash]);

  const invoke = useMutation({
    mutationFn: async (/** @type {any} */ variables) => {
      const { action, ...extra } = variables;
      const response = await base44.functions.invoke('taxModelOperations', {
        action,
        companyId,
        modeloCodigo: modelCode,
        ejercicio: year,
        periodo: period,
        adjustments: ADJUSTMENT_MODELS.includes(modelCode) ? adjustments : {},
        ...extra,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setActionError('');
      if (['calculate', 'save_draft', 'open_draft'].includes(variables.action)) {
        setResult(data);
        setSelectedField(null);
        setTracePage(1);
      }
      if (variables.action === 'save_draft') setLastSaveInfo(data.alreadySaved ? 'Este cálculo ya estaba guardado: no se creó una versión duplicada.' : `Versión ${data.draft?.version || ''} guardada con su huella y trazabilidad.`);
      if (variables.action === 'open_draft') {
        setAdjustments(data.adjustments || {});
        setLastSaveInfo(`Borrador v${data.draft?.version || ''} abierto como fotografía guardada. Sus importes no se han recalculado.`);
      }
      if (['export', 'export_review', 'export_handoff'].includes(variables.action)) {
        downloadBase64(data.file);
        setLastExportInfo({ filename: data.file?.filename, nextStep: data.file?.nextStep, recommendationCount: data.validation?.recommendations?.length || 0, isReview: variables.action === 'export_review', isHandoff: variables.action === 'export_handoff' });
      }
    },
    onError: error => {
      const payload = apiErrorPayload(error);
      const messages = payload?.blockers?.length ? payload.blockers.join(' ') : payload?.error || error?.message || 'No se pudo completar la operación.';
      setActionError(messages);
    },
  });

  useEffect(() => {
    if (!companyId || !definition || definition.code !== modelCode || !initialSelection?.draftId || modelCode !== initialSelection.modelCode || Number(year) !== Number(initialSelection.year) || period !== initialSelection.period) return;
    invoke.mutate({ action: 'open_draft', draftId: initialSelection.draftId });
  }, [companyId, definition?.code, initialSelection?.draftId, initialSelection?.requestId]);

  const saveDeclarable = useMutation({
    mutationFn: async (/** @type {any} */ variables) => {
      const { detail, reviewStatus, targetModel = modelCode } = variables;
      return (await base44.functions.invoke('taxModelOperations', {
      action: 'upsert_declarable', companyId, modeloCodigo: targetModel, ejercicio: year, periodo: 'Anual',
      recordKey: detail.recordKey,
      sourceType: targetModel === '180' ? 'Invoice' : ['190', '193'].includes(targetModel) ? detail.sourceType : 'ThirdPartyAggregate',
      sourceId: targetModel === '180' ? detail.id : ['190', '193'].includes(targetModel) ? (detail.sourceIds || []).join('|') : (detail.invoices || []).join('|'),
      payload: targetModel === '180' ? (annualRecordEdits[detail.recordKey] || detail.manual || {}) : targetModel === '190' ? (annual190RecordEdits[detail.recordKey] || detail.manual || {}) : targetModel === '193' ? (annual193RecordEdits[detail.recordKey] || detail.manual || {}) : (thirdPartyRecordEdits[detail.recordKey] || detail.manual || {}), reviewStatus,
      })).data;
    },
    onSuccess: () => { setActionError(''); invoke.mutate({ action: 'save_draft' }); },
    onError: error => setActionError(apiErrorMessage(error, 'No se pudo guardar la ficha anual.')),
  });
  const structuredRecord = useMutation({
    mutationFn: async (/** @type {any} */ variables) => {
      const { action = 'upsert_declarable', ...payload } = variables;
      return (await base44.functions.invoke('taxModelOperations', {
        action, companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period, ...payload,
      })).data;
    },
    onSuccess: () => { setActionError(''); invoke.mutate({ action: 'save_draft' }); },
    onError: error => setActionError(apiErrorMessage(error, 'No se pudo guardar el registro declarable.')),
  });
  const periodClose = useMutation({
    mutationFn: async (/** @type {any} */ variables) => {
      const { action, ...extra } = variables;
      return (await base44.functions.invoke('taxModelOperations', { action, companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period, ...extra })).data;
    },
    onSuccess: data => { setActionError(''); setPeriodCloseInfo(data); setConfirmClose(false); if (data.period?.closureStatus === 'reopened') setReopenReason(''); },
    onError: error => setActionError(apiErrorMessage(error, 'No se pudo completar el cierre fiscal.')),
  });
  const canReviewAnnual = ['admin', 'super_admin', 'advisor', 'asesor'].includes(String(user?.role || '').toLowerCase());
  const updateAnnualRecord = (recordKey, key, value) => setAnnualRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateAnnual190Record = (recordKey, key, value) => setAnnual190RecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateAnnual193Record = (recordKey, key, value) => setAnnual193RecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateThirdPartyRecord = (recordKey, key, value) => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateThirdPartyProperty = (recordKey, propertyIndex, key, value) => setThirdPartyRecordEdits(current => {
    const record = { ...(current[recordKey] || {}) };
    const properties = (record.properties || []).map(property => ({ ...property }));
    properties[propertyIndex] = { ...(properties[propertyIndex] || {}), [key]: value };
    return { ...current, [recordKey]: { ...record, properties } };
  });
  const addThirdPartyProperty = recordKey => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), properties: [...(current[recordKey]?.properties || []), { amount: '', cadastralUnavailable: false, numberingType: 'NUM' }] } }));
  const removeThirdPartyProperty = (recordKey, propertyIndex) => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), properties: (current[recordKey]?.properties || []).filter((_, index) => index !== propertyIndex) } }));
  const updateStructuredAdjustment = (key, value) => { setAdjustments(current => ({ ...current, [key]: value })); setResult(null); };

  if (!companyId) return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa para preparar sus modelos.</div>;

  return (
    <div className="grid min-h-[690px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[260px_minmax(0,1fr)]">
      <FieldTraceDrawer field={selectedField} trace={fieldTrace.data} loading={fieldTrace.isLoading || fieldTrace.isFetching} error={fieldTrace.error} onClose={() => setSelectedField(null)} onPage={setTracePage} />
      <aside className="border-b border-slate-200 bg-slate-950 lg:border-b-0 lg:border-r">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Motor tributario</p>
          <p className="mt-2 text-sm text-slate-300">Modelos calculados desde contabilidad y documentos reales.</p>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-2">
          {loadingCatalog ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div> : models.map(model => (
            <button
              key={model.code}
              onClick={() => setModelCode(model.code)}
              className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${model.code === modelCode ? 'bg-cyan-400/15 ring-1 ring-cyan-300/40' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${model.code === modelCode ? 'text-cyan-200' : 'text-white'}`}>{model.code}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{model.authority}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{model.name}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <div className="border-b border-slate-200 bg-white/90 p-5 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Modelo {definition?.code}</h2>
                {definition && <StatusBadge model={definition} />}
              </div>
              <p className="mt-1 text-sm text-slate-500">{definition?.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {[year - 2, year - 1, year, year + 1].filter((value, index, array) => array.indexOf(value) === index).map(value => <option key={value}>{value}</option>)}
              </select>
              <select value={period} onChange={event => { setPeriod(event.target.value); setResult(null); setAdjustments({}); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {periodOptions.map(value => <option key={value}>{value}</option>)}
              </select>
              <Button onClick={() => invoke.mutate({ action: 'save_draft' })} disabled={invoke.isPending} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                {invoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Calcular y guardar borrador
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {definition?.designWarning && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-semibold">Recomendación sobre el diseño</p><p className="mt-0.5 text-xs leading-5">{definition.designWarning}</p></div>
            </div>
          )}

          {actionError && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{actionError}</span></div>
          )}
          {lastExportInfo && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{lastExportInfo.isReview ? 'Borrador descargado' : lastExportInfo.isHandoff ? 'Traspaso ATC descargado' : 'Fichero generado'}: {lastExportInfo.filename}</p>{lastExportInfo.recommendationCount > 0 && !lastExportInfo.isReview && <p className="mt-1 text-xs leading-5">El fichero se ha generado con {lastExportInfo.recommendationCount} recomendación(es) pendientes. Revísalas y utiliza siempre la validación final de AEAT/ATC antes de presentar.</p>}{lastExportInfo.nextStep && <p className="mt-1 text-xs leading-5">{lastExportInfo.nextStep}</p>}</div></div>
          )}
          {lastSaveInfo && <div className="flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800"><Save className="mt-0.5 h-4 w-4 shrink-0" /><span>{lastSaveInfo}</span></div>}

          <FiledReturnImport key={`${companyId}-${modelCode}-${year}-${period}`} companyId={companyId} modelCode={modelCode} year={year} period={period} onImported={() => invoke.mutate({ action: 'save_draft' })} />

          <StructuredAdjustmentPanel modelCode={modelCode} values={adjustments} onChange={updateStructuredAdjustment} />

          {modelCode === '130' && (
            <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Ajustes fiscales revisables del modelo 130</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Las casillas 01 y 02 son acumuladas desde el 1 de enero y parten de los asientos, no solo de las bases de las facturas del trimestre. La casilla 06 reconoce cada retención al cobrarse, también en cobros parciales; la 18 solo corresponde a una complementaria del mismo ejercicio y período. Confirma la conciliación contable-fiscal, los pagos anteriores y cualquier beneficio territorial antes de aprobar el borrador.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {MODEL_130_ADJUSTMENTS.map(([key, label]) => (
                      <label key={key} className="text-xs font-medium text-slate-600">
                        {label}
                        <input
                          type="number"
                          step="0.01"
                          value={adjustments[key] ?? ''}
                          onChange={event => { setAdjustments(current => ({ ...current, [key]: event.target.value === '' ? undefined : Number(event.target.value) })); setResult(null); }}
                          className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300"
                        />
                      </label>
                    ))}
                  </div>
                  {profile?.irpfEstimation === 'directa_simplificada' && (
                    <div className="mt-3 grid gap-3 rounded-xl border border-cyan-200 bg-white/80 p-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input className="mt-1" type="checkbox" checked={adjustments.applyDifficultJustificationExpenses === true} onChange={event => { setAdjustments(current => ({ ...current, applyDifficultJustificationExpenses: event.target.checked })); setResult(null); }} /><span><strong>Aplicar provisiones y gastos de difícil justificación.</strong> Confirma que procede y que no se aplica la reducción incompatible para autónomos económicamente dependientes o con único cliente no vinculado.</span></label>
                      <label className="text-xs font-medium text-slate-600">Porcentaje aplicable<select value={adjustments.difficultJustificationRate || 5} onChange={event => { setAdjustments(current => ({ ...current, difficultJustificationRate: Number(event.target.value) })); setResult(null); }} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800"><option value={5}>5% general</option><option value={10}>10% Ceuta 2026</option></select></label>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {INDIRECT_TAX_MODELS.includes(modelCode) && (
            <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Cartera de cuotas y destino del resultado</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Taxea toma el saldo del período presentado anterior. Si no existe histórico, confirma el saldo manualmente, incluso con cero. Los datos importados prevalecen salvo ajuste revisado.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">Saldo anterior a compensar<input type="number" min="0" step="0.01" value={adjustments.previousCompensationBalance ?? ''} onChange={event => { setAdjustments(current => ({ ...current, previousCompensationBalance: event.target.value === '' ? undefined : Number(event.target.value) })); setResult(null); }} placeholder="Automático desde el modelo importado" className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300" /></label>
                    <label className="text-xs font-medium text-slate-600">Si el resultado es negativo<select value={adjustments.resultDisposition || ''} onChange={event => { setAdjustments(current => ({ ...current, resultDisposition: event.target.value || undefined })); setResult(null); }} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800"><option value="">Seleccionar al calcular</option><option value="a_compensar">Dejar a compensar</option><option value="a_devolver">Solicitar devolución (último período)</option></select></label>
                    {modelCode === '303' && period === '4T' && <label className="text-xs font-medium text-slate-600">Ingresos a cuenta previos del simplificado · casilla 49<input type="number" min="0" step="0.01" value={adjustments.simplifiedPreviousQuarterAdvances ?? ''} onChange={event => { setAdjustments(current => ({ ...current, simplifiedPreviousQuarterAdvances: event.target.value === '' ? undefined : Number(event.target.value) })); setResult(null); }} placeholder="Automático desde 1T, 2T y 3T presentados" className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300" /></label>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {modelCode === '180' && result && <Annual180Editor details={result.calculation?.details} values={annualRecordEdits} onChange={updateAnnualRecord} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '180' })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {modelCode === '190' && result && <Annual190Editor details={(result.calculation?.details || []).filter(detail => !detail.manualEntry)} values={annual190RecordEdits} onChange={updateAnnual190Record} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '190' })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {modelCode === '193' && result && <Annual193Editor details={result.calculation?.details} declaration={result.calculation?.declaration} expenseDetails={result.calculation?.expenseDetails || []} values={annual193RecordEdits} onChange={updateAnnual193Record} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '193' })} onSaveExpense={payload => structuredRecord.mutate(payload)} onDeleteExpense={detail => structuredRecord.mutate({ action: 'delete_declarable', recordId: detail.recordId })} saving={saveDeclarable.isPending || structuredRecord.isPending} canReview={canReviewAnnual} />}
          {['347', '415'].includes(modelCode) && result && <ThirdPartyEditor modelCode={modelCode} details={result.calculation?.details} values={thirdPartyRecordEdits} onChange={updateThirdPartyRecord} onPropertyChange={updateThirdPartyProperty} onAddProperty={addThirdPartyProperty} onRemoveProperty={removeThirdPartyProperty} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: modelCode })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {DECLARABLE_SCHEMAS[modelCode] && <DeclarableRecordsEditor modelCode={modelCode} details={modelCode === '190' ? (result?.calculation?.manualRecords || []) : modelCode === '303' ? (result?.calculation?.operations?.simplified?.details || []) : (result?.calculation?.details || [])} onSave={payload => structuredRecord.mutate(payload)} onDelete={detail => structuredRecord.mutate({ action: 'delete_declarable', recordId: detail.recordId })} saving={structuredRecord.isPending || invoke.isPending} canReview={canReviewAnnual} />}

          {!result ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><RefreshCw className="h-5 w-5 text-cyan-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Fuente única</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cruza líneas fiscales, facturas, nóminas y asientos confirmados sin alterar ningún registro.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Revisión previa</h3><p className="mt-1 text-xs leading-5 text-slate-500">Las incidencias se presentan como recomendaciones. Puedes exportar y completar o validar el fichero en la Administración sin que Taxea invente cifras.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><FileCheck2 className="h-5 w-5 text-violet-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Trazabilidad</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cada casilla conserva los identificadores de sus facturas, nóminas o líneas contables de origen.</p></div>
            </div>
          ) : (
            <>
              {result.draft && <div className="flex flex-col gap-2 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Save className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><div><p className="text-sm font-semibold text-slate-800">Borrador v{result.draft.version} guardado</p><p className="mt-0.5 text-xs text-slate-500">{result.frozen ? 'Estás trabajando sobre la fotografía guardada; no se ha recalculado.' : result.alreadySaved ? 'Coincide con una versión existente y no se ha duplicado.' : 'La versión conserva casillas, fuentes, ajustes y recomendaciones.'}</p></div></div><span className="font-mono text-[11px] text-slate-400">{(result.draft.snapshotHash || result.source?.hash || '').slice(0, 16)}…</span></div>}
              {result.draft && <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="text-sm font-semibold text-slate-800">Cierre fiscal del período</h3><p className="mt-1 text-xs leading-5 text-slate-500">Fija una versión concreta para revisión y evita que cambios posteriores alteren el cierre. Cerrar no equivale a presentar.</p></div><Button type="button" size="sm" variant="outline" onClick={() => periodClose.mutate({ action: 'preview_period_close' })} disabled={periodClose.isPending}>{periodClose.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileSearch className="mr-1 h-3.5 w-3.5" />}Revisar cierre</Button></div>
                {periodCloseInfo && <div className="mt-3 space-y-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{(periodCloseInfo.checks || []).map(check => <div key={check.code} className={`rounded-lg border p-3 text-xs ${check.status === 'ok' ? 'border-emerald-200 bg-emerald-50' : check.status === 'required' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><p className="font-semibold text-slate-800">{check.label}</p><p className="mt-1 leading-4 text-slate-600">{check.detail}</p></div>)}</div>
                  {(periodCloseInfo.period?.closureStatus === 'closed' || periodCloseInfo.periodRow?.closureStatus === 'closed') ? <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs text-slate-700">Motivo de reapertura<input value={reopenReason} onChange={event => setReopenReason(event.target.value)} className="mt-1 h-9 w-full rounded border border-amber-200 bg-white px-3" placeholder="Ej.: factura recibida incorporada después del cierre" /></label><Button type="button" size="sm" variant="outline" onClick={() => periodClose.mutate({ action: 'reopen_period', confirmReopen: true, reason: reopenReason })} disabled={periodClose.isPending || reopenReason.trim().length < 8}>Reabrir con trazabilidad</Button></div> : <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={confirmClose} onChange={event => setConfirmClose(event.target.checked)} />Confirmo cerrar sobre el borrador v{periodCloseInfo.latestDraft?.version || result.draft.version}</label><Button type="button" size="sm" onClick={() => periodClose.mutate({ action: 'close_period', confirmClose: true })} disabled={!confirmClose || !periodCloseInfo.canClose || periodClose.isPending}>Cerrar período</Button></div>}
                </div>}
              </section>}
              <HistoryAndCarryforwardPanel result={result} modelCode={modelCode} />

              {result.period?.policy && <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4"><div className="flex items-start gap-3"><FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Regla temporal aplicada</p><h3 className="mt-1 text-sm font-semibold text-slate-900">{result.period.policy.label}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{result.period.policy.rule}</p>{result.period.policy.basis === 'acumulado_ejercicio' && <p className="mt-2 text-xs font-medium text-indigo-800">El selector identifica el cierre del cálculo. No limita las casillas 01 y 02 al trimestre aislado.</p>}</div></div></section>}

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Resultado</p><p className={`mt-2 text-2xl font-bold ${Number(result.calculation?.result) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{definition?.kind === 'informative' ? 'Informativo' : formatMoney(result.calculation?.result)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Documentos trazados</p><p className="mt-2 text-2xl font-bold text-slate-900">{result.source?.count || 0}</p><p className="mt-1 text-[11px] text-slate-400">Hash {result.source?.hash?.slice(0, 12)}…</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Recomendaciones</p><p className={`mt-2 text-2xl font-bold ${result.validation?.recommendations?.length ? 'text-amber-600' : 'text-emerald-600'}`}>{result.validation?.recommendations?.length || 0}</p><p className="mt-1 text-[11px] text-slate-400">Nunca bloquean la descarga</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Diseño</p><p className="mt-2 text-sm font-bold text-slate-900">{result.definition?.design}</p><p className="mt-1 text-[11px] text-slate-400">Motor {result.engineVersion}</p></div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.7fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">Casillas calculadas</h3><p className="mt-0.5 text-xs text-slate-500">Pulsa cualquier casilla para ver su fórmula y los documentos exactos incluidos.</p></div>
                  <div className="max-h-[390px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">Casilla</th><th className="px-4 py-2 text-left">Concepto</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Fuentes</th></tr></thead>
                      <tbody>{(result.calculation?.fields || []).map(field => <tr key={`${field.code}-${field.label}`} role="button" tabIndex={0} onClick={() => { setSelectedField(field); setTracePage(1); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedField(field); setTracePage(1); } }} className="cursor-pointer border-t border-slate-100 transition hover:bg-cyan-50/70 focus:bg-cyan-50 focus:outline-none"><td className="px-4 py-2 font-mono text-xs font-semibold text-cyan-700">{field.code}</td><td className="px-4 py-2 text-slate-700"><p>{field.label}</p>{field.section && <p className="text-[11px] text-slate-400">{field.section}</p>}</td><td className="px-4 py-2 text-right font-medium text-slate-900">{field.code === 'DECLARADOS' || /Perceptores|Número/.test(field.label) ? Number(field.value).toLocaleString('es-ES') : formatMoney(field.value)}</td><td className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700">{field.sourceIds?.length || 0}<ChevronRight className="h-3.5 w-3.5" /></span></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 ${result.validation?.recommendations?.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${result.validation?.recommendations?.length ? 'text-amber-600' : 'text-emerald-600'}`} /><h3 className="text-sm font-semibold text-slate-800">Recomendaciones antes de presentar</h3></div>
                    {!!result.validation?.recommendations?.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800">{result.validation.recommendations.map((message, index) => <li key={index}>• {message}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">No se han detectado recomendaciones con los datos disponibles.</p>}
                    <p className="mt-3 border-t border-current/10 pt-3 text-[11px] leading-5 text-slate-600">Estas recomendaciones no impiden exportar. La validación definitiva corresponde al programa o sede oficial.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Cobertura del cálculo</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(result.source?.stats || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-2"><dt className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 text-lg font-bold text-slate-800">{value}</dd></div>)}</dl>
                  </div>
                </div>
              </section>

              {!!result.calculation?.details?.length && (
                <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Ver detalle de declarados y documentos ({result.calculation.details.length})</summary><div className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300"><pre className="whitespace-pre-wrap">{JSON.stringify(result.calculation.details, null, 2)}</pre></div></details>
              )}

              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'save_draft' })} disabled={invoke.isPending}><Save className="h-4 w-4" />Guardar nueva versión si cambió</Button>
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'export_review', draftId: result.draft?.id })} disabled={invoke.isPending}><FileJson className="h-4 w-4" />Descargar revisión</Button>
                {definition?.handoffExport && <Button variant="outline" className="gap-2 border-cyan-300 text-cyan-800 hover:bg-cyan-50" onClick={() => invoke.mutate({ action: 'export_handoff', draftId: result.draft?.id })} disabled={invoke.isPending}><Download className="h-4 w-4" />Descargar traspaso {definition.authority}</Button>}
                {definition?.officialExport && <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={() => invoke.mutate({ action: 'export', draftId: result.draft?.id })} disabled={invoke.isPending}><Download className="h-4 w-4" />{definition?.exportMode === 'atc_program_import' ? 'Exportar para programa ATC' : 'Exportar para AEAT'}</Button>}
                {!definition?.officialExport && <p className="flex items-center text-xs text-slate-500">El traspaso es un paquete de trabajo, no un fichero presentable. Completa y valida la declaración en la sede o programa oficial de {definition?.authority}.</p>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}


