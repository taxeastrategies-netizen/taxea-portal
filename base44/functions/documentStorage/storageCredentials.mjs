const encoder = new TextEncoder();
export const STORAGE_PROJECT = 'plasma-minutia-510419-c4';
export const STORAGE_BUCKET = 'taxea-portal-private-es-6a00fec5';
export const STORAGE_ACCOUNT = `taxea-portal-storage@${STORAGE_PROJECT}.iam.gserviceaccount.com`;
export function storageConfiguration(env) {
  const raw=env.get('TAXEA_GCS_CREDENTIALS_JSON');
  if (!raw) throw new Error('PRIVATE_STORAGE_NOT_CONFIGURED');
  let key;try {key=JSON.parse(raw);} catch {throw new Error('PRIVATE_STORAGE_INVALID_CONFIG');}
  if(key.type!=='service_account'||key.project_id!==STORAGE_PROJECT||key.client_email!==STORAGE_ACCOUNT
    ||key.token_uri!=='https://oauth2.googleapis.com/token'||!/^-----BEGIN PRIVATE KEY-----/.test(key.private_key||'')
    ||env.get('TAXEA_GCS_BUCKET')!==STORAGE_BUCKET||env.get('TAXEA_GCS_PROJECT_ID')!==STORAGE_PROJECT)
    throw new Error('PRIVATE_STORAGE_INVALID_CONFIG');
  return key;
}
export function pemBytes(pem) {return Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));}
const join=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;};
const hex=s=>Uint8Array.from(s.match(/../g).map(x=>parseInt(x,16)));
const der=(tag,bytes)=>{let n=bytes.length,ls=[];if(n<128)ls=[n];else{while(n){ls.unshift(n&255);n>>>=8;}ls.unshift(128|ls.length);}return join(Uint8Array.of(tag,...ls),bytes);};
const seq=(...xs)=>der(0x30,join(...xs));
export const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s);};
export const base64url=bytes=>base64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function importStorageKey(config,extractable=false){return crypto.subtle.importKey('pkcs8',pemBytes(config.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},extractable,['sign']);}
export async function publicStorageCertificate(config,now=new Date()) {
  const privateKey=await importStorageKey(config,true);
  const privateJwk=await crypto.subtle.exportKey('jwk',privateKey);
  const publicKey=await crypto.subtle.importKey('jwk',{kty:privateJwk.kty,n:privateJwk.n,e:privateJwk.e,alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},true,['verify']);
  const spki=new Uint8Array(await crypto.subtle.exportKey('spki',publicKey));
  const alg=hex('300d06092a864886f70d01010b0500');
  const name=seq(der(0x31,seq(hex('0603550403'),der(0x0c,encoder.encode('unused')))));
  const utc=d=>der(0x17,encoder.encode(d.toISOString().replace(/[-:T]/g,'').slice(2,14)+'Z'));
  const serial=crypto.getRandomValues(new Uint8Array(16));serial[0]&=0x7f;serial[15]|=1;
  const expires=new Date(now.getTime()+365*86400000);
  const tbs=seq(der(0xa0,der(2,Uint8Array.of(2))),der(2,serial),alg,name,seq(utc(new Date(now.getTime()-300000)),utc(expires)),name,spki);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,tbs));
  const cert=seq(tbs,alg,der(3,join(Uint8Array.of(0),signature)));
  const certificate='-----BEGIN CERTIFICATE-----\n'+base64(cert).match(/.{1,64}/g).join('\n')+'\n-----END CERTIFICATE-----\n';
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',cert)),b=>b.toString(16).padStart(2,'0')).join('');
  return {certificate,expiresAt:expires.toISOString(),fingerprint,publicKeySha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',spki)),b=>b.toString(16).padStart(2,'0')).join('')};
}
