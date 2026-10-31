import {savePrivateAsset,isStorageAdmin} from './storageAssets.mjs';
const QA_A='taxeastrategies+qa-recc-2026@gmail.com',QA_B='taxeastrategies+qa-security-b-20261023@gmail.com';
export async function inspectStorageQa(svc,user){
 if(!isStorageAdmin(user))throw new Error('QA_ADMIN_ONLY');
 const result={};for(const [label,email] of [['A',QA_A],['B',QA_B]]){const rows=await svc.entities.Company.filter({owner_email:email},'-created_date',20);result[label]=rows.map(c=>({id:c.id,name:c.razon_social,display:c.nombre_comercial,enabled:c.private_document_storage_enabled===true}));}return {syntheticOnly:true,companies:result};
}
export function syntheticPdf(){
 const content='BT /F1 14 Tf 40 140 Td (TAXEA SYNTHETIC STORAGE - NO CUSTOMER DATA) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return pdf;
}
export async function prepareStorageQa(svc,user,env){
 if(!isStorageAdmin(user))throw new Error('QA_ADMIN_ONLY');
 const own=await svc.entities.Company.filter({owner_email:QA_A},'-created_date',20);
 const candidates=own.filter(c=>c.razon_social==='TAXEA QA RECC 2026 — DATOS FICTICIOS');
 if(candidates.length!==1)throw new Error('QA_EXISTING_COMPANY_NOT_VERIFIED');
 const label='TAXEA QA PRIVATE STORAGE B 2026-10-31 - DATOS FICTICIOS';
 const matches=await svc.entities.Company.filter({owner_email:QA_B,razon_social:label},'-created_date',2);
 if(matches.length>1)throw new Error('QA_AMBIGUOUS_COMPANY');
 await svc.entities.Company.update(candidates[0].id,{private_document_storage_enabled:true});
 const companyA=await svc.entities.Company.get(candidates[0].id);
 if(companyA.owner_email!==QA_A||companyA.private_document_storage_enabled!==true)throw new Error('QA_COMPANY_NOT_VERIFIED');
 const companyB=matches[0]||await svc.entities.Company.create({razon_social:label,nif_cif:'QA-PRIVATE-STORAGE-B-20261031',owner_email:QA_B,usuarios_autorizados:[],activa:true,private_document_storage_enabled:true});
 if(companyB.razon_social!==label||companyB.owner_email!==QA_B||companyB.private_document_storage_enabled!==true)throw new Error('QA_COMPANY_NOT_VERIFIED');
 const file=new File([syntheticPdf()],'taxea-private-storage-synthetic-B.pdf',{type:'application/pdf'});
 const saved=await savePrivateAsset(svc,user,companyB,file,env);
 return {syntheticOnly:true,companyAId:companyA.id,companyBId:companyB.id,foreignAssetId:saved.asset.id,foreignReference:saved.file_url,customerReads:0,customerWrites:0,financialWrites:0};
}
