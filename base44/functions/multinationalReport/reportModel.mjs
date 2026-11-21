import { buildReports } from './accountingReportEngine.ts';
import { invoiceEuroAmount, reconcileFinancialSources } from './financialSourceTruth.js';
import { bankObservation, bankFlows } from './observedBanking.mjs';

export const money = value => Math.round((Number(value) || 0) * 100) / 100;
const sum = (rows, fn) => money(rows.reduce((a, r) => a + (Number(fn(r)) || 0), 0));
const day = v => String(v || '').slice(0, 10);
const within = (date, start, end) => date >= start && date <= end;
const finite = v => v !== '' && v != null && Number.isFinite(Number(v));
const amount = (r, k) => invoiceEuroAmount(r, k);
const isIncome = r => r.source === 'Invoice' ? r.tipo !== 'recibida' : r.tipo === 'ingreso';
const docDate = r => day(r.fecha_emision || r.fecha);
const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const ratio = (a, b) => b > 0 ? money(a / b) : null;
const delta = (a, b, present) => present && Math.abs(b) > 0.01 ? money((a - b) / Math.abs(b) * 100) : null;
export function reportWindow(year, firstMonth = 1, lastMonth = 12) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(firstMonth) || !Number.isInteger(lastMonth) || firstMonth < 1 || lastMonth > 12 || firstMonth > lastMonth) throw new Error('Período no válido.');
  return { year, firstMonth, lastMonth, start: `${year}-${String(firstMonth).padStart(2,'0')}-01`, end: new Date(Date.UTC(year, lastMonth, 0)).toISOString().slice(0,10) };
}

