import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { email, userId: directUserId } = body;
    const admin = base44.asServiceRole;

    // 1. Find user by email or direct ID
    let targetUser;
    if (directUserId) {
      targetUser = await admin.entities.User.get(directUserId);
    } else if (email) {
      const allUsers = await admin.entities.User.list('-created_date', 500);
      targetUser = allUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    }

    if (!targetUser) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const targetUserId = targetUser.id;

    // 2. Activate user portal access
    const userUpdate = await admin.entities.User.update(targetUserId, {
      isPortalActive: true,
      accountAccessStatus: 'active',
      adminActivationStatus: 'approved',
      status: 'activo',
      activatedAt: new Date().toISOString(),
      activatedBy: 'admin',
    });

    // 3. Update or create subscription
    const subs = await admin.entities.Subscription.filter({ userId: targetUserId });
    let subResult;
    if (subs && subs.length > 0) {
      subResult = await admin.entities.Subscription.update(subs[0].id, {
        status: 'activa',
        firstPaymentStatus: 'paid',
        planCode: 'personalizado',
        plan: 'personalizado',
        planName: 'Personalizado (Ilimitado)',
        startedAt: subs[0].startedAt || new Date().toISOString(),
        lastPaymentAt: new Date().toISOString(),
        notes: 'Acceso ilimitado activado por administrador',
      });
    } else {
      subResult = await admin.entities.Subscription.create({
        userId: targetUserId,
        status: 'activa',
        firstPaymentStatus: 'paid',
        planCode: 'personalizado',
        plan: 'personalizado',
        planName: 'Personalizado (Ilimitado)',
        startedAt: new Date().toISOString(),
        lastPaymentAt: new Date().toISOString(),
        notes: 'Acceso ilimitado activado por administrador',
      });
    }

    // 4. Update or create OCR quota (unlimited)
    const companyId = targetUser.company_id || targetUserId;
    const quotaPeriods = await admin.entities.OcrQuotaPeriod.filter({ billingAccountId: companyId });
    let quotaResult;
    if (quotaPeriods && quotaPeriods.length > 0) {
      quotaResult = await admin.entities.OcrQuotaPeriod.update(quotaPeriods[0].id, {
        isUnlimited: true,
        status: 'unlimited',
        currentPlanCode: 'personalizado',
        currentPlanLimit: 999999,
      });
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      const quarterKey = `${year}-Q${quarter}`;
      const periodStart = new Date(year, (quarter - 1) * 3, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, quarter * 3, 0).toISOString().split('T')[0];
      quotaResult = await admin.entities.OcrQuotaPeriod.create({
        billingAccountId: companyId,
        quarterKey,
        periodStart,
        periodEnd,
        planCodeAtStart: 'personalizado',
        currentPlanCode: 'personalizado',
        baseLimit: 999999,
        currentPlanLimit: 999999,
        isUnlimited: true,
        status: 'unlimited',
      });
    }

    return Response.json({
      success: true,
      user: { id: targetUserId, email: targetUser.email, isPortalActive: userUpdate.isPortalActive, status: userUpdate.status },
      subscription: { id: subResult?.id, status: subResult?.status, planName: subResult?.planName },
      quota: { id: quotaResult?.id, isUnlimited: quotaResult?.isUnlimited, status: quotaResult?.status },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});