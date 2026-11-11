// Each article documents a customer route or a distinct workflow on that route.
export function article(id, title, path, summary, steps, check, keywords = '') {
  return { id, title, path, summary, steps, check, keywords };
}

const a = article;

export const start = { id: 'inicio', title: 'Primeros pasos', description: 'Tu empresa, el menú y los datos del panel principal.', articles: [
  a('empezar', 'Empieza con tu empresa', '/ajustes', 'Deja listo el perfil antes de emitir tu primera factura o entregar documentación.', [
    'Accede con el correo de tu cuenta. Si no recuerdas la contraseña, usa la opción de recuperación de la pantalla de acceso.',
    'En Ajustes, abre Empresa y comprueba razón social, identificación fiscal, dirección y datos de contacto. Guarda los datos antes de facturar.',
    'En Fiscalidad, revisa los datos que ya estén configurados. Si falta el encuadramiento de tu actividad o no coincide con tu situación, consulta con Taxea.',
    'Abre Primeros pasos para repasar la configuración pendiente. Usa el botón de menú en móvil para ver todos los departamentos.'
  ], 'Comprueba en qué empresa estás trabajando antes de subir, confirmar o exportar documentos.', 'alta registro cuenta recuperar contraseña acceso empresa inicio móvil'),
  a('dashboard', 'Dashboard principal', '/', 'Lee el resumen de tu empresa y entra al apartado que origina cada dato.', [
    'Revisa el periodo mostrado antes de comparar ingresos, gastos o resultado.',
    'Lee la puntuación de salud junto con los indicadores y avisos que la explican. Si faltan datos, completa el registro en el módulo correspondiente.',
    'Usa los accesos del panel para ir a facturas, documentos o vencimientos y comprobar el detalle.'
  ], 'El resultado del panel y el saldo bancario miden cosas distintas: consulta Tesorería para saber cuánto dinero hay en las cuentas sincronizadas.', 'inicio salud health score kpi saldo'),
  a('avisos', 'Notificaciones y avisos', '/notificaciones', 'Revisa novedades y acciones pendientes desde la campana del portal.', [
    'Pulsa la campana de la barra superior para abrir tus avisos.',
    'Lee el título y la fecha. Cuando el aviso incluye un acceso, ábrelo para revisar el registro en su apartado.',
    'En Ajustes → Notificaciones, consulta las preferencias disponibles en tu cuenta.'
  ], 'Si esperabas un documento del asesor, revisa también Documentos y Calendario y obligaciones → Documentos fiscales.', 'campana novedades alertas'),
] };

