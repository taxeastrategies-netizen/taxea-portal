// Decimal arithmetic at the currency boundary: never round a binary FX product.
function decimalFraction(value){
 const n=Number(value);if(!Number.isFinite(n))return null;
 const [mantissa,exponent='0']=String(n).toLowerCase().split('e');
 const negative=mantissa.startsWith('-'),parts=mantissa.replace(/^[-+]/,'').split('.');
 let coefficient=BigInt((parts[0]||'0')+(parts[1]||'')),scale=(parts[1]||'').length-Number(exponent);
 if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
 return {coefficient:negative?-coefficient:coefficient,denominator:10n**BigInt(scale)};
}
function roundedDecimalEuro(numerator,denominator){
 if(denominator===0n)return NaN;
 if(denominator<0n){numerator=-numerator;denominator=-denominator;}
 const sign=numerator<0n?-1:1,absolute=numerator<0n?-numerator:numerator,scaled=absolute*100n;
 const cents=scaled/denominator+(scaled%denominator*2n>=denominator?1n:0n);
 return sign*Number(cents)/100;
}
export function fxMoney(value,...multipliers){
 let numerator=1n,denominator=1n;
 for(const valuePart of [value,...multipliers]){const part=decimalFraction(valuePart);if(!part)return NaN;numerator*=part.coefficient;denominator*=part.denominator;}
 return roundedDecimalEuro(numerator,denominator);
}
export function fxRatioMoney(value,numerator,denominator){
 const a=decimalFraction(value),b=decimalFraction(numerator),c=decimalFraction(denominator);
 if(!a||!b||!c||c.coefficient===0n)return NaN;
 return roundedDecimalEuro(a.coefficient*b.coefficient*c.denominator,a.denominator*b.denominator*c.coefficient);
}

/**
 * AEAT QR tributario v0.5.0. Un QR no acredita remisión VERI*FACTU.
 * La URL se persiste en la emisión para que el PDF no dependa de datos posteriores.
 */
export function buildAeatQrUrl(company, invoice) {
  const nif = String(company?.nif_cif || '').toUpperCase().replace(/[\s.-]/g, '');
  const numserie = String(invoice?.numero_factura || '').trim();
  const isoDate = String(invoice?.fecha_emision || '');
  // ImporteTotal del RRSIF: base + impuesto repercutido + recargo de equivalencia, antes de retenciones o suplidos.
  const amount = Math.round((Number(invoice?.base_imponible) + Number(invoice?.cuota_iva) + Number(invoice?.cuota_recargo || 0)) * 100) / 100;
  if (!/^[A-Z0-9]{9}$/.test(nif)) throw new Error('El emisor necesita un NIF/CIF español válido para el QR tributario.');
  if (!numserie || numserie.length > 60) throw new Error('El número de factura no es válido para el QR tributario.');
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const parsedDate = new Date(isoDate + 'T00:00:00Z');
  if (!dateMatch || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== isoDate) {
    throw new Error('La fecha de emisión no es válida para el QR tributario.');
  }
  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e12) throw new Error('El importe fiscal no es válido para el QR tributario.');
  const payable = Number(invoice?.total_factura);
  const retention = Number(invoice?.importe_retencion || 0);
  if (!Number.isFinite(payable) || !Number.isFinite(retention) || Math.abs(amount - retention - payable) > 0.03) {
    throw new Error('La base, el impuesto, el recargo, la retención y el total a pagar no cuadran; revisa la factura antes de emitirla.');
  }
  let fiscalAmount=amount;
  if(String(invoice?.moneda||'EUR').toUpperCase()!=='EUR'){
    let metadata;try{metadata=JSON.parse(invoice.recc_metadata||'{}');}catch{throw new Error('Metadatos de conversión inválidos.');}
    const quote=(metadata.fxQuotes||[]).find(row=>row.date===String(invoice.fecha_operacion||invoice.fecha_emision).slice(0,10));
    if(invoice.fiscal_regime!=='criterio_caja'||invoice.fiscal_review_status!=='validado'||!quote?.reviewedBy||!quote?.source||!(Number(quote.rate)>0))throw new Error('El QR en divisa requiere un cambio oficial a EUR confirmado por asesor.');
    fiscalAmount=fxMoney(amount,Number(quote.rate));
    if(!Number.isFinite(fiscalAmount)||Math.abs(fiscalAmount)>=1e12)throw new Error('Importe EUR fuera del rango del QR tributario.');
  }
  const params = new URLSearchParams({
    nif,
    numserie,
    fecha: `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`,
    importe: fiscalAmount.toFixed(2),
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?${params.toString()}`;
}
