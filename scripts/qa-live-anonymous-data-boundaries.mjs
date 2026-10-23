// READ ONLY: no customer content, identity creation, invoice sends or mutations.
import {createClient} from '@base44/sdk';
const appId='6a00fec50cc522a74ddde4b2';
const client=createClient({appId,serverUrl:'https://base44.app',appBaseUrl:'https://taxeaportal.com'});
const names=['User','Company','ClientAccount','Contact','Invoice','Document','OcrInvoiceDocument','BankAccount','BankTransaction','Employee','HRDocument','LaborOcrDocument','JournalEntry','JournalEntryLine','TaxDraft','TaxSubmission','TaxFiling','InvoiceEmailLog','Subscription','BackupConfiguration','BackupJob','UserAuditLog','PredefinedNote'];
const rows=[];
for(const name of process.argv.includes('--files-only') ? [] : names){
  try{
    const result=await client.entities[name].list('-created_date',1,0,['id']);
    const count=Array.isArray(result)?result.length:null;
    rows.push({entity:name,status:200,returnedRecordCount:count,privateBoundaryPass:count===0,publicTemplate:name==='PredefinedNote'});
  }catch(e){const status=e?.status||e?.response?.status||null;rows.push({entity:name,status,privateBoundaryPass:[401,403,404].includes(status)});}
  await new Promise(resolve=>setTimeout(resolve,180));
}
let privateFileSigning;
try{
  const result=await client.integrations.Core.CreateFileSignedUrl({file_uri:'mp/private/'+appId+'/e75567617_taxea-qa-security-20261023.txt',expires_in:60});
  let markerReadable = false;
  let downloadStatus = null;
  if (result?.signed_url) {
    const download = await fetch(result.signed_url, {signal: AbortSignal.timeout(10000)});
    downloadStatus = download.status;
    markerReadable = (await download.text()) === 'TAXEA_QA_SECURITY_20261023_SYNTHETIC_NOT_CUSTOMER_DATA\n';
  }
  privateFileSigning={anonymousDenied:false,signedUrlReturned:!!result?.signed_url,downloadStatus,markerReadable};
}catch(e){privateFileSigning={anonymousDenied:[401,403].includes(e?.status||e?.response?.status),status:e?.status||e?.response?.status||null};}
console.log(JSON.stringify({readOnly:true,customerContentsPrinted:false,records:rows,privateFileSigning},null,2));
client.cleanup();

