import { article as a } from './guide-core.mjs';

export const finance = { id: 'finanzas', title: 'Finanzas y tesorería', description: 'Conecta tus bancos, controla vencimientos y analiza la liquidez.', articles: [
  a('panel-finanzas', 'Panel Finanzas', '/finance/dashboard', 'Interpreta los indicadores financieros y comprueba los datos que los alimentan.', [
    'Selecciona el periodo de consulta y revisa la empresa activa.',
    'Lee los indicadores de resultado, caja y cobros/pagos junto a sus periodos y avisos. Consulta la previsión y el calendario para detectar tensiones de liquidez.',
    'Para comprobar el origen, abre Tesorería si es un saldo bancario, Cuentas a cobrar o pagar si es un vencimiento y Libros e informes si es un dato de facturación.'
  ], 'Si el saldo parece antiguo, revisa la última sincronización en Tesorería antes de interpretar el panel.', 'panel finanzas kpi saldo margen liquidez salud financiera'),
  a('tesoreria', 'Conectar un banco y sincronizarlo', '/finance/treasury', 'Consulta cuentas, saldo y movimientos importados desde tu entidad.', [
    'En Tesorería → Bancos, pulsa Conectar banco. Busca la entidad y revisa qué cuentas quieres conectar.',
    'Autoriza en el entorno de tu banco o proveedor y vuelve al portal. El consentimiento puede caducar o requerir renovación.',
    'Abre la tarjeta de la cuenta y comprueba saldo, divisa y última actualización. Usa la opción de sincronización que muestre la conexión.',
    'Abre Movimientos y filtra por cuenta y fechas. Si tu conexión no ofrece un periodo, revisa la opción Importar CSV de esa cuenta y verifica qué fechas contiene el archivo antes de importarlo.'
  ], 'La disponibilidad de entidades y el histórico dependen del banco y del consentimiento. Conectar una cuenta permite consultar datos; no autoriza pagos desde esta pantalla.', 'banco banca open banking enable banking saldo revolut caixabank santander bankinter bbva sincronizar csv'),
  a('conciliacion', 'Conciliar movimientos bancarios', '/finance/treasury', 'Relaciona un apunte con la factura a la que corresponde y evita registrar dos veces el mismo cobro o pago.', [
    'Ve a Movimientos o Conciliación y elige un apunte pendiente. Comprueba cuenta, fecha, signo, importe y concepto.',
    'Busca la factura candidata y contrasta número, tercero y pendiente. Si la pantalla permite un pago parcial o agrupado, comprueba cómo queda distribuido antes de confirmar.',
    'Confirma una vez. Comprueba el estado del apunte y el saldo pendiente de la factura.',
    'Si el apunte no corresponde a una factura, déjalo para revisar o usa la opción de asociar una cuenta contable si aparece y conoces la contrapartida.'
  ], 'Una coincidencia de importe por sí sola no identifica la factura. Si el vínculo no es claro, conserva el movimiento pendiente y consulta a Taxea.', 'casar banco conciliar conciliación bancaria contrapartida movimiento 555 varias facturas'),
  a('cuentas-cobrar', 'Cuentas a cobrar', '/finance/ar', 'Identifica qué clientes deben dinero, qué facturas están vencidas y qué cobros esperas.', [
    'En Facturas pendientes, revisa los importes y los vencimientos. Abre la factura correspondiente para contrastar lo ya cobrado.',
    'En Aging clientes, revisa la antigüedad de los saldos. Usa Riesgo clientes para priorizar el seguimiento.',
    'Si el cobro ya aparece en banco, usa Conciliar y selecciona el movimiento correcto. Si no, registra el cobro desde la ficha de factura cuando tengas confirmación.',
    'Consulta Forecast cobros para las entradas esperadas y DSO para el tiempo de cobro observado.'
  ], 'El DSO depende de fechas de cobro registradas. Un cobro previsto no aumenta el saldo bancario real.', 'clientes vencidas aging dso cobro forecast facturas pendientes'),
  a('cuentas-pagar', 'Cuentas a pagar', '/finance/ap', 'Identifica qué facturas de proveedores están pendientes y cuándo vencen.', [
    'Abre Facturas pendientes y comprueba proveedor, fecha de vencimiento e importe pendiente.',
    'Usa Aging proveedores y Calendario pagos para ordenar los vencimientos. En Forecast pagos revisa las salidas previstas.',
    'Cuando ya hayas pagado, concilia el apunte del banco o registra el pago desde la factura si no dispones del movimiento.',
    'Consulta DPO para revisar el plazo de pago observado y comprueba cuántas operaciones tienen fecha real.'
  ], 'El calendario y las previsiones no ejecutan pagos. Contrasta el saldo antes de comprometer una salida de caja.', 'proveedor pago dpo deuda vencida facturas pendientes aging'),
  a('centro-tesoreria', 'Centro de Tesorería', '/finance/cashflow', 'Entiende la evolución de caja y qué cobros y pagos podrían moverla.', [
    'Comprueba el periodo o horizonte que muestra la pantalla y el saldo del que parte.',
    'Lee las entradas y salidas previstas junto con los movimientos reales. Localiza las fechas que concentran vencimientos.',
    'Si ves una caída que no esperabas, comprueba el origen en Cuentas a cobrar, Cuentas a pagar o Tesorería → Movimientos.'
  ], 'La previsión depende de los vencimientos y saldos disponibles. Si faltan facturas o cuentas, actualiza el dato en su apartado de origen.', 'cashflow flujo caja previsiones calendario tesorería escenario'),
  a('deuda', 'Deuda y Financiación', '/finance/debt', 'Consulta préstamos y otros instrumentos, sus cuotas y el coste financiero.', [
    'Empieza en Resumen para ver deuda activa, cuota e intereses. Abre Instrumentos para consultar el detalle.',
    'Usa Calendario deuda para ordenar próximos pagos. Compara los datos del instrumento con el contrato o cuadro de amortización.',
    'Consulta Coste financiero y Ratios. Si utilizas el Simulador, separa sus supuestos de la financiación contratada.',
    'En OCR Financiero revisa lo extraído de los documentos antes de usarlo. Trata las Alertas IA como pistas para comprobar.'
  ], 'Registrar o simular un préstamo no lo solicita ni modifica sus condiciones con el banco.', 'préstamo crédito cuota amortización financiación simulador intereses'),
  a('informes-finanzas', 'Centro de Informes', '/finance/reporting', 'Prepara informes financieros del ejercicio y revisa las fuentes antes de compartirlos.', [
    'Selecciona el ejercicio o el periodo de trabajo. Usa Actualizar fuentes si has incorporado datos recientemente.',
    'Empieza en Centro y revisa los datos de cada informe. En Bancos contrasta las cifras con el saldo y la fecha de sincronización.',
    'Si usas Board Report, Company Score o comentarios de IA, comprueba su cobertura y los avisos antes de exportar a Excel o compartir cuando aparezcan esas opciones.'
  ], 'Un informe sin datos de una fuente no demuestra que su saldo sea cero. Contrasta el dato con el documento o extracto correspondiente.', 'reporting cfo informes excel board score inversores exportar'),
  a('analisis', 'Análisis Financiero', '/finance/analysis', 'Prepara un análisis preliminar a partir de un fichero contable o de un PDF.', [
    'Elige la entrada correspondiente: Excel o A3 .dat, o PDF de balance/PyG.',
    'Sube el fichero y sigue el estado de importación o de análisis. Si aparece Pendiente revisión, verifica el periodo y las cifras extraídas.',
    'Abre el informe con trazabilidad y contrasta los indicadores con el fichero original. Usa Análisis recientes para encontrar trabajos anteriores.'
  ], 'Revisa el alcance del archivo importado antes de comparar resultados con los libros del portal. Un análisis preliminar no modifica los datos del fichero de origen.', 'balance pyg ratios pdf excel a3 dat informe trazabilidad importar'),
] };