// Same confirmed/committed/balanced gate as the main accounting reports.
// An entry, not an individual line, is the integrity boundary.
function validUnits(data) {
  const accepted = [], rejected = [];
  for (const e of data.entries) {
    if (e.status !== 'confirmado') continue;
    const rows = data.linesByEntry.get(e.id) || [];
    const numeric = rows.every(l => finite(l.debit || l.debeE || 0) && finite(l.credit || l.haberE || 0) && String(l.accountCode || l.subcuenta || '').trim());
    const debit = sum(rows, l => l.debit || l.debeE), credit = sum(rows, l => l.credit || l.haberE);
    const committed = !e.accountingOperationId || data.operationById.get(e.accountingOperationId)?.status === 'committed';
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(day(e.date)) && Number(day(e.date).slice(0,4)) === Number(e.ejercicio || day(e.date).slice(0,4));
    if (rows.length < 2 || !numeric || !committed || !validDate || Math.abs(debit-credit) > 0.01) {
      rejected.push({id:e.id,number:e.entryNumber,date:day(e.date),reason:!committed?'Operación no completada':!validDate?'Fecha / ejercicio incoherente':!numeric?'Importe o cuenta no válido':'Asiento sin líneas o descuadrado'}); continue;
    }
    accepted.push({entry:e,rows});
  }
  return {accepted,rejected};
}
const incomeGroups = [
  ['revenue','Importe neto de la cifra de negocios',/^70/],['inventory','Variación de existencias',/^71/],
  ['ownWork','Trabajos realizados para el activo',/^73/],['otherIncome','Otros ingresos de explotación',/^(74|75)/],
  ['financialIncome','Ingresos financieros y reversiones financieras',/^(76|79[6-9])/],['otherResultIncome','Otros resultados e ingresos',/^77/],
  ['otherOperatingIncome','Reversiones y otros ingresos',/^7/],
];
const expenseGroups = [
  ['purchases','Aprovisionamientos',/^60/],['stockChange','Variación de existencias de compras',/^61/],
  ['external','Servicios exteriores',/^62/],['incomeTax','Impuesto sobre beneficios',/^63[038]/],
  ['taxes','Otros tributos y ajustes',/^63/],['personnel','Gastos de personal',/^64/],
  ['otherExpense','Otros gastos de gestión',/^65/],['financialExpense','Gastos financieros y deterioros financieros',/^(66|69[6-9])/],
  ['otherResultExpense','Otros resultados y gastos',/^67/],['depreciation','Amortizaciones',/^68/],
  ['impairment','Deterioros y provisiones',/^69/],['otherOperatingExpense','Otros gastos',/^6/],
];
function pnlFromAccounts(accounts) {
  const groups = [...incomeGroups,...expenseGroups].map(([key,label])=>({key,label,amount:0,accounts:[]}));
  for (const a of accounts) {
    if (!/^[67]/.test(a.code)) continue;
    const income = a.code.startsWith('7');
    const definition = (income?incomeGroups:expenseGroups).find(([, , re])=>re.test(a.code));
    const group = groups.find(g=>g.key===definition[0]);
    const value = income ? a.credit-a.debit : a.debit-a.credit;
    group.amount = money(group.amount+value); group.accounts.push({...a,amount:money(value)});
  }
  const v = key => groups.find(g=>g.key===key)?.amount || 0;
  const revenue = v('revenue'), totalIncome = sum(groups.filter(g=>incomeGroups.some(([k])=>k===g.key)),g=>g.amount);
  const totalExpense = sum(groups.filter(g=>expenseGroups.some(([k])=>k===g.key)),g=>g.amount);
  const netResult = money(totalIncome-totalExpense), financeResult = money(v('financialIncome')-v('financialExpense'));
  const ebit = money(netResult + v('incomeTax') - financeResult), ebitda = money(ebit+v('depreciation'));
  return {groups,revenue,totalIncome,totalExpense,netResult,financeResult,incomeTax:v('incomeTax'),depreciation:v('depreciation'),ebit,ebitda,ebitdaMargin:ratio(ebitda*100,revenue),netMargin:ratio(netResult*100,revenue)};
}
function normalizedAccounting(data) {
  // Existing custom types win. Fill only missing PGC types; never write accounts.
  const accounts = data.accounts.map(a=>({...a,type:a.type || (/^(14|15|16|17|18|19|50|51|52|55)/.test(a.code)?'pasivo':/^(10|11|12|13)/.test(a.code)?'patrimonio':'')}));
  return {...data,accounts,accountByCode:new Map(accounts.map(a=>[a.code,a]))};
}
function reportForUnits(data, units, year) {
  return buildReports({...data,entries:units.map(u=>u.entry)}, {year,scope:'confirmed',withoutComparative:true});
}
function segmentOf(entry, line = {}) {
  return line.costCenterId || entry.costCenterId ? `centro:${line.costCenterId || entry.costCenterId}` : line.projectId || entry.projectId || line.proyecto ? `proyecto:${line.projectId || entry.projectId || line.proyecto}` : entry.department ? `departamento:${entry.department}` : 'unassigned';
}
const segmentLabel = key => key === 'unassigned' ? 'Sin asignar' : key.replace('centro:','Centro · ').replace('proyecto:','Proyecto · ').replace('departamento:','Departamento · ');

