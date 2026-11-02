// Importes documentales en su divisa; diario y liquidación siempre en EUR.
const clean=v=>String(v??'').trim();
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

export const invoiceCurrency=i=>clean(i?.moneda||'EUR').toUpperCase();
export const fxMetadata=i=>{try{return JSON.parse(i?.recc_metadata||'{}');}catch{throw Object.assign(new Error('Metadatos RECC inválidos.'),{status:422});}};
const invalid=message=>Object.assign(new Error(message),{status:422});
export function accountingFx(invoice){
 const currency=invoiceCurrency(invoice),rate=currency==='EUR'?1:Number(invoice.exchange_rate);
 if(!/^[A-Z]{3}$/.test(currency)||!Number.isFinite(rate)||rate<=0||rate>1000000)throw invalid('Indica el cambio contable a EUR de la factura.');
 return rate;
}
export function taxFx(invoice,date){
 if(invoiceCurrency(invoice)==='EUR')return 1;
 const quote=(fxMetadata(invoice).fxQuotes||[]).find(q=>q.date===date);
 if(!quote||!Number.isFinite(Number(quote.rate))||Number(quote.rate)<=0||!clean(quote.source)||!clean(quote.reviewedBy)||!clean(quote.reviewedAt))
  throw invalid(`Falta cambio fiscal oficial a EUR revisado por asesor para ${date}.`);
 return Number(quote.rate);
}
export function reviewedFxQuotes(previous,input,actor,now){
 const result=[...(previous||[])];
 if(input==null)return result;
 if(!Array.isArray(input)||input.length>400)throw invalid('Lista de cambios fiscales no válida.');
 for(const row of input){
  const date=clean(row.date),rate=Number(row.rate),source=clean(row.source);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!Number.isFinite(rate)||rate<=0||rate>1000000||source.length<6||source.length>500)
   throw invalid('Cada cambio fiscal requiere fecha válida, EUR por unidad de divisa y fuente oficial.');
  const old=result.find(q=>q.date===date);
  if(old){if(Number(old.rate)!==rate||clean(old.source)!==source)throw invalid('El cambio fiscal de esa fecha ya está confirmado. Su rectificación exige ajuste trazado, no sobrescribir el histórico.');continue;}
  result.push({date,rate,source,reviewedBy:actor,reviewedAt:now});
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function forcedFxDate(invoice){
 const op=clean(invoice.fecha_operacion||invoice.fecha_emision).slice(0,10),deadline=`${Number(op.slice(0,4))+1}-12-31`,insolvency=clean(fxMetadata(invoice).insolvencyDate);
 return insolvency>op&&insolvency<deadline?insolvency:deadline;
}
export function allocatedPart(total,before,amount,face){
 if(!(face>0)||before<0||amount<0||before+amount>face+0.011)throw invalid('El reparto del pago no coincide con el saldo documental.');
 return fxMoney(fxRatioMoney(total,Math.min(face,fxMoney(before+amount)),face)-fxRatioMoney(total,Math.min(face,before),face));
}
export function reccPaymentFx(invoice,payment,before,taxLines=[]){
 const face=Math.abs(Number(invoice.total_factura)),amount=Math.abs(Number(payment.amount)),rate=accountingFx(invoice);
 const fx=Number(payment.exchange_rate),cash=fxMoney(amount,fx),creditBook=fxMetadata(invoice).advanceCreditBook,carry=creditBook?allocatedPart(creditBook.paidTotalEur,before,amount,Number(fxMetadata(invoice).refundCashAmount??face)):allocatedPart(Math.abs(fxMoney(face,rate)),before,amount,face);
 if(!Number.isFinite(fx)||fx<=0||fx>1000000||!Number.isFinite(cash)||cash>=1e12)throw invalid('Indica el cambio efectivo del cobro/pago a EUR.');
 const credit=Number(invoice.total_factura)<0,sign=invoice.tipo==='emitida'?1:-1,date=payment.payment_date,forced=forcedFxDate(invoice);
 const fiscal=taxFx(invoice,date),taxDate=date<=forced?date:forced;
 if(!credit&&date>forced)taxFx(invoice,forced);
 const part=v=>allocatedPart(Math.abs(Number(v)||0),before,amount,face);
 const quota=part(invoice.cuota_iva),deduct=part(invoice.deductible_tax_amount),nondeduct=part(invoice.non_deductible_tax_amount),surcharge=part(invoice.cuota_recargo),retention=part(invoice.importe_retencion),base=part(invoice.base_imponible);
 const taxRate=credit?taxFx(invoice,fxMetadata(invoice).adjustmentDate||date):date<=forced?fiscal:taxFx(invoice,forced);
 const fiscalPart=(key,value)=>key==='nonDeductibleQuota'&&invoice.tipo!=='recibida'?0:taxLines.length?fxMoney(taxLines.reduce((sum,line)=>sum+(key==='nonDeductibleQuota'?fxMoney(fxMoney(part(line.quota),taxRate)-fxMoney(part(line.deductibleQuota),taxRate)):fxMoney(part(line[key]),taxRate)),0)):fxMoney(value,taxRate);
 const delta=(v,original,key)=>{
  if(creditBook||(!credit&&date>forced))return 0;
  const fiscalValue=fiscalPart(key,v);
  return fxMoney(fiscalValue-allocatedPart(Math.abs(fxMoney(Number(original||0),rate)),before,amount,face));
 };
 const advance=fxMetadata(invoice).documentKind==='advance'&&!credit;
 const advanceDelta=advance?fxMoney(fxMoney(base,fx)-fxMoney(base,rate)):0;
 return {currency:invoiceCurrency(invoice),exchange_rate:fx,amount_eur:cash,carrying_amount_eur:carry,tax_exchange_rate:fiscal,
  tax_exchange_rate_source:(fxMetadata(invoice).fxQuotes||[]).find(q=>q.date===date)?.source||'EUR',fx_before_paid:before,
  fx_plan:JSON.stringify({version:'recc-fx-v1',bookTax:Object.fromEntries([['quota','cuota_iva'],['deductible','deductible_tax_amount'],['nonDeductible','non_deductible_tax_amount'],['surcharge','cuota_recargo']].map(([key,field])=>[key,allocatedPart(Math.abs(fxMoney(Number(invoice[field]||0),rate)),before,amount,face)])),incoming:(sign>0)!==credit,credit,sign,quota:delta(quota,invoice.cuota_iva,'quota'),deductible:delta(deduct,invoice.deductible_tax_amount,'deductibleQuota'),nonDeductible:delta(nondeduct,invoice.non_deductible_tax_amount,'nonDeductibleQuota'),surcharge:delta(surcharge,invoice.cuota_recargo,'surchargeQuota'),retention:creditBook?0:fxMoney(fxMoney(retention,fiscal)-fxMoney(retention,rate)),advance:advanceDelta,advance_cost_eur:advance?fxMoney(fxMoney(base,fx)+fiscalPart('nonDeductibleQuota',nondeduct)):0,taxDate})};
}
export function forcedTaxFxParts(invoice,payments){
 const date=forcedFxDate(invoice),rate=accountingFx(invoice),fiscal=taxFx(invoice,date),face=Math.abs(Number(invoice.total_factura));
 const before=fxMoney(payments.filter(p=>p.operation_status==='committed'&&p.payment_date<=date).reduce((s,p)=>s+Math.abs(Number(p.amount)||0),0));
 const remaining=Math.max(0,fxMoney(face-before)),part=v=>allocatedPart(Math.abs(Number(v)||0),before,remaining,face),delta=v=>fxMoney(fxMoney(v,fiscal)-fxMoney(v,rate));
 return {date,quota:delta(part(invoice.cuota_iva)),deductible:delta(part(invoice.deductible_tax_amount)),nonDeductible:delta(part(invoice.non_deductible_tax_amount)),surcharge:delta(part(invoice.cuota_recargo)),remaining};
}
