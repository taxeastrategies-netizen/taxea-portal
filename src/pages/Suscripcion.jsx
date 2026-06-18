import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle, Clock, AlertCircle, XCircle, CreditCard, Building2, User, Star, FileText, TrendingUp, Infinity } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import OcrUsageCard from '@/components/ocr/OcrUsageCard';

const CLIENT_TYPE_ICONS = { autonomo: User, company: Building2, platform: CreditCard };

function CustomerPortalButton({ subscription, label = 'Gestionar pago y suscripción', variant = 'outline' }) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (window.self !== window.top) {
      alert('El portal de facturación solo funciona desde la aplicación publicada.');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('stripeCustomerPortal', {});
      if (res.data?.url) window.location.href = res.data.url;
      else alert(res.data?.error || 'No se pudo abrir el portal.');
    } catch { alert('Error al conectar con el portal de facturación.'); }
    setLoading(false);
  };

  if (!subscription?.stripeCustomerId && !subscription?.stripeSubscriptionId) return null;

  return (
    <Button onClick={handleOpen} disabled={loading} variant={variant} className="gap-2">
      <CreditCard className="w-4 h-4" />
      {loading ? 'Abriendo portal...' : label}
    </Button>
  );
}

function QuoteRequestForm({ user, onClose, onSent }) {
  const [form, setForm] = useState({ caseType: '', description: '', urgency: 'media', phone: user.phone || '' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.caseType || !form.description) return;
    setSending(true);
    await base44.entities.QuoteRequest.create({
      userId: user.id, caseType: form.caseType, description: form.description,
      urgency: form.urgency, phone: form.phone, status: 'Nueva',
    });
    setSending(false);
    onSent();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-jakarta font-bold">Solicitar presupuesto</h2>
          <p className="text-sm text-muted-foreground mt-1">Cuéntanos tu caso y prepararemos un presupuesto personalizado.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de expediente *</label>
            <select value={form.caseType} onChange={e => setForm(p => ({ ...p, caseType: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">— Seleccionar —</option>
              <option value="fiscal">Fiscal</option>
              <option value="contable">Contable</option>
              <option value="laboral">Laboral</option>
              <option value="mercantil">Mercantil</option>
              <option value="legal">Legal</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción *</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={4} placeholder="Describe tu caso o necesidad..."
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Urgencia</label>
            <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSend} disabled={!form.caseType || !form.description || sending} className="bg-teal hover:bg-teal-dark">
            {sending ? 'Enviando...' : 'Solicitar presupuesto'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Suscripcion() {
  const { user } = useOutletContext() || {};
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [acceptPlatform, setAcceptPlatform] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState(null);
  const [upgradingTo, setUpgradingTo] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const checkoutResult = urlParams.get('checkout') || urlParams.get('upgrade');
  const showUpgradeAction = urlParams.get('action') === 'upgrade';

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [subs, plansRes] = await Promise.all([
      base44.entities.Subscription.filter({ userId: user.id }),
      base44.entities.PlanCatalog.filter({ isActive: true }),
    ]);
    setSubscription(subs?.[0] || null);
    setPlans(plansRes || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  // Load upgrade info if active subscription
  useEffect(() => {
    if (subscription?.status === 'activa' && subscription?.planCode) {
      const currentPlan = plans.find(p => p.planCode === subscription.planCode);
      if (currentPlan?.nextPlanCode) {
        const nextPlan = plans.find(p => p.planCode === currentPlan.nextPlanCode);
        if (nextPlan) {
          const diff = nextPlan.monthlyBasePrice - currentPlan.monthlyBasePrice;
          setUpgradeInfo({ currentPlan, nextPlan, diff });
        }
      }
    }
  }, [subscription, plans]);

  const handleChoosePlan = async (plan) => {
    if (window.self !== window.top) {
      alert('El pago solo funciona desde la aplicación publicada.');
      return;
    }
    setCheckingOut(true);
    setErrorMsg('');
    try {
      const response = await base44.functions.invoke('createStripeCheckout', { planCode: plan.planCode });
      if (response.data?.url) window.location.href = response.data.url;
      else setErrorMsg(response.data?.error || 'No se pudo iniciar el pago.');
    } catch { setErrorMsg('Error al iniciar el pago. Inténtalo de nuevo.'); }
    setCheckingOut(false);
  };

  const handleUpgrade = async (toPlanCode) => {
    if (window.self !== window.top) {
      alert('El pago solo funciona desde la aplicación publicada.');
      return;
    }
    setUpgradingTo(toPlanCode);
    setErrorMsg('');
    try {
      const response = await base44.functions.invoke('createPlanUpgradeCheckout', { toPlanCode });
      if (response.data?.url) window.location.href = response.data.url;
      else setErrorMsg(response.data?.error || 'No se pudo iniciar la ampliación.');
    } catch { setErrorMsg('Error al iniciar la ampliación.'); }
    setUpgradingTo(null);
  };

  const getStatusConfig = () => {
    const s = subscription;
    if (!s || s.status === 'sin_suscripcion' || !s.planCode || s.planCode === 'sin_suscripcion') {
      return { label: 'Sin suscripción', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: XCircle,
        message: 'Elige un plan y configura el pago recurrente para continuar.' };
    }
    if (s.status === 'pendiente_pago' || s.firstPaymentStatus === 'pending') {
      return { label: 'Pago pendiente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock,
        message: 'Estamos esperando la confirmación del procesador de pagos.' };
    }
    if (s.status === 'processing') {
      return { label: 'Pago en proceso', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: Clock,
        message: 'La domiciliación bancaria puede tardar varios días en confirmarse.' };
    }
    if (s.status === 'paid_pending_activation') {
      return { label: 'Pago verificado', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle,
        message: 'Tu pago ha sido confirmado. Taxea revisará el alta y activará tu cuenta.' };
    }
    if (s.status === 'activa') {
      return { label: 'Suscripción activa', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle,
        message: 'Tu cuenta está activa.' };
    }
    if (s.status === 'past_due') {
      return { label: 'Incidencia de pago', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertCircle,
        message: 'No hemos podido procesar la renovación. Revisa tu método de pago.' };
    }
    if (s.status === 'cancelada') {
      return { label: 'Suscripción cancelada', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: XCircle,
        message: subscription.currentPeriodEnd ? `Acceso válido hasta el ${new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}.` : 'Cancelada.' };
    }
    return { label: 'Sin suscripción', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: XCircle,
      message: 'Elige un plan para continuar.' };
  };

  const cfg = getStatusConfig();
  const StatusIcon = cfg.icon;
  const hasActiveSub = subscription?.status === 'activa';
  const isRealSubscription = subscription && !['sin_suscripcion', 'pendiente_seleccion'].includes(subscription.status);
  const showPlans = !isRealSubscription;

  const autonomoPlans = plans.filter(p => p.clientType === 'autonomo').sort((a, b) => a.sortOrder - b.sortOrder);
  const companyPlans = plans.filter(p => p.clientType === 'company').sort((a, b) => a.sortOrder - b.sortOrder);
  const platformPlan = plans.find(p => p.clientType === 'platform');

  if (loading) {
    return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      <PageHeader title="Suscripción" subtitle="Estado de tu plan y acceso a Taxea Portal" />

      {/* OCR Usage — only if active */}
      {hasActiveSub && (
        <div className="mb-6">
          <OcrUsageCard onUpgradeClick={upgradeInfo ? () => handleUpgrade(upgradeInfo.nextPlan.planCode) : undefined} />
        </div>
      )}

      {/* Estado actual */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">Estado actual</p>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${cfg.bg}`}>
            <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
            <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{cfg.message}</p>

        {hasActiveSub && subscription && (
          <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm mb-4">
            {[
              ['Plan', plans.find(p => p.planCode === subscription.planCode)?.displayName || subscription.planName || '—'],
              ['Cuota mensual', subscription.amount != null ? `${subscription.amount} € + impuestos` : '—'],
              ['Periodicidad', 'Mensual'],
              ['Fecha de alta', subscription.startedAt ? new Date(subscription.startedAt).toLocaleDateString('es-ES') : '—'],
              ['Próxima renovación', subscription.nextRenewalAt ? new Date(subscription.nextRenewalAt).toLocaleDateString('es-ES') : '—'],
              ['Método de pago', subscription.paymentMethodBrand ? `${subscription.paymentMethodBrand} ····${subscription.paymentMethodLast4}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        )}

        {(hasActiveSub || subscription?.status === 'past_due') && subscription?.stripeCustomerId && (
          <CustomerPortalButton subscription={subscription} />
        )}
      </div>

      {/* Upgrade panel — for active subscriptions with a next plan */}
      {hasActiveSub && upgradeInfo && (showUpgradeAction || true) && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-jakarta font-semibold">Ampliar al siguiente plan</h3>
              <p className="text-xs text-muted-foreground">{upgradeInfo.currentPlan.displayName} → {upgradeInfo.nextPlan.displayName}</p>
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-4 mb-4 grid sm:grid-cols-3 gap-3 text-sm text-center">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Plan actual</p>
              <p className="font-semibold">{upgradeInfo.currentPlan.displayName}</p>
              <p className="text-muted-foreground">{upgradeInfo.currentPlan.monthlyBasePrice} €/mes</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Diferencia a pagar ahora</p>
              <p className="font-bold text-primary text-lg">{upgradeInfo.diff} €</p>
              <p className="text-muted-foreground text-xs">base sin impuestos</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Nueva cuota mensual</p>
              <p className="font-semibold">{upgradeInfo.nextPlan.displayName}</p>
              <p className="text-muted-foreground">{upgradeInfo.nextPlan.monthlyBasePrice} €/mes</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Pagas ahora la diferencia de {upgradeInfo.diff} € más impuestos aplicables. Tras la confirmación del pago, tu límite trimestral se amplía a{' '}
            {upgradeInfo.nextPlan.isUnlimited ? 'sin máximo contractual definido' : `${upgradeInfo.nextPlan.quarterlyOcrLimit} facturas`}.
            Tu próxima mensualidad será de {upgradeInfo.nextPlan.monthlyBasePrice} € más impuestos.
          </p>
          <Button onClick={() => handleUpgrade(upgradeInfo.nextPlan.planCode)}
            disabled={!!upgradingTo} className="bg-primary hover:bg-primary/90 gap-2">
            <TrendingUp className="w-4 h-4" />
            {upgradingTo ? 'Redirigiendo a Stripe...' : `Pagar diferencia (${upgradeInfo.diff} €) y ampliar plan`}
          </Button>
        </div>
      )}

      {/* Errors */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{errorMsg}</div>
      )}

      {/* Checkout result messages */}
      {checkoutResult === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3 mb-6">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            <strong>Pago iniciado correctamente.</strong> Estamos procesando la confirmación. Recibirás una notificación cuando quede activo.
          </p>
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">El proceso de pago fue cancelado.</p>
        </div>
      )}

      {/* Plan catalog — new subscription */}
      {showPlans && (
        <>
          <div className="mb-5">
            <h2 className="font-jakarta font-bold text-lg mb-1">Elige tu plan</h2>
            <p className="text-sm text-muted-foreground">
              Cuotas mensuales sin impuestos. Límites trimestrales de procesamiento OCR de facturas.
              Serás redirigido a Stripe para completar el pago de forma segura.
            </p>
          </div>

          {checkingOut && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 mb-5">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-800 font-medium">Preparando el pago seguro con Stripe...</p>
            </div>
          )}

          {/* Platform plan */}
          {platformPlan && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Solo acceso a plataforma</h3>
              <div className="bg-card border border-border rounded-xl p-5 shadow-card flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-jakarta font-semibold">{platformPlan.displayName}</h4>
                    <p className="text-2xl font-bold mt-0.5">{platformPlan.monthlyBasePrice} €<span className="text-sm font-normal text-muted-foreground">/mes + impuestos</span></p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Solo incluye acceso a la plataforma. No incluye asesoramiento ni créditos OCR profesionales.</p>
                  <label className="flex items-start gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={acceptPlatform} onChange={e => setAcceptPlatform(e.target.checked)}
                      className="mt-0.5" />
                    <span className="text-xs text-muted-foreground">Acepto que este plan no incluye asesoramiento ni procesamiento OCR de facturas.</span>
                  </label>
                  <Button onClick={() => handleChoosePlan(platformPlan)}
                    disabled={!acceptPlatform || checkingOut} variant="outline" size="sm">
                    Contratar plan básico
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Autonomo plans */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Planes para autónomos</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {autonomoPlans.map(plan => (
                <PlanCard key={plan.planCode} plan={plan} onSelect={handleChoosePlan} disabled={checkingOut} />
              ))}
            </div>
          </div>

          {/* Company plans */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Planes para sociedades mercantiles</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companyPlans.map(plan => (
                <PlanCard key={plan.planCode} plan={plan} onSelect={handleChoosePlan} disabled={checkingOut} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Quote request */}
      {!hasActiveSub && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold-light flex items-center justify-center">
              <FileText className="w-5 h-5 text-gold" />
            </div>
            <h3 className="font-jakarta font-semibold">Servicios bajo presupuesto</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Para expedientes complejos o necesidades especiales, cuéntanos tu caso y prepararemos un presupuesto.
          </p>
          {quoteSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Solicitud enviada. Te contactaremos pronto.
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowQuoteForm(true)}>Solicitar presupuesto</Button>
          )}
        </div>
      )}

      {/* Billing history */}
      {subscription?.stripeSubscriptionId && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-card">
          <h3 className="font-jakarta font-semibold mb-1">Historial de facturación</h3>
          <p className="text-sm text-muted-foreground mb-4">Gestiona facturas, método de pago y cancelación desde el portal de facturación.</p>
          <CustomerPortalButton subscription={subscription} label="Ver portal de facturación" variant="outline" />
        </div>
      )}

      {showQuoteForm && (
        <QuoteRequestForm user={user} onClose={() => setShowQuoteForm(false)}
          onSent={() => { setShowQuoteForm(false); setQuoteSent(true); }} />
      )}
    </div>
  );
}

function PlanCard({ plan, onSelect, disabled }) {
  const Icon = CLIENT_TYPE_ICONS[plan.clientType] || CreditCard;
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h4 className="font-jakarta font-semibold text-sm">{plan.displayName}</h4>
      </div>
      <div className="mb-3">
        <span className="text-2xl font-jakarta font-bold">{plan.monthlyBasePrice} €</span>
        <span className="text-muted-foreground text-sm">/mes + impuestos</span>
      </div>
      <div className="flex items-center gap-2 mb-4 text-sm">
        {plan.isUnlimited ? (
          <>
            <Infinity className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">Sin máximo contractual definido</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-muted-foreground">{plan.quarterlyOcrLimit} facturas OCR por trimestre</span>
          </>
        )}
      </div>
      <Button onClick={() => onSelect(plan)} disabled={disabled}
        className="w-full bg-primary hover:bg-primary/90 mt-auto" size="sm">
        {disabled ? 'Redirigiendo...' : 'Contratar'}
      </Button>
    </div>
  );
}