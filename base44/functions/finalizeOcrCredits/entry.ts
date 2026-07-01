import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { reservationId, success, failureReasonSafe } = body;

    if (!reservationId) return Response.json({ error: 'reservationId requerido' }, { status: 400 });

    const reservations = await base44.asServiceRole.entities.OcrCreditReservation.filter({ id: reservationId });
    const reservation = reservations?.[0];
    if (!reservation) return Response.json({ error: 'Reserva no encontrada' }, { status: 404 });
    if (reservation.status !== 'reserved') {
      return Response.json({ status: reservation.status, idempotent: true });
    }

    const period = await base44.asServiceRole.entities.OcrQuotaPeriod.get(reservation.quotaPeriodId);
    if (!period) return Response.json({ error: 'Periodo de cuota no encontrado' }, { status: 404 });

    const credits = reservation.creditsReserved || 1;
    const now = new Date().toISOString();

    if (success) {
      // Consume credits
      await base44.asServiceRole.entities.OcrCreditReservation.update(reservationId, {
        status: 'consumed',
        consumedAt: now,
      });
      await base44.asServiceRole.entities.OcrQuotaPeriod.update(period.id, {
        consumedCredits: (period.consumedCredits || 0) + credits,
        reservedCredits: Math.max(0, (period.reservedCredits || 0) - credits),
      });

      // Update usage event
      const events = await base44.asServiceRole.entities.OcrUsageEvent.filter({ idempotencyKey: reservation.idempotencyKey });
      if (events.length > 0) {
        await base44.asServiceRole.entities.OcrUsageEvent.update(events[0].id, {
          status: 'completed',
          completedAt: now,
        });
      }

      // Recalculate status
      const newConsumed = (period.consumedCredits || 0) + credits;
      const totalLimit = period.currentPlanLimit + (period.manualCredits || 0);
      let newStatus = 'available';
      if (!period.isUnlimited && totalLimit > 0) {
        const pct = (newConsumed / totalLimit) * 100;
        if (pct >= 100) newStatus = 'exhausted';
        else if (pct >= 90) newStatus = 'critical';
        else if (pct >= 80) newStatus = 'warning';
      } else if (period.isUnlimited) {
        newStatus = 'unlimited';
      }
      await base44.asServiceRole.entities.OcrQuotaPeriod.update(period.id, { status: newStatus });

      console.log(`OCR finalizado OK: reserva ${reservationId}, créditos consumidos: ${credits}`);
      return Response.json({ status: 'consumed', creditsConsumed: credits });
    } else {
      // Release reservation
      await base44.asServiceRole.entities.OcrCreditReservation.update(reservationId, {
        status: 'released',
        releasedAt: now,
        failureReasonSafe: failureReasonSafe || 'OCR fallido',
      });
      await base44.asServiceRole.entities.OcrQuotaPeriod.update(period.id, {
        reservedCredits: Math.max(0, (period.reservedCredits || 0) - credits),
      });

      const events = await base44.asServiceRole.entities.OcrUsageEvent.filter({ idempotencyKey: reservation.idempotencyKey });
      if (events.length > 0) {
        await base44.asServiceRole.entities.OcrUsageEvent.update(events[0].id, {
          status: 'failed',
          completedAt: now,
        });
      }

      console.log(`OCR liberado: reserva ${reservationId} (falló)`);
      return Response.json({ status: 'released' });
    }
  } catch (error) {
    console.error('Error en finalizeOcrCredits:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});