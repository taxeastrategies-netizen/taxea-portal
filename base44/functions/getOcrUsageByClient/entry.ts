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
    }
    // periodType === 'all' → no date filter

    // Fetch all OCR documents (the real historical record of every scan)
    const allDocs = await base44.asServiceRole.entities.OcrInvoiceDocument.list('-uploadedAt', 5000).catch(() => []);

    // Filter by date range
    let filtered = allDocs || [];
    if (startDate && endDate) {
      filtered = filtered.filter(d => {
        if (!d.uploadedAt) return false;
        const dt = new Date(d.uploadedAt);
        return dt >= startDate && dt < endDate;
      });
    }

    // Count scans per userId
    const countsByUser = {};
    const allTimeCountsByUser = {};
    (allDocs || []).forEach(d => {
      const uid = d.uploadedByUserId;
      if (!uid) return;
      allTimeCountsByUser[uid] = (allTimeCountsByUser[uid] || 0) + 1;
    });
    filtered.forEach(d => {
      const uid = d.uploadedByUserId;
      if (!uid) return;
      countsByUser[uid] = (countsByUser[uid] || 0) + 1;
    });

    return Response.json({
      periodType: periodType || 'all',
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
      totalScans: filtered.length,
      totalScansAllTime: (allDocs || []).length,
      countsByUser,
      allTimeCountsByUser,
    });
  } catch (error) {
    console.error('[getOcrUsageByClient] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});