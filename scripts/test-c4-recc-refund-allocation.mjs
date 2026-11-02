import assert from 'node:assert/strict';
import {reccSchedule,reccCorrections} from '../base44/functions/fiscalOperations/reccRules.mjs';
const original={id:'advance',tipo:'emitida',base_imponible:100,cuota_iva:21,total_factura:121,recc_metadata:JSON.stringify({documentKind:'advance'})};
const makeCredit=(refund)=>({id:'credit',tipo:'emitida',fiscal_regime:'criterio_caja',fiscal_review_status:'validado',es_rectificativa:true,base_imponible:-20,cuota_iva:-4.2,total_factura:-24.2,recc_metadata:JSON.stringify({documentKind:'advance',originalInvoiceId:'advance',adjustmentDate:'2026-03-01',adjustmentMode:'price_change',refundCashAmount:refund})});
for(const [refund,recognized,pending] of [[24.2,1,0.5],[0,0,0.3],[12.1,0.5,0.4]]){
 const corrections=reccCorrections(original,[makeCredit(refund)]);
 const schedule=reccSchedule({invoiceNet:121,operationDate:'2026-01-01',payments:[{id:'p1',date:'2026-02-01',amount:60.5}],corrections});
 assert.equal(schedule.correctionRecognitions[0].factor,recognized);
 assert.ok(Math.abs(schedule.events.at(-1).factor-pending)<1e-9);
 const netQuota=21*schedule.events.reduce((s,e)=>s+e.factor,0)-4.2*recognized;
 assert.ok(Math.abs(netQuota-16.8)<1e-9,'Total tax across original and credit must equal corrected price');
}
const refunded=reccSchedule({invoiceNet:121,operationDate:'2026-01-01',payments:[{id:'p1',date:'2026-02-01',amount:60.5},{id:'p2',date:'2026-04-01',amount:60.5}],corrections:reccCorrections(original,[makeCredit(24.2)])});
assert.equal(refunded.events.filter(e=>e.kind==='payment').length,2);
assert.equal(refunded.events.some(e=>e.kind==='forced_deadline'),false);
assert.throws(()=>reccSchedule({invoiceNet:121,operationDate:'2026-01-01',payments:[],corrections:reccCorrections(original,[makeCredit(24.2)])}),/reconocida/);
console.log(JSON.stringify({ok:true,partialAdvanceRefund:true,unpaidReduction:true,mixedAllocation:true,lateCollectionNoDuplicateTax:true,externalCalls:0,realWrites:0}));
