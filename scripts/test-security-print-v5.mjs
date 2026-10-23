import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
const root='src/components/finance/analysis/v5/';
async function moduleAt(file){
 const built=await build({entryPoints:[root+file],bundle:true,write:false,format:'esm',platform:'node'});
 return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
}
const {buildPDFHTML}=await moduleAt('ReportPDFExport.jsx');
const {calcularMetricas}=await moduleAt('ReportEngine.jsx');
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
let lastHtml='';
for(const payload of [
 '<script>window.opener.__qa=1</script>',
 '"><img src=x onerror="alert(1)">',
 '</title><svg onload="alert(1)">',
 '<iframe src="https://untrusted.invalid"></iframe>',
 '& < > " \''
]){
 const imp={empresa_nombre:payload,periodo_fin:'2026-12-31',origen:payload,nombre_archivo:payload,metricas_calculadas:{
  balance:{totalActivo:100,patrimonioNeto:70,activoCorriente:60,pasivoCorriente:20,pasivoNoCorriente:10},
  pyg:{ingresos:100,gastos:80,resultado:20,ebitda:25,amortizacion:5},
  cuentas:[{cuenta:'47200001',descripcion:payload,masa:'activo_corriente',importe_actual:20}]
 }};
 const calc=calcularMetricas(imp),ai={diagnostico_ejecutivo:payload,analisis_fiscal:payload,conclusion_final:payload};
 const before=JSON.stringify({imp,calc,ai});
 const html=buildPDFHTML(calc,[{nivel:'baja',titulo:payload,desc:payload,area:payload,accion:payload}],{inmediata:[payload]},ai,imp);
 check(!html.includes(payload),'Untrusted text escaped');
 check(!/<script\b|<svg\b|<iframe\b|onerror\s*=\s*"/i.test(html),'No executable input element');
 check(html.includes("script-src 'none'")&&html.includes('http-equiv="Content-Security-Policy"'),'CSP remains present');
 check((html.match(/class="page"/g)||[]).length===14,'All fourteen pages preserved');
 check(JSON.stringify({imp,calc,ai})===before,'Financial input is not mutated');
 lastHtml=html;
}
const source=await readFile(root+'PremiumReportViewerV5.jsx','utf8');
const body=source.match(/  const exportPDF = \(\) => \{[\s\S]*?\n  \};/)?.[0];
check(!!body,'Synchronous click handler preserves popup user activation');
for(const scenario of ['allowed','blocked','write-failure']){
 let busy=null,error='',popupClosed=false,wrote=false,printed=false;
 const callbacks=[];
 const preview={opener:{sensitiveApp:true},document:{write(html){if(scenario==='write-failure')throw new Error('QA');check(preview.opener===null,'Opener severed before document write');assert.equal(html,lastHtml);wrote=true;},close(){}},focus(){},print(){printed=true;},close(){popupClosed=true;},closed:false};
 const context=vm.createContext({setExportingPDF:value=>busy=value,setExportError:value=>error=value,
  buildPDFHTML:()=>lastHtml,calc:{},alertas:[],recs:{},aiContent:{},imp:{},
  window:{open:()=>scenario==='blocked'?null:preview},setTimeout:callback=>callbacks.push(callback)});
 vm.runInContext(body+'\nexportPDF();',context);
 check(busy===false,'Export spinner always settles');
 if(scenario==='allowed'){check(wrote&&!error,'Valid report preview writes successfully');callbacks.forEach(callback=>callback());check(printed,'Printing scheduled');}
 if(scenario==='blocked')check(!!error&&!wrote,'Blocked popup is explained without throwing');
 if(scenario==='write-failure')check(!!error&&popupClosed,'Broken preview is closed and explained');
}
console.log(JSON.stringify({ok:true,checks,actualFourteenPageBuilder:true,callbackVm:true,externalCalls:0,customerWrites:0}));
