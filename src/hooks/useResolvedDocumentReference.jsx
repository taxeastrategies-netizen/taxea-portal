import{useEffect,useState}from'react';
import{useOutletContext}from'react-router-dom';
import{resolveDocumentReference}from'@/lib/privateDocuments';
import{normalizeLegacyDocumentReference}from'@/lib/nativeDocumentReference.mjs';
import{safeDisplayDocumentReference}from'@/lib/legacyReferenceClient.mjs';
export function useResolvedDocumentReference(reference,{companyId,contextKind,contextId}={}){
 const outlet=useOutletContext()||{},scope={companyId:companyId||(!contextKind?outlet.company?.id:''),contextKind,contextId},key=JSON.stringify(scope),legacy=!!normalizeLegacyDocumentReference(reference),safe=safeDisplayDocumentReference(reference),invalid=!!reference&&!safe;
 const[attempt,setAttempt]=useState(0),[state,setState]=useState({input:null,key:'',uri:'',error:''});
 useEffect(()=>{let live=true;if(!legacy){setState({input:reference,key,uri:reference,error:''});return()=>{live=false;};}setState({input:reference,key,uri:'',error:''});resolveDocumentReference(reference,{...scope,force:attempt>0}).then(uri=>{if(live)setState({input:reference,key,uri,error:''});}).catch(()=>{if(live)setState({input:reference,key,uri:'',error:'No se pudo verificar el acceso al archivo. Vuelve a intentarlo.'});});return()=>{live=false;};},[reference,key,attempt]);
 useEffect(()=>{if(!legacy)return;const refresh=()=>setAttempt(value=>value+1),visible=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};},[legacy,reference,key]);
 const current=state.input===reference&&state.key===key;
 return{reference:legacy?(current?state.uri:''):safe,resolving:legacy&&(!current||!state.uri&&!state.error),error:invalid?'Referencia de documento no permitida.':current?state.error:'',retry:()=>setAttempt(value=>value+1)};
}