function canonicalDocuments(invoices, expenses) {
  // Bucket on face amount before the established deduplicator: bounded candidate set,
  // retain exact explicit invoice links across dates / amounts.
  const index=new Map(), byId=new Map(invoices.map(r=>[r.id,r]));
  for(const r of invoices){const k=String(money(r.total_factura));if(!index.has(k))index.set(k,[]);index.get(k).push(r);}
  const retained=[], duplicateLinks=[], reviewCandidates=[];
  for(const e of expenses){const total=Number(e.total)||0; const candidates=[...new Map([...(index.get(String(money(total)))||[]),...(index.get(String(money(total-.01)))||[]),...(index.get(String(money(total+.01)))||[]),...(byId.has(e.canonical_invoice_id)?[byId.get(e.canonical_invoice_id)]:[])].map(r=>[r.id,r])).values()];
    const result=reconcileFinancialSources(candidates,[e]); retained.push(...result.expenses);duplicateLinks.push(...result.duplicateLinks);reviewCandidates.push(...result.reviewCandidates);}
  return {documents:[...invoices.map(r=>({...r,source:'Invoice'})),...retained.map(r=>({...r,source:'Expense'}))],duplicateLinks,reviewCandidates};
}
function managementReport(documents, window) {
  const rows = documents.filter(r=>within(docDate(r),window.start,window.end));
  const revenue = sum(rows.filter(isIncome),r=>amount(r,'base_imponible'));
  const costs = sum(rows.filter(r=>!isIncome(r)),r=>amount(r,'base_imponible')+amount(r,'non_deductible_tax_amount'));
  return {revenue,costs,result:money(revenue-costs),count:rows.length};
}
function aging(documents, asOf) {
  const bands=['Sin vencer','1–30 días','31–60 días','61–90 días','Más de 90 días','Sin vencimiento'];
  const rows=documents.filter(r=>r.source==='Invoice' && docDate(r)<=asOf && !['cobrada','pagada','anulada','cancelada'].includes(r.estado_cobro) && Number(r.total_factura)>0).map(r=>{
    const pending=amount(r,'importe_pendiente');
    const due=day(r.fecha_vencimiento); const days=due?Math.floor((Date.parse(asOf)-Date.parse(due))/86400000):null;
    const band=days==null?5:days<=0?0:days<=30?1:days<=60?2:days<=90?3:4;
    return {id:r.id,number:r.numero_factura,date:docDate(r),due,party:isIncome(r)?r.cliente_nombre:r.proveedor_nombre,pending,days,band:bands[band],direction:isIncome(r)?'receivable':'payable'};
  }).filter(r=>r.pending>.01);
  return {asOf,bands:bands.map(label=>({label,receivable:sum(rows.filter(r=>r.direction==='receivable'&&r.band===label),r=>r.pending),payable:sum(rows.filter(r=>r.direction==='payable'&&r.band===label),r=>r.pending)})),receivable:sum(rows.filter(r=>r.direction==='receivable'),r=>r.pending),payable:sum(rows.filter(r=>r.direction==='payable'),r=>r.pending),rows};
}
function concentration(rows, income) {
  const grouped=new Map();
  for(const r of rows.filter(r=>isIncome(r)===income)){
    const name=r.source==='Invoice'?(income?r.cliente_nombre:r.proveedor_nombre):r.proveedor_cliente;
    const key=normal(r.source==='Invoice'?(income?r.cliente_nif:r.proveedor_nif):r.tax_id)||normal(name)||`unknown:${r.id}`;
    const g=grouped.get(key)||{name:name||'Sin identificar',base:0,count:0,ids:[]}; g.base=money(g.base+amount(r,'base_imponible'));g.count++;g.ids.push(r.id);grouped.set(key,g);
  }
  const all=[...grouped.values()].sort((a,b)=>b.base-a.base);const total=sum(all,r=>r.base);
  return {total,topShare:total>0?money((all[0]?.base||0)/total*100):null,rows:all};
}

