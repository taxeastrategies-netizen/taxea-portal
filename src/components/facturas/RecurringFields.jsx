import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateNextRun, formatFrequency, DOW_LABELS, MONTH_LABELS } from '@/lib/recurringUtils';
import { Repeat, Info } from 'lucide-react';

export default function RecurringFields({ recurring, setRecurring }) {
  const update = (field, value) => setRecurring(prev => ({ ...prev, [field]: value }));

  const nextRunPreview = recurring.enabled && recurring.startDate
    ? calculateNextRun(recurring, recurring.startDate)
    : null;

  return (
    <div className="bg-secondary/30 rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-semibold cursor-pointer">Factura recurrente</Label>
        </div>
        <Switch
          checked={recurring.enabled}
          onCheckedChange={v => update('enabled', v)}
        />
      </div>

      {recurring.enabled && (
        <>
          <p className="text-xs text-muted-foreground">Generar automáticamente esta factura según una periodicidad.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Periodicidad</Label>
              <Select value={recurring.frequency} onValueChange={v => update('frequency', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cada</Label>
              <Input
                type="number" min="1" max="365"
                value={recurring.interval}
                onChange={e => update('interval', parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {recurring.frequency === 'weekly' && (
            <div className="space-y-1">
              <Label className="text-xs">Día de la semana</Label>
              <Select value={String(recurring.dayOfWeek)} onValueChange={v => update('dayOfWeek', parseInt(v))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOW_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {recurring.frequency === 'monthly' && (
            <div className="space-y-1">
              <Label className="text-xs">Día del mes</Label>
              <Input
                type="number" min="1" max="31"
                value={recurring.dayOfMonth}
                onChange={e => update('dayOfMonth', parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Si el mes no tiene ese día, se genera el último día del mes.</p>
            </div>
          )}

          {recurring.frequency === 'yearly' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mes</Label>
                <Select value={String(recurring.monthOfYear)} onValueChange={v => update('monthOfYear', parseInt(v))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Día</Label>
                <Input
                  type="number" min="1" max="31"
                  value={recurring.dayOfMonthYearly}
                  onChange={e => update('dayOfMonthYearly', parseInt(e.target.value) || 1)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha de inicio</Label>
              <Input type="date" value={recurring.startDate} onChange={e => update('startDate', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de fin (opcional)</Label>
              <Input type="date" value={recurring.endDate || ''} onChange={e => update('endDate', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vencimiento</Label>
              <Select value={recurring.dueDateMode} onValueChange={v => update('dueDateMode', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_after">X días después</SelectItem>
                  <SelectItem value="same_day">Mismo día</SelectItem>
                  <SelectItem value="fixed_day">Día fijo del mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurring.dueDateMode === 'days_after' && (
              <div className="space-y-1">
                <Label className="text-xs">Días de vencimiento</Label>
                <Input type="number" min="0" max="365"
                  value={recurring.dueDaysAfterIssue}
                  onChange={e => update('dueDaysAfterIssue', parseInt(e.target.value) || 30)}
                  className="h-8 text-sm" />
              </div>
            )}
            {recurring.dueDateMode === 'fixed_day' && (
              <div className="space-y-1">
                <Label className="text-xs">Día del mes</Label>
                <Input type="number" min="1" max="31"
                  value={recurring.dueDayOfMonth}
                  onChange={e => update('dueDayOfMonth', parseInt(e.target.value) || 15)}
                  className="h-8 text-sm" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Modo de generación</Label>
            <Select value={recurring.mode} onValueChange={v => update('mode', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_issue">Emitir automáticamente</SelectItem>
                <SelectItem value="draft_review">Crear borrador para revisar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {nextRunPreview && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Próxima generación: <strong>{nextRunPreview.split('-').reverse().join('/')}</strong>
                {' · '}
                {formatFrequency(recurring)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}