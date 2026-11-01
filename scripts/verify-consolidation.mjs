import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as esbuild from 'esbuild';
import {reviewDevelopmentAudit} from './review-development-audit.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'taxea-consolidation-'));
const summary={startedAt:new Date().toISOString(),root,evidence,steps:[],tests:[],productionDataWrites:0};
function command(name,exe,args,options={}){
  const begin=Date.now(),result=spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout:options.timeout||120000,maxBuffer:6000000,env:options.env||process.env,windowsHide:true});
  fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify({code:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr}));
  const state={name,code:result.status,ms:Date.now()-begin};summary.steps.push(state);
  if(result.status!==0&&!options.allowFailure)throw Error(name+' failed; see '+path.join(evidence,name+'.json'));
  return result;
}
try{
  command('types','npm',['run','typecheck']);
  command('lint','npm',['run','lint']);
  const functions=fs.readdirSync(path.join(root,'base44/functions'),{withFileTypes:true}).filter(row=>row.isDirectory()&&fs.existsSync(path.join(root,'base44/functions',row.name,'entry.ts'))).map(row=>row.name).sort();
  for(const name of functions)await esbuild.build({entryPoints:[path.join(root,'base44/functions',name,'entry.ts')],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',external:['npm:*','https://*','http://*']});
  summary.backend={parsed:functions.length,allLocalImportsResolved:true,remoteImportsNotExecuted:true};
  const names=fs.readdirSync(path.join(root,'scripts')).filter(name=>/^test-.*\.mjs$/.test(name)).sort();
  const testEnv={...process.env,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --import='+path.join(root,'scripts/offline-test-guard.mjs')).trim(),TAXEA_FIXTURE_MATRIX_DIR:'',TAXEA_MODEL202_FIXTURE_PATH:''};
  // Isolated copies can read the original repository's immutable migration proofs.
  // This is not a checkout or a write to its working tree.
  if(process.env.TAXEA_TEST_GIT_ROOT){
    const history=spawnSync('git',['-C',process.env.TAXEA_TEST_GIT_ROOT,'rev-parse','--absolute-git-dir'],{encoding:'utf8',windowsHide:true});
    if(history.status!==0)throw Error('Historical proof repository is unavailable');
    testEnv.GIT_DIR=history.stdout.trim();testEnv.GIT_WORK_TREE=process.env.TAXEA_TEST_GIT_ROOT;
  }
  for(const name of names){
    const result=command(name,process.execPath,[path.join(root,'scripts',name)],{env:testEnv,timeout:60000,allowFailure:true});
    summary.tests.push({name,code:result.status});
  }
  if(summary.tests.some(test=>test.code!==0))throw Error('Offline regression failures: '+summary.tests.filter(test=>test.code!==0).map(test=>test.name).join(', '));
  const production=command('audit-production','npm',['audit','--omit=dev','--json'],{allowFailure:true});
  const prod=JSON.parse(production.stdout);
  if(production.status!==0||prod.metadata?.vulnerabilities?.total!==0)throw Error('Production dependency audit is not clean');
  const development=command('audit-development','npm',['audit','--json'],{allowFailure:true});
  summary.developmentAudit=reviewDevelopmentAudit(JSON.parse(development.stdout),root);
  const before=Date.now();command('build','npm',['run','build']);
  const index=path.join(root,'dist/index.html');
  if(!fs.existsSync(index)||fs.statSync(index).mtimeMs<before)throw Error('Build did not create a fresh index');
  summary.buildIndexFresh=true;
  summary.ok=true;
}catch(error){summary.ok=false;summary.error=error.message;process.exitCode=1;}
summary.finishedAt=new Date().toISOString();
fs.writeFileSync(path.join(evidence,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({ok:summary.ok,tests:summary.tests.length,passed:summary.tests.filter(test=>test.code===0).length,backend:summary.backend,developmentAudit:summary.developmentAudit,error:summary.error,evidence},null,2));
