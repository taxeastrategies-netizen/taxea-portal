import { article as a } from './guide-core.mjs';

export const people = { id: 'personas', title: 'Recursos humanos y personas', description: 'Equipo, documentos, jornada, ausencias y selección.', articles: [
  a('panel-rrhh', 'Panel RRHH', '/people/dashboard', 'Consulta el estado del equipo y pasa al detalle desde los accesos rápidos.', [
    'Revisa empleados activos, ausencias pendientes y distribución por departamento.',
    'Usa los accesos a Empleados, Ausencias, Fichajes, Documentos o Recruiting para revisar los registros de origen.',
    'Si el panel no tiene datos, revisa primero que trabajas en la empresa correcta y que las fichas del equipo ya están creadas.'
  ], 'El resumen depende de la información introducida en los módulos de personal.', 'equipo headcount kpi panel rrhh empleados'),
  a('empleados', 'Gestión de Empleados', '/people/employees', 'Crea fichas internas y localiza la información de tu plantilla.', [
    'Busca al empleado antes de darlo de alta. Si no existe, pulsa Nuevo empleado.',
    'Completa nombre y email, y revisa cargo, departamento, tipo de contrato y modalidad antes de guardar.',
    'Vuelve al listado y comprueba que la ficha corresponde a la persona y empresa correctas.'
  ], 'Una ficha de empleado es un registro del equipo; no da por sí sola acceso al portal ni cursa un alta laboral.', 'plantilla ficha departamento contrato presencial híbrido remoto'),
  a('docs-rrhh', 'Docs y Firmas', '/people/documents', 'Clasifica documentación laboral y consulta el estado de firma que consta en cada archivo.', [
    'Pulsa Subir documento. Indica nombre, tipo y archivo, y espera a que termine la subida.',
    'Usa el buscador o filtra por tipo. Abre el archivo y comprueba si figura Sin firma, Pendiente firma, Firmado u otro estado.',
    'Conserva el original firmado y verifica el propio documento si necesitas acreditar una firma.'
  ], 'Subir un archivo no lo firma. El estado del listado no sustituye la comprobación de una firma en el original.', 'firma contrato nómina archivo recursos humanos descargar'),
  a('control-horario', 'Control Horario', '/people/time', 'Registra el inicio y fin de la jornada y revisa el historial.', [
    'Abre Control Horario. Ficha la entrada al iniciar tu jornada y comprueba que queda un fichaje en curso.',
    'Fíjate en la modalidad que muestra el registro. Al terminar, ficha la salida y verifica que el registro queda cerrado.',
    'Consulta Esta semana y Registros recientes para detectar días incompletos. Si falta un fichaje, comunica la fecha al responsable.'
  ], 'Conserva el registro que refleja la hora real. Un fichaje abierto no equivale a una jornada cerrada.', 'fichar fichaje jornada entrada salida asistencia'),
  a('ausencias', 'Solicitar ausencias o vacaciones', '/people/absences', 'Registra una solicitud y consulta si sigue pendiente o ya tiene respuesta.', [
    'Pulsa Solicitar ausencia. Elige el tipo, las fechas de inicio y fin y, si procede, un motivo.',
    'Guarda y busca la solicitud en Pendientes. Si gestionas solicitudes y tu perfil lo permite, abre la pendiente antes de aprobar o rechazar.',
    'Comprueba el resultado en Aprobadas o Rechazadas, o usa Todas para ver el historial.'
  ], 'La solicitud no se considera aprobada mientras figure como pendiente.', 'ausencia vacaciones permiso baja solicitar aprobar calendario'),
  a('banco-horas', 'Banco de Horas', '/people/hours-bank', 'Consulta horas registradas, extras y balance por persona.', [
    'Revisa el Balance global para detectar diferencias.',
    'En Balance individual, busca a la persona y contrasta horas registradas y extras.',
    'Si no hay datos o faltan horas, comprueba los fichajes de origen en Control Horario.'
  ], 'Ver horas extra en el panel no acredita su abono o compensación.', 'compensación horas extra balance tiempo jornada'),
  a('rendimiento', 'Rendimiento y Metas', '/people/performance', 'Identifica qué vistas de objetivos y evaluación están disponibles.', [
    'Abre Objetivos para conocer la estructura y la barra de progreso.',
    'Revisa el mensaje de disponibilidad en Evaluaciones, Skills Matrix y Tareas.',
    'Si solo ves los objetivos de ejemplo, lleva el seguimiento real por el procedimiento acordado con tu equipo.'
  ], 'El listado actual de objetivos contiene ejemplos; no lo uses como historial real de evaluaciones.', 'ejemplo demo competencias objetivos evaluaciones skills progreso'),
  a('incorporacion', 'Incorporación y baja', '/people/onboarding', 'Consulta el seguimiento interno de entradas y salidas del equipo.', [
    'Elige la pestaña de incorporación o la de salida según el proceso que buscas.',
    'Comprueba la persona, el estado y los pasos que figuren en el listado.',
    'Si no hay procesos pendientes, revisa primero la ficha en Gestión de Empleados y consulta al responsable del proceso.'
  ], 'Este seguimiento interno no comunica altas o bajas a organismos externos.', 'onboarding offboarding alta baja checklist equipo'),
  a('seleccion', 'Selección', '/people/recruiting', 'Organiza candidaturas y actualiza su fase en el proceso.', [
    'Pulsa Nuevo candidato e introduce nombre, correo y puesto o departamento.',
    'Revisa el panel de fases y localiza la candidatura en el listado.',
    'Cambia la etapa de la ficha conforme avance el proceso. Verifica el nuevo estado antes de darlo por actualizado.'
  ], 'Si aparece una puntuación orientativa, revisa los datos con criterio humano. Limita la información que registras a la necesaria para la selección.', 'recruiting candidato vacante contratación pipeline fase entrevistas'),
  a('gastos-rrhh', 'Gastos RRHH', '/people/expenses', 'Identifica la vista de gastos y reembolsos de personal.', [
    'Abre Gastos RRHH para ver cómo se organizan los indicadores: pendientes, aprobados, total del mes y reembolsados.',
    'La pantalla actual muestra importes de ejemplo. Para registrar una factura de proveedor, usa OCR facturas recibidas.',
    'Para un reembolso real, sigue el procedimiento que tenga tu empresa y conserva el justificante.'
  ], 'Esta vista no aprueba ni paga reembolsos y sus cifras de ejemplo no forman parte de tus libros.', 'reembolso empleado ticket ejemplo demo'),
  a('analitica-personal', 'Analítica de Personal', '/people/reports', 'Consulta el tamaño de la plantilla, distribución y ausencias.', [
    'Revisa Headcount, departamentos y ausencias aprobadas.',
    'Compara Distribución por departamento y Modalidad de trabajo. Comprueba que las fichas están clasificadas.',
    'Si te llama la atención la tasa de absentismo, contrástala con los registros de Ausencias y con el alcance de datos del panel.'
  ], 'Una cifra sin cobertura suficiente no permite concluir cómo ha evolucionado el equipo.', 'people analytics analítica absentismo informes plantilla'),
  a('asistente-rrhh', 'Asistente IA RRHH', '/people/ai-assistant', 'Usa el asistente para orientarte o preparar un borrador de trabajo.', [
    'Abre el asistente y formula una pregunta concreta. Por ejemplo: «¿Qué debería incluir una lista de incorporación para un nuevo puesto?».',
    'Describe el caso sin nombres, documentos personales ni datos de salud. Revisa lo que propone antes de aplicarlo.',
    'Lleva las decisiones y actuaciones laborales al responsable autorizado.'
  ], 'La respuesta sirve de orientación y no ejecuta trámites ni sustituye la revisión laboral.', 'asistente ia inteligencia artificial borrador preguntas recursos humanos'),
] };

