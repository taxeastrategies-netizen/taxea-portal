import{enabledPortalUser,requirePortalCompany,requirePortalCompanyBatch,portalBoundaryError}from'./portalAccess.generated.mjs';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  let userAuthenticated=false;
  try {
    if(req.method!=='POST')return Response.json({error:'Método no permitido.'},{status:405});
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    userAuthenticated=true;
    if(!enabledPortalUser(user))return Response.json({error:'Acceso suspendido.'},{status:403});

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const userCompanyId = user.data?.company_id;

    const body = await req.json().catch(() => ({}));
    let { clientIds, anio } = body;

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return Response.json({ error: 'clientIds array is required' }, { status: 400 });
    }

    clientIds=await requirePortalCompanyBatch(base44.asServiceRole,user,clientIds);

    const year = anio ? parseInt(anio) : null;

    // Fetch invoices and expenses for all clients in parallel using service role
    const results = {};
    const tasks = clientIds.map((cid) => async () => {
      const filter = { company_id: cid };
      if (year) filter.anio = year;
      const [invs, exps] = await Promise.all([
        base44.asServiceRole.entities.Invoice.filter(filter, '-fecha_emision', 5000),
        base44.asServiceRole.entities.Expense.filter(filter, '-fecha', 5000),
      ]);
      const activeInvs = (invs || []).filter(i => !i.anulada);
      const activeExps = (exps || []).filter(e => !e.anulada);
      results[cid] = {
        emittedInvoiceIds: activeInvs.filter(i => i.tipo === 'emitida').map(i => i.id),
        receivedInvoiceIds: activeInvs.filter(i => i.tipo === 'recibida').map(i => i.id),
        expenseIds: activeExps.filter(e => e.tipo === 'gasto').map(e => e.id),
      };
    });

    for(let at=0;at<tasks.length;at+=5)await Promise.all(tasks.slice(at,at+5).map(task=>task()));

    return Response.json({ clients: results });
  }catch(error){if(!userAuthenticated)return Response.json({error:'Unauthorized'},{status:401});const safe=portalBoundaryError(error);return Response.json(safe.body,{status:safe.status,headers:{'Cache-Control':'no-store'}});}
});
