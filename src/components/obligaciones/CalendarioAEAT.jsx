// Calendario general AEAT con fechas clave del año fiscal español
export const MODELOS_AEAT = [
  { value: 'modelo_303', label: 'Modelo 303', desc: 'IVA Trimestral', frecuencia: 'trimestral', color: 'blue', icon: '📊' },
  { value: 'modelo_390', label: 'Modelo 390', desc: 'Resumen Anual IVA', frecuencia: 'anual', color: 'blue', icon: '📋' },
  { value: 'modelo_130', label: 'Modelo 130', desc: 'IRPF Trimestral (autónomos)', frecuencia: 'trimestral', color: 'green', icon: '💼' },
  { value: 'modelo_111', label: 'Modelo 111', desc: 'Retenciones IRPF Trimestral', frecuencia: 'trimestral', color: 'green', icon: '💰' },
  { value: 'modelo_115', label: 'Modelo 115', desc: 'Retenciones Alquiler', frecuencia: 'trimestral', color: 'green', icon: '🏠' },
  { value: 'modelo_190', label: 'Modelo 190', desc: 'Resumen Anual Retenciones', frecuencia: 'anual', color: 'green', icon: '📑' },
  { value: 'modelo_180', label: 'Modelo 180', desc: 'Resumen Anual Retenciones Alquiler', frecuencia: 'anual', color: 'green', icon: '🏢' },
  { value: 'modelo_347', label: 'Modelo 347', desc: 'Operaciones con Terceros', frecuencia: 'anual', color: 'purple', icon: '🤝' },
  { value: 'modelo_349', label: 'Modelo 349', desc: 'Operaciones Intracomunitarias', frecuencia: 'trimestral', color: 'purple', icon: '🌍' },
  { value: 'modelo_202', label: 'Modelo 202', desc: 'Pago Fraccionado IS', frecuencia: 'trimestral', color: 'orange', icon: '🏛️' },
  { value: 'modelo_200', label: 'Modelo 200', desc: 'Impuesto de Sociedades', frecuencia: 'anual', color: 'orange', icon: '🏦' },
  { value: 'modelo_420_igic', label: 'Modelo 420', desc: 'IGIC Trimestral (Canarias)', frecuencia: 'trimestral', color: 'teal', icon: '🌴' },
  { value: 'modelo_425_igic', label: 'Modelo 425', desc: 'Resumen Anual IGIC', frecuencia: 'anual', color: 'teal', icon: '🌴' },
  { value: 'renta', label: 'Renta (IRPF)', desc: 'Declaración de la Renta', frecuencia: 'anual', color: 'red', icon: '👤' },
  { value: 'cuentas_anuales', label: 'Cuentas Anuales', desc: 'Depósito en Registro Mercantil', frecuencia: 'anual', color: 'gray', icon: '📚' },
];

// Fechas límite AEAT por trimestre
export const VENCIMIENTOS_TRIMESTRALES = {
  T1: { label: '1T (Ene–Mar)', limite: '20 de abril' },
  T2: { label: '2T (Abr–Jun)', limite: '20 de julio' },
  T3: { label: '3T (Jul–Sep)', limite: '20 de octubre' },
  T4: { label: '4T (Oct–Dic)', limite: '30 de enero' },
};

export const VENCIMIENTOS_ANUALES = [
  { modelo: 'modelo_390', limite: '30 de enero', desc: 'Resumen anual IVA' },
  { modelo: 'modelo_190', limite: '31 de enero', desc: 'Resumen anual retenciones' },
  { modelo: 'modelo_180', limite: '31 de enero', desc: 'Resumen anual alquiler' },
  { modelo: 'modelo_347', limite: '28 de febrero', desc: 'Operaciones con terceros' },
  { modelo: 'modelo_200', limite: '25 de julio', desc: 'Impuesto de Sociedades' },
  { modelo: 'renta', limite: '30 de junio', desc: 'Declaración de la Renta' },
  { modelo: 'cuentas_anuales', limite: '30 de julio', desc: 'Depósito cuentas anuales' },
];

export const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  teal: 'bg-teal-light text-teal border-teal/20',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-secondary text-muted-foreground border-border',
};

export function getModeloInfo(value) {
  return MODELOS_AEAT.find(m => m.value === value) || { label: value, desc: '', color: 'gray', icon: '📄' };
}