export const operations = { id: 'operativa', title: 'Core Operativo', description: 'Organiza contactos y documentos y usa las utilidades del día a día.', articles: [
  a('herramientas', 'Todas las herramientas', '/herramientas', 'Elige la utilidad según lo que necesites preparar o calcular.', [
    'Abre Herramientas → Todas las herramientas y pulsa Abrir herramienta en la tarjeta correspondiente.',
    'Usa Renombrador o Extractor para leer documentos; Kit PDF e imágenes para generar copias; Calculadora para precios; Vencimientos para recordatorios.',
    'Usa Volver al catálogo para cambiar de herramienta. Descarga el resultado antes de salir si lo necesitas.'
  ], 'Estas utilidades preparan resultados. Para registrar una factura, usa Facturas o el lector OCR correspondiente.', 'kit calculadora pdf vencimiento utilidades catálogo extractor renombrar'),
  a('renombrador', 'Renombrador OCR', '/herramientas/renombrador', 'Genera nombres consistentes para un lote y descarga copias renombradas.', [
    'Añade los documentos y empieza el análisis. Espera a que se lean los campos del nombre.',
    'Elige o edita la nomenclatura usando los campos disponibles. Revisa el nombre propuesto de cada archivo y corrige los datos si hace falta.',
    'Descarga una copia o el lote con los nombres resultantes. Comprueba el contenido antes de archivar.'
  ], 'Renombrar no altera el documento original ni crea una factura en el portal.', 'nombre archivo pdf nomenclatura zip renombrar lote'),
  a('kit-pdf', 'Kit PDF e imágenes', '/herramientas/pdf-imagenes', 'Une, extrae, separa o gira PDF, convierte fotos a PDF y optimiza imágenes.', [
    'Selecciona la Operación y añade los archivos compatibles. Reordénalos con las flechas si importa el orden.',
    'Si extraes páginas, indica el orden: por ejemplo, 1,3,5-7. Para fotos, ajusta calidad JPEG y lado máximo si necesitas reducir el tamaño.',
    'Pulsa Generar copia y después Descargar resultado. Abre la copia para verificar todas las páginas y la legibilidad.'
  ], 'El procesamiento es local. La herramienta muestra los límites del lote; un PDF firmado debe conservarse intacto porque transformar la copia invalida la firma.', 'unir dividir partir reordenar ordenar girar rotar comprimir convertir jpg jpeg fotos pdf optimizar'),
  a('extractor', 'Extractor de documentos', '/herramientas/extractor', 'Extrae campos de varios archivos y expórtalos en una tabla.', [
    'Añade los archivos e inicia el análisis. Revisa el estado y el resumen de cada documento.',
    'Corrige las fechas, importes o identificadores que no coincidan con el original.',
    'Usa Exportar Excel o Exportar CSV y comprueba que el resultado contiene las filas esperadas.'
  ], 'Extraer datos no registra ni contabiliza facturas. Usa los lectores de emitidas o recibidas cuando quieras incorporarlas al portal.', 'extraer datos ocr tabla excel csv digitalizar'),
  a('calculadora', 'Calculadora comercial', '/herramientas/calculadora', 'Calcula margen, recargo, descuento y punto de equilibrio.', [
    'Introduce coste variable unitario, precio unitario, margen objetivo, descuento y costes fijos. Usa importes sin IVA/IGIC y la misma moneda.',
    'Compara beneficio por unidad, margen sobre la venta y recargo sobre coste. Con coste 60 € y precio 100 €, el margen es 40 % y el recargo aproximadamente 66,67 %.',
    'Consulta Precio para margen objetivo y Punto de equilibrio. Si el precio no supera el coste variable, la venta no cubre los costes fijos.'
  ], 'El punto de equilibrio se expresa en unidades y depende del coste fijo del periodo que has introducido.', 'precio beneficio margen markup recargo descuento punto equilibrio'),
  a('vencimientos', 'Vencimientos y recordatorios', '/herramientas/vencimientos', 'Registra plazos propios de pagos, renovaciones u otros compromisos.', [
    'Pulsa Nuevo vencimiento y completa título, tipo, fecha límite, antelación y notas.',
    'Consulta Pendientes y cambia el estado cuando completes la gestión. Usa los filtros para volver a encontrarla.',
    'Pulsa Exportar calendario .ics si quieres llevar los vencimientos a tu calendario habitual y comprueba allí las fechas tras importarlo.'
  ], 'Los recordatorios que creas aquí son independientes de las obligaciones tributarias configuradas por Taxea.', 'recordatorio renovar renovación fecha calendario ics plazos alertas'),
  a('contactos', 'Contactos', '/contactos', 'Organiza clientes y proveedores y prepara sus datos para facturar.', [
    'Busca primero por nombre o identificación fiscal. Alterna Todos, Empresas y Personas y filtra por cliente o proveedor.',
    'Si no existe, crea un contacto. Indica su clase y relación, y revisa identificación fiscal, dirección y correo.',
    'Abre la ficha para consultar sus datos o actividad. Corrige allí los cambios que debas usar en próximos documentos.',
    'Marca las filas y usa Exportar selección si necesitas una copia de contactos concretos.'
  ], 'Compara el identificador fiscal antes de dar de alta a alguien con un nombre parecido. Actualizar una ficha no equivale a rectificar una factura emitida.', 'cliente proveedor agenda nif cif empresa persona csv terceros'),
  a('documentos', 'Documentos', '/documentos', 'Entrega archivos a Taxea y vuelve a encontrar los documentos de tu empresa.', [
    'Pulsa Subir documento. Elige el archivo, su tipo y carpeta. Espera a que termine antes de cerrar la pantalla.',
    'Usa Carpetas o los filtros de tipo y estado para encontrarlo. Si no aparece, quita filtros y comprueba la empresa activa.',
    'Abre el archivo para consultar o descargar la copia disponible. Revisa si figura Pendiente, En revisión, Revisado, Aprobado o Rechazado.',
    'Para un impuesto ya vinculado a una obligación, puedes localizarlo también en Calendario y obligaciones → Documentos fiscales.'
  ], 'Subir a Documentos no registra una factura en los libros. Para extraer y registrar facturas usa el OCR de recibidas o emitidas.', 'archivo adjunto carpeta pdf dms entregar documentación subir impuestos'),
] };

