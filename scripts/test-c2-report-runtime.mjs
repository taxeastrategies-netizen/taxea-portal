import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const names=['BoardReport','InvestorReport','BankReport','ExecutiveCommentary','FinancialIntelligenceAI','CompanyScoring','MnAAnalytics','ExcelExport','ReportingCenter'];
const result=await build({stdin:{contents:names.map(name=>`export {default as ${name}} from './src/components/reporting/${name}.jsx';`).join('\n'),resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',alias:{'@':process.cwd()+'/src'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'report-runtime-no-services',setup(b){
 b.onResolve({filter:/^react$/},args=>args.importer.includes('/src/components/reporting/')?{path:'react-fixture',namespace:'fixture'}:null);
 b.onResolve({filter:/^\.\/\w+$/},args=>args.importer.endsWith('/ReportingCenter.jsx')?{path:args.path.slice(2),namespace:'report-child'}:null);
 b.onLoad({filter:/.*/,namespace:'report-child'},({path})=>({loader:'js',contents:`export default function ${path}(){return null;}`}));
 b.onResolve({filter:/^react-router-dom$/},args=>args.importer.endsWith('/ReportingCenter.jsx')?{path:'outlet',namespace:'fixture'}:null);
 b.onResolve({filter:/^@\/hooks\/useFinancialData$/},()=>({path:'financial-data',namespace:'fixture'}));
 b.onResolve({filter:/^@\/hooks\/useFinanceReporting$/},()=>({path:'finance-query',namespace:'fixture'}));
 b.onResolve({filter:/base44Client$/},()=>({path:'sdk',namespace:'fixture'}));
 b.onResolve({filter:/^framer-motion$/},()=>({path:'motion',namespace:'fixture'}));
 b.onResolve({filter:/^xlsx$/},()=>({path:'xlsx',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:({
  'react-fixture':`export const useMemo=fn=>fn();export const useEffect=()=>{};export const useRef=value=>({current:value});export function useState(initial){const i=globalThis.__index++;if(!(i in globalThis.__states))globalThis.__states[i]=typeof initial==='function'?initial():initial;return [globalThis.__states[i],next=>{globalThis.__states[i]=typeof next==='function'?next(globalThis.__states[i]):next;}];}`,
  outlet:`export const useOutletContext=()=>({company:globalThis.__company});`,
  'financial-data':`export const useFinancialData=()=>globalThis.__financialData;`,
  'finance-query':`export const useFinanceObligations=()=>globalThis.__calendar;export const useFinancePeriod=()=>globalThis.__accounting;`,
  sdk:`export const base44={controlledCore:{async InvokeLLM(){globalThis.__mockCalls++;throw Error('synthetic unavailable service');}}};`,
  motion:`export const motion=new Proxy({},{get:(_,name)=>name});`,
  xlsx:`export const utils={book_new:()=>({sheets:[]}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(book,sheet,name)=>book.sheets.push({name,...sheet})};export const writeFile=(book,name)=>{if(globalThis.__exportFails)throw Error('synthetic download failure');globalThis.__exported={book,name};};`
 })[path]}));
}}]});
const context=vm.createContext({module:{exports:{}},console,Intl,Date,setTimeout:()=>0,clearTimeout:()=>{},__states:[],__index:0,__mockCalls:0,__exported:null,__exportFails:false});
vm.runInContext(result.outputFiles[0].text,context);
const components=context.module.exports;
const financials={ingresos:100,gastoTotal:25,beneficio:75,margen:75,margenNeto:75,ebitda:75,deudaTotal:0,interesesAnuales:0,cuotasMensuales:0,cashTotal:0,burnRate:10,runway:0,dso:0,dpo:0,workingCapital:0,cobrosPendientes:0,pagosPendientes:0,bankKnown:true,accountingKnown:true,accountingProvisional:false,cashHistorySufficient:true};
const props={financials,company:{id:'synthetic-only'},invoices:[],expenses:[],debts:[],bankAccounts:[],transactions:[],monthlyLedger:[{month:'2026-10',income:100,expenses:25,result:75,includedEntries:1}]};
const render=(name,extra={})=>{context.__index=0;return components[name]({...props,...extra});};
const walk=node=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk):[node,...walk(node.props?.children)];
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
for(const [name,action] of Object.entries({BoardReport:'generateInsights',InvestorReport:'generateMemo',BankReport:'generateAnalysis',ExecutiveCommentary:'generate',FinancialIntelligenceAI:'analyze',CompanyScoring:'generateAI',MnAAnalytics:'generateAnalysis'})){
 context.__states=[];
 const view=render(name);const button=walk(view).find(node=>node.props?.onClick?.name===action);
 check(button,'real '+name+' generation button found');await button.props.onClick();
 const after=render(name),retry=walk(after).find(node=>node.props?.onClick?.name===action);
 check(retry.props.disabled===false,name+' releases loading after rejection');
 check(walk(after).some(node=>node.props?.role==='alert'),name+' exposes recoverable error');
}
context.__states=[];
const board=render('BoardReport',{invoices:[{tipo:'emitida',fecha_emision:'2026-10-12',total_factura:9999}]});
const chart=walk(board).find(node=>Array.isArray(node.props?.data)&&node.props.data[0]?.mes);
check(chart.props.data.length===1&&chart.props.data[0].ingresos===100&&chart.props.data[0].resultado===75,'Board chart uses admitted ledger month, never invoice gross difference');
check(!walk(board).some(node=>node.props?.dataKey==='ebitda'),'document chart cannot claim EBITDA');
context.__states=[];
const exportProps={transactions:Array.from({length:501},(_,i)=>({fecha_operacion:'2026-10-12',concepto:'synthetic '+i,importe:1})),debts:[{nombre:'unknown',capital_pendiente:null,tin:null,cuota:null},{nombre:'zero',capital_pendiente:0,tin:0,cuota:0}]};
render('ExcelExport',exportProps);context.__states[0]=['transactions','debt'];
await walk(render('ExcelExport',exportProps)).find(node=>node.props?.onClick?.name==='exportExcel').props.onClick();
const sheets=context.__exported.book.sheets;
check(sheets.find(sheet=>sheet.name==='Bank Transactions').rows.length===502,'export includes all 501 loaded bank movements plus header');
const debtRows=sheets.find(sheet=>sheet.name==='Debt Schedule').rows;
check(debtRows[1].slice(4,7).every(value=>value==='No verificable'),'missing debt fields exported as unknown');
check(debtRows[2].slice(4,7).every(value=>value===0),'actual debt zeros preserved');
context.__exportFails=true;
await walk(render('ExcelExport',exportProps)).find(node=>node.props?.onClick?.name==='exportExcel').props.onClick();
const failedExport=walk(render('ExcelExport',exportProps));
check(failedExport.some(node=>node.props?.role==='alert'),'failed file generation has an error');
check(failedExport.find(node=>node.props?.onClick?.name==='exportExcel').props.disabled===false,'failed file generation releases loading');
check(context.__mockCalls===7,'all seven failures were synthetic; no real AI request');
context.__company={id:'synthetic-company-b'};
context.__financialData={invoices:[],expenses:[],bankAccounts:[],bankTransactions:[],treasury:{},loading:false,error:'',treasuryError:'',refresh:()=>{}};
context.__calendar={data:{rows:[]},isLoading:false,isError:false};
context.__accounting={data:null,isLoading:false,isError:false};
const center=(tab='dashboard',loaded='synthetic-company-b')=>{context.__states=[tab,loaded,[{estado:'activo',capital_pendiente:987654}],false,''];return render('ReportingCenter');};
const switched=walk(center('dashboard','synthetic-company-a'));
check(switched.length===1&&switched[0].props.role==='status','reporting waits for the new company before rendering previous auxiliary figures');
check(!JSON.stringify(switched).includes('987654'),'previous-company debt never enters returned UI');
const partial=walk(center());
check(partial.some(node=>node.type?.name==='ReportingDashboard'),'missing bank does not block reading available accounting data');
check(partial.some(node=>node.props?.role==='alert'),'partial report identifies missing source coverage');
const blocked=walk(center('share'));
check(!blocked.some(node=>node.type?.name==='ShareDashboard'),'incomplete report cannot render sharing controls');
check(blocked.some(node=>node.props?.role==='status'),'blocked sharing explains how to complete sources');
context.__financialData.bankAccounts=[{id:'synthetic-bank',moneda:'EUR',activa:true,estado_conexion:'conectado',saldo_disponible:0,fecha_ultima_sync:new Date().toISOString()}];
context.__accounting.data={window:{period:'ytd',start:'2026-01-01',end:'2026-11-01',days:305,previous:{start:'2025-03-02',end:'2025-12-31'},timeZone:'Europe/Madrid'},current:{year:2026,includedEntries:1,excludedEntries:0,pendingEntriesInYear:0,frameworkReviewStatus:'validated',profitAndLoss:{totalIncome:100,totalExpenses:25,result:75,income:[{code:'700',amount:100}],expenses:[{code:'600',amount:25}]}}};
const ready=walk(center('share'));
check(ready.some(node=>node.type?.name==='ShareDashboard'),'completed sources restore existing sharing controls without creating a share');
console.log(JSON.stringify({ok:true,checks,actualReportHandlers:true,externalCalls:0,customerWrites:0,filesWritten:0}));
