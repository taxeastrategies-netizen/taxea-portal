import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as esbuild from 'esbuild';
import {MOBILE_TABS,mobileTabId,parentRoute,internalHref,pullGesture} from '../src/lib/mobileNavigation.mjs';

let cases=0;
const check=(name,fn)=>{fn();cases++;};
check('five tabs',()=>assert.equal(new Set(MOBILE_TABS.map(t=>t.id)).size,5));
for(const tab of MOBILE_TABS)check(tab.id,()=>assert.equal(mobileTabId(tab.to),tab.id));
for(const route of ['/lector-gastos','/lector-ingresos','/tax-accounting/lector-ingresos'])check(route,()=>assert.equal(mobileTabId(route),'scan'));
check('transient routes are not cached as invoices',()=>assert.equal(mobileTabId('/finance/bancos'),null));
check('safe external fallback',()=>assert.equal(internalHref({pathname:'//outside.invalid'}),'/'));
check('safe slash fallback',()=>assert.equal(internalHref({pathname:'/\\outside'}),'/'));
check('preserves filters',()=>assert.equal(internalHref({pathname:'/ajustes',search:'?tab=seguridad',hash:'#cuenta'}),'/ajustes?tab=seguridad#cuenta'));
check('back tool',()=>assert.equal(parentRoute('/herramientas/renombrador'),'/herramientas'));
check('back department',()=>assert.equal(parentRoute('/finance/tesoreria'),'/finance/dashboard'));
check('back dashboard',()=>assert.equal(parentRoute('/finance/dashboard'),'/'));
for(const args of [
  [{x:0,y:100},0,50,{}], [{x:0,y:0},100,20,{}],
  [{x:0,y:0},0,150,{nestedScroll:true}], [{x:0,y:0},0,150,{touches:2}],
])check('gesture cancellation',()=>assert.equal(pullGesture(...args).cancelled,true));
check('small pull does not refresh',()=>assert.equal(pullGesture({x:0,y:0},0,80).armed,false));
check('intentional pull refresh',()=>assert.equal(pullGesture({x:0,y:0},0,140).armed,true));
check('bounded resistance',()=>assert.equal(pullGesture({x:0,y:0},0,2000).distance,88));

