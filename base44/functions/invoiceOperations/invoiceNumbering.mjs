function seriesOptions(number, expectedYear) {
  const value = String(number || '').trim();
  const tokens = [...value.matchAll(/\d+/g)];
  if (!tokens.length) return [];
  const yearMarkers = tokens.length > 1 ? tokens.filter(token => token[0] === expectedYear) : [];
  return (yearMarkers.length ? yearMarkers : [null]).map(marker => {
    const counter = tokens.findLast(token => token !== marker);
    return {
      prefix: value.slice(0, counter.index),
      suffix: value.slice(counter.index + counter[0].length),
    };
  });
}

function invoiceDate(row) {
  const date = String(row.fecha_emision || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const number = String(row.numero_factura || '');
  const inferredYear = String(row.anio || number.match(/(?:^|\D)((?:19|20)\d{2})(?=\D|$)/)?.[1] || '');
  return /^\d{4}$/.test(inferredYear) ? inferredYear + '-01-01' : String(row.created_date || '').slice(0, 10);
}

function counterInSeries(number, { prefix, suffix }) {
  const value = String(number || '').trim();
  const folded = value.toLowerCase();
  if (!folded.startsWith(prefix.toLowerCase()) || !folded.endsWith(suffix.toLowerCase())) return '';
  const counter = value.slice(prefix.length, value.length - suffix.length);
  return /^\d+$/.test(counter) ? counter : '';
}

function chooseSeries(latest, issued) {
  const options = latest.options;
  if (options.length === 1) return options[0];
  // If the sequence equals the year, let the other documents identify its position.
  return options.reduce((best, series) => {
    const matches = issued.filter(row => row.id !== latest.id && counterInSeries(row.numero_factura, series)).length;
    return matches > best.matches ? { series, matches } : best;
  }, { series: options[0], matches: -1 }).series;
}

function replaceYear(value, previousYear, targetYear) {
  return value.replace(/\d+/g, digits => digits === previousYear ? targetYear : digits);
}

export async function nextIssuedInvoiceNumber(service, companyId, date, rectifying = false) {
  const targetYear = date.slice(0, 4);
  const issued = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    const page = await service.entities.Invoice.filter(
      { company_id: companyId, tipo: 'emitida' }, 'id', 500, offset
    );
    issued.push(...page);
    if (page.length < 500) break;
    if (offset === 99500) throw Object.assign(new Error('No se pudo leer la serie completa de facturación.'), { status: 422 });
  }

  let latest = null;
  for (const invoice of issued) {
    if ((invoice.es_rectificativa === true) !== rectifying) continue;
    const emitted = invoiceDate(invoice);
    const year = emitted.slice(0, 4);
    if (!emitted || year > targetYear) continue;
    const options = seriesOptions(invoice.numero_factura, year);
    if (!options.length) continue;
    const order = emitted + ' ' + String(invoice.created_date || '') + ' ' + invoice.id;
    if (!latest || order > latest.order) latest = { id: invoice.id, order, year, options };
  }

  const format = latest ? chooseSeries(latest, issued) : null;
  const series = format ? {
    prefix: replaceYear(format.prefix, latest.year, targetYear),
    suffix: replaceYear(format.suffix, latest.year, targetYear),
  } : { prefix: (rectifying ? 'R-' : 'F-') + targetYear + '-', suffix: '' };
  let highest = 0n;
  let width = format ? 1 : 3;
  for (const invoice of issued) {
    const counter = counterInSeries(invoice.numero_factura, series);
    if (counter && BigInt(counter) > highest) highest = BigInt(counter);
    const formatCounter = format ? counterInSeries(invoice.numero_factura, format) : '';
    for (const digits of [counter, formatCounter]) {
      if (digits.startsWith('0')) width = Math.max(width, digits.length);
    }
  }
  const number = series.prefix + String(highest + 1n).padStart(width, '0') + series.suffix;
  if (number.length > 120) throw Object.assign(new Error('La serie supera la longitud admitida. Introduce otro número de factura.'), { status: 422 });
  return number;
}
