import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, ReceiptText, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Tarjeta fiscal colapsable ──────────────────────────────────────────────
function FiscalCard({ icon: Icon, title, subtitle, amount, amountColor, badge, detail, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', badge)}>
              <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
              {subtitle && <p className="text-[10.5px] text-muted-foreground/70 leading-tight mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </div>
        <p className={cn('text-2xl font-jakarta font-bold leading-none mb-1', amountColor)}>{fmt(amount)} €</p>
      </div>

      {detail && (
        <>
          <div className="border-t border-border">
            <button onClick={() => setOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:bg-secondary/40 transition-colors">
              <span>Ver detalle</span>
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {open && <div className="border-t border-border bg-secondary/20 px-5 py-4 space-y-3">{detail}</div>}
        </>
      )}
      {children}
    </div>
  );
}

// ── Fila de detalle ────────────────────────────────────────────────────────
function DetailRow({ label, value, sub, accent }) {
  return (
    <div className="flex items-start justify-between text-xs gap-2">
      <span className="text-muted-foreground leading-tight">{label}</span>
      <span className={cn('font-semibold text-right shrink-0', accent ? 'text-destructive' : 'text-foreground')}>
        {value}
        {sub && <span className="block text-muted-foreground font-normal text-[10px]">{sub}</span>}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function FiscalDashboard({ invoices, expenses, company, quarter }) {
  const taxType = company?.tipo_impuesto === 'igic' ? 'IGIC' : 'IVA';
  const modeloIVA = taxType === 'IGIC' ? 'Mod. 420 estimado' : 'Mod. 303 estimado';

  // Filtrar por trimestre si se pide
  function inPeriod(item) {
    if (!quarter || quarter === 'anual') return true;
    const t = item.trimestre || item.anio && (() => {
      const d = new Date(item.fecha_emision || item.fecha || '');
      const m = d.getMonth() + 1;
      return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
    })();
    return t === quarter;
  }

  const emitidas = invoices.filter(i => i.tipo === 'emitida' && inPeriod(i));
  const recibidas = invoices.filter(i => i.tipo === 'recibida' && inPeriod(i));
  const gastosP = expenses.filter(e => e.tipo === 'gasto' && inPeriod(e));

  // 1) IVA / IGIC
  const ivaRepercutido = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportadoInv = recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportadoExp = gastosP.reduce((s, e) => s + (e.cuota_impuesto || 0), 0);
  const ivaSoportado = ivaSoportadoInv + ivaSoportadoExp;
  const ivaResultado = ivaRepercutido - ivaSoportado;

  // 2) IRPF a favor (retenciones en facturas emitidas)
  const irpfFavor = emitidas.reduce((s, i) => s + (i.retencion_irpf > 0 ? (i.base_imponible || 0) * (i.retencion_irpf || 0) / 100 : 0), 0);
  const facturasConRetencion = emitidas.filter(i => (i.retencion_irpf || 0) > 0);

  // 3) IRPF modelo 111 (retenciones en gastos recibidos)
  const irpf111 = gastosP.reduce((s, e) => s + (e.cuota_impuesto && e.tipo_impuesto < 0 ? Math.abs(e.cuota_impuesto) : 0), 0);
  // Alternativa: gastos con tipo_impuesto negativo o campo específico retención
  // Simplificado: sumar campo `retencion` si existiera, o dejar en 0 si no está modelado
  const gastosConRetencion = gastosP.filter(e => e.tipo_impuesto < 0);

  // 4) Modelo 130
  const ingresosBase = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const gastosBase = gastosP.reduce((s, e) => s + (e.base_imponible || 0), 0);
  const rendimientoNeto = ingresosBase - gastosBase;
  const mod130Bruto = rendimientoNeto * 0.20;
  const retencionesSoportadas = irpfFavor;
  const mod130Resultado = Math.max(0, mod130Bruto - retencionesSoportadas);

  return (
    <div className="space-y-4">
      {/* Aviso legal */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Estimaciones automáticas basadas en las facturas registradas en Taxea Portal. El cálculo definitivo debe ser revisado por Taxea.
        </p>
      </div>

      {/* Grid 2×2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* 1. IVA / IGIC */}
        <FiscalCard
          icon={ReceiptText}
          title={modeloIVA}
          subtitle={`Repercutido - Soportado`}
          amount={ivaResultado}
          amountColor={ivaResultado > 0 ? 'text-destructive' : ivaResultado < 0 ? 'text-green-600' : 'text-foreground'}
          badge={ivaResultado > 0 ? 'bg-red-100 text-destructive' : 'bg-green-100 text-green-700'}
          detail={
            <div className="space-y-2">
              <DetailRow label={`${taxType} repercutido (emitidas)`} value={`${fmt(ivaRepercutido)} €`} sub={`${emitidas.length} facturas`} />
              <DetailRow label={`${taxType} soportado (gastos + recibidas)`} value={`${fmt(ivaSoportado)} €`} />
              <div className="border-t border-border pt-2 flex justify-between text-xs font-bold">
                <span>Resultado {ivaResultado >= 0 ? 'a pagar' : 'a compensar'}</span>
                <span className={ivaResultado >= 0 ? 'text-destructive' : 'text-green-600'}>{fmt(Math.abs(ivaResultado))} €</span>
              </div>
            </div>
          }
        />

        {/* 2. IRPF a favor */}
        <FiscalCard
          icon={TrendingDown}
          title="IRPF a favor"
          subtitle="Retenciones en facturas emitidas"
          amount={irpfFavor}
          amountColor="text-green-600"
          badge="bg-green-100 text-green-700"
          detail={
            <div className="space-y-2">
              <DetailRow label="Facturas con retención" value={`${facturasConRetencion.length}`} />
              <DetailRow label="Total retenido" value={`${fmt(irpfFavor)} €`} />
              {facturasConRetencion.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {facturasConRetencion.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate max-w-[60%]">{f.numero_factura} · {f.cliente_nombre || '—'}</span>
                      <span className="font-medium">{fmt((f.base_imponible || 0) * (f.retencion_irpf || 0) / 100)} €</span>
                    </div>
                  ))}
                  {facturasConRetencion.length > 5 && (
                    <p className="text-[11px] text-muted-foreground">+{facturasConRetencion.length - 5} más…</p>
                  )}
                </div>
              )}
              <p className="text-[10.5px] text-muted-foreground pt-1 italic">Retenciones practicadas por tus clientes en tus facturas emitidas.</p>
            </div>
          }
        />

        {/* 3. Modelo 111 */}
        <FiscalCard
          icon={Calculator}
          title="IRPF Modelo 111 estimado"
          subtitle="Retenciones a terceros a ingresar"
          amount={irpf111}
          amountColor={irpf111 > 0 ? 'text-destructive' : 'text-muted-foreground'}
          badge={irpf111 > 0 ? 'bg-red-100 text-destructive' : 'bg-secondary text-muted-foreground'}
          detail={
            <div className="space-y-2">
              <DetailRow label="Gastos con retención" value={`${gastosConRetencion.length}`} />
              <DetailRow label="Total a ingresar" value={`${fmt(irpf111)} €`} />
              {gastosConRetencion.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {gastosConRetencion.slice(0, 5).map((e, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate max-w-[60%]">{e.proveedor_cliente || '—'}</span>
                      <span className="font-medium text-destructive">{fmt(Math.abs(e.cuota_impuesto || 0))} €</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">Sin gastos con retención registrados.</p>
              )}
              <p className="text-[10.5px] text-muted-foreground pt-1 italic">Retenciones practicadas a terceros sujetas a ingreso mediante modelo 111.</p>
            </div>
          }
        />

        {/* 4. Modelo 130 */}
        <FiscalCard
          icon={TrendingUp}
          title="IRPF Modelo 130 estimado"
          subtitle="(Ingresos − Gastos) × 20%"
          amount={mod130Resultado}
          amountColor={mod130Resultado > 0 ? 'text-amber-600' : 'text-green-600'}
          badge="bg-amber-100 text-amber-700"
          detail={
            <div className="space-y-2">
              <DetailRow label="Ingresos (base)" value={`${fmt(ingresosBase)} €`} />
              <DetailRow label="Gastos (base)" value={`${fmt(gastosBase)} €`} />
              <DetailRow label="Rendimiento neto" value={`${fmt(rendimientoNeto)} €`} />
              <DetailRow label="20% s/ rendimiento" value={`${fmt(mod130Bruto)} €`} />
              <DetailRow label="Retenciones soportadas" value={`- ${fmt(retencionesSoportadas)} €`} />
              <div className="border-t border-border pt-2 flex justify-between text-xs font-bold">
                <span>Resultado orientativo</span>
                <span className={mod130Resultado > 0 ? 'text-amber-600' : 'text-green-600'}>{fmt(mod130Resultado)} €</span>
              </div>
              <p className="text-[10.5px] text-amber-700 italic">Estimación orientativa pendiente de revisión por Taxea.</p>
            </div>
          }
        />
      </div>
    </div>
  );
}