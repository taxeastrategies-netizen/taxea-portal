export const MODELOS_AEAT = [
  ['036', 'Declaración censal', 'AEAT', 'según supuesto'], ['037', 'Declaración censal simplificada', 'AEAT', 'según supuesto'],
  ['111', 'Retenciones de trabajo y profesionales', 'AEAT', 'trimestral/mensual'], ['115', 'Retenciones por alquileres urbanos', 'AEAT', 'trimestral/mensual'],
  ['123', 'Retenciones de capital mobiliario', 'AEAT', 'trimestral/mensual'], ['130', 'Pago fraccionado IRPF — estimación directa', 'AEAT', 'trimestral'],
  ['131', 'Pago fraccionado IRPF — estimación objetiva', 'AEAT', 'trimestral'], ['180', 'Resumen anual de alquileres', 'AEAT', 'anual'],
  ['190', 'Resumen anual de retenciones', 'AEAT', 'anual'], ['193', 'Resumen anual de capital mobiliario', 'AEAT', 'anual'],
  ['200', 'Impuesto sobre Sociedades', 'AEAT', 'anual'], ['202', 'Pagos fraccionados de Sociedades', 'AEAT', 'abril/octubre/diciembre'],
  ['210', 'IRNR sin establecimiento permanente', 'AEAT', 'según renta y resultado'], ['216', 'Retenciones de no residentes', 'AEAT', 'trimestral/mensual'],
  ['296', 'Resumen anual de retenciones de no residentes', 'AEAT', 'anual'], ['303', 'Autoliquidación IVA', 'AEAT', 'trimestral/mensual'],
  ['309', 'Autoliquidación IVA no periódica', 'AEAT', 'ocasional'], ['322', 'IVA grupo de entidades — individual', 'AEAT', 'mensual'],
  ['347', 'Operaciones con terceras personas', 'AEAT', 'anual'], ['349', 'Operaciones intracomunitarias', 'AEAT', 'mensual/trimestral'],
  ['353', 'IVA grupo de entidades — agregado', 'AEAT', 'mensual'], ['368', 'IVA servicios electrónicos — régimen anterior', 'AEAT', 'según supuesto'],
  ['369', 'IVA ventanilla única OSS/IOSS', 'AEAT', 'mensual/trimestral'], ['390', 'Resumen anual IVA', 'AEAT', 'anual'],
  ['400', 'Declaración censal IGIC', 'ATC', 'según supuesto'], ['412', 'Autoliquidación ocasional IGIC', 'ATC', 'ocasional'],
  ['414', 'Devolución IGIC a no establecidos', 'ATC', 'según supuesto'], ['415', 'Operaciones con terceras personas', 'ATC', 'anual'],
  ['416', 'Operaciones exentas vinculadas al REF', 'ATC', 'anual'], ['417', 'Autoliquidación IGIC SII', 'ATC', 'mensual'],
  ['418', 'IGIC grupo de entidades — individual', 'ATC', 'mensual'], ['419', 'IGIC grupo de entidades — agregado', 'ATC', 'mensual'],
  ['420', 'Autoliquidación IGIC — régimen general', 'ATC', 'trimestral'], ['421', 'Autoliquidación IGIC — régimen simplificado', 'ATC', 'trimestral'],
  ['422', 'Reintegro de compensaciones REAGP', 'ATC', 'según supuesto'], ['424', 'Comerciante minorista IGIC', 'ATC', 'según supuesto'],
  ['425', 'Resumen anual IGIC', 'ATC', 'anual'],
].map(([code, desc, authority, frequency]) => ({
  code,
  value: authority === 'ATC' ? `modelo_${code}_igic` : `modelo_${code}`,
  label: `Modelo ${code}`,
  desc,
  authority,
  frequency,
}));

export function getModeloInfo(value) {
  const code = String(value || '').replace(/^modelo_/, '').replace(/_igic$/, '').replace(/\D/g, '');
  return MODELOS_AEAT.find(model => model.code === code) || {
    code,
    value: value || '',
    label: code ? `Modelo ${code}` : 'Obligación fiscal',
    desc: 'Obligación informada por el asesor',
    authority: 'Otro',
    frequency: 'según supuesto',
  };
}

export const FISCAL_DOCUMENT_KINDS = [
  { value: 'borrador_modelo', label: 'Borrador del modelo' },
  { value: 'modelo_presentado', label: 'Modelo presentado' },
  { value: 'justificante_presentacion', label: 'Justificante de presentación' },
  { value: 'carta_pago', label: 'Carta de pago / NRC' },
  { value: 'notificacion', label: 'Notificación tributaria' },
  { value: 'requerimiento', label: 'Requerimiento' },
  { value: 'respuesta_requerimiento', label: 'Respuesta a requerimiento' },
  { value: 'otro', label: 'Otro documento fiscal' },
];

export const COLOR_MAP = {
  AEAT: 'bg-blue-50 text-blue-700 border-blue-200',
  ATC: 'bg-amber-50 text-amber-700 border-amber-200',
  Otro: 'bg-slate-50 text-slate-700 border-slate-200',
};

