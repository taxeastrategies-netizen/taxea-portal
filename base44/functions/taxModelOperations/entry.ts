import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const ENGINE_VERSION = 'taxea-modelos-2026.09.12-v15';
const TARGET_MODELS = ['111', '115', '123', '130', '131', '180', '190', '193', '200', '202', '216', '232', '296', '303', '347', '349', '390', '415', '417', '420', '421', '425'];

const DEFINITIONS: Record<string, any> = {
  '111': { name: 'Retenciones de trabajo y actividades económicas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3127/2009 v1.8', designYear: '2019+', officialExport: true },
  '115': { name: 'Retenciones por arrendamientos urbanos', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v1.3', designYear: '2019+', officialExport: true },
  '123': { name: 'Retenciones de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v2.0', designYear: '2024+', officialExport: true },
  '130': { name: 'Pago fraccionado IRPF en estimación directa', authority: 'AEAT', frequency: 'trimestral', kind: 'income_tax', design: 'HAP/258/2015 v1.2', designYear: '2019+', officialExport: true },
  '131': { name: 'Pago fraccionado IRPF en estimación objetiva', authority: 'AEAT', frequency: 'trimestral', kind: 'income_tax', design: 'Diseño de registro AEAT 2026', designYear: '2026', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', designWarning: 'El rendimiento por módulos exige los signos, índices y datos-base de la Orden anual. Taxea prepara un borrador estructurado y trazable; el fichero presentable se obtendrá tras validarlo en Predeclaración/AEAT.' },
  '180': { name: 'Resumen anual de arrendamientos urbanos', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAP/1732/2014 - diseño vigente ejercicio 2023+', designYear: '2023+', officialExport: true, exportMode: 'aeat_record_design' },
  '190': { name: 'Resumen anual de trabajo y actividades económicas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025', officialExport: true, exportMode: 'aeat_record_design', designWarning: 'La salida automatiza nóminas clave A y profesionales clave G. Revisa manualmente cualquier otra clave antes de importar el fichero.' },
  '193': { name: 'Resumen anual de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1430/2025', designYear: '2025', officialExport: true, exportMode: 'aeat_record_design', designWarning: 'La salida admite registros de perceptor sin relación de gastos del art. 26.1.a LIRPF. Si ese anexo resulta aplicable, complétalo en la sede tras importar y validar el fichero.' },
  '200': { name: 'Impuesto sobre Sociedades', authority: 'AEAT', frequency: 'anual', kind: 'corporate_tax', design: 'Sociedades WEB y diseño de registro AEAT 2025', designYear: '2025', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', designWarning: 'El modelo 200 no se obtiene solo de facturas: requiere cierre contable, balances, ajustes extracontables, bases negativas, deducciones y régimen societario. Taxea prepara la conciliación contable-fiscal; la presentación debe completarse y validarse en Sociedades WEB.' },
  '202': { name: 'Pago fraccionado del Impuesto sobre Sociedades', authority: 'AEAT', frequency: 'abril/octubre/diciembre', kind: 'corporate_tax_payment', design: 'Diseño de registro AEAT 2026', designYear: '2026', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', periods: ['1P', '2P', '3P'], designWarning: 'La base depende de la modalidad del artículo 40.2 o 40.3 LIS y de magnitudes societarias confirmadas. Taxea no infiere la modalidad únicamente por las facturas.' },
  '216': { name: 'Retenciones e ingresos a cuenta de no residentes', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'non_resident_withholding', design: 'Modelo 216 e instrucciones AEAT vigentes', designYear: '2026', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', designWarning: 'Incluye rentas IRNR satisfechas a no residentes, también determinadas rentas exentas o exceptuadas de retención. Cada perceptor debe documentarse con país, clave de renta y motivo de exención o convenio.' },
  '232': { name: 'Operaciones vinculadas y territorios no cooperativos', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'Formulario modelo 232 AEAT', designYear: '2025+', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', designWarning: 'La obligación y los umbrales dependen de la vinculación, el tipo y conjunto de operaciones, patent box y territorios no cooperativos. Solo se incorporan registros expresamente clasificados y revisados.' },
  '296': { name: 'Resumen anual de rentas de no residentes', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'Diseño de registro modelo 296 AEAT 2024+', designYear: '2024+', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', designWarning: 'El resumen anual necesita identificación y clave completa de cada perceptor, país, naturaleza, exención/convenio y retención. Taxea concilia los registros del 216, pero no crea perceptores por suposición.' },
  '303': { name: 'Autoliquidación IVA', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'indirect_tax', design: 'DR303e26 v1.01', designYear: '2026+', officialExport: true },
  '347': { name: 'Operaciones con terceras personas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025+', officialExport: true, exportMode: 'aeat_record_design' },
  '349': { name: 'Operaciones intracomunitarias', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'informative', design: 'Diseño de registro modelo 349 AEAT vigente', designYear: '2026', officialExport: false, handoffExport: true, exportMode: 'aeat_guided_packet', periodOptions: ['1T','2T','3T','4T','01','02','03','04','05','06','07','08','09','10','11','12'], designWarning: 'Taxea propone operaciones desde líneas fiscales intracomunitarias y permite completar rectificaciones. El NIF-IVA/VIES, la clave de operación y la periodicidad deben confirmarse antes de presentar.' },
  '390': { name: 'Resumen anual IVA', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'DR390e2025 v1.02', designYear: '2025', officialExport: true, exportMode: 'aeat_record_design', designWarning: 'La salida usa el último diseño oficial publicado (ejercicio 2025). Las diferencias de clasificación anual se muestran como recomendaciones revisables.' },
  '415': { name: 'Operaciones económicas con terceras personas', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'BOC 41/2015 + Programa de ayuda ATC 2025', designYear: '2025', officialExport: true, exportMode: 'atc_program_import', designWarning: 'Taxea genera el soporte oficial de importación de declarados. El programa ATC debe importarlo, validarlo y generar el .dec final.' },
  '417': { name: 'SII-IGIC · autoliquidación periódica', authority: 'ATC', frequency: 'mensual', kind: 'indirect_tax', design: 'Programa de ayuda ATC modelo 417 · períodos 2025+', designYear: '2025+', officialExport: false, handoffExport: true, exportMode: 'atc_guided_packet', designWarning: 'Desde los períodos iniciados en 2025 el modelo 417 se presenta mensualmente. Taxea calcula desde los libros IGIC/SII; el .dec debe generarse y validarse en el programa oficial ATC.' },
  '420': { name: 'Autoliquidación trimestral IGIC régimen general', authority: 'ATC', frequency: 'trimestral', kind: 'indirect_tax', design: 'Programa de ayuda ATC 2026 v9.3.0', designYear: '2026', officialExport: false, exportMode: 'atc_guided_packet', handoffExport: true, designWarning: 'La ATC no publica un formato de importación externo para este modelo: el .dec presentable debe generarse y validarse en su programa de ayuda.' },
  '421': { name: 'Autoliquidación IGIC régimen simplificado', authority: 'ATC', frequency: 'trimestral', kind: 'indirect_tax_simplified', design: 'Programa de ayuda ATC modelo 421 · ejercicio 2026', designYear: '2026', officialExport: false, handoffExport: true, exportMode: 'atc_guided_packet', designWarning: 'El cálculo exige módulos y cuotas de la actividad según los índices anuales, además de cuotas soportadas y regularización del cuarto trimestre. Taxea no sustituye el programa oficial de ayuda.' },
  '425': { name: 'Resumen anual IGIC', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'Programa de ayuda ATC 2025 v6.3.1', designYear: '2025', officialExport: false, exportMode: 'atc_guided_packet', handoffExport: true, designWarning: 'La ATC no publica un formato de importación externo para este modelo y el programa anual 2026 aún no está disponible. El .dec presentable debe generarse y validarse en el programa oficial.' },
};

// Extracted from AEAT's official DR390e2025 v1.02 workbook. Positions are
// one-based. Numeric tuples contain [position, length, decimalPlaces] and box
// tuples contain [box, position, length, decimalPlaces].
const MODEL390_LAYOUT: Record<string, any> = {"01000":{"length":1187,"numeric":[[3,3,0],[6,5,0],[103,4,0],[133,1,0],[134,1,0],[734,8,0],[843,8,0],[952,8,0]],"boxes":[]},"02000":{"length":1806,"numeric":[[3,3,0],[6,5,0],[13,17,2],[30,17,0],[47,17,0],[64,17,0],[81,17,2],[98,17,2],[115,17,0],[132,17,0],[149,17,0],[166,17,0],[183,17,2],[200,17,2],[217,17,2],[234,17,2],[251,17,2],[268,17,0],[285,17,0],[302,17,0],[319,17,2],[336,17,2],[353,17,0],[370,17,0],[387,17,0],[404,17,0],[421,17,2],[438,17,2],[455,17,2],[472,17,2],[489,17,2],[506,17,0],[523,17,0],[540,17,0],[557,17,2],[574,17,2],[591,17,0],[608,17,0],[625,17,0],[642,17,0],[659,17,2],[676,17,2],[693,17,2],[710,17,2],[727,17,2],[744,17,0],[761,17,0],[778,17,0],[795,17,2],[812,17,2],[829,17,0],[846,17,0],[863,17,0],[880,17,0],[897,17,2],[914,17,2],[931,17,2],[948,17,2],[965,17,2],[982,17,2],[999,17,2],[1016,17,0],[1033,17,0],[1050,17,0],[1067,17,2],[1084,17,2],[1101,17,0],[1118,17,0],[1135,17,0],[1152,17,0],[1169,17,2],[1186,17,2],[1203,17,2],[1220,17,2],[1237,17,2],[1254,17,0],[1271,17,0],[1288,17,0],[1305,17,2],[1322,17,2],[1339,17,0],[1356,17,0],[1373,17,0],[1390,17,0],[1407,17,2],[1424,17,2],[1441,17,2],[1458,17,2],[1475,17,2],[1492,17,2],[1509,17,2],[1526,17,2],[1543,17,2],[1560,17,2],[1577,17,2],[1594,17,2],[1611,17,2],[1628,17,2]],"boxes":[["700",13,17,2],["701",30,17,0],["667",47,17,0],["668",64,17,0],["01",81,17,2],["02",98,17,2],["702",115,17,0],["703",132,17,0],["669",149,17,0],["670",166,17,0],["03",183,17,2],["04",200,17,2],["05",217,17,2],["06",234,17,2],["704",251,17,2],["705",268,17,0],["671",285,17,0],["672",302,17,0],["500",319,17,2],["501",336,17,2],["706",353,17,0],["707",370,17,0],["673",387,17,0],["674",404,17,0],["502",421,17,2],["503",438,17,2],["504",455,17,2],["505",472,17,2],["708",489,17,2],["709",506,17,0],["675",523,17,0],["676",540,17,0],["643",557,17,2],["644",574,17,2],["710",591,17,0],["711",608,17,0],["677",625,17,0],["678",642,17,0],["645",659,17,2],["646",676,17,2],["647",693,17,2],["648",710,17,2],["712",727,17,2],["713",744,17,0],["679",761,17,0],["680",778,17,0],["07",795,17,2],["08",812,17,2],["714",829,17,0],["715",846,17,0],["681",863,17,0],["682",880,17,0],["09",897,17,2],["10",914,17,2],["11",931,17,2],["12",948,17,2],["13",965,17,2],["14",982,17,2],["716",999,17,2],["717",1016,17,0],["683",1033,17,0],["684",1050,17,0],["21",1067,17,2],["22",1084,17,2],["718",1101,17,0],["719",1118,17,0],["685",1135,17,0],["686",1152,17,0],["23",1169,17,2],["24",1186,17,2],["25",1203,17,2],["26",1220,17,2],["720",1237,17,2],["721",1254,17,0],["687",1271,17,0],["688",1288,17,0],["545",1305,17,2],["546",1322,17,2],["722",1339,17,0],["723",1356,17,0],["689",1373,17,0],["690",1390,17,0],["547",1407,17,2],["548",1424,17,2],["551",1441,17,2],["552",1458,17,2],["27",1475,17,2],["28",1492,17,2],["29",1509,17,2],["30",1526,17,2],["649",1543,17,2],["650",1560,17,2],["31",1577,17,2],["32",1594,17,2],["33",1611,17,2],["34",1628,17,2]]},"02B00":{"length":531,"numeric":[[3,3,0],[6,5,0],[13,17,0],[30,17,0],[47,17,0],[64,17,0],[81,17,2],[98,17,2],[115,17,0],[132,17,0],[149,17,0],[166,17,0],[183,17,2],[200,17,2],[217,17,2],[234,17,2],[251,17,2],[268,17,2],[285,17,2],[302,17,2],[319,17,2],[336,17,2],[353,17,2]],"boxes":[["663",13,17,0],["664",30,17,0],["691",47,17,0],["692",64,17,0],["35",81,17,2],["36",98,17,2],["665",115,17,0],["666",132,17,0],["693",149,17,0],["694",166,17,0],["599",183,17,2],["600",200,17,2],["601",217,17,2],["602",234,17,2],["41",251,17,2],["42",268,17,2],["43",285,17,2],["44",302,17,2],["45",319,17,2],["46",336,17,2],["47",353,17,2]]},"03000":{"length":1840,"numeric":[[3,3,0],[6,5,0],[13,17,2],[30,17,2],[47,17,2],[64,17,2],[81,17,2],[98,17,2],[115,17,2],[132,17,2],[149,17,2],[166,17,2],[183,17,2],[200,17,2],[217,17,2],[234,17,2],[251,17,2],[268,17,2],[285,17,2],[302,17,2],[319,17,2],[336,17,2],[353,17,2],[370,17,2],[387,17,2],[404,17,2],[421,17,2],[438,17,2],[455,17,2],[472,17,2],[489,17,0],[506,17,0],[523,17,2],[540,17,2],[557,17,0],[574,17,0],[591,17,0],[608,17,0],[625,17,2],[642,17,2],[659,17,2],[676,17,2],[693,17,2],[710,17,2],[727,17,0],[744,17,0],[761,17,2],[778,17,2],[795,17,0],[812,17,0],[829,17,0],[846,17,0],[863,17,2],[880,17,2],[897,17,2],[914,17,2],[931,17,2],[948,17,2],[965,17,2],[982,17,2],[999,17,2],[1016,17,2],[1033,17,2],[1050,17,2],[1067,17,2],[1084,17,2],[1101,17,2],[1118,17,2],[1135,17,2],[1152,17,2],[1169,17,2],[1186,17,2],[1203,17,0],[1220,17,0],[1237,17,2],[1254,17,2],[1271,17,0],[1288,17,0],[1305,17,0],[1322,17,0],[1339,17,2],[1356,17,2],[1373,17,2],[1390,17,2],[1407,17,2],[1424,17,2],[1441,17,2],[1458,17,2],[1475,17,2],[1492,17,2],[1509,17,2],[1526,17,2],[1543,17,2],[1560,17,2],[1577,17,2],[1594,17,2],[1611,17,2],[1628,17,2],[1645,17,2],[1662,17,2]],"boxes":[["695",13,17,2],["696",30,17,2],["190",47,17,2],["191",64,17,2],["724",81,17,2],["725",98,17,2],["697",115,17,2],["698",132,17,2],["603",149,17,2],["604",166,17,2],["605",183,17,2],["606",200,17,2],["48",217,17,2],["49",234,17,2],["745",251,17,2],["746",268,17,2],["506",285,17,2],["507",302,17,2],["726",319,17,2],["727",336,17,2],["747",353,17,2],["748",370,17,2],["607",387,17,2],["608",404,17,2],["609",421,17,2],["610",438,17,2],["512",455,17,2],["513",472,17,2],["749",489,17,0],["750",506,17,0],["196",523,17,2],["197",540,17,2],["728",557,17,0],["729",574,17,0],["751",591,17,0],["752",608,17,0],["611",625,17,2],["612",642,17,2],["613",659,17,2],["614",676,17,2],["50",693,17,2],["51",710,17,2],["753",727,17,0],["754",744,17,0],["514",761,17,2],["515",778,17,2],["730",795,17,0],["731",812,17,0],["755",829,17,0],["756",846,17,0],["615",863,17,2],["616",880,17,2],["617",897,17,2],["618",914,17,2],["520",931,17,2],["521",948,17,2],["757",965,17,2],["758",982,17,2],["202",999,17,2],["203",1016,17,2],["732",1033,17,2],["733",1050,17,2],["759",1067,17,2],["760",1084,17,2],["619",1101,17,2],["620",1118,17,2],["621",1135,17,2],["622",1152,17,2],["52",1169,17,2],["53",1186,17,2],["761",1203,17,0],["762",1220,17,0],["208",1237,17,2],["209",1254,17,2],["734",1271,17,0],["735",1288,17,0],["763",1305,17,0],["764",1322,17,0],["623",1339,17,2],["624",1356,17,2],["625",1373,17,2],["626",1390,17,2],["54",1407,17,2],["55",1424,17,2],["765",1441,17,2],["766",1458,17,2],["214",1475,17,2],["215",1492,17,2],["736",1509,17,2],["737",1526,17,2],["767",1543,17,2],["768",1560,17,2],["627",1577,17,2],["628",1594,17,2],["629",1611,17,2],["630",1628,17,2],["56",1645,17,2],["57",1662,17,2]]},"04000":{"length":854,"numeric":[[3,3,0],[6,5,0],[13,17,0],[30,17,0],[47,17,2],[64,17,2],[81,17,0],[98,17,0],[115,17,0],[132,17,0],[149,17,2],[166,17,2],[183,17,2],[200,17,2],[217,17,2],[234,17,2],[251,17,0],[268,17,0],[285,17,2],[302,17,2],[319,17,0],[336,17,0],[353,17,0],[370,17,0],[387,17,2],[404,17,2],[421,17,2],[438,17,2],[455,17,2],[472,17,2],[489,17,2],[506,17,2],[523,17,2],[540,17,2],[557,17,2],[574,17,2],[591,17,2],[608,17,2],[625,17,2],[642,17,2],[659,17,2],[676,17,2]],"boxes":[["769",13,17,0],["770",30,17,0],["220",47,17,2],["221",64,17,2],["738",81,17,0],["739",98,17,0],["771",115,17,0],["772",132,17,0],["631",149,17,2],["632",166,17,2],["633",183,17,2],["634",200,17,2],["58",217,17,2],["59",234,17,2],["773",251,17,0],["774",268,17,0],["587",285,17,2],["588",302,17,2],["740",319,17,0],["741",336,17,0],["775",353,17,0],["776",370,17,0],["635",387,17,2],["636",404,17,2],["637",421,17,2],["638",438,17,2],["597",455,17,2],["598",472,17,2],["60",489,17,2],["61",506,17,2],["660",523,17,2],["661",540,17,2],["639",557,17,2],["62",574,17,2],["651",591,17,2],["652",608,17,2],["63",625,17,2],["522",642,17,2],["64",659,17,2],["65",676,17,2]]},"05000":{"length":1519,"numeric":[[3,3,0],[6,5,0],[17,10,2],[27,17,2],[44,10,2],[54,17,2],[71,10,2],[81,17,2],[98,10,2],[108,17,2],[125,10,2],[135,17,2],[152,10,2],[162,17,2],[179,10,2],[189,17,2],[206,17,2],[240,17,2],[257,3,2],[260,17,2],[277,5,2],[282,17,2],[299,17,2],[316,17,2],[337,10,2],[347,17,2],[364,10,2],[374,17,2],[391,10,2],[401,17,2],[418,10,2],[428,17,2],[445,10,2],[455,17,2],[472,10,2],[482,17,2],[499,10,2],[509,17,2],[526,17,2],[560,17,2],[577,3,2],[580,17,2],[597,5,2],[602,17,2],[619,17,2],[636,17,2],[653,2,0],[655,17,2],[672,6,5],[678,17,2],[695,17,2],[712,17,2],[729,2,0],[731,17,2],[748,6,5],[754,17,2],[771,17,2],[788,17,2],[805,2,0],[807,17,2],[824,6,5],[830,17,2],[847,17,2],[864,17,2],[881,2,0],[883,17,2],[900,6,5],[906,17,2],[923,17,2],[940,17,2],[957,2,0],[959,17,2],[976,6,5],[982,17,2],[999,17,2],[1016,17,2],[1033,17,2],[1050,17,2],[1067,17,2],[1084,17,2],[1101,17,2],[1118,17,2],[1135,17,2],[1152,17,2],[1169,17,2],[1186,17,2]],"boxes":[["66",13,4,0],["66",333,4,0],["74",1033,17,2],["75",1050,17,2],["76",1067,17,2],["77",1084,17,2],["78",1101,17,2],["79",1118,17,2],["80",1135,17,2],["81",1152,17,2],["82",1169,17,2],["83",1186,17,2]]},"06000":{"length":828,"numeric":[[3,3,0],[6,5,0],[13,17,2],[30,17,2],[47,17,2],[64,17,2],[81,17,2],[98,5,2],[103,5,2],[108,5,2],[113,5,2],[118,5,2],[123,17,2],[140,17,2],[157,17,2],[174,17,2],[191,17,2],[208,17,2],[225,17,2],[242,17,2],[259,17,2],[276,17,2],[293,17,2],[310,17,2],[327,17,2],[344,17,2],[361,17,2],[378,17,2],[395,17,2],[412,17,2],[429,17,2],[446,17,2],[463,17,2],[480,17,2],[497,17,2],[514,17,2],[531,17,2],[548,17,2],[565,17,2],[582,17,2],[599,17,2],[616,17,2],[633,17,2],[650,17,2]],"boxes":[["658",13,17,2],["84",30,17,2],["659",47,17,2],["85",64,17,2],["86",81,17,2],["87",98,5,2],["88",103,5,2],["89",108,5,2],["90",113,5,2],["91",118,5,2],["658",123,17,2],["84",140,17,2],["92",157,17,2],["659",174,17,2],["93",191,17,2],["94",208,17,2],["95",225,17,2],["96",242,17,2],["524",259,17,2],["97",276,17,2],["98",293,17,2],["662",310,17,2],["525",327,17,2],["526",344,17,2],["99",361,17,2],["653",378,17,2],["103",395,17,2],["104",412,17,2],["105",429,17,2],["110",446,17,2],["125",463,17,2],["126",480,17,2],["127",497,17,2],["128",514,17,2],["100",531,17,2],["101",548,17,2],["102",565,17,2],["227",582,17,2],["228",599,17,2],["106",616,17,2],["107",633,17,2],["108",650,17,2]]},"07000":{"length":776,"numeric":[[3,3,0],[6,5,0],[13,17,2],[30,17,2],[47,17,2],[64,17,2],[81,17,2],[98,17,2],[115,17,2],[132,17,2],[149,17,2],[166,17,2],[183,17,2],[243,17,2],[260,17,2],[278,5,2],[326,17,2],[343,17,2],[361,5,2],[409,17,2],[426,17,2],[444,5,2],[492,17,2],[509,17,2],[527,5,2],[575,17,2],[592,17,2],[610,5,2]],"boxes":[["230",13,17,2],["109",30,17,2],["231",47,17,2],["232",64,17,2],["111",81,17,2],["113",98,17,2],["523",115,17,2],["654",132,17,2],["655",149,17,2],["656",166,17,2],["657",183,17,2],["114",240,3,0],["115",243,17,2],["116",260,17,2],["117",277,1,0],["118",278,5,2],["114",323,3,0],["115",326,17,2],["116",343,17,2],["117",360,1,0],["118",361,5,2],["114",406,3,0],["115",409,17,2],["116",426,17,2],["117",443,1,0],["118",444,5,2],["114",489,3,0],["115",492,17,2],["116",509,17,2],["117",526,1,0],["118",527,5,2],["114",572,3,0],["115",575,17,2],["116",592,17,2],["117",609,1,0],["118",610,5,2]]},"08000":{"length":1092,"numeric":[[3,3,0],[6,5,0],[13,17,2],[30,17,2],[47,17,2],[64,17,2],[81,17,2],[98,17,2],[115,17,2],[132,17,2],[149,17,2],[166,17,2],[183,17,2],[200,17,2],[217,17,2],[234,17,2],[251,17,2],[268,17,2],[285,17,2],[302,17,2],[319,17,2],[336,17,2],[353,17,2],[370,17,2],[387,17,2],[404,17,2],[421,17,2],[438,17,2],[455,17,2],[472,17,2],[489,17,2],[506,17,2],[523,17,2],[540,17,2],[557,17,2],[574,17,2],[591,17,2],[608,17,2],[625,17,2],[642,17,2],[659,17,2],[676,17,2],[693,17,2],[710,17,2],[727,17,2],[744,17,2],[761,17,2],[778,17,2],[795,17,2],[812,17,2],[829,17,2],[846,17,2],[863,17,2],[880,17,2],[897,17,2],[914,17,2]],"boxes":[["139",13,17,2],["140",30,17,2],["141",47,17,2],["142",64,17,2],["143",81,17,2],["144",98,17,2],["145",115,17,2],["146",132,17,2],["147",149,17,2],["148",166,17,2],["149",183,17,2],["150",200,17,2],["151",217,17,2],["152",234,17,2],["640",251,17,2],["153",268,17,2],["154",285,17,2],["155",302,17,2],["156",319,17,2],["157",336,17,2],["158",353,17,2],["159",370,17,2],["160",387,17,2],["161",404,17,2],["162",421,17,2],["163",438,17,2],["164",455,17,2],["165",472,17,2],["166",489,17,2],["167",506,17,2],["168",523,17,2],["169",540,17,2],["641",557,17,2],["170",574,17,2],["171",591,17,2],["172",608,17,2],["173",625,17,2],["174",642,17,2],["175",659,17,2],["176",676,17,2],["177",693,17,2],["178",710,17,2],["179",727,17,2],["180",744,17,2],["181",761,17,2],["182",778,17,2],["183",795,17,2],["184",812,17,2],["185",829,17,2],["186",846,17,2],["642",863,17,2],["187",880,17,2],["188",897,17,2],["189",914,17,2]]}};

const SOURCES = [
  { title: 'AEAT - Diseños de registro, modelos 100 a 199', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-100-199.html' },
  { title: 'AEAT - Contribuyentes en estimación objetiva y modelo 131', url: 'https://sede.agenciatributaria.gob.es/Sede/empresarios-individuales-profesionales/contribuyentes-modulos.html' },
  { title: 'AEAT - Instrucciones del modelo 216', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/impuesto-sobre-renta-no-residentes/modelo-216-irnr______sos-cuenta-declaracion-ingreso_/instrucciones-modelo-216-presentacion-ejercicio-siguientes.html' },
  { title: 'AEAT - Ayuda del modelo 296', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/declaraciones-informativas-ayuda-tecnica/modelos-291-347/modelo-296-formulario.html' },
  { title: 'AEAT - Diseños de registro, modelos 200 a 299', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-200-299.html' },
  { title: 'AEAT - Manual práctico de Sociedades 2025', url: 'https://sede.agenciatributaria.gob.es/Sede/Ayuda/25Manual/200.shtml' },
  { title: 'AEAT - Instrucciones del modelo 202', url: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/GE00/202_instrucciones.pdf' },
  { title: 'AEAT - Instrucciones del modelo 232', url: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/GI43/Instrucciones_Modelo_232.pdf' },
  { title: 'AEAT - Instrucciones y diseño del modelo 349', url: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/GI28/instr_mod_349.pdf' },
  { title: 'AEAT - Diseños de registro, modelos 300 a 399', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-300-399.html' },
  { title: 'AEAT - Instrucciones modelo 130', url: 'https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html' },
  { title: 'BOE - Reglamento del IRPF, imputación temporal y pagos fraccionados', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820' },
  { title: 'AEAT - Instrucciones modelo 111', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/pagos-cuenta/modelo-111-reten_____moniales-imputaciones-renta-autoliquidacion_/instrucciones.html' },
  { title: 'AEAT - Retenciones sobre arrendamientos, modelos 115 y 180', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/folleto-actividades-economicas/7-otras-obligaciones-fiscales-retenciones/7_3-retenciones-arrendamiento-bienes-inmuebles-180.html' },
  { title: 'AEAT - Estimación directa simplificada', url: 'https://sede.agenciatributaria.gob.es/Sede/irpf/empresarios-individuales-profesionales/regimenes-determinar-rendimiento-actividad/estimacion-directa-simplificada.html' },
  { title: 'BOE - Real Decreto-ley 23/2026, medidas IRPF para La Palma', url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-18828' },
  { title: 'AEAT - Imputación temporal de actividades económicas', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2023/7-cumplimentacion-irpf/7_4-rendimientos-actividades-economicas/7_4_1-cuestiones-generales/7_4_1_3-imputacion-temporal.html' },
  { title: 'AEAT - IVA régimen especial del criterio de caja', url: 'https://sede.agenciatributaria.gob.es/Sede/iva/regimenes-tributacion-iva/criterio-caja/contenido-regimen.html' },
  { title: 'AEAT - Imputación temporal del modelo 347', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/imputacion-temporal.html' },
  { title: 'AEAT - Preguntas frecuentes modelo 347 y criterio de caja', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/preguntas-frecuentes.html' },
  { title: 'AEAT - IVA soportado deducible y plazo de cuatro años', url: 'https://sede.agenciatributaria.gob.es/Sede/iva/que-iva-soportado-puedo-deducir/que-requisitos-debo-cumplir-poder-iva.html' },
  { title: 'AEAT - Factura recibida tarde y período de deducción', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2023/capitulo-05-deducciones-devoluciones/cuestiones-frecuentes-planteadas-capitulo.html' },
  { title: 'AEAT - Autoliquidaciones complementarias', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/presentacion-autoliquidaciones-complementarias.html' },
  { title: 'AEAT - Errores y autoliquidación rectificativa del modelo 303', url: 'https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303/errores-declaracion.html' },
  { title: 'AEAT - Consulta y evidencia de declaraciones presentadas', url: 'https://sede.agenciatributaria.gob.es/Sede/irpf/declaraciones-presentadas/consulta-declaraciones-presentadas.html' },
  { title: 'AEAT - Modelo 347, operaciones excluidas', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/operaciones-excluidas-modelo-347.html' },
  { title: 'ATC - Modelo 420', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-420' },
  { title: 'ATC - Modelo 415', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-415' },
  { title: 'ATC - Modelo 425', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-425' },
  { title: 'ATC - Preguntas frecuentes del régimen especial del criterio de caja IGIC', url: 'https://www3.gobiernodecanarias.org/tributos/atc/en/preguntas-frecuentes-recc1' },
  { title: 'ATC - Instrucciones modelo 415', url: 'https://www3.gobiernodecanarias.org/tributos/atc/estatico/asistencia_contribuyente/modelos/ref_y_propios/igic/mod415/pdf/instrucciones/415.pdf' },
  { title: 'ATC - Reglamento de gestión tributaria canario, artículos 142 y 143', url: 'https://www3.gobiernodecanarias.org/libroazul/pdf/65872.pdf' },
  { title: 'ATC - Diseño oficial del modelo 415 y criterio de caja', url: 'https://sede.gobiernodecanarias.org/boc/boc-a-2015-041-863.pdf' },
  { title: 'ATC - Cómo presentar los modelos', url: 'https://www3.gobiernodecanarias.org/tributos/atc/c%C3%B3mo-presentar-los-modelos' },
  { title: 'ATC - Instrucciones del modelo 417', url: 'https://www3.gobiernodecanarias.org/tributos/atc/documents/65729/201109/Instrucciones_modelo_417.pdf/906314e6-20d5-e126-20f9-0273a8f728a7?t=1742820938504' },
  { title: 'ATC - Modelo 421', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-421' },
];

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const clean = (value: unknown) => String(value ?? '').trim();
const unique = <T>(values: T[]) => [...new Set(values)];

const THIRD_PARTY_NUMERIC_FIELDS = [
  'cashAmount', 'cashAccountingAnnualAmount', 'propertyRentAmount', 'propertyTransferAmount',
  'propertyRentT1', 'propertyRentT2', 'propertyRentT3', 'propertyRentT4',
  'propertyTransferT1', 'propertyTransferT2', 'propertyTransferT3', 'propertyTransferT4',
];

function booleanValue(value: unknown, fallback = false) {
  return value === true || value === 'true' || value === '1' ? true : value === false || value === 'false' || value === '0' ? false : fallback;
}

function sanitizeThirdPartyPayload(input: any) {
  const payload: any = {};
  for (const key of THIRD_PARTY_NUMERIC_FIELDS) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = money(input[key]);
  }
  for (const key of ['cashYear', 'representativeTaxId']) {
    if (clean(input?.[key])) payload[key] = clean(input[key]);
  }
  if (clean(input?.sourceFingerprint)) payload.sourceFingerprint = clean(input.sourceFingerprint);
  for (const key of ['cashAccounting', 'reverseCharge', 'exemptArticle13', 'specialDataConfirmed']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = booleanValue(input[key]);
  }
  if (Array.isArray(input?.properties)) {
    payload.properties = input.properties.slice(0, 100).map((property: any) => ({
      amount: money(property?.amount),
      cadastralUnavailable: booleanValue(property?.cadastralUnavailable),
      cadastralReference: clean(property?.cadastralReference),
      roadType: clean(property?.roadType), roadName: clean(property?.roadName), numberingType: clean(property?.numberingType) || 'NUM',
      houseNumber: clean(property?.houseNumber), numberQualifier: clean(property?.numberQualifier), block: clean(property?.block), portal: clean(property?.portal),
      stair: clean(property?.stair), floor: clean(property?.floor), door: clean(property?.door), complement: clean(property?.complement),
      locality: clean(property?.locality), municipality: clean(property?.municipality), municipalityCode: clean(property?.municipalityCode),
      provinceCode: clean(property?.provinceCode), postalCode: clean(property?.postalCode),
    }));
  }
  return payload;
}

function sanitize190Payload(input: any) {
  const payload: any = {};
  for (const key of ['representativeTaxId','provinceCode','key','subkey','accrualYear','birthYear','familySituation','spouseTaxId','disability','contractType']) {
    if (clean(input?.[key])) payload[key] = clean(input[key]);
  }
  for (const key of ['reductions','deductibleExpenses','compensatoryPensions','childSupport']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = money(input[key]);
  }
  for (const key of ['ceutaMelilla','mobility','specialDataConfirmed']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = booleanValue(input[key]);
  }
  if (clean(input?.sourceFingerprint)) payload.sourceFingerprint = clean(input.sourceFingerprint);
  return payload;
}

function sanitize193Payload(input: any) {
  const payload: any = {};
  for (const key of ['representativeTaxId','provinceCode','keyCode','issuerCode','perceptionKey','nature','paymentRole','accountCodeType','accountCode','accrualYear','perceptionType','isin','loanStartDate','loanEndDate','ceutaPalmaCode','previousPayerTaxId','accrualDate','marketKey']) {
    if (clean(input?.[key])) payload[key] = clean(input[key]);
  }
  for (const key of ['perceptionAmount','reductions','retentionBase','retentionRate','penalties','loanCompensation','loanGuarantees','stateWithholding','navarraWithholding','alavaWithholding','gipuzkoaWithholding','bizkaiaWithholding']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = money(input[key]);
  }
  for (const key of ['recipientMediator','pending','specialDataConfirmed']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = booleanValue(input[key]);
  }
  if (clean(input?.sourceFingerprint)) payload.sourceFingerprint = clean(input.sourceFingerprint);
  return payload;
}

function sanitize193DeclarationPayload(input: any) {
  const payload: any = {};
  for (const key of ['declarantNatureSpecial','expenseAnnexNotApplicable','specialDataConfirmed']) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = booleanValue(input[key]);
  }
  if (clean(input?.sourceFingerprint)) payload.sourceFingerprint = clean(input.sourceFingerprint);
  return payload;
}

const GENERIC_DECLARABLE_FIELDS: Record<string, { text: string[]; numeric: string[]; boolean: string[] }> = {
  '216': {
    text: ['recipientTaxId','recipientName','country','incomeKey','nature','exemptionCode','treatyCode','paymentDate','operationDate','representativeTaxId','provinceCode','incomeGroup'],
    numeric: ['accruedAmount','withholdingBase','withholdingAmount'], boolean: ['notSubjectToWithholding','dividendOrEquityIncome','specialDataConfirmed'],
  },
  '296': {
    text: ['recipientTaxId','recipientName','country','incomeKey','nature','exemptionCode','treatyCode','paymentDate','operationDate','representativeTaxId','provinceCode','incomeGroup'],
    numeric: ['accruedAmount','withholdingBase','withholdingAmount'], boolean: ['notSubjectToWithholding','dividendOrEquityIncome','specialDataConfirmed'],
  },
  '349': {
    text: ['operatorTaxId','operatorName','country','operationKey','operationDate','originalYear','originalPeriod','originalOperatorTaxId'],
    numeric: ['amount','rectificationAmount','originalAmount'], boolean: ['rectification','specialDataConfirmed'],
  },
  '232': {
    text: ['relatedPartyTaxId','relatedPartyName','country','relationType','operationType','valuationMethod','incomePayment','operationDate','category','collectiveOperationId'],
    numeric: ['amount','netAmount'], boolean: ['sameValuationMethod','specialDataConfirmed'],
  },
};

function sanitizeGenericDeclarable(model: string, input: any) {
  const schema = GENERIC_DECLARABLE_FIELDS[model];
  if (!schema) return {};
  const payload: any = {};
  for (const key of schema.text) if (clean(input?.[key])) payload[key] = clean(input[key]).slice(0, 250);
  for (const key of schema.numeric) if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = money(input[key]);
  for (const key of schema.boolean) if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') payload[key] = booleanValue(input[key]);
  if (clean(input?.sourceFingerprint)) payload.sourceFingerprint = clean(input.sourceFingerprint);
  return payload;
}

function sourceFingerprint(values: unknown[]) {
  const text = values.map(value => clean(value)).sort().join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}-${values.length}`;
}

function authorize(user: any, companyId: string, company: any) {
  const role = clean(user?.role).toLowerCase();
  if (['admin', 'super_admin', 'advisor', 'asesor'].includes(role)) return;
  const ownCompanyId = clean(user?.data?.company_id || user?.company_id);
  const userEmail = clean(user?.email).toLowerCase();
  const ownerEmail = clean(company?.owner_email).toLowerCase();
  const authorizedEmails = Array.isArray(company?.usuarios_autorizados)
    ? company.usuarios_autorizados.map((email: unknown) => clean(email).toLowerCase())
    : [];
  if (companyId && (ownCompanyId === companyId || (!!userEmail && ownerEmail === userEmail) || authorizedEmails.includes(userEmail))) return;
  throw Object.assign(new Error('No tienes permiso para consultar la empresa seleccionada.'), { status: 403 });
}

async function listAll(entity: any, filter: any, sort = '-created_date') {
  const rows: any[] = [];
  const limit = 500;
  for (let skip = 0; skip < 100000; skip += limit) {
    const page = await entity.filter(filter, sort, limit, skip);
    rows.push(...(page || []));
    if (!page || page.length < limit) break;
  }
  return rows;
}

function dateOf(item: any) {
  const direct = clean(item.operationDate || item.payment_date || item.fecha_operacion || item.fecha_emision || item.entryDate || item.date || item.fecha || item.ultimo_pago_at);
  if (direct) return direct;
  const label = clean(item.period_label);
  const yearMonth = /^(\d{4})[-/](\d{1,2})/.exec(label);
  if (yearMonth) return `${yearMonth[1]}-${String(Number(yearMonth[2])).padStart(2, '0')}-01`;
  const monthYear = /^(\d{1,2})[-/](\d{4})/.exec(label);
  if (monthYear) return `${monthYear[2]}-${String(Number(monthYear[1])).padStart(2, '0')}-01`;
  return '';
}

function normalizedPeriod(value: unknown) {
  const period = clean(value).toUpperCase();
  const legacyQuarter = /^T([1-4])$/.exec(period);
  if (legacyQuarter) return `${legacyQuarter[1]}T`;
  const quarter = /^([1-4])T$/.exec(period);
  if (quarter) return `${quarter[1]}T`;
  const corporatePayment = /^([1-3])P$/.exec(period);
  if (corporatePayment) return `${corporatePayment[1]}P`;
  if (/^\d{1,2}$/.test(period)) return String(Number(period)).padStart(2, '0');
  return period === 'ANUAL' ? 'Anual' : period;
}

const ANNUAL_MODELS = new Set(['180', '190', '193', '200', '232', '296', '347', '390', '415', '425']);
const QUARTER_ONLY_MODELS = new Set(['130', '131', '420', '421']);
const MONTH_ONLY_MODELS = new Set(['417']);
const PERIODIC_MODELS = new Set(['111', '115', '123', '216', '303', '349']);

function periodValidationError(model: string, periodInput: string) {
  const period = normalizedPeriod(periodInput);
  if (ANNUAL_MODELS.has(model) && period !== 'Anual') return `El modelo ${model} es anual y solo admite el período Anual.`;
  if (QUARTER_ONLY_MODELS.has(model) && !/^[1-4]T$/.test(period)) return `El modelo ${model} solo admite períodos trimestrales (1T a 4T).`;
  if (MONTH_ONLY_MODELS.has(model) && !/^(0[1-9]|1[0-2])$/.test(period)) return `El modelo ${model} solo admite períodos mensuales (01 a 12).`;
  if (model === '202' && !/^[1-3]P$/.test(period)) return 'El modelo 202 solo admite 1P (abril), 2P (octubre) o 3P (diciembre).';
  if (PERIODIC_MODELS.has(model) && !(/^([1-4])T$/.test(period) || /^(0[1-9]|1[0-2])$/.test(period))) return `El modelo ${model} solo admite un trimestre (1T a 4T) o un mes (01 a 12).`;
  return '';
}

function bounds(year: number, periodInput: string) {
  const period = normalizedPeriod(periodInput);
  if (period === 'Anual') return { start: `${year}-01-01`, end: `${year}-12-31`, cumulativeStart: `${year}-01-01` };
  if (period === '1P') return { start: `${year}-01-01`, end: `${year}-03-31`, cumulativeStart: `${year}-01-01`, filingMonth: '04' };
  if (period === '2P') return { start: `${year}-01-01`, end: `${year}-09-30`, cumulativeStart: `${year}-01-01`, filingMonth: '10' };
  if (period === '3P') return { start: `${year}-01-01`, end: `${year}-11-30`, cumulativeStart: `${year}-01-01`, filingMonth: '12' };
  const monthMatch = /^(0[1-9]|1[0-2])$/.exec(period);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: `${year}-${period}-01`, end: `${year}-${period}-${String(last).padStart(2, '0')}`, cumulativeStart: `${year}-01-01` };
  }
  const quarterMatch = /^([1-4])T$/.exec(period);
  if (!quarterMatch) throw new Error(`Período fiscal no válido: ${periodInput}`);
  const quarter = Number(quarterMatch[1]);
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = quarter * 3;
  const last = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  return {
    start: `${year}-${String(firstMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(lastMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    cumulativeStart: `${year}-01-01`,
  };
}

function periodPolicy(model: string, year: number, periodInput: string) {
  const period = normalizedPeriod(periodInput);
  const selected = bounds(year, period);
  const common = { selectedStart: selected.start, selectedEnd: selected.end, period };
  if (model === '130') return { ...common, basis: 'acumulado_ejercicio', calculationStart: `${year}-01-01`, calculationEnd: selected.end, label: `Acumulado del 01/01/${year} al ${selected.end.split('-').reverse().join('/')}`, rule: 'Ingresos fiscalmente computables y gastos fiscalmente deducibles acumulados desde el 1 de enero. Las actividades agrícolas, ganaderas, forestales o pesqueras de la sección II usan únicamente los ingresos del trimestre.' };
  if (model === '131') return { ...common, basis: 'estimacion_objetiva', calculationStart: selected.start, calculationEnd: selected.end, label: `Pago fraccionado por módulos ${period} ${year}`, rule: 'Parte del rendimiento neto por módulos y de los índices de la Orden anual. No se calcula sumando bases de facturas; los datos-base deben estar confirmados por actividad.' };
  if (model === '202') return { ...common, basis: 'pago_fraccionado_sociedades', calculationStart: selected.start, calculationEnd: selected.end, label: `Pago fraccionado ${period} · ${year}`, rule: 'La modalidad del artículo 40.2 usa la cuota del último período impositivo vencido; la del artículo 40.3 usa la base imponible acumulada de los 3, 9 u 11 primeros meses. Debe confirmarse la modalidad y sus magnitudes.' };
  if (model === '216') return { ...common, basis: 'pago_no_residentes', calculationStart: selected.start, calculationEnd: selected.end, label: `Rentas IRNR satisfechas del ${selected.start.split('-').reverse().join('/')} al ${selected.end.split('-').reverse().join('/')}`, rule: 'Incluye rentas satisfechas a no residentes sujetas a retención y las exentas o exceptuadas que deban declararse. La residencia fiscal, clave de renta y convenio se documentan por perceptor.' };
  if (model === '349') return { ...common, basis: 'operaciones_intracomunitarias', calculationStart: selected.start, calculationEnd: selected.end, label: `Operaciones intracomunitarias ${period} ${year}`, rule: 'Se agregan por operador, NIF-IVA y clave las entregas, adquisiciones y servicios intracomunitarios del período; las rectificaciones se identifican por separado.' };
  if (model === '417') return { ...common, basis: 'sii_igic_mensual', calculationStart: selected.start, calculationEnd: selected.end, label: `SII-IGIC ${period}/${year}`, rule: 'Autoliquidación mensual construida desde los libros registro IGIC y las líneas fiscales sincronizadas con SII. El programa ATC realiza la validación definitiva.' };
  if (model === '421') return { ...common, basis: 'igic_simplificado', calculationStart: selected.start, calculationEnd: selected.end, label: `IGIC simplificado ${period} ${year}`, rule: 'Los tres primeros trimestres usan el ingreso a cuenta derivado de módulos; el cuarto incorpora la cuota anual, cuotas soportadas y regularizaciones confirmadas.' };
  if (['200', '232', '296'].includes(model)) return { ...common, basis: model === '200' ? 'periodo_impositivo_sociedades' : 'anual_natural', calculationStart: selected.start, calculationEnd: selected.end, label: model === '200' ? `Impuesto sobre Sociedades · período cerrado en ${year}` : `Resumen anual ${model} del ejercicio ${year}`, rule: model === '200' ? 'La conciliación parte del resultado contable del período impositivo cerrado y de ajustes fiscales documentados. Si el ejercicio no coincide con el año natural, confirma las fechas antes del traspaso a Sociedades WEB.' : 'La declaración anual se construye desde registros individualizados revisados y sus autoliquidaciones relacionadas.' };
  if (['111', '115', '123'].includes(model)) return { ...common, basis: 'pago', calculationStart: selected.start, calculationEnd: selected.end, label: `Pagos del ${selected.start.split('-').reverse().join('/')} al ${selected.end.split('-').reverse().join('/')}`, rule: 'Se incluyen las rentas satisfechas o abonadas dentro del mes o trimestre seleccionado. La fecha de factura o de devengo no sustituye la fecha del pago.' };
  if (['303', '420'].includes(model)) return { ...common, basis: 'devengo_y_deduccion', calculationStart: selected.start, calculationEnd: selected.end, label: `Autoliquidación del ${selected.start.split('-').reverse().join('/')} al ${selected.end.split('-').reverse().join('/')}`, rule: 'Las cuotas repercutidas siguen su devengo; las soportadas siguen el período en que nace y se ejerce la deducción. En RECC se imputan por cobros/pagos parciales y, como límite, el 31 de diciembre del año siguiente.' };
  if (model === '347') return { ...common, basis: 'libros_registro', calculationStart: selected.start, calculationEnd: selected.end, label: `Operaciones registrables del ejercicio ${year}`, rule: 'Las ventas se asignan por su anotación/expedición y las compras por la recepción y anotación en el libro registro. En RECC se informan separadamente el importe según la regla general y el devengado por cobros o pagos.' };
  if (model === '415') return { ...common, basis: 'expedicion_factura', calculationStart: selected.start, calculationEnd: selected.end, label: `Operaciones del ejercicio ${year}`, rule: 'La operación se imputa, con carácter general, cuando se expide la factura o documento sustitutivo; los anticipos cuando se satisfacen. En RECC se informan por separado la regla general y la regla especial de caja.' };
  if (['180', '190', '193'].includes(model)) return { ...common, basis: 'pago_anual', calculationStart: selected.start, calculationEnd: selected.end, label: `Percepciones satisfechas durante ${year}`, rule: 'Resumen anual de las rentas satisfechas o abonadas durante el año natural, con el detalle y las claves exigidas en cada modelo.' };
  return { ...common, basis: 'anual_natural', calculationStart: selected.start, calculationEnd: selected.end, label: `Resumen del año natural ${year}`, rule: 'Comprende el año natural completo. Las cuotas deben conciliarse con los períodos de devengo o deducción efectivamente declarados.' };
}

const FILED_STATUSES = new Set(['presentado', 'subsanado']);

function filingDate(filing: any) {
  return clean(filing?.fechaPresentacion || filing?.fechaImportacion || filing?.updated_date || filing?.created_date).slice(0, 10);
}

function latestFiling(filings: any[], model: string, year: number, period: string) {
  return filings
    .filter((row: any) => row.modeloCodigo === model && Number(row.ejercicio) === Number(year) && normalizedPeriod(row.periodo) === normalizedPeriod(period) && FILED_STATUSES.has(clean(row.estadoPresentacion)))
    .sort((a: any, b: any) => `${filingDate(b)}|${String(b.snapshotVersion || 0).padStart(6, '0')}|${b.created_date || ''}`.localeCompare(`${filingDate(a)}|${String(a.snapshotVersion || 0).padStart(6, '0')}|${a.created_date || ''}`))[0] || null;
}

function boxMap(value: any) {
  const source = Array.isArray(value)
    ? Object.fromEntries(value.map((row: any) => [clean(row?.code || row?.casilla), row?.value ?? row?.valor]))
    : (value && typeof value === 'object' ? value : {});
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const code = clean(key).toUpperCase().replace(/^CASILLA\s*/i, '').replace(/[^A-Z0-9_]/g, '').slice(0, 40);
    const normalized = typeof raw === 'number' ? raw : Number(clean(raw).replace(/\s|€|EUR/gi, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    if (!code || raw === '' || raw == null || !Number.isFinite(normalized)) continue;
    result[code] = money(normalized);
  }
  return result;
}

function periodsForStyle(monthly: boolean) {
  return monthly ? ['01','02','03','04','05','06','07','08','09','10','11','12'] : ['1T','2T','3T','4T'];
}

function periodForDate(value: string, monthly: boolean) {
  const month = Number(clean(value).slice(5, 7));
  if (!month) return '';
  return monthly ? String(month).padStart(2, '0') : `${Math.ceil(month / 3)}T`;
}

function periodOrdinal(year: number, period: string) {
  period = normalizedPeriod(period);
  const monthly = /^\d{2}$/.test(period);
  const index = periodsForStyle(monthly).indexOf(period);
  return year * (monthly ? 12 : 4) + Math.max(index, 0);
}

function periodSequence(startDate: string, endYear: number, endPeriod: string) {
  const monthly = /^\d{2}$/.test(endPeriod);
  const periods = periodsForStyle(monthly);
  const startYear = Number(startDate.slice(0, 4));
  const startPeriod = periodForDate(startDate, monthly);
  const result: Array<{year:number,period:string}> = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (const period of periods) {
      if (periodOrdinal(year, period) < periodOrdinal(startYear, startPeriod)) continue;
      if (periodOrdinal(year, period) > periodOrdinal(endYear, endPeriod)) continue;
      result.push({ year, period });
    }
  }
  return result;
}

function receiptDateOf(line: any) {
  const explicit = clean(line.receiptDate || line.invoice?.fecha_recepcion).slice(0, 10);
  if (explicit) return { date: explicit, inferred: false };
  const created = clean(line.created_date || line.invoice?.created_date).slice(0, 10);
  return { date: created || clean(line.date || dateOf(line.invoice)).slice(0, 10), inferred: true };
}

function plusFourYears(value: string) {
  const year = Number(value.slice(0, 4));
  return year ? `${year + 4}${value.slice(4, 10)}` : '';
}

function deductionDecision(line: any, data: any, selectedBounds: any, model: '303'|'420'|'417') {
  const operationDate = clean(line.date || dateOf(line.invoice)).slice(0, 10);
  const receipt = receiptDateOf(line);
  const selected = { year: Number(data.year), period: normalizedPeriod(data.period) };
  const explicitYear = Number(line.deductionYear || 0);
  const explicitPeriod = normalizedPeriod(line.deductionPeriod);
  const basic = { sourceId: line.sourceId, invoiceId: line.invoice?.id, invoiceNumber: line.invoice?.numero_factura, operationDate, receiptDate: receipt.date, receiptDateInferred: receipt.inferred, base: money(line.base), quota: money(line.deductibleQuota ?? line.quota), originalYear: Number(operationDate.slice(0, 4)), originalPeriod: periodForDate(operationDate, /^\d{2}$/.test(selected.period)) };
  if (explicitYear && explicitPeriod) return { ...basic, targetYear: explicitYear, targetPeriod: explicitPeriod, treatment: 'asignacion_confirmada', include: explicitYear === selected.year && explicitPeriod === selected.period };
  if (!operationDate || !receipt.date) return { ...basic, treatment: 'revision_fecha_recepcion', include: false, review: true, reason: 'Falta fecha suficiente para separar devengo y ejercicio de la deducción.' };
  if (clean(line.regime) === 'criterio_caja') return { ...basic, treatment: 'revision_criterio_caja', include: false, review: true, reason: 'El criterio de caja exige cruzar cobros/pagos y no se asigna solo por la fecha de factura.' };
  if (['420','417'].includes(model) && ['incluido','transitorio_2026'].includes(clean(data.profile?.repepStatus))) return { ...basic, treatment: 'no_deducible_repep', include: false, review: true, reason: 'El perfil REPEP no permite deducir automáticamente el IGIC soportado de sus operaciones corrientes.' };
  const expiry = plusFourYears(operationDate);
  if (expiry && selectedBounds.end > expiry) return { ...basic, treatment: 'caducado_revision', include: false, review: true, reason: 'La fecha seleccionada supera el plazo general de cuatro años; requiere revisión profesional.' };
  const sequence = periodSequence(operationDate, selected.year, selected.period);
  for (const candidate of sequence) {
    const candidateBounds = bounds(candidate.year, candidate.period);
    if (candidateBounds.end < receipt.date) continue;
    const filed = latestFiling(data.filings || [], model, candidate.year, candidate.period);
    if (!filed) return { ...basic, targetYear: candidate.year, targetPeriod: candidate.period, treatment: candidate.year === basic.originalYear && candidate.period === basic.originalPeriod ? 'periodo_devengo_abierto' : 'deduccion_periodo_posterior', include: candidate.year === selected.year && candidate.period === selected.period };
    const submittedSources = Array.isArray(filed.sourceIdsPresentados) ? filed.sourceIdsPresentados : [];
    if (submittedSources.includes(line.sourceId)) return { ...basic, targetYear: candidate.year, targetPeriod: candidate.period, treatment: 'ya_incluida_presentado', include: false, alreadyFiled: true };
    if (filingDate(filed) < receipt.date || submittedSources.length) continue;
    return { ...basic, treatment: 'revision_contra_modelo_importado', include: false, review: true, reason: 'La factura existía antes de la presentación importada, pero el fichero no conserva identificadores de factura; confirme si ya fue deducida.' };
  }
  return { ...basic, treatment: 'pendiente_periodo_futuro', include: false, targetYear: selected.year, targetPeriod: selected.period, future: true };
}

function selectIndirectTaxLines(data: any, b: any, kind: 'iva'|'igic', annual: boolean, modelOverride?: '303'|'420'|'417') {
  const candidates = data.taxLines.filter((line: any) => line.taxKind === kind);
  const model: '303'|'420'|'417' = modelOverride || (kind === 'iva' ? '303' : '420');
  const lines: any[] = [], carry: any[] = [], review: any[] = [], deferred: any[] = [];
  for (const line of candidates) {
    if (clean(line.regime) === 'criterio_caja') {
      const cash = cashTaxLineForPeriod(line, data, b);
      if (cash.line) lines.push(cash.line);
      else if (cash.review) review.push(cash.review);
      else if (cash.deferred) deferred.push(cash.deferred);
      continue;
    }
    if (annual) {
      if (line.invoice?.tipo !== 'recibida') {
        if (inRange(line, b.start, b.end)) lines.push(line);
        continue;
      }
      const explicitYear = Number(line.deductionYear || 0);
      const receipt = receiptDateOf(line);
      const effectiveDate = explicitYear ? `${explicitYear}-12-31` : receipt.date;
      if (effectiveDate >= b.start && effectiveDate <= b.end) lines.push({ ...line, annualDeductionDate: effectiveDate, annualDeductionSource: explicitYear ? 'asignacion_confirmada' : receipt.inferred ? 'alta_taxea_aproximada' : 'fecha_recepcion' });
      if (!effectiveDate) review.push({ sourceId: line.sourceId, invoiceId: line.invoice?.id, reason: 'Falta fecha de recepción o asignación anual de la deducción.' });
      continue;
    }
    if (line.invoice?.tipo !== 'recibida') {
      if (inRange(line, b.start, b.end)) lines.push(line);
      continue;
    }
    const decision: any = deductionDecision(line, data, b, model);
    if (decision.include) {
      lines.push({ ...line, deductionDecision: decision });
      if (decision.treatment === 'deduccion_periodo_posterior' || decision.treatment === 'asignacion_confirmada') carry.push(decision);
    } else if (decision.review) review.push(decision);
    else if (!decision.alreadyFiled && (decision.future || periodOrdinal(Number(decision.targetYear || 0), clean(decision.targetPeriod)) > periodOrdinal(Number(data.year), clean(data.period)))) deferred.push(decision);
  }
  return { lines, carry, review, deferred };
}

function previous130FromFilings(data: any) {
  const periods = ['1T','2T','3T','4T'];
  const selectedIndex = periods.indexOf(normalizedPeriod(data.period));
  if (selectedIndex <= 0) return { complete: true, amount: 0, negativeComplete: true, negativeAmount: 0, filings: [], missing: [], missingNegative: [] };
  const found: any[] = [], missing: string[] = [], missingNegative: string[] = [];
  for (const period of periods.slice(0, selectedIndex)) {
    const filing = latestFiling(data.filings || [], '130', Number(data.year), period);
    if (!filing) { missing.push(period); continue; }
    const boxes = boxMap(filing.casillasPresentadas);
    const has07 = Object.prototype.hasOwnProperty.call(boxes, '07');
    const has19 = Object.prototype.hasOwnProperty.call(boxes, '19');
    if (!has07) missing.push(`${period} (casilla 07)`);
    if (!has19) missingNegative.push(`${period} (casilla 19)`);
    const positive07 = has07 ? Math.max(0, money(boxes['07'])) : 0;
    const housing16 = Math.max(0, money(boxes['16']));
    found.push({
      id: filing.id,
      period,
      amount: money(Math.max(0, positive07 - housing16)),
      positive07,
      housing16,
      negativeGenerated: has19 ? Math.max(0, -money(boxes['19'])) : 0,
      negativeApplied: Math.max(0, money(boxes['15'])),
      date: filingDate(filing),
      justification: filing.numeroJustificante,
    });
  }
  return {
    complete: missing.length === 0,
    amount: money(found.reduce((sum, row) => sum + row.amount, 0)),
    negativeComplete: missing.length === 0 && missingNegative.length === 0,
    negativeAmount: money(Math.max(0, found.reduce((sum, row) => sum + row.negativeGenerated - row.negativeApplied, 0))),
    filings: found,
    missing: unique(missing),
    missingNegative: unique(missingNegative),
  };
}

function previousPeriod(year: number, period: string) {
  period = normalizedPeriod(period);
  const monthly = /^\d{2}$/.test(period);
  const periods = periodsForStyle(monthly);
  const index = periods.indexOf(period);
  if (index > 0) return { year, period: periods[index - 1] };
  return { year: year - 1, period: periods[periods.length - 1] };
}

function previousIndirectBalanceFromFilings(data: any, model: '303'|'420'|'417') {
  const previous = previousPeriod(Number(data.year), clean(data.period));
  const filing = latestFiling(data.filings || [], model, previous.year, previous.period);
  if (!filing) return { complete: false, amount: 0, previous, filing: null, reason: `Falta importar o confirmar el modelo ${model} ${previous.period} ${previous.year}.` };
  const boxes = boxMap(filing.casillasPresentadas);
  const result = money(Object.prototype.hasOwnProperty.call(boxes, '71') ? boxes['71'] : Object.prototype.hasOwnProperty.call(boxes, '45') ? boxes['45'] : filing.importeFinal);
  const disposition = clean(filing.resultadoDestino);
  if (model !== '303') {
    if (result < 0 && !['a_compensar','a_devolver'].includes(disposition)) return { complete: false, amount: 0, previous, filing, reason: `El modelo ${model} anterior es negativo, pero no consta si se compensó o se solicitó devolución.` };
    return { complete: true, amount: disposition === 'a_compensar' ? Math.abs(result) : 0, previous, filing, disposition, components: { previousPending: 0, generated: disposition === 'a_compensar' ? Math.abs(result) : 0 } };
  }
  const has87 = Object.prototype.hasOwnProperty.call(boxes, '87');
  const has110 = Object.prototype.hasOwnProperty.call(boxes, '110');
  const has78 = Object.prototype.hasOwnProperty.call(boxes, '78');
  const previousPending = has87 ? Math.max(0, money(boxes['87'])) : has110 && has78 ? Math.max(0, money(boxes['110']) - money(boxes['78'])) : null;
  if (previousPending === null) return { complete: false, amount: 0, previous, filing, reason: 'El modelo 303 anterior no contiene las casillas 87 o 110/78 necesarias para reconstruir la cartera de cuotas.' };
  if (result < 0 && !['a_compensar','a_devolver'].includes(disposition)) return { complete: false, amount: 0, previous, filing, reason: 'El modelo 303 anterior es negativo, pero no consta si el resultado quedó a compensar o se solicitó devolución.' };
  const generated = disposition === 'a_compensar' ? Math.abs(result) : 0;
  return { complete: true, amount: money(previousPending + generated), previous, filing, disposition, components: { previousPending: money(previousPending), generated: money(generated) } };
}

function inRange(item: any, start: string, end: string) {
  const date = dateOf(item).slice(0, 10);
  return !!date && date >= start && date <= end;
}

function invoiceCounterparty(invoice: any) {
  const received = invoice.tipo === 'recibida';
  return {
    id: clean(received ? invoice.proveedor_nif : invoice.cliente_nif),
    name: clean(received ? invoice.proveedor_nombre : invoice.cliente_nombre),
    province: clean(received ? invoice.proveedor_provincia : invoice.cliente_provincia),
    country: clean(received ? invoice.proveedor_pais : invoice.cliente_pais) || 'ES',
  };
}

const PROVINCE_CODES: Record<string, string> = {
  ALAVA:'01',ARABA:'01',ALBACETE:'02',ALICANTE:'03',ALACANT:'03',ALMERIA:'04',AVILA:'05',BADAJOZ:'06',BALEARES:'07','ILLES BALEARS':'07',BARCELONA:'08',BURGOS:'09',CACERES:'10',CADIZ:'11',CASTELLON:'12',CASTELLO:'12','CIUDAD REAL':'13',CORDOBA:'14','A CORUNA':'15',CORUNA:'15',CUENCA:'16',GIRONA:'17',GRANADA:'18',GUADALAJARA:'19',GUIPUZCOA:'20',GIPUZKOA:'20',HUELVA:'21',HUESCA:'22',JAEN:'23',LEON:'24',LLEIDA:'25','LA RIOJA':'26',RIOJA:'26',LUGO:'27',MADRID:'28',MALAGA:'29',MURCIA:'30',NAVARRA:'31',OURENSE:'32',ASTURIAS:'33',PALENCIA:'34','LAS PALMAS':'35',PALMAS:'35',PONTEVEDRA:'36',SALAMANCA:'37','SANTA CRUZ DE TENERIFE':'38','S C TENERIFE':'38',TENERIFE:'38',CANTABRIA:'39',SEGOVIA:'40',SEVILLA:'41',SORIA:'42',TARRAGONA:'43',TERUEL:'44',TOLEDO:'45',VALENCIA:'46',VALLADOLID:'47',VIZCAYA:'48',BIZKAIA:'48',ZAMORA:'49',ZARAGOZA:'50',CEUTA:'51',MELILLA:'52','ISLA DE LA PALMA':'53','LA PALMA':'53',
};

function canonical(value: unknown) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedCountry(value: unknown) {
  const code = canonical(value);
  if (!code || ['ES', 'ESPANA', 'SPAIN'].includes(code)) return 'ES';
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

function provinceCode(value: unknown) {
  const code = canonical(value);
  if (/^\d{2}$/.test(code)) return code;
  return PROVINCE_CODES[code] || '';
}

function validSpanishTaxId(value: unknown) {
  return /^[A-Z0-9]{9}$/.test(canonical(value).replace(/\s/g, ''));
}

function normalizedTaxLines(invoices: any[], taxLines: any[], warnings: string[], blockers: string[]) {
  const byInvoice = new Map<string, any[]>();
  taxLines.forEach(line => byInvoice.set(line.invoiceId, [...(byInvoice.get(line.invoiceId) || []), line]));
  const result: any[] = [];
  let fallbackCount = 0;
  let pendingFallbackCount = 0;
  for (const invoice of invoices) {
    if (invoice.anulada) continue;
    const lines = byInvoice.get(invoice.id) || [];
    if (lines.length) {
      for (const line of lines) result.push({ ...line, invoice, sourceId: `InvoiceTaxLine:${line.id}`, date: dateOf(line) || dateOf(invoice) });
      continue;
    }
    const kind = clean(invoice.indirect_tax_kind || '').toLowerCase();
    const treatment = clean(invoice.fiscal_treatment || 'subject_taxed');
    result.push({
      invoice,
      sourceId: `Invoice:${invoice.id}`,
      date: dateOf(invoice),
      taxKind: kind || (invoice.tipo_iva != null ? 'iva' : 'no_aplica'),
      rate: Number(invoice.tipo_iva || 0),
      base: money(invoice.base_imponible),
      quota: money(invoice.cuota_iva),
      deductibleQuota: money(invoice.deductible_tax_amount ?? invoice.cuota_iva),
      nonDeductibleQuota: money(invoice.non_deductible_tax_amount),
      regime: clean(invoice.fiscal_treatment || 'general'),
      operationType: treatment,
      exemptionKey: clean(invoice.fiscal_exemption_key),
      legalBasis: clean(invoice.fiscal_legal_basis),
      reviewStatus: invoice.fiscal_review_status === 'validado' ? 'validado' : 'pendiente_revision',
      fallback: true,
    });
    fallbackCount += 1;
    if (invoice.fiscal_review_status !== 'validado') pendingFallbackCount += 1;
  }
  if (fallbackCount) warnings.push(`${fallbackCount} factura(s) usan temporalmente la cabecera porque no tienen líneas fiscales normalizadas.`);
  if (pendingFallbackCount) warnings.push(`${pendingFallbackCount} factura(s) sin líneas fiscales normalizadas siguen pendientes de revisión; aparecerán como recomendación en los modelos IVA/IGIC afectados.`);
  return result;
}

function addField(fields: any[], code: string, label: string, value: unknown, sourceIds: string[] = [], section = '', metadata: any = {}) {
  fields.push({ code, label, value: money(value), sourceIds: unique(sourceIds), section, ...metadata });
}

function traceSource(sourceId: string, data: any, indexes: any) {
  const separator = sourceId.indexOf(':');
  const type = separator >= 0 ? sourceId.slice(0, separator) : sourceId;
  const id = separator >= 0 ? sourceId.slice(separator + 1) : '';
  const invoices = indexes.invoices;
  const entries = indexes.entries;
  const invoiceSummary = (invoice: any) => {
    if (!invoice) return {};
    const counterparty = invoiceCounterparty(invoice);
    return {
      invoiceId: invoice.id,
      invoiceNumber: clean(invoice.numero_factura) || invoice.id,
      invoiceType: invoice.tipo,
      counterparty: counterparty.name,
      taxId: counterparty.id,
      concept: clean(invoice.concepto),
      date: clean(dateOf(invoice)).slice(0, 10),
      base: money(invoice.base_imponible),
      tax: money(invoice.cuota_iva),
      withholding: money(retentionAmount(invoice)),
      total: money(invoice.total_factura),
    };
  };
  if (type === 'Invoice') {
    const invoice = invoices.get(id);
    if (!invoice) return null;
    const summary = invoiceSummary(invoice);
    return { sourceId, type, id, title: `Factura ${summary.invoiceNumber}`, subtitle: summary.counterparty || summary.concept || summary.invoiceType, ...summary };
  }
  if (type === 'InvoiceTaxLine') {
    const line = indexes.taxLines.get(id) || indexes.taxLines.get(sourceId);
    if (!line) return null;
    const invoice = line.invoice || invoices.get(line.invoiceId);
    const summary = invoiceSummary(invoice);
    return {
      sourceId, type, id,
      title: `Factura ${summary.invoiceNumber || line.invoiceId || id} · línea fiscal ${line.lineNumber || ''}`.trim(),
      subtitle: summary.counterparty || clean(line.operationType || line.regime),
      ...summary,
      operationDate: clean(line.date || line.operationDate).slice(0, 10),
      taxKind: clean(line.taxKind), operationType: clean(line.operationType), regime: clean(line.regime), rate: Number(line.rate || 0),
      base: money(line.base), tax: money(line.quota), deductibleTax: money(line.deductibleQuota), nonDeductibleTax: money(line.nonDeductibleQuota),
    };
  }
  if (type === 'InvoicePayment') {
    const payment = indexes.invoicePayments.get(id);
    if (!payment) return null;
    const invoice = invoices.get(payment.invoice_id);
    const summary = invoiceSummary(invoice);
    return {
      sourceId, type, id, title: `Pago ${summary.invoiceNumber || payment.reference || id}`,
      subtitle: summary.counterparty || clean(payment.method), ...summary,
      date: clean(payment.payment_date).slice(0, 10), amount: money(payment.amount), method: clean(payment.method), reference: clean(payment.reference), origin: clean(payment.origin),
    };
  }
  if (type === 'PayrollExtraction') {
    const payroll = indexes.payrolls.get(id);
    if (!payroll) return null;
    return {
      sourceId, type, id, title: `Nómina ${clean(payroll.employee_name) || id}`, subtitle: clean(payroll.period_label),
      date: clean(dateOf(payroll)).slice(0, 10), counterparty: clean(payroll.employee_name), taxId: clean(payroll.employee_tax_id),
      base: money(payroll.total_accruals ?? payroll.gross_salary), withholding: money(payroll.irpf_amount), amount: money(payroll.net_pay),
    };
  }
  if (type === 'JournalEntryLine') {
    const line = indexes.entryLines.get(id);
    if (!line) return null;
    const entry = entries.get(line.journalEntryId);
    const invoice = indexes.invoiceByEntry.get(line.journalEntryId) || invoices.get(line.documentId) || invoices.get(entry?.documentId);
    const summary = invoiceSummary(invoice);
    return {
      sourceId, type, id, title: `Asiento ${clean(entry?.entryNumber || line.asientoNumero) || line.journalEntryId || id} · ${clean(line.accountCode || line.subcuenta)}`,
      subtitle: clean(line.accountName || line.nombreSubcuenta || line.description || entry?.description),
      ...summary,
      date: clean(line.entryDate || entry?.date).slice(0, 10), entryId: line.journalEntryId, entryNumber: clean(entry?.entryNumber || line.asientoNumero),
      accountCode: clean(line.accountCode || line.subcuenta), accountName: clean(line.accountName || line.nombreSubcuenta), debit: money(line.debit ?? line.debeE), credit: money(line.credit ?? line.haberE),
    };
  }
  if (type === 'TaxFiling') {
    const filing = indexes.filings.get(id);
    if (!filing) return null;
    return {
      sourceId, type, id, title: `Modelo ${clean(filing.modeloCodigo)} presentado`, subtitle: `${normalizedPeriod(filing.periodo)} ${Number(filing.ejercicio) || ''}`.trim(),
      date: clean(filingDate(filing)).slice(0, 10), modelCode: clean(filing.modeloCodigo), period: normalizedPeriod(filing.periodo), year: Number(filing.ejercicio) || null,
      amount: money(filing.importeFinal), status: clean(filing.estadoPresentacion), justificationNumber: clean(filing.numeroJustificante),
    };
  }
  if (type === 'TaxDeclarableRecord') {
    const record = indexes.declarables.get(id);
    if (!record) return null;
    const payload = record.payload || {};
    return {
      sourceId, type, id, title: `Registro manual modelo ${clean(record.modeloCodigo)}`,
      subtitle: clean(payload.recipientName || payload.operatorName || payload.relatedPartyName || record.recordKey),
      date: clean(payload.paymentDate || payload.operationDate).slice(0, 10),
      counterparty: clean(payload.recipientName || payload.operatorName || payload.relatedPartyName),
      taxId: clean(payload.recipientTaxId || payload.operatorTaxId || payload.relatedPartyTaxId),
      base: money(payload.withholdingBase || payload.amount || payload.netAmount),
      withholding: money(payload.withholdingAmount), amount: money(payload.accruedAmount || payload.amount || payload.netAmount),
      reviewStatus: clean(record.reviewStatus), manual: true,
    };
  }
  if (type === 'ManualAdjustment') {
    return { sourceId, type, id, title: 'Ajuste manual', subtitle: id.replace(/([A-Z])/g, ' $1').trim(), amount: money(data.adjustments?.[id]), manual: true };
  }
  return null;
}

function traceField(field: any, data: any, pageInput: unknown, pageSizeInput: unknown) {
  const sourceIds = unique((field?.sourceIds || []).map(clean).filter(Boolean));
  const indexes:any={
    invoices:new Map((data.invoices||[]).map((item:any)=>[item.id,item])),
    taxLines:new Map(),invoicePayments:new Map((data.invoicePayments||[]).map((item:any)=>[item.id,item])),payrolls:new Map((data.payrolls||[]).map((item:any)=>[item.id,item])),
    entries:new Map((data.entries||[]).map((item:any)=>[item.id,item])),entryLines:new Map((data.entryLines||[]).map((item:any)=>[item.id,item])),filings:new Map((data.filings||[]).map((item:any)=>[item.id,item])),declarables:new Map((data.declarables||[]).map((item:any)=>[item.id,item])),invoiceByEntry:new Map(),
  };
  for(const item of data.taxLines||[]){if(item.id) indexes.taxLines.set(item.id,item);if(item.sourceId) indexes.taxLines.set(item.sourceId,item);}
  for(const invoice of data.invoices||[]) if(invoice.linked_journal_entry_id) indexes.invoiceByEntry.set(invoice.linked_journal_entry_id,invoice);
  const resolved = sourceIds.map(sourceId => traceSource(sourceId, data, indexes));
  const sources = resolved.filter(Boolean) as any[];
  const unresolvedIds = sourceIds.filter((_sourceId, index) => !resolved[index]);
  const pageSize = Math.max(1, Math.min(100, Number(pageSizeInput) || 25));
  const totalPages = Math.max(1, Math.ceil(sources.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(pageInput) || 1));
  const start = (page - 1) * pageSize;
  const groups = sources.reduce((result: Record<string, number>, item: any) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {});
  return {
    field: { code: field.code, label: field.label, section: field.section || '', value: money(field.value), formula: clean(field.formula), dependsOn: Array.isArray(field.dependsOn) ? field.dependsOn : [] },
    sources: sources.slice(start, start + pageSize), total: sources.length, sourceCount: sourceIds.length, unresolvedCount: unresolvedIds.length, unresolvedIds,
    groups, page, pageSize, totalPages,
    totals: {
      base: money(sources.reduce((sum: number, item: any) => sum + money(item.base), 0)),
      tax: money(sources.reduce((sum: number, item: any) => sum + money(item.tax), 0)),
      withholding: money(sources.reduce((sum: number, item: any) => sum + money(item.withholding), 0)),
      amount: money(sources.reduce((sum: number, item: any) => sum + money(item.amount), 0)),
      debit: money(sources.reduce((sum: number, item: any) => sum + money(item.debit), 0)),
      credit: money(sources.reduce((sum: number, item: any) => sum + money(item.credit), 0)),
    },
  };
}

function retentionAmount(invoice: any) {
  return money(invoice.importe_retencion || money(invoice.base_imponible) * Number(invoice.retencion_irpf || 0) / 100);
}

function invoicePayable(invoice: any) {
  return Math.abs(money(invoice.total_factura)) || Math.abs(money(invoice.base_imponible) + money(invoice.cuota_iva) - retentionAmount(invoice));
}

function allocatedInvoicePayments(invoice: any, payments: any[], forcedRecognitionDate = '') {
  const payable = invoicePayable(invoice);
  if (!payable) return [];
  const ordered = [...payments]
    .filter((payment: any) => clean(payment.payment_date || dateOf(payment)).slice(0, 10))
    .sort((a: any, b: any) => `${dateOf(a).slice(0, 10)}|${a.id || ''}`.localeCompare(`${dateOf(b).slice(0, 10)}|${b.id || ''}`));
  const events: any[] = [];
  let remainingFactor = 1;
  for (const payment of ordered) {
    const paymentDate = dateOf(payment).slice(0, 10);
    if (forcedRecognitionDate && paymentDate > forcedRecognitionDate) continue;
    const requestedFactor = Math.abs(money(payment.amount)) / payable;
    const factor = Math.max(0, Math.min(remainingFactor, requestedFactor));
    if (factor <= 0) continue;
    events.push({ date: paymentDate, factor, sourceIds: [`InvoicePayment:${payment.id}`], type: 'payment' });
    remainingFactor = Math.max(0, remainingFactor - factor);
    if (remainingFactor <= 0.0000001) break;
  }
  if (forcedRecognitionDate && remainingFactor > 0.0000001) events.push({ date: forcedRecognitionDate, factor: remainingFactor, sourceIds: [`Invoice:${invoice.id}`], type: 'forced_deadline' });
  return events;
}

function cashTaxLineForPeriod(line: any, data: any, selectedBounds: any) {
  const invoice = line.invoice;
  const operationDate = clean(line.date || dateOf(invoice)).slice(0, 10);
  const operationYear = Number(operationDate.slice(0, 4));
  if (!invoice?.id || !operationYear) return { line: null, review: { sourceId: line.sourceId, invoiceId: invoice?.id, reason: 'Falta la fecha de realización necesaria para aplicar el límite del criterio de caja.' } };
  const forcedRecognitionDate = `${operationYear + 1}-12-31`;
  const payments = (data.invoicePayments || []).filter((payment: any) => payment.invoice_id === invoice.id);
  let events = allocatedInvoicePayments(invoice, payments, forcedRecognitionDate);
  if (!payments.length && invoice.ultimo_pago_at && ['cobrada', 'parcial'].includes(clean(invoice.estado_cobro))) {
    const fallbackDate = clean(invoice.ultimo_pago_at).slice(0, 10);
    const fallbackAmount = Math.abs(money(invoice.importe_pagado)) || (invoice.estado_cobro === 'cobrada' ? invoicePayable(invoice) : 0);
    const factor = invoicePayable(invoice) ? Math.min(1, fallbackAmount / invoicePayable(invoice)) : 0;
    events = factor > 0 ? [{ date: fallbackDate, factor, sourceIds: [`Invoice:${invoice.id}`], type: 'payment_fallback' }] : [];
    if (factor < 1) events.push({ date: forcedRecognitionDate, factor: Math.max(0, 1 - factor), sourceIds: [`Invoice:${invoice.id}`], type: 'forced_deadline' });
    data.warnings.push(`La factura ${clean(invoice.numero_factura) || invoice.id} en criterio de caja usa ultimo_pago_at/importe_pagado porque no tiene movimientos InvoicePayment trazados.`);
  }
  const selectedEvents = events.filter((event: any) => event.date >= selectedBounds.start && event.date <= selectedBounds.end);
  const factor = selectedEvents.reduce((sum: number, event: any) => sum + event.factor, 0);
  if (factor <= 0) return { line: null, deferred: { sourceId: line.sourceId, invoiceId: invoice.id, operationDate, forcedRecognitionDate } };
  const deductibleQuota = money(line.deductibleQuota ?? line.quota);
  return {
    line: {
      ...line,
      base: money(money(line.base) * factor),
      quota: money(money(line.quota) * factor),
      deductibleQuota: money(deductibleQuota * factor),
      nonDeductibleQuota: money(money(line.nonDeductibleQuota) * factor),
      fiscalSourceIds: unique([line.sourceId, ...selectedEvents.flatMap((event: any) => event.sourceIds)]),
      cashRecognition: { factor, events: selectedEvents, operationDate, forcedRecognitionDate },
    },
    review: null,
  };
}

function retainedPaymentEvents(data: any, periodBounds: any) {
  const paymentsByInvoice = new Map<string, any[]>();
  for (const payment of data.invoicePayments || []) {
    paymentsByInvoice.set(payment.invoice_id, [...(paymentsByInvoice.get(payment.invoice_id) || []), payment]);
  }
  const events: any[] = [];
  let missingPaymentTrace = 0;
  for (const invoice of data.invoices.filter((item: any) => !item.anulada && item.tipo === 'recibida' && retentionAmount(item) !== 0)) {
    const payments = paymentsByInvoice.get(invoice.id) || [];
    const allocated = allocatedInvoicePayments(invoice, payments).filter((event: any) => event.date >= periodBounds.start && event.date <= periodBounds.end);
    let factor = allocated.reduce((sum: number, event: any) => sum + event.factor, 0);
    let sourceIds: string[] = allocated.flatMap((event: any) => event.sourceIds);
    if (!payments.length && invoice.estado_cobro === 'cobrada' && invoice.ultimo_pago_at && inRange({ date: invoice.ultimo_pago_at }, periodBounds.start, periodBounds.end)) {
      factor = 1;
      sourceIds = [`Invoice:${invoice.id}`];
      data.warnings.push(`La factura ${clean(invoice.numero_factura) || invoice.id} usa ultimo_pago_at porque no tiene detalle InvoicePayment.`);
    } else if (!payments.length && ['cobrada', 'parcial'].includes(clean(invoice.estado_cobro)) && !invoice.ultimo_pago_at) {
      missingPaymentTrace += 1;
    }
    if (factor > 0) events.push({ invoice, factor, sourceIds, base: money(money(invoice.base_imponible) * factor), withholding: money(retentionAmount(invoice) * factor) });
  }
  if (missingPaymentTrace) data.blockers.push(`${missingPaymentTrace} factura(s) con retención constan pagadas total o parcialmente, pero no tienen fecha de pago trazada; no se han incluido automáticamente.`);
  return events;
}

function supportedWithholdingEvents(data: any, periodBounds: any) {
  const paymentsByInvoice = new Map<string, any[]>();
  for (const payment of data.invoicePayments || []) {
    paymentsByInvoice.set(payment.invoice_id, [...(paymentsByInvoice.get(payment.invoice_id) || []), payment]);
  }
  const events: any[] = [];
  for (const invoice of (data.invoices || []).filter((item: any) => item.tipo === 'emitida' && retentionAmount(item) !== 0 && !item.anulada)) {
    let payments = paymentsByInvoice.get(invoice.id) || [];
    if (!payments.length) {
      const fallbackDate = clean(invoice.ultimo_pago_at || invoice.fecha_cobro || invoice.fecha_pago).slice(0, 10);
      const fallbackAmount = money(invoice.importe_pagado || invoice.importe_cobrado || invoicePayable(invoice));
      if (fallbackDate && fallbackAmount) payments = [{ id: `fallback-${invoice.id}`, invoice_id: invoice.id, amount: fallbackAmount, payment_date: fallbackDate, inferred: true }];
    }
    const selected = allocatedInvoicePayments(invoice, payments).filter((event: any) => event.date >= periodBounds.cumulativeStart && event.date <= periodBounds.end);
    const factor = selected.reduce((sum: number, event: any) => sum + event.factor, 0);
    if (factor > 0) {
      events.push({
        invoice,
        factor,
        withholding: money(retentionAmount(invoice) * factor),
        sourceIds: unique([`Invoice:${invoice.id}`, ...selected.flatMap((event: any) => event.sourceIds || [])]),
        paymentDates: selected.map((event: any) => event.date),
      });
      continue;
    }
    const paidState = canonical(invoice.estado_cobro || invoice.estado).replace(/\s/g, '_');
    if (['PAGADA', 'COBRADA', 'PAGADO', 'COBRADO', 'PARCIAL', 'PARCIALMENTE_PAGADA', 'PARCIALMENTE_COBRADA'].includes(paidState) && !payments.length) {
      data.warnings.push(`La factura emitida ${invoice.numero_factura || invoice.id} tiene retención y figura cobrada, pero no conserva fecha/importe de cobro. No se ha llevado automáticamente a la casilla 06 del modelo 130.`);
    }
  }
  return events;
}

function calculate111(data: any, b: any) {
  const fields: any[] = [];
  const payrolls = data.payrolls.filter((p: any) => inRange(p, b.start, b.end));
  const payments = retainedPaymentEvents(data, b);
  const professional = payments.filter((event: any) => event.invoice.categoria_gasto === 'servicios_profesionales');
  const unknown = payments.filter((event: any) => !['servicios_profesionales', 'alquiler', 'gastos_financieros'].includes(event.invoice.categoria_gasto));
  const payrollBase = payrolls.reduce((s: number, p: any) => s + money(p.total_accruals ?? p.gross_salary), 0);
  const payrollTax = payrolls.reduce((s: number, p: any) => s + money(p.irpf_amount), 0);
  const proBase = professional.reduce((s: number, event: any) => s + event.base, 0);
  const proTax = professional.reduce((s: number, event: any) => s + event.withholding, 0);
  if (unknown.length) data.blockers.push(`${unknown.length} factura(s) con retención sin clasificar como profesional, alquiler o capital mobiliario.`);
  const payrollIds = payrolls.map((p: any) => `PayrollExtraction:${p.id}`);
  const proIds = professional.flatMap((event: any) => event.sourceIds);
  addField(fields, '01', 'Perceptores rendimientos del trabajo dinerarios', unique(payrolls.map((p: any) => p.employee_tax_id || p.employee_name)).length, payrollIds, 'Trabajo');
  addField(fields, '02', 'Importe rendimientos del trabajo dinerarios', payrollBase, payrollIds, 'Trabajo');
  addField(fields, '03', 'Retenciones rendimientos del trabajo', payrollTax, payrollIds, 'Trabajo');
  addField(fields, '07', 'Perceptores actividades económicas dinerarias', unique(professional.map((event: any) => invoiceCounterparty(event.invoice).id || invoiceCounterparty(event.invoice).name)).length, proIds, 'Actividades económicas');
  addField(fields, '08', 'Importe actividades económicas dinerarias', proBase, proIds, 'Actividades económicas');
  addField(fields, '09', 'Retenciones actividades económicas', proTax, proIds, 'Actividades económicas');
  addField(fields, '28', 'Total retenciones e ingresos a cuenta', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  addField(fields, '30', 'Resultado a ingresar', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  if (payrolls.some((p: any) => p.confidence_global < 80 && !p.corrected_by_user)) data.blockers.push('Hay nóminas con confianza OCR inferior al 80% sin corrección validada.');
  if (payrolls.some((p: any) => !clean(p.payment_date))) data.warnings.push('Hay nóminas sin fecha de pago acreditada. Se ha usado el período de nómina como aproximación; confirma el pago antes de presentar el modelo 111.');
  if (data.payrolls.some((p: any) => !dateOf(p))) data.blockers.push('Hay nóminas sin periodo normalizado; no se han podido asignar con seguridad al modelo 111.');
  return { fields, result: money(payrollTax + proTax), details: [...payrolls.map((p: any) => ({ type: 'nómina', id: p.id, name: p.employee_name, base: money(p.total_accruals ?? p.gross_salary), withholding: money(p.irpf_amount) })), ...professional.map((event: any) => ({ type: 'factura profesional pagada', id: event.invoice.id, name: invoiceCounterparty(event.invoice).name, base: event.base, withholding: event.withholding, paymentSources: event.sourceIds }))] };
}

function calculateSimpleRetention(data: any, b: any, model: '115' | '123') {
  const category = model === '115' ? 'alquiler' : 'gastos_financieros';
  const events = retainedPaymentEvents(data, b).filter((event: any) => event.invoice.categoria_gasto === category);
  const ids = events.flatMap((event: any) => event.sourceIds);
  const base = events.reduce((sum: number, event: any) => sum + event.base, 0);
  const tax = events.reduce((sum: number, event: any) => sum + event.withholding, 0);
  const payees = unique(events.map((event: any) => invoiceCounterparty(event.invoice).id || invoiceCounterparty(event.invoice).name)).length;
  const fields: any[] = [];
  if (model === '115') {
    addField(fields, '01', 'Número de perceptores', payees, ids, 'Retenciones');
    addField(fields, '02', 'Base de retenciones', base, ids, 'Retenciones');
    addField(fields, '03', 'Retenciones e ingresos a cuenta', tax, ids, 'Retenciones');
    addField(fields, '05', 'Resultado a ingresar', tax, ids, 'Liquidación');
  } else {
    addField(fields, '03', 'Número total de rentas', payees, ids, 'Rentas');
    addField(fields, '06', 'Base total de retenciones', base, ids, 'Rentas');
    addField(fields, '09', 'Retenciones totales', tax, ids, 'Rentas');
    addField(fields, '12', 'Retenciones más regularización', tax, ids, 'Liquidación');
    addField(fields, '14', 'Resultado a ingresar', tax, ids, 'Liquidación');
  }
  return { fields, result: money(tax), details: events.map((event: any) => ({ type: model === '115' ? 'arrendamiento pagado' : 'capital mobiliario pagado', id: event.invoice.id, name: invoiceCounterparty(event.invoice).name, taxId: invoiceCounterparty(event.invoice).id, base: event.base, withholding: event.withholding, paymentSources: event.sourceIds })) };
}

function calculate130(data: any, b: any, adjustments: any) {
  const validEntryIds = new Set(data.entries.filter((e: any) => e.status === 'confirmado' && e.isBalanced !== false && inRange(e, b.cumulativeStart, b.end)).map((e: any) => e.id));
  const lines = data.entryLines.filter((line: any) => validEntryIds.has(line.journalEntryId));
  const account = (line: any) => clean(line.accountCode || line.subcuenta);
  const revenueLines = lines.filter((line: any) => /^7/.test(account(line)));
  const expenseLines = lines.filter((line: any) => /^6/.test(account(line)));
  const cashMethodRequested = clean(data.profile?.irpfImputationMethod) === 'cash';
  const cashMethodProfileConfirmed = cashMethodRequested && booleanValue(data.profile?.irpfImputationMethodConfirmed);
  const cashMethodEffectiveFrom = clean(data.profile?.irpfCashMethodEffectiveFrom).slice(0, 10);
  const cashMethodConfirmed = cashMethodProfileConfirmed && (!cashMethodEffectiveFrom || cashMethodEffectiveFrom <= b.cumulativeStart);
  const cashEvents: any[] = [];
  if (cashMethodConfirmed) {
    const paymentsByInvoice = new Map<string, any[]>();
    for (const payment of data.invoicePayments || []) paymentsByInvoice.set(payment.invoice_id, [...(paymentsByInvoice.get(payment.invoice_id) || []), payment]);
    for (const invoice of (data.invoices || []).filter((item: any) => !item.anulada && ['emitida', 'recibida'].includes(item.tipo))) {
      let payments = paymentsByInvoice.get(invoice.id) || [];
      if (!payments.length) {
        const fallbackDate = clean(invoice.ultimo_pago_at || invoice.fecha_cobro || invoice.fecha_pago).slice(0, 10);
        const fallbackAmount = Math.abs(money(invoice.importe_pagado || invoice.importe_cobrado || 0));
        if (fallbackDate && fallbackAmount) payments = [{ id: `fallback-${invoice.id}`, invoice_id: invoice.id, amount: fallbackAmount, payment_date: fallbackDate, inferred: true }];
      }
      const selected = allocatedInvoicePayments(invoice, payments).filter((event: any) => event.date >= b.cumulativeStart && event.date <= b.end);
      const factor = selected.reduce((sum: number, event: any) => sum + event.factor, 0);
      if (factor <= 0) continue;
      const base = money(money(invoice.base_imponible) * factor);
      cashEvents.push({ invoice, factor, base, paymentDates: selected.map((event: any) => event.date), sourceIds: unique([`Invoice:${invoice.id}`, ...selected.flatMap((event: any) => event.sourceIds || [])]) });
    }
  }
  const accountingRevenue = cashMethodConfirmed
    ? money(cashEvents.filter((event: any) => event.invoice.tipo === 'emitida').reduce((sum: number, event: any) => sum + event.base, 0))
    : money(revenueLines.reduce((s: number, l: any) => s + money(l.credit) - money(l.debit), 0));
  const accountingExpense = cashMethodConfirmed
    ? money(cashEvents.filter((event: any) => event.invoice.tipo === 'recibida').reduce((sum: number, event: any) => sum + event.base, 0))
    : money(expenseLines.reduce((s: number, l: any) => s + money(l.debit) - money(l.credit), 0));
  const additionalComputableIncome = Math.max(0, money(adjustments.additionalComputableIncome));
  const nonComputableAccountingIncome = Math.max(0, money(adjustments.nonComputableAccountingIncome));
  const additionalDeductibleExpenses = Math.max(0, money(adjustments.additionalDeductibleExpenses));
  const nonDeductibleAccountingExpenses = Math.max(0, money(adjustments.nonDeductibleAccountingExpenses));
  const revenue = money(accountingRevenue + additionalComputableIncome - nonComputableAccountingIncome);
  const expenseBeforeSimplified = money(accountingExpense + additionalDeductibleExpenses - nonDeductibleAccountingExpenses);
  const simplifiedRequested = adjustments.applyDifficultJustificationExpenses === true;
  const simplifiedRateInput = Number(adjustments.difficultJustificationRate);
  const simplifiedRate = [5, 10].includes(simplifiedRateInput) ? simplifiedRateInput : 5;
  const simplifiedEligible = data.profile?.irpfEstimation === 'directa_simplificada';
  const difficultJustificationExpenses = simplifiedRequested && simplifiedEligible
    ? money(Math.min(2000, Math.max(0, revenue - expenseBeforeSimplified) * simplifiedRate / 100))
    : 0;
  const expense = money(expenseBeforeSimplified + difficultJustificationExpenses);
  const net = money(revenue - expense);
  const territorialRelief = clean(data.profile?.model130TerritorialRelief || 'none');
  const territorialReliefConfirmed = booleanValue(data.profile?.model130TerritorialReliefConfirmed);
  const laPalmaReliefPeriod = territorialRelief === 'la_palma_2026' && Number(data.year) === 2026 && ['3T', '4T'].includes(clean(data.period));
  const fullTerritorialRelief = territorialReliefConfirmed && (['ceuta', 'melilla'].includes(territorialRelief) || laPalmaReliefPeriod);
  const territorialRatePermitted = fullTerritorialRelief || (territorialReliefConfirmed && territorialRelief === 'mixed');
  const sectionOneRateInput = Number(adjustments.sectionOnePercentage);
  const sectionOneRate = Number.isFinite(sectionOneRateInput) && sectionOneRateInput > 0 ? Math.min(100, sectionOneRateInput) : fullTerritorialRelief ? 8 : 20;
  const agricultureRateInput = Number(adjustments.agriculturePercentage);
  const agricultureRate = Number.isFinite(agricultureRateInput) && agricultureRateInput > 0 ? Math.min(100, agricultureRateInput) : fullTerritorialRelief ? 0.8 : 2;
  const grossPayment = money(Math.max(0, net * sectionOneRate / 100));
  const filedPrevious = previous130FromFilings(data);
  const previousProvided = adjustments.previousPayments !== undefined && adjustments.previousPayments !== null && adjustments.previousPayments !== '';
  const previous = previousProvided ? money(adjustments.previousPayments) : filedPrevious.complete ? filedPrevious.amount : 0;
  const withholdingEvents = supportedWithholdingEvents(data, b);
  const withholdings = money(adjustments.withholdings ?? withholdingEvents.reduce((sum: number, event: any) => sum + event.withholding, 0));
  const preliminary = money(grossPayment - previous - withholdings);
  const agricultureRevenue = money(adjustments.agricultureRevenue);
  const agricultureWithholdings = money(adjustments.agricultureWithholdings);
  const agricultureGrossPayment = money(agricultureRevenue * agricultureRate / 100);
  const agriculturePayment = money(agricultureGrossPayment - agricultureWithholdings);
  const total = money(Math.max(0, preliminary + agriculturePayment));
  const previousYearNetProvided = adjustments.previousYearNetIncome !== undefined && adjustments.previousYearNetIncome !== null && adjustments.previousYearNetIncome !== '';
  const previousYearNet = previousYearNetProvided ? money(adjustments.previousYearNetIncome) : null;
  const automaticReduction = previousYearNet === null ? 0 : previousYearNet <= 9000 ? 100 : previousYearNet <= 10000 ? 75 : previousYearNet <= 11000 ? 50 : previousYearNet <= 12000 ? 25 : 0;
  const manualReductionProvided = adjustments.article110Reduction !== undefined && adjustments.article110Reduction !== null && adjustments.article110Reduction !== '';
  const reduction = Math.max(0, money(manualReductionProvided ? adjustments.article110Reduction : automaticReduction));
  const difference14 = money(total - reduction);
  const priorNegativeProvided = adjustments.priorNegativeResults !== undefined && adjustments.priorNegativeResults !== null && adjustments.priorNegativeResults !== '';
  const priorNegativeAvailable = priorNegativeProvided ? Math.max(0, money(adjustments.priorNegativeResults)) : filedPrevious.negativeComplete ? filedPrevious.negativeAmount : 0;
  const priorNegative = money(Math.min(priorNegativeAvailable, Math.max(0, difference14)));
  const housingRequested = Math.max(0, money(adjustments.housingDeduction));
  const previousHousing = money((filedPrevious.filings || []).reduce((sum: number, filing: any) => sum + money(filing.housing16), 0));
  const mixedSections = Math.abs(net) > 0.009 && Math.abs(agricultureRevenue) > 0.009;
  const housingBaseLimit = mixedSections ? 0 : money(Math.max(0, Math.abs(agricultureRevenue) > 0.009 ? agricultureRevenue : net) * 0.02);
  const housingAnnualRemaining = money(Math.max(0, 660.14 - previousHousing));
  const housing = money(Math.min(housingRequested, Math.max(0, difference14 - priorNegative), housingBaseLimit, housingAnnualRemaining));
  const previousSamePeriodResult = Math.max(0, money(adjustments.previousSamePeriodResult));
  const result = money(difference14 - priorNegative - housing - previousSamePeriodResult);
  const revenueIds = cashMethodConfirmed ? cashEvents.filter((event: any) => event.invoice.tipo === 'emitida').flatMap((event: any) => event.sourceIds) : revenueLines.map((line: any) => `JournalEntryLine:${line.id}`);
  const expenseIds = cashMethodConfirmed ? cashEvents.filter((event: any) => event.invoice.tipo === 'recibida').flatMap((event: any) => event.sourceIds) : expenseLines.map((line: any) => `JournalEntryLine:${line.id}`);
  const revenueAdjustmentIds = ['additionalComputableIncome', 'nonComputableAccountingIncome'].filter((key: string) => adjustments[key] !== undefined && adjustments[key] !== null && adjustments[key] !== '').map((key: string) => `ManualAdjustment:${key}`);
  const expenseAdjustmentIds = ['additionalDeductibleExpenses', 'nonDeductibleAccountingExpenses'].filter((key: string) => adjustments[key] !== undefined && adjustments[key] !== null && adjustments[key] !== '').map((key: string) => `ManualAdjustment:${key}`);
  const simplifiedIds = simplifiedRequested ? ['ManualAdjustment:applyDifficultJustificationExpenses', 'ManualAdjustment:difficultJustificationRate'] : [];
  const revenueFiscalIds = unique([...revenueIds, ...revenueAdjustmentIds]);
  const expenseFiscalIds = unique([...expenseIds, ...expenseAdjustmentIds, ...simplifiedIds]);
  const accountingIds = unique([...revenueFiscalIds, ...expenseFiscalIds]);
  const filingIds = (filedPrevious.filings || []).map((filing: any) => `TaxFiling:${filing.id}`);
  const manualSource = (key: string) => adjustments[key] !== undefined && adjustments[key] !== null && adjustments[key] !== '' ? [`ManualAdjustment:${key}`] : [];
  const previousIds = previousProvided ? ['ManualAdjustment:previousPayments'] : filingIds;
  const withholdingIds = adjustments.withholdings !== undefined && adjustments.withholdings !== null && adjustments.withholdings !== '' ? ['ManualAdjustment:withholdings'] : withholdingEvents.flatMap((event: any) => event.sourceIds);
  const agricultureRevenueIds = manualSource('agricultureRevenue');
  const agricultureWithholdingIds = manualSource('agricultureWithholdings');
  const sectionOneRateIds = manualSource('sectionOnePercentage');
  const agricultureRateIds = manualSource('agriculturePercentage');
  const reductionIds = manualReductionProvided ? manualSource('article110Reduction') : manualSource('previousYearNetIncome');
  const priorNegativeIds = priorNegativeProvided ? ['ManualAdjustment:priorNegativeResults'] : filingIds;
  const housingIds = manualSource('housingDeduction');
  const previousSamePeriodIds = manualSource('previousSamePeriodResult');
  const fields: any[] = [];
  addField(fields, '01', 'Ingresos fiscalmente computables acumulados', revenue, revenueFiscalIds, 'Liquidación', { formula: cashMethodConfirmed ? 'Bases de facturas emitidas reconocidas proporcionalmente por cobros acumulados, más ingresos fiscales adicionales y menos ingresos no computables.' : 'Ingresos contables acumulados de grupo 7, más ingresos fiscales no contabilizados y menos ingresos contables no computables confirmados.', dependsOn: [] });
  addField(fields, '02', 'Gastos fiscalmente deducibles acumulados', expense, expenseFiscalIds, 'Liquidación', { formula: cashMethodConfirmed ? 'Bases de facturas recibidas reconocidas proporcionalmente por pagos acumulados, más deducciones fiscales adicionales, menos gastos no deducibles y los ajustes de estimación simplificada confirmados.' : 'Gastos contables acumulados de grupo 6, más deducciones fiscales adicionales, menos gastos no deducibles y, si se confirma, provisiones y difícil justificación de estimación directa simplificada.', dependsOn: [] });
  addField(fields, '03', 'Rendimiento neto', net, accountingIds, 'Liquidación', { formula: 'Casilla 01 − casilla 02.', dependsOn: ['01', '02'] });
  addField(fields, '04', `${sectionOneRate}% del rendimiento neto`, grossPayment, unique([...accountingIds, ...sectionOneRateIds]), 'Liquidación', { formula: `${sectionOneRate}% de la casilla 03 cuando el rendimiento es positivo. El porcentaje ordinario es 20%; puede ser 8% en los supuestos territoriales legalmente habilitados o uno superior por opción.`, dependsOn: ['03'] });
  addField(fields, '05', 'Pagos fraccionados anteriores', previous, previousIds, 'Liquidación', { formula: previousProvided ? 'Importe confirmado manualmente.' : 'Suma de los pagos fraccionados de modelos 130 anteriores importados.', dependsOn: [] });
  addField(fields, '06', 'Retenciones soportadas acumuladas', withholdings, withholdingIds, 'Liquidación', { formula: adjustments.withholdings !== undefined && adjustments.withholdings !== null && adjustments.withholdings !== '' ? 'Importe confirmado manualmente.' : 'Retenciones correspondientes a cobros totales o parciales acumulados desde el 1 de enero.', dependsOn: [] });
  addField(fields, '07', 'Pago fraccionado previo', preliminary, unique([...accountingIds, ...previousIds, ...withholdingIds]), 'Liquidación', { formula: 'Casilla 04 − casilla 05 − casilla 06.', dependsOn: ['04', '05', '06'] });
  addField(fields, '08', 'Ingresos agrícolas/ganaderos del trimestre', agricultureRevenue, agricultureRevenueIds, 'Liquidación', { formula: 'Importe confirmado manualmente para esta actividad.', dependsOn: [] });
  addField(fields, '09', `${agricultureRate}% de ingresos agrícolas/ganaderos`, agricultureGrossPayment, unique([...agricultureRevenueIds, ...agricultureRateIds]), 'Liquidación', { formula: `${agricultureRate}% de la casilla 08. El porcentaje ordinario es 2%; puede ser 0,8% en los supuestos territoriales legalmente habilitados o uno superior por opción.`, dependsOn: ['08'] });
  addField(fields, '10', 'Retenciones agrícolas/ganaderas', agricultureWithholdings, agricultureWithholdingIds, 'Liquidación', { formula: 'Importe confirmado manualmente.', dependsOn: [] });
  addField(fields, '11', 'Pago previo agrícola/ganadero', agriculturePayment, unique([...agricultureRevenueIds, ...agricultureWithholdingIds]), 'Liquidación', { formula: 'Casilla 09 − casilla 10.', dependsOn: ['09', '10'] });
  addField(fields, '12', 'Suma de pagos previos', total, unique([...accountingIds, ...previousIds, ...withholdingIds, ...agricultureRevenueIds, ...agricultureWithholdingIds]), 'Liquidación', { formula: 'Máximo entre cero y la suma de las casillas 07 y 11.', dependsOn: ['07', '11'] });
  addField(fields, '13', 'Minoración art. 110.3 RIRPF', reduction, reductionIds, 'Liquidación', { formula: manualReductionProvided ? 'Importe distribuido o confirmado manualmente.' : previousYearNetProvided ? '100/75/50/25/0 euros según el rendimiento neto del ejercicio anterior.' : 'Pendiente de informar el rendimiento neto anterior o confirmar manualmente.', dependsOn: [] });
  addField(fields, '14', 'Diferencia', difference14, unique([...accountingIds, ...previousIds, ...withholdingIds, ...agricultureRevenueIds, ...agricultureWithholdingIds, ...reductionIds]), 'Liquidación', { formula: 'Casilla 12 − casilla 13.', dependsOn: ['12', '13'] });
  addField(fields, '15', 'Resultados negativos anteriores', priorNegative, priorNegativeIds, 'Liquidación', { formula: 'Saldo negativo anterior aplicado, limitado por la casilla 14.', dependsOn: ['14'] });
  addField(fields, '16', 'Deducción vivienda habitual', housing, housingIds, 'Liquidación', { formula: 'Importe indicado, limitado al 2% de la magnitud aplicable, al saldo positivo tras la casilla 15 y al límite anual pendiente de 660,14 euros.', dependsOn: ['14', '15'] });
  addField(fields, '17', 'Total', money(difference14-priorNegative-housing), unique([...accountingIds, ...previousIds, ...withholdingIds, ...agricultureRevenueIds, ...agricultureWithholdingIds, ...reductionIds, ...priorNegativeIds, ...housingIds]), 'Liquidación', { formula: 'Casilla 14 − casilla 15 − casilla 16.', dependsOn: ['14', '15', '16'] });
  addField(fields, '18', 'Resultado previo de la misma autoliquidación', previousSamePeriodResult, previousSamePeriodIds, 'Liquidación', { formula: 'Importe positivo ingresado en autoliquidaciones anteriores del mismo ejercicio y período.', dependsOn: [] });
  addField(fields, '19', 'Resultado de la autoliquidación', result, unique([...accountingIds, ...previousIds, ...withholdingIds, ...agricultureRevenueIds, ...agricultureWithholdingIds, ...reductionIds, ...priorNegativeIds, ...housingIds, ...previousSamePeriodIds]), 'Liquidación', { formula: 'Casilla 17 − casilla 18.', dependsOn: ['17', '18'] });
  if (!cashMethodConfirmed && !lines.length) data.blockers.push('No hay asientos confirmados y cuadrados de grupos 6 y 7 para calcular el modelo 130.');
  if (cashMethodConfirmed && !cashEvents.length) data.blockers.push('El perfil tiene confirmado el criterio de cobros y pagos, pero no hay cobros o pagos trazados dentro del acumulado del modelo 130.');
  if (cashMethodRequested && !cashMethodProfileConfirmed) data.warnings.push('El perfil menciona el criterio de cobros y pagos, pero no consta validado. Para evitar cambiar la imputación fiscal por error, el borrador mantiene el devengo.');
  if (cashMethodProfileConfirmed && cashMethodEffectiveFrom > b.cumulativeStart) data.warnings.push(`La opción por cobros y pagos consta efectiva desde ${cashMethodEffectiveFrom}, después del inicio del ejercicio calculado. El borrador mantiene el devengo hasta que se revise la fecha censal; el criterio no puede cambiar dejando ingresos o gastos sin computar o duplicados.`);
  if (cashMethodConfirmed && !clean(data.profile?.irpfCashMethodEffectiveFrom)) data.warnings.push('Falta la fecha de efectos de la opción por cobros y pagos. Confirma la declaración censal y la permanencia mínima de tres años.');
  if (cashMethodConfirmed && !clean(data.profile?.irpfCashMethodMinimumUntil)) data.warnings.push('Falta la fecha mínima de permanencia del criterio de cobros y pagos. Debe controlarse durante al menos tres años.');
  if (cashMethodEffectiveFrom && !/-01-01$/.test(cashMethodEffectiveFrom)) data.warnings.push('La fecha de efectos del criterio de cobros y pagos no coincide con el inicio de un año natural. Revisa la declaración censal y evita un cambio de criterio dentro del ejercicio.');
  if (cashMethodConfirmed && data.profile?.entityType === 'sociedad') data.blockers.push('El criterio de cobros y pagos del artículo 7 RIRPF no corresponde a una sociedad. Revisa el tipo de entidad y el impuesto aplicable.');
  if (cashMethodConfirmed && cashEvents.some((event: any) => !money(event.invoice.base_imponible) && money(event.invoice.total_factura))) data.warnings.push('Hay facturas cobradas o pagadas sin base imponible informada. Se han trazado, pero su base no se ha incorporado automáticamente a las casillas 01/02.');
  if (data.profile?.irpfEstimation === 'objetiva_modulos') data.blockers.push('El perfil está en estimación objetiva: corresponde revisar el modelo 131, no el 130.');
  if (simplifiedRequested && !simplifiedEligible) data.blockers.push('Se ha solicitado el 5%/10% de difícil justificación, pero el perfil no está en estimación directa simplificada. No se ha aplicado.');
  if (simplifiedRequested && simplifiedRate === 10 && !(Number(data.year) === 2026 && territorialReliefConfirmed && territorialRelief === 'ceuta')) data.blockers.push('El 10% de difícil justificación solo se admite para el supuesto territorial especial de Ceuta en 2026 y exige confirmación. Se requiere revisión antes de usarlo.');
  if (simplifiedEligible && adjustments.applyDifficultJustificationExpenses === undefined) data.warnings.push('El perfil está en estimación directa simplificada. Confirma si aplica el gasto de difícil justificación del 5% —o el 10% para Ceuta en 2026—, incompatible con la reducción para determinados autónomos dependientes o con único cliente no vinculado.');
  if (data.profile?.mainTerritory === 'ceuta_melilla' && !territorialReliefConfirmed) data.warnings.push('El domicilio en Ceuta/Melilla no basta para aplicar automáticamente el 8%: confirma el territorio concreto y que las rentas tienen derecho a la deducción. Mientras tanto se mantiene el 20%.');
  if (data.profile?.mainTerritory === 'canarias' && Number(data.year) === 2026 && ['3T', '4T'].includes(clean(data.period)) && !territorialReliefConfirmed) data.warnings.push('En 3T y 4T de 2026 las actividades con derecho en La Palma pueden aplicar el 8%/0,8%. El perfil Canarias no identifica por sí solo la isla ni el derecho: debe confirmarse expresamente.');
  if (territorialRelief === 'la_palma_2026' && territorialReliefConfirmed && !laPalmaReliefPeriod) data.warnings.push('El beneficio territorial de La Palma indicado para el modelo 130 solo afecta al 3T y 4T de 2026; en este período se mantienen los tipos ordinarios.');
  if (territorialRelief === 'mixed' && territorialReliefConfirmed && adjustments.sectionOnePercentage === undefined) data.warnings.push('Hay actividades con y sin derecho al beneficio territorial. Informa el porcentaje efectivo de la casilla 04 después de separar las rentas al 8% y al 20%.');
  if (territorialRelief === 'mixed' && territorialReliefConfirmed && agricultureRevenue !== 0 && adjustments.agriculturePercentage === undefined) data.warnings.push('Hay actividades agrícolas con y sin derecho al beneficio territorial. Informa el porcentaje efectivo de la casilla 09 después de separar los ingresos al 0,8% y al 2%.');
  if (sectionOneRate < 20 && !territorialRatePermitted) data.blockers.push('Se ha indicado un porcentaje inferior al 20% en la casilla 04 sin un beneficio territorial confirmado para Ceuta, Melilla o el 3T/4T de 2026 en La Palma.');
  if (agricultureRate < 2 && !territorialRatePermitted) data.blockers.push('Se ha indicado un porcentaje inferior al 2% en la casilla 09 sin un beneficio territorial confirmado para Ceuta, Melilla o el 3T/4T de 2026 en La Palma.');
  if (!manualReductionProvided && !previousYearNetProvided) data.warnings.push('Falta el rendimiento neto del ejercicio anterior para calcular automáticamente la casilla 13. Confirma ese dato o distribuye manualmente la minoración si también existe modelo 131.');
  if (manualReductionProvided && reduction > 100) data.blockers.push('La minoración manual de la casilla 13 supera 100 euros. Revisa el rendimiento neto anterior y, en su caso, el reparto con el modelo 131.');
  if (['additionalComputableIncome', 'nonComputableAccountingIncome', 'additionalDeductibleExpenses', 'nonDeductibleAccountingExpenses'].every((key: string) => adjustments[key] === undefined)) data.warnings.push('Las cuentas 6 y 7 son el punto de partida contable, pero no prueban por sí solas la deducibilidad fiscal. Confirma los cuatro ajustes de conciliación fiscal, aunque sean cero.');
  if (data.period !== '1T' && !previousProvided && !filedPrevious.complete) data.blockers.push(`Falta importar el modelo 130 presentado de ${filedPrevious.missing.join(', ')} o confirmar manualmente la casilla 05.`);
  if (data.period !== '1T' && !previousProvided && filedPrevious.complete) data.warnings.push(`La casilla 05 se arrastra automáticamente desde ${filedPrevious.filings.map((row: any) => row.period).join(', ')} presentado(s).`);
  if (data.period !== '1T' && !priorNegativeProvided && !filedPrevious.negativeComplete) data.blockers.push(`Falta completar el resultado de modelos 130 anteriores (${filedPrevious.missingNegative.join(', ')}) o confirmar manualmente la casilla 15.`);
  if (data.period !== '1T' && !priorNegativeProvided && filedPrevious.negativeComplete && filedPrevious.negativeAmount) data.warnings.push(`La casilla 15 usa ${filedPrevious.negativeAmount.toFixed(2)} € negativos pendientes de trimestres anteriores, limitada al importe positivo de la casilla 14.`);
  if (priorNegativeAvailable > priorNegative + 0.009) data.warnings.push(`Quedan ${money(priorNegativeAvailable-priorNegative).toFixed(2)} € de resultados negativos anteriores sin aplicar por el límite de la casilla 14.`);
  if (housingRequested > housing + 0.009) data.warnings.push('La deducción por vivienda indicada se ha limitado por el 2%, el saldo positivo, el límite anual pendiente de 660,14 euros o la incompatibilidad de cumplimentar simultáneamente las secciones I y II. Confirma además los requisitos transitorios de vivienda anterior a 2013.');
  return { fields, result, details: [{ type: 'conciliación fiscal acumulada', accountingRevenue, accountingExpense, additionalComputableIncome, nonComputableAccountingIncome, additionalDeductibleExpenses, nonDeductibleAccountingExpenses, difficultJustificationExpenses, difficultJustificationRate: simplifiedRequested ? simplifiedRate : 0, irpfImputationMethod: cashMethodConfirmed ? 'cash' : 'accrual', cashEvents: cashEvents.map((event: any) => ({ invoiceId: event.invoice.id, invoiceType: event.invoice.tipo, base: event.base, factor: event.factor, paymentDates: event.paymentDates })), sectionOneRate, agricultureRate, territorialRelief, territorialReliefConfirmed, withholdingRecognition: adjustments.withholdings !== undefined && adjustments.withholdings !== null && adjustments.withholdings !== '' ? 'manual' : 'cobros_acumulados', previousYearNet, automaticReduction, previousHousing, housingBaseLimit, housingAnnualRemaining, revenue, expense, entries: validEntryIds.size, selectedQuarter: { start: b.start, end: b.end }, cumulativeRange: { start: b.cumulativeStart, end: b.end } }], carryforward: { type: 'irpf_cumulative', previousPaymentsSource: previousProvided ? 'manual' : filedPrevious.complete ? 'filed_returns' : 'missing', priorNegativeSource: priorNegativeProvided ? 'manual' : filedPrevious.negativeComplete ? 'filed_returns' : 'missing', priorNegativeAvailable: money(priorNegativeAvailable), priorNegativeApplied: priorNegative, priorNegativeRemaining: money(Math.max(0, priorNegativeAvailable-priorNegative)), previousFilings: filedPrevious.filings, missingPeriods: filedPrevious.missing, missingNegativePeriods: filedPrevious.missingNegative, rule: `Las casillas 01 y 02 se acumulan desde el 1 de enero hasta el cierre del trimestre. Se ha aplicado ${cashMethodConfirmed ? 'el criterio de cobros y pagos confirmado, con prorrateo por movimientos trazados' : 'el criterio de devengo y la conciliación de contabilidad a fiscalidad'}. La sección agrícola/ganadera usa exclusivamente el trimestre seleccionado. Las retenciones de la sección I se reconocen por cobros acumulados. Los tipos territoriales reducidos solo se automatizan si el derecho consta expresamente confirmado.` } };
}

function calculateIndirectTax(data: any, b: any, kind: 'iva' | 'igic', annual = false, adjustments: any = {}, modelOverride?: '303'|'420'|'417') {
  const selection = selectIndirectTaxLines(data, b, kind, annual, modelOverride);
  const lines = selection.lines;
  const fields: any[] = [];
  const rates = new Map<number, any>();
  const categorizedOutputRates = new Map<string, any>();
  const deductibleRates = new Map<string, any>();
  const sourceIdsOf = (line: any) => unique(Array.isArray(line.fiscalSourceIds) ? line.fiscalSourceIds : [line.sourceId]);
  const addRate = (rate: number, base: number, quota: number, ids: string[]) => {
    const row = rates.get(rate) || { rate, base: 0, quota: 0, sourceIds: [] };
    row.base += base; row.quota += quota; row.sourceIds.push(...ids); rates.set(rate, row);
  };
  const addDeductibleRate = (category: string, rate: number, base: number, quota: number, ids: string[]) => {
    const key = `${category}|${rate}`;
    const row = deductibleRates.get(key) || { category, rate, base: 0, quota: 0, sourceIds: [] };
    row.base += base; row.quota += quota; row.sourceIds.push(...ids); deductibleRates.set(key, row);
  };
  const addCategorizedOutputRate = (category: string, rate: number, base: number, quota: number, ids: string[]) => {
    const key = `${category}|${rate}`;
    const row = categorizedOutputRates.get(key) || { category, rate, base: 0, quota: 0, sourceIds: [] };
    row.base += base; row.quota += quota; row.sourceIds.push(...ids); categorizedOutputRates.set(key, row);
  };
  let deductibleBase = 0, deductibleQuota = 0, nonDeductibleBase = 0, reverseBase = 0, reverseQuota = 0, intraBase = 0, intraQuota = 0;
  let exports = 0, intraSupplies = 0, exemptLimited = 0, nonSubject = 0, criterionCash = 0, criterionCashQuota = 0, criterionCashReceived = 0, criterionCashReceivedQuota = 0;
  let annualClassificationPending = 0;
  let pendingReviewLines = 0;
  for (const line of lines) {
    const invoice = line.invoice;
    const base = money(line.base), quota = money(line.quota), ids = sourceIdsOf(line);
    const op = clean(line.operationType || 'subject_taxed');
    if (invoice.tipo === 'emitida') {
      if (['subject_taxed', 'subject_zero', 'special_margin'].includes(op)) {
        const rate = Number(line.rate || 0);
        addRate(rate, base, quota, ids);
        const regime = clean(line.regime);
        const category = op === 'special_margin' || ['rebu','bienes_usados'].includes(regime) ? 'margin' : regime === 'criterio_caja' ? 'cash' : regime === 'agencias_viajes' ? 'travel' : regime === 'grupo_entidades' ? 'intragroup' : 'ordinary';
        addCategorizedOutputRate(category, rate, base, quota, ids);
      }
      else if (op === 'intra_eu_supply') intraSupplies += base;
      else if (['export', 'exempt_full'].includes(op)) exports += base;
      else if (op === 'exempt_limited') exemptLimited += base;
      else if (['non_subject_article', 'non_subject_location', 'outside_scope'].includes(op)) nonSubject += base;
      else if (op === 'reverse_charge') reverseBase += base;
      if (line.regime === 'criterio_caja') criterionCash += base;
    } else {
      if (op === 'intra_eu_acquisition') { intraBase += base; intraQuota += quota; }
      else if (op === 'reverse_charge') { reverseBase += base; reverseQuota += quota; }
      deductibleBase += base;
      const deductibleLineQuota = money(line.deductibleQuota ?? quota);
      deductibleQuota += deductibleLineQuota;
      const deductibleRatio = Math.abs(quota) > 0.0001 ? Math.max(0, Math.min(1, deductibleLineQuota / quota)) : 0;
      nonDeductibleBase += money(base * (1 - deductibleRatio));
      const explicitCategory = clean(line.deductionCategory);
      const investmentHint = /INMOVILIZADO|ACTIVO FIJO|BIEN(?:ES)? DE INVERSION/.test(canonical(`${invoice.categoria_gasto || ''} ${invoice.concepto || ''}`));
      const investment = explicitCategory.includes('investment') || (!explicitCategory && investmentHint);
      const category = explicitCategory || (op === 'import' ? (investment ? 'import_investment' : 'import_current') : op === 'intra_eu_acquisition' ? (investment ? 'intra_goods_investment' : 'intra_goods_current') : (investment ? 'interior_investment' : 'interior_current'));
      addDeductibleRate(category, Number(line.rate || 0), base, deductibleLineQuota, ids);
      if (annual && !explicitCategory) annualClassificationPending += 1;
      if (line.regime === 'criterio_caja') { criterionCashReceived += base; criterionCashReceivedQuota += deductibleLineQuota; }
    }
    if (invoice.tipo === 'emitida' && line.regime === 'criterio_caja') criterionCashQuota += quota;
    if (line.reviewStatus !== 'validado') pendingReviewLines += 1;
  }
  if (pendingReviewLines) data.blockers.push(`${pendingReviewLines} línea(s) fiscales incluidas tienen su clasificación o deducibilidad pendiente de revisión.`);
  for (const row of [...rates.values()].sort((a, z) => a.rate - z.rate)) addField(fields, `RATE_${row.rate}`, `Base y cuota al ${row.rate}%`, row.quota, row.sourceIds, `Devengado: base ${money(row.base).toFixed(2)} €`);
  const outputQuota = money([...rates.values()].reduce((s, r) => s + r.quota, 0) + intraQuota + reverseQuota);
  const rawResult = money(outputQuota - deductibleQuota);
  const model: '303'|'420'|'417' = modelOverride || (kind === 'iva' ? '303' : '420');
  const historicalBalance = annual ? { complete: true, amount: 0, previous: null, filing: null } : previousIndirectBalanceFromFilings(data, model);
  const manualBalanceProvided = adjustments.previousCompensationBalance !== undefined && adjustments.previousCompensationBalance !== null && adjustments.previousCompensationBalance !== '';
  const previousBalance = annual ? 0 : money(Math.max(0, manualBalanceProvided ? money(adjustments.previousCompensationBalance) : historicalBalance.complete ? historicalBalance.amount : 0));
  const appliedPrevious = annual ? 0 : model === '303' ? money(Math.min(previousBalance, Math.max(0, rawResult))) : previousBalance;
  const previousPending = annual ? 0 : model === '303' ? money(Math.max(0, previousBalance - appliedPrevious)) : 0;
  const result = money(rawResult - appliedPrevious);
  const requestedDisposition = clean(adjustments.resultDisposition);
  const resultDisposition = result > 0 ? 'a_ingresar' : result === 0 ? 'cero' : requestedDisposition;
  const newCompensation = result < 0 && resultDisposition === 'a_compensar' ? Math.abs(result) : 0;
  const nextBalance = money(previousPending + newCompensation);
  const balanceSourceIds = annual ? [] : manualBalanceProvided ? ['ManualAdjustment:previousCompensationBalance'] : historicalBalance.filing ? [`TaxFiling:${historicalBalance.filing.id}`] : [];
  addField(fields, 'DEVENGADO', 'Total cuota devengada', outputQuota, lines.filter((l: any) => l.invoice.tipo === 'emitida' || ['reverse_charge','intra_eu_acquisition'].includes(l.operationType)).flatMap(sourceIdsOf), 'Liquidación');
  addField(fields, 'DEDUCIBLE_BASE', 'Base de cuotas deducibles', deductibleBase, lines.filter((l: any) => l.invoice.tipo === 'recibida').flatMap(sourceIdsOf), 'Deducciones');
  addField(fields, 'DEDUCIBLE', 'Total cuota deducible', deductibleQuota, lines.filter((l: any) => l.invoice.tipo === 'recibida').flatMap(sourceIdsOf), 'Deducciones');
  if (selection.carry.length) addField(fields, 'DEDUCIBLE_ARRASTRADO', 'Cuota recibida tarde deducida en este período', selection.carry.reduce((sum: number, row: any) => sum + money(row.quota), 0), selection.carry.map((row: any) => row.sourceId), 'Deducciones de períodos anteriores');
  if (!annual && model === '303') {
    addField(fields, '110', 'Cuotas a compensar pendientes de períodos anteriores', previousBalance, balanceSourceIds, 'Compensación', { formula: manualBalanceProvided ? 'Saldo anterior confirmado manualmente.' : 'Saldo reconstruido desde el modelo 303 anterior presentado.' });
    addField(fields, '78', 'Cuotas anteriores aplicadas en este período', appliedPrevious, balanceSourceIds, 'Compensación', { formula: 'Menor entre la casilla 110 y el resultado positivo previo a compensaciones.', dependsOn: ['110', 'DEVENGADO', 'DEDUCIBLE'] });
    addField(fields, '87', 'Cuotas anteriores pendientes para períodos posteriores', previousPending, balanceSourceIds, 'Compensación', { formula: 'Casilla 110 − casilla 78.', dependsOn: ['110', '78'] });
  }
  if (!annual && model !== '303') addField(fields, '43', 'Cuotas de períodos anteriores pendientes de compensar', previousBalance, balanceSourceIds, 'Compensación', { formula: manualBalanceProvided ? 'Saldo anterior confirmado manualmente.' : `Saldo reconstruido desde el modelo ${model} anterior presentado.` });
  if (!annual && result < 0 && resultDisposition === 'a_compensar') addField(fields, model === '303' ? '72' : '45_COMPENSAR', 'Resultado generado a compensar', newCompensation, lines.flatMap(sourceIdsOf), 'Compensación', { formula: 'Valor absoluto del resultado negativo que se deja a compensar.', dependsOn: ['RESULTADO'] });
  addField(fields, 'RESULTADO', 'Resultado', result, unique([...lines.flatMap(sourceIdsOf), ...balanceSourceIds]), 'Liquidación', { formula: 'Cuota devengada − cuota deducible − compensación anterior aplicada.', dependsOn: ['DEVENGADO', 'DEDUCIBLE', ...(model === '303' ? ['78'] : ['43'])] });
  if (!annual && !manualBalanceProvided && !historicalBalance.complete) data.blockers.push(`${historicalBalance.reason} Importa el período anterior o confirma manualmente el saldo, incluso si es cero.`);
  if (!annual && result < 0 && !['a_compensar','a_devolver'].includes(resultDisposition)) data.blockers.push('Confirma si el resultado negativo queda a compensar o se solicita a devolver.');
  if (!annual && result < 0 && resultDisposition === 'a_devolver' && !['4T','12'].includes(clean(data.period))) data.blockers.push('La devolución del saldo no se habilita fuera del último período del año salvo supuesto especial revisado.');
  const operations = { rates: [...rates.values()].map(r => ({ ...r, base: money(r.base), quota: money(r.quota) })), categorizedOutputRates: [...categorizedOutputRates.values()].map(r => ({ ...r, base: money(r.base), quota: money(r.quota) })), deductibleRates: [...deductibleRates.values()].map(r => ({ ...r, base: money(r.base), quota: money(r.quota) })), outputQuota, deductibleBase: money(deductibleBase), deductibleQuota: money(deductibleQuota), nonDeductibleBase: money(nonDeductibleBase), rawResult, previousCompensationBalance: previousBalance, appliedPreviousCompensation: appliedPrevious, previousCompensationPending: previousPending, nextCompensationBalance: nextBalance, resultDisposition, reverseBase: money(reverseBase), reverseQuota: money(reverseQuota), intraBase: money(intraBase), intraQuota: money(intraQuota), exports: money(exports), intraSupplies: money(intraSupplies), exemptLimited: money(exemptLimited), nonSubject: money(nonSubject), criterionCash: money(criterionCash), criterionCashQuota: money(criterionCashQuota), criterionCashReceived: money(criterionCashReceived), criterionCashReceivedQuota: money(criterionCashReceivedQuota) };
  if (selection.review.length) data.blockers.push(`${selection.review.length} operación(es) requieren confirmar la fecha de devengo, cobro, pago o deducción antes de presentar.`);
  if (selection.carry.some((row: any) => row.receiptDateInferred)) data.warnings.push('Hay deducciones diferidas asignadas mediante la fecha de alta en Taxea porque no consta la fecha acreditada de recepción. Confírmala antes de presentar.');
  if (annual) {
    if (annualClassificationPending) data.blockers.push(`${annualClassificationPending} línea(s) de IVA soportado no indican todavía si son operaciones corrientes, bienes de inversión, importaciones o adquisiciones intracomunitarias. Taxea las clasifica provisionalmente por sus datos disponibles; revisa el desglose anual antes de presentar.`);
    data.warnings.push('En el resumen anual, el IVA/IGIC devengado sigue el devengo y las cuotas soportadas deben conciliarse con el período efectivo de deducción. Revise los arrastres antes del cierre anual.');
    return { fields, result, details: operations.rates, operations, carryforward: selection };
  }
  return { fields, result, details: lines.map((l: any) => ({ type: l.invoice.tipo, id: l.invoice.id, invoice: l.invoice.numero_factura, operationDate: clean(l.date || dateOf(l.invoice)).slice(0, 10), recognitionDates: l.cashRecognition?.events?.map((event: any) => event.date) || [], recognitionTreatment: l.cashRecognition ? 'criterio_caja' : l.annualDeductionSource || 'devengo', deductionPeriod: l.deductionDecision ? `${l.deductionDecision.targetPeriod} ${l.deductionDecision.targetYear}` : data.period, deductionTreatment: l.deductionDecision?.treatment || (l.cashRecognition ? 'criterio_caja' : 'periodo_corriente'), operationType: l.operationType, rate: l.rate, base: money(l.base), quota: money(l.quota), deductibleQuota: money(l.deductibleQuota) })), operations, carryforward: { ...selection, type: kind === 'iva' ? 'iva_deduction' : 'igic_deduction', balanceSource: manualBalanceProvided ? 'manual' : historicalBalance.complete ? 'filed_return' : 'missing', previousBalance, appliedPrevious, previousPending, newCompensation: money(newCompensation), nextBalance, resultDisposition, previousFiling: historicalBalance.filing ? { id: historicalBalance.filing.id, year: historicalBalance.previous?.year, period: historicalBalance.previous?.period, date: filingDate(historicalBalance.filing), justification: historicalBalance.filing.numeroJustificante } : null } };
}

function thirdPartyOperationDate(invoice: any, model: '347'|'415') {
  if (model === '415') return clean(invoice.fecha_emision || invoice.fecha_operacion || dateOf(invoice)).slice(0, 10);
  if (invoice.tipo === 'recibida') return clean(invoice.fecha_recepcion || invoice.created_date || invoice.fecha_emision || invoice.fecha_operacion || dateOf(invoice)).slice(0, 10);
  return clean(invoice.fecha_emision || invoice.fecha_operacion || dateOf(invoice)).slice(0, 10);
}

function calculateThirdParties(data: any, b: any, model: '347' | '415') {
  const groups = new Map<string, any>();
  const thresholdTotals = new Map<string, number>();
  const missingGroups = new Map<string, number>();
  const paymentsByInvoice = new Map<string, any[]>();
  const allPaymentsByInvoice = new Map<string, any[]>();
  const cashInvoiceIds = new Set((data.taxLines || []).filter((line: any) => clean(line.regime) === 'criterio_caja').map((line: any) => line.invoice?.id || line.invoiceId));
  const cashByTaxId = new Map<string, { amount: number; originYears: Set<string>; sourceIds: string[] }>();
  const declarableRecords = new Map((data.declarables || []).filter((row: any) => row.modeloCodigo === model).map((row: any) => [row.recordKey, row]));
  for (const payment of data.invoicePayments || []) {
    allPaymentsByInvoice.set(payment.invoice_id, [...(allPaymentsByInvoice.get(payment.invoice_id) || []), payment]);
    if (!inRange(payment, b.start, b.end)) continue;
    paymentsByInvoice.set(payment.invoice_id, [...(paymentsByInvoice.get(payment.invoice_id) || []), payment]);
  }
  for (const invoice of data.invoices.filter((item: any) => !item.anulada)) {
    const cp = invoiceCounterparty(invoice);
    if (!cp.id) continue;
    const operation = clean(invoice.fiscal_treatment || invoice.indirect_tax_treatment);
    const separatelyReported = ['alquiler', 'servicios_profesionales', 'gastos_financieros'].includes(invoice.categoria_gasto) && retentionAmount(invoice) !== 0;
    const territoriallyExcluded = ['import', 'export', 'canary_peninsula_goods', 'intra_eu_supply', 'intra_eu_acquisition'].includes(operation);
    if (model === '347' && (separatelyReported || territoriallyExcluded)) continue;
    const normalizedTaxId = canonical(cp.id).replace(/\s/g, '');
    const operationKey = invoice.tipo === 'emitida' ? 'B' : 'A';
    const originYear = thirdPartyOperationDate(invoice, model).slice(0, 4);
    if (!originYear) continue;
    const thresholdKey = `${normalizedTaxId}|${operationKey}|${originYear}`;
    thresholdTotals.set(thresholdKey, money((thresholdTotals.get(thresholdKey) || 0) + money(invoice.total_factura)));
  }
  let excluded347 = 0;
  for (const invoice of data.invoices.filter((f: any) => !f.anulada)) {
    const cashAccounting = cashInvoiceIds.has(invoice.id) || clean(invoice.indirect_tax_regime || invoice.regimen_iva) === 'criterio_caja';
    const operationDate = thirdPartyOperationDate(invoice, model);
    const operationYear = Number(clean(invoice.fecha_operacion || invoice.fecha_emision || dateOf(invoice)).slice(0, 4));
    const cashEvents = cashAccounting && operationYear ? allocatedInvoicePayments(invoice, allPaymentsByInvoice.get(invoice.id) || [], `${operationYear + 1}-12-31`).filter((event: any) => event.date >= b.start && event.date <= b.end) : [];
    const cashFactor = cashEvents.reduce((sum: number, event: any) => sum + event.factor, 0);
    const generalInYear = operationDate >= b.start && operationDate <= b.end;
    if (cashAccounting ? !generalInYear && cashFactor <= 0 : !generalInYear) continue;
    const cp = invoiceCounterparty(invoice);
    const generalAmount = money(generalInYear ? invoice.total_factura : 0);
    const cashAccountingAmount = money(money(invoice.total_factura) * cashFactor);
    const amount = cashAccounting ? generalAmount : money(invoice.total_factura);
    if (!cp.id) {
      const missingKey = cp.name || 'CONTRAPARTE_SIN_IDENTIFICAR';
      const thresholdAmount = cashAccounting ? money(invoice.total_factura) : amount;
      missingGroups.set(missingKey, money((missingGroups.get(missingKey) || 0) + thresholdAmount));
      continue;
    }
    const operation = clean(invoice.fiscal_treatment || invoice.indirect_tax_treatment);
    const separatelyReported = ['alquiler', 'servicios_profesionales', 'gastos_financieros'].includes(invoice.categoria_gasto) && retentionAmount(invoice) !== 0;
    const territoriallyExcluded = ['import', 'export', 'canary_peninsula_goods', 'intra_eu_supply', 'intra_eu_acquisition'].includes(operation);
    if (model === '347' && (separatelyReported || territoriallyExcluded)) { excluded347 += 1; continue; }
    const operationKey = invoice.tipo === 'emitida' ? 'B' : 'A';
    const normalizedTaxId = canonical(cp.id).replace(/\s/g, '');
    const reverseCharge = operation === 'reverse_charge';
    const legalBasis = canonical(`${invoice.fiscal_legal_basis || ''} ${invoice.fiscal_exemption_key || ''}`);
    const exemptArticle13 = model === '415' && ['exempt_full', 'exempt_limited', 'subject_exempt'].includes(operation) && /ART(?:ICULO)?\s*13|LEY\s*20\s*\/\s*1991/.test(legalBasis);
    const groupKey = `${normalizedTaxId}|${operationKey}|C${cashAccounting ? 1 : 0}|I${reverseCharge ? 1 : 0}|E${exemptArticle13 ? 1 : 0}`;
    const thresholdKey = `${normalizedTaxId}|${operationKey}|${operationDate.slice(0, 4)}`;
    const recordKey = `ThirdParty:${groupKey}`;
    const row = groups.get(groupKey) || {
      recordKey, taxId: normalizedTaxId, name: cp.name, country: normalizedCountry(cp.country), province: cp.province,
      provinceCode: provinceCode(cp.province), operationKey, total: 0,
      quarters: { T1: 0, T2: 0, T3: 0, T4: 0 }, rentQuarters: { T1: 0, T2: 0, T3: 0, T4: 0 }, invoices: [],
      sourceFacts: [],
      thresholdKeys: [],
      autoCashAmount: 0, cashAmount: 0, cashYear: '', propertyTransferAmount: 0, propertyRentAmount: 0,
      cashAccounting, cashAccountingAnnualAmount: 0, reverseCharge, exemptArticle13,
    };
    row.total += amount;
    const month = Number(operationDate.slice(5, 7));
    const quarter = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    if (!cashAccounting && generalInYear) row.quarters[quarter] += amount;
    const explicitRent = invoice.categoria_gasto === 'alquiler' || clean(invoice.retencion_tipo) === 'alquiler' || invoice.es_arrendamiento === true;
    if (explicitRent) {
      row.propertyRentAmount += amount;
      if (!cashAccounting && generalInYear) row.rentQuarters[quarter] += amount;
    }
    if (cashAccounting) row.cashAccountingAnnualAmount += cashAccountingAmount;
    if (operationKey === 'B') {
      const cashPayments = (paymentsByInvoice.get(invoice.id) || []).filter((payment: any) => payment.method === 'efectivo');
      if (cashPayments.length) {
        const cash = cashByTaxId.get(normalizedTaxId) || { amount: 0, originYears: new Set<string>(), sourceIds: [] };
        cash.amount += cashPayments.reduce((sum: number, payment: any) => sum + Math.abs(money(payment.amount)), 0);
        cash.originYears.add(dateOf(invoice).slice(0, 4));
        cash.sourceIds.push(...cashPayments.map((payment: any) => `InvoicePayment:${payment.id}`));
        cashByTaxId.set(normalizedTaxId, cash);
      }
    }
    row.sourceFacts.push(`${invoice.id}:${operationDate}:${money(amount)}:${money(cashAccountingAmount)}:${invoice.categoria_gasto || ''}:${cashAccounting ? 1 : 0}:${reverseCharge ? 1 : 0}:${exemptArticle13 ? 1 : 0}:${(paymentsByInvoice.get(invoice.id) || []).map((payment: any) => `${payment.id}:${dateOf(payment).slice(0,10)}:${money(payment.amount)}:${payment.method}`).sort().join(',')}:${cashEvents.map((event: any) => `${event.date}:${event.factor}`).join(',')}`);
    row.invoices.push(invoice.id);
    row.thresholdKeys.push(thresholdKey);
    groups.set(groupKey, row);
  }

  for (const [taxId, cash] of cashByTaxId) {
    if (cash.amount <= 6000) continue;
    const target = [...groups.values()].find((row: any) => row.taxId === taxId && row.operationKey === 'B');
    if (!target) continue;
    target.autoCashAmount = money(cash.amount);
    target.cashAmount = money(cash.amount);
    target.cashYear = cash.originYears.size === 1 ? [...cash.originYears][0] : '';
    target.cashSourceIds = unique(cash.sourceIds);
  }

  const missingAboveThreshold = [...missingGroups.entries()].filter(([, total]) => Math.abs(total) > 3005.06);
  if (missingAboveThreshold.length) data.blockers.push(`${missingAboveThreshold.length} contraparte(s) podrían superar 3.005,06 € pero no tienen NIF y no pueden declararse.`);
  if (model === '347' && excluded347) data.warnings.push(`${excluded347} factura(s) se excluyeron del 347 por retenciones ya informadas u operaciones territoriales declarables en otros modelos; deben revisarse antes del cierre.`);
  const roundQuarter = (quarters: any) => Object.fromEntries(Object.entries(quarters).map(([key, value]) => [key, money(value)]));
  let pendingReview = 0;
  let incomplete = 0;
  let staleReview = 0;
  const details = [...groups.values()]
    .filter(row => unique(row.thresholdKeys).some((key: string) => Math.abs(thresholdTotals.get(key) || 0) > 3005.06))
    .map(row => {
      const stored: any = declarableRecords.get(row.recordKey);
      const payload = sanitizeThirdPartyPayload(stored?.payload || {});
      const currentSourceFingerprint = sourceFingerprint(row.sourceFacts);
      const reviewIsCurrent = stored?.reviewStatus === 'validado_asesor' && payload.sourceFingerprint === currentSourceFingerprint;
      const effective = (key: string, fallback: unknown) => payload[key] === undefined ? fallback : payload[key];
      const rentQuarters: any = {};
      const transferQuarters: any = {};
      for (const quarter of ['T1', 'T2', 'T3', 'T4']) {
        rentQuarters[quarter] = money(effective(`propertyRent${quarter}`, row.rentQuarters[quarter]));
        transferQuarters[quarter] = money(effective(`propertyTransfer${quarter}`, 0));
      }
      const cashAccountingFinal = booleanValue(payload.cashAccounting, row.cashAccounting);
      const rentAmount = money(effective('propertyRentAmount', row.propertyRentAmount));
      const transferAmount = money(effective('propertyTransferAmount', 0));
      const fullQuarters = roundQuarter(row.quarters);
      const generalQuarters = cashAccountingFinal ? { T1: 0, T2: 0, T3: 0, T4: 0 } : Object.fromEntries(['T1','T2','T3','T4'].map(quarter => [quarter, money(fullQuarters[quarter] - (model === '415' ? rentQuarters[quarter] + transferQuarters[quarter] : 0))]));
      const properties = model === '415' ? (payload.properties || []) : [];
      const missingFields: string[] = [];
      const cashAmount = Math.abs(money(effective('cashAmount', row.cashAmount)));
      const cashYear = clean(effective('cashYear', row.cashYear));
      if (cashAmount > 0 && cashAmount <= 6000) missingFields.push('el metálico solo se informa si supera 6.000 euros');
      if (cashAmount > 6000 && !/^\d{4}$/.test(cashYear)) missingFields.push('ejercicio de origen del cobro en metálico');
      if (!cashAccountingFinal && Math.abs(money(Object.values(rentQuarters).reduce((sum: number, value: any) => sum + Number(value || 0), 0)) - rentAmount) > 0.01) missingFields.push('desglose trimestral de arrendamientos no cuadra con el anual');
      if (!cashAccountingFinal && Math.abs(money(Object.values(transferQuarters).reduce((sum: number, value: any) => sum + Number(value || 0), 0)) - transferAmount) > 0.01) missingFields.push('desglose trimestral de transmisiones no cuadra con el anual');
      if (model === '415' && Math.abs(rentAmount) + Math.abs(transferAmount) > Math.abs(money(row.total)) + 0.01) missingFields.push('arrendamientos y transmisiones superan el importe anual de las operaciones');
      if (model === '415' && !cashAccountingFinal && ['T1','T2','T3','T4'].some(quarter => Math.abs(rentQuarters[quarter]) + Math.abs(transferQuarters[quarter]) > Math.abs(fullQuarters[quarter]) + 0.01)) missingFields.push('algún desglose especial trimestral supera el total del trimestre');
      if (model === '415' && row.operationKey === 'B' && rentAmount !== 0) {
        if (!properties.length) missingFields.push('anexo de inmuebles del arrendador');
        for (const [index, property] of properties.entries()) {
          if (!property.amount) missingFields.push(`importe del inmueble ${index + 1}`);
          if (!property.cadastralUnavailable && !property.cadastralReference) missingFields.push(`referencia catastral del inmueble ${index + 1}`);
          if (!property.roadType || !property.roadName || !property.municipality || !/^\d{5}$/.test(property.municipalityCode) || !/^\d{2}$/.test(property.provinceCode) || !/^\d{5}$/.test(property.postalCode)) missingFields.push(`dirección oficial completa del inmueble ${index + 1}`);
        }
        const propertyTotal = money(properties.reduce((sum: number, property: any) => sum + money(property.amount), 0));
        if (properties.length && Math.abs(propertyTotal - rentAmount) > 0.01) missingFields.push('el total del anexo de inmuebles no cuadra con los arrendamientos');
      }
      if (!booleanValue(payload.specialDataConfirmed)) missingFields.push('confirmación de efectivo, arrendamientos, transmisiones y marcadores especiales');
      if (missingFields.length) incomplete += 1;
      if (!reviewIsCurrent) pendingReview += 1;
      if (stored?.reviewStatus === 'validado_asesor' && !reviewIsCurrent) staleReview += 1;
      return {
        ...row, sourceFacts: undefined, thresholdKeys: undefined, total: money(row.total), ordinaryTotal: model === '415' ? money(row.total - rentAmount - transferAmount) : money(row.total),
        totalAccordingToOperation: model === '415' ? money(row.total - rentAmount - transferAmount + rentAmount + transferAmount) : money(row.total),
        quarters: generalQuarters, fullQuarters, rentQuarters, transferQuarters,
        cashAmount, cashYear, propertyRentAmount: rentAmount, propertyTransferAmount: transferAmount,
        cashAccounting: cashAccountingFinal, cashAccountingAnnualAmount: money(effective('cashAccountingAnnualAmount', row.cashAccountingAnnualAmount)),
        reverseCharge: booleanValue(payload.reverseCharge, row.reverseCharge), exemptArticle13: booleanValue(payload.exemptArticle13, row.exemptArticle13),
        representativeTaxId: clean(payload.representativeTaxId), properties, manual: {
          cashAmount, cashYear, propertyRentAmount: rentAmount, propertyTransferAmount: transferAmount,
          ...Object.fromEntries(['T1','T2','T3','T4'].flatMap(quarter => [[`propertyRent${quarter}`, rentQuarters[quarter]], [`propertyTransfer${quarter}`, transferQuarters[quarter]]])),
          cashAccounting: cashAccountingFinal, cashAccountingAnnualAmount: money(effective('cashAccountingAnnualAmount', row.cashAccountingAnnualAmount)),
          reverseCharge: booleanValue(payload.reverseCharge, row.reverseCharge), exemptArticle13: booleanValue(payload.exemptArticle13, row.exemptArticle13),
          representativeTaxId: clean(payload.representativeTaxId), specialDataConfirmed: booleanValue(payload.specialDataConfirmed), properties, sourceFingerprint: currentSourceFingerprint,
        },
        reviewStatus: reviewIsCurrent ? 'validado_asesor' : 'pendiente_revision', sourceFingerprint: currentSourceFingerprint, missingFields: unique(missingFields), enrichmentId: stored?.id,
      };
    });
  if (incomplete) data.blockers.push(`${incomplete} registro(s) ${model} necesitan completar o confirmar sus datos especiales.`);
  if (pendingReview) data.blockers.push(`${pendingReview} registro(s) ${model} no han sido validados por un asesor.`);
  if (staleReview) data.warnings.push(`${staleReview} validación(es) anteriores se invalidaron porque cambiaron las facturas o pagos de origen.`);
  if (details.some(row => row.cashAccounting)) data.warnings.push('Las operaciones en criterio de caja usan los cobros/pagos registrados; el asesor debe confirmar también devengos de ejercicios anteriores.');
  if (details.some(row => !row.name)) data.blockers.push('Hay registros declarables sin nombre o razón social.');
  if (details.some(row => row.country === 'ES' && !validSpanishTaxId(row.taxId))) data.blockers.push('Hay NIF españoles que no tienen exactamente nueve caracteres válidos para el diseño oficial.');
  if (details.some(row => row.country === 'ES' && !row.provinceCode)) data.blockers.push('Hay declarados españoles sin código de provincia oficial resoluble.');
  if (details.some(row => !row.country)) data.blockers.push('Hay declarados con país no normalizado al código ISO de dos letras.');
  const fields: any[] = [];
  addField(fields, 'DECLARADOS', 'Registros que superan el umbral por tercero', details.length, details.flatMap(row => row.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  addField(fields, 'IMPORTE', 'Importe anual declarado', details.reduce((sum, row) => sum + row.total, 0), details.flatMap(row => row.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  addField(fields, 'METALICO', 'Cobros en metálico declarables', details.reduce((sum, row) => sum + row.cashAmount, 0), details.flatMap(row => row.cashSourceIds || []), 'Control especial');
  return { fields, result: 0, details };
}

function declarableRows(data: any, model: string, b: any, annual = false) {
  return (data.declarables || []).filter((record: any) => {
    if (clean(record.modeloCodigo) !== model) return false;
    const payload = record.payload || {};
    const date = clean(payload.paymentDate || payload.operationDate).slice(0, 10);
    return annual || !date || (date >= b.start && date <= b.end);
  });
}

function manualSourceId(record: any) {
  return `TaxDeclarableRecord:${record.id}`;
}

function calculate131(data: any, _b: any, adjustments: any) {
  const value = (key: string) => money(adjustments?.[key]);
  const source = (key: string) => adjustments?.[key] === undefined || adjustments?.[key] === null || adjustments?.[key] === '' ? [] : [`ManualAdjustment:${key}`];
  const fields: any[] = [];
  const box01 = Math.max(0, value('modulesNetYield'));
  const employees = Number(adjustments?.salariedEmployees ?? NaN);
  const statutoryRate = Number.isFinite(employees) ? employees <= 0 ? 2 : employees <= 1 ? 3 : 4 : 0;
  const requestedRate = Number(adjustments?.modulesPaymentRate ?? statutoryRate);
  const modulesRate = Number.isFinite(requestedRate) ? Math.max(statutoryRate || 0, requestedRate) : 0;
  const box02 = adjustments?.modulesQuarterPayment !== undefined ? Math.max(0, value('modulesQuarterPayment')) : money(box01 * modulesRate / 100);
  const box03 = Math.max(0, value('noBaseDataRevenue'));
  const noBaseRate = Math.max(2, Number(adjustments?.noBaseDataRate || 2));
  const box04 = money(box03 * noBaseRate / 100);
  const box05 = Math.max(0, value('agricultureRevenue'));
  const agricultureRate = Math.max(2, Number(adjustments?.agricultureRate || 2));
  const youngFarmerReduction = booleanValue(adjustments?.youngFarmerReduction);
  const box06 = money(box05 * agricultureRate / 100 * (youngFarmerReduction ? 0.75 : 1));
  const box07 = money(box02 + box04 + box06);
  const box08 = Math.max(0, value('withholdings'));
  const previousYearNet = Number(adjustments?.previousYearNetIncome);
  const automaticReduction = Number.isFinite(previousYearNet) ? previousYearNet <= 9000 ? 100 : previousYearNet <= 10000 ? 75 : previousYearNet <= 11000 ? 50 : previousYearNet <= 12000 ? 25 : 0 : 0;
  const box09 = adjustments?.article110Reduction !== undefined ? Math.max(0, value('article110Reduction')) : automaticReduction;
  const box10 = money(box07 - box08 - box09);
  const box11 = money(Math.min(Math.max(0, box10), Math.max(0, value('priorNegativeResults'))));
  const housingRequested = Math.max(0, value('housingDeduction'));
  const box12 = money(Math.min(housingRequested, Math.max(0, box10 - box11), 660.14));
  const box13 = money(box10 < 0 ? box10 : box10 - box11 - box12);
  const box14 = Math.max(0, value('previousSamePeriodResult'));
  const box15 = money(box13 - box14);
  addField(fields, '01', 'Suma de rendimientos netos por módulos', box01, source('modulesNetYield'), 'I. Actividades con datos-base', { formula: 'Suma de rendimientos netos a efectos del pago fraccionado por actividad, calculados con signos, módulos, minoraciones e índices de la Orden anual.' });
  addField(fields, '02', 'Pago fraccionado por módulos', box02, unique([...source('modulesQuarterPayment'), ...source('modulesNetYield'), ...source('salariedEmployees'), ...source('modulesPaymentRate')]), 'I. Actividades con datos-base', { formula: adjustments?.modulesQuarterPayment !== undefined ? 'Importe por actividad confirmado manualmente.' : `${modulesRate || 0}% sobre casilla 01. El mínimo ordinario es 2%, 3% o 4% según personal asalariado.`, dependsOn: ['01'] });
  addField(fields, '03', 'Ventas o ingresos sin datos-base', box03, source('noBaseDataRevenue'), 'II. Sin datos-base');
  addField(fields, '04', 'Pago fraccionado sin datos-base', box04, unique([...source('noBaseDataRevenue'), ...source('noBaseDataRate')]), 'II. Sin datos-base', { formula: `${noBaseRate}% de la casilla 03.`, dependsOn: ['03'] });
  addField(fields, '05', 'Ingresos agrícolas, ganaderos y forestales', box05, source('agricultureRevenue'), 'III. Actividades agrarias');
  addField(fields, '06', 'Pago fraccionado de actividades agrarias', box06, unique([...source('agricultureRevenue'), ...source('agricultureRate'), ...source('youngFarmerReduction')]), 'III. Actividades agrarias', { formula: `${agricultureRate}% de la casilla 05${youngFarmerReduction ? ', reducido un 25% por agricultor joven/asalariado agrario confirmado' : ''}.`, dependsOn: ['05'] });
  addField(fields, '07', 'Suma de pagos fraccionados', box07, [], 'IV. Liquidación', { formula: 'Casillas 02 + 04 + 06.', dependsOn: ['02','04','06'] });
  addField(fields, '08', 'Retenciones e ingresos a cuenta', box08, source('withholdings'), 'IV. Liquidación');
  addField(fields, '09', 'Minoración art. 110.3.c RIRPF', box09, adjustments?.article110Reduction !== undefined ? source('article110Reduction') : source('previousYearNetIncome'), 'IV. Liquidación', { formula: adjustments?.article110Reduction !== undefined ? 'Importe confirmado, coordinado con el modelo 130.' : '100/75/50/25/0 euros según rendimiento neto del ejercicio anterior.' });
  addField(fields, '10', 'Diferencia', box10, [], 'IV. Liquidación', { formula: 'Casilla 07 − casilla 08 − casilla 09.', dependsOn: ['07','08','09'] });
  addField(fields, '11', 'Resultados negativos anteriores aplicados', box11, source('priorNegativeResults'), 'IV. Liquidación', { dependsOn: ['10'] });
  addField(fields, '12', 'Deducción por vivienda habitual', box12, source('housingDeduction'), 'IV. Liquidación', { dependsOn: ['10','11'] });
  addField(fields, '13', 'Total', box13, [], 'IV. Liquidación', { formula: 'Casilla 10 − casillas 11 y 12; si 10 es negativa se conserva su signo.', dependsOn: ['10','11','12'] });
  addField(fields, '14', 'Resultado previo de la misma autoliquidación', box14, source('previousSamePeriodResult'), 'Complementaria');
  addField(fields, '15', 'Resultado de la autoliquidación', box15, [], 'Liquidación', { formula: 'Casilla 13 − casilla 14.', dependsOn: ['13','14'] });
  if (!box01 && !box03 && !box05) data.warnings.push('Informa los datos-base del modelo 131: no se ha consignado rendimiento por módulos ni ingresos de las secciones II o III.');
  if (box01 && !Number.isFinite(employees) && adjustments?.modulesQuarterPayment === undefined) data.warnings.push('Falta el número de personas asalariadas o el pago trimestral calculado por actividad; no puede elegirse con seguridad el 2%, 3% o 4%.');
  if (adjustments?.article110Reduction === undefined && !Number.isFinite(previousYearNet)) data.warnings.push('Falta el rendimiento neto del ejercicio anterior para calcular la casilla 09 y coordinarla, si procede, con el modelo 130.');
  return { fields, result: box15, details: [{ type: 'estimacion_objetiva', modulesRate, statutoryRate, youngFarmerReduction, manualDataRequired: true }] };
}

function calculate216(data: any, b: any, adjustments: any) {
  const records = declarableRows(data, '216', b, false);
  const rows = records.map((record: any) => ({ record, sourceId: manualSourceId(record), payload: record.payload || {} }));
  const retained = rows.filter((row: any) => !booleanValue(row.payload.notSubjectToWithholding));
  const unretained = rows.filter((row: any) => booleanValue(row.payload.notSubjectToWithholding));
  const dividends = (rowsToUse: any[]) => rowsToUse.filter((row: any) => booleanValue(row.payload.dividendOrEquityIncome) || clean(row.payload.incomeGroup) === 'dividends');
  const others = (rowsToUse: any[]) => rowsToUse.filter((row: any) => !dividends(rowsToUse).includes(row));
  const sum = (rowsToUse: any[], key: string) => money(rowsToUse.reduce((total: number, row: any) => total + money(row.payload[key]), 0));
  const fields: any[] = [], retainedDividends = dividends(retained), retainedOther = others(retained), unretainedDividends = dividends(unretained), unretainedOther = others(unretained);
  const ids = (rowsToUse: any[]) => rowsToUse.map((row: any) => row.sourceId);
  addField(fields, '05', 'Número de dividendos y participaciones sometidos a retención', retainedDividends.length, ids(retainedDividends), 'Rentas sometidas');
  addField(fields, '06', 'Número del resto de rentas sometidas a retención', retainedOther.length, ids(retainedOther), 'Rentas sometidas');
  addField(fields, '07', 'Número total de rentas sometidas', retained.length, ids(retained), 'Rentas sometidas', { dependsOn: ['05','06'] });
  addField(fields, '08', 'Base de dividendos y participaciones sometidos', sum(retainedDividends, 'withholdingBase'), ids(retainedDividends), 'Rentas sometidas');
  addField(fields, '09', 'Base del resto de rentas sometidas', sum(retainedOther, 'withholdingBase'), ids(retainedOther), 'Rentas sometidas');
  addField(fields, '10', 'Base total sometida', sum(retained, 'withholdingBase'), ids(retained), 'Rentas sometidas', { dependsOn: ['08','09'] });
  addField(fields, '11', 'Retenciones de dividendos y participaciones', sum(retainedDividends, 'withholdingAmount'), ids(retainedDividends), 'Rentas sometidas');
  addField(fields, '12', 'Retenciones del resto de rentas', sum(retainedOther, 'withholdingAmount'), ids(retainedOther), 'Rentas sometidas');
  const box13 = sum(retained, 'withholdingAmount');
  addField(fields, '13', 'Total retenciones e ingresos a cuenta', box13, ids(retained), 'Rentas sometidas', { dependsOn: ['11','12'] });
  addField(fields, '14', 'Número de dividendos y participaciones no sometidos', unretainedDividends.length, ids(unretainedDividends), 'Rentas no sometidas');
  addField(fields, '15', 'Número del resto de rentas no sometidas', unretainedOther.length, ids(unretainedOther), 'Rentas no sometidas');
  addField(fields, '16', 'Número total de rentas no sometidas', unretained.length, ids(unretained), 'Rentas no sometidas', { dependsOn: ['14','15'] });
  addField(fields, '17', 'Base de dividendos y participaciones no sometidos', sum(unretainedDividends, 'withholdingBase'), ids(unretainedDividends), 'Rentas no sometidas');
  addField(fields, '18', 'Base del resto de rentas no sometidas', sum(unretainedOther, 'withholdingBase'), ids(unretainedOther), 'Rentas no sometidas');
  addField(fields, '19', 'Base total no sometida', sum(unretained, 'withholdingBase'), ids(unretained), 'Rentas no sometidas', { dependsOn: ['17','18'] });
  const previous = Math.max(0, money(adjustments?.previousSamePeriodResult));
  addField(fields, '20', 'Resultados anteriores del mismo período', previous, previous ? ['ManualAdjustment:previousSamePeriodResult'] : [], 'Complementaria');
  addField(fields, '21', 'Resultado a ingresar', money(box13 - previous), unique([...ids(retained), ...(previous ? ['ManualAdjustment:previousSamePeriodResult'] : [])]), 'Liquidación', { dependsOn: ['13','20'] });
  if (!records.length) data.warnings.push('No hay rentas de no residentes individualizadas para este período. Añade perceptores o confirma que el modelo 216 no tiene actividad.');
  if (records.some((record: any) => !clean(record.payload?.recipientTaxId) || !clean(record.payload?.country) || !clean(record.payload?.incomeKey))) data.warnings.push('Hay perceptores del 216 sin identificación, país o clave de renta completa.');
  return { fields, result: money(box13 - previous), details: rows.map((row: any) => ({ recordId: row.record.id, recordKey: row.record.recordKey, sourceId: row.sourceId, reviewStatus: row.record.reviewStatus, ...row.payload })) };
}

function calculate296(data: any, b: any) {
  const direct = declarableRows(data, '296', b, true);
  const from216 = declarableRows(data, '216', b, true);
  const seen = new Set<string>();
  const records = [...direct, ...from216].filter((record: any) => {
    const payload = record.payload || {};
    const key = clean(payload.sourceFingerprint || `${payload.recipientTaxId}|${payload.incomeKey}|${payload.paymentDate}|${payload.accruedAmount}|${payload.withholdingAmount}`);
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  const ids = records.map(manualSourceId), fields: any[] = [];
  const sum = (key: string) => money(records.reduce((total: number, record: any) => total + money(record.payload?.[key]), 0));
  addField(fields, 'PERCEPTORES', 'Número de perceptores individualizados', unique(records.map((record: any) => clean(record.payload?.recipientTaxId) || record.recordKey)).length, ids, 'Resumen anual');
  addField(fields, 'RENTAS', 'Número de rentas declaradas', records.length, ids, 'Resumen anual');
  addField(fields, 'INTEGRO', 'Importe íntegro anual', sum('accruedAmount'), ids, 'Resumen anual');
  addField(fields, 'BASE', 'Base anual de retenciones', sum('withholdingBase'), ids, 'Resumen anual');
  addField(fields, 'RETENCIONES', 'Retenciones e ingresos a cuenta anuales', sum('withholdingAmount'), ids, 'Resumen anual');
  if (!records.length) data.warnings.push('No hay perceptores IRNR individualizados para el resumen anual 296.');
  if (records.some((record: any) => !clean(record.payload?.recipientTaxId) || !clean(record.payload?.country) || !clean(record.payload?.incomeKey))) data.warnings.push('Hay registros del 296 sin identificación, país o clave de renta completa.');
  return { fields, result: 0, details: records.map((record: any) => ({ recordId: record.modeloCodigo === '296' ? record.id : undefined, recordKey: record.recordKey, sourceId: manualSourceId(record), sourceModel: record.modeloCodigo, reviewStatus: record.reviewStatus, ...(record.payload || {}) })) };
}

function calculate349(data: any, b: any) {
  const aggregates = new Map<string, any>();
  const add = (row: any) => {
    const key = `${clean(row.country)}|${clean(row.operatorTaxId)}|${clean(row.operationKey)}`;
    const current = aggregates.get(key) || { recordKey: `M349:${key}`, country: row.country, operatorTaxId: row.operatorTaxId, operatorName: row.operatorName, operationKey: row.operationKey, amount: 0, rectificationAmount: 0, sourceIds: [], reviewStatus: row.reviewStatus || 'propuesto' };
    current.amount = money(current.amount + money(row.amount)); current.rectificationAmount = money(current.rectificationAmount + money(row.rectificationAmount)); current.sourceIds.push(...(row.sourceIds || []));
    current.sourceIds = unique(current.sourceIds); if (row.recordId) current.recordIds = unique([...(current.recordIds || []), row.recordId]); if (row.manual) current.manual = true; aggregates.set(key, current);
  };
  for (const line of (data.taxLines || []).filter((item: any) => inRange(item, b.start, b.end))) {
    const op = clean(line.operationType), regime = clean(line.regime), deduction = clean(line.deductionCategory);
    if (!['intra_eu_supply','intra_eu_acquisition'].includes(op) && regime !== 'intracomunitaria' && deduction !== 'intra_services') continue;
    const invoice = line.invoice || {}, counterparty = invoiceCounterparty(invoice);
    const key = deduction === 'intra_services' ? (invoice.tipo === 'emitida' ? 'S' : 'I') : op === 'intra_eu_supply' || invoice.tipo === 'emitida' ? 'E' : 'A';
    add({ country: normalizedCountry(counterparty.country), operatorTaxId: counterparty.id, operatorName: counterparty.name, operationKey: key, amount: line.base, sourceIds: [line.sourceId] });
  }
  for (const record of declarableRows(data, '349', b, false)) {
    const payload = record.payload || {};
    add({ ...payload, sourceIds: [manualSourceId(record)], recordId: record.id, manual: true, reviewStatus: record.reviewStatus });
  }
  const details = [...aggregates.values()].map((row: any) => ({ ...row, recordId: row.recordIds?.length === 1 ? row.recordIds[0] : undefined, amount: money(row.amount), rectificationAmount: money(row.rectificationAmount) }));
  const ids = details.flatMap((row: any) => row.sourceIds), fields: any[] = [];
  addField(fields, 'OPERADORES', 'Operadores intracomunitarios', details.length, ids, 'Resumen');
  addField(fields, 'OPERACIONES', 'Importe de operaciones intracomunitarias', details.reduce((sum: number, row: any) => sum + row.amount, 0), ids, 'Resumen');
  addField(fields, 'RECTIFICACIONES', 'Importe de rectificaciones', details.reduce((sum: number, row: any) => sum + row.rectificationAmount, 0), ids, 'Resumen');
  if (!details.length) data.warnings.push('No se han detectado operaciones intracomunitarias en el período.');
  if (details.some((row: any) => !clean(row.operatorTaxId) || !clean(row.country) || !clean(row.operationKey))) data.warnings.push('Hay operaciones del 349 sin NIF-IVA, país o clave de operación completa.');
  if (details.some((row: any) => !['A','E','I','S','T','H','M'].includes(clean(row.operationKey)))) data.warnings.push('Hay claves de operación del 349 no reconocidas; deben revisarse en el formulario AEAT.');
  return { fields, result: 0, details };
}

function calculate421(data: any, _b: any, adjustments: any) {
  const value = (key: string) => money(adjustments?.[key]);
  const source = (key: string) => adjustments?.[key] === undefined || adjustments?.[key] === null || adjustments?.[key] === '' ? [] : [`ManualAdjustment:${key}`];
  const fields: any[] = [], period = normalizedPeriod(data.period), fourth = period === '4T';
  const annualActivityQuotas = [1,2,3,4,5].map(index => Math.max(0, value(`annualActivityQuota${index}`)));
  annualActivityQuotas.forEach((amount, index) => addField(fields, String(index + 1).padStart(2, '0'), `Cuota anual devengada actividad ${index + 1}`, amount, source(`annualActivityQuota${index + 1}`), 'Régimen simplificado'));
  const box06 = fourth ? 0 : Math.max(0, value('quarterAdvance'));
  addField(fields, '06', 'Ingreso a cuenta del trimestre', box06, source('quarterAdvance'), 'Régimen simplificado');
  const box07 = fourth ? money(annualActivityQuotas.reduce((sum, amount) => sum + amount, 0)) : 0;
  const box08 = fourth ? Math.max(0, value('currentInputQuota')) : 0;
  const minimumRate = Math.max(0, Number(adjustments?.minimumQuotaRate || 0));
  const seasonalIndex = Math.max(0, Number(adjustments?.seasonalIndex || 1));
  const minimumQuota = money(box07 * minimumRate / 100 * seasonalIndex);
  const box09 = fourth ? money(Math.max(minimumQuota, Math.max(0, box07 - box08) * seasonalIndex)) : 0;
  const box10 = fourth ? Math.max(0, value('previousQuarterAdvances')) : 0;
  const box11 = fourth ? money(box09 - box10) : 0;
  if (fourth) {
    addField(fields, '07', 'Cuota anual devengada por operaciones corrientes', box07, annualActivityQuotas.flatMap((_amount, index) => source(`annualActivityQuota${index + 1}`)), 'Regularización 4T', { dependsOn: ['01','02','03','04','05'] });
    addField(fields, '08', 'Cuotas soportadas corrientes y compensaciones', box08, source('currentInputQuota'), 'Regularización 4T');
    addField(fields, '09', 'Cuota anual derivada del régimen simplificado', box09, unique([...source('currentInputQuota'), ...source('minimumQuotaRate'), ...source('seasonalIndex')]), 'Regularización 4T', { dependsOn: ['07','08'] });
    addField(fields, '10', 'Ingresos a cuenta de trimestres anteriores', box10, source('previousQuarterAdvances'), 'Regularización 4T');
    addField(fields, '11', 'Regularización del régimen simplificado', box11, [], 'Regularización 4T', { dependsOn: ['09','10'] });
  }
  const box12 = value('fixedAssetAndReverseChargeOutput');
  const box13 = value('propertyRentalOutput');
  const box14 = Math.max(0, value('outputRectificationsDecrease'));
  const box15 = Math.max(0, value('fixedAssetInputQuota'));
  const box16 = Math.max(0, value('rentalAndZeroRateInputQuota'));
  const box17 = Math.max(0, value('previousCompensationBalance'));
  const box18 = value('previousSamePeriodResult');
  const box19 = money((fourth ? box11 : box06) + box12 + box13 - box14 - box15 - box16 - box17 - box18);
  for (const [code,label,key,amount] of [
    ['12','Cuotas por activos fijos e inversión del sujeto pasivo','fixedAssetAndReverseChargeOutput',box12],['13','Cuotas por arrendamiento de inmuebles','propertyRentalOutput',box13],['14','Rectificación minoradora de cuotas repercutidas','outputRectificationsDecrease',box14],['15','Cuotas soportadas de activos fijos','fixedAssetInputQuota',box15],['16','Cuotas soportadas de arrendamientos y tipo cero','rentalAndZeroRateInputQuota',box16],['17','Cuotas anteriores a compensar','previousCompensationBalance',box17],['18','Resultado anterior de la misma autoliquidación','previousSamePeriodResult',box18],
  ] as any[]) addField(fields, code, label, amount, source(key), 'Otras operaciones');
  addField(fields, '19', 'Resultado de la autoliquidación', box19, [], 'Liquidación', { formula: '(Casilla 06 o 11) + 12 + 13 − 14 − 15 − 16 − 17 − 18.', dependsOn: [fourth ? '11' : '06','12','13','14','15','16','17','18'] });
  if (!annualActivityQuotas.some(Boolean) && !box06) data.warnings.push('Faltan las cuotas por actividad calculadas con los módulos e índices IGIC de la Orden anual.');
  if (fourth && adjustments?.minimumQuotaRate === undefined) data.warnings.push('En 4T debe confirmarse el porcentaje de cuota mínima de cada actividad; el borrador no puede inferirlo de las facturas.');
  return { fields, result: box19, details: [{ type: 'igic_simplificado', period, minimumQuota, minimumRate, seasonalIndex, manualDataRequired: true }] };
}

function calculate200(data: any, b: any, adjustments: any) {
  const validEntries = new Set((data.entries || []).filter((entry: any) => entry.status === 'confirmado' && entry.isBalanced !== false && inRange(entry, b.start, b.end)).map((entry: any) => entry.id));
  const lines = (data.entryLines || []).filter((line: any) => validEntries.has(line.journalEntryId));
  const account = (line: any) => clean(line.accountCode || line.subcuenta);
  const revenueLines = lines.filter((line: any) => /^7/.test(account(line)));
  const expenseLines = lines.filter((line: any) => /^6/.test(account(line)));
  const accountingRevenue = money(revenueLines.reduce((sum: number, line: any) => sum + money(line.credit) - money(line.debit), 0));
  const accountingExpense = money(expenseLines.reduce((sum: number, line: any) => sum + money(line.debit) - money(line.credit), 0));
  const accountingResult = money(accountingRevenue - accountingExpense);
  const increases = Math.max(0, money(adjustments.taxableIncreases)), decreases = Math.max(0, money(adjustments.taxableDecreases));
  const preLossBase = money(accountingResult + increases - decreases);
  const lossOffset = Math.min(Math.max(0, preLossBase), Math.max(0, money(adjustments.taxLossCarryforward)));
  const taxableBase = money(preLossBase - lossOffset);
  const taxRate = Math.max(0, Number(adjustments.taxRate || 0));
  const grossTax = money(Math.max(0, taxableBase) * taxRate / 100);
  const credits = Math.max(0, money(adjustments.taxCredits));
  const netTax = money(Math.max(0, grossTax - credits));
  const withholdings = Math.max(0, money(adjustments.withholdings));
  const payments = Math.max(0, money(adjustments.instalmentPayments));
  const previous = Math.max(0, money(adjustments.previousSamePeriodResult));
  const result = money(netTax - withholdings - payments - previous);
  const fields: any[] = [], revenueIds = revenueLines.map((line: any) => `JournalEntryLine:${line.id}`), expenseIds = expenseLines.map((line: any) => `JournalEntryLine:${line.id}`);
  addField(fields, 'RDO_CONTABLE', 'Resultado contable antes de conciliación fiscal', accountingResult, [...revenueIds,...expenseIds], 'Conciliación contable-fiscal', { formula: 'Ingresos grupo 7 − gastos grupo 6.' });
  addField(fields, 'AUMENTOS', 'Ajustes extracontables positivos', increases, increases ? ['ManualAdjustment:taxableIncreases'] : [], 'Conciliación contable-fiscal');
  addField(fields, 'DISMINUCIONES', 'Ajustes extracontables negativos', decreases, decreases ? ['ManualAdjustment:taxableDecreases'] : [], 'Conciliación contable-fiscal');
  addField(fields, 'BASE_PREVIA', 'Base imponible previa', preLossBase, [], 'Base imponible', { dependsOn: ['RDO_CONTABLE','AUMENTOS','DISMINUCIONES'] });
  addField(fields, 'BIN_COMP', 'Bases imponibles negativas compensadas', lossOffset, lossOffset ? ['ManualAdjustment:taxLossCarryforward'] : [], 'Base imponible');
  addField(fields, 'BASE', 'Base imponible', taxableBase, [], 'Base imponible', { dependsOn: ['BASE_PREVIA','BIN_COMP'] });
  addField(fields, 'CUOTA_INTEGRA', `Cuota íntegra al ${taxRate}%`, grossTax, taxRate ? ['ManualAdjustment:taxRate'] : [], 'Cuota');
  addField(fields, 'DEDUCCIONES', 'Bonificaciones y deducciones', credits, credits ? ['ManualAdjustment:taxCredits'] : [], 'Cuota');
  addField(fields, 'CUOTA_LIQUIDA', 'Cuota líquida', netTax, [], 'Cuota');
  addField(fields, 'RETENCIONES', 'Retenciones e ingresos a cuenta', withholdings, withholdings ? ['ManualAdjustment:withholdings'] : [], 'Liquidación');
  addField(fields, 'PAGOS_FRACC', 'Pagos fraccionados', payments, payments ? ['ManualAdjustment:instalmentPayments'] : [], 'Liquidación');
  addField(fields, 'PREVIO', 'Resultado previo de la misma autoliquidación', previous, previous ? ['ManualAdjustment:previousSamePeriodResult'] : [], 'Complementaria');
  addField(fields, 'RESULTADO', 'Resultado de la conciliación para Sociedades WEB', result, [], 'Liquidación');
  if (!lines.length) data.warnings.push('No hay asientos confirmados y cuadrados del período para iniciar la conciliación del modelo 200.');
  if (!taxRate) data.warnings.push('Falta confirmar el tipo efectivo aplicable del Impuesto sobre Sociedades.');
  data.warnings.push('El borrador 200 es una conciliación de control: deben completarse balance, pérdidas y ganancias, estados patrimoniales y páginas específicas en Sociedades WEB.');
  return { fields, result, details: [{ type: 'conciliacion_sociedades', accountingRevenue, accountingExpense, entries: validEntries.size, manualDataRequired: true }] };
}

function calculate202(data: any, _b: any, adjustments: any) {
  const method = clean(adjustments.method);
  const fields: any[] = [];
  const source = (key: string) => adjustments?.[key] === undefined || adjustments?.[key] === null || adjustments?.[key] === '' ? [] : [`ManualAdjustment:${key}`];
  let base = 0, gross = 0;
  if (method === '40_2') {
    base = Math.max(0, money(adjustments.previousCorporateTaxQuota));
    gross = money(base * 0.18);
  } else if (method === '40_3') {
    base = money(adjustments.currentTaxableBase);
    const rate = Math.max(0, Number(adjustments.paymentPercentage || 0));
    gross = money(Math.max(0, base) * rate / 100);
  }
  const bonuses = Math.max(0, money(adjustments.bonuses)), withholdings = Math.max(0, money(adjustments.withholdings)), previousPayments = Math.max(0, money(adjustments.previousInstalmentPayments)), minimumPayment = Math.max(0, money(adjustments.minimumPayment));
  const calculated = money(gross - bonuses - withholdings - previousPayments);
  const result = money(Math.max(calculated, minimumPayment));
  addField(fields, 'MODALIDAD', method === '40_2' ? 402 : method === '40_3' ? 403 : 0, source('method'), 'Modalidad', { displayValue: method || 'pendiente' });
  addField(fields, 'BASE', method === '40_2' ? 'Cuota del último período impositivo' : 'Base imponible acumulada', base, method === '40_2' ? source('previousCorporateTaxQuota') : source('currentTaxableBase'), 'Cálculo');
  addField(fields, 'PAGO_PREVIO', 'Pago fraccionado antes de minoraciones', gross, unique([...source('previousCorporateTaxQuota'),...source('currentTaxableBase'),...source('paymentPercentage')]), 'Cálculo');
  addField(fields, 'BONIFICACIONES', 'Bonificaciones', bonuses, source('bonuses'), 'Minoraciones');
  addField(fields, 'RETENCIONES', 'Retenciones e ingresos a cuenta', withholdings, source('withholdings'), 'Minoraciones');
  addField(fields, 'PAGOS_ANT', 'Pagos fraccionados anteriores del ejercicio', previousPayments, source('previousInstalmentPayments'), 'Minoraciones');
  addField(fields, 'MINIMO', 'Pago mínimo confirmado, si procede', minimumPayment, source('minimumPayment'), 'Pago mínimo');
  addField(fields, 'RESULTADO', 'Resultado del pago fraccionado', result, [], 'Liquidación');
  if (!['40_2','40_3'].includes(method)) data.warnings.push('Selecciona y documenta la modalidad del artículo 40.2 o 40.3 LIS.');
  if (method === '40_3' && !(Number(adjustments.paymentPercentage) > 0)) data.warnings.push('Falta el porcentaje aplicable de la modalidad del artículo 40.3 LIS.');
  return { fields, result, details: [{ type: 'pago_fraccionado_sociedades', method, manualDataRequired: true }] };
}

function calculate232(data: any, b: any) {
  const records = declarableRows(data, '232', b, true), fields: any[] = [], ids = records.map(manualSourceId);
  const groups = ['related','patent_box','tax_haven'].map(category => ({ category, rows: records.filter((record: any) => clean(record.payload?.category || 'related') === category) }));
  addField(fields, 'REGISTROS', 'Operaciones individualizadas', records.length, ids, 'Resumen');
  addField(fields, 'VINCULADAS', 'Importe de operaciones vinculadas', groups[0].rows.reduce((sum: number, record: any) => sum + money(record.payload?.amount), 0), groups[0].rows.map(manualSourceId), 'Operaciones vinculadas');
  addField(fields, 'PATENT_BOX', 'Importe de reducción por cesión de intangibles', groups[1].rows.reduce((sum: number, record: any) => sum + money(record.payload?.amount), 0), groups[1].rows.map(manualSourceId), 'Patent box');
  addField(fields, 'PARAISOS', 'Importe de operaciones con territorios no cooperativos', groups[2].rows.reduce((sum: number, record: any) => sum + money(record.payload?.amount), 0), groups[2].rows.map(manualSourceId), 'Territorios no cooperativos');
  if (!records.length) data.warnings.push('No hay operaciones clasificadas expresamente para el modelo 232. No se infieren vinculaciones societarias a partir de facturas ordinarias.');
  if (records.some((record: any) => !clean(record.payload?.relatedPartyTaxId) || !clean(record.payload?.operationType) || !clean(record.payload?.valuationMethod))) data.warnings.push('Hay operaciones del 232 sin identificación de la parte, tipo de operación o método de valoración.');
  return { fields, result: 0, details: records.map((record: any) => ({ recordId: record.id, recordKey: record.recordKey, sourceId: manualSourceId(record), reviewStatus: record.reviewStatus, ...(record.payload || {}) })) };
}

function applyModelValidation(model: string, data: any, calculation: any) {
  const profile = data.profile;
  const indirect = clean(profile?.indirectTaxDefault);
  const year = Number(data.year);
  if (model === '347' && indirect === 'igic') data.blockers.push('El perfil está en territorio IGIC: corresponde el modelo 415, no el 347.');
  if (model === '347' && indirect === 'mixto') data.blockers.push('El perfil fiscal es mixto: separa y confirma manualmente las operaciones de territorio IVA antes de exportar el 347.');
  if (model === '347' && year > 2025) data.blockers.push('El diseño anual AEAT del ejercicio 2026 todavía no está publicado; solo se habilita el último diseño oficialmente disponible.');
  if (model === '415' && year > 2025) data.blockers.push('La ATC todavía no ha publicado el programa anual 415 del ejercicio 2026.');
  if (model === '130') {
    if (profile?.entityType !== 'autonomo' || !profile?.subjectToIRPF || profile?.irpfEstimation === 'no_aplica') data.blockers.push('El modelo 130 solo es aplicable a personas físicas en estimación directa sujetas a pago fraccionado.');
    if (profile?.model130ExemptionConfirmed) data.blockers.push('El perfil marca exención del modelo 130 por porcentaje de ingresos sometidos a retención; revise la obligación censal antes de generar fichero.');
  }
  if (model === '131') {
    if (profile?.entityType !== 'autonomo' || !profile?.subjectToIRPF || profile?.irpfEstimation !== 'objetiva_modulos') data.blockers.push('El modelo 131 corresponde a personas físicas en estimación objetiva; revisa el perfil y la obligación censal.');
  }
  if (['200','202','232'].includes(model) && profile?.entityType === 'autonomo') data.blockers.push(`El modelo ${model} no corresponde normalmente a un autónomo persona física; confirma el sujeto pasivo y su régimen.`);
  if (['216','296'].includes(model) && !booleanValue(profile?.hasNonResidentOperations) && !(calculation.details || []).length) data.warnings.push(`El perfil no indica operaciones con no residentes y no hay registros para el modelo ${model}.`);
  if (model === '349' && !data.activities.some((activity: any) => booleanValue(activity.hasIntraCommunityOperations)) && !(calculation.details || []).length) data.warnings.push('Ninguna actividad marca operaciones intracomunitarias y no se han detectado líneas fiscales para el 349.');
  if (model === '303' && !['iva', 'mixto'].includes(indirect)) data.blockers.push('El perfil no está configurado en territorio IVA; no corresponde exportar el modelo 303.');
  if (model === '303' && data.activities.some((activity: any) => ['simplificado','grupo_entidades'].includes(activity.indirectTaxRegime))) data.blockers.push('Hay actividades en régimen simplificado o grupo de entidades. El fichero puede exportarse, pero las páginas específicas no están automatizadas y deben completarse en la sede electrónica antes de presentar.');
  if (model === '420' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El perfil no está configurado en IGIC; no corresponde preparar el modelo 420.');
  if (model === '420' && profile?.usesSII) data.blockers.push('Los sujetos IGIC incluidos en SII deben revisar el modelo 417, no el 420 ordinario.');
  if (model === '417' && !['igic','mixto'].includes(indirect)) data.blockers.push('El modelo 417 solo corresponde a sujetos en el ámbito del IGIC.');
  if (model === '417' && !profile?.usesSII) data.blockers.push('El perfil no consta incluido en el SII-IGIC; revisa si corresponde el modelo 420 en lugar del 417.');
  if (model === '421' && !['igic','mixto'].includes(indirect)) data.blockers.push('El modelo 421 solo corresponde a actividades en régimen simplificado del IGIC.');
  if (model === '421' && !data.activities.some((activity: any) => activity.indirectTaxRegime === 'simplificado')) data.blockers.push('Ninguna actividad activa está configurada en régimen simplificado de IGIC.');
  if (model === '420' && ['incluido', 'transitorio_2026'].includes(profile?.repepStatus)) data.blockers.push('El perfil consta incluido en REPEP: no procede el modelo 420 periódico; debe revisarse el resumen anual 425 y las excepciones que correspondan.');
  if (model === '420' && data.activities.length && data.activities.every((activity: any) => ['pequeno_empresario_igic', 'exenta_limitada', 'no_sujeta'].includes(activity.indirectTaxRegime))) data.blockers.push('Ninguna actividad activa está configurada en régimen general IGIC liquidable mediante el modelo 420.');
  if (model === '425' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El modelo 425 solo corresponde a sujetos y operaciones en el ámbito del IGIC canario.');
  if (model === '425' && year > 2025) data.blockers.push('La ATC todavía no ha publicado el programa anual 425 del ejercicio 2026.');
  if (model === '390' && !['iva', 'mixto'].includes(indirect)) data.blockers.push('El modelo 390 solo corresponde a sujetos y operaciones en territorio IVA.');
  if (model === '390' && year > 2025) data.blockers.push('La AEAT todavía no ha publicado el diseño anual 390 del ejercicio 2026.');
  if (model === '180' && year > 2025) data.blockers.push('El modelo anual 180 del ejercicio 2026 todavía no está abierto ni contrastado con la campaña AEAT correspondiente.');
  if (model === '190' && year > 2025) data.blockers.push('El modelo anual 190 del ejercicio 2026 todavía no está abierto ni contrastado con la campaña AEAT correspondiente.');
  if (model === '193' && year > 2025) data.blockers.push('El modelo anual 193 del ejercicio 2026 todavía no está abierto ni contrastado con la campaña AEAT correspondiente.');
  if (model === '347' && profile?.usesSII) data.blockers.push('El perfil está adscrito al SII y, con carácter general, queda excluido de presentar el modelo 347; confirme cualquier excepción censal.');
  if (model === '415' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El modelo 415 solo corresponde a operaciones en el ámbito del IGIC canario.');
  if (['347', '415'].includes(model) && !(calculation.details || []).length) data.blockers.push('No existen operaciones que superen el umbral por tercero; no procede generar una declaración vacía.');
  if (['111', '115', '123'].includes(model) && !(calculation.details || []).length) data.blockers.push(`No se han detectado pagos sometidos a retención para el modelo ${model}; no debe generarse una autoliquidación negativa por ausencia de rentas pagadas.`);
}

function calculate190(data: any, b: any) {
  const base = calculate111(data, b);
  const groups = new Map<string, any>();
  const records = new Map((data.declarables || []).filter((row: any) => row.modeloCodigo === '190').map((row: any) => [row.recordKey, row]));
  const employeeByTaxId = new Map((data.employees || []).map((employee: any) => [canonical(employee.nif).replace(/\s/g,''), employee]));
  for (const payroll of data.payrolls.filter((item: any) => inRange(item, b.start, b.end))) {
    const taxId = canonical(payroll.employee_tax_id).replace(/\s/g,'');
    const recordKey = `Annual190:Payroll:${taxId || canonical(payroll.employee_name)}`;
    const employee: any = employeeByTaxId.get(taxId);
    const row = groups.get(recordKey) || { recordKey, sourceType:'PayrollExtraction', taxId, name:clean(payroll.employee_name), provinceCode:provinceCode(employee?.provincia), key:'A', subkey:'', base:0, withholding:0, deductibleExpenses:0, sourceIds:[], sourceFacts:[] };
    row.base += money(payroll.total_accruals ?? payroll.gross_salary);
    row.withholding += money(payroll.irpf_amount);
    row.deductibleExpenses += money(payroll.employee_ss_amount);
    row.sourceIds.push(`PayrollExtraction:${payroll.id}`);
    row.sourceFacts.push(`${payroll.id}:${dateOf(payroll).slice(0,10)}:${money(payroll.total_accruals ?? payroll.gross_salary)}:${money(payroll.irpf_amount)}:${money(payroll.employee_ss_amount)}`);
    groups.set(recordKey,row);
  }
  const professional = retainedPaymentEvents(data,b).filter((event:any)=>event.invoice.categoria_gasto==='servicios_profesionales');
  for (const event of professional) {
    const cp=invoiceCounterparty(event.invoice); const taxId=canonical(cp.id).replace(/\s/g,'');
    const rate=Math.abs(event.base)>0?money(Math.abs(event.withholding/event.base)*100):Number(event.invoice.retencion_irpf||0);
    const subkey=Math.abs(rate-7)<0.1?'03':'01'; const recordKey=`Annual190:Professional:${taxId}:${subkey}`;
    const row=groups.get(recordKey)||{recordKey,sourceType:'InvoicePayment',taxId,name:cp.name,provinceCode:provinceCode(cp.province),key:'G',subkey,base:0,withholding:0,deductibleExpenses:0,sourceIds:[],sourceFacts:[]};
    row.base+=event.base; row.withholding+=event.withholding; row.sourceIds.push(...event.sourceIds);
    row.sourceFacts.push(`${event.invoice.id}:${event.sourceIds.join(',')}:${money(event.base)}:${money(event.withholding)}:${subkey}`); groups.set(recordKey,row);
  }
  let pendingReview=0; let incomplete=0; let staleReview=0;
  const details=[...groups.values()].map(row=>{
    const stored:any=records.get(row.recordKey); const payload=sanitize190Payload(stored?.payload||{}); const currentSourceFingerprint=sourceFingerprint(row.sourceFacts);
    const reviewIsCurrent=stored?.reviewStatus==='validado_asesor'&&payload.sourceFingerprint===currentSourceFingerprint;
    const key=clean(payload.key||row.key).toUpperCase(); const subkey=clean(payload.subkey||row.subkey).padStart(2,'0').slice(-2);
    const province=clean(payload.provinceCode||row.provinceCode); const missingFields:string[]=[];
    if(!validSpanishTaxId(row.taxId)) missingFields.push('NIF válido del perceptor');
    if(!row.name) missingFields.push('nombre o razón social del perceptor');
    if(!/^\d{2}$/.test(province)) missingFields.push('código de provincia');
    if(!['A','G'].includes(key)) missingFields.push('clave soportada A o G');
    if(key==='G'&&!['01','02','03','04','05','06','07','08'].includes(subkey)) missingFields.push('subclave profesional G válida');
    if(key==='A') {
      if(!/^\d{4}$/.test(clean(payload.birthYear))) missingFields.push('año de nacimiento');
      if(!['1','2','3'].includes(clean(payload.familySituation))) missingFields.push('situación familiar');
      if(!['1','2','3','4'].includes(clean(payload.contractType))) missingFields.push('tipo de contrato o relación');
    }
    if(clean(payload.accrualYear)&&!/^\d{4}$/.test(clean(payload.accrualYear))) missingFields.push('ejercicio de devengo válido');
    if(!booleanValue(payload.specialDataConfirmed)) missingFields.push('confirmación de la ficha anual');
    if(missingFields.length) incomplete+=1; if(!reviewIsCurrent) pendingReview+=1; if(stored?.reviewStatus==='validado_asesor'&&!reviewIsCurrent) staleReview+=1;
    const manual={representativeTaxId:clean(payload.representativeTaxId),provinceCode:province,key,subkey:key==='A'?'':subkey,accrualYear:clean(payload.accrualYear),birthYear:clean(payload.birthYear),familySituation:clean(payload.familySituation),spouseTaxId:clean(payload.spouseTaxId),disability:clean(payload.disability)||'0',contractType:clean(payload.contractType),ceutaMelilla:booleanValue(payload.ceutaMelilla),mobility:booleanValue(payload.mobility),reductions:money(payload.reductions),deductibleExpenses:payload.deductibleExpenses===undefined?money(row.deductibleExpenses):money(payload.deductibleExpenses),compensatoryPensions:money(payload.compensatoryPensions),childSupport:money(payload.childSupport),specialDataConfirmed:booleanValue(payload.specialDataConfirmed),sourceFingerprint:currentSourceFingerprint};
    return {...row,sourceFacts:undefined,base:money(row.base),withholding:money(row.withholding),key,subkey:key==='A'?'':subkey,provinceCode:province,manual,reviewStatus:reviewIsCurrent?'validado_asesor':'pendiente_revision',missingFields:unique(missingFields),sourceFingerprint:currentSourceFingerprint};
  });
  if(incomplete)data.blockers.push(`${incomplete} registro(s) del modelo 190 necesitan completar su ficha anual.`);
  if(pendingReview)data.blockers.push(`${pendingReview} registro(s) del modelo 190 no han sido validados por un asesor.`);
  if(staleReview)data.warnings.push(`${staleReview} validación(es) del 190 se invalidaron porque cambiaron nóminas o pagos de origen.`);
  if(!details.length)data.blockers.push('No se han detectado percepciones anuales declarables en el modelo 190.');
  return {...base,details};
}

function calculate193(data: any, b: any) {
  const base = calculateSimpleRetention(data, b, '123');
  const records = new Map((data.declarables || []).filter((row: any) => row.modeloCodigo === '193').map((row: any) => [row.recordKey, row]));
  const invoiceById = new Map((data.invoices || []).map((invoice: any) => [invoice.id, invoice]));
  const sourceFacts = base.details.map((detail: any) => `${detail.id}:${money(detail.base)}:${money(detail.withholding)}:${(detail.paymentSources || []).join(',')}`);
  const declarationFingerprint = sourceFingerprint(sourceFacts);
  const declarationStored: any = records.get('Annual193:Declarant');
  const declarationPayload = sanitize193DeclarationPayload(declarationStored?.payload || {});
  const declarationReviewIsCurrent = declarationStored?.reviewStatus === 'validado_asesor' && declarationPayload.sourceFingerprint === declarationFingerprint;
  const declarationMissingFields: string[] = [];
  if (!booleanValue(declarationPayload.expenseAnnexNotApplicable)) declarationMissingFields.push('confirmación de que no procede la relación de gastos del art. 26.1.a LIRPF');
  if (!booleanValue(declarationPayload.specialDataConfirmed)) declarationMissingFields.push('confirmación de la naturaleza del declarante y del anexo de gastos');
  const declaration = {
    recordKey: 'Annual193:Declarant', sourceType: 'TaxDeclarationConfig', sourceIds: base.details.flatMap((detail: any) => detail.paymentSources || []),
    manual: { declarantNatureSpecial: booleanValue(declarationPayload.declarantNatureSpecial), expenseAnnexNotApplicable: booleanValue(declarationPayload.expenseAnnexNotApplicable), specialDataConfirmed: booleanValue(declarationPayload.specialDataConfirmed), sourceFingerprint: declarationFingerprint },
    reviewStatus: declarationReviewIsCurrent ? 'validado_asesor' : 'pendiente_revision', missingFields: declarationMissingFields, sourceFingerprint: declarationFingerprint,
  };
  const allowedNatures: Record<string, string[]> = { A:['01','02','03','04','05','06','07','08'], B:['01','02','03','04','05','06','07'], C:['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15'], D:['01','02','03','04','05','06','07'] };
  let incomplete = 0, pendingReview = 0, staleReview = 0;
  const details = base.details.map((detail: any) => {
    const invoice: any = invoiceById.get(detail.id);
    const recordKey = `Annual193:Invoice:${detail.id}`;
    const stored: any = records.get(recordKey);
    const payload = sanitize193Payload(stored?.payload || {});
    const currentSourceFingerprint = sourceFingerprint([`${detail.id}:${money(detail.base)}:${money(detail.withholding)}:${(detail.paymentSources || []).join(',')}`]);
    const reviewIsCurrent = stored?.reviewStatus === 'validado_asesor' && payload.sourceFingerprint === currentSourceFingerprint;
    const perceptionKey = clean(payload.perceptionKey).toUpperCase();
    const nature = clean(payload.nature).padStart(2, '0').slice(-2);
    const province = clean(payload.provinceCode || provinceCode(invoiceCounterparty(invoice || {}).province));
    const derivedRate = Math.abs(money(detail.base)) > 0 ? money(Math.abs(money(detail.withholding) / money(detail.base)) * 100) : 0;
    const manual: any = {
      representativeTaxId: clean(payload.representativeTaxId), provinceCode: province, recipientMediator: booleanValue(payload.recipientMediator),
      keyCode: clean(payload.keyCode), issuerCode: clean(payload.issuerCode), perceptionKey, nature, paymentRole: clean(payload.paymentRole), accountCodeType: clean(payload.accountCodeType).toUpperCase(), accountCode: clean(payload.accountCode),
      pending: booleanValue(payload.pending), accrualYear: clean(payload.accrualYear), perceptionType: clean(payload.perceptionType) || '1',
      perceptionAmount: payload.perceptionAmount === undefined ? money(detail.base) : money(payload.perceptionAmount), reductions: money(payload.reductions), retentionBase: payload.retentionBase === undefined ? money(detail.base) : money(payload.retentionBase),
      retentionRate: payload.retentionRate === undefined ? derivedRate : money(payload.retentionRate), penalties: money(payload.penalties), isin: clean(payload.isin).toUpperCase(),
      loanStartDate: clean(payload.loanStartDate), loanEndDate: clean(payload.loanEndDate), loanCompensation: money(payload.loanCompensation), loanGuarantees: money(payload.loanGuarantees),
      stateWithholding: money(payload.stateWithholding), navarraWithholding: money(payload.navarraWithholding), alavaWithholding: money(payload.alavaWithholding), gipuzkoaWithholding: money(payload.gipuzkoaWithholding), bizkaiaWithholding: money(payload.bizkaiaWithholding),
      ceutaPalmaCode: clean(payload.ceutaPalmaCode) || '0', previousPayerTaxId: clean(payload.previousPayerTaxId), accrualDate: clean(payload.accrualDate), marketKey: clean(payload.marketKey).toUpperCase(),
      specialDataConfirmed: booleanValue(payload.specialDataConfirmed), sourceFingerprint: currentSourceFingerprint,
    };
    const missingFields: string[] = [];
    if (!validSpanishTaxId(detail.taxId)) missingFields.push('NIF válido del perceptor');
    if (!detail.name) missingFields.push('nombre o razón social del perceptor');
    if (!/^\d{2}$/.test(province)) missingFields.push('código de provincia');
    if (!['A','B','C','D'].includes(perceptionKey)) missingFields.push('clave de percepción A, B, C o D');
    if (!allowedNatures[perceptionKey]?.includes(nature)) missingFields.push('naturaleza compatible con la clave de percepción');
    if (!['1','2'].includes(manual.perceptionType)) missingFields.push('tipo de percepción dineraria o en especie');
    if (manual.accrualYear && !/^\d{4}$/.test(manual.accrualYear)) missingFields.push('ejercicio de devengo válido');
    if (!['0','1','2'].includes(manual.ceutaPalmaCode)) missingFields.push('código Ceuta/Melilla/La Palma válido');
    if (manual.retentionBase < 0 || manual.perceptionAmount < 0 || money(detail.withholding) < 0) missingFields.push('importes positivos exigidos por el diseño');
    if (['A','B','D'].includes(perceptionKey) && !booleanValue(declaration.manual.declarantNatureSpecial)) {
      if (!['1','2','3','4'].includes(manual.keyCode)) missingFields.push('clave de identificación del emisor');
      if (!['1','2','3','4','5'].includes(manual.paymentRole)) missingFields.push('papel del pagador');
      if (!['A','B','C','D'].includes(manual.marketKey)) missingFields.push('clave de mercado');
      if (manual.keyCode === '1' && !validSpanishTaxId(manual.issuerCode)) missingFields.push('NIF válido del emisor');
      if (manual.keyCode === '2' && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(manual.isin)) missingFields.push('código ISIN válido');
      if (manual.keyCode === '3' && !/^Z[A-Z]{2}$/.test(manual.issuerCode)) missingFields.push('código Z más país del emisor extranjero');
      if (manual.keyCode === '4' && (!validSpanishTaxId(manual.issuerCode) || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(manual.isin))) missingFields.push('NIF del emisor e ISIN válidos');
      if (['2','3','4','5'].includes(manual.paymentRole) && !validSpanishTaxId(manual.previousPayerTaxId)) missingFields.push('NIF del pagador anterior');
      if (perceptionKey === 'A' && !/^\d{4}-\d{2}-\d{2}$/.test(manual.accrualDate)) missingFields.push('fecha de devengo del dividendo');
    }
    if (manual.accountCodeType && !['C','O','P'].includes(manual.accountCodeType)) missingFields.push('tipo de código de cuenta/operación válido');
    if (manual.accountCodeType === 'P' && (!/^\d{4}-\d{2}-\d{2}$/.test(manual.loanStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(manual.loanEndDate))) missingFields.push('fechas de inicio y vencimiento del préstamo de valores');
    const allocated = money(manual.stateWithholding + manual.navarraWithholding + manual.alavaWithholding + manual.gipuzkoaWithholding + manual.bizkaiaWithholding);
    if (allocated && Math.abs(allocated - Math.abs(money(detail.withholding))) > 0.01) missingFields.push('reparto territorial de retenciones igual al total retenido');
    if (!manual.specialDataConfirmed) missingFields.push('confirmación de la ficha anual');
    if (missingFields.length) incomplete += 1;
    if (!reviewIsCurrent) pendingReview += 1;
    if (stored?.reviewStatus === 'validado_asesor' && !reviewIsCurrent) staleReview += 1;
    return { ...detail, recordKey, sourceType:'InvoicePayment', sourceIds:detail.paymentSources || [], manual, perceptionKey, nature, provinceCode:province, reviewStatus:reviewIsCurrent?'validado_asesor':'pendiente_revision', missingFields:unique(missingFields), sourceFingerprint:currentSourceFingerprint };
  });
  if (declarationMissingFields.length) data.blockers.push('La configuración general del modelo 193 está incompleta.');
  if (!declarationReviewIsCurrent) data.blockers.push('La configuración general del modelo 193 no ha sido validada por un asesor.');
  if (incomplete) data.blockers.push(`${incomplete} registro(s) del modelo 193 necesitan completar su ficha anual.`);
  if (pendingReview) data.blockers.push(`${pendingReview} registro(s) del modelo 193 no han sido validados por un asesor.`);
  if (staleReview || (declarationStored?.reviewStatus === 'validado_asesor' && !declarationReviewIsCurrent)) data.warnings.push('Se invalidaron validaciones del 193 porque cambiaron pagos o facturas de origen.');
  if (!details.length) data.blockers.push('No se han detectado rentas anuales declarables en el modelo 193.');
  return { ...base, details, declaration };
}

function calculateAnnualRetention(data: any, b: any, model: '180'|'190'|'193') {
  if (model === '180') {
    const base = calculateSimpleRetention(data, b, '115');
    const records = new Map((data.declarables || []).filter((row: any) => row.modeloCodigo === '180').map((row: any) => [row.recordKey, row]));
    let incomplete = 0;
    let pendingReview = 0;
    const details = base.details.map((detail: any) => {
      const recordKey = `Invoice:${detail.id}`;
      const stored: any = records.get(recordKey);
      const invoice = data.invoices.find((item: any) => item.id === detail.id);
      const payload = stored?.payload || {};
      const derivedRate = detail.base ? money(Math.abs(detail.withholding / detail.base) * 100) : 0;
      const manual = {
        representativeTaxId: clean(payload.representativeTaxId),
        recipientProvinceCode: clean(payload.recipientProvinceCode) || provinceCode(invoiceCounterparty(invoice || {}).province),
        modality: ['1','2'].includes(clean(payload.modality)) ? clean(payload.modality) : '1',
        withholdingRate: payload.withholdingRate == null ? derivedRate : money(payload.withholdingRate),
        accrualYear: /^\d{4}$/.test(clean(payload.accrualYear)) ? clean(payload.accrualYear) : '0000',
        propertySituation: clean(payload.propertySituation),
        cadastralReference: clean(payload.cadastralReference),
        roadType: clean(payload.roadType), roadName: clean(payload.roadName), numberingType: clean(payload.numberingType) || 'NUM',
        houseNumber: clean(payload.houseNumber), numberQualifier: clean(payload.numberQualifier), block: clean(payload.block), portal: clean(payload.portal),
        stair: clean(payload.stair), floor: clean(payload.floor), door: clean(payload.door), complement: clean(payload.complement),
        locality: clean(payload.locality), municipality: clean(payload.municipality), municipalityCode: clean(payload.municipalityCode),
        propertyProvinceCode: clean(payload.propertyProvinceCode), postalCode: clean(payload.postalCode),
      };
      const missingFields: string[] = [];
      if (!/^\d{2}$/.test(manual.recipientProvinceCode)) missingFields.push('provincia del perceptor');
      if (!['1','2','3','4'].includes(manual.propertySituation)) missingFields.push('situación del inmueble');
      if (manual.propertySituation !== '4' && !manual.cadastralReference) missingFields.push('referencia catastral');
      if (!manual.roadType) missingFields.push('tipo de vía');
      if (!manual.roadName) missingFields.push('nombre de vía');
      if (!manual.municipality) missingFields.push('municipio');
      if (!/^\d{5}$/.test(manual.municipalityCode)) missingFields.push('código INE de municipio');
      if (!/^\d{2}$/.test(manual.propertyProvinceCode)) missingFields.push('provincia del inmueble');
      if (!/^\d{5}$/.test(manual.postalCode)) missingFields.push('código postal');
      if (missingFields.length) incomplete += 1;
      if (stored?.reviewStatus !== 'validado_asesor') pendingReview += 1;
      return { ...detail, recordKey, manual, enrichmentId: stored?.id, reviewStatus: stored?.reviewStatus || 'pendiente_revision', missingFields };
    });
    if (incomplete) data.blockers.push(`${incomplete} registro(s) del modelo 180 no tienen completa la ficha oficial del inmueble.`);
    if (pendingReview) data.blockers.push(`${pendingReview} registro(s) del modelo 180 no han sido validados por un asesor.`);
    if (!details.length) data.blockers.push('No se han detectado pagos de alquiler con retención para el resumen anual 180.');
    return { ...base, details };
  }
  if (model === '193') return calculate193(data, b);
  return calculate190(data,b);
}

function calculate(model: string, data: any, b: any, adjustments: any) {
  if (model === '111') return calculate111(data, b);
  if (model === '115' || model === '123') return calculateSimpleRetention(data, b, model);
  if (model === '130') return calculate130(data, b, adjustments);
  if (model === '131') return calculate131(data, b, adjustments);
  if (model === '200') return calculate200(data, b, adjustments);
  if (model === '202') return calculate202(data, b, adjustments);
  if (model === '216') return calculate216(data, b, adjustments);
  if (model === '232') return calculate232(data, b);
  if (model === '296') return calculate296(data, b);
  if (model === '303') return calculateIndirectTax(data, b, 'iva', false, adjustments);
  if (model === '349') return calculate349(data, b);
  if (model === '417') return calculateIndirectTax(data, b, 'igic', false, adjustments, '417');
  if (model === '420') return calculateIndirectTax(data, b, 'igic', false, adjustments);
  if (model === '421') return calculate421(data, b, adjustments);
  if (model === '390') return calculateIndirectTax(data, b, 'iva', true);
  if (model === '425') return calculateIndirectTax(data, b, 'igic', true);
  if (model === '347' || model === '415') return calculateThirdParties(data, b, model);
  if (model === '180' || model === '190' || model === '193') return calculateAnnualRetention(data, b, model);
  throw Object.assign(new Error(`Modelo ${model} no implementado.`), { status: 400 });
}

function normalizedText(value: unknown, length: number) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 &.,\/-]/g, ' ').replace(/\s+/g, ' ').slice(0, length).padEnd(length, ' ');
}

function leftPaddedText(value: unknown, length: number, fill = ' ') {
  return normalizedText(value, length).trim().slice(-length).padStart(length, fill);
}

function numeric(value: unknown, length: number, signed = false, decimals = 2) {
  const amount = Number(value) || 0;
  const digits = String(Math.round(Math.abs(amount) * Math.pow(10, decimals)));
  if (signed && amount < 0) return `N${digits.padStart(length - 1, '0').slice(-(length - 1))}`;
  return digits.padStart(length, '0').slice(-length);
}

function signedAmount(value: unknown, length = 16) {
  const amount = Number(value) || 0;
  return `${amount < 0 ? 'N' : ' '}${numeric(amount, length - 1)}`;
}

function sequentialDeclarationNumber(model: string) {
  return `${model}${String(Math.floor(Date.now() / 1000)).padStart(10, '0').slice(-10)}`;
}

function place(buffer: string[], position: number, length: number, value: string) {
  const text = value.slice(0, length).padEnd(length, ' ');
  for (let i = 0; i < length; i++) buffer[position - 1 + i] = text[i];
}

function page(length: number, endPosition: number, endMarker: string) {
  const buffer = Array(length).fill(' ');
  place(buffer, endPosition, endMarker.length, endMarker);
  return buffer;
}

function fieldMap(calculation: any) {
  return Object.fromEntries((calculation.fields || []).map((f: any) => [f.code, Number(f.value) || 0]));
}

function declarationType(result: number) { return result > 0 ? 'I' : 'N'; }

function export111(company: any, year: number, period: string, calculation: any) {
  const values = fieldMap(calculation), p = page(1000, 989, '</T11101000>');
  place(p,1,11,'<T11101000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,83,20,' '.repeat(20)); place(p,103,4,String(year)); place(p,107,2,period);
  place(p,109,8,numeric(values['01'],8,false,0)); place(p,117,17,numeric(values['02'],17)); place(p,134,17,numeric(values['03'],17)); place(p,193,8,numeric(values['07'],8,false,0)); place(p,201,17,numeric(values['08'],17)); place(p,218,17,numeric(values['09'],17)); place(p,487,17,numeric(values['28'],17)); place(p,504,17,numeric(0,17,true)); place(p,521,17,numeric(values['30'],17));
  return p.join('');
}

function export115(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(500,489,'</T11501000>'); place(p,1,11,'<T11501000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,103,4,String(year)); place(p,107,2,period); place(p,109,15,numeric(v['01'],15,false,0)); place(p,124,17,numeric(v['02'],17)); place(p,141,17,numeric(v['03'],17)); place(p,158,17,numeric(0,17)); place(p,175,17,numeric(v['05'],17)); return p.join('');
}

function export123(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(600,589,'</T12301000>'); place(p,1,11,'<T12301000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,80,normalizedText(company.razon_social,80)); place(p,103,4,String(year)); place(p,107,2,period); place(p,109,15,numeric(0,15,false,0)); place(p,124,15,numeric(v['03'],15,false,0)); place(p,139,15,numeric(v['03'],15,false,0)); place(p,154,17,numeric(0,17)); place(p,171,17,numeric(v['06'],17)); place(p,188,17,numeric(v['06'],17)); place(p,205,17,numeric(0,17)); place(p,222,17,numeric(v['09'],17)); place(p,239,17,numeric(v['09'],17)); place(p,290,17,numeric(v['12'],17)); place(p,307,17,numeric(0,17)); place(p,324,17,numeric(v['14'],17)); return p.join('');
}

function export130(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(600,589,'</T13001000>'); place(p,1,11,'<T13001000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,103,4,String(year)); place(p,107,2,period);
  const positions:any={'01':109,'02':126,'03':143,'04':160,'05':177,'06':194,'07':211,'08':228,'09':245,'10':262,'11':279,'12':296,'13':313,'14':330,'15':347,'16':364,'17':381,'18':398,'19':415}; const signed=new Set(['03','07','11','14','17','19']); Object.entries(positions).forEach(([code,pos])=>place(p,Number(pos),17,numeric(v[code]||0,17,signed.has(code)))); return p.join('');
}

function export303(company: any, profile: any, year: number, period: string, calculation: any) {
  const o=calculation.operations||{}, values=fieldMap(calculation), rates=new Map((o.rates||[]).map((r:any)=>[Number(r.rate),r]));
  const p1=page(1581,1570,'</T30301000>'); place(p1,1,11,'<T30301000>'); place(p1,13,1,declarationType(calculation.result)); place(p1,14,9,normalizedText(company.nif_cif,9)); place(p1,23,80,normalizedText(company.razon_social,80)); place(p1,103,4,String(year)); place(p1,107,2,period); place(p1,109,1,'2'); place(p1,110,1,profile?.isREDEME?'1':'2'); place(p1,111,1,'3'); place(p1,112,1,'2'); place(p1,113,1,o.criterionCash?'1':'2'); place(p1,114,1,'2'); place(p1,115,1,'2'); place(p1,116,1,'2'); place(p1,117,1,'2'); place(p1,127,1,profile?.usesSII?'1':'2'); place(p1,128,1,['4T','12'].includes(period)?'2':'0'); place(p1,129,1,['4T','12'].includes(period)?'1':'0'); place(p1,130,1,['01','1T','2T','3T','4T'].includes(period)?'0':'2');
  const rateFields:Record<string, number[]>={0:[131,148,153],4:[209,226,231],10:[287,304,309],21:[326,343,348]}; for(const [rate,positions] of Object.entries(rateFields)){const row:any=rates.get(Number(rate))||{}; place(p1,positions[0],17,numeric(row.base,17)); place(p1,positions[1],5,numeric(Number(rate),5,false,2)); place(p1,positions[2],17,numeric(row.quota,17));}
  place(p1,365,17,numeric(o.intraBase,17)); place(p1,382,17,numeric(o.intraQuota,17)); place(p1,399,17,numeric(o.reverseBase,17)); place(p1,416,17,numeric(o.reverseQuota,17)); place(p1,696,17,numeric(o.outputQuota,17,true)); place(p1,713,17,numeric(o.deductibleBase,17)); place(p1,730,17,numeric(o.deductibleQuota,17)); place(p1,1002,17,numeric(o.deductibleQuota,17,true)); place(p1,1019,17,numeric(calculation.result,17,true));
  const p3=page(1017,1006,'</T30303000>'); place(p3,1,11,'<T30303000>'); place(p3,12,17,numeric(o.intraSupplies,17,true)); place(p3,29,17,numeric(o.exports,17,true)); place(p3,46,17,numeric(o.nonSubject,17,true)); place(p3,63,17,numeric(o.reverseBase,17,true)); place(p3,199,17,numeric(o.rawResult??calculation.result,17,true)); place(p3,216,5,numeric(100,5,false,2)); place(p3,221,17,numeric(o.rawResult??calculation.result,17,true)); place(p3,255,17,numeric(values['110'],17)); place(p3,272,17,numeric(values['78'],17)); place(p3,289,17,numeric(values['87'],17)); place(p3,340,17,numeric(calculation.result,17,true)); place(p3,408,17,numeric(calculation.result,17,true)); place(p3,425,1,(calculation.details||[]).length?' ':'X');
  return p1.join('')+p3.join('');
}

function export390(company: any, profile: any, activities: any[], year: number, calculation: any, filings: any[]) {
  const pageOrder = ['01000','02000','02B00','03000','04000','05000','06000','07000','08000'];
  const pages: Record<string, string[]> = {};
  for (const pageCode of pageOrder) {
    const layout = MODEL390_LAYOUT[pageCode];
    const buffer = Array(layout.length).fill(' ');
    for (const [position, length, decimals] of layout.numeric || []) place(buffer, position, length, numeric(0, length, false, decimals));
    place(buffer, 1, 11, `<T390${pageCode}>`);
    place(buffer, layout.length - 11, 12, `</T390${pageCode}>`);
    pages[pageCode] = buffer;
  }
  const putBox = (code: string, value: number | string) => {
    const target = String(code).padStart(2, '0');
    for (const pageCode of pageOrder) for (const [box, position, length, decimals] of MODEL390_LAYOUT[pageCode].boxes || []) {
      if (box !== target) continue;
      place(pages[pageCode], position, length, typeof value === 'string' ? normalizedText(value, length) : numeric(value, length, value < 0, decimals));
    }
  };
  const p1 = pages['01000'];
  place(p1,14,9,normalizedText(company.nif_cif,9)); place(p1,23,60,normalizedText(company.razon_social,60)); place(p1,103,4,String(year));
  place(p1,109,1,profile?.isREDEME?'1':'0'); place(p1,110,1,profile?.isGroupEntity?'1':'0'); place(p1,130,1,profile?.hasInsolvencyProceedings?'1':'0'); place(p1,131,1,(calculation.operations?.criterionCash||0)?'1':'0'); place(p1,132,1,(calculation.operations?.criterionCashReceived||0)?'1':'0');
  const activeActivities = (activities || []).filter(activity => activity.active !== false).slice(0, 6);
  activeActivities.forEach((activity, index) => {
    const start = 148 + index * 47;
    place(p1,start,40,normalizedText(activity.name,40)); place(p1,start+40,3,normalizedText(activity.iaeActivityCode,3)); place(p1,start+43,4,normalizedText(activity.iaeCode,4));
  });

  const outputRateBoxes: Record<string, Record<string, string[]>> = {
    ordinary: {'0':['700','701'],'2':['667','668'],'4':['01','02'],'5':['702','703'],'7.5':['669','670'],'10':['03','04'],'21':['05','06']},
    intragroup: {'0':['704','705'],'2':['671','672'],'4':['500','501'],'5':['706','707'],'7.5':['673','674'],'10':['502','503'],'21':['504','505']},
    cash: {'0':['708','709'],'2':['675','676'],'4':['643','644'],'5':['710','711'],'7.5':['677','678'],'10':['645','646'],'21':['647','648']},
    margin: {'0':['712','713'],'2':['679','680'],'4':['07','08'],'5':['714','715'],'7.5':['681','682'],'10':['09','10'],'21':['11','12']},
    travel: {'21':['13','14']},
  };
  const outputRows = calculation.operations?.categorizedOutputRates?.length ? calculation.operations.categorizedOutputRates : (calculation.operations?.rates || []).map((row: any) => ({...row, category:'ordinary'}));
  for (const row of outputRows) {
    const boxes = outputRateBoxes[row.category]?.[String(Number(row.rate))];
    if (boxes) { putBox(boxes[0], row.base); putBox(boxes[1], row.quota); }
  }
  const intraOutputBoxes: Record<string,string[]> = {'0':['716','717'],'2':['683','684'],'4':['21','22'],'5':['718','719'],'7.5':['685','686'],'10':['23','24'],'21':['25','26']};
  const intraRate = calculation.operations?.intraBase ? Number(((calculation.operations.intraQuota / calculation.operations.intraBase) * 100).toFixed(2)) : 0;
  if (calculation.operations?.intraBase && intraOutputBoxes[String(intraRate)]) { putBox(intraOutputBoxes[String(intraRate)][0],calculation.operations.intraBase); putBox(intraOutputBoxes[String(intraRate)][1],calculation.operations.intraQuota); }
  putBox('27',calculation.operations?.reverseBase||0); putBox('28',calculation.operations?.reverseQuota||0);
  const totalOutputBase = money(outputRows.reduce((sum:number,row:any)=>sum+money(row.base),0)+(calculation.operations?.intraBase||0)+(calculation.operations?.reverseBase||0));
  putBox('33',totalOutputBase); putBox('34',calculation.operations?.outputQuota||0); putBox('47',calculation.operations?.outputQuota||0);

  const deductionRateBoxes: Record<string, Record<string, string[]>> = {
    interior_current: {'2':['695','696'],'4':['190','191'],'5':['724','725'],'7.5':['697','698'],'10':['603','604'],'21':['605','606']},
    interior_investment: {'2':['749','750'],'4':['196','197'],'5':['728','729'],'7.5':['751','752'],'10':['611','612'],'21':['613','614']},
    import_current: {'2':['757','758'],'4':['202','203'],'5':['732','733'],'7.5':['759','760'],'10':['619','620'],'21':['621','622']},
    import_investment: {'2':['761','762'],'4':['208','209'],'5':['734','735'],'7.5':['763','764'],'10':['623','624'],'21':['625','626']},
    intra_goods_current: {'2':['765','766'],'4':['214','215'],'5':['736','737'],'7.5':['767','768'],'10':['627','628'],'21':['629','630']},
    intra_goods_investment: {'2':['769','770'],'4':['220','221'],'5':['738','739'],'7.5':['771','772'],'10':['631','632'],'21':['633','634']},
    intra_services: {'2':['773','774'],'4':['587','588'],'5':['740','741'],'7.5':['775','776'],'10':['635','636'],'21':['637','638']},
  };
  const deductionTotals: Record<string,string[]> = {interior_current:['48','49'],interior_investment:['50','51'],import_current:['52','53'],import_investment:['54','55'],intra_goods_current:['56','57'],intra_goods_investment:['58','59'],intra_services:['597','598']};
  const categoryTotals = new Map<string,{base:number,quota:number}>();
  for (const row of calculation.operations?.deductibleRates || []) {
    const boxes = deductionRateBoxes[row.category]?.[String(Number(row.rate))];
    if (boxes) { putBox(boxes[0],row.base); putBox(boxes[1],row.quota); }
    const total = categoryTotals.get(row.category) || {base:0,quota:0}; total.base += money(row.base); total.quota += money(row.quota); categoryTotals.set(row.category,total);
  }
  for (const [category,total] of categoryTotals) { const boxes=deductionTotals[category]; if(boxes){putBox(boxes[0],total.base);putBox(boxes[1],total.quota);} }
  putBox('64',calculation.operations?.deductibleQuota||0); putBox('65',calculation.result||0);

  const filed303 = (filings || []).filter(row => row.modeloCodigo === '303' && Number(row.ejercicio) === year && FILED_STATUSES.has(clean(row.estadoPresentacion)));
  const last303 = [...filed303].sort((a:any,b:any)=>`${normalizedPeriod(b.periodo)}|${filingDate(b)}`.localeCompare(`${normalizedPeriod(a.periodo)}|${filingDate(a)}`))[0];
  putBox('84',calculation.result||0); putBox('86',calculation.result||0); putBox('87',100);
  putBox('95',filed303.reduce((sum,row)=>sum+Math.max(0,money(row.importeFinal)),0));
  if(last303?.resultadoDestino==='a_compensar') putBox('97',Math.abs(money(last303.importeFinal))); if(last303?.resultadoDestino==='a_devolver') putBox('98',Math.abs(money(last303.importeFinal)));
  const generalVolume = money(outputRows.filter((row:any)=>!['cash'].includes(row.category)).reduce((sum:number,row:any)=>sum+money(row.base),0));
  putBox('99',generalVolume); putBox('653',calculation.operations?.criterionCash||0); putBox('103',calculation.operations?.intraSupplies||0); putBox('104',calculation.operations?.exports||0); putBox('105',calculation.operations?.exemptLimited||0); putBox('110',calculation.operations?.nonSubject||0); putBox('125',calculation.operations?.reverseBase||0);
  putBox('108',money(generalVolume+(calculation.operations?.criterionCash||0)+(calculation.operations?.intraSupplies||0)+(calculation.operations?.exports||0)+(calculation.operations?.exemptLimited||0)+(calculation.operations?.nonSubject||0)+(calculation.operations?.reverseBase||0)));
  putBox('232',calculation.operations?.nonDeductibleBase||0); putBox('654',calculation.operations?.criterionCash||0); putBox('655',calculation.operations?.criterionCashQuota||0); putBox('656',calculation.operations?.criterionCashReceived||0); putBox('657',calculation.operations?.criterionCashReceivedQuota||0);
  activeActivities.slice(0,5).forEach((activity,index)=>{const start=240+index*83; place(pages['07000'],start,3,normalizedText(activity.cnaeCode,3)); place(pages['07000'],start+37,1,['prorrata_general','prorrata_especial'].includes(activity.deductionRight)?(activity.deductionRight==='prorrata_especial'?'2':'1'):'0'); place(pages['07000'],start+38,5,numeric(Number(activity.proRataPercent??100),5,false,2));});
  return pageOrder.map(code=>pages[code].join('')).join('');
}

function export180(company: any, year: number, calculation: any, declarationNumber: string) {
  const details = calculation.details || [];
  const header = Array(500).fill(' ');
  place(header,1,1,'1'); place(header,2,3,'180'); place(header,5,4,String(year)); place(header,9,9,normalizedText(company.nif_cif,9));
  place(header,18,40,normalizedText(company.razon_social,40)); place(header,58,1,'T');
  place(header,59,9,numeric(clean(company.telefono).replace(/\D/g,''),9,false,0)); place(header,68,40,normalizedText(company.razon_social,40));
  place(header,108,13,declarationNumber); place(header,121,2,'  '); place(header,123,13,numeric(0,13,false,0));
  place(header,136,9,numeric(details.length,9,false,0)); place(header,145,16,signedAmount(details.reduce((sum:number,row:any)=>sum+money(row.base),0),16));
  place(header,161,15,numeric(details.reduce((sum:number,row:any)=>sum+Math.abs(money(row.withholding)),0),15));
  const records=details.map((row:any)=>{
    const m=row.manual||{}; const record=Array(500).fill(' ');
    place(record,1,1,'2'); place(record,2,3,'180'); place(record,5,4,String(year)); place(record,9,9,normalizedText(company.nif_cif,9));
    place(record,18,9,normalizedText(row.taxId,9)); place(record,27,9,normalizedText(m.representativeTaxId,9)); place(record,36,40,normalizedText(row.name,40));
    place(record,76,2,numeric(m.recipientProvinceCode,2,false,0)); place(record,78,1,m.modality||'1'); place(record,79,14,signedAmount(row.base,14));
    place(record,93,4,numeric(m.withholdingRate,4,false,2)); place(record,97,13,numeric(Math.abs(money(row.withholding)),13)); place(record,110,4,numeric(m.accrualYear||0,4,false,0));
    place(record,114,1,m.propertySituation); place(record,115,20,normalizedText(m.cadastralReference,20));
    place(record,135,5,normalizedText(m.roadType,5)); place(record,140,50,normalizedText(m.roadName,50)); place(record,190,3,normalizedText(m.numberingType,3));
    place(record,193,5,normalizedText(m.houseNumber,5)); place(record,198,3,normalizedText(m.numberQualifier,3)); place(record,201,3,normalizedText(m.block,3));
    place(record,204,3,normalizedText(m.portal,3)); place(record,207,3,normalizedText(m.stair,3)); place(record,210,3,normalizedText(m.floor,3)); place(record,213,3,normalizedText(m.door,3));
    place(record,216,40,normalizedText(m.complement,40)); place(record,256,30,normalizedText(m.locality,30)); place(record,286,30,normalizedText(m.municipality,30));
    place(record,316,5,numeric(m.municipalityCode,5,false,0)); place(record,321,2,numeric(m.propertyProvinceCode,2,false,0)); place(record,323,5,numeric(m.postalCode,5,false,0));
    return record.join('');
  });
  return [header.join(''),...records].join('\r\n');
}

function export190(company: any, year: number, calculation: any, declarationNumber: string) {
  const details=[...(calculation.details||[])].sort((a:any,b:any)=>`${a.taxId}|${a.key}|${a.subkey}`.localeCompare(`${b.taxId}|${b.key}|${b.subkey}`));
  const header=Array(500).fill(' '); const totalPerceptions=details.reduce((sum:number,row:any)=>sum+money(row.base),0); const totalWithholding=details.reduce((sum:number,row:any)=>sum+Math.abs(money(row.withholding)),0);
  place(header,1,1,'1'); place(header,2,3,'190'); place(header,5,4,String(year)); place(header,9,9,normalizedText(company.nif_cif,9)); place(header,18,40,normalizedText(company.razon_social,40));
  place(header,58,1,'T'); place(header,59,9,numeric(clean(company.telefono).replace(/\D/g,''),9,false,0)); place(header,68,40,normalizedText(company.razon_social,40));
  place(header,108,13,declarationNumber); place(header,121,2,'  '); place(header,123,13,numeric(0,13,false,0)); place(header,136,9,numeric(details.length,9,false,0));
  place(header,145,16,signedAmount(totalPerceptions)); place(header,161,15,numeric(totalWithholding,15)); place(header,176,50,normalizedText(company.email||company.owner_email,50));
  const records=details.map((row:any)=>{const m=row.manual||{}; const record=Array(500).fill(' '); place(record,1,1,'2'); place(record,2,3,'190'); place(record,5,4,String(year)); place(record,9,9,normalizedText(company.nif_cif,9)); place(record,18,9,normalizedText(row.taxId,9)); place(record,27,9,normalizedText(m.representativeTaxId,9)); place(record,36,40,normalizedText(row.name,40)); place(record,76,2,numeric(row.provinceCode,2,false,0)); place(record,78,1,row.key); place(record,79,2,row.key==='A'?'00':numeric(row.subkey,2,false,0));
    place(record,81,1,row.base<0?'N':' '); place(record,82,13,numeric(Math.abs(row.base),13)); place(record,95,13,numeric(Math.abs(row.withholding),13));
    place(record,108,1,' '); place(record,109,13,numeric(0,13)); place(record,122,13,numeric(0,13)); place(record,135,13,numeric(0,13)); place(record,148,4,/^\d{4}$/.test(m.accrualYear||'')?m.accrualYear:'0000');
    place(record,152,1,m.ceutaMelilla?'1':'0'); place(record,153,4,numeric(m.birthYear,4,false,0)); place(record,157,1,m.familySituation||'0'); place(record,158,9,normalizedText(m.spouseTaxId,9)); place(record,167,1,m.disability||'0'); place(record,168,1,m.contractType||'0'); place(record,169,1,'0'); place(record,170,1,m.mobility?'1':'0');
    place(record,171,13,numeric(m.reductions,13)); place(record,184,13,numeric(m.deductibleExpenses,13)); place(record,197,13,numeric(m.compensatoryPensions,13)); place(record,210,13,numeric(m.childSupport,13));
    place(record,223,6,numeric(0,6,false,0)); place(record,229,12,numeric(0,12,false,0)); place(record,241,4,numeric(0,4,false,0)); place(record,245,6,numeric(0,6,false,0)); place(record,251,3,numeric(0,3,false,0)); place(record,254,1,'0');
    place(record,255,1,' '); place(record,256,13,numeric(0,13)); place(record,269,13,numeric(0,13)); place(record,282,1,' '); place(record,283,13,numeric(0,13)); place(record,296,13,numeric(0,13)); place(record,309,13,numeric(0,13)); place(record,322,1,'0'); place(record,323,65,numeric(0,65,false,0)); place(record,388,1,'0'); place(record,389,1,'0'); place(record,390,5,numeric(0,5,false,0)); return record.join('');});
  return [header.join(''),...records].join('\r\n');
}

function export193(company: any, year: number, calculation: any, declarationNumber: string) {
  const details = [...(calculation.details || [])].sort((a:any,b:any)=>`${a.taxId}|${a.perceptionKey}|${a.nature}|${a.recordKey}`.localeCompare(`${b.taxId}|${b.perceptionKey}|${b.nature}|${b.recordKey}`));
  const declaration = calculation.declaration?.manual || {};
  const specialDeclarant = booleanValue(declaration.declarantNatureSpecial);
  const totalBase = details.reduce((sum:number,row:any)=>sum + money(row.manual?.retentionBase), 0);
  const totalWithholding = details.reduce((sum:number,row:any)=>sum + Math.abs(money(row.withholding)), 0);
  const totalDeposited = specialDeclarant ? 0 : details.reduce((sum:number,row:any)=>sum + (row.perceptionKey === 'C' || ['1','3'].includes(clean(row.manual?.paymentRole)) ? Math.abs(money(row.withholding)) : 0), 0);
  const header = Array(500).fill(' ');
  place(header,1,1,'1'); place(header,2,3,'193'); place(header,5,4,String(year)); place(header,9,9,normalizedText(company.nif_cif,9)); place(header,18,40,normalizedText(company.razon_social,40));
  place(header,58,1,'T'); place(header,59,9,numeric(clean(company.telefono).replace(/\D/g,''),9,false,0)); place(header,68,40,normalizedText(company.razon_social,40));
  place(header,108,13,declarationNumber); place(header,121,2,'  '); place(header,123,13,numeric(0,13,false,0)); place(header,136,9,numeric(details.length,9,false,0));
  place(header,145,15,numeric(totalBase,15)); place(header,160,15,numeric(totalWithholding,15)); place(header,175,15,numeric(totalDeposited,15)); place(header,220,15,numeric(0,15)); place(header,235,1,specialDeclarant?'S':' ');
  const dateDDMMYYYY = (value: unknown) => { const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value)); return match ? `${match[3]}${match[2]}${match[1]}` : '00000000'; };
  const records = details.map((row:any,index:number)=>{
    const m=row.manual||{}; const key=clean(row.perceptionKey||m.perceptionKey).toUpperCase(); const capital=['A','B','D'].includes(key); const managed=capital&&!specialDeclarant;
    const record=Array(500).fill(' '); place(record,1,1,'2'); place(record,2,3,'193'); place(record,5,4,String(year)); place(record,9,9,normalizedText(company.nif_cif,9));
    place(record,18,9,normalizedText(row.taxId,9)); place(record,27,9,normalizedText(m.representativeTaxId,9)); place(record,36,40,normalizedText(row.name,40));
    place(record,76,1,managed&&m.recipientMediator?'X':' '); place(record,77,2,numeric(row.provinceCode,2,false,0)); place(record,79,1,managed?numeric(m.keyCode,1,false,0):'0'); place(record,80,12,managed?normalizedText(m.issuerCode,12):' '.repeat(12));
    place(record,92,1,key); place(record,93,2,numeric(row.nature,2,false,0)); place(record,95,1,managed?numeric(m.paymentRole,1,false,0):'0'); place(record,96,1,managed?normalizedText(m.accountCodeType,1):' '); place(record,97,20,managed?normalizedText(m.accountCode,20):' '.repeat(20));
    place(record,117,1,managed&&m.pending?'X':' '); place(record,118,4,managed&&/^\d{4}$/.test(clean(m.accrualYear))?m.accrualYear:'0000'); place(record,122,1,numeric(m.perceptionType,1,false,0));
    place(record,123,13,numeric(m.perceptionAmount,13)); place(record,139,13,numeric(m.reductions,13)); place(record,152,13,numeric(m.retentionBase,13)); place(record,165,4,numeric(m.retentionRate,4)); place(record,169,13,numeric(Math.abs(money(row.withholding)),13));
    place(record,182,11,numeric(managed?m.penalties:0,11)); place(record,193,12,managed?normalizedText(m.isin,12):' '.repeat(12)); place(record,208,1,specialDeclarant?'S':' ');
    place(record,209,8,managed&&m.accountCodeType==='P'?dateDDMMYYYY(m.loanStartDate):numeric(0,8,false,0)); place(record,217,8,managed&&m.accountCodeType==='P'?dateDDMMYYYY(m.loanEndDate):numeric(0,8,false,0));
    place(record,225,12,numeric(managed&&m.accountCodeType==='P'?m.loanCompensation:0,12)); place(record,237,12,numeric(managed&&m.accountCodeType==='P'?m.loanGuarantees:0,12));
    place(record,249,13,numeric(m.stateWithholding,13)); place(record,262,13,numeric(m.navarraWithholding,13)); place(record,275,13,numeric(m.alavaWithholding,13)); place(record,288,13,numeric(m.gipuzkoaWithholding,13)); place(record,301,13,numeric(m.bizkaiaWithholding,13));
    place(record,314,1,numeric(m.ceutaPalmaCode,1,false,0)); place(record,315,7,numeric(index+1,7,false,0)); place(record,322,9,managed?normalizedText(m.previousPayerTaxId,9):' '.repeat(9));
    place(record,331,8,key==='A'?dateDDMMYYYY(m.accrualDate):numeric(0,8,false,0)); place(record,339,1,managed?normalizedText(m.marketKey,1):' '); return record.join('');
  });
  return [header.join(''),...records].join('\r\n');
}

function export347(company: any, year: number, calculation: any, declarationNumber: string) {
  const details = [...(calculation.details || [])].sort((a: any, b: any) => `${a.taxId}|${a.operationKey}`.localeCompare(`${b.taxId}|${b.operationKey}`));
  const header = Array(500).fill(' ');
  place(header, 1, 1, '1'); place(header, 2, 3, '347'); place(header, 5, 4, String(year));
  place(header, 9, 9, normalizedText(company.nif_cif, 9)); place(header, 18, 40, normalizedText(company.razon_social, 40));
  place(header, 58, 1, 'T'); place(header, 59, 9, numeric(clean(company.telefono).replace(/\D/g, ''), 9, false, 0));
  place(header, 108, 13, declarationNumber); place(header, 123, 13, numeric(0, 13, false, 0));
  place(header, 136, 9, numeric(details.length, 9, false, 0));
  place(header, 145, 16, signedAmount(details.reduce((sum: number, row: any) => sum + money(row.total), 0)));
  place(header, 161, 9, numeric(0, 9, false, 0)); place(header, 170, 16, signedAmount(0));
  const records = details.map((row: any) => {
    const record = Array(500).fill(' ');
    const country = normalizedCountry(row.country) || 'ES';
    place(record, 1, 1, '2'); place(record, 2, 3, '347'); place(record, 5, 4, String(year)); place(record, 9, 9, normalizedText(company.nif_cif, 9));
    if (country === 'ES') place(record, 18, 9, normalizedText(row.taxId, 9));
    place(record, 36, 40, normalizedText(row.name, 40)); place(record, 76, 1, 'D');
    place(record, 77, 2, country === 'ES' ? row.provinceCode : '99'); place(record, 79, 2, country === 'ES' ? '  ' : country);
    place(record, 82, 1, row.operationKey); place(record, 83, 16, signedAmount(row.total));
    place(record, 101, 15, numeric(row.cashAmount, 15)); place(record, 116, 16, signedAmount(row.propertyTransferAmount));
    place(record, 132, 4, row.cashAmount ? row.cashYear : '0000');
    place(record, 136, 16, signedAmount(row.quarters?.T1)); place(record, 152, 16, signedAmount(row.transferQuarters?.T1));
    place(record, 168, 16, signedAmount(row.quarters?.T2)); place(record, 184, 16, signedAmount(row.transferQuarters?.T2));
    place(record, 200, 16, signedAmount(row.quarters?.T3)); place(record, 216, 16, signedAmount(row.transferQuarters?.T3));
    place(record, 232, 16, signedAmount(row.quarters?.T4)); place(record, 248, 16, signedAmount(row.transferQuarters?.T4));
    if (country !== 'ES') place(record, 264, 17, normalizedText(row.taxId, 17));
    place(record, 281, 1, row.cashAccounting ? 'X' : ' '); place(record, 282, 1, row.reverseCharge ? 'X' : ' ');
    place(record, 284, 16, signedAmount(row.cashAccounting ? row.cashAccountingAnnualAmount : 0)); place(record, 300, 6, numeric(0, 6, false, 0));
    return record.join('');
  });
  return [header.join(''), ...records].join('\r\n');
}

function export415Import(company: any, year: number, calculation: any) {
  const details = [...(calculation.details || [])].sort((a: any, b: any) => `${a.taxId}|${a.operationKey}`.localeCompare(`${b.taxId}|${b.operationKey}`));
  const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const summary = Object.fromEntries(keys.map(key => [key, {
    count: details.filter((row: any) => row.operationKey === key).length,
    amount: details.filter((row: any) => row.operationKey === key).reduce((sum: number, row: any) => sum + money(row.totalAccordingToOperation ?? row.total), 0),
  }]));
  const declaration = [
    '1', '415', String(year), normalizedText(company.nif_cif, 9), normalizedText(company.razon_social, 40),
    ...keys.flatMap(key => [numeric(summary[key].count, 9, false, 0), signedAmount(summary[key].amount)]),
    ' ', ' '.repeat(13),
  ].join('');
  const records = details.map((row: any) => {
    const country = normalizedCountry(row.country) || 'ES';
    return [
      '2', '415', String(year), normalizedText(company.nif_cif, 9), row.operationKey,
      country === 'ES' ? normalizedText(row.taxId, 9) : ' '.repeat(9), normalizedText(row.name, 40), normalizedText(row.representativeTaxId, 9), country === 'ES' ? '  ' : country,
      row.cashAccounting ? 'X' : ' ', row.reverseCharge ? 'X' : ' ', row.exemptArticle13 ? 'X' : ' ', signedAmount(row.cashAccounting ? row.cashAccountingAnnualAmount : 0),
      signedAmount(row.ordinaryTotal ?? row.total), numeric(row.cashAmount, 15), signedAmount(row.propertyRentAmount), signedAmount(row.propertyTransferAmount), row.cashAmount ? row.cashYear : '0000',
      signedAmount(row.quarters?.T1), signedAmount(row.rentQuarters?.T1), signedAmount(row.transferQuarters?.T1),
      signedAmount(row.quarters?.T2), signedAmount(row.rentQuarters?.T2), signedAmount(row.transferQuarters?.T2),
      signedAmount(row.quarters?.T3), signedAmount(row.rentQuarters?.T3), signedAmount(row.transferQuarters?.T3),
      signedAmount(row.quarters?.T4), signedAmount(row.rentQuarters?.T4), signedAmount(row.transferQuarters?.T4),
    ].join('');
  });
  const properties = details.flatMap((row: any) => (row.properties || []).map((property: any) => [
    '3', '415', String(year), normalizedText(company.nif_cif, 9), normalizedText(row.taxId, 9), normalizedText(row.name, 40), normalizedText(row.representativeTaxId, 9),
    signedAmount(property.amount, 15), property.cadastralUnavailable ? 'N' : 'S', normalizedText(property.cadastralReference, 25),
    normalizedText(property.roadType, 5), normalizedText(property.roadName, 50), normalizedText(property.numberingType || 'NUM', 3), leftPaddedText(property.houseNumber, 5, '0'),
    normalizedText(property.numberQualifier, 3), normalizedText(property.block, 3), normalizedText(property.portal, 3), normalizedText(property.stair, 3),
    normalizedText(property.floor, 3), normalizedText(property.door, 3), normalizedText(property.complement, 40), normalizedText(property.locality, 30),
    normalizedText(property.municipality, 30), normalizedText(property.municipalityCode, 5), normalizedText(property.provinceCode, 2), normalizedText(property.postalCode, 5),
  ].join('')));
  return [declaration, ...records, ...properties].join('\r\n');
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function exportAtcHandoff(model: '417' | '420' | '421' | '425', company: any, year: number, period: string, calculation: any, validation: any, sourceHash: string) {
  const rows: any[][] = [
    ['TIPO', 'MODELO', 'EJERCICIO', 'PERIODO', 'CODIGO', 'CONCEPTO', 'VALOR', 'FUENTES'],
    ['METADATO', model, year, period, 'DECLARANTE_NIF', 'NIF del declarante', clean(company.nif_cif).toUpperCase(), 'Company'],
    ['METADATO', model, year, period, 'DECLARANTE_NOMBRE', 'Nombre o razón social', clean(company.razon_social), 'Company'],
    ['METADATO', model, year, period, 'MOTOR', 'Versión del motor Taxea', ENGINE_VERSION, sourceHash],
  ];
  for (const field of calculation.fields || []) {
    rows.push(['CASILLA', model, year, period, field.code, field.label, money(field.value).toFixed(2), (field.sourceIds || []).join('|')]);
  }
  const operations = calculation.operations || {};
  for (const rate of operations.rates || []) {
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_BASE`, `Base IGIC devengado al ${rate.rate}%`, money(rate.base).toFixed(2), (rate.sourceIds || []).join('|')]);
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_TIPO`, `Tipo IGIC devengado ${rate.rate}%`, money(rate.rate).toFixed(2), (rate.sourceIds || []).join('|')]);
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_CUOTA`, `Cuota IGIC devengada al ${rate.rate}%`, money(rate.quota).toFixed(2), (rate.sourceIds || []).join('|')]);
  }
  const operationRows = [
    ['ISP_BASE', 'Base de operaciones con inversión del sujeto pasivo', operations.reverseBase],
    ['ISP_CUOTA', 'Cuota de operaciones con inversión del sujeto pasivo', operations.reverseQuota],
    ['DEDUCIBLE_BASE', 'Base de operaciones con cuota deducible', operations.deductibleBase],
    ['DEDUCIBLE_CUOTA', 'Total cuotas deducibles', operations.deductibleQuota],
    ['EXPORTACIONES', 'Exportaciones y operaciones exentas con derecho a deducción', operations.exports],
    ['NO_SUJETAS', 'Operaciones no sujetas', operations.nonSubject],
    ['CRITERIO_CAJA', 'Operaciones en régimen especial del criterio de caja', operations.criterionCash],
    ['RESULTADO', 'Resultado calculado', calculation.result],
  ];
  for (const [code, label, value] of operationRows) rows.push(['DESGLOSE', model, year, period, code, label, money(value).toFixed(2), sourceHash]);
  for (const message of validation.recommendations || validation.warnings || []) rows.push(['RECOMENDACION', model, year, period, '', message, '', '']);
  rows.push(['INSTRUCCION', model, year, period, 'PASO_FINAL', 'Trasladar los importes al programa oficial, resolver sus validaciones y generar allí el fichero .dec. Este CSV no es presentable.', '', 'ATC']);
  return rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}

function exportGuidedHandoff(model: string, company: any, year: number, period: string, calculation: any, validation: any, sourceHash: string) {
  const rows: any[][] = [
    ['TIPO','MODELO','EJERCICIO','PERIODO','CODIGO','CONCEPTO','VALOR','FUENTES'],
    ['METADATO',model,year,period,'DECLARANTE_NIF','NIF del declarante',clean(company.nif_cif).toUpperCase(),'Company'],
    ['METADATO',model,year,period,'DECLARANTE_NOMBRE','Nombre o razón social',clean(company.razon_social),'Company'],
    ['METADATO',model,year,period,'MOTOR','Versión y huella de cálculo',ENGINE_VERSION,sourceHash],
  ];
  for (const field of calculation.fields || []) rows.push(['CASILLA',model,year,period,field.code,field.label,typeof field.value === 'number' ? money(field.value).toFixed(2) : clean(field.value),(field.sourceIds || []).join('|')]);
  for (const detail of calculation.details || []) rows.push(['DETALLE',model,year,period,clean(detail.recordKey || detail.id || detail.type),'Registro trazable',JSON.stringify(detail),clean(detail.sourceId || (detail.sourceIds || []).join('|'))]);
  for (const message of validation.recommendations || validation.warnings || []) rows.push(['RECOMENDACION',model,year,period,'',message,'','']);
  const authority = DEFINITIONS[model]?.authority || 'AEAT/ATC';
  rows.push(['INSTRUCCION',model,year,period,'PASO_FINAL',`Trasladar o importar únicamente mediante las opciones admitidas por ${authority}, revisar todas las casillas y superar su validación. Este paquete de trabajo no es un fichero presentable.`, '', authority]);
  return rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}

function transferLayoutErrors(model: string, content: string) {
  const records = content.split('\r\n');
  if (['111','115','123','130','303'].includes(model)) {
    const errors: string[] = [];
    const pageLayouts: Record<string, Array<[string, number]>> = {
      '111': [['01000',1000]],
      '115': [['01000',500]],
      '123': [['01000',600]],
      '130': [['01000',600]],
      '303': [['01000',1581],['03000',1017]],
    };
    let previousIndex = -1;
    const extracted: Record<string,string> = {};
    for (const [pageCode, expectedLength] of pageLayouts[model]) {
      const startMarker = `<T${model}${pageCode}>`, endMarker = `</T${model}${pageCode}>`;
      const start = content.indexOf(startMarker), end = content.indexOf(endMarker, start);
      if (start < 0 || end < 0) { errors.push(`Falta la página oficial ${pageCode} del modelo ${model}.`); continue; }
      if (start <= previousIndex) errors.push(`La página ${pageCode} del modelo ${model} está fuera de orden.`);
      previousIndex = start;
      const value = content.slice(start,end+endMarker.length);
      extracted[pageCode] = value;
      if (value.length !== expectedLength) errors.push(`La página ${pageCode} del modelo ${model} debe tener exactamente ${expectedLength} posiciones.`);
    }
    const envelope = content.match(new RegExp(`^<T${model}0(\\d{4})([A-Z0-9]{2})0000>`));
    const expectedEnd = envelope ? `</T${model}0${envelope[1]}${envelope[2]}0000>` : '';
    if (!envelope || !content.endsWith(expectedEnd)) errors.push(`La envolvente del modelo ${model} no tiene apertura y cierre coherentes.`);
    if (content.includes('NaN') || content.includes('undefined')) errors.push(`El fichero del modelo ${model} contiene valores técnicos inválidos.`);
    if (model === '303' && extracted['01000'] && extracted['03000']) {
      const p1 = extracted['01000'], p3 = extracted['03000'];
      const read = (source:string, position:number, signed=false) => readFixedNumber(source,position,17,2,signed);
      const devengado = read(p1,696,true), deducible = read(p1,1002,true), resultadoGeneral = read(p1,1019,true);
      const sumaResultados = read(p3,199,true), atribuibleEstado = read(p3,221,true), resultadoAutoliquidacion = read(p3,340,true), resultadoFinal = read(p3,408,true);
      if (Math.abs(resultadoGeneral - money(devengado - deducible)) > 0.01) errors.push('El resultado del régimen general del 303 no cuadra con IVA devengado menos IVA deducible.');
      if (Math.abs(sumaResultados - resultadoGeneral) > 0.01 || Math.abs(atribuibleEstado - sumaResultados) > 0.01) errors.push('El resultado del régimen general no se ha trasladado correctamente a la página 3 del 303.');
      if (Math.abs(resultadoAutoliquidacion - resultadoFinal) > 0.01) errors.push('El resultado de la autoliquidación 303 no coincide con el resultado final exportado.');
    }
    return errors;
  }
  if (model === '390') {
    const errors: string[] = [];
    const envelope = content.match(/^<T3900(\d{4})0A0000>/);
    const expectedEnd = envelope ? `</T3900${envelope[1]}0A0000>` : '';
    if (!envelope || !content.endsWith(expectedEnd)) errors.push('La envolvente anual del modelo 390 no tiene apertura y cierre coherentes.');
    if (content.includes('NaN') || content.includes('undefined')) errors.push('El fichero del modelo 390 contiene valores técnicos inválidos.');
    const pageOrder = ['01000','02000','02B00','03000','04000','05000','06000','07000','08000'];
    const extracted: Record<string,string> = {};
    let previousIndex = -1;
    for (const pageCode of pageOrder) {
      const startMarker = `<T390${pageCode}>`, endMarker = `</T390${pageCode}>`;
      const start = content.indexOf(startMarker), end = content.indexOf(endMarker, start);
      if (start < 0 || end < 0) { errors.push(`Falta la página oficial ${pageCode} del modelo 390.`); continue; }
      if (start <= previousIndex) errors.push(`La página ${pageCode} del modelo 390 está fuera de orden.`);
      previousIndex = start;
      const value = content.slice(start,end+endMarker.length); extracted[pageCode]=value;
      if (value.length !== MODEL390_LAYOUT[pageCode].length) errors.push(`La página ${pageCode} del modelo 390 debe tener exactamente ${MODEL390_LAYOUT[pageCode].length} posiciones.`);
    }
    const readBox = (pageCode:string,boxCode:string) => {
      const tuple=(MODEL390_LAYOUT[pageCode].boxes||[]).find((item:any)=>item[0]===String(boxCode).padStart(2,'0'));
      return tuple&&extracted[pageCode]?readFixedNumber(extracted[pageCode],tuple[1],tuple[2],tuple[3],true):0;
    };
    if(Math.abs(readBox('02B00','47')-readBox('02000','34'))>0.01) errors.push('La cuota devengada total del modelo 390 no coincide entre las casillas 34 y 47.');
    if(Math.abs(readBox('04000','65')-(readBox('02B00','47')-readBox('04000','64')))>0.01) errors.push('El resultado del régimen general del modelo 390 no cuadra con cuotas devengadas menos deducciones.');
    return errors;
  }
  if (model === '180') {
    const errors = records.length < 2 ? ['El 180 debe incluir cabecera y al menos un perceptor.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 180 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1180')) errors.push('La cabecera del 180 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2180'))) errors.push('Hay registros de perceptor 180 con identificador inválido.');
    return errors;
  }
  if (model === '190') {
    const errors = records.length < 2 ? ['El 190 debe incluir cabecera y al menos un perceptor.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 190 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1190')) errors.push('La cabecera del 190 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2190') || !['A','G'].includes(record[77]))) errors.push('Hay registros de perceptor 190 con identificador o clave no soportada.');
    const count=Number(records[0]?.slice(135,144)||0); if(count!==records.length-1) errors.push('El total de perceptores de la cabecera 190 no coincide con los registros tipo 2.');
    return errors;
  }
  if (model === '193') {
    const errors = records.length < 2 ? ['El 193 debe incluir cabecera y al menos un perceptor.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 193 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1193')) errors.push('La cabecera del 193 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2193') || !['A','B','C','D'].includes(record[91]))) errors.push('Hay registros de perceptor 193 con identificador o clave inválida.');
    const count=Number(records[0]?.slice(135,144)||0); if(count!==records.length-1) errors.push('El total de perceptores de la cabecera 193 no coincide con los registros tipo 2.');
    const decimal=(value:string)=>money(Number(value||0)/100); const headerBase=decimal(records[0]?.slice(144,159)||''); const headerWithholding=decimal(records[0]?.slice(159,174)||'');
    const detailBase=money(records.slice(1).reduce((sum,record)=>sum+decimal(record.slice(151,164)),0)); const detailWithholding=money(records.slice(1).reduce((sum,record)=>sum+decimal(record.slice(168,181)),0));
    if(Math.abs(headerBase-detailBase)>0.01) errors.push('La base total de la cabecera 193 no coincide con los perceptores.');
    if(Math.abs(headerWithholding-detailWithholding)>0.01) errors.push('Las retenciones totales de la cabecera 193 no coinciden con los perceptores.');
    const special=records[0]?.[234]==='S'; if(records.slice(1).some(record=>(record[207]==='S')!==special)) errors.push('La naturaleza del declarante no es coherente entre cabecera y perceptores del 193.');
    return errors;
  }
  if (model === '347') {
    const errors = records.length < 2 ? ['El 347 debe incluir cabecera y al menos un declarado.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 347 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1347')) errors.push('La cabecera del 347 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2347') || record[75] !== 'D')) errors.push('Hay registros de declarado 347 con tipo de hoja inválido.');
    return errors;
  }
  if (model === '415') {
    const errors = records.length < 2 ? ['El soporte 415 debe incluir declaración y al menos un declarado.'] : [];
    if (records[0]?.length !== 246 || !records[0]?.startsWith('1415')) errors.push('La cabecera de importación 415 no cumple las 246 posiciones del programa ATC.');
    const detailRecords = records.slice(1).filter(record => record.startsWith('2415'));
    const propertyRecords = records.slice(1).filter(record => record.startsWith('3415'));
    if (!detailRecords.length) errors.push('El soporte 415 no contiene registros de declarado tipo 2.');
    if (detailRecords.some(record => record.length !== 356)) errors.push('Hay registros de declarado 415 que no cumplen las 356 posiciones del importador ATC.');
    if (propertyRecords.some(record => record.length !== 309)) errors.push('Hay anexos de inmueble 415 que no cumplen las 309 posiciones del importador ATC.');
    if (records.slice(1).some(record => !record.startsWith('2415') && !record.startsWith('3415'))) errors.push('El soporte 415 contiene un tipo de registro no reconocido por el importador oficial.');
    const firstProperty = records.findIndex(record => record.startsWith('3415'));
    if (firstProperty >= 0 && records.slice(firstProperty + 1).some(record => record.startsWith('2415'))) errors.push('Los anexos de inmueble 415 deben situarse después de todos los registros de declarados.');
    const fixedAmount = (text: string) => {
      const negative = text[0] === 'N';
      const digits = text.replace(/^[N ]/, '').replace(/\D/g, '');
      return money((negative ? -1 : 1) * (Number(digits || 0) / 100));
    };
    const keys = ['A','B','C','D','E','F','G'];
    keys.forEach((key, index) => {
      const matching = detailRecords.filter(record => record[17] === key);
      const headerStart = 57 + index * 25;
      const headerCount = Number(records[0]?.slice(headerStart, headerStart + 9) || 0);
      const headerAmount = fixedAmount(records[0]?.slice(headerStart + 9, headerStart + 25) || '');
      const detailAmount = money(matching.reduce((sum, record) => sum + fixedAmount(record.slice(97, 113)) + fixedAmount(record.slice(128, 144)) + fixedAmount(record.slice(144, 160)), 0));
      if (headerCount !== matching.length) errors.push(`El resumen 415 de la clave ${key} no cuadra en número de declarados.`);
      if (Math.abs(headerAmount - detailAmount) > 0.01) errors.push(`El resumen 415 de la clave ${key} no cuadra en importe.`);
    });
    if (propertyRecords.some(property => !detailRecords.some(detail => detail[17] === 'B' && detail.slice(18,27) === property.slice(17,26)))) errors.push('Hay anexos de inmueble sin un declarado de ventas/arrendamientos asociado.');
    return errors;
  }
  return [];
}

function wrap(model: string, year: number, period: string, pages: string, developerTaxId: string) {
  const auxiliary=developerTaxId?`${' '.repeat(70)}TX01${' '.repeat(4)}${normalizedText(developerTaxId,9)}${' '.repeat(213)}`:' '.repeat(300);
  const prefix=`<T${model}0${year}${period}0000><AUX>${auxiliary}</AUX>`;
  const suffix=`</T${model}0${year}${period}0000>`;
  return prefix+pages+suffix;
}

async function sha256(text: string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function encodeBase64(text: string) {
  const bytes=new TextEncoder().encode(text); let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary);
}

function readFixedNumber(source: string, position: number, length: number, decimals = 2, signed = false) {
  const raw = source.slice(position - 1, position - 1 + length);
  const negative = signed && raw.trim().startsWith('N');
  const digits = raw.replace(/\D/g, '');
  return money((negative ? -1 : 1) * Number(digits || 0) / Math.pow(10, decimals));
}

function pageFromFiledText(raw: string, model: string, pageCode = '01000') {
  const compact = clean(raw).replace(/^\uFEFF/, '').replace(/[\r\n]/g, '');
  const marker = `<T${model}${pageCode}>`;
  const index = compact.indexOf(marker);
  return index >= 0 ? compact.slice(index) : compact;
}

function parseFiledText(model: string, raw: string) {
  if (!raw || !['111','115','123','130','180','190','193','303','347','390','415'].includes(model)) return null;
  if (['180','190','193','347'].includes(model)) {
    const header=clean(raw).replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'';
    if(header.length!==500||!header.startsWith(`1${model}`)) return null;
    const boxes:Record<string,number>={DECLARADOS:Number(header.slice(135,144)||0)};
    if(model==='180'){boxes.BASE=readFixedNumber(header,145,16,2,true);boxes.RETENCIONES=readFixedNumber(header,161,15);}
    if(model==='190'){boxes.PERCEPCIONES=readFixedNumber(header,145,16,2,true);boxes.RETENCIONES=readFixedNumber(header,161,15);}
    if(model==='193'){boxes.BASE=readFixedNumber(header,145,15);boxes.RETENCIONES=readFixedNumber(header,160,15);boxes.INGRESADO=readFixedNumber(header,175,15);}
    if(model==='347'){boxes.IMPORTE=readFixedNumber(header,145,16,2,true);boxes.INMUEBLES=readFixedNumber(header,170,16,2,true);}
    boxes.RESULTADO=0;
    return {model,nif:clean(header.slice(8,17)).toUpperCase(),year:Number(header.slice(4,8)),period:'Anual',boxes};
  }
  if(model==='415'){
    const header=clean(raw).replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'';
    if(header.length!==246||!header.startsWith('1415')) return null;
    const boxes:Record<string,number>={}; const keys=['A','B','C','D','E','F','G'];
    keys.forEach((key,index)=>{const start=57+index*25;boxes[`DECLARADOS_${key}`]=Number(header.slice(start,start+9)||0);boxes[`IMPORTE_${key}`]=readFixedNumber(header,start+10,16,2,true);}); boxes.RESULTADO=0;
    return {model,nif:clean(header.slice(8,17)).toUpperCase(),year:Number(header.slice(4,8)),period:'Anual',boxes};
  }
  if(model==='390'){
    const firstPage=pageFromFiledText(raw,model,'01000');
    if(!firstPage.startsWith('<T39001000>')) return null;
    const boxes:Record<string,number>={};
    for(const [pageCode,layout] of Object.entries(MODEL390_LAYOUT) as [string,any][]){
      const pageValue=pageFromFiledText(raw,model,pageCode); if(!pageValue.startsWith(`<T390${pageCode}>`)) continue;
      for(const [box,position,length,decimals] of layout.boxes||[]) boxes[box]=readFixedNumber(pageValue,position,length,decimals,true);
    }
    boxes.RESULTADO=boxes['86']??boxes['65']??0;
    return {model,nif:clean(firstPage.slice(13,22)).toUpperCase(),year:Number(firstPage.slice(102,106)),period:'Anual',boxes};
  }
  const source = pageFromFiledText(raw, model);
  if (!source.startsWith(`<T${model}01000>`)) return null;
  const boxes: Record<string, number> = {};
  const read = (code: string, position: number, length: number, decimals = 2, signed = false) => { boxes[code] = readFixedNumber(source, position, length, decimals, signed); };
  if (model === '111') {
    read('01',109,8,0); read('02',117,17); read('03',134,17); read('04',193,8,0); read('05',201,17); read('06',218,17); read('28',487,17); read('30',521,17);
  } else if (model === '115') {
    read('01',109,15,0); read('02',124,17); read('03',141,17); read('05',175,17);
  } else if (model === '123') {
    read('03',124,15,0); read('06',171,17); read('09',222,17); read('12',290,17); read('14',324,17);
  } else if (model === '130') {
    const positions: Record<string, number> = {'01':109,'02':126,'03':143,'04':160,'05':177,'06':194,'07':211,'08':228,'09':245,'10':262,'11':279,'12':296,'13':313,'14':330,'15':347,'16':364,'17':381,'18':398,'19':415};
    const signed = new Set(['03','07','11','14','17','19']);
    for (const [code, position] of Object.entries(positions)) read(code,position,17,2,signed.has(code));
  } else if (model === '303') {
    read('27',696,17,2,true); read('28',713,17); read('29',730,17); read('45',1002,17,2,true); read('46',1019,17,2,true);
    boxes.DEVENGADO = boxes['27']; boxes.DEDUCIBLE_BASE = boxes['28']; boxes.DEDUCIBLE = boxes['29'];
    const resultPage = pageFromFiledText(raw, model, '03000');
    if (!resultPage.startsWith('<T30303000>')) return null;
    const readResult = (code: string, position: number, length = 17, signed = false) => { boxes[code] = readFixedNumber(resultPage, position, length, 2, signed); };
    readResult('64',199,17,true); readResult('66',221,17,true); readResult('77',238); readResult('110',255); readResult('78',272); readResult('87',289); readResult('69',340,17,true); readResult('70',357); readResult('109',374); readResult('112',391); readResult('71',408,17,true); boxes.RESULTADO = boxes['71'];
  }
  return { model, nif: clean(source.slice(13,22)).toUpperCase(), year: Number(source.slice(102,106)), period: clean(source.slice(106,108)), boxes };
}

function normalizeFiledImport(body: any, company: any, model: string, year: number, period: string) {
  const extracted = body.extracted && typeof body.extracted === 'object' ? body.extracted : {};
  const parsed = parseFiledText(model, clean(body.rawContent));
  const detectedModel = clean(parsed?.model || extracted.modelo || extracted.model || model).replace(/\D/g, '');
  const detectedYear = Number(parsed?.year || extracted.ejercicio || extracted.year || year);
  const rawPeriod = clean(parsed?.period || extracted.periodo || extracted.period || period).toUpperCase().replace(/^T([1-4])$/, '$1T').replace(/^Q([1-4])$/, '$1T');
  const detectedPeriod = rawPeriod === 'ANUAL' ? 'Anual' : rawPeriod;
  const detectedNif = canonical(parsed?.nif || extracted.nif_cif || extracted.nif || '').replace(/\s/g, '');
  const boxes = { ...(parsed?.boxes || {}), ...boxMap(extracted.fields || extracted.casillas || extracted.boxes), ...boxMap(body.presentedBoxes) };
  const result = body.importeFinal ?? extracted.importeFinal ?? extracted.importe ?? boxes.RESULTADO ?? boxes['19'] ?? boxes['30'] ?? boxes['14'] ?? boxes['05'] ?? 0;
  const normalizedResult = money(result);
  const requestedDisposition = clean(body.resultDisposition || extracted.resultadoDestino || extracted.destinoResultado).toLowerCase();
  const validDispositions = new Set(['a_ingresar','a_compensar','a_devolver','a_deducir','negativa','cero','sin_actividad']);
  const resultDisposition = validDispositions.has(requestedDisposition)
    ? requestedDisposition
    : normalizedResult > 0 ? 'a_ingresar' : normalizedResult === 0 ? 'cero' : model === '130' ? (period === '4T' ? 'negativa' : 'a_deducir') : '';
  const preview = {
    model: detectedModel || model, year: detectedYear, period: detectedPeriod || period,
    nif: detectedNif, companyNif: canonical(company.nif_cif).replace(/\s/g,''),
    presentationDate: clean(body.presentationDate || extracted.fechaPresentacion || extracted.fecha_presentacion).slice(0,10),
    justificationNumber: clean(body.justificationNumber || extracted.numeroJustificante || extracted.numero_justificante || extracted.csv),
    previousJustificationNumber: clean(body.previousJustificationNumber || extracted.numeroJustificanteAnterior),
    declarationType: ['original','complementaria','rectificativa','sustitutiva'].includes(clean(body.declarationType || extracted.tipoDeclaracion)) ? clean(body.declarationType || extracted.tipoDeclaracion) : 'original',
    boxes, result: normalizedResult, resultDisposition, fileUrl: clean(body.fileUrl), fileName: clean(body.fileName), fileHash: clean(body.fileHash).toLowerCase(),
    source: parsed ? 'fichero_oficial' : clean(body.fileName).toLowerCase().endsWith('.pdf') ? 'pdf_ocr_revisado' : 'fichero_oficial',
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  if (preview.model !== model) errors.push(`El documento parece corresponder al modelo ${preview.model}, no al ${model}.`);
  if (preview.year !== year) errors.push(`El documento parece corresponder al ejercicio ${preview.year}, no al ${year}.`);
  if (preview.period !== period) errors.push(`El documento parece corresponder al período ${preview.period}, no a ${period}.`);
  if (preview.nif && preview.companyNif && preview.nif !== preview.companyNif) errors.push('El NIF detectado no coincide con la empresa seleccionada.');
  if (!preview.presentationDate) errors.push('Indica la fecha efectiva de presentación.');
  if (preview.presentationDate > new Date().toISOString().slice(0, 10)) errors.push('La fecha de presentación no puede estar en el futuro.');
  if (!Object.keys(preview.boxes).length) errors.push('No se han obtenido casillas. Revisa y añade al menos los importes principales del modelo presentado.');
  if (['303','420'].includes(model) && preview.result < 0 && !['a_compensar','a_devolver'].includes(preview.resultDisposition)) errors.push('Indica si el resultado negativo presentado quedó a compensar o se solicitó a devolver.');
  if (['303','420'].includes(model) && preview.result < 0 && preview.resultDisposition === 'a_devolver' && !['4T','12'].includes(period)) errors.push('La devolución del saldo requiere el último período del año o un supuesto especial revisado.');
  if (!preview.justificationNumber) warnings.push('No consta número de justificante o CSV; el histórico podrá guardarse, pero la trazabilidad administrativa queda incompleta.');
  if (!parsed) warnings.push('Las casillas proceden de OCR o entrada revisada, no de un diseño de registro reconocido automáticamente.');
  return { preview, errors, warnings };
}

function createdDateOf(item: any) {
  return clean(item?.created_date || item?.createdAt || item?.updated_date || item?.updatedAt).slice(0, 10);
}

function lateItemsAfterFiling(data: any, model: string, year: number, period: string, filing: any) {
  if (!filing) return [];
  const filedAt = filingDate(filing);
  const periodBounds = bounds(year, period);
  const rows: any[] = [];
  const seen = new Set<string>();
  const add = (row: any) => {
    const key = clean(row.sourceId || `${row.type}:${row.document}:${row.operationDate}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };
  if (['303', '420'].includes(model)) {
    const kind = model === '303' ? 'iva' : 'igic';
    for (const line of data.taxLines || []) {
      if (line.taxKind !== kind || line.invoice?.tipo !== 'emitida' || !inRange(line, periodBounds.start, periodBounds.end)) continue;
      const addedAt = createdDateOf(line) || createdDateOf(line.invoice);
      if (!addedAt || addedAt <= filedAt) continue;
      add({
        sourceId: line.sourceId,
        type: 'cuota_devengada_omitida',
        document: clean(line.invoice?.numero_factura) || line.invoice?.id,
        operationDate: clean(line.date || dateOf(line.invoice)).slice(0, 10),
        addedAt,
        amount: money(line.quota),
        treatment: 'rectificar_periodo_origen',
        reason: 'Una cuota repercutida no se traslada silenciosamente a un período posterior; debe revisarse la rectificación o complementaria del período de devengo.',
      });
    }
  }
  if (['111', '115', '123'].includes(model)) {
    if (model === '111') {
      for (const payroll of data.payrolls || []) {
        const addedAt = createdDateOf(payroll);
        if (!inRange(payroll, periodBounds.start, periodBounds.end) || !addedAt || addedAt <= filedAt) continue;
        add({ sourceId: `PayrollExtraction:${payroll.id}`, type: 'retencion_nomina_omitida', document: payroll.employee_name || payroll.id, operationDate: dateOf(payroll).slice(0, 10), addedAt, amount: money(payroll.irpf_amount), treatment: 'rectificar_periodo_origen', reason: 'Las retenciones corresponden al período de pago y no se arrastran automáticamente a otro trimestre.' });
      }
    }
    const category = model === '111' ? 'servicios_profesionales' : model === '115' ? 'alquiler' : 'gastos_financieros';
    const invoicesById = new Map((data.invoices || []).map((invoice: any) => [invoice.id, invoice]));
    for (const payment of data.invoicePayments || []) {
      const invoice: any = invoicesById.get(payment.invoice_id);
      const addedAt = createdDateOf(payment);
      if (!invoice || invoice.anulada || invoice.categoria_gasto !== category || !inRange(payment, periodBounds.start, periodBounds.end) || !addedAt || addedAt <= filedAt) continue;
      const payable = Math.abs(money(invoice.total_factura)) || Math.abs(money(invoice.base_imponible) + money(invoice.cuota_iva) - retentionAmount(invoice));
      const factor = payable ? Math.min(1, Math.abs(money(payment.amount)) / payable) : 0;
      add({ sourceId: `InvoicePayment:${payment.id}`, type: 'retencion_pago_omitida', document: clean(invoice.numero_factura) || invoice.id, operationDate: dateOf(payment).slice(0, 10), addedAt, amount: money(retentionAmount(invoice) * factor), treatment: 'rectificar_periodo_origen', reason: 'La retención se imputa al período del pago; requiere revisar la declaración de origen.' });
    }
  }
  if (model === '130') {
    for (const entry of data.entries || []) {
      const addedAt = createdDateOf(entry);
      if (entry.status !== 'confirmado' || entry.isBalanced === false || !inRange(entry, periodBounds.cumulativeStart, periodBounds.end) || !addedAt || addedAt <= filedAt) continue;
      add({
        sourceId: `JournalEntry:${entry.id}`,
        type: 'asiento_contable_posterior',
        document: clean(entry.entryNumber || entry.reference || entry.description) || entry.id,
        operationDate: dateOf(entry).slice(0, 10),
        addedAt,
        amount: 0,
        treatment: period === '4T' ? 'revisar_rectificacion_o_renta' : 'siguiente_trimestre_acumulado',
        reason: period === '4T'
          ? 'Tras el 4T no existe otro pago fraccionado del ejercicio; revise rectificación y su efecto en la declaración anual de IRPF.'
          : 'El modelo 130 es acumulativo desde el 1 de enero: el asiento entra en el siguiente trimestre abierto sin cambiar su ejercicio contable.',
      });
    }
  }
  return rows.sort((a, b) => `${a.operationDate}|${a.sourceId}`.localeCompare(`${b.operationDate}|${b.sourceId}`));
}

function filingComparison(data: any, model: string, year: number, period: string, calculation: any) {
  const filing = latestFiling(data.filings || [], model, year, period);
  if (!filing) return { presented: false, importedCount: (data.filings || []).filter((row: any) => row.modeloCodigo === model && Number(row.ejercicio) === year).length, differences: [], lateItems: [], carryforward: calculation.carryforward || null };
  const presented = boxMap(filing.casillasPresentadas);
  const current = fieldMap(calculation);
  const codes = unique([...Object.keys(presented), ...Object.keys(current)]);
  const differences = codes.map(code => ({ code, presented: money(presented[code]), current: money(current[code]), difference: money(current[code] - presented[code]) })).filter(row => Math.abs(row.difference) > 0.009);
  return { presented: true, filing: { id: filing.id, date: filingDate(filing), justificationNumber: filing.numeroJustificante, declarationType: filing.tipoDeclaracion || 'original', resultDisposition: filing.resultadoDestino, snapshotVersion: filing.snapshotVersion || 1, result: money(filing.importeFinal), boxes: presented, fileUrl: filing.ficheroPresentadoUrl }, importedCount: (data.filings || []).filter((row: any) => row.modeloCodigo === model && Number(row.ejercicio) === year).length, resultDifference: money(calculation.result - filing.importeFinal), differences, lateItems: lateItemsAfterFiling(data, model, year, period, filing), carryforward: calculation.carryforward || null };
}

function taxPeriodOutcome(model: string, value: number) {
  if (DEFINITIONS[model]?.kind === 'informative') return 'informativo';
  if (value > 0) return 'a_ingresar';
  if (value < 0) return ['130', '131', '200', '303', '417', '420', '421'].includes(model) ? 'a_compensar' : 'cero';
  return 'cero';
}

Deno.serve(async (req) => {
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me();
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({})); const action=clean(body.action||'catalog');
    if(action==='catalog') return Response.json({ok:true,engineVersion:ENGINE_VERSION,models:TARGET_MODELS.map(code=>({code,...DEFINITIONS[code]})),recommendedExtensions:[],sources:SOURCES});
    if(action==='self_test') {
      const company={nif_cif:'B12345678',razon_social:'TAXEA PRUEBA',telefono:'922000000'}; const profile={isREDEME:false,usesSII:false};
      const standard={result:21,fields:[{code:'01',value:1},{code:'02',value:100},{code:'03',value:15},{code:'04',value:1},{code:'05',value:100},{code:'06',value:15},{code:'07',value:1},{code:'08',value:100},{code:'09',value:15},{code:'28',value:30},{code:'30',value:30},{code:'12',value:19},{code:'14',value:19},{code:'19',value:20},{code:'110',value:0},{code:'78',value:0},{code:'87',value:0}],details:[{}],operations:{rates:[{rate:21,base:100,quota:21}],outputQuota:21,deductibleBase:0,deductibleQuota:0,rawResult:21,reverseBase:0,reverseQuota:0,intraBase:0,intraQuota:0,exports:0,intraSupplies:0,nonSubject:0}};
      const thirdParties={result:0,details:[{recordKey:'ThirdParty:B87654321|B|C0|I0|E0',taxId:'B87654321',name:'CLIENTE PRUEBA',country:'ES',provinceCode:'38',operationKey:'B',total:3500,ordinaryTotal:1800,totalAccordingToOperation:3500,quarters:{T1:575,T2:575,T3:575,T4:75},rentQuarters:{T1:300,T2:300,T3:300,T4:300},transferQuarters:{T1:125,T2:125,T3:125,T4:125},cashAmount:7000,cashYear:'2024',propertyTransferAmount:500,propertyRentAmount:1200,cashAccounting:false,cashAccountingAnnualAmount:0,reverseCharge:false,exemptArticle13:false,representativeTaxId:'',properties:[{amount:1200,cadastralUnavailable:false,cadastralReference:'1234567CS7413S0001AB',roadType:'CL',roadName:'PRUEBA',numberingType:'NUM',houseNumber:'1',numberQualifier:'',block:'',portal:'',stair:'',floor:'',door:'',complement:'',locality:'SANTA CRUZ DE TENERIFE',municipality:'SANTA CRUZ DE TENERIFE',municipalityCode:'38038',provinceCode:'38',postalCode:'38001'}]}]};
      const annual180={result:0,details:[{id:'invoice-test',taxId:'B87654321',name:'ARRENDADOR PRUEBA',base:12000,withholding:2280,manual:{representativeTaxId:'',recipientProvinceCode:'38',modality:'1',withholdingRate:19,accrualYear:'0000',propertySituation:'1',cadastralReference:'1234567CS7413S0001AB',roadType:'CL',roadName:'PRUEBA',numberingType:'NUM',houseNumber:'1',municipality:'SANTA CRUZ DE TENERIFE',municipalityCode:'38038',propertyProvinceCode:'38',postalCode:'38001'}}]};
      const annual190={result:0,details:[{taxId:'12345678Z',name:'TRABAJADOR PRUEBA',provinceCode:'38',key:'A',subkey:'',base:24000,withholding:2400,manual:{representativeTaxId:'',accrualYear:'',birthYear:'1990',familySituation:'3',spouseTaxId:'',disability:'0',contractType:'1',ceutaMelilla:false,mobility:false,reductions:0,deductibleExpenses:1524,compensatoryPensions:0,childSupport:0}}]};
      const annual193={result:0,declaration:{manual:{declarantNatureSpecial:true,expenseAnnexNotApplicable:true,specialDataConfirmed:true}},details:[{recordKey:'Annual193:Invoice:test',taxId:'B87654321',name:'PERCEPTOR PRUEBA',provinceCode:'38',perceptionKey:'C',nature:'12',base:1000,withholding:190,manual:{representativeTaxId:'',provinceCode:'38',recipientMediator:false,keyCode:'',issuerCode:'',perceptionKey:'C',nature:'12',paymentRole:'',accountCodeType:'',accountCode:'',pending:false,accrualYear:'',perceptionType:'1',perceptionAmount:1000,reductions:0,retentionBase:1000,retentionRate:19,penalties:0,isin:'',loanStartDate:'',loanEndDate:'',loanCompensation:0,loanGuarantees:0,stateWithholding:0,navarraWithholding:0,alavaWithholding:0,gipuzkoaWithholding:0,bizkaiaWithholding:0,ceutaPalmaCode:'0',previousPayerTaxId:'',accrualDate:'',marketKey:''}}]};
      const samples:any={111:export111(company,2026,'1T',standard),115:export115(company,2026,'1T',standard),123:export123(company,2026,'1T',standard),130:export130(company,2026,'1T',standard),303:export303(company,profile,2026,'1T',standard)};
      const expected:any={111:1000,115:500,123:600,130:600,303:2598}; const checks=Object.entries(samples).map(([model,content]:any)=>({model,length:content.length,expected:expected[model],validLength:content.length===expected[model],hasEndMarker:content.includes(`</T${model}0`),hasNaN:content.includes('NaN')}));
      const wrappedChecks=Object.entries(samples).map(([model,content]:any)=>{const wrapped=wrap(model,2026,'1T',content,'B12345678'); const layoutErrors=transferLayoutErrors(model,wrapped); return {model,length:wrapped.length,layoutErrors,validEnvelope:wrapped.startsWith(`<T${model}020261T0000>`)&&wrapped.endsWith(`</T${model}020261T0000>`),valid:layoutErrors.length===0}});
      const record180=export180(company,2025,annual180,'1801234567890').split('\r\n');
      const record190Content=export190(company,2025,annual190,'1901234567890'); const record190=record190Content.split('\r\n');
      const record193Content=export193(company,2025,annual193,'1931234567890'); const record193=record193Content.split('\r\n');
      const record347=export347(company,2025,thirdParties,'3471234567890').split('\r\n');
      const import415Content=export415Import(company,2025,thirdParties); const import415=import415Content.split('\r\n');
      const model390Content=wrap('390',2025,'0A',export390(company,profile,[],2025,standard,[]),'B12345678');
      const transferChecks=[
        {model:'180',records:record180.length,recordLengths:record180.map(line=>line.length),valid:record180.length===2&&record180.every(line=>line.length===500)&&record180[1].startsWith('2180')},
        {model:'190',records:record190.length,recordLengths:record190.map(line=>line.length),layoutErrors:transferLayoutErrors('190',record190Content),valid:record190.length===2&&record190.every(line=>line.length===500)&&record190[1].startsWith('2190')&&record190[1][77]==='A'&&transferLayoutErrors('190',record190Content).length===0},
        {model:'193',records:record193.length,recordLengths:record193.map(line=>line.length),layoutErrors:transferLayoutErrors('193',record193Content),valid:record193.length===2&&record193.every(line=>line.length===500)&&record193[1].startsWith('2193')&&record193[1][91]==='C'&&record193[0][234]==='S'&&transferLayoutErrors('193',record193Content).length===0},
        {model:'347',records:record347.length,recordLengths:record347.map(line=>line.length),valid:record347.length===2&&record347.every(line=>line.length===500)&&record347[1][75]==='D'},
        {model:'390',records:9,recordLengths:Object.values(MODEL390_LAYOUT).map((layout:any)=>layout.length),layoutErrors:transferLayoutErrors('390',model390Content),valid:model390Content.includes('<T39001000>')&&model390Content.includes('</T39008000>')&&transferLayoutErrors('390',model390Content).length===0},
        {model:'415',records:import415.length,recordLengths:import415.map(line=>line.length),layoutErrors:transferLayoutErrors('415',import415Content),valid:import415.length===3&&import415[0].length===246&&import415[1].length===356&&import415[2].length===309&&import415[1].startsWith('2415')&&import415[2].startsWith('3415')&&import415[1].slice(113,128)==='000000000700000'&&import415[1].slice(160,164)==='2024'&&transferLayoutErrors('415',import415Content).length===0},
      ];
      const handoff417=exportAtcHandoff('417',company,2026,'01',standard,{blockers:[],warnings:[]},'self-test');
      const handoff420=exportAtcHandoff('420',company,2026,'1T',standard,{blockers:[],warnings:[]},'self-test');
      const handoff421=exportAtcHandoff('421',company,2026,'1T',{result:21,fields:standard.fields},{blockers:[],warnings:[]},'self-test');
      const handoffCheck={model:'417/420/421/425 handoff',valid:[handoff417,handoff420,handoff421].every(content=>content.includes('PASO_FINAL')&&content.split('\r\n').length>8)&&handoff417.includes('DEVENGADO_21_BASE')&&handoff420.includes('DEVENGADO_21_BASE')&&handoff421.includes('"421"')};
      const accessCompany={id:'company-test',owner_email:'owner@example.test',usuarios_autorizados:['authorized@example.test']};
      const authorizationCheck:any={model:'legacy user authorization',owner:false,authorized:false,directCompany:false,crossCompanyDenied:false};
      try{authorize({role:'user',email:'owner@example.test'},'company-test',accessCompany);authorizationCheck.owner=true;}catch{}
      try{authorize({role:'user',email:'authorized@example.test'},'company-test',accessCompany);authorizationCheck.authorized=true;}catch{}
      try{authorize({role:'user',company_id:'company-test'},'company-test',accessCompany);authorizationCheck.directCompany=true;}catch{}
      try{authorize({role:'user',email:'other@example.test',company_id:'other-company'},'company-test',accessCompany);}catch{authorizationCheck.crossCompanyDenied=true;}
      authorizationCheck.valid=authorizationCheck.owner&&authorizationCheck.authorized&&authorizationCheck.directCompany&&authorizationCheck.crossCompanyDenied;
      const parsed130=parseFiledText('130',samples['130']); const parsed303=parseFiledText('303',samples['303']); const parsed190=parseFiledText('190',record190Content); const parsed390=parseFiledText('390',model390Content); const parsed415=parseFiledText('415',import415Content);
      const prior130=previous130FromFilings({year:2026,period:'3T',filings:[
        {id:'130-q1',modeloCodigo:'130',ejercicio:2026,periodo:'1T',estadoPresentacion:'presentado',fechaPresentacion:'2026-04-20',casillasPresentadas:{'07':120,'15':0,'16':20,'19':-30}},
        {id:'130-q2',modeloCodigo:'130',ejercicio:2026,periodo:'2T',estadoPresentacion:'presentado',fechaPresentacion:'2026-07-20',casillasPresentadas:{'07':50,'15':10,'16':0,'19':40}},
      ]});
      const prior303=previousIndirectBalanceFromFilings({year:2026,period:'2T',filings:[{id:'303-q1-balance',modeloCodigo:'303',ejercicio:2026,periodo:'1T',estadoPresentacion:'presentado',fechaPresentacion:'2026-04-20',importeFinal:-40,resultadoDestino:'a_compensar',casillasPresentadas:{'110':30,'78':10,'87':20,'71':-40}}]},'303');
      const lateReceivedLine={id:'tax-line-late',sourceId:'InvoiceTaxLine:tax-line-late',date:'2026-03-15',receiptDate:'2026-04-25',taxKind:'iva',rate:21,base:100,quota:21,deductibleQuota:21,reviewStatus:'validado',invoice:{id:'invoice-late',tipo:'recibida',numero_factura:'R-LATE-1'}};
      const carrySelection=selectIndirectTaxLines({year:2026,period:'2T',profile:{},filings:[{id:'303-q1',modeloCodigo:'303',ejercicio:2026,periodo:'1T',estadoPresentacion:'presentado',fechaPresentacion:'2026-04-20'}],taxLines:[lateReceivedLine]},bounds(2026,'2T'),'iva',false);
      const lateOutputItems=lateItemsAfterFiling({taxLines:[{id:'tax-line-output',sourceId:'InvoiceTaxLine:tax-line-output',date:'2026-03-10',created_date:'2026-04-25',taxKind:'iva',quota:42,invoice:{id:'invoice-output',tipo:'emitida',numero_factura:'E-LATE-1'}}],invoices:[],invoicePayments:[],payrolls:[],entries:[]},'303',2026,'1T',{fechaPresentacion:'2026-04-20'});
      const historyChecks={
        parsedFiledReturn:parsed130?.model==='130'&&parsed130?.year===2026&&parsed130?.period==='1T'&&money(parsed130?.boxes?.['19'])===20&&money(parsed303?.boxes?.['71'])===21&&money(parsed303?.boxes?.['110'])===0,
        annualRoundTrip:parsed190?.year===2025&&money(parsed190?.boxes?.RETENCIONES)===2400&&parsed390?.year===2025&&money(parsed390?.boxes?.RESULTADO)===21&&parsed415?.year===2025&&money(parsed415?.boxes?.IMPORTE_B)===3500,
        cumulative130:prior130.complete&&prior130.negativeComplete&&prior130.amount===150&&prior130.negativeAmount===20&&prior130.filings.length===2,
        compensationWallet303:prior303.complete&&prior303.amount===60,
        lateDeduction:carrySelection.lines.length===1&&carrySelection.carry.length===1&&carrySelection.carry[0].targetPeriod==='2T'&&carrySelection.review.length===0,
        outputCorrection:lateOutputItems.length===1&&lateOutputItems[0].treatment==='rectificar_periodo_origen',
      };
      const retainedInvoice={id:'invoice-retained-partial',tipo:'recibida',numero_factura:'R-PARTIAL',categoria_gasto:'servicios_profesionales',base_imponible:100,cuota_iva:21,importe_retencion:15,total_factura:106,estado_cobro:'parcial'};
      const retainedData:any={invoices:[retainedInvoice],invoicePayments:[{id:'rp1',invoice_id:retainedInvoice.id,amount:53,payment_date:'2026-03-31'},{id:'rp2',invoice_id:retainedInvoice.id,amount:53,payment_date:'2026-04-01'}],payrolls:[],warnings:[],blockers:[]};
      const retainedQ1=retainedPaymentEvents(retainedData,bounds(2026,'1T'));
      const retainedQ2=retainedPaymentEvents(retainedData,bounds(2026,'2T'));
      const calculated111Q1=calculate111({...retainedData,warnings:[],blockers:[]},bounds(2026,'1T'));
      const reccInvoice={id:'invoice-recc',tipo:'emitida',numero_factura:'E-RECC',fecha_emision:'2026-01-15',base_imponible:100,cuota_iva:21,total_factura:121};
      const reccLine={id:'recc-line',sourceId:'InvoiceTaxLine:recc-line',date:'2026-01-15',invoice:reccInvoice,taxKind:'iva',regime:'criterio_caja',operationType:'subject_taxed',rate:21,base:100,quota:21,deductibleQuota:21,reviewStatus:'validado'};
      const reccData:any={invoicePayments:[{id:'recc-p1',invoice_id:reccInvoice.id,amount:60.5,payment_date:'2026-03-31'},{id:'recc-p2',invoice_id:reccInvoice.id,amount:60.5,payment_date:'2026-04-01'}],warnings:[]};
      const reccQ1=cashTaxLineForPeriod(reccLine,reccData,bounds(2026,'1T')).line;
      const reccQ2=cashTaxLineForPeriod(reccLine,reccData,bounds(2026,'2T')).line;
      const forcedInvoice={...reccInvoice,id:'invoice-recc-forced',fecha_emision:'2025-02-01'};
      const forcedLine={...reccLine,id:'recc-line-forced',sourceId:'InvoiceTaxLine:recc-line-forced',date:'2025-02-01',invoice:forcedInvoice};
      const reccForced=cashTaxLineForPeriod(forcedLine,{invoicePayments:[],warnings:[]},bounds(2026,'4T')).line;
      const entries130=[{id:'e130-jan',date:'2026-01-10',status:'confirmado',isBalanced:true},{id:'e130-may',date:'2026-05-10',status:'confirmado',isBalanced:true},{id:'e130-jul',date:'2026-07-10',status:'confirmado',isBalanced:true}];
      const lines130=[{id:'l130-jan-r',journalEntryId:'e130-jan',accountCode:'705000',credit:1000,debit:0},{id:'l130-jan-e',journalEntryId:'e130-jan',accountCode:'629000',debit:200,credit:0},{id:'l130-may-r',journalEntryId:'e130-may',accountCode:'705000',credit:500,debit:0},{id:'l130-jul-r',journalEntryId:'e130-jul',accountCode:'705000',credit:900,debit:0}];
      const result130Q2=calculate130({entries:entries130,entryLines:lines130,invoices:[],filings:[],profile:{irpfEstimation:'directa_normal'},period:'2T',year:2026,warnings:[],blockers:[]},bounds(2026,'2T'),{additionalComputableIncome:0,nonComputableAccountingIncome:0,additionalDeductibleExpenses:0,nonDeductibleAccountingExpenses:0,previousPayments:0,priorNegativeResults:0,applyDifficultJustificationExpenses:false});
      const retainedIncomeInvoice={id:'invoice-130-retained',tipo:'emitida',numero_factura:'E-130-RET',fecha_emision:'2026-01-10',cliente_nif:'B87654321',cliente_nombre:'CLIENTE RETENCION',base_imponible:100,cuota_iva:21,importe_retencion:15,total_factura:106,estado_cobro:'parcial'};
      const retainedIncomeData:any={entries:entries130,entryLines:lines130,invoices:[retainedIncomeInvoice],invoicePayments:[{id:'income-pay-q1',invoice_id:retainedIncomeInvoice.id,amount:53,payment_date:'2026-03-31'},{id:'income-pay-q2',invoice_id:retainedIncomeInvoice.id,amount:53,payment_date:'2026-04-01'}],filings:[],profile:{irpfEstimation:'directa_normal'},year:2026,warnings:[],blockers:[]};
      const retainedIncomeQ1=calculate130({...retainedIncomeData,period:'1T',warnings:[],blockers:[]},bounds(2026,'1T'),{previousYearNetIncome:13000,article110Reduction:0});
      const retainedIncomeQ2=calculate130({...retainedIncomeData,period:'2T',warnings:[],blockers:[]},bounds(2026,'2T'),{previousPayments:0,priorNegativeResults:0,previousYearNetIncome:13000,article110Reduction:0,previousSamePeriodResult:10});
      const cash130Data:any={entries:[],entryLines:[],invoices:[{id:'cash-130-income',tipo:'emitida',fecha_emision:'2026-01-10',base_imponible:100,total_factura:100},{id:'cash-130-expense',tipo:'recibida',fecha_emision:'2026-01-15',base_imponible:40,total_factura:40}],invoicePayments:[{id:'cash-130-income-q1',invoice_id:'cash-130-income',amount:50,payment_date:'2026-03-31'},{id:'cash-130-income-q2',invoice_id:'cash-130-income',amount:50,payment_date:'2026-04-01'},{id:'cash-130-expense-q1',invoice_id:'cash-130-expense',amount:20,payment_date:'2026-03-31'},{id:'cash-130-expense-q2',invoice_id:'cash-130-expense',amount:20,payment_date:'2026-04-01'}],filings:[],profile:{entityType:'autonomo',irpfEstimation:'directa_normal',irpfImputationMethod:'cash',irpfImputationMethodConfirmed:true,irpfCashMethodEffectiveFrom:'2026-01-01',irpfCashMethodMinimumUntil:'2028-12-31'},year:2026,warnings:[],blockers:[]};
      const cash130Q1=calculate130({...cash130Data,period:'1T',warnings:[],blockers:[]},bounds(2026,'1T'),{previousYearNetIncome:13000,article110Reduction:0});
      const cash130Q2=calculate130({...cash130Data,period:'2T',warnings:[],blockers:[]},bounds(2026,'2T'),{previousPayments:0,priorNegativeResults:0,previousYearNetIncome:13000,article110Reduction:0});
      const special130=calculate130({entries:[{id:'e130-special',date:'2026-01-10',status:'confirmado',isBalanced:true}],entryLines:[{id:'l130-special',journalEntryId:'e130-special',accountCode:'705000',credit:1000,debit:0}],invoices:[],invoicePayments:[],filings:[],profile:{irpfEstimation:'directa_normal',mainTerritory:'ceuta_melilla',model130TerritorialRelief:'ceuta',model130TerritorialReliefConfirmed:true},period:'1T',year:2026,warnings:[],blockers:[]},bounds(2026,'1T'),{previousYearNetIncome:13000,article110Reduction:0,agricultureRevenue:1000,agricultureWithholdings:0});
      const unconfirmedSpecial130=calculate130({entries:[{id:'e130-special-unconfirmed',date:'2026-01-10',status:'confirmado',isBalanced:true}],entryLines:[{id:'l130-special-unconfirmed',journalEntryId:'e130-special-unconfirmed',accountCode:'705000',credit:1000,debit:0}],invoices:[],invoicePayments:[],filings:[],profile:{irpfEstimation:'directa_normal',mainTerritory:'ceuta_melilla'},period:'1T',year:2026,warnings:[],blockers:[]},bounds(2026,'1T'),{previousYearNetIncome:13000,article110Reduction:0});
      const negative130=calculate130({entries:[{id:'e130-loss',date:'2026-01-10',status:'confirmado',isBalanced:true}],entryLines:[{id:'l130-loss',journalEntryId:'e130-loss',accountCode:'629000',debit:1000,credit:0}],invoices:[],invoicePayments:[],filings:[],profile:{irpfEstimation:'directa_normal'},period:'1T',year:2026,warnings:[],blockers:[]},bounds(2026,'1T'),{previousYearNetIncome:13000,article110Reduction:0,agricultureRevenue:0,agricultureWithholdings:10});
      const receivedThirdParty={id:'invoice-347-date',tipo:'recibida',numero_factura:'R-347',fecha_emision:'2026-03-31',fecha_recepcion:'2026-04-02',proveedor_nif:'B87654321',proveedor_nombre:'PROVEEDOR PRUEBA',proveedor_pais:'ES',proveedor_provincia:'Santa Cruz de Tenerife',categoria_gasto:'compras',base_imponible:4000,cuota_iva:0,total_factura:4000};
      const thirdPartyBase:any={invoices:[receivedThirdParty],invoicePayments:[],taxLines:[],declarables:[],warnings:[],blockers:[]};
      const third347=calculateThirdParties({...thirdPartyBase,warnings:[],blockers:[]},bounds(2026,'Anual'),'347');
      const third415=calculateThirdParties({...thirdPartyBase,warnings:[],blockers:[]},bounds(2026,'Anual'),'415');
      const cashThirdInvoice={id:'invoice-third-cash',tipo:'emitida',numero_factura:'E-CASH',fecha_emision:'2025-02-10',cliente_nif:'B87654321',cliente_nombre:'CLIENTE CAJA',cliente_pais:'ES',cliente_provincia:'Santa Cruz de Tenerife',categoria_gasto:'ventas',base_imponible:3305.79,cuota_iva:694.21,total_factura:4000};
      const cashThirdData:any={invoices:[cashThirdInvoice],invoicePayments:[{id:'cash-third-p1',invoice_id:cashThirdInvoice.id,amount:2500,payment_date:'2025-11-10'},{id:'cash-third-p2',invoice_id:cashThirdInvoice.id,amount:1500,payment_date:'2026-04-10'}],taxLines:[{id:'cash-third-line',invoiceId:cashThirdInvoice.id,regime:'criterio_caja'}],declarables:[],warnings:[],blockers:[]};
      const cash347Year1=calculateThirdParties({...cashThirdData,warnings:[],blockers:[]},bounds(2025,'Anual'),'347');
      const cash347Year2=calculateThirdParties({...cashThirdData,warnings:[],blockers:[]},bounds(2026,'Anual'),'347');
      const cash415Year1=calculateThirdParties({...cashThirdData,warnings:[],blockers:[]},bounds(2025,'Anual'),'415');
      const cash415Year2=calculateThirdParties({...cashThirdData,warnings:[],blockers:[]},bounds(2026,'Anual'),'415');
      const temporalChecks={
        strictPeriods:!!periodValidationError('130','01')&&!!periodValidationError('390','4T')&&!periodValidationError('303','12')&&!periodValidationError('111','2T'),
        policy130:periodPolicy('130',2026,'2T').calculationStart==='2026-01-01'&&periodPolicy('130',2026,'2T').calculationEnd==='2026-06-30',
        partialRetentionOnce:retainedQ1.length===1&&retainedQ2.length===1&&retainedQ1[0].base===50&&retainedQ2[0].base===50&&money(retainedQ1[0].withholding+retainedQ2[0].withholding)===15,
        model111EconomicBoxes:fieldMap(calculated111Q1)['07']===1&&fieldMap(calculated111Q1)['08']===50&&fieldMap(calculated111Q1)['09']===7.5&&samples['111'].slice(192,200)==='00000001'&&samples['111'].slice(200,217).endsWith('10000'),
        reccPartialAndDeadline:reccQ1?.base===50&&reccQ1?.quota===10.5&&reccQ2?.base===50&&reccQ2?.quota===10.5&&reccForced?.base===100&&reccForced?.cashRecognition?.events?.[0]?.date==='2026-12-31',
        cumulative130ByQuarterEnd:fieldMap(result130Q2)['01']===1500&&fieldMap(result130Q2)['02']===200,
        model130PaymentAndBoxes:fieldMap(retainedIncomeQ1)['06']===7.5&&fieldMap(retainedIncomeQ2)['06']===15&&fieldMap(retainedIncomeQ2)['18']===10&&fieldMap(negative130)['12']===0,
        model130CashBasis:fieldMap(cash130Q1)['01']===50&&fieldMap(cash130Q1)['02']===20&&fieldMap(cash130Q2)['01']===100&&fieldMap(cash130Q2)['02']===40,
        model130TerritorialRates:fieldMap(special130)['04']===80&&fieldMap(special130)['09']===8&&fieldMap(unconfirmedSpecial130)['04']===200,
        thirdPartyDates:third347.details?.[0]?.fullQuarters?.T2===4000&&third415.details?.[0]?.fullQuarters?.T1===4000,
        cashThirdPartiesDualAccrual:[cash347Year1,cash415Year1].every((result:any)=>result.details?.[0]?.total===4000&&result.details?.[0]?.cashAccountingAnnualAmount===2500&&Object.values(result.details?.[0]?.quarters||{}).every((value:any)=>value===0))&&[cash347Year2,cash415Year2].every((result:any)=>result.details?.[0]?.total===0&&result.details?.[0]?.cashAccountingAnnualAmount===1500),
      };
      const temporalDiagnostics={model130:{q1Withholdings:fieldMap(retainedIncomeQ1)['06'],q2Withholdings:fieldMap(retainedIncomeQ2)['06'],box18:fieldMap(retainedIncomeQ2)['18'],negativeBox12:fieldMap(negative130)['12'],specialBox04:fieldMap(special130)['04'],specialBox09:fieldMap(special130)['09'],unconfirmedTerritoryBox04:fieldMap(unconfirmedSpecial130)['04'],cashQ1Income:fieldMap(cash130Q1)['01'],cashQ1Expense:fieldMap(cash130Q1)['02'],cashQ2Income:fieldMap(cash130Q2)['01'],cashQ2Expense:fieldMap(cash130Q2)['02']},cashThirdParties:{year1:{general:cash347Year1.details?.[0]?.total,cash:cash347Year1.details?.[0]?.cashAccountingAnnualAmount},year2:{general:cash347Year2.details?.[0]?.total,cash:cash347Year2.details?.[0]?.cashAccountingAnnualAmount}}};
      const traceData={
        invoices:[{id:'invoice-trace',tipo:'recibida',numero_factura:'R-TRACE',proveedor_nombre:'PROVEEDOR PRUEBA',proveedor_nif:'B87654321',fecha_emision:'2026-01-10',concepto:'Servicio',base_imponible:100,cuota_iva:21,total_factura:121}],
        taxLines:[{id:'tax-trace',sourceId:'InvoiceTaxLine:tax-trace',invoiceId:'invoice-trace',lineNumber:1,operationDate:'2026-01-10',taxKind:'iva',rate:21,base:100,quota:21,deductibleQuota:21,invoice:{id:'invoice-trace',tipo:'recibida',numero_factura:'R-TRACE',proveedor_nombre:'PROVEEDOR PRUEBA',proveedor_nif:'B87654321',fecha_emision:'2026-01-10',base_imponible:100,cuota_iva:21,total_factura:121}}],
        invoicePayments:[{id:'payment-trace',invoice_id:'invoice-trace',amount:121,payment_date:'2026-02-01',method:'transferencia'}],
        payrolls:[{id:'payroll-trace',employee_name:'PERSONA PRUEBA',employee_tax_id:'12345678Z',period_label:'2026-01',total_accruals:1000,irpf_amount:100,net_pay:900}],
        entries:[{id:'entry-trace',entryNumber:'1',date:'2026-01-10',description:'Factura recibida'}],
        entryLines:[{id:'line-trace',journalEntryId:'entry-trace',accountCode:'629000',accountName:'Otros servicios',debit:100,credit:0,documentId:'invoice-trace'}],
        filings:[{id:'filing-trace',modeloCodigo:'303',ejercicio:2026,periodo:'1T',fechaPresentacion:'2026-04-20',importeFinal:21,estadoPresentacion:'presentado'}],
      };
      const traceability=traceField({code:'TRACE',label:'Prueba de trazabilidad',value:21,formula:'Suma de fuentes.',dependsOn:['01'],sourceIds:['InvoiceTaxLine:tax-trace','InvoicePayment:payment-trace','PayrollExtraction:payroll-trace','JournalEntryLine:line-trace','TaxFiling:filing-trace','ManualAdjustment:trace']},traceData,1,25);
      const traceabilityChecks={allTypesResolved:traceability.total===6&&traceability.unresolvedCount===0,invoiceLinked:traceability.sources.filter((item:any)=>['InvoiceTaxLine','InvoicePayment','JournalEntryLine'].includes(item.type)).every((item:any)=>item.invoiceId==='invoice-trace'),formulaPreserved:traceability.field.formula==='Suma de fuentes.'&&traceability.field.dependsOn[0]==='01'};
      const extensionBase:any={invoices:[],taxLines:[],invoicePayments:[],payrolls:[],employees:[],entries:[],entryLines:[],declarables:[],filings:[],activities:[],profile:{},warnings:[],blockers:[],year:2026,period:'1T'};
      const result131=calculate131({...extensionBase,warnings:[],blockers:[]},bounds(2026,'1T'),{modulesNetYield:10000,salariedEmployees:0,noBaseDataRevenue:1000,agricultureRevenue:2000,withholdings:10,previousYearNetIncome:9500,priorNegativeResults:25,housingDeduction:10,previousSamePeriodResult:5});
      const result216=calculate216({...extensionBase,warnings:[],blockers:[],declarables:[{id:'d216-1',modeloCodigo:'216',recordKey:'r1',payload:{recipientTaxId:'EU1',recipientName:'PERCEPTOR UE',country:'FR',incomeKey:'01',dividendOrEquityIncome:true,withholdingBase:1000,withholdingAmount:190,paymentDate:'2026-02-01'}},{id:'d216-2',modeloCodigo:'216',recordKey:'r2',payload:{recipientTaxId:'EU2',recipientName:'PERCEPTOR UE 2',country:'DE',incomeKey:'02',notSubjectToWithholding:true,withholdingBase:500,paymentDate:'2026-02-02'}}]},bounds(2026,'1T'),{});
      const result296=calculate296({...extensionBase,warnings:[],blockers:[],declarables:[{id:'d296-1',modeloCodigo:'296',recordKey:'r1',payload:{recipientTaxId:'EU1',recipientName:'PERCEPTOR UE',country:'FR',incomeKey:'01',accruedAmount:1000,withholdingBase:1000,withholdingAmount:190,paymentDate:'2026-02-01'}}]},bounds(2026,'Anual'));
      const intraInvoice={id:'inv349',tipo:'emitida',numero_factura:'IC-1',fecha_emision:'2026-02-10',cliente_nif:'FR123',cliente_nombre:'CLIENTE UE',cliente_pais:'FR'};
      const result349=calculate349({...extensionBase,warnings:[],blockers:[],taxLines:[{id:'tl349',sourceId:'InvoiceTaxLine:tl349',date:'2026-02-10',operationType:'intra_eu_supply',regime:'intracomunitaria',base:1500,invoice:intraInvoice}]},bounds(2026,'1T'));
      const result421=calculate421({...extensionBase,warnings:[],blockers:[],period:'4T'},bounds(2026,'4T'),{annualActivityQuota1:1000,currentInputQuota:400,minimumQuotaRate:30,previousQuarterAdvances:300,fixedAssetAndReverseChargeOutput:20,previousCompensationBalance:10});
      const result200=calculate200({...extensionBase,warnings:[],blockers:[],entries:[{id:'je200',date:'2026-06-30',status:'confirmado',isBalanced:true}],entryLines:[{id:'jl7',journalEntryId:'je200',accountCode:'705000',credit:10000,debit:0},{id:'jl6',journalEntryId:'je200',accountCode:'629000',debit:6000,credit:0}]},bounds(2026,'Anual'),{taxableIncreases:1000,taxableDecreases:500,taxLossCarryforward:500,taxRate:25,taxCredits:100,withholdings:50,instalmentPayments:100});
      const result202=calculate202({...extensionBase,warnings:[],blockers:[],period:'2P'},bounds(2026,'2P'),{method:'40_3',currentTaxableBase:10000,paymentPercentage:17,withholdings:100,previousInstalmentPayments:200});
      const result232=calculate232({...extensionBase,warnings:[],blockers:[],declarables:[{id:'d232',modeloCodigo:'232',recordKey:'r232',payload:{relatedPartyTaxId:'B00000001',relatedPartyName:'VINCULADA',country:'ES',relationType:'socio',operationType:'servicios',valuationMethod:'precio_libre_comparable',category:'related',amount:4000}}]},bounds(2026,'Anual'));
      const result417=calculateIndirectTax({...extensionBase,warnings:[],blockers:[],period:'01',profile:{usesSII:true},taxLines:[{id:'tl417',sourceId:'InvoiceTaxLine:tl417',date:'2026-01-10',taxKind:'igic',rate:7,base:100,quota:7,deductibleQuota:0,operationType:'subject_taxed',reviewStatus:'validado',invoice:{id:'inv417',tipo:'emitida',numero_factura:'IGIC-1'}}]},bounds(2026,'01'),'igic',false,{previousCompensationBalance:0},'417');
      const extensionChecks={
        catalogHasAllNine:['349','131','216','296','417','421','200','202','232'].every(code=>TARGET_MODELS.includes(code)&&!!DEFINITIONS[code]),
        strictSpecialPeriods:!periodValidationError('202','1P')&&!!periodValidationError('202','1T')&&!periodValidationError('417','12')&&!!periodValidationError('417','4T')&&!periodValidationError('421','4T')&&!periodValidationError('296','Anual'),
        model131Boxes:fieldMap(result131)['01']===10000&&fieldMap(result131)['07']===260&&fieldMap(result131)['15']===135,
        model216Boxes:fieldMap(result216)['05']===1&&fieldMap(result216)['16']===1&&fieldMap(result216)['21']===190,
        model296Annual:fieldMap(result296)['PERCEPTORES']===1&&fieldMap(result296)['RETENCIONES']===190,
        model349Intra:fieldMap(result349)['OPERADORES']===1&&fieldMap(result349)['OPERACIONES']===1500&&result349.details?.[0]?.operationKey==='E',
        model421FourthQuarter:fieldMap(result421)['09']===600&&fieldMap(result421)['11']===300&&fieldMap(result421)['19']===310,
        corporateModels:fieldMap(result200)['RDO_CONTABLE']===4000&&fieldMap(result200)['BASE']===4000&&result200.result===750&&result202.result===1400,
        model232ExplicitOnly:fieldMap(result232)['REGISTROS']===1&&fieldMap(result232)['VINCULADAS']===4000,
        model417Sii:result417.result===7&&fieldMap(result417)['DEVENGADO']===7,
        guidedOnly:['349','131','216','296','417','421','200','202','232'].every(code=>DEFINITIONS[code].handoffExport===true&&DEFINITIONS[code].officialExport===false),
      };
      const profileRegressionChecks={
        autonomoIva:fieldMap(result130Q2)['01']===1500,
        professionalWithRetentions:fieldMap(calculated111Q1)['09']===7.5,
        companyAccounting:fieldMap(result200)['RDO_CONTABLE']===4000,
        generalIgic:result417.operations?.outputQuota===7,
        repepSafety:deductionDecision({date:'2026-01-10',base:100,quota:7,deductibleQuota:7,invoice:{id:'repep',tipo:'recibida'}},{year:2026,period:'1T',profile:{repepStatus:'incluido'},filings:[]},bounds(2026,'1T'),'420').treatment==='no_deducible_repep',
        healthExempt:calculateIndirectTax({...extensionBase,warnings:[],blockers:[],taxLines:[{sourceId:'InvoiceTaxLine:health',date:'2026-01-10',taxKind:'iva',base:100,quota:0,deductibleQuota:0,operationType:'exempt_limited',reviewStatus:'validado',invoice:{id:'health',tipo:'emitida'}}]},bounds(2026,'1T'),'iva',false,{previousCompensationBalance:0}).operations?.outputQuota===0,
        mixedTerritories:TARGET_MODELS.includes('303')&&TARGET_MODELS.includes('420'),
        intraCommunity:result349.details?.length===1,
      };
      const ok=checks.every((c:any)=>c.validLength&&c.hasEndMarker&&!c.hasNaN)&&wrappedChecks.every((c:any)=>c.validEnvelope&&c.valid)&&transferChecks.every(item=>item.valid)&&handoffCheck.valid&&authorizationCheck.valid&&Object.values(historyChecks).every(Boolean)&&Object.values(temporalChecks).every(Boolean)&&Object.values(traceabilityChecks).every(Boolean)&&Object.values(extensionChecks).every(Boolean)&&Object.values(profileRegressionChecks).every(Boolean); return Response.json({ok,engineVersion:ENGINE_VERSION,checks,wrappedChecks,transferChecks,handoffCheck,authorizationCheck,historyChecks,temporalChecks,temporalDiagnostics,traceabilityChecks,extensionChecks,profileRegressionChecks});
    }
    if(action==='context') {
      const companyId=clean(body.companyId); if(!companyId) return Response.json({error:'companyId es obligatorio.'},{status:400});
      const svc=base44.asServiceRole; const company=await svc.entities.Company.get(companyId); if(!company) return Response.json({error:'Empresa no encontrada.'},{status:404});
      authorize(user,companyId,company);
      const profiles=await listAll(svc.entities.FiscalProfile,{company_id:companyId}); const profile=profiles.find((item:any)=>item.active!==false)||profiles[0]||null;
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,profile:profile?{id:profile.id,entityType:profile.entityType,mainTerritory:profile.mainTerritory,taxAuthority:profile.taxAuthority,indirectTaxDefault:profile.indirectTaxDefault,irpfEstimation:profile.irpfEstimation,irpfImputationMethod:profile.irpfImputationMethod||'accrual',irpfImputationMethodConfirmed:booleanValue(profile.irpfImputationMethodConfirmed),irpfCashMethodEffectiveFrom:profile.irpfCashMethodEffectiveFrom||'',irpfCashMethodMinimumUntil:profile.irpfCashMethodMinimumUntil||'',subjectToIRPF:booleanValue(profile.subjectToIRPF),model130ExemptionConfirmed:booleanValue(profile.model130ExemptionConfirmed),model130TerritorialRelief:profile.model130TerritorialRelief||'none',model130TerritorialReliefConfirmed:booleanValue(profile.model130TerritorialReliefConfirmed),isLargeCompany:booleanValue(profile.isLargeCompany),isREDEME:booleanValue(profile.isREDEME),usesSII:booleanValue(profile.usesSII),repepStatus:profile.repepStatus,profileStatus:profile.profileStatus}:null});
    }
    const companyId=clean(body.companyId); const model=clean(body.modeloCodigo); const year=Number(body.ejercicio); const period=normalizedPeriod(body.periodo||'Anual');
    if(!companyId) return Response.json({error:'companyId es obligatorio.'},{status:400});
    const svc=base44.asServiceRole; const company=await svc.entities.Company.get(companyId);
    if(!company) return Response.json({error:'Empresa no encontrada.'},{status:404});
    authorize(user,companyId,company);

    if(action==='download_official_file') {
      const fileId=clean(body.fileId); if(!fileId) return Response.json({error:'fileId es obligatorio.'},{status:400});
      const file=await svc.entities.TaxOfficialFile.get(fileId);
      if(!file||file.companyId!==companyId) return Response.json({error:'Fichero fiscal no encontrado.'},{status:404});
      if(!clean(file.contentBase64)) return Response.json({error:'Este fichero histórico no conservó su contenido exacto. Debe regenerarse desde su borrador congelado.'},{status:410});
      return Response.json({ok:true,file:{id:file.id,filename:file.nombreFichero,extension:file.extension,format:file.formato,design:file.versionDiseno,hash:file.hash,contentBase64:file.contentBase64,contentEncoding:file.contentEncoding||'base64',contentSize:Number(file.contentSize||0),immutable:file.immutable!==false,taxDraftId:file.taxDraftId||'',sourceHash:file.sourceHash||'',snapshotHash:file.snapshotHash||''}});
    }

    if(action==='open_draft') {
      const draftId=clean(body.draftId); if(!draftId) return Response.json({error:'draftId es obligatorio.'},{status:400});
      const draft=await svc.entities.TaxDraft.get(draftId); if(!draft||draft.companyId!==companyId) return Response.json({error:'Borrador no encontrado.'},{status:404});
      const recommendations=[...(Array.isArray(draft.validaciones)?draft.validaciones:[]),...(Array.isArray(draft.errores)?draft.errores:[])].map((item:any)=>clean(typeof item==='string'?item:item?.message||item?.descripcion)).filter(Boolean);
      const draftModel=clean(draft.modeloCodigo); const draftYear=Number(draft.ejercicio); const draftPeriod=normalizedPeriod(draft.periodo);
      const savedDefinition=draft.resumen?.definition||{code:draftModel,...DEFINITIONS[draftModel]};
      const savedCalculation=draft.resumen?.calculation||{fields:[],details:[],result:money(draft.resultadoCalculado)};
      const savedSource=draft.resumen?.source||{hash:draft.sourceHash||'',count:0,ids:[],stats:{}};
      const savedAdjustments=Object.fromEntries((Array.isArray(draft.ajustesManuales)?draft.ajustesManuales:[]).map((item:any)=>[item.field,item.value]));
      return Response.json({
        ok:true,engineVersion:draft.engineVersion||ENGINE_VERSION,frozen:true,
        definition:savedDefinition,company:{id:company.id,name:company.razon_social||company.nombre_comercial,taxId:company.nif_cif},
        period:{year:draftYear,period:draftPeriod,...bounds(draftYear,draftPeriod),policy:periodPolicy(draftModel,draftYear,draftPeriod)},calculation:savedCalculation,history:draft.resumen?.history||null,
        validation:{blockers:[],warnings:recommendations,recommendations,technicalErrors:[],canSaveDraft:true,canExport:DEFINITIONS[draftModel]?.officialExport||DEFINITIONS[draftModel]?.handoffExport,canExportOfficial:!!DEFINITIONS[draftModel]?.officialExport,requiresReview:recommendations.length>0},
        source:savedSource,sources:SOURCES,adjustments:savedAdjustments,
        draft:{id:draft.id,modeloCodigo:draftModel,ejercicio:draftYear,periodo:draftPeriod,version:Number(draft.version||1),estado:draft.estado||'borrador',engineVersion:draft.engineVersion||'',snapshotHash:draft.snapshotHash||'',sourceHash:draft.sourceHash||savedSource.hash||'',frozenAt:draft.frozenAt||draft.created_date||'',usuarioCreador:draft.usuarioCreador||''},
      });
    }

    if(action==='workspace') {
      const yearFilter=year?{companyId,ejercicio:year}:{companyId};
      const [draftRows,filingRows,periodRows,officialFileRows,fiscalErrorRows,profileRows,modelRows,legacySubmissionRows]=await Promise.all([
        listAll(svc.entities.TaxDraft,yearFilter),
        listAll(svc.entities.TaxFiling,yearFilter),
        listAll(svc.entities.TaxPeriod,yearFilter),
        listAll(svc.entities.TaxOfficialFile,yearFilter),
        listAll(svc.entities.FiscalError,{company_id:companyId}),
        listAll(svc.entities.FiscalProfile,{company_id:companyId}),
        listAll(svc.entities.TaxModel,{companyId}),
        listAll(svc.entities.TaxSubmission,yearFilter),
      ]);
      const periodKey=(item:any)=>`${clean(item?.modeloCodigo)}|${Number(item?.ejercicio)||0}|${normalizedPeriod(item?.periodo)}`;
      const normalizeMessages=(items:any,severity:string)=>(Array.isArray(items)?items:[]).map((item:any)=>typeof item==='string'?{severity,message:item}:{severity,message:clean(item?.message||item?.descripcion||item?.title)}).filter((item:any)=>item.message);
      const drafts=draftRows.map((item:any)=>{
        const recommendations=normalizeMessages([...(Array.isArray(item.validaciones)?item.validaciones:[]),...(Array.isArray(item.errores)?item.errores:[])],'recommendation');
        return {
        id:item.id,modeloCodigo:item.modeloCodigo,ejercicio:Number(item.ejercicio),periodo:item.periodo,version:Number(item.version||1),parentDraftId:item.parentDraftId||'',estado:item.estado||'borrador',
        engineVersion:item.engineVersion||clean(item.origenDatos).split(':')[0]||'',sourceHash:item.sourceHash||item.resumen?.source?.hash||clean(item.origenDatos).split(':').slice(1).join(':'),snapshotHash:item.snapshotHash||'',
        resultadoCalculado:money(item.resultadoCalculado??item.resumen?.calculation?.result),sourceCount:Number(item.resumen?.source?.count||0),sourceStats:item.resumen?.source?.stats||{},definition:item.resumen?.definition||{},calculation:item.resumen?.calculation||{},
        warnings:recommendations,recommendations,blockers:[],adjustments:Array.isArray(item.ajustesManuales)?item.ajustesManuales:[],usuarioCreador:item.usuarioCreador||'',usuarioRevisor:item.usuarioRevisor||'',notas:item.notas||'',
        createdAt:item.frozenAt||item.created_date||'',updatedAt:item.updated_date||item.frozenAt||item.created_date||'',
        };
      });
      const draftByKey=new Map<string,any>();
      for(const item of [...drafts].sort((a:any,b:any)=>(Number(b.version)-Number(a.version))||(new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime()))) if(!draftByKey.has(periodKey(item))) draftByKey.set(periodKey(item),item);
      const latestDrafts=[...draftByKey.values()];
      const filings=filingRows.map((item:any)=>({
        id:item.id,modeloCodigo:item.modeloCodigo,ejercicio:Number(item.ejercicio),periodo:item.periodo,estadoPresentacion:item.estadoPresentacion||'presentado',via:item.via||'presentacion_manual',fechaPresentacion:item.fechaPresentacion||'',fechaImportacion:item.fechaImportacion||item.created_date||'',
        snapshotVersion:Number(item.snapshotVersion||1),tipoDeclaracion:item.tipoDeclaracion||'original',declaracionAnteriorId:item.declaracionAnteriorId||'',numeroJustificanteAnterior:item.numeroJustificanteAnterior||'',numeroJustificante:item.numeroJustificante||'',csv:item.csv||'',
        justificantePdfUrl:item.justificantePdfUrl||'',ficheroPresentadoUrl:item.ficheroPresentadoUrl||'',nombreFicheroImportado:item.nombreFicheroImportado||'',hashFicheroImportado:item.hashFicheroImportado||'',snapshotHash:item.snapshotHash||'',
        fuenteImportacion:item.fuenteImportacion||'',revisionImportacion:item.revisionImportacion||'pendiente_revision',snapshotBloqueado:item.snapshotBloqueado!==false,resultadoDestino:item.resultadoDestino||'',importeFinal:money(item.importeFinal),
        avisosImportacion:Array.isArray(item.avisosImportacion)?item.avisosImportacion:[],analisisArrastre:item.analisisArrastre||{},confirmadoPorUsuario:item.confirmadoPorUsuario===true,usuarioPresentador:item.usuarioPresentador||item.importadoPor||'',respuestaAdministracion:item.respuestaAdministracion||'',notas:item.notas||'',createdAt:item.created_date||item.fechaImportacion||'',
      }));
      const filingByKey=new Map<string,any>();
      for(const item of [...filings].sort((a:any,b:any)=>(Number(b.snapshotVersion)-Number(a.snapshotVersion))||(new Date(b.fechaPresentacion||b.createdAt||0).getTime()-new Date(a.fechaPresentacion||a.createdAt||0).getTime()))) if(!filingByKey.has(periodKey(item))) filingByKey.set(periodKey(item),item);
      const profile=profileRows.find((item:any)=>item.active!==false)||profileRows[0]||null;
      const activeModels=modelRows.filter((item:any)=>item.activo!==false);
      const validationIssues:any[]=[];
      const addIssue=(severity:string,code:string,message:string,extra:any={})=>validationIssues.push({id:`${code}:${extra.sourceId||validationIssues.length}`,severity,code,message,...extra});
      if(!profile) addIssue('warning','CFG-PERFIL','Falta el perfil fiscal maestro de la empresa.',{category:'configuracion'});
      else if(profile.profileStatus!=='validado_asesor') addIssue('warning','CFG-REVISION','El perfil fiscal no consta validado por un asesor.',{category:'configuracion',sourceId:profile.id});
      if(activeModels.length===0) addIssue('warning','CFG-OBLIGACIONES','No hay obligaciones fiscales activas y sincronizadas.',{category:'configuracion'});
      for(const draft of latestDrafts) {
        for(const issue of draft.recommendations) addIssue('warning','BORRADOR-RECOMENDACION',issue.message,{category:'borrador',sourceId:draft.id,modeloCodigo:draft.modeloCodigo,ejercicio:draft.ejercicio,periodo:draft.periodo});
      }
      for(const filing of filings) {
        if(filing.revisionImportacion==='pendiente_revision') addIssue('warning','PRESENTACION-REVISION','La extracción/importación de la presentación está pendiente de revisión.',{category:'presentacion',sourceId:filing.id,modeloCodigo:filing.modeloCodigo,ejercicio:filing.ejercicio,periodo:filing.periodo});
        if(!filing.numeroJustificante&&!filing.csv&&!filing.justificantePdfUrl&&!filing.ficheroPresentadoUrl) addIssue('warning','PRESENTACION-EVIDENCIA','La presentación no tiene justificante, CSV ni fichero presentado asociado.',{category:'presentacion',sourceId:filing.id,modeloCodigo:filing.modeloCodigo,ejercicio:filing.ejercicio,periodo:filing.periodo});
        for(const message of filing.avisosImportacion) addIssue('warning','PRESENTACION-AVISO',clean(message),{category:'presentacion',sourceId:filing.id,modeloCodigo:filing.modeloCodigo,ejercicio:filing.ejercicio,periodo:filing.periodo});
      }
      for(const savedPeriod of periodRows.filter((item:any)=>item.estado==='presentado')) if(!filingByKey.has(periodKey(savedPeriod))) addIssue('warning','PERIODO-SIN-SNAPSHOT','El período figura presentado pero no existe una foto de la declaración. Importe el modelo presentado para mejorar la fiabilidad de los arrastres.',{category:'presentacion',sourceId:savedPeriod.id,modeloCodigo:savedPeriod.modeloCodigo,ejercicio:savedPeriod.ejercicio,periodo:savedPeriod.periodo});
      for(const legacy of legacySubmissionRows.filter((item:any)=>['presentado','validado'].includes(item.estado))) if(!filingByKey.has(periodKey(legacy))) addIssue('warning','LEGACY-SIN-MIGRAR','Existe un registro antiguo de presentación sin casillas incorporadas al histórico fiscal. Importe el modelo presentado para habilitar arrastres fiables.',{category:'presentacion',sourceId:legacy.id,modeloCodigo:legacy.modeloCodigo,ejercicio:legacy.ejercicio,periodo:legacy.periodo});
      for(const issue of fiscalErrorRows.filter((item:any)=>!['resuelto','ignorado'].includes(item.estado))) addIssue('warning','INCIDENCIA-FISCAL',issue.descripcion||issue.tipo,{category:'incidencia',sourceId:issue.id,entityType:issue.entidad_tipo||'',entityId:issue.entidad_id||'',recommendedAction:issue.accion_recomendada||'',status:issue.estado,severitySource:issue.severidad});
      for(const file of officialFileRows.filter((item:any)=>item.estado==='rechazado_validacion')) for(const message of (file.errores||['Fichero rechazado por la validación interna.'])) addIssue('warning','FICHERO-RECHAZADO',clean(message),{category:'fichero',sourceId:file.id,modeloCodigo:file.modeloCodigo,ejercicio:file.ejercicio,periodo:file.periodo});
      const events:any[]=[
        ...drafts.map((item:any)=>({id:`draft:${item.id}`,type:'draft',date:item.updatedAt||item.createdAt,title:`Borrador ${item.modeloCodigo} v${item.version}`,detail:`${item.periodo} ${item.ejercicio} · ${item.estado}`,modeloCodigo:item.modeloCodigo,ejercicio:item.ejercicio,periodo:item.periodo,status:item.estado,result:item.resultadoCalculado,hash:item.snapshotHash||item.sourceHash,sourceId:item.id})),
        ...filings.map((item:any)=>({id:`filing:${item.id}`,type:'filing',date:item.fechaPresentacion||item.fechaImportacion||item.createdAt,title:`${item.tipoDeclaracion==='original'?'Presentación':'Declaración '+item.tipoDeclaracion} ${item.modeloCodigo}`,detail:`${item.periodo} ${item.ejercicio} · snapshot v${item.snapshotVersion}`,modeloCodigo:item.modeloCodigo,ejercicio:item.ejercicio,periodo:item.periodo,status:item.estadoPresentacion,result:item.importeFinal,hash:item.snapshotHash,sourceId:item.id})),
        ...officialFileRows.map((item:any)=>({id:`file:${item.id}`,type:'file',date:item.fechaGeneracion||item.created_date,title:`Fichero ${item.modeloCodigo}`,detail:`${item.nombreFichero||'Fichero fiscal'} · ${item.estado||'generado'}`,modeloCodigo:item.modeloCodigo,ejercicio:Number(item.ejercicio),periodo:item.periodo,status:item.estado||'generado',hash:item.hash||'',sourceId:item.id})),
      ].filter((item:any)=>item.date).sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime());
      const officialFiles=officialFileRows.map((item:any)=>({id:item.id,modeloCodigo:item.modeloCodigo,ejercicio:Number(item.ejercicio),periodo:item.periodo,administracion:item.administracion,nombreFichero:item.nombreFichero,extension:item.extension,formato:item.formato,versionDiseno:item.versionDiseno,fileUrl:item.fileUrl||'',hash:item.hash||'',contentSize:Number(item.contentSize||0),immutable:item.immutable===true,hasStoredContent:!!clean(item.contentBase64),sourceHash:item.sourceHash||'',snapshotHash:item.snapshotHash||'',generadoPor:item.generadoPor||'',fechaGeneracion:item.fechaGeneracion||item.created_date||'',estado:item.estado||'generado',errores:item.errores||[],avisos:item.avisos||[],taxDraftId:item.taxDraftId||''}));
      const legacySubmissions=legacySubmissionRows.map((item:any)=>({id:item.id,modeloCodigo:item.modeloCodigo,ejercicio:Number(item.ejercicio),periodo:item.periodo,estado:item.estado||'pendiente',viaPresentacion:item.viaPresentacion||'',fechaEnvio:item.fechaEnvio||item.created_date||'',numeroJustificante:item.numeroJustificante||'',csv:item.csv||'',justificantePdfUrl:item.justificantePdfUrl||'',importeFinal:money(item.importeFinal),incorporadoAlHistorico:filingByKey.has(periodKey(item))}));
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,generatedAt:new Date().toISOString(),year:year||null,profile:profile?{id:profile.id,profileStatus:profile.profileStatus,mainTerritory:profile.mainTerritory,taxAuthority:profile.taxAuthority,indirectTaxDefault:profile.indirectTaxDefault,filingFrequency:profile.filingFrequency,repepStatus:profile.repepStatus,usesSII:booleanValue(profile.usesSII),isREDEME:booleanValue(profile.isREDEME),isLargeCompany:booleanValue(profile.isLargeCompany)}:null,models:activeModels.map((item:any)=>({id:item.id,codigo:item.codigo,nombre:item.nombre,administracion:item.administracion,periodicidad:item.periodicidad,fuenteValidacion:item.fuenteValidacion,activo:item.activo!==false})),drafts,latestDrafts,filings,latestFilings:[...filingByKey.values()],periods:periodRows,officialFiles,legacySubmissions,validationIssues,events,stats:{drafts:drafts.length,latestDrafts:latestDrafts.length,filings:filings.length,presentedPeriods:periodRows.filter((item:any)=>item.estado==='presentado').length,officialFiles:officialFiles.length,blockers:0,warnings:validationIssues.length,recommendations:validationIssues.length,evidencePending:filings.filter((item:any)=>!item.numeroJustificante&&!item.csv&&!item.justificantePdfUrl&&!item.ficheroPresentadoUrl).length,legacyPending:legacySubmissions.filter((item:any)=>!item.incorporadoAlHistorico).length}});
    }

    if(action==='update_draft_status') {
      const draftId=clean(body.draftId); const nextStatus=clean(body.status);
      if(!draftId||!['borrador','en_revision','revisado','aprobado','rechazado'].includes(nextStatus)) return Response.json({error:'draftId y estado válido son obligatorios.'},{status:400});
      const draft=await svc.entities.TaxDraft.get(draftId); if(!draft||draft.companyId!==companyId) return Response.json({error:'Borrador no encontrado.'},{status:404});
      const role=clean(user?.role).toLowerCase(); const canReview=['admin','super_admin','advisor','asesor'].includes(role);
      if(['revisado','aprobado','rechazado'].includes(nextStatus)&&!canReview) return Response.json({error:'Solo un asesor o administrador puede revisar, aprobar o rechazar un borrador.'},{status:403});
      const relatedAll=await svc.entities.TaxDraft.filter({companyId,modeloCodigo:draft.modeloCodigo,ejercicio:draft.ejercicio},'-created_date',100);
      const related=(relatedAll||[]).filter((item:any)=>normalizedPeriod(item.periodo)===normalizedPeriod(draft.periodo));
      const latest=[...(related||[])].sort((a:any,b:any)=>(Number(b.version||0)-Number(a.version||0))||(new Date(b.updated_date||b.created_date||0).getTime()-new Date(a.updated_date||a.created_date||0).getTime()))[0];
      if(latest?.id!==draft.id) return Response.json({error:'Solo puede cambiarse el estado de la última versión del borrador.'},{status:409});
      const update:any={estado:nextStatus}; if(canReview&&['revisado','aprobado','rechazado'].includes(nextStatus)) update.usuarioRevisor=user.email;
      const saved=await svc.entities.TaxDraft.update(draft.id,update);
      const stateMap:any={borrador:'borrador',en_revision:'pendiente_revision',revisado:'revisado',aprobado:'listo_presentar',rechazado:'pendiente_revision'};
      const allPeriods=await svc.entities.TaxPeriod.filter({companyId,modeloCodigo:draft.modeloCodigo,ejercicio:draft.ejercicio},'-created_date',100);
      const periods=(allPeriods||[]).filter((item:any)=>normalizedPeriod(item.periodo)===normalizedPeriod(draft.periodo));
      if(periods?.[0]&&periods[0].estado!=='presentado') await svc.entities.TaxPeriod.update(periods[0].id,{estado:stateMap[nextStatus],notas:`Borrador ${draft.id} · ${nextStatus}`});
      return Response.json({ok:true,draft:saved});
    }

    if(action==='attach_filing_evidence') {
      const filingId=clean(body.filingId); if(!filingId||body.confirmEvidence!==true) return Response.json({error:'Selecciona la presentación y confirma expresamente la evidencia.'},{status:400});
      const filing=await svc.entities.TaxFiling.get(filingId); if(!filing||filing.companyId!==companyId) return Response.json({error:'Presentación no encontrada.'},{status:404});
      const incoming={numeroJustificante:clean(body.numeroJustificante),csv:clean(body.csv),justificantePdfUrl:clean(body.justificantePdfUrl),respuestaAdministracion:clean(body.respuestaAdministracion)};
      if(!incoming.numeroJustificante&&!incoming.csv&&!incoming.justificantePdfUrl&&!incoming.respuestaAdministracion) return Response.json({error:'Añade un justificante, CSV, PDF o respuesta de la Administración.'},{status:400});
      for(const key of ['numeroJustificante','csv'] as const) if(clean(filing[key])&&incoming[key]&&clean(filing[key])!==incoming[key]) return Response.json({error:`La evidencia ya contiene ${key}. Para sustituir una declaración, importa una nueva versión enlazada.`},{status:409});
      const update:any={confirmadoPorUsuario:true}; for(const [key,value] of Object.entries(incoming)) if(value) update[key]=value;
      if(incoming.numeroJustificante||incoming.csv||incoming.justificantePdfUrl) update.estadoPresentacion='presentado';
      const saved=await svc.entities.TaxFiling.update(filing.id,update);
      const allPeriods=await svc.entities.TaxPeriod.filter({companyId,modeloCodigo:filing.modeloCodigo,ejercicio:filing.ejercicio},'-created_date',100);
      const periods=(allPeriods||[]).filter((item:any)=>normalizedPeriod(item.periodo)===normalizedPeriod(filing.periodo));
      if(periods?.[0]) await svc.entities.TaxPeriod.update(periods[0].id,{estado:'presentado',importeConfirmado:money(filing.importeFinal),resultado:filing.resultadoDestino||taxPeriodOutcome(filing.modeloCodigo,money(filing.importeFinal)),notas:`Evidencia acreditada · snapshot ${filing.id}`});
      return Response.json({ok:true,filing:saved});
    }

    if((!TARGET_MODELS.includes(model)&&!['calculate_bundle','historical_fiscal_dry_run'].includes(action))||!year) return Response.json({error:'modeloCodigo y ejercicio son obligatorios.'},{status:400});
    if(!['calculate_bundle','historical_fiscal_dry_run'].includes(action)) {
      const periodError=periodValidationError(model,period);
      if(periodError) return Response.json({error:periodError},{status:400});
    }
    const [profiles,activities,invoices,rawTaxLines,invoicePayments,payrolls,employees,entries,entryLines,declarables,filings]=await Promise.all([
      listAll(svc.entities.FiscalProfile,{company_id:companyId}), listAll(svc.entities.FiscalActivity,{company_id:companyId}), listAll(svc.entities.Invoice,{company_id:companyId}), listAll(svc.entities.InvoiceTaxLine,{companyId}), listAll(svc.entities.InvoicePayment,{company_id:companyId}), listAll(svc.entities.PayrollExtraction,{company_id:companyId}), listAll(svc.entities.Employee,{company_id:companyId}), listAll(svc.entities.JournalEntry,{companyId}), listAll(svc.entities.JournalEntryLine,{companyId}), listAll(svc.entities.TaxDeclarableRecord,{companyId,ejercicio:year}), listAll(svc.entities.TaxFiling,{companyId}),
    ]);
    const profile=profiles.find((p:any)=>p.active!==false)||profiles[0]||null; const blockers:string[]=[]; const warnings:string[]=[];
    if(!company.nif_cif) blockers.push('La empresa no tiene NIF/CIF configurado.');
    else if(!validSpanishTaxId(company.nif_cif)) blockers.push('El NIF/CIF de la empresa no tiene nueve caracteres válidos para los diseños oficiales.');
    if(!company.razon_social) blockers.push('La empresa no tiene razón social legal configurada.');
    if(!profile) blockers.push('Falta el perfil fiscal de la empresa.'); else if(profile.profileStatus!=='validado_asesor') warnings.push('El perfil fiscal no consta como validado por asesor.');
    const taxLines=normalizedTaxLines(invoices,rawTaxLines,warnings,blockers); const b=bounds(year,period);
    const data={company,profile,activities,invoices,taxLines,invoicePayments,payrolls,employees,entries,entryLines,declarables,filings,blockers,warnings,period,year};
    if(action==='historical_fiscal_dry_run') {
      const yearInvoices=invoices.filter((invoice:any)=>!invoice.anulada&&dateOf(invoice).slice(0,4)===String(year));
      const linesByInvoice=new Map<string,any[]>(); for(const line of rawTaxLines||[]) linesByInvoice.set(line.invoiceId,[...(linesByInvoice.get(line.invoiceId)||[]),line]);
      const fingerprintGroups=new Map<string,any[]>();
      for(const invoice of yearInvoices){const counterparty=invoiceCounterparty(invoice);const fingerprint=[invoice.tipo,canonical(invoice.numero_factura),canonical(counterparty.id),dateOf(invoice).slice(0,10),money(invoice.total_factura).toFixed(2)].join('|');fingerprintGroups.set(fingerprint,[...(fingerprintGroups.get(fingerprint)||[]),invoice]);}
      const duplicates=[...fingerprintGroups.entries()].filter(([,rows])=>rows.length>1).map(([fingerprint,rows])=>({fingerprint,count:rows.length,invoiceIds:rows.map((row:any)=>row.id)}));
      const missingTaxLines=yearInvoices.filter((invoice:any)=>!(linesByInvoice.get(invoice.id)||[]).length).map((invoice:any)=>invoice.id);
      const pendingReview=yearInvoices.filter((invoice:any)=>clean(invoice.fiscal_review_status)!=='validado'||(linesByInvoice.get(invoice.id)||[]).some((line:any)=>clean(line.reviewStatus)!=='validado')).map((invoice:any)=>invoice.id);
      const missingEntries=yearInvoices.filter((invoice:any)=>!clean(invoice.linked_journal_entry_id)).map((invoice:any)=>invoice.id);
      const missingDates=yearInvoices.filter((invoice:any)=>!dateOf(invoice)).map((invoice:any)=>invoice.id);
      const invalidTotals=yearInvoices.filter((invoice:any)=>Math.abs(money(invoice.base_imponible)+money(invoice.cuota_iva)-money(invoice.importe_retencion)-money(invoice.total_factura))>0.02).map((invoice:any)=>invoice.id);
      const proposedActions=[
        {code:'NORMALIZE_TAX_LINES',count:missingTaxLines.length,write:false,description:'Crear propuestas de líneas fiscales sin sobrescribir las facturas.'},
        {code:'REVIEW_FISCAL_TREATMENT',count:pendingReview.length,write:false,description:'Revisar territorio, sujeción, exención, ISP y deducibilidad.'},
        {code:'LINK_ACCOUNTING_ENTRY',count:missingEntries.length,write:false,description:'Localizar o proponer el asiento contable de cada factura.'},
        {code:'RESOLVE_DUPLICATES',count:duplicates.reduce((sum,group)=>sum+group.count-1,0),write:false,description:'Revisar duplicados por huella estable sin eliminar documentos.'},
      ];
      return Response.json({ok:true,dryRun:true,engineVersion:ENGINE_VERSION,companyId,year,generatedAt:new Date().toISOString(),stats:{invoices:yearInvoices.length,withNormalizedTaxLines:yearInvoices.length-missingTaxLines.length,missingTaxLines:missingTaxLines.length,pendingReview:pendingReview.length,missingEntries:missingEntries.length,missingDates:missingDates.length,invalidTotals:invalidTotals.length,duplicateGroups:duplicates.length},findings:{missingTaxLines,pendingReview,missingEntries,missingDates,invalidTotals,duplicates},proposedActions,writeOperations:0,message:'Análisis completado sin modificar facturas, asientos, líneas fiscales ni presentaciones.'});
    }
    if(['preview_period_close','close_period','reopen_period'].includes(action)) {
      const draftRows=await svc.entities.TaxDraft.filter({companyId,modeloCodigo:model,ejercicio:year},'-created_date',500);
      const latestDraft=(draftRows||[]).filter((item:any)=>normalizedPeriod(item.periodo)===period).sort((a:any,z:any)=>Number(z.version||0)-Number(a.version||0))[0]||null;
      const allPeriods=await svc.entities.TaxPeriod.filter({companyId,modeloCodigo:model,ejercicio:year},'-created_date',100);
      const periodRow=(allPeriods||[]).find((item:any)=>normalizedPeriod(item.periodo)===period)||null;
      const recommendationCount=Array.isArray(latestDraft?.validaciones)?latestDraft.validaciones.length:0;
      const checks=[
        {code:'DRAFT_FROZEN',label:'Borrador guardado e inmutable',status:latestDraft?'ok':'required',detail:latestDraft?`v${latestDraft.version||1} · ${clean(latestDraft.snapshotHash).slice(0,16)}`:'Calcula y guarda un borrador antes de cerrar.'},
        {code:'PROFILE_REVIEW',label:'Perfil fiscal revisado',status:profile?.profileStatus==='validado_asesor'?'ok':'recommendation',detail:profile?.profileStatus||'sin perfil validado'},
        {code:'RECOMMENDATIONS',label:'Recomendaciones revisadas',status:recommendationCount?'recommendation':'ok',detail:`${recommendationCount} recomendación(es) en el borrador`},
        {code:'FILING_EVIDENCE',label:'Presentación/evidencia',status:latestFiling(filings,model,year,period)?'ok':'not_presented',detail:latestFiling(filings,model,year,period)?'Existe snapshot presentado':'El cierre de trabajo no marca el modelo como presentado'},
      ];
      if(action==='preview_period_close') return Response.json({ok:true,engineVersion:ENGINE_VERSION,model,year,period,periodRow,latestDraft:latestDraft?{id:latestDraft.id,version:Number(latestDraft.version||1),snapshotHash:latestDraft.snapshotHash,sourceHash:latestDraft.sourceHash,resultadoCalculado:money(latestDraft.resultadoCalculado)}:null,checks,canClose:!!latestDraft,recommendations:checks.filter((item:any)=>item.status==='recommendation').map((item:any)=>item.detail)});
      if(action==='close_period') {
        if(body.confirmClose!==true) return Response.json({error:'Confirma expresamente el cierre del período.'},{status:400});
        if(!latestDraft) return Response.json({error:'No se puede cerrar el período sin un borrador guardado.'},{status:409});
        const payload:any={companyId,modeloCodigo:model,ejercicio:year,periodo:period,fechaInicio:b.start,fechaFin:b.end,closureStatus:'closed',closedAt:new Date().toISOString(),closedBy:user.email,closureDraftId:latestDraft.id,closureSnapshotHash:latestDraft.snapshotHash,closureChecks:checks,importeCalculado:money(latestDraft.resultadoCalculado),notas:`Período cerrado sobre borrador v${latestDraft.version||1}. Las recomendaciones no equivalen a errores técnicos ni acreditan presentación.`};
        const saved=periodRow?await svc.entities.TaxPeriod.update(periodRow.id,payload):await svc.entities.TaxPeriod.create({...payload,estado:'revisado',resultado:taxPeriodOutcome(model,money(latestDraft.resultadoCalculado))});
        return Response.json({ok:true,period:saved,checks,message:'Período fiscal cerrado sobre una fotografía concreta. No se ha marcado como presentado.'});
      }
      const reason=clean(body.reason); if(body.confirmReopen!==true||reason.length<8) return Response.json({error:'Confirma la reapertura e indica un motivo de al menos 8 caracteres.'},{status:400});
      if(!periodRow||periodRow.closureStatus!=='closed') return Response.json({error:'El período no consta cerrado.'},{status:409});
      const saved=await svc.entities.TaxPeriod.update(periodRow.id,{closureStatus:'reopened',reopenedAt:new Date().toISOString(),reopenedBy:user.email,reopenReason:reason,notas:`Período reabierto: ${reason}`});
      return Response.json({ok:true,period:saved,message:'Período reabierto con trazabilidad. El borrador cerrado permanece inmutable.'});
    }
    if(action==='field_trace') {
      let traceCalculation:any=null; let traceAdjustments:any=body.adjustments||{}; let draft:any=null;
      const draftId=clean(body.draftId);
      if(draftId) {
        draft=await svc.entities.TaxDraft.get(draftId);
        if(!draft||draft.companyId!==companyId) return Response.json({error:'Borrador no encontrado.'},{status:404});
        if(clean(draft.modeloCodigo)!==model||Number(draft.ejercicio)!==year||normalizedPeriod(draft.periodo)!==period) return Response.json({error:'El borrador no corresponde al modelo, ejercicio y período seleccionados.'},{status:409});
        traceCalculation=draft.resumen?.calculation;
        traceAdjustments=Object.fromEntries((Array.isArray(draft.ajustesManuales)?draft.ajustesManuales:[]).map((item:any)=>[item.field,item.value]));
      } else {
        traceCalculation=calculate(model,data,b,traceAdjustments);
      }
      const field=(traceCalculation?.fields||[]).find((item:any)=>clean(item.code)===clean(body.fieldCode)&&(!clean(body.fieldLabel)||clean(item.label)===clean(body.fieldLabel))&&(!clean(body.fieldSection)||clean(item.section)===clean(body.fieldSection)));
      if(!field) return Response.json({error:'Casilla no encontrada en este cálculo.'},{status:404});
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,frozen:!!draft,draftId:draft?.id||'',...traceField(field,{...data,adjustments:traceAdjustments},body.page,body.pageSize)});
    }
    if(action==='preview_filed_return'||action==='import_filed_return') {
      const normalized=normalizeFiledImport(body,company,model,year,period);
      if(action==='preview_filed_return') return Response.json({ok:normalized.errors.length===0,engineVersion:ENGINE_VERSION,...normalized});
      if(body.confirmImport!==true) return Response.json({error:'Confirma expresamente que los datos coinciden con el modelo realmente presentado.'},{status:400});
      if(normalized.errors.length) return Response.json({error:'El modelo presentado no supera los controles de importación.',blockers:normalized.errors,warnings:normalized.warnings,preview:normalized.preview},{status:422});
      if(normalized.preview.declarationType!=='original'&&!normalized.preview.previousJustificationNumber) return Response.json({error:'Una declaración complementaria, rectificativa o sustitutiva debe identificar el justificante anterior.'},{status:422});
      const snapshotHash=normalized.preview.fileHash&&/^[a-f0-9]{64}$/.test(normalized.preview.fileHash)
        ? normalized.preview.fileHash
        : await sha256(JSON.stringify({companyId,model,year,period,boxes:normalized.preview.boxes,result:normalized.preview.result,resultDisposition:normalized.preview.resultDisposition,justification:normalized.preview.justificationNumber,date:normalized.preview.presentationDate}));
      const duplicate=(filings||[]).find((row:any)=>row.modeloCodigo===model&&Number(row.ejercicio)===year&&normalizedPeriod(row.periodo)===period&&([row.hashFicheroImportado,row.snapshotHash].map(clean).includes(snapshotHash)||(normalized.preview.justificationNumber&&clean(row.numeroJustificante)===normalized.preview.justificationNumber)));
      if(duplicate) return Response.json({ok:true,alreadyImported:true,filing:duplicate,preview:normalized.preview,warnings:unique([...normalized.warnings,'Este mismo modelo ya estaba importado; no se ha creado un duplicado.'])});
      const previousVersions=(filings||[]).filter((row:any)=>row.modeloCodigo===model&&Number(row.ejercicio)===year&&normalizedPeriod(row.periodo)===period);
      const previous=previousVersions.sort((a:any,z:any)=>Number(z.snapshotVersion||0)-Number(a.snapshotVersion||0))[0]||null;
      if(previous&&normalized.preview.declarationType==='original') return Response.json({error:'Ya existe una declaración original para este período.',blockers:['Si el fichero corresponde a una corrección posterior, selecciónalo como complementaria, rectificativa o sustitutiva e indica el justificante anterior.']},{status:409});
      const linkedPrevious=normalized.preview.previousJustificationNumber
        ? previousVersions.find((row:any)=>clean(row.numeroJustificante)===normalized.preview.previousJustificationNumber)
        : previous;
      if(previous&&normalized.preview.declarationType!=='original'&&!linkedPrevious) return Response.json({error:'El justificante anterior no coincide con ninguna versión importada de este período.'},{status:422});
      const filing=await svc.entities.TaxFiling.create({
        companyId,modeloCodigo:model,ejercicio:year,periodo:period,estadoPresentacion:'presentado',via:'presentacion_manual',
        fechaPresentacion:normalized.preview.presentationDate,fechaImportacion:new Date().toISOString(),importadoPor:user.email,
        snapshotVersion:Math.max(0,...previousVersions.map((row:any)=>Number(row.snapshotVersion||0)))+1,
        tipoDeclaracion:normalized.preview.declarationType,declaracionAnteriorId:linkedPrevious?.id||'',numeroJustificanteAnterior:normalized.preview.previousJustificationNumber,
        numeroJustificante:normalized.preview.justificationNumber,csv:clean(body.csv),importeFinal:normalized.preview.result,resultadoDestino:normalized.preview.resultDisposition,
        ficheroPresentadoUrl:normalized.preview.fileUrl,nombreFicheroImportado:normalized.preview.fileName,hashFicheroImportado:snapshotHash,
        fuenteImportacion:normalized.preview.source,casillasPresentadas:normalized.preview.boxes,sourceIdsPresentados:Array.isArray(body.sourceIdsPresentados)?unique(body.sourceIdsPresentados.map(clean).filter(Boolean)):[],
        snapshotBloqueado:true,revisionImportacion:normalized.preview.source==='fichero_oficial'?'validado_estructura':'revisado_usuario',
        avisosImportacion:unique(normalized.warnings),snapshotHash,analisisArrastre:{engineVersion:ENGINE_VERSION,importedAsImmutableSnapshot:true},confirmadoPorUsuario:true,usuarioPresentador:user.email,notas:clean(body.notes),
      });
      const allPeriodRows=await svc.entities.TaxPeriod.filter({companyId,modeloCodigo:model,ejercicio:year},'-created_date',100);
      const periodRows=(allPeriodRows||[]).filter((item:any)=>normalizedPeriod(item.periodo)===period);
      const periodOutcome=['a_ingresar','a_devolver','a_compensar','cero','informativo'].includes(normalized.preview.resultDisposition) ? normalized.preview.resultDisposition : taxPeriodOutcome(model,normalized.preview.result);
      const periodPayload={companyId,modeloCodigo:model,ejercicio:year,periodo:period,fechaInicio:b.start,fechaFin:b.end,estado:'presentado',importeConfirmado:normalized.preview.result,resultado:periodOutcome,notas:`Modelo importado en Taxea · snapshot ${filing.id}`};
      if(periodRows?.[0]) await svc.entities.TaxPeriod.update(periodRows[0].id,periodPayload); else await svc.entities.TaxPeriod.create(periodPayload);
      return Response.json({ok:true,alreadyImported:false,filing,preview:normalized.preview,warnings:normalized.warnings,nextStep:'Calcula el período siguiente. Taxea utilizará las cifras presentadas para el arrastre y analizará las facturas incorporadas con posterioridad.'});
    }
    if(action==='delete_declarable') {
      const recordId=clean(body.recordId); if(!recordId) return Response.json({error:'recordId es obligatorio.'},{status:400});
      const record=await svc.entities.TaxDeclarableRecord.get(recordId);
      if(!record||record.companyId!==companyId||clean(record.modeloCodigo)!==model||Number(record.ejercicio)!==year) return Response.json({error:'Registro declarable no encontrado.'},{status:404});
      await svc.entities.TaxDeclarableRecord.delete(recordId);
      return Response.json({ok:true,deletedId:recordId});
    }
    if(action==='upsert_declarable') {
      if(!['180','190','193','216','232','296','347','349','415'].includes(model)) return Response.json({error:'El enriquecimiento manual estructurado no está habilitado para este modelo.'},{status:400});
      const recordKey=clean(body.recordKey); if(!recordKey) return Response.json({error:'recordKey es obligatorio.'},{status:400});
      const sourceId=clean(body.sourceId); const sourceType=clean(body.sourceType)||'manual'; const input=body.payload||{};
      const allowed180=['representativeTaxId','recipientProvinceCode','modality','withholdingRate','accrualYear','propertySituation','cadastralReference','roadType','roadName','numberingType','houseNumber','numberQualifier','block','portal','stair','floor','door','complement','locality','municipality','municipalityCode','propertyProvinceCode','postalCode'];
      const payload=model==='180'
        ? Object.fromEntries(allowed180.map(key=>[key,key==='withholdingRate'?money(input[key]):clean(input[key])]).filter(([,value])=>value!==''&&value!=null))
        : model==='190' ? sanitize190Payload(input)
          : model==='193' ? (recordKey==='Annual193:Declarant'?sanitize193DeclarationPayload(input):sanitize193Payload(input))
            : ['216','232','296','349'].includes(model) ? sanitizeGenericDeclarable(model,input)
              : sanitizeThirdPartyPayload(input);
      const role=clean(user?.role).toLowerCase(); const canReview=['admin','super_admin','advisor','asesor'].includes(role); const reviewRequested=body.reviewStatus==='validado_asesor';
      const reviewStatus=reviewRequested&&canReview?'validado_asesor':'pendiente_revision'; const recordPayload:any={companyId,modeloCodigo:model,ejercicio:year,recordKey,sourceType,sourceId,payload,reviewStatus,notes:clean(body.notes)};
      if(reviewStatus==='validado_asesor'){recordPayload.reviewedBy=user.email;recordPayload.reviewedAt=new Date().toISOString();}
      const existing=await svc.entities.TaxDeclarableRecord.filter({companyId,modeloCodigo:model,ejercicio:year,recordKey},'-created_date',1); const record=existing?.[0]?await svc.entities.TaxDeclarableRecord.update(existing[0].id,recordPayload):await svc.entities.TaxDeclarableRecord.create(recordPayload);
      return Response.json({ok:true,record});
    }
    if(action==='calculate_bundle') {
      const models=TARGET_MODELS.map(code=>{
        const modelPeriod=ANNUAL_MODELS.has(code)?'Anual':code==='202'?'1P':code==='417'?'01':'1T'; const modelBounds=bounds(year,modelPeriod); const modelData={...data,period:modelPeriod,blockers:[...blockers],warnings:[...warnings]}; const modelCalculation=calculate(code,modelData,modelBounds,{}); applyModelValidation(code,modelData,modelCalculation); const recommendations=unique([...modelData.blockers,...modelData.warnings]); return {code,fields:modelCalculation.fields?.length||0,details:modelCalculation.details?.length||0,result:money(modelCalculation.result),blockers:[],warnings:recommendations,recommendations,canExport:DEFINITIONS[code].officialExport||DEFINITIONS[code].handoffExport};
      });
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,models,sourceStats:{invoices:invoices.length,taxLines:taxLines.length,invoicePayments:invoicePayments.length,payrolls:payrolls.length,journalEntries:entries.length}});
    }
    let frozenDraft:any=null;
    const requestedDraftId=clean(body.draftId);
    if(requestedDraftId&&['export','export_review','export_handoff'].includes(action)) {
      frozenDraft=await svc.entities.TaxDraft.get(requestedDraftId);
      if(!frozenDraft||frozenDraft.companyId!==companyId) return Response.json({error:'Borrador no encontrado.'},{status:404});
      if(clean(frozenDraft.modeloCodigo)!==model||Number(frozenDraft.ejercicio)!==year||normalizedPeriod(frozenDraft.periodo)!==period) return Response.json({error:'El borrador no corresponde al modelo, ejercicio y período seleccionados.'},{status:409});
      if(!frozenDraft.resumen?.calculation) return Response.json({error:'El borrador no conserva una fotografía de cálculo exportable.'},{status:422});
    }
    const adjustments=frozenDraft?Object.fromEntries((Array.isArray(frozenDraft.ajustesManuales)?frozenDraft.ajustesManuales:[]).map((item:any)=>[item.field,item.value])):body.adjustments||{};
    const calculation=frozenDraft?frozenDraft.resumen.calculation:calculate(model,data,b,adjustments);
    if(!frozenDraft) applyModelValidation(model,data,calculation);
    if(['111','115','123','130','303','390'].includes(model)&&!clean(Deno.env.get('TAXEA_DEVELOPER_NIF'))) warnings.push('No está informado TAXEA_DEVELOPER_NIF. Taxea exportará el bloque auxiliar en blanco; valida el fichero en la sede AEAT antes de presentarlo.');
    const sourceIds=unique((calculation.fields||[]).flatMap((f:any)=>f.sourceIds||[]));
    const sourceHash=frozenDraft?clean(frozenDraft.sourceHash||frozenDraft.resumen?.source?.hash):await sha256(JSON.stringify({model,year,period,sourceIds,adjustments,values:(calculation.fields||[]).map((f:any)=>[f.code,f.value])}));
    const history=frozenDraft?(frozenDraft.resumen?.history||null):filingComparison(data,model,year,period,calculation);
    if(!frozenDraft&&history.presented) warnings.push('Este período ya tiene una declaración presentada. Puedes exportar otra versión, pero en la sede debes elegir el tipo correctivo que proceda e identificar el justificante anterior cuando sea obligatorio.');
    const savedRecommendations=frozenDraft?[...(Array.isArray(frozenDraft.validaciones)?frozenDraft.validaciones:[]),...(Array.isArray(frozenDraft.errores)?frozenDraft.errores:[])].map((item:any)=>clean(typeof item==='string'?item:item?.message||item?.descripcion)).filter(Boolean):[];
    const recommendations=unique(frozenDraft?[...savedRecommendations,...warnings]:[...blockers,...warnings]);
    const sourceStart=model==='130'?b.cumulativeStart:b.start;
    const sourceSnapshot=frozenDraft?.resumen?.source||{hash:sourceHash,count:sourceIds.length,ids:sourceIds,stats:{invoices:invoices.filter((f:any)=>!f.anulada&&inRange(f,sourceStart,b.end)).length,taxLines:taxLines.filter((l:any)=>inRange(l,sourceStart,b.end)).length,invoicePayments:invoicePayments.filter((p:any)=>inRange(p,sourceStart,b.end)).length,payrolls:payrolls.filter((p:any)=>inRange(p,sourceStart,b.end)).length,journalEntries:entries.filter((e:any)=>inRange(e,sourceStart,b.end)).length,filings:filings.length}};
    const result={ok:true,engineVersion:frozenDraft?.engineVersion||ENGINE_VERSION,frozen:!!frozenDraft,definition:frozenDraft?.resumen?.definition||{code:model,...DEFINITIONS[model]},company:{id:company.id,name:company.razon_social||company.nombre_comercial,taxId:company.nif_cif},period:{year,period,...b,policy:periodPolicy(model,year,period)},calculation:{...calculation,result:money(calculation.result)},history,validation:{blockers:[],warnings:recommendations,recommendations,technicalErrors:[],canSaveDraft:true,canExport:DEFINITIONS[model].officialExport||DEFINITIONS[model].handoffExport,canExportOfficial:DEFINITIONS[model].officialExport,requiresReview:recommendations.length>0},source:sourceSnapshot,sources:SOURCES,...(frozenDraft?{draft:{id:frozenDraft.id,version:Number(frozenDraft.version||1),estado:frozenDraft.estado||'borrador',snapshotHash:frozenDraft.snapshotHash||'',sourceHash,frozenAt:frozenDraft.frozenAt||frozenDraft.created_date||''}}:{})};
    if(action==='calculate') return Response.json(result);
    if(action==='export_handoff') {
      if(!DEFINITIONS[model]?.handoffExport) return Response.json({error:'El traspaso guiado no está disponible para este modelo.'},{status:400});
      const isAtcIndirect=['417','420','421','425'].includes(model);
      const content=isAtcIndirect?exportAtcHandoff(model as '417'|'420'|'421'|'425',company,year,period,calculation,result.validation,sourceHash):exportGuidedHandoff(model,company,year,period,calculation,result.validation,sourceHash);
      const filename=`${clean(company.nif_cif).toUpperCase()}_${year}_${period}_${model}_traspaso_${DEFINITIONS[model].authority}.csv`;
      const hash=await sha256(content); const contentBase64=encodeBase64(content);
      const nextStep=DEFINITIONS[model].authority==='ATC'
        ? 'Abre el programa oficial de ayuda de la ATC para este ejercicio, crea la declaración, traslada y contrasta las casillas del CSV, resuelve sus validaciones y genera allí el .dec presentable.'
        : `Abre el formulario oficial del modelo ${model} en la sede AEAT, contrasta el borrador con la documentación y completa allí la presentación. El CSV de Taxea es un paquete de trabajo, no un fichero presentable.`;
      const artifact=await svc.entities.TaxOfficialFile.create({companyId,modeloCodigo:model,ejercicio:year,periodo:period,administracion:DEFINITIONS[model].authority,nombreFichero:filename,extension:'csv',formato:`Paquete de traspaso revisable ${DEFINITIONS[model].authority}`,versionDiseno:DEFINITIONS[model].design,hash,contentBase64,contentEncoding:'base64',contentSize:new TextEncoder().encode(content).length,immutable:true,sourceHash,snapshotHash:clean(frozenDraft?.snapshotHash),taxDraftId:frozenDraft?.id||'',generadoPor:user.email,fechaGeneracion:new Date().toISOString(),estado:'generado',errores:[],avisos:recommendations,resumenLegible:JSON.stringify({engineVersion:ENGINE_VERSION,sourceHash,result:calculation.result,workflow:'guided_handoff',recommendations})});
      return Response.json({...result,file:{id:artifact.id,filename,extension:'csv',format:`Paquete de traspaso revisable ${DEFINITIONS[model].authority}`,design:DEFINITIONS[model].design,hash,contentBase64,nextStep}});
    }
    if(action==='save_draft') {
      const adjustmentsList=Object.entries(body.adjustments||{}).map(([field,value])=>({field,value,reason:clean(body.adjustmentReason)}));
      const draftSnapshotHash=await sha256(JSON.stringify({companyId,model,year,period,sourceHash,adjustments:adjustmentsList,fields:(calculation.fields||[]).map((field:any)=>[field.code,field.value]),recommendations}));
      const allExisting=await svc.entities.TaxDraft.filter({companyId,modeloCodigo:model,ejercicio:year},'-created_date',500);
      const existing=(allExisting||[]).filter((item:any)=>normalizedPeriod(item.periodo)===period);
      const duplicate=(existing||[]).find((item:any)=>clean(item.snapshotHash)===draftSnapshotHash);
      if(duplicate) return Response.json({...result,draft:duplicate,alreadySaved:true});
      const previous=[...(existing||[])].sort((a:any,b:any)=>(Number(b.version||0)-Number(a.version||0))||(new Date(b.updated_date||b.created_date||0).getTime()-new Date(a.updated_date||a.created_date||0).getTime()))[0]||null;
      const payload={companyId,modeloCodigo:model,ejercicio:year,periodo:period,version:Number(previous?.version||0)+1,parentDraftId:previous?.id||'',engineVersion:ENGINE_VERSION,sourceHash,snapshotHash:draftSnapshotHash,resultadoCalculado:money(calculation.result),frozenAt:new Date().toISOString(),origenDatos:`${ENGINE_VERSION}:${sourceHash}`,resumen:{definition:result.definition,calculation:result.calculation,source:result.source,history:result.history},validaciones:recommendations.map((message:string)=>({severity:'recommendation',message})),errores:[],ajustesManuales:adjustmentsList,usuarioCreador:user.email,estado:'borrador',notas:clean(body.notes)};
      const draft=await svc.entities.TaxDraft.create(payload);
      const allSavedPeriods=await svc.entities.TaxPeriod.filter({companyId,modeloCodigo:model,ejercicio:year},'-created_date',100);
      const savedPeriods=(allSavedPeriods||[]).filter((item:any)=>normalizedPeriod(item.periodo)===period);
      const periodPayload={companyId,modeloCodigo:model,ejercicio:year,periodo:period,fechaInicio:b.start,fechaFin:b.end,estado:'borrador',importeCalculado:money(calculation.result),resultado:taxPeriodOutcome(model,money(calculation.result)),notas:`Borrador ${draft.id} · snapshot ${draftSnapshotHash}`};
      if(savedPeriods?.[0]&&savedPeriods[0].estado!=='presentado') await svc.entities.TaxPeriod.update(savedPeriods[0].id,periodPayload); else if(!savedPeriods?.[0]) await svc.entities.TaxPeriod.create(periodPayload);
      return Response.json({...result,draft,alreadySaved:false});
    }
    if(action==='export') {
      if(!DEFINITIONS[model].officialExport) return Response.json({ok:false,error:'El diseño no está habilitado para exportación oficial segura.',blockers:[DEFINITIONS[model].designWarning||'Falta validar el diseño y todos los datos de detalle exigidos por la Administración.']},{status:422});
      let content=''; let filename=''; let extension=''; let format=''; let administration=DEFINITIONS[model].authority;
      if(model==='180') {
        content=export180(company,year,calculation,sequentialDeclarationNumber('180'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_180.txt`; extension='txt'; format='Diseño de registro AEAT modelo 180';
      } else if(model==='190') {
        content=export190(company,year,calculation,sequentialDeclarationNumber('190'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_190.txt`; extension='txt'; format='Diseño de registro AEAT modelo 190 (claves A y G)';
      } else if(model==='193') {
        content=export193(company,year,calculation,sequentialDeclarationNumber('193'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_193.txt`; extension='txt'; format='Diseño de registro AEAT modelo 193 sin relación de gastos';
      } else if(model==='347') {
        content=export347(company,year,calculation,sequentialDeclarationNumber('347'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_347.txt`; extension='txt'; format='Diseño de registro AEAT modelo 347';
      } else if(model==='415') {
        content=export415Import(company,year,calculation);
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_415_importacion.txt`; extension='txt'; format='Soporte de importación oficial programa ATC 415';
      } else if(model==='390') {
        const developerTaxId=clean(Deno.env.get('TAXEA_DEVELOPER_NIF'));
        content=wrap(model,year,'0A',export390(company,profile,activities,year,calculation,filings),developerTaxId); filename=`${clean(company.nif_cif).toUpperCase()}${year}0A.390`; extension='390'; format='Diseño de registro AEAT modelo 390';
      } else {
        const developerTaxId=clean(Deno.env.get('TAXEA_DEVELOPER_NIF'));
        const exporters:any={'111':export111,'115':export115,'123':export123,'130':export130}; const pages=model==='303'?export303(company,profile,year,period,calculation):exporters[model](company,year,period,calculation);
        content=wrap(model,year,period,pages,developerTaxId); filename=`${clean(company.nif_cif).toUpperCase()}${year}${period}.${model}`; extension=model; format='Diseño de registro AEAT';
      }
      const layoutErrors=transferLayoutErrors(model,content);
      if(layoutErrors.length) return Response.json({ok:false,error:'El fichero generado no supera la validación estructural interna.',blockers:layoutErrors},{status:500});
      const hash=await sha256(content);
      const contentBase64=encodeBase64(content);
      const record=await svc.entities.TaxOfficialFile.create({companyId,modeloCodigo:model,ejercicio:year,periodo:period,administracion:administration,nombreFichero:filename,extension,formato:format,versionDiseno:DEFINITIONS[model].design,hash,contentBase64,contentEncoding:'base64',contentSize:new TextEncoder().encode(content).length,immutable:true,sourceHash,snapshotHash:clean(frozenDraft?.snapshotHash),taxDraftId:frozenDraft?.id||'',generadoPor:user.email,fechaGeneracion:new Date().toISOString(),estado:'generado',errores:[],avisos:recommendations,resumenLegible:JSON.stringify({engineVersion:ENGINE_VERSION,sourceHash,result:calculation.result,workflow:model==='415'?'Importar en el programa ATC, validar y generar .dec':undefined,recommendations})});
      const nextStep = model === '415'
        ? 'Importa este fichero en Herramientas > Importar ficheros declarados del programa oficial 415. Revisa sus avisos y genera allí el .dec.'
        : `Importa el fichero en la presentación del modelo ${model} de la sede AEAT. La validación definitiva corresponde a la AEAT; sus avisos no invalidan la descarga generada por Taxea.`;
      return Response.json({...result,file:{id:record.id,filename,extension,format,design:DEFINITIONS[model].design,hash,contentBase64,nextStep}});
    }
    if(action==='export_review') {
      const content=JSON.stringify({...result,exportNotice:'Borrador técnico de revisión. No presentable ante AEAT/ATC.'},null,2); const filename=`${model}_${year}_${period}_revision_taxea.json`; const hash=await sha256(content); const contentBase64=encodeBase64(content);
      const artifact=await svc.entities.TaxOfficialFile.create({companyId,modeloCodigo:model,ejercicio:year,periodo:period,administracion:DEFINITIONS[model].authority,nombreFichero:filename,extension:'json',formato:'Borrador técnico de revisión',versionDiseno:DEFINITIONS[model].design,hash,contentBase64,contentEncoding:'base64',contentSize:new TextEncoder().encode(content).length,immutable:true,sourceHash,snapshotHash:clean(frozenDraft?.snapshotHash),taxDraftId:frozenDraft?.id||'',generadoPor:user.email,fechaGeneracion:new Date().toISOString(),estado:'generado',errores:[],avisos:recommendations,resumenLegible:JSON.stringify({engineVersion:ENGINE_VERSION,sourceHash,result:calculation.result,workflow:'review_snapshot',recommendations})});
      return Response.json({...result,file:{id:artifact.id,filename,extension:'json',format:'Borrador técnico de revisión',hash,contentBase64}});
    }
    return Response.json({error:'Acción no soportada.'},{status:400});
  } catch(error){const status=Number((error as any)?.status)||500; return Response.json({error:(error as Error).message||'Error interno'},{status});}
});