let handler,identity=null,reads=0,creates=0,updates=0,accountExists=true,providerFails=false;
const rows=[];
const client={auth:{me:async()=>identity},get asServiceRole(){assert.ok(identity?.id,'No privileged access before auth');return {entities:{
  AccountDeletionRequest:{
    filter:async(q,_sort,limit,skip)=>{reads++;return structuredClone(rows.filter(r=>Object.entries(q).every(([k,v])=>r[k]===v)).slice(skip,skip+limit));},
    get:async id=>structuredClone(rows.find(r=>r.id===id)),
    create:async data=>{creates++;const r={...data,id:'request-'+creates};rows.push(r);return structuredClone(r);},
    update:async(id,data)=>{updates++;const r=rows.find(r=>r.id===id);Object.assign(r,data);return structuredClone(r);},
  },
  User:{get:async()=>{if(providerFails)throw new Error('provider private error');if(accountExists)return {id:'qa',is_deleted:true};throw Object.assign(new Error('Not found'),{status:404});}},
  get Invoice(){throw new Error('Deletion workflow must not write invoices');},
  get JournalEntry(){throw new Error('Deletion workflow must not write accounting');},
}};}};
const build=await esbuild.build({entryPoints:['base44/functions/accountDeletionOperations/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
  name:'mock-only',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__client;'}));},
}]});
const quiet={log(){},warn(){},error(){}};
vm.runInContext(build.outputFiles[0].text,vm.createContext({__client:client,console:quiet,Response,Request,Date,crypto:webcrypto,Deno:{serve:fn=>{handler=fn;}},fetch:()=>{throw new Error('No external calls permitted in this test');}}));
async function call(body,method='POST'){const response=await handler(new Request('https://qa.invalid/privacy',{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));cases++;return {status:response.status,body:await response.json()};}
assert.equal((await call({},'GET')).status,405);
assert.equal((await call({action:'request',confirmation:'ELIMINAR'})).status,401);assert.equal(reads,0);
identity={id:'qa-user',email:'qa@invalid.test',role:'user'};
assert.equal((await call({action:'request',confirmation:'delete'})).status,422);assert.equal(creates,0);
const receipt=(await call({action:'request',confirmation:'ELIMINAR',userId:'foreign',email:'victim@invalid.test'})).body.request;
assert.equal(rows[0].user_id,identity.id);assert.equal(rows[0].email,identity.email);
assert.ok(Date.parse(receipt.dueAt)>Date.parse(receipt.requestedAt));
assert.equal((await call({action:'request',confirmation:'ELIMINAR'})).body.request.id,receipt.id);assert.equal(creates,1);
const own=(await call({action:'status',userId:'foreign'})).body.request;assert.equal(own.id,receipt.id);assert.equal(own.email,undefined);
for(const role of ['user','advisor','asesor']){identity={...identity,role};for(const action of ['admin_list','admin_review','admin_complete'])assert.equal((await call({action,requestId:receipt.id})).status,403);}
identity={id:'other',email:'other@invalid.test',role:'user'};assert.equal((await call({action:'status',userId:'qa-user'})).body.request,null);
identity={id:'admin',email:'admin@invalid.test',role:'admin'};
assert.equal((await call({action:'admin_list'})).body.requests.length,1);
assert.equal((await call({action:'admin_review'})).status,422);
assert.equal((await call({action:'admin_review',requestId:'missing'})).status,404);
assert.equal((await call({action:'admin_review',requestId:receipt.id})).status,200);
assert.equal(rows[0].status,'reviewing');
const complete={action:'admin_complete',requestId:receipt.id,confirmation:'CERRAR ELIMINACIÓN',confirmations:{dataCleanup:true,oauthCleanup:true,billingReview:true,confirmationSent:true},retentionNotes:'Sin documentos contables reales: usuario ficticio de prueba.',evidence:'Prueba con dobles: cuenta ausente y confirmación simulada.'};
assert.equal((await call({...complete,confirmations:{...complete.confirmations,dataCleanup:false}})).status,422);
assert.equal((await call({...complete,evidence:'no'})).status,422);
assert.equal((await call(complete)).status,409,'A soft deleted account still exists');
assert.equal(rows[0].status,'reviewing');
providerFails=true;const failed=await call(complete);assert.equal(failed.status,500);assert.ok(!JSON.stringify(failed).includes('provider private'));providerFails=false;
accountExists=false;assert.equal((await call(complete)).status,200);assert.equal(rows[0].status,'completed');
const previous=updates;assert.equal((await call(complete)).body.alreadyCompleted,true);assert.equal(updates,previous);
const schema=JSON.parse(fs.readFileSync('base44/entities/AccountDeletionRequest.jsonc','utf8'));
for(const permission of ['create','read','update','delete'])check('direct RLS '+permission,()=>assert.equal(schema.rls[permission],false));
const app=fs.readFileSync('src/App.jsx','utf8'),layout=fs.readFileSync('src/components/layout/AppLayout.jsx','utf8'),refresh=fs.readFileSync('src/components/layout/usePullToRefresh.jsx','utf8'),security=fs.readFileSync('src/components/ajustes/TabSeguridad.jsx','utf8');
check('system appearance',()=>assert.match(app,/defaultTheme="system" enableSystem enableColorScheme/));
check('public deletion instructions',()=>assert.match(app,/path="\/eliminar-cuenta"/));
check('refresh does not write company context',()=>assert.ok(!refresh.includes('refreshCompany')));
check('refresh does not reload or mutate',()=>assert.ok(!/location\.reload|\.mutate\(|functions\.invoke/.test(refresh)));
check('cache scope',()=>assert.match(layout,/props\.user\?\.id[\s\S]*props\.company\?\.id[\s\S]*MobileNavigationProvider key=\{scope\}/));
check('password current required',()=>assert.match(security,/auth.changePassword\(\{userId:user.id,currentPassword:pwForm.current,newPassword:pwForm.nueva\}\)/));
console.log(JSON.stringify({ok:true,cases,backendCallsAreMocked:true,realAccountsDeleted:0,externalCalls:0},null,2));
