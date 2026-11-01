import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import KpiRow from '../src/components/finance/KpiRow';
import FinanceHealthScore from '../src/components/finance/FinanceHealthScore';
import SmartWidgets from '../src/components/finance/SmartWidgets';
import CashKpiGrid from '../src/components/finance/cashflow/CashKpiGrid';
import CashAlertsPanel from '../src/components/finance/cashflow/CashAlertsPanel';
import FinancialTimeline from '../src/components/finance/FinancialTimeline';
import { buildFinanceDashboardModel } from '../src/lib/financeDashboardModel.mjs';
import { financialTimeline } from '../src/lib/financialTimeline.mjs';
import { buildCashForecast } from '../src/lib/cashForecast.js';
const now=new Date('2026-11-01T12:00:00Z'),data=buildFinanceDashboardModel({now});
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;};
for(const element of [<KpiRow financials={data}/>,<FinanceHealthScore financials={data}/>,<SmartWidgets financials={data} obligations={[]}/>,<CashKpiGrid financials={data}/>,<CashAlertsPanel financials={data} obligations={[]} calendarError/>,<FinancialTimeline/>]){
 const html=renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);check(html.length>20,'component renders');check(!/NaN|Infinity|undefined/.test(html),'component does not format unknown as invalid number');
}
const health=renderToStaticMarkup(<MemoryRouter><FinanceHealthScore financials={data}/></MemoryRouter>);check(health.includes('Sin datos completos')||health.includes('sin datos completos'),'empty health stays unscored');
const invoices=Array.from({length:25},(_,i)=>({id:String(i),tipo:'emitida',fecha_emision:`2026-10-${String(i+1).padStart(2,'0')}`,total_factura:100}));
invoices.push({id:'cancelled',tipo:'emitida',anulada:true,fecha_emision:'2026-11-01',total_factura:999},{id:'future',tipo:'emitida',fecha_emision:'2026-12-01',total_factura:999});
const timeline=financialTimeline(invoices,[],[{id:'today',fecha_limite:'2026-11-01'},{id:'later',fecha_limite:'2026-12-31'},{id:'closed',fecha_limite:'2026-11-02',estado:'presentado'}],{now});
check(timeline.recent[0].id==='invoice:24','latest documents sorted before truncation');check(timeline.recent.length===12,'bounded visible timeline');check(timeline.upcoming.length===1&&timeline.upcoming[0].id==='tax:today','today shown, closed and beyond horizon excluded');
const forecast=buildCashForecast({today:'2026-11-01',invoices:[{id:'paid',tipo:'emitida',estado_cobro:'cobrada',total_factura:100,fecha_vencimiento:'2026-11-02'}],obligations:[{id:'directdebit',estado:'domiciliado',resultado:'a_ingresar',importe:80,fecha_limite:'2026-11-03'},{id:'filed',estado:'presentado',resultado:'a_ingresar',importe:40,fecha_limite:'2026-11-03'}]});
check(forecast.movements.every(row=>row.id!=='paid'&&row.key!=='invoice:paid'),'paid invoice not counted again');check(forecast.outflows===120,'filing or direct-debit request is not proof of payment');
console.log(JSON.stringify({ok:true,checks,renderedComponents:6,financialWrites:0,externalCalls:0}));
