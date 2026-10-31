const LEGACY_APP='6a00fec50cc522a74ddde4b2';
export function normalizeLegacyDocumentReference(value){
 if(typeof value!=='string'||value.length>4096)return'';
 let text=value.trim();if(/^mp\/(public|private)\//.test(text))text='https://base44.app/api/apps/'+LEGACY_APP+'/files/'+text;
 try{
  const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port)return'';
  let path=text.replace(/^https:\/\/[^/]+/i,'').split(/[?#]/)[0];for(let i=0;i<3;i++){const decoded=decodeURIComponent(path);if(decoded===path)break;path=decoded;}
  if(/[\\\u0000-\u001f\u007f]/.test(path)||path.split('/').some(part=>part==='.'||part==='..'))return'';
  const own=(u.hostname==='media.base44.com'&&['files','images'].some(kind=>['public','private'].some(access=>u.pathname.startsWith('/'+kind+'/'+access+'/'+LEGACY_APP+'/'))))||(u.hostname==='base44.app'&&['public','private'].some(access=>u.pathname.startsWith('/api/apps/'+LEGACY_APP+'/files/mp/'+access+'/'+LEGACY_APP+'/')));
  if(!own)return'';u.hash='';return u.toString();
 }catch{return'';}
}
