const LABELS = Object.freeze({
  subject_taxed: 'Sujeta y no exenta',
  subject_zero: 'Sujeta a tipo cero',
  exempt_limited: 'Exenta sin derecho a deducción',
  exempt_full: 'Exenta con derecho a deducción',
  non_subject_article: 'No sujeta por supuesto legal',
  non_subject_location: 'No sujeta por localización',
  reverse_charge: 'Inversión del sujeto pasivo',
  intra_eu_supply: 'Entrega intracomunitaria',
  intra_eu_acquisition: 'Adquisición intracomunitaria',
  export: 'Exportación',
  import: 'Importación',
  canary_peninsula_goods: 'Bienes Canarias–Península/Baleares',
  canary_peninsula_service: 'Servicios Canarias–Península/Baleares',
  special_margin: 'Régimen especial de margen',
  outside_scope: 'Fuera del ámbito del impuesto',
});

export function fiscalTreatmentLabel(value) {
  const code = String(value || '').trim();
  if (!code) return 'Histórico';
  return LABELS[code] || code.replaceAll('_', ' ');
}
