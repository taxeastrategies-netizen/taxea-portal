import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { accountingData, fetchAll } from './accountingReportEngine.ts';
import { buildMultinationalReport, reportWindow } from './reportModel.mjs';
import { authorizeReport } from './access.mjs';
import { PublicDomainError, publicServiceFailure } from './publicServiceError.mjs';

const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
Deno.serve(async req=>{
  try{
    if(req.method!=='POST')return Response.json({error:'Método no permitido.'},{status:405,headers});
    const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
    if(!user)return Response.json({error:'Necesitas iniciar sesión.'},{status:401,headers});
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=='object')throw new PublicDomainError('Solicitud no válida.',400);
    const svc=base44.asServiceRole,company=await authorizeReport(svc,user,body.companyId);
    const year=Number(body.year),firstMonth=Number(body.firstMonth??1),lastMonth=Number(body.lastMonth??12);
    try{reportWindow(year,firstMonth,lastMonth);}catch{throw new PublicDomainError('Selecciona un ejercicio y un intervalo de meses válido.',400);}
    const segment=body.segment||'all';
    if(typeof segment!=='string'||segment.length>200)throw new PublicDomainError('Segmento no válido.',400);
    // Every service-role query is scoped only after verifying access to this company.
    const [accounting,invoices,expenses,bankAccounts,bankTransactions,fiscalProfiles,fiscalActivities,taxModels,taxPeriods]=await Promise.all([
      accountingData(svc,company.id,{year,includeBusinessData:false}),
      fetchAll(svc.entities.Invoice,{company_id:company.id},'created_date'),
      fetchAll(svc.entities.Expense,{company_id:company.id},'created_date'),
      fetchAll(svc.entities.BankAccount,{company_id:company.id},'created_date',10000),
      fetchAll(svc.entities.BankTransaction,{company_id:company.id},'created_date'),
      fetchAll(svc.entities.FiscalProfile,{company_id:company.id},'-created_date',10000),
      fetchAll(svc.entities.FiscalActivity,{company_id:company.id},'created_date',10000),
      fetchAll(svc.entities.TaxModel,{companyId:company.id},'codigo',10000),
      fetchAll(svc.entities.TaxPeriod,{companyId:company.id,ejercicio:year},'periodo',10000),
    ]);
    // Defensive tenant fence even if an upstream filter regresses.
    if([...accounting.entries,...accounting.lines,...accounting.accounts,...accounting.operations,...taxModels,...taxPeriods].some(r=>r.companyId!==company.id)||[...invoices,...expenses,...bankAccounts,...bankTransactions,...fiscalProfiles,...fiscalActivities].some(r=>r.company_id!==company.id))throw new Error('Tenant fence');
    const report=buildMultinationalReport({company,accounting,invoices,expenses,bankAccounts,bankTransactions,fiscalProfiles,fiscalActivities,taxModels,taxPeriods},{year,firstMonth,lastMonth,segment});
    return Response.json(report,{headers});
  }catch(error){return publicServiceFailure(error,'multinationalReport');}
});
