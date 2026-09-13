import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS = {
  certified: {
    label: 'Base certificada',
    description: 'No se han detectado bloqueos estructurales en la lectura actual.',
    icon: BadgeCheck,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ring: 'text-emerald-600',
  },
  review: {
    label: 'Revisión recomendada',
    description: 'La estructura es utilizable, pero existen avisos que requieren criterio profesional.',
    icon: AlertTriangle,
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    ring: 'text-amber-600',
  },
  blocked: {
    label: 'Certificación bloqueada',
    description: 'Hay incoherencias estructurales que deben resolverse antes de cerrar o presentar.',
    icon: Ban,
    tone: 'border-red-200 bg-red-50 text-red-800',
    ring: 'text-red-600',
  },
};

const CHECK_STATUS = {
  pass: { label: 'Correcto', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Revisar', icon: AlertTriangle, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  blocked: { label: 'Bloqueo', icon: Ban, className: 'bg-red-50 text-red-700 border-red-200' },
};

/** @param {any} error */
const errorMessage = error => error?.response?.data?.error || error?.message || 'No se pudo ejecutar el control.';

function Metric({ label, value, tone = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className={cn('font-jakarta text-2xl font-bold', tone)}>{value ?? 0}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AccountingCertification({ companyId }) {
  const query = useQuery({
    queryKey: ['tax-accounting-certification', companyId],
    queryFn: async () => {
      const response = await base44.functions.invoke('taxAccountingCertification', { action: 'overview', companyId });
      const payload = response?.data ?? response;
      if (!payload?.success) throw new Error(payload?.error || 'No se pudo completar la certificación.');
      return payload;
    },
    enabled: Boolean(companyId),
    retry: 1,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Comprobando contabilidad, bancos y fiscalidad…</p>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <Ban className="mx-auto h-8 w-8 text-red-600" />
        <h2 className="mt-3 font-semibold text-red-900">No se pudo ejecutar el control</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-red-700">{errorMessage(query.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => query.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const certification = query.data?.certification;
  const config = STATUS[certification?.status] || STATUS.review;
  const HeaderIcon = config.icon;
  const sourceErrors = Object.entries(query.data?.sourceErrors || {});
  const generatedAt = certification?.generatedAt
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(certification.generatedAt))
    : '—';

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', config.tone)}>
                <HeaderIcon className="h-3.5 w-3.5" /> {config.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Solo lectura
              </span>
            </div>
            <h2 className="mt-3 font-jakarta text-xl font-semibold text-foreground">Certificación contable, bancaria y fiscal</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{config.description} Este control no corrige, contabiliza ni modifica datos por sí solo.</p>
            <p className="mt-2 text-xs text-muted-foreground">Empresa: {query.data?.company?.name || 'Empresa activa'} · Ejecutado: {generatedAt}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn('flex h-24 w-24 flex-col items-center justify-center rounded-full border-8 border-current/15 bg-background', config.ring)}>
              <span className="font-jakarta text-2xl font-bold">{certification?.score ?? 0}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">sobre 100</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} /> Actualizar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border bg-muted/20 p-4 md:grid-cols-4">
          <Metric label="Controles" value={certification?.summary?.checks} />
          <Metric label="Correctos" value={certification?.summary?.passed} tone="text-emerald-600" />
          <Metric label="A revisar" value={certification?.summary?.review} tone="text-amber-600" />
          <Metric label="Bloqueos" value={certification?.summary?.blocked} tone="text-red-600" />
        </div>
      </div>

      {sourceErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-900">Lectura incompleta</p>
              <p className="mt-1 text-xs leading-5 text-red-700">No se certifica silenciosamente una fuente que no se haya podido leer.</p>
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {sourceErrors.map(([name, message]) => <li key={name}><span className="font-semibold">{name}:</span> {message}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {(certification?.checks || []).map(item => {
          const state = CHECK_STATUS[item.status] || CHECK_STATUS.review;
          const Icon = state.icon;
          const metricEntries = Object.entries(item.metrics || {}).filter(([, value]) => typeof value === 'number').slice(0, 6);
          return (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                </div>
                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold', state.className)}>
                  <Icon className="h-3 w-3" /> {state.label}
                </span>
              </div>
              {metricEntries.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {metricEntries.map(([name, value]) => (
                    <span key={name} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">{name}: <strong className="text-foreground">{value}</strong></span>
                  ))}
                </div>
              )}
              {item.issues?.length > 0 && (
                <details className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">Ver {item.issues.length} incidencia(s) muestreada(s)</summary>
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-[10px] text-muted-foreground">
                    {item.issues.slice(0, 25).map((issue, index) => <pre key={`${item.id}-${index}`} className="whitespace-pre-wrap break-all">{JSON.stringify(issue)}</pre>)}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Esta certificación comprueba integridad técnica y trazabilidad. No sustituye la revisión profesional, la validación en la sede electrónica ni la aceptación de los importadores oficiales.
      </div>
    </div>
  );
}
