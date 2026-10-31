export async function saveHrDocumentUpload({file,companyId,form},{upload,create}){
 if(!file?.name||!/^[A-Za-z0-9_-]{1,128}$/.test(companyId||''))throw new Error('Selecciona una empresa antes de subir el documento.');
 const metadata={company_id:companyId,nombre:String(form?.nombre||file.name),tipo:String(form?.tipo||'otro'),employee_id:String(form?.employee_id||'')};
 const saved=await upload({file,companyId});
 if(typeof saved?.file_url!=='string'||!saved.file_url.startsWith('https://'))throw new Error('No se pudo confirmar el archivo.');
 const record=await create({...metadata,archivo_url:saved.file_url});
 if(!record?.id||record.company_id!==companyId||record.archivo_url!==saved.file_url)throw new Error('No se pudo confirmar el registro. Comprueba la lista antes de reintentar.');
 return record;
}
