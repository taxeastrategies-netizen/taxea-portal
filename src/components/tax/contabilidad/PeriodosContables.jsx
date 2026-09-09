import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarClock, CheckCircle2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { toast } from 'sonner';

const unwrap = (response) => response?.data || response || {};

export default function PeriodosContables({ companyId }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [lockDate, setLockDate] = useState(`${currentYear}-12-31`);
  const [unlockReason, setUnlockReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [preview, setPreview] = useState(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['accounting-periods', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => unwrap(await base44.functions.invoke('accountingOperations', { action: 'periods_overview', companyId })),
  });
  const selected = useMemo(() => (query.data?.periods || []).find(item => Number(item.year) === Number(year)), [query.data, year]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounting-periods', companyId] });
  const mutation = useMutation({
    mutationFn: async (payload = {}) => unwrap(await base44.functions.invoke('accountingOperations', { companyId, ...payload })),
    onSuccess: (data) => {
      if (data.preview) setPreview(data.preview);
      refresh();
    },
    onError: (error) => toast.error(error?.message || 'No se pudo completar la operación.'),
  });
  const configure = async () => {
    await mutation.mutateAsync({ action: 'save_fiscal_year', year: Number(year), startDate: `${year}-01-01`, endDate: `${year}-12-31` });
    toast.success(`Ejercicio ${year} configurado.`);
  };
  const runPreview = async () => {
    const data = await mutation.mutateAsync({ action: 'closing_preview', year: Number(year) });
    setPreview(data.preview);
  };
  const closeYear = async () => {
    await mutation.mutateAsync({ action: 'closing_execute', year: Number(year), confirmation, apply: true });
    toast.success(`Ejercicio ${year} cerrado con regularización, cierre y apertura trazables.`);
    setConfirmation('');
    setPreview(null);
  };

  if (!companyId) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h3 className="font-semibold">Ejercicios y cierre contable</h3></div>
            <p className="mt-1 text-xs text-muted-foreground">Bloquea períodos cerrados y prepara regularización, cierre y apertura sin borrar asientos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" className="w-28" value={year} onChange={(event) => { setYear(Number(event.target.value)); setPreview(null); }} />
            {selected ? <Badge variant={selected.status === 'cerrado' ? 'secondary' : 'default'}>{selected.status}</Badge> : <Badge variant="outline">sin configurar</Badge>}
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm">El ejercicio {year} todavía no tiene calendario contable.</p>
          <Button className="mt-3" onClick={configure} disabled={mutation.isPending}>Configurar ejercicio natural</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between"><h4 className="font-medium">Bloqueo de períodos</h4><Badge variant="outline">{selected.lockedThroughDate ? `Hasta ${selected.lockedThroughDate}` : 'Sin bloqueo'}</Badge></div>
            <p className="text-xs text-muted-foreground">Las facturas, cobros, bancos y asientos manuales no podrán contabilizarse en fechas bloqueadas.</p>
            <div className="flex gap-2"><Input type="date" value={lockDate} onChange={(event) => setLockDate(event.target.value)} /><Button onClick={async () => { await mutation.mutateAsync({ action: 'set_period_lock', year, lockedThroughDate: lockDate }); toast.success('Período bloqueado.'); }} disabled={mutation.isPending || selected.status === 'cerrado'}><LockKeyhole className="mr-2 h-4 w-4" />Bloquear</Button></div>
            {selected.lockedThroughDate && selected.status !== 'cerrado' && <div className="space-y-2"><Input placeholder="Motivo obligatorio del desbloqueo" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} /><Button variant="outline" onClick={async () => { await mutation.mutateAsync({ action: 'set_period_lock', year, lockedThroughDate: '', reason: unlockReason }); toast.success('Período desbloqueado con trazabilidad.'); setUnlockReason(''); }} disabled={mutation.isPending || !unlockReason.trim()}><UnlockKeyhole className="mr-2 h-4 w-4" />Desbloquear</Button></div>}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div><h4 className="font-medium">Cierre integral</h4><p className="mt-1 text-xs text-muted-foreground">Primero ejecuta la prevalidación. El cierre se bloquea si hay asientos pendientes, descuadrados o apuntes huérfanos.</p></div>
            <Button variant="outline" onClick={runPreview} disabled={mutation.isPending || selected.status === 'cerrado'}>Analizar cierre</Button>
            {preview && <div className={`rounded-lg border p-3 text-xs ${preview.canClose ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <div className="flex items-center gap-2 font-medium">{preview.canClose ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}{preview.canClose ? 'Prevalidación superada' : 'Cierre bloqueado'}</div>
              <p className="mt-2">Resultado previo: {Number(preview.resultBeforeTax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
              {(preview.blockers || []).map(item => <p className="mt-1" key={item}>• {item}</p>)}
            </div>}
            {preview?.canClose && <div className="space-y-2"><Input placeholder={`Escribe CERRAR ${year}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><Button variant="destructive" onClick={closeYear} disabled={mutation.isPending || confirmation.trim().toUpperCase() !== `CERRAR ${year}`}>Cerrar ejercicio</Button></div>}
          </div>
        </div>
      )}
    </div>
  );
}

