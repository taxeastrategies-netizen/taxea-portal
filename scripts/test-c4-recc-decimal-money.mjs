import assert from 'node:assert/strict';
import {fxMoney,fxRatioMoney,allocatedPart,reccPaymentFx} from '../base44/functions/invoiceOperations/reccCurrency.mjs';
import {fxMoney as summaryMoney,invoiceEuroAmount} from '../src/lib/financialSourceTruth.js';
for(const [amount,rate,expected] of [[60.5,.95,57.48],[-60.5,.95,-57.48],[1.005,1,1.01],[-1.005,1,-1.01],[10.5,.95,9.98],[-10.5,.95,-9.98],[1000000000.05,.1,100000000.01],[1e-7,1e6,.1]]){assert.equal(fxMoney(amount,rate),expected);assert.equal(summaryMoney(amount,rate),expected);}
for(let cents=1;cents<10000;cents+=7)for(const rateCents of [1,5,95,105,200]){const integerProduct=BigInt(cents)*BigInt(rateCents);const expected=Number(integerProduct/100n+(integerProduct%100n>=50n?1n:0n))/100;assert.equal(fxMoney(cents/100,rateCents/100),expected);assert.equal(fxMoney(-cents/100,rateCents/100),-expected);}
assert.equal(fxRatioMoney(1,1,8),.13);assert.equal(fxRatioMoney(-1,1,8),-.13);
assert.equal(allocatedPart(1,0,1,8),.13);assert.equal(allocatedPart(1,7,1,8),.12);
const invoice={tipo:'emitida',moneda:'USD',total_factura:121,base_imponible:100,cuota_iva:21,exchange_rate:.9,fecha_operacion:'2026-11-01',recc_metadata:JSON.stringify({fxQuotes:[{date:'2026-11-02',rate:.95,source:'PRUEBA FICTICIA',reviewedBy:'qa',reviewedAt:'2026-11-02'}]})};
const result=reccPaymentFx(invoice,{amount:60.5,exchange_rate:.95,payment_date:'2026-11-02'},0);assert.equal(result.amount_eur,57.48);assert.equal(result.carrying_amount_eur,54.45);assert.equal(invoiceEuroAmount({...invoice,total_factura:60.5,exchange_rate:.95}),57.48);
console.log(JSON.stringify({ok:true,decimalProductHalfAwayFromZero:true,negativeSymmetry:true,integerOracleCases:14290,originalLiveFailureReproduced:Math.round((60.5*.95+Number.EPSILON)*100)/100===57.47,realWrites:0}));
