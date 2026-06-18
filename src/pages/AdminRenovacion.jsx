import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Settings, Save, RefreshCw, AlertTriangle, CheckCircle, Clock, Mail } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_POLICIES = {
  grace_period_days: 3,
  auto_suspend_on_failed: true,
  max_retry_attempts: 3,
  retry_interval_days: 2,
  notify_admin_on_payment: true,
  notify_admin_on_failure: true,
  notify_user_days_before_renewal: 5,
  admin_notification_email: '',
  auto_cancel_after_days_past_due: 14,
};

export default function AdminRenovacion() {
  const { user, isAdmin } = useOutletContext() || {};
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar políticas guardadas (buscar en User del admin con rol)
      const me = await base44.auth.me();
      if (me?.renewalPolicies) {
        setPolicies({ ...DEFAULT_POLICIES, ...me.renewalPolicies });
      } else {
        setPolicies({ ...DEFAULT_POLICIES, admin_notification_email: me?.email || '' });
      }

      // Cargar pagos recientes
      const payments = await base44.asServiceRole.entities.PaymentRecord.list('-created_date', 20);
      setRecentPayments(payments || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ renewalPolicies: policies });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const set = (key, value) => setPolicies(p => ({ ...p, [key]: value }));

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-medium">Acceso denegado</p>
      </div>
    );
  }

  const STATUS_COLOR = { paid: 'text-green-600 bg-green-50', failed: 'text-red-600 bg-red-50', pending: 'text-amber-600 bg-amber-50', refunded: 'text-slate-500 bg-slate-50' };
  const TYPE_LABEL = { first_payment: 'Primer pago', renewal: 'Renovación', manual_exception: 'Manual' };

  return (
    <div>
      <PageHeader title="Políticas de Renovación" subtitle="Configura el comportamiento automático de pagos y renovaciones" />

      {loading ? (
        <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Panel de configuración */}
          <div className="space-y-5">
            {/* Periodo de gracia */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-teal" />
                <h3 className="font-jakarta font-semibold">Periodo de gracia y reintentos</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Días de gracia tras fallo de pago</Label>
                  <Input
                    type="number" min={0} max={30}
                    value={policies.grace_period_days}
                    onChange={e => set('grace_period_days', parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Máximo de reintentos automáticos</Label>
                  <Input
                    type="number" min={0} max={10}
                    value={policies.max_retry_attempts}
                    onChange={e => set('max_retry_attempts', parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Días entre reintentos</Label>
                  <Input
                    type="number" min={1} max={7}
                    value={policies.retry_interval_days}
                    onChange={e => set('retry_interval_days', parseInt(e.target.value) || 1)}
                    className="w-32"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Cancelar automáticamente si impago supera N días</Label>
                  <Input
                    type="number" min={0} max={90}
                    value={policies.auto_cancel_after_days_past_due}
                    onChange={e => set('auto_cancel_after_days_past_due', parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            {/* Notificaciones */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-teal" />
                <h3 className="font-jakarta font-semibold">Notificaciones al administrador</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Email de notificaciones admin</Label>
                  <Input
                    type="email"
                    value={policies.admin_notification_email}
                    onChange={e => set('admin_notification_email', e.target.value)}
                    placeholder="admin@taxea.co"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={policies.notify_admin_on_payment}
                    onChange={e => set('notify_admin_on_payment', e.target.checked)}
                    className="rounded border-gray-300 text-teal" />
                  <span className="text-sm">Notificar cuando se confirma un pago</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={policies.notify_admin_on_failure}
                    onChange={e => set('notify_admin_on_failure', e.target.checked)}
                    className="rounded border-gray-300 text-teal" />
                  <span className="text-sm">Notificar cuando falla un pago o renovación</span>
                </label>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Avisar al usuario N días antes de la renovación</Label>
                  <Input
                    type="number" min={0} max={30}
                    value={policies.notify_user_days_before_renewal}
                    onChange={e => set('notify_user_days_before_renewal', parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            {/* Acciones automáticas */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-teal" />
                <h3 className="font-jakarta font-semibold">Acciones automáticas</h3>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={policies.auto_suspend_on_failed}
                  onChange={e => set('auto_suspend_on_failed', e.target.checked)}
                  className="rounded border-gray-300 text-teal" />
                <span className="text-sm">Suspender acceso automáticamente si el pago falla</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2 ml-6">
                Si está activo, cuando Stripe reporta un pago fallido el acceso del usuario se marca como bloqueado hasta que se resuelva.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar políticas'}
              </Button>
              {saved && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" /> Guardado correctamente
                </div>
              )}
            </div>
          </div>

          {/* Historial de pagos recientes */}
          <div>
            <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-jakarta font-semibold">Pagos recientes</h3>
                <Button variant="ghost" size="sm" onClick={loadData} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                </Button>
              </div>
              {recentPayments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No hay registros de pago aún.</div>
              ) : (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {recentPayments.map(p => (
                    <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] || 'text-slate-500 bg-slate-50'}`}>
                            {p.status === 'paid' ? 'Pagado' : p.status === 'failed' ? 'Fallido' : p.status === 'pending' ? 'Pendiente' : p.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{TYPE_LABEL[p.paymentType] || p.paymentType}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(p.created_date).toLocaleDateString('es-ES')}
                          {p.stripeInvoiceId && <span className="ml-2 opacity-60">{p.stripeInvoiceId.substring(0, 12)}…</span>}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className={`font-semibold text-sm ${p.status === 'paid' ? 'text-green-600' : p.status === 'failed' ? 'text-red-500' : 'text-foreground'}`}>
                          {p.amount != null ? `${p.amount.toFixed(2)} ${p.currency || 'EUR'}` : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}