export const account = { id: 'cuenta', title: 'Ajustes y ayuda', description: 'Configura tu cuenta, consulta la suscripción y contacta con Taxea.', articles: [
  a('ajustes', 'Ajustes de empresa y fiscalidad', '/ajustes', 'Revisa los datos del perfil y los que aparecen al facturar.', [
    'En Empresa, revisa nombre, identificación y dirección. Completa logo y datos bancarios de facturación donde se ofrezcan.',
    'En Fiscalidad, comprueba impuesto y datos de tu actividad. Si no puedes editar un campo o el perfil figura pendiente de validar, ponte en contacto con Taxea.',
    'Usa Primeros pasos para revisar qué queda por configurar y Notificaciones para tus preferencias.'
  ], 'Los datos bancarios que se imprimen en facturas no sincronizan movimientos. Para conectar una cuenta, ve a Tesorería.', 'configuración perfil fiscal actividad iban logo datos empresa'),
  a('seguridad', 'Seguridad y privacidad de la cuenta', '/ajustes', 'Encuentra las opciones de seguridad y la solicitud de eliminación de cuenta.', [
    'Abre Ajustes → Seguridad para consultar las opciones disponibles para tu cuenta.',
    'Cierra sesión en dispositivos compartidos. Si pierdes el acceso, usa la recuperación de la pantalla de inicio de sesión.',
    'Si necesitas solicitar la eliminación, lee la información del apartado de privacidad, confirma solo si es tu intención y comprueba el estado de la solicitud.'
  ], 'Nunca facilites contraseñas ni códigos de acceso en Mejoras o por correo. Una solicitud de eliminación puede requerir revisión y conservación legal de ciertos registros.', 'privacidad borrar cuenta contraseña cerrar sesión eliminar acceso'),
  a('referidos', 'Consultar Referidos', '/ajustes', 'Encuentra el programa de referidos y consulta las condiciones que muestra tu perfil.', [
    'Abre Ajustes → Referidos y comprueba si tu cuenta muestra un enlace o código.',
    'Si está disponible, revisa las condiciones y consulta el estado de las invitaciones en esta misma pestaña.'
  ], 'Una invitación enviada no equivale a un alta validada; comprueba su estado en el panel.', 'referidos invitación afiliados código'),
  a('suscripcion', 'Suscripción y facturación del servicio', '/suscripcion', 'Consulta el estado de tu acceso y las opciones de gestión del plan.', [
    'En Suscripción, lee el estado actual y comprueba si hay un pago pendiente o una incidencia.',
    'Si aparece Gestionar pago y suscripción o Ver portal de facturación, abre la opción correspondiente para consultar el servicio.',
    'Si aparece un bloqueo inesperado, confirma la cuenta con la que has iniciado sesión y contacta con Taxea indicando el estado que ves.'
  ], 'La suscripción del portal es independiente de las facturas que emites a tus propios clientes.', 'plan stripe factura taxea pago prueba acceso bloqueado'),
  a('ayuda', 'Proponer una mejora o comunicar un error', '/sugerencias', 'Envía una sugerencia concreta y consulta su estado.', [
    'Abre Mejoras desde el menú y selecciona el tipo de solicitud.',
    'Incluye el apartado, el paso que estabas haciendo y qué esperabas que ocurriera. Añade el mensaje de error sin contraseñas, NIF completos ni documentación sensible.',
    'Envía una vez y comprueba que la solicitud aparece en tu historial. Si necesitas hablar con tu asesor, consulta también la opción de ayuda en Ajustes.'
  ], 'Cuando el aviso sea «Enviando · sin confirmar», vuelve a consultar el estado antes de enviar otra solicitud.', 'soporte incidencias errores contacto sugerencia whatsapp ayuda'),
] };