export function buildMultinationalReport(raw, options = {}) {
  const {year,firstMonth=1,lastMonth=12,segment='all',now=new Date()}=options;
  const window=reportWindow(year,firstMonth,lastMonth), previousWindow=reportWindow(year-1,firstMonth,lastMonth);
  const today=new Date(now).toISOString().slice(0,10);
  const data=normalizedAccounting(raw.accounting), {accepted,rejected}=validUnits(data);
  const yearUnits=y=>accepted.filter(u=>Number(day(u.entry.date).slice(0,4))===y);
  const economic=units=>units.filter(u=>!['apertura','regularizacion','cierre'].includes(u.entry.type));
  const filtered=units=>segment==='all'?units:units.map(u=>({...u,rows:u.rows.filter(l=>segmentOf(u.entry,l)===segment)}));
  // Account totals may be segmented line by line; integrity always validated before slicing.
  const pnlFor=(units,y)=>{
    const totals=new Map();for(const u of filtered(units))for(const l of u.rows){const code=String(l.accountCode||l.subcuenta);if(!totals.has(code))totals.set(code,{code,name:l.accountName||data.accountByCode.get(code)?.name||code,debit:0,credit:0});const a=totals.get(code);a.debit=money(a.debit+Number(l.debit||l.debeE||0));a.credit=money(a.credit+Number(l.credit||l.haberE||0));}
    return {...pnlFromAccounts([...totals.values()]),count:units.length,year:y};
  };
  const periodUnits=(w)=>economic(yearUnits(w.year)).filter(u=>within(day(u.entry.date),w.start,w.end));
  const currentUnits=periodUnits(window),previousUnits=periodUnits(previousWindow);
  const pnl=pnlFor(currentUnits,year),previous=pnlFor(previousUnits,year-1);
  const balanceUnits=yearUnits(year).filter(u=>day(u.entry.date)<=window.end&&u.entry.type!=='cierre');
  const balance=reportForUnits(data,balanceUnits,year).balanceSheet;
  const previousBalanceUnits=yearUnits(year-1).filter(u=>day(u.entry.date)<=previousWindow.end&&u.entry.type!=='cierre');
  const previousBalance=reportForUnits(data,previousBalanceUnits,year-1).balanceSheet;
  const hasOpening=balanceUnits.some(u=>u.entry.type==='apertura');
  const hasPrior=accepted.some(u=>day(u.entry.date)<`${year}-01-01`);
  const openingNotice=hasPrior&&!hasOpening?'Falta asiento de apertura: el balance muestra solo los movimientos del ejercicio.':!hasOpening?'Sin apertura registrada: verificar si la actividad comienza en este ejercicio.':null;
  const allInvoices=raw.invoices.filter(r=>!r.anulada), allExpenses=raw.expenses.filter(r=>!r.anulada&&!['rechazado','pendiente','en_revision'].includes(r.estado));
  const canonical=canonicalDocuments(allInvoices,allExpenses);
  const fxIssues=canonical.documents.filter(r=>String(r.moneda||r.currency||'EUR').toUpperCase()!=='EUR'&&!(Number(r.exchange_rate)>0));
  const documents=canonical.documents.filter(r=>!fxIssues.includes(r));
  const selectedDocs=documents.filter(r=>within(docDate(r),window.start,window.end));
  const management=managementReport(documents,window),managementPrevious=managementReport(documents,previousWindow);
  const bank=bankObservation(raw.bankAccounts,raw.bankTransactions,{now});
  const flows=bankFlows(bank,window);
  const bankRows=bank.rows.filter(r=>within(r.day,window.start,window.end));
  // Classification is confirmed only when a balanced committed journal gives the counterpart.
  // Unreconciled / mixed counterpart movements stay explicitly unclassified.
  const unitById=new Map(accepted.map(u=>[u.entry.id,u]));
  const flowRows=bankRows.map(r=>{
    const u=unitById.get(r.journal_entry_id||r.group_journal_entry_id);
    const codes=(u?.rows||[]).map(l=>String(l.accountCode||l.subcuenta||'')).filter(c=>!c.startsWith('57'));
    const classes=new Set(codes.map(c=>/^(10|11|12|13|17|18|50|51|52)/.test(c)?'Financiación':/^2/.test(c)?'Inversión':/^(40|41|43|44|46|47|6|7)/.test(c)?'Explotación':'Sin clasificar'));
    return {id:r.id,date:r.day,description:r.concepto,amount:r.signedAmount,accountId:r.bank_account_id,classification:classes.size===1?[...classes][0]:'Sin clasificar',journalId:u?.entry.id||null};
  });
  const cashflow={...flows,known:bank.activityKnown&&bank.connected>0,rows:flowRows,groups:['Explotación','Inversión','Financiación','Sin clasificar'].map(label=>({label,inflows:sum(flowRows.filter(r=>r.classification===label&&r.amount>0),r=>r.amount),outflows:sum(flowRows.filter(r=>r.classification===label&&r.amount<0),r=>-r.amount),net:sum(flowRows.filter(r=>r.classification===label),r=>r.amount)}))};
  if(!cashflow.known)for(const g of cashflow.groups){g.inflows=null;g.outflows=null;g.net=null;}
  const monthly=Array.from({length:lastMonth-firstMonth+1},(_,i)=>{
    const m=firstMonth+i,w=reportWindow(year,m,m),p=reportWindow(year-1,m,m);
    const pl=pnlFor(periodUnits(w),year),prev=pnlFor(periodUnits(p),year-1);
    return {month:w.start.slice(0,7),label:new Intl.DateTimeFormat('es-ES',{month:'short',timeZone:'UTC'}).format(new Date(w.start)),...pl,previousRevenue:prev.revenue,previousEbitda:prev.ebitda,previousKnown:prev.count>0,management:managementReport(documents,w),cash:bankFlows(bank,w)};
  });
  const segmentsMap=new Map();
  for(const u of currentUnits)for(const l of u.rows){if(!/^[67]/.test(l.accountCode||l.subcuenta||''))continue;const key=segmentOf(u.entry,l);if(!segmentsMap.has(key))segmentsMap.set(key,[]);segmentsMap.get(key).push({entry:u.entry,rows:[l]});}
  const segments=[...segmentsMap].map(([key,units])=>{const totals=new Map();for(const u of units)for(const l of u.rows){const code=String(l.accountCode||l.subcuenta);const a=totals.get(code)||{code,debit:0,credit:0};a.debit+=Number(l.debit||l.debeE||0);a.credit+=Number(l.credit||l.haberE||0);totals.set(code,a);}return {key,label:segmentLabel(key),...pnlFromAccounts([...totals.values()])};});
  const fiscal={taxCharged:sum(selectedDocs.filter(isIncome),r=>amount(r,r.source==='Invoice'?'cuota_iva':'cuota_impuesto')),taxSupported:sum(selectedDocs.filter(r=>!isIncome(r)),r=>amount(r,r.source==='Invoice'?'cuota_iva':'cuota_impuesto')),deductibleConfirmed:sum(selectedDocs.filter(r=>!isIncome(r)&&r.deductible_tax_amount!=null),r=>amount(r,'deductible_tax_amount')),deductibilityMissing:selectedDocs.filter(r=>!isIncome(r)&&r.deductible_tax_amount==null).length,nonDeductible:sum(selectedDocs.filter(r=>!isIncome(r)),r=>amount(r,'non_deductible_tax_amount')),retainedByClients:sum(selectedDocs.filter(isIncome),r=>amount(r,'importe_retencion')),withheldToPay:sum(selectedDocs.filter(r=>!isIncome(r)),r=>amount(r,'importe_retencion')),taxBalance:balance.accounts};
  delete fiscal.taxBalance;
  const profile=(raw.fiscalProfiles||[]).find(p=>p.active!==false&&(!p.fiscalYear||Number(p.fiscalYear)===year));
  fiscal.profile=profile?{entityType:profile.entityType,territory:profile.mainTerritory,authority:profile.taxAuthority,status:profile.profileStatus,indirectTax:profile.indirectTaxDefault,irpfEstimation:profile.irpfEstimation,repepStatus:profile.repepStatus,effectiveFrom:profile.effectiveFrom}:null;
  fiscal.activities=(raw.fiscalActivities||[]).filter(a=>a.active!==false&&(!a.startDate||a.startDate<=window.end)).map(a=>({name:a.name,iae:a.iaeCode||a.iaeActivityCode,regime:a.indirectTaxRegime,tax:a.indirectTax,deduction:a.deductionRight,prorata:a.proRataPercent}));
  fiscal.obligations=(raw.taxModels||[]).filter(m=>m.activo!==false).map(m=>({code:m.codigo,name:m.nombre,authority:m.administracion,frequency:m.periodicidad,validation:m.fuenteValidacion}));
  fiscal.periods=(raw.taxPeriods||[]).filter(p=>!p.fechaInicio||!p.fechaFin||!(p.fechaFin<window.start||p.fechaInicio>window.end)).map(p=>({code:p.modeloCodigo,period:p.periodo,status:p.estado,result:p.resultado,confirmed:['revisado','listo_presentar','presentado'].includes(p.estado)?p.importeConfirmado:null}));
  const currentRejected=rejected.filter(r=>within(r.date,`${year}-01-01`,window.end));
  const pending=data.entries.filter(e=>within(day(e.date),`${year}-01-01`,window.end)&&['pendiente_revision','borrador'].includes(e.status)).length;
  const journalRows=currentUnits.flatMap(u=>u.rows.filter(l=>segment==='all'||segmentOf(u.entry,l)===segment).map(l=>({id:l.id,entryId:u.entry.id,number:u.entry.entryNumber,date:day(u.entry.date),description:l.description||u.entry.description,account:String(l.accountCode||l.subcuenta),accountName:l.accountName||'',debit:money(l.debit||l.debeE),credit:money(l.credit||l.haberE),documentId:l.documentId||u.entry.documentId||'',segment:segmentLabel(segmentOf(u.entry,l))})));
  const balanceRows=balanceUnits.flatMap(u=>u.rows.map(l=>({entryId:u.entry.id,number:u.entry.entryNumber,date:day(u.entry.date),description:l.description||u.entry.description,account:String(l.accountCode||l.subcuenta),accountName:l.accountName||'',debit:money(l.debit||l.debeE),credit:money(l.credit||l.haberE)})));
  const currentDocs=selectedDocs.map(r=>({id:r.id,source:r.source,date:docDate(r),number:r.numero_factura||r.document_number||'',party:r.source==='Invoice'?(isIncome(r)?r.cliente_nombre:r.proveedor_nombre):r.proveedor_cliente,description:r.concepto||'',direction:isIncome(r)?'Ingreso':'Gasto',base:amount(r,'base_imponible'),tax:amount(r,r.source==='Invoice'?'cuota_iva':'cuota_impuesto'),retention:amount(r,'importe_retencion'),total:amount(r,r.source==='Invoice'?'total_factura':'total'),journalId:r.linked_journal_entry_id||null}));
  const currentAssets=sum(balance.assets.filter(a=>a.section.key!=='activo_no_corriente'),a=>a.amount), currentLiabilities=sum(balance.liabilities.filter(a=>a.section.key!=='pasivo_no_corriente'),a=>a.amount);
  const financialDebt=sum(balance.liabilities.filter(a=>/^(17|50|51|52|57)/.test(a.code)),a=>a.amount),bookCash=sum(balance.assets.filter(a=>a.code.startsWith('57')),a=>a.amount);
  return {success:true,version:'multinational-report-v1',companyId:raw.company.id,companyName:raw.company.razon_social||raw.company.nombre_comercial||'Empresa',generatedAt:new Date(now).toISOString(),currency:'EUR',window,previousWindow,segment,
    pnl:{...pnl,available:currentUnits.length>0,previous:{...previous,available:previousUnits.length>0},revenueChange:delta(pnl.revenue,previous.revenue,previousUnits.length>0),ebitdaChange:delta(pnl.ebitda,previous.ebitda,previousUnits.length>0)},
    balance:{...balance,available:balanceUnits.length>0,asOf:window.end,hasOpening,openingNotice,scope:'company',rows:balanceRows,previous:{...previousBalance,available:previousBalanceUnits.length>0,asOf:previousWindow.end,hasOpening:previousBalanceUnits.some(u=>u.entry.type==='apertura')}},
    management:{...management,previous:managementPrevious},monthly,segments,
    cashflow,bank:{cash:bank.cash,known:bank.bankKnown,connected:bank.connected,nonEuroAccounts:bank.nonEuroAccounts,reasons:[...bank.reasons,...bank.activityReasons],duplicateAccounts:bank.duplicateAccounts,duplicateTransactions:bank.duplicateTransactions,asOf:today},
    workingCapital:{...aging(documents,today),currentAssets,currentLiabilities,netWorkingCapital:money(currentAssets-currentLiabilities),currentRatio:ratio(currentAssets,currentLiabilities),financialDebt,bookCash,netFinancialDebt:money(financialDebt-bookCash),debtToEquity:ratio(balance.totalLiabilities,balance.totalEquity)},
    customers:concentration(selectedDocs,true),suppliers:concentration(selectedDocs,false),fiscal,
    sources:{journal:journalRows,documents:currentDocs,excluded:currentRejected},
    quality:{confirmed:currentUnits.length,pending,excluded:currentRejected.length,openingNotice,balanceDifference:balance.difference,fxExcluded:fxIssues.filter(r=>within(docDate(r),window.start,window.end)).length,suppressedDuplicates:canonical.duplicateLinks.length,duplicateReview:canonical.reviewCandidates.length,documentCount:selectedDocs.length,linkedDocuments:selectedDocs.filter(r=>r.linked_journal_entry_id&&unitById.has(r.linked_journal_entry_id)).length,unresolvedLines:data.unresolvedLines,framework:data.configuration?.accountingFramework||'pgc_pymes',frameworkReview:data.configuration?.frameworkReviewStatus||'pendiente_asesor'},
    methodology:{ebitda:'Resultado neto + impuesto sobre beneficios (630/633/638) − resultado financiero (76 y 796–799 − 66 y 696–699) + amortización (68). Incluye deterioros y otros resultados; sin ajustes no registrados.',balance:'Saldos desde el inicio del ejercicio hasta el último día del período. Incluye apertura y regularización; excluye cierre. No arrastra saldos de años previos sin apertura.',pnl:'Asientos confirmados, cuadrados y con operación completada. Excluye apertura, regularización y cierre. Período por fecha de asiento.',cashflow:'Flujos bancarios EUR observados. Excluye pendientes y transferencias internas identificadas. Clasifica solo con contrapartida contable confirmada; no equivale al EFE legal ni acredita que el histórico esté completo.',management:'Bases de facturas y registros manuales no duplicados, más impuesto no deducible expresamente registrado en costes. Es una vista documental; no se suma a la contabilidad.',aging:'Pendientes actuales de las facturas emitidas hasta hoy. No reconstruye la deuda histórica del cierre seleccionado. Abonos negativos pendientes se revisan aparte.',segments:'Centros de coste, proyectos y departamentos presentes en las líneas/asientos. Sin asignación se muestra Sin asignar. El filtro afecta únicamente a P&L y sus KPIs; balance, banco y fiscal son de toda la empresa.',fiscal:'Cuotas y retenciones registradas en documentos. La deducción solo suma cuotas expresamente informadas. No calcula una autoliquidación ni sustituye A3.',scope:'Una empresa por informe. Nombre comercial del módulo: Multinational Report. No agrega otras empresas, no consolida grupos ni convierte moneda sin tipo de cambio registrado.',references:[{label:'Plan General de Contabilidad · BOE',url:'https://www.boe.es/eli/es/rd/2007/11/16/1514/con'},{label:'PGC Pymes · BOE',url:'https://www.boe.es/eli/es/rd/2007/11/16/1515/con'},{label:'Medidas alternativas de rendimiento · ESMA',url:'https://www.esma.europa.eu/document/esma-guidelines-alternative-performance-measures'}]}};
}
