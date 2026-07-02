// Panel P&L — Profit & Loss (sin IVA/IGIC)
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function PnLPanel({ invoices, expenses, year, quarter }) {
  const data = useMemo(() => {
    function inPeriod(item) {
      if (!quarter || quarter === 'all') return true;
      return item.trimestre === quarter;
    }

    const emitidas = invoices.filter(i => i.tipo === 'emitida' && !i.anulada && inPeriod(i));
    const gastosData = expenses.filter(e => e.tipo === 'gasto' && !e.anulada && inPeriod(e));
    const recibidas = invoices.filter(i => i.tipo === 'recibida' && !i.anulada && inPeriod(i));

    const ingresos = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const gastosTotales = gastosData.reduce((s, e) => s + (e.base_imponible || 0), 0)
      + recibidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const beneficio = ingresos - gastosTotales;
    const margen = ingresos > 0 ? (beneficio / ingresos * 100) : 0;

    const ivaRep = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const ivaSop = gastosData.reduce((s, e) => s + (e.cuota_impuesto || 0), 0)
      + recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);

    const byMonth = Array.from({ length: 12 }, (_, m) => {
      const ing = emitidas
        .filter(i => { const d = new Date(i.fecha_emision || ''); return d.getMonth() === m; })
        .reduce((s, i) => s + (i.base_imponible || 0), 0);
      const gas = [...gastosData, ...recibidas]
        .filter(e => { const d = new Date(e.fecha || e.fecha_emision || ''); return d.getMonth() === m; })
        .reduce((s, e) => s + (e.base_imponible || 0), 0);
      return { mes: MONTHS[m], ingresos: ing, gastos: gas };
    });

    return { ingresos, gastosTotales, beneficio, margen, ivaRep, ivaSop, byMonth };
  }, [invoices, expenses, quarter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ingresos (base)</p>
          </div>
          <p className="text-xl font-jakarta font-bold text-green-800">{fmt(data.ingresos)} €</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Gastos (base)</p>
          </div>
          <p className="text-xl font-jakarta font-bold text-red-800">{fmt(data.gastosTotales)} €</p>
        </div>
        <div className={`border rounded-xl p-4 ${data.beneficio >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Beneficio estimado</p>
          </div>
          <p className={`text-xl font-jakarta font-bold ${data.beneficio >= 0 ? 'text-blue-800' : 'text-red-700'}`}>{fmt(data.beneficio)} €</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margen</p>
          </div>
          <p className={`text-xl font-jakarta font-bold ${data.margen >= 0 ? 'text-foreground' : 'text-destructive'}`}>{data.margen.toFixed(1)} %</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-jakarta font-semibold text-foreground mb-4">Evolución mensual — {year}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byMonth} barSize={14} barGap={4}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => [`${fmt(v)} €`]} labelStyle={{ fontWeight: 600 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3,3,0,0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 justify-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Ingresos</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Gastos</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">IVA/IGIC repercutido</p>
          <p className="text-lg font-jakarta font-bold text-teal">{fmt(data.ivaRep)} €</p>
          <p className="text-xs text-muted-foreground mt-0.5">Facturas emitidas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">IVA/IGIC soportado</p>
          <p className="text-lg font-jakarta font-bold text-foreground">{fmt(data.ivaSop)} €</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gastos + recibidas</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic text-center">
        El P&amp;L excluye IVA/IGIC. Estimación basada en registros Taxea Portal. Revisión definitiva por tu asesor.
      </p>
    </div>
  );
}