export const opportunities = { id: 'oportunidades', title: 'Subvenciones y licitaciones', description: 'Encuentra oportunidades y comprueba los requisitos en la convocatoria oficial.', articles: [
  a('subvenciones', 'Buscar Subvenciones y Ayudas', '/subvenciones', 'Encuentra convocatorias de interés por territorio, beneficiario o actividad.', [
    'Pulsa una provincia en el mapa o elige Comunidad autónoma y Provincia en los filtros. Usa Toda España si quieres ampliar la consulta.',
    'Indica beneficiario, finalidad o actividad. Por ejemplo, prueba Autónomos y Emprendimiento e inicio para buscar ayudas al iniciar una actividad.',
    'Revisa el estado y distingue Abierta de Próxima. Si no encuentras resultados, quita algún filtro o usa Actualizar consulta.',
    'Despliega Ver resumen, requisitos y enlaces oficiales. Comprueba a quién va dirigida, periodo de solicitud, qué ofrece y requisitos. Abre Convocatoria oficial, sede o boletín para leer las bases.'
  ], 'Una convocatoria próxima todavía puede no admitir solicitudes. Usa Preguntar a Taxea cuando aparezca y comprueba siempre las bases oficiales antes de iniciar el trámite.', 'bdns ayuda autónomo emprender subvención radar mapa provincia comunidad pyme particulares espera'),
  a('licitaciones', 'Buscar Licitaciones y contratos públicos', '/licitaciones', 'Encuentra expedientes abiertos y posibles contratos futuros publicados en fuentes oficiales.', [
    'Elige licitaciones abiertas, anuncios previos o consultas preliminares. Las oportunidades futuras dependen de los anuncios publicados.',
    'Filtra por comunidad o provincia, tipo de contrato, rango sin IVA, código CPV o palabras del expediente. Puedes usar el mapa para seleccionar una provincia.',
    'Abre Resumen del expediente. Comprueba órgano, estado, importe, fecha límite y el enlace a la publicación oficial.',
    'Si necesitas ampliar la consulta, carga más resultados si está disponible o usa Abrir buscador oficial completo.'
  ], 'Un anuncio previo o una consulta preliminar no es un plazo abierto para presentar ofertas. La documentación y la presentación se gestionan en la fuente oficial.', 'place placsp cpv concursos contratación contratos públicos pliegos expediente anuncio previo'),
] };
