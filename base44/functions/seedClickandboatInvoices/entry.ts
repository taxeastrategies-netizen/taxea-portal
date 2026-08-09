import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { companyId, apuntes, tipoIva = 21, concepto = 'Alquiler embarcación - ClickAndBoat (control documental ingresos)', subidoPor } = await req.json();
    if (!companyId || !Array.isArray(apuntes) || apuntes.length === 0) {
      return Response.json({ error: 'companyId and apuntes[] required' }, { status: 400 });
    }

    const round2 = (v) => Math.round(v * 100) / 100;

    // Numeración existente para evitar colisiones
    const existing = await base44.asServiceRole.entities.Invoice.filter(
      { company_id: companyId, tipo: 'emitida' }, '-created_date', 200
    ).catch(() => []);
    const usedNums = new Set((existing || []).map((i) => i.numero_factura));

    const records = apuntes.map((a, i) => {
      let seq = i + 1;
      let numero;
      do { numero = `CB2026-${String(seq).padStart(4, '0')}`; seq++; } while (usedNums.has(numero));
      usedNums.add(numero);
      const base = round2(a.total / (1 + tipoIva / 100));
      const cuota = round2(a.total - base);
      return {
        company_id: companyId,
        numero_factura: numero,
        fecha_emision: a.fecha,
        base_imponible: base,
        tipo_iva: tipoIva,
        cuota_iva: cuota,
        retencion_irpf: 0,
        total_factura: a.total,
        moneda: 'EUR',
        tipo: 'emitida',
        trimestre: a.trimestre || 'T3',
        anio: a.anio || 2026,
        estado_cobro: a.estado_cobro || 'cobrada',
        estado_contable: a.estado_contable || 'contabilizada',
        concepto,
        cliente_nombre: '',
        cliente_nif: '',
        subido_por: subidoPor || user.email,
        origin: 'manual',
      };
    });

    const created = await base44.asServiceRole.entities.Invoice.bulkCreate(records);
    const sumBase = round2(records.reduce((s, r) => s + r.base_imponible, 0));
    const sumCuota = round2(records.reduce((s, r) => s + r.cuota_iva, 0));
    const sumTotal = round2(records.reduce((s, r) => s + r.total_factura, 0));

    return Response.json({
      status: 'ok',
      created: Array.isArray(created) ? created.length : 0,
      numeros: records.map((r) => `${r.numero_factura} | ${r.fecha_emision} | base ${r.base_imponible} | IVA ${r.cuota_iva} | total ${r.total_factura}`),
      totales: { base: sumBase, iva: sumCuota, total: sumTotal },
    });
  } catch (error) {
    console.error('seedClickandboatInvoices:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}