export const tax = { id: 'fiscalidad', title: 'Fiscalidad y Contabilidad', description: 'Emite, registra y consulta tus facturas, libros y obligaciones.', articles: [
  a('panel-fiscal', 'Dashboard de Fiscalidad y Contabilidad', '/tax-accounting/dashboard', 'Consulta el resumen del departamento y detecta qué necesita atención.', [
    'En el menú, despliega Fiscalidad y Contabilidad y abre Dashboard.',
    'Comprueba el periodo de los indicadores de ingresos, gastos y actividad.',
    'Pasa a Facturas, Ingresos y Gastos o Calendario y obligaciones para resolver las incidencias o revisar los documentos del periodo.'
  ], 'Para confirmar un importe o un estado, abre el registro original. El resumen depende de lo que ya esté registrado.', 'panel contable resumen fiscal indicadores'),
  a('facturas', 'Consultar y filtrar facturas', '/tax-accounting/facturas', 'Encuentra emitidas, recibidas o recurrentes y consulta el estado de cada una.', [
    'En Facturas, elige Emitidas o Recibidas. Usa Recurrentes si buscas una plantilla programada.',
    'Busca por número, tercero o concepto. Ajusta los filtros de año, estado y cobro o pago que estén disponibles.',
    'Abre una fila con el icono de vista o entra en su menú de acciones. Contrasta número, fecha, tercero, base y total con el documento.',
    'Fíjate en los dos estados: el estado de la factura indica qué pasó con su registro; el de cobro o pago indica qué queda por liquidar.'
  ], 'Si no aparece una factura del OCR, comprueba primero si sigue en Pendientes o En revisión y retira los filtros de año y estado.', 'encontrar factura listado contabilizada pendiente pdf descargar recibo'),
  a('emitir-factura', 'Crear y emitir una factura', '/tax-accounting/facturas', 'Crea una factura de venta y comprueba el PDF y el QR que genera el portal.', [
    'En Facturas → Emitidas, pulsa Nueva Factura y selecciona el cliente o completa sus datos.',
    'Comprueba la fecha, serie y número sugerido. El portal propone la secuencia de la serie; revisa con cuidado si introduces tu propio número.',
    'Añade cada concepto con su cantidad, precio, impuesto o exención y retención cuando corresponda. Contrasta base, cuotas y total antes de emitir.',
    'Si necesitas seguir editando, guarda un borrador cuando esté disponible. Cuando el documento sea definitivo, confirma la emisión.',
    'Abre la factura emitida y comprueba el número, el PDF y el QR tributario generado en el flujo aplicable. Confirma aparte el estado de cobro.'
  ], 'La confirmación la realiza quien emite. El QR o la huella de la factura no acreditan por sí solos una remisión aceptada por la Administración.', 'nueva factura venta crear emitir correlativo numeración iva igic irpf verifactu hash borrador'),
  a('enviar-factura', 'Enviar una factura o compartirla', '/tax-accounting/facturas', 'Envía la factura desde Gmail o comparte el documento con el destinatario correcto.', [
    'Abre la factura definitiva y elige Enviar por email desde su panel o menú de acciones.',
    'Si se muestra Conectar Gmail, autoriza en Google la cuenta remitente y vuelve al portal. Comprueba que el panel reconoce la conexión.',
    'Revisa destinatario, asunto, mensaje y adjunto. Envía una vez y espera la confirmación.',
    'Si prefieres compartirla sin usar el correo del portal, descarga el PDF o usa la opción de enlace público cuando esté habilitada.'
  ], 'Antes de reenviar tras un error, comprueba el estado del envío y la carpeta Enviados de Gmail. Comparte los enlaces públicos solo con quien deba ver la factura.', 'gmail correo email enviar pdf enlace público adjunto oauth google'),
  a('cobrar-pagar', 'Registrar un cobro o un pago', '/tax-accounting/facturas', 'Actualiza el pendiente de una factura con la fecha y el importe reales.', [
    'Abre la emitida que has cobrado o la recibida que has pagado. Comprueba el importe que sigue pendiente.',
    'Si tienes ese apunte en el banco conectado, usa Conciliar y escoge el movimiento correspondiente. Revisa fecha, cuenta, tercero, signo e importe.',
    'Si no hay apunte disponible, usa la opción de añadir un pago o cobro y registra el importe real. Para un abono parcial, indica solo la parte ya liquidada.',
    'Reabre la factura y comprueba el movimiento vinculado o el nuevo saldo pendiente.'
  ], 'Si registraste el pago manualmente y luego llega el apunte del banco, revisa el vínculo antes de añadir otro. Registrar un pago no ordena una transferencia.', 'conciliar banco liquidar parcial abono pago cobro'),
  a('anular-factura', 'Anular una o varias facturas', '/tax-accounting/facturas', 'Anula desde la ficha o en lote y comprueba el resultado de cada documento.', [
    'Encuentra la factura exacta por serie y número. Para una sola, abre su menú y elige Anular factura.',
    'Para varias, marca las filas concretas y pulsa Anular seleccionadas. Revisa el alcance antes de confirmar.',
    'Indica el motivo en el diálogo. Al terminar, revisa qué facturas quedaron anuladas y cuáles muestran una incidencia.'
  ], 'El número anulado no vuelve a quedar libre. Si ya hay un cobro o una situación que impide anular, consulta el aviso y acuerda la corrección con Taxea.', 'cancelar anulación lote seleccionadas borrar rectificativa reversión'),
  a('recurrentes', 'Configurar facturas recurrentes', '/tax-accounting/facturas', 'Programa la emisión periódica a partir de una plantilla de venta.', [
    'En Facturas, entra en Recurrentes y abre la opción de crear una plantilla.',
    'Selecciona el cliente, revisa conceptos, impuestos, serie y totales. Define la frecuencia y la próxima emisión.',
    'Guarda la plantilla y confirma si queda activa. Cuando llegue la fecha, comprueba en Emitidas que se generó la factura esperada.',
    'Si cambian las condiciones del servicio, edita o pausa la plantilla antes de la siguiente ejecución.'
  ], 'Revisa la fecha y el historial antes de emitir manualmente el mismo servicio. Cambiar la plantilla afecta a las futuras emisiones.', 'mensual automática periodicidad plantilla suscripción repetir'),
  a('ingresos-gastos', 'Ingresos y Gastos', '/tax-accounting/ingresos-gastos', 'Consulta los ingresos y gastos del periodo y distingue los movimientos ligados a facturas.', [
    'Elige la vista de ingresos o gastos y filtra por periodo, categoría o término de búsqueda según la vista.',
    'Abre la fila que quieras revisar y comprueba el importe, la fecha y el origen. Si viene de una factura, usa ese documento para entender cualquier diferencia.',
    'Si registras un movimiento manual, revisa antes si la misma operación ya llegó por Facturas u OCR.'
  ], 'Un gasto registrado y un cargo bancario son dos caras de la misma operación. Evita volver a registrar el gasto solo porque acabas de importar el banco.', 'movimientos ingresos resultado categoría registrar movimiento gasto manual'),
  a('presupuestos', 'Preparar y seguir presupuestos', '/tax-accounting/presupuestos', 'Prepara una oferta comercial y registra si se ha enviado o aceptado.', [
    'Crea el presupuesto, elige el cliente e introduce conceptos, precios y condiciones.',
    'Abre Ver documento para revisar la propuesta antes de enviarla. Si todavía está en preparación, mantenla en borrador.',
    'Cuando responda el cliente, actualiza el estado con la opción correspondiente, como Marcar aceptado. Usa los filtros para localizar ofertas pendientes.'
  ], 'Una oferta aceptada no acredita que ya exista una factura. Comprueba la emisión en Facturas.', 'oferta cotización propuesta presupuesto aceptado rechazado'),
  a('proformas', 'Crear una proforma y convertirla', '/tax-accounting/proformas', 'Presenta un documento previo y reutiliza sus datos al preparar la factura definitiva.', [
    'Crea una proforma con cliente, conceptos, condiciones e importes. Abre Ver documento y revisa el total.',
    'Usa el estado que refleje la situación: borrador, enviada o aceptada.',
    'Cuando proceda facturar, usa la conversión disponible, revisa serie, número y fecha en la factura y comprueba después que aparece en Emitidas.'
  ], 'La proforma no es la factura fiscal definitiva. Antes de convertir, comprueba que no se haya facturado la misma operación por otra vía.', 'proforma convertir sin valor fiscal documento previo'),
  a('libros', 'Consultar libros y descargar informes', '/tax-accounting/libros', 'Prepara los datos de ventas, compras y gastos para revisar o enviar a la asesoría.', [
    'Selecciona ejercicio y periodo: T1 enero–marzo, T2 abril–junio, T3 julio–septiembre o T4 octubre–diciembre. Usa Todos si necesitas el ejercicio completo.',
    'Abre Libro Ventas, Libro Compras o Gastos. Revisa las columnas de documento, NIF, base, cuota, retención y total antes de exportar.',
    'Consulta P&L para el resultado o Criterio de caja si tu actividad lo utiliza. No compares periodos o criterios diferentes como si fueran el mismo informe.',
    'Usa Exportar Excel o Solo libros de facturas según lo que necesites. El Excel de Libros e informes corresponde al ejercicio seleccionado; el filtro trimestral ajusta la vista. Revisa Salida a la asesoría si necesitas sus formatos y avisos.'
  ], 'El archivo sirve para revisión e importación en la asesoría. La descarga no confirma una importación en A3 ni una presentación tributaria.', 'excel xlsx csv exportar a3 importia libro registro trimestre ventas compras pérdidas ganancias pyg'),
  a('excel-novedades', 'Identificar las facturas nuevas en Excel', '/tax-accounting/libros', 'Usa el resaltado verde para ver qué se añadió desde la última exportación guardada.', [
    'Selecciona el ejercicio en Libros e informes. Comprueba si el portal muestra la fecha de Última descarga para esa empresa y ejercicio.',
    'La primera descarga guardada sirve como referencia. En la siguiente, abre Facturas Emitidas o Facturas Recibidas: las filas de facturas que no estaban en la referencia aparecen en verde.',
    'En el Excel completo se resaltan también en Libro Ventas y Libro Compras. En Solo libros de facturas, busca el verde en las dos hojas Facturas Emitidas y Facturas Recibidas.',
    'Conserva el fichero que vas a revisar. Si vuelves a exportar sin añadir facturas, las que ya iban en la descarga anterior dejan de marcarse como nuevas.'
  ], 'La comparación usa la última exportación guardada de esa empresa y ejercicio. El verde indica que la fila es nueva en el Excel, no que ya se haya importado o contabilizado en A3.', 'verde resaltar incremental excel ultima descarga exportacion nuevas filas cambio a3'),
  a('ocr-gastos', 'Subir o escanear facturas recibidas', '/tax-accounting/lector-gastos', 'Entrega facturas de proveedor y comprueba que entraron en la cola correcta.', [
    'Entra en OCR facturas recibidas. Arrastra los archivos a la zona de subida o selecciónalos desde el dispositivo.',
    'En móvil, pulsa Sacar foto / Escanear y permite el acceso a la cámara. Coloca el documento entero dentro del encuadre azul, evita reflejos y comprueba las esquinas y los importes antes de aceptar.',
    'Después de subir, localiza los documentos en Pendientes. Inicia el análisis cuando esté disponible y espera a que pasen a En revisión.',
    'Si un archivo no aparece, comprueba que estás en la empresa correcta y que la carga terminó. Revisa la cola antes de subirlo otra vez.'
  ], 'Pendientes significa que falta leer o volver a leer el documento. En revisión significa que ya puedes comprobar los datos extraídos.', 'cámara foto movil recibida ticket escáner camscanner gastos pdf arrastrar documentos'),
  a('revisar-gastos', 'Revisar, corregir y confirmar gastos', '/tax-accounting/lector-gastos', 'Compara la propuesta OCR con el documento y resuelve cada factura en la misma cola.', [
    'En En revisión, abre la factura con la acción de revisión. Si trabajas varias seguidas, usa el espacio de revisión y los controles anterior y siguiente cuando estén disponibles.',
    'Contrasta proveedor, identificación fiscal, número y fecha. Comprueba conceptos, base, IVA o IGIC, IRPF y total. Revisa la cuenta contable sugerida y corrígela si procede y tienes acceso al campo.',
    'Si tus permisos te dejan confirmar, guarda la factura revisada y comprueba Procesados y Facturas → Recibidas. Si tu flujo requiere que Taxea la confirme, déjala En revisión.',
    'Usa Rechazar si el documento no debe registrarse y comprueba Rechazados. Si el OCR leyó mal el archivo, usa Volver a pendientes: una lectura nueva reemplaza los datos extraídos.',
    'Para revisar un lote, marca los documentos correctos y revisa el resumen antes de ejecutar. Si un aviso señala un duplicado, contrasta proveedor, número y fecha con el registro existente.'
  ], 'Tras un aviso fiscal o un error, comprueba si se guardó antes de repetir. Facilita a Taxea el mensaje y el número del documento si no puedes resolverlo.', 'en revisión en revision aprobación validar confirmar gastos masivo lote duplicados procesados rechazados cuenta contable repep'),
  a('ocr-ingresos', 'Importar facturas emitidas por OCR', '/tax-accounting/lector-ingresos', 'Registra facturas de venta que ya existen como PDF o imagen.', [
    'Abre OCR facturas emitidas y añade los archivos. Revisa la cola Pendientes e inicia la lectura cuando proceda.',
    'En En revisión, compara el original con los datos del cliente, el número y fecha originales, las bases, cuotas, retenciones y total.',
    'Corrige los campos que se hayan leído mal y comprueba las alertas de duplicado. No cambies el número original para hacer pasar un duplicado.',
    'Confirma los datos desde el OCR. Comprueba que figura en Procesados y en Facturas → Emitidas, sin una aprobación adicional del asesor para la venta.'
  ], 'Usa Facturas → Emitidas para crear una venta nueva. El OCR de emitidas se usa para registrar un documento de venta que ya tienes.', 'lector ingresos ventas escanear pdf factura externa importación confirmar emitida'),
  a('obligaciones', 'Calendario y obligaciones', '/tax-accounting/obligaciones', 'Consulta qué vence, qué documentación hay y qué información está pendiente de validar.', [
    'En Mis obligaciones, filtra ejercicio, estado u organismo. Abre la ficha para ver modelo, periodo, resultado y comentarios.',
    'Compara Fecha máxima de domiciliación, Fecha máxima de presentación y Fecha interna del despacho. Identifica cuál aplica a la acción que necesitas hacer.',
    'Usa Calendario individual, Próximos vencimientos y Timeline anual para planificar. En Cierre trimestral revisa qué queda pendiente para ese periodo.',
    'Abre Documentos fiscales o los documentos vinculados a la obligación para consultar el PDF que figure en tu perfil. Si falta la configuración fiscal, pide a Taxea que la revise.'
  ], 'Un vencimiento en el calendario no equivale a una presentación. Comprueba el estado y, cuando corresponda, el justificante.', 'impuestos atc aeat modelo trimestral domicilio fecha límite presentación justificante documentos fiscales'),
] };
