import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { periodType, year, month, quarter, day } = body;

    // Build date range
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (periodType === 'day') {
      const d = day ? new Date(day) : now;
      startDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    } else if (periodType === 'month') {
      const yr = year ? parseInt(year) : now.getUTCFullYear();
      const mo = month ? parseInt(month) - 1 : now.getUTCMonth();
      startDate = new Date(Date.UTC(yr, mo, 1));
      endDate = new Date(Date.UTC(yr, mo + 1, 1));
    } else if (periodType === 'quarter') {
      const yr = year ? parseInt(year) : now.getUTCFullYear();
      const q = quarter ? parseInt(quarter) : Math.ceil((now.getUTCMonth() + 1) / 3);
      const startMonth = (q - 1) * 3;
      startDate = new Date(Date.UTC(yr, startMonth, 1));
      endDate = new Date(Date.UTC(yr, startMonth + 3, 1));
    } else if (periodType === 'year') {
      const yr = year ? parseInt(year) : now.getUTCFullYear();
      startDate = new Date(Date.UTC(yr, 0, 1));
      endDate = new Date(Date.UTC(yr + 1, 0, 1));
    } else {
      // all time
    }

    // Fetch all completed usage events (paginate)
    const allEvents = [];
    let skip = 0;
    const limit = 500;
    while (true) {
      const batch = await base44.asServiceRole.entities.OcrUsageEvent.filter(
        { status: 'completed' },
        '-completedAt',
        limit
      ).catch(() => []);
      if (!batch || batch.length === 0) break;
      allEvents.push(...batch);
      if (batch.length < limit) break;
      skip += limit;
    }

    // Filter by date range if set
    let filtered = allEvents;
    if (startDate && endDate) {
      filtered = allEvents.filter(e => {
        const d = e.completedAt ? new Date(e.completedAt) : null;
        return d && d >= startDate && d < endDate;
      });
    }

    // Group by billingAccountId
    const counts = {};
    filtered.forEach(e => {
      const cid = e.billingAccountId || 'unknown';
      counts[cid] = (counts[cid] || 0) + 1;
    });

    // Also get total for each client (all-time) for reference
    const allTimeCounts = {};
    allEvents.forEach(e => {
      const cid = e.billingAccountId || 'unknown';
      allTimeCounts[cid] = (allTimeCounts[cid] || 0) + 1;
    });

    return Response.json({
      periodType: periodType || 'all',
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
      totalScans: filtered.length,
      totalScansAllTime: allEvents.length,
      clientCounts: counts,
      clientCountsAllTime: allTimeCounts,
    });
  } catch (error) {
    console.error('[getOcrUsageByClient] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});