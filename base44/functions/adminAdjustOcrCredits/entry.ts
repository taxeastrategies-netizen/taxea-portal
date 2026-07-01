import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      billingAccountId, quotaPeriodId, adjustmentType,
      credits = 0, reason, internalNote, validFrom, validUntil,
    } = body;

    if (!billingAccountId || !quotaPeriodId || !adjustmentType || !reason) {
      return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const period = await base44.asServiceRole.entities.OcrQuotaPeriod.get(quotaPeriodId);
    if (!period) return Response.json({ error: 'Periodo no encontrado' }, { status: 404 });

    const previousManualCredits = period.manualCredits || 0;
    const now = new Date().toISOString();
    let updates = {};
    let newManualCredits = previousManualCredits;

    switch (adjustmentType) {
      case 'add_temporary_credits':
        newManualCredits = previousManualCredits + credits;
        updates = { manualCredits: newManualCredits, status: 'manually_extended' };
        break;
      case 'remove_temporary_credits':
        newManualCredits = Math.max(0, previousManualCredits - credits);
        updates = { manualCredits: newManualCredits };
        break;
      case 'correct_erroneous_consumption':
        updates = { consumedCredits: Math.max(0, (period.consumedCredits || 0) - credits) };
        break;
      case 'temporary_unlimited_access':
        updates = { isUnlimited: true, status: 'unlimited' };
        break;
      case 'manual_block':
        // Block OCR at ClientAccount level
        await base44.asServiceRole.entities.ClientAccount.update(billingAccountId, { ocrAccessStatus: 'blocked' });
        updates = { status: 'suspended' };
        break;
      case 'manual_unblock':
        await base44.asServiceRole.entities.ClientAccount.update(billingAccountId, { ocrAccessStatus: 'allowed' });
        // Recalculate status
        const totalLimit = period.currentPlanLimit + newManualCredits;
        const pct = totalLimit > 0 ? (period.consumedCredits / totalLimit) * 100 : 0;
        let newStatus = 'available';
        if (pct >= 100) newStatus = 'exhausted';
        else if (pct >= 90) newStatus = 'critical';
        else if (pct >= 80) newStatus = 'warning';
        updates = { status: newStatus };
        break;
    }

    await base44.asServiceRole.entities.OcrQuotaPeriod.update(quotaPeriodId, updates);

    // Record the adjustment
    await base44.asServiceRole.entities.OcrCreditAdjustment.create({
      billingAccountId,
      quotaPeriodId,
      adjustmentType,
      credits,
      reason,
      internalNote: internalNote || '',
      validFrom: validFrom || now,
      validUntil: validUntil || null,
      previousValue: previousManualCredits,
      newValue: newManualCredits,
      createdByAdminId: user.id,
      createdAt: now,
    });

    console.log(`Ajuste OCR: ${adjustmentType}, cuenta ${billingAccountId}, admin ${user.id}`);
    return Response.json({ success: true, adjustmentType, credits });
  } catch (error) {
    console.error('Error en adminAdjustOcrCredits:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});