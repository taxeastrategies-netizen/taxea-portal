import {useEffect,useState} from 'react';
import {createClient} from '@base44/sdk';
import {base44} from '@/api/base44Client';
const QA_EMAIL='taxeastrategies+qa-recc-2026@gmail.com';
const APP_ID='6a00fec50cc522a74ddde4b2';
const MARKER='TAXEA_QA_SECURITY_20261023_SYNTHETIC_NOT_CUSTOMER_DATA';
const PRIVATE_URI='mp/private/'+APP_ID+'/df4d92bc3_synthetic-storage-marker.txt';
export default function SecurityNativeStorageQA(){
 const [identity,setIdentity]=useState(null),[ready,setReady]=useState(false),[running,setRunning]=useState(false),[result,setResult]=useState(null);
 useEffect(()=>{base44.auth.me().then(user=>{if(user?.email===QA_EMAIL&&user?.role==='user')setIdentity(user);}).finally(()=>setReady(true));},[]);
 const run=async()=>{
  setRunning(true);
  let native;
  try{
   const expected=await base44.auth.me();
   if(expected.email!==QA_EMAIL||expected.role!=='user')throw new Error('Solo usuario ficticio.');
   native=createClient({appId:APP_ID,serverUrl:'',appBaseUrl:window.location.origin});
   const actual=await native.auth.me();
   if(actual.id!==expected.id||actual.role!=='user')throw new Error('El cliente nativo no acredita la misma identidad normal.');
   let signStatus=200,downloadStatus=null,markerReadable=false;
   try{
    const signed=await native.integrations.Core.CreateFileSignedUrl({file_uri:PRIVATE_URI,expires_in:60});
    const url=new URL(signed?.signed_url||'');
    if(url.protocol!=='https:'||url.hostname!=='media.base44.com'||!url.pathname.endsWith('/'+APP_ID+'/df4d92bc3_synthetic-storage-marker.txt'))throw new Error('Destino de prueba no válido.');
    const response=await fetch(signed.signed_url,{credentials:'omit',signal:AbortSignal.timeout(10000)});
    downloadStatus=response.status;
    markerReadable=(await response.text()).trim()===MARKER;
   }catch(error){
    signStatus=error?.status||error?.response?.status||0;
   }
   setResult({syntheticOnly:true,nativeIdentityMatches:true,nativeRole:actual.role,signStatus,downloadStatus,markerReadable,privateSigningDenied:[401,403].includes(signStatus),customerReads:0,customerWrites:0});
  }catch(error){setResult({syntheticOnly:true,error:String(error?.message||'QA inconclusa'),customerReads:0,customerWrites:0});}
  finally{native?.cleanup();setRunning(false);}
 };
 if(!ready)return <p>Comprobando cuenta ficticia...</p>;
 if(!identity)return <p>Prueba no disponible.</p>;
 return <main style={{padding:24}}><h1>Prueba nativa de archivos privados — QA</h1><p>Se comprueba exclusivamente una muestra sintética creada por el propietario. No se consultan documentos de clientes.</p><button disabled={running||!!result} onClick={run}>{running?'Comprobando...':'Probar almacenamiento con usuario normal'}</button><pre>{result?JSON.stringify(result,null,2):'Sin ejecutar'}</pre></main>;
}
