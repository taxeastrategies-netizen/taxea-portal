// Temporary, identity-restricted QA surface. No role changes or customer reads.
import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
const QA_EMAIL='taxeastrategies+qa-recc-2026@gmail.com';
const UNASSIGNED='000000000000000000000000';
const companyOf=user=>user?.data?.company_id??user?.company_id??null;
export default function SecurityCompanyBoundaryQA(){
 const [identity,setIdentity]=useState(null),[ready,setReady]=useState(false),[running,setRunning]=useState(false),[result,setResult]=useState(null);
 useEffect(()=>{base44.auth.me().then(user=>{if(user?.email===QA_EMAIL&&user?.role==='user')setIdentity(user);}).finally(()=>setReady(true));},[]);
 const run=async()=>{
  setRunning(true);
  const checks=[];
  try{
   const user=await base44.auth.me();
   if(user?.email!==QA_EMAIL||user?.role!=='user')throw new Error('Solo la identidad ficticia de QA.');
   const original=companyOf(user);
   if(!original||original===UNASSIGNED)throw new Error('La identidad de QA debe conservar su empresa de prueba.');
   for(const method of ['auth.updateMe','entities.User.update']){
    let status=200;
    try{
     if(method==='auth.updateMe')await base44.auth.updateMe({company_id:UNASSIGNED});
     else await base44.entities.User.update(user.id,{company_id:UNASSIGNED});
    }catch(error){status=error?.status||error?.response?.status||0;}
    const after=await base44.auth.me();
    const companyUnchanged=companyOf(after)===original;
    let restored=null;
    if(!companyUnchanged){
     const response=await base44.functions.invoke('companyContextOperations',{action:'set_active_company',companyId:original});
     restored=response?.data?.ok===true&&companyOf(await base44.auth.me())===original;
    }
    checks.push({method,status,companyUnchanged,restored});
    if(!companyUnchanged&&!restored)break;
   }
   setResult({qaOnly:true,checks,allProtected:checks.length===2&&checks.every(row=>row.companyUnchanged),roleChanges:0,customerReads:0});
  }catch(error){setResult({qaOnly:true,error:String(error?.message||'QA inconclusa'),checks});}
  finally{setRunning(false);}
 };
 if(!ready)return <p>Comprobando identidad ficticia...</p>;
 if(!identity)return <p>Prueba no disponible para esta identidad.</p>;
 return <main style={{padding:24}}><h1>Prueba aislada de empresa — QA</h1><p>Solo cuenta ficticia. Se prueba una empresa inexistente, nunca la de otro cliente. No se modifican roles.</p><button disabled={running||!!result} onClick={run}>{running?'Comprobando...':'Probar bloqueo de empresa (solo QA)'}</button><pre data-testid="security-qa-result">{result?JSON.stringify(result,null,2):'Sin ejecutar'}</pre></main>;
}
