import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, Lock, Unlock, Plus, Minus, AlertTriangle } from 'lucide-react';

const ADJUSTMENT_TYPES = [
  { value: 'add_temporary_credits', label: 'Añadir créditos temporales', icon: Plus, color: 'text-green-700' },
  { value: 'remove_temporary_credits', label: 'Retirar créditos añadidos', icon: Minus, color: 'text-amber-700' },
  { value: 'correct_erroneous_consumption', label: 'Corregir consumo erróneo', icon: AlertTriangle, color: 'text-orange-700' },
  { value: 'temporary_unlimited_access', label: 'Acceso ilimitado temporal', icon: TrendingUp, color: 'text-blue-700' },
  { value: 'manual_block', label: 'Bloquear OCR', icon: Lock, color: 'text-red-700' },
  { value: 'manual_unblock', label: 'Desbloquear OCR', icon: Unlock, color: 'text-green-700' },
];

export default function AdminOcrAdjustmentModal({ period, client, planInfo, adminUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    adjustmentType: 'add_temporary_credits',
    credits: 0,
    reason: '',
    internalNote: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: period?.periodEnd || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsCredits = ['add_temporary_credits', 'remove_temporary_credits', 'correct_erroneous_consumption'].includes(form.adjustmentType);

  const handleSave = async () => {
    if (!form.reason.trim()) { setError('El motivo es obligatorio.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('adminAdjustOcrCredits', {
        billingAccountId: period.billingAccountId,
        quotaPeriodId: period.id,
        adjustmentType: form.adjustmentType,
        credits: Number(form.credits),
        reason: form.reason,
        internalNote: form.internalNote,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      });
      if (res.data?.error) { setError(res.data.error); setSaving(false); return; }
      onSaved();
    } catch (err) {
      setError('Error al aplicar el ajuste.');
    }
    setSaving(false);
  };

  const limit = period.currentPlanLimit + (period.manualCredits || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-jakarta font-bold text-lg">Gestionar créditos OCR</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {client?.legalName || period.billingAccountId} · {period.quarterKey}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Plan</p>
              <p className="font-semibold">{planInfo?.displayName || period.currentPlanCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Límite actual</p>
              <p className="font-semibold font-mono">{period.isUnlimited ? '∞' : limit}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Consumidas</p>
              <p className="font-semibold font-mono">{period.consumedCredits || 0}</p>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de ajuste *</label>
            <div className="grid grid-cols-1 gap-2">
              {ADJUSTMENT_TYPES.map(t => (
                <label key={t.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.adjustmentType === t.value ? 'border-primary bg-accent' : 'border-border hover:bg-muted/30'}`}>
                  <input type="radio" className="sr-only" value={t.value} checked={form.adjustmentType === t.value}
                    onChange={e => setForm(p => ({ ...p, adjustmentType: e.target.value }))} />
                  <t.icon className={`w-4 h-4 ${t.color}`} />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Credits */}
          {needsCredits && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Número de créditos *</label>
              <input type="number" min="0" max="10000" value={form.credits}
                onChange={e => setForm(p => ({ ...p, credits: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo *</label>
            <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Motivo del ajuste (visible en auditoría)"
              className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Internal note */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nota interna</label>
            <textarea value={form.internalNote} onChange={e => setForm(p => ({ ...p, internalNote: e.target.value }))}
              rows={2} placeholder="Solo visible para administradores"
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Válido desde</label>
              <input type="date" value={form.validFrom} onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Caduca el</label>
              <input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.reason.trim()} className="bg-primary hover:bg-primary/90">
            {saving ? 'Guardando...' : 'Aplicar ajuste'}
          </Button>
        </div>
      </div>
    </div>
  );
}