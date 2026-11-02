export async function acquireApprovalLease(svc, companyId) {
  const token = crypto.randomUUID();
  let claim = await svc.entities.Company.updateMany({
    id: companyId, ocr_approval_lock_token: { $in: [null, ''] },
  }, { $set: { ocr_approval_lock_token: token, ocr_approval_lock_started_at: new Date().toISOString() } });
  if(Number(claim?.updated)!==1){
    const previous=await svc.entities.Company.get(companyId);
    const started=Date.parse(previous?.ocr_approval_lock_started_at||'');
    if(previous?.ocr_approval_lock_token&&Number.isFinite(started)&&Date.now()-started>600000)
      claim=await svc.entities.Company.updateMany({id:companyId,ocr_approval_lock_token:previous.ocr_approval_lock_token,ocr_approval_lock_started_at:previous.ocr_approval_lock_started_at},{$set:{ocr_approval_lock_token:token,ocr_approval_lock_started_at:new Date().toISOString()}});
  }
  if (Number(claim?.updated) !== 1) {
    const error = new Error('Hay otra aprobación OCR en curso para esta empresa. Espera a que termine; no se ha creado otra factura.');
    error.status = 409; throw error;
  }
  return async () => {
    await svc.entities.Company.updateMany({ id: companyId, ocr_approval_lock_token: token },
      { $set: { ocr_approval_lock_token: '', ocr_approval_lock_started_at: '' } });
  };
}
