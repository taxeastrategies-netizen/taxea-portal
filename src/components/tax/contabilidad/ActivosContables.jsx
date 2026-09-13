import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Boxes, CalendarClock, CheckCircle2, Loader2, Plus } from 'lucide-react';
import AeatAmortizationGuide from './AeatAmortizationGuide';

const money = (value) => Number(value || 0).toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** @param {any} value */
const errorMessage = value => value?.response?.data?.error || value?.message || 'No se pudo completar la operación.';

const initialForm = {
  name: '',
  acquisitionDate: '',
  inServiceDate: '',
  cost: '',
  residualValue: '0',
  usefulLifeMonths: '60',
  depreciationRate: '20',
  fiscalTable: 'manual',
  fiscalCategoryCode: '',
  fiscalCategoryLabel: '',
  fiscalMaxRate: '',
  fiscalMaxYears: '',
  assetAccountCode: '21700000',
  accumulatedDepreciationAccountCode: '28170000',
  expenseAccountCode: '68100000',
};

export default function ActivosContables({ companyId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const query = useQuery({
    queryKey: ['accounting-assets', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const response = await base44.functions.invoke('accountingOperations', {
        action: 'assets_overview',
        companyId,
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
  });

  const run = useMutation({
    mutationFn: async (/** @type {Record<string, any>} */ payload) => {
      const response = await base44.functions.invoke('accountingOperations', { companyId, ...payload });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounting-assets', companyId] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const assets = query.data?.assets || [];
  const schedule = query.data?.schedule || [];
  const selectedSchedule = useMemo(
    () => schedule.filter((line) => line.assetId === selectedAssetId),
    [schedule, selectedAssetId],
  );

  const save = async () => {
    await run.mutateAsync({ action: 'save_asset', ...form });
    setForm(initialForm);
    setShowForm(false);
    toast.success('Activo guardado. El cuadro se genera solo cuando lo confirmes.');
  };

  const setRate = (value) => {
    const rate = Number(value);
    setForm({
      ...form,
      depreciationRate: value,
      usefulLifeMonths: rate > 0 ? String(Math.ceil(1200 / rate)) : form.usefulLifeMonths,
    });
  };

  const applyFiscalGuide = (row) => {
    const rate = Number(row.rate);
    setForm({
      ...form,
      depreciationRate: String(rate),
      usefulLifeMonths: String(Math.ceil(1200 / rate)),
      fiscalTable: row.table === 'eds' ? 'irpf_eds' : row.table,
      fiscalCategoryCode: row.code,
      fiscalCategoryLabel: row.label,
      fiscalMaxRate: String(rate),
      fiscalMaxYears: String(row.years),
    });
    setShowForm(true);
    toast.success(`Referencia fiscal aplicada: ${rate}% anual.`);
  };

  if (!companyId) return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Selecciona una empresa.</div>;
  if (query.isLoading) return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const totals = query.data?.totals || {};
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['Coste activo', totals.cost],
          ['Amortización contabilizada', totals.postedDepreciation],
          ['Amortización pendiente', totals.pendingDepreciation],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{money(value)} €</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4" /> Inmovilizado y amortizaciones</h3>
            <p className="mt-1 text-xs text-muted-foreground">Cuadro lineal mensual. Cada cuota usa el motor contable, respeta bloqueos y no puede contabilizarse dos veces.</p>
          </div>
          <Button type="button" onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" /> Nuevo activo</Button>
        </div>

        {showForm && (
          <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-3">
            <label className="text-xs font-medium md:col-span-2">Nombre<Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="text-xs font-medium">Coste<Input className="mt-1" type="number" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label>
            <label className="text-xs font-medium">Fecha de compra<Input className="mt-1" type="date" value={form.acquisitionDate} onChange={(event) => setForm({ ...form, acquisitionDate: event.target.value })} /></label>
            <label className="text-xs font-medium">Puesta en servicio<Input className="mt-1" type="date" value={form.inServiceDate} onChange={(event) => setForm({ ...form, inServiceDate: event.target.value })} /></label>
            <label className="text-xs font-medium">Amortización anual (%)<Input className="mt-1" type="number" min="0.01" max="100" step="0.01" value={form.depreciationRate} onChange={(event) => setRate(event.target.value)} /></label>
            <label className="text-xs font-medium">Vida útil resultante (meses)<Input className="mt-1" type="number" min="1" max="1200" value={form.usefulLifeMonths} onChange={(event) => setForm({ ...form, usefulLifeMonths: event.target.value, depreciationRate: String(Number(event.target.value) > 0 ? Number((1200 / Number(event.target.value)).toFixed(4)) : '') })} /></label>
            <label className="text-xs font-medium">Valor residual<Input className="mt-1" type="number" step="0.01" value={form.residualValue} onChange={(event) => setForm({ ...form, residualValue: event.target.value })} /></label>
            <label className="text-xs font-medium">Cuenta del activo<Input className="mt-1 font-mono" value={form.assetAccountCode} onChange={(event) => setForm({ ...form, assetAccountCode: event.target.value })} /></label>
            <label className="text-xs font-medium">Amortización acumulada<Input className="mt-1 font-mono" value={form.accumulatedDepreciationAccountCode} onChange={(event) => setForm({ ...form, accumulatedDepreciationAccountCode: event.target.value })} /></label>
            <label className="text-xs font-medium">Gasto de amortización<Input className="mt-1 font-mono" value={form.expenseAccountCode} onChange={(event) => setForm({ ...form, expenseAccountCode: event.target.value })} /></label>
            <div className="flex items-end"><Button type="button" className="w-full" onClick={save} disabled={run.isPending}>{run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar activo</Button></div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold">Activos</h4>
          <div className="space-y-2">
            {assets.length === 0 && <p className="text-sm text-muted-foreground">No hay activos registrados.</p>}
            {assets.map((asset) => {
              const assetLines = schedule.filter((line) => line.assetId === asset.id);
              return (
                <button key={asset.id} className={`w-full rounded-lg border p-3 text-left ${selectedAssetId === asset.id ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setSelectedAssetId(asset.id)}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{asset.name}</span><span className="text-xs text-muted-foreground">{asset.status}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{money(asset.cost)} € · {Number(asset.depreciationRate || (1200 / Number(asset.usefulLifeMonths || 1))).toLocaleString('es-ES', { maximumFractionDigits: 4 })}% anual · {asset.usefulLifeMonths} meses · {assetLines.length} cuotas</p>
                  {asset.fiscalCategoryLabel && <p className="mt-1 text-[11px] text-muted-foreground">Guía fiscal: {asset.fiscalCategoryLabel}</p>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4" /> Cuadro mensual</h4>
            {selectedAssetId && selectedSchedule.length === 0 && (
              <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ action: 'generate_amortization_schedule', assetId: selectedAssetId })}>Generar cuadro</Button>
            )}
          </div>
          {!selectedAssetId && <p className="mt-4 text-sm text-muted-foreground">Selecciona un activo.</p>}
          <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
            {selectedSchedule.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div><p className="text-sm font-medium">{line.period} · {money(line.amount)} €</p><p className="text-xs text-muted-foreground">Valor neto: {money(line.netBookValue)} €</p></div>
                {line.status === 'posted' ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Contabilizada</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ action: 'post_amortization', scheduleLineId: line.id })}>Contabilizar</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <AeatAmortizationGuide onSelect={applyFiscalGuide} />
    </div>
  );
}

