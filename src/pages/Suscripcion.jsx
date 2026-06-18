import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle, Clock, AlertCircle, XCircle, CreditCard, Building2, User, Star, FileText } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';

const PLANS = [
  {
    id: 'basic_monthly',
    code: 'basic_monthly',
    name: 'Plan Básico',
    price: '9,99 €',
    priceNum: 9.99,
    period: '/mes',
    icon: CreditCard,
    audience: 'Cualquier usuario',
    includes: ['Acceso a la plataforma Taxea Portal'],
    excludes: 'Este plan incluye exclusivamente el acceso a la plataforma. No incluye asesoramiento de ningún tipo.',
    requiresAcceptance: true,
    eligibility: null,
  },
  {
    id: 'autonomo_monthly',
    code: 'autonomo_monthly',
    name: 'Plan Autónomo',
    price: '69,99 €',
    priceNum: 69.99,
    period: '/mes',
    icon: User,
    audience: 'Solo autónomos',
    includes: ['Acceso a la plataforma Taxea Portal', 'Servicios fiscales y contables para autónomos'],
    excludes: null,
    requiresAcceptance: false,
    eligibility: 'autonomo',
  },
  {
    id: 'mercantil_monthly',
    code: 'mercantil_monthly',
    name: 'Plan Mercantil',
    price: '199,99 €',
    priceNum: 199.99,
    period: '/mes',
    icon: Building2,
    audience: 'Sociedades limitadas',
    includes: ['Acceso a la plataforma Taxea Portal', 'Servicios fiscales y contables completos para empresas'],
    excludes: null,
    requiresAcceptance: false,
    eligibility: 'empresa',
  },
];

function BillingDataForm({ user, onComplete, onCancel }) {
  const [form, setForm] = useState({
    tax_id: user.tax_id || '',
    legal_form: user.legal_form || '',
    billing_address: user.billing_address || '',
    billing_postal_code: user.billing_postal_code || '',
    billing_city: user.billing_city || '',
    billing_province: user.billing_province || '',
    billing_country: user.billing_country || 'España',
    phone: user.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const isValid = form.tax_id && form.billing_address && form.billing_city;

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(user.id, form);
    setSaving(false);
    onComplete();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
      <h3 className="font-jakarta font-semibold mb-1">Datos de facturación</h3>
      <p className="text-sm text-muted-foreground mb-5">Completa tus datos para poder iniciar la suscripción.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">NIF / NIE / CIF *</label>
          <input value={form.tax_id} onChange={e => setForm(p => ({ ...p, tax_id: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Forma jurídica</label>
          <select value={form.legal_form} onChange={e => setForm(p => ({ ...p, legal_form: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">— Seleccionar —</option>
            <option value="Autónomo">Autónomo</option>
            <option value="Sociedad Limitada">Sociedad Limitada</option>
            <option value="Sociedad Anónima">Sociedad Anónima</option>
            <option value="Comunidad de Bienes">Comunidad de Bienes</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección de facturación *</label>
          <input value={form.billing_address} onChange={e => setForm(p => ({ ...p, billing_address: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Código postal</label>
          <input value={form.billing_postal_code} onChange={e => setForm(p => ({ ...p, billing_postal_code: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Localidad *</label>
          <input value={form.billing_city} onChange={e => setForm(p => ({ ...p, billing_city: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Provincia</label>
          <input value={form.billing_province} onChange={e => setForm(p => ({ ...p, billing_province: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">País</label>
          <input value={form.billing_country} onChange={e => setForm(p => ({ ...p, billing_country: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono</label>
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!isValid || saving} className="bg-teal hover:bg-teal-dark">
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </Button>
      </div>
    </div>
  );
}

function QuoteRequestForm({ user, onClose, onSent }) {
  const [form, setForm] = useState({ caseType: '', description: '', urgency: 'media', phone: user.phone || '' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.caseType || !form.description) return;
    setSending(true);
    await base44.entities.QuoteRequest.create({
      userId: user.id,
      caseType: form.caseType,
      description: form.description,
      urgency: form.urgency,
      phone: form.phone,
      status: 'Nueva',
    });
    await base44.entities.UserAuditLog.create({
      userId: user.id,
      actionType: 'suscripcion_solicitada',
      actionBy: user.email,
      actionAt: new Date().toISOString(),
      details: `Solicitud de presupuesto: ${form.caseType}`,
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
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        alert(res.data?.error || 'No se pudo abrir el portal.');
      }
    } catch {
      alert('Error al conectar con el portal de facturación.');
    }
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

export default function Suscripcion() {
  const { user } = useOutletContext() || {};
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [acceptNoAdvisory, setAcceptNoAdvisory] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);

  const loadSubscription = async () => {
    if (!user?.id) return;
    setLoading(true);
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    setSubscription(subs?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { loadSubscription(); }, [user?.id]);

  // Efecto para checkout return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'success') {
      loadSubscription();
    }
  }, []);

  const handleChoosePlan = (plan) => {
    setErrorMsg('');
    // Validar elegibilidad
    if (plan.eligibility === 'autonomo' && user.business_type !== 'autonomo') {
      setErrorMsg('Este plan está disponible exclusivamente para autónomos.');
      return;
    }
    if (plan.eligibility === 'empresa' && user.legal_form !== 'Sociedad Limitada') {
      setErrorMsg('Este plan está disponible exclusivamente para sociedades limitadas.');
      return;
    }
    setSelectedPlan(plan);
    setAcceptNoAdvisory(false);
    // Verificar si necesita datos de facturación
    if (!user.tax_id || !user.billing_address || !user.billing_city) {
      setShowBillingForm(true);
    } else {
      handleStartCheckout(plan);
    }
  };

  const handleStartCheckout = async (plan) => {
    setCheckingOut(true);
    setErrorMsg('');
    try {
      const response = await base44.functions.invoke('createStripeCheckout', {
        planCode: plan.code,
      });
      if (response.data?.url) {
        // Check if running in iframe
        if (window.self !== window.top) {
          alert('El pago solo funciona desde la aplicación publicada. Abre esta página directamente.');
          setCheckingOut(false);
          return;
        }
        window.location.href = response.data.url;
      } else if (response.data?.error) {
        setErrorMsg(response.data.error);
      }
    } catch (err) {
      setErrorMsg('Error al iniciar el pago. Inténtalo de nuevo.');
    }
    setCheckingOut(false);
  };

  const handleBillingComplete = async () => {
    setShowBillingForm(false);
    if (selectedPlan) {
      // Recargar user data
      const me = await base44.auth.me();
      // Usar el plan seleccionado
      handleStartCheckout(selectedPlan);
    }
  };

  const getStatusConfig = () => {
    const s = subscription;
    if (!s || s.status === 'sin_suscripcion' || s.planCode === 'sin_suscripcion') {
      return { label: 'Sin suscripción', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: XCircle,
        message: 'Elige un plan y configura el pago recurrente para continuar con el alta.' };
    }
    if (s.status === 'pendiente_pago' || s.firstPaymentStatus === 'pending') {
      return { label: 'Pago pendiente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock,
        message: 'Estamos esperando la confirmación del procesador de pagos.' };
    }
    if (s.status === 'processing' || s.firstPaymentStatus === 'processing') {
      return { label: 'Pago en proceso', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: Clock,
        message: 'La domiciliación bancaria puede tardar varios días en confirmarse. Te avisaremos cuando el pago quede validado.' };
    }
    if (s.status === 'paid_pending_activation') {
      return { label: 'Pago verificado', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle,
        message: 'Tu suscripción está correctamente configurada y el primer pago ha sido confirmado. Taxea revisará el alta y activará tu cuenta.',
        sublabel: 'Pendiente de activación' };
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
        message: s.currentPeriodEnd ? `Acceso válido hasta el ${new Date(s.currentPeriodEnd).toLocaleDateString('es-ES')}.` : 'Tu suscripción ha sido cancelada.' };
    }
    return { label: 'Sin suscripción', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: XCircle,
      message: 'Elige un plan y configura el pago recurrente para continuar con el alta.' };
  };

  const cfg = getStatusConfig();
  const StatusIcon = cfg.icon;
  const hasActiveSub = subscription?.status === 'activa';
  const hasPaymentVerified = subscription?.status === 'paid_pending_activation';
  const showPlans = !subscription || ['sin_suscripcion', 'pendiente_seleccion', 'pendiente_pago'].includes(subscription.status);

  if (loading) {
    return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      <PageHeader title="Suscripción" subtitle="Estado de tu plan y acceso a Taxea Portal" />

      {/* Estado actual */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">Estado actual</p>
        <div className="flex items-center gap-3 mb-4">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${cfg.bg}`}>
            <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
            <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
          </div>
          {cfg.sublabel && (
            <span className="text-xs text-muted-foreground">{cfg.sublabel}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">{cfg.message}</p>

        {hasActiveSub && subscription && (
          <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm mb-4">
            {[
              ['Plan', subscription.planName],
              ['Importe', `${subscription.amount?.toFixed(2)} €`],
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

        {(hasActiveSub || subscription?.status === 'past_due') && (
          <CustomerPortalButton subscription={subscription} />
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{errorMsg}</div>
      )}

      {/* Mensaje checkout */}
      {new URLSearchParams(window.location.search).get('checkout') === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3 mb-6">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            <strong>Pago iniciado correctamente.</strong> Estamos procesando la confirmación. Recibirás una notificación cuando tu cuenta esté activa.
          </p>
        </div>
      )}

      {/* Elige tu plan */}
      {showPlans && (
        <>
          <div className="mb-4">
            <h2 className="font-jakarta font-bold text-lg mb-1">Elige tu plan</h2>
            <p className="text-sm text-muted-foreground">Selecciona el plan que mejor se adapta a tu actividad.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {PLANS.map(plan => {
              const PIcon = plan.icon;
              return (
                <div key={plan.id} className="bg-card border border-border rounded-xl p-6 shadow-card flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
                      <PIcon className="w-5 h-5 text-teal" />
                    </div>
                    <div>
                      <h3 className="font-jakarta font-semibold">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.audience}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-jakarta font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>

                  <div className="space-y-2 mb-5 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incluye</p>
                    {plan.includes.map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                    {plan.excludes && (
                      <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs text-red-700 leading-relaxed">{plan.excludes}</p>
                      </div>
                    )}
                  </div>

                  {plan.requiresAcceptance && (
                    <label className="flex items-start gap-2 mb-3 cursor-pointer">
                      <input type="checkbox" checked={acceptNoAdvisory}
                        onChange={e => setAcceptNoAdvisory(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-teal focus:ring-teal" />
                      <span className="text-xs text-muted-foreground">
                        Acepto que este plan incluye exclusivamente el acceso a la plataforma y no incluye asesoramiento.
                      </span>
                    </label>
                  )}

                  <Button
                    onClick={() => handleChoosePlan(plan)}
                    disabled={(plan.requiresAcceptance && !acceptNoAdvisory) || checkingOut}
                    className="w-full bg-teal hover:bg-teal-dark">
                    {checkingOut ? 'Redirigiendo al pago...' : 'Elegir plan'}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Servicios bajo presupuesto */}
      {!hasActiveSub && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold-light flex items-center justify-center">
              <FileText className="w-5 h-5 text-gold" />
            </div>
            <h3 className="font-jakarta font-semibold">Servicios bajo presupuesto</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Para expedientes complejos o servicios que requieren un análisis previo, cuéntanos tu caso y prepararemos un presupuesto personalizado.
          </p>
          {quoteSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Solicitud enviada correctamente. Te contactaremos pronto.
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowQuoteForm(true)}>
              Solicitar presupuesto
            </Button>
          )}
        </div>
      )}

      {/* Historial de facturación */}
      {subscription?.stripeSubscriptionId && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-card">
          <h3 className="font-jakarta font-semibold mb-1">Historial de facturación</h3>
          <p className="text-sm text-muted-foreground mb-4">Gestiona tus facturas, método de pago y cancelación desde el portal de facturación.</p>
          <CustomerPortalButton subscription={subscription} label="Ver portal de facturación" variant="outline" />
        </div>
      )}

      {/* Modales */}
      {showBillingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowBillingForm(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-jakarta font-bold">Datos de facturación</h2>
              <p className="text-sm text-muted-foreground mt-1">Necesitamos estos datos para emitir la factura.</p>
            </div>
            <div className="p-6">
              <BillingDataForm user={user} onComplete={handleBillingComplete} onCancel={() => setShowBillingForm(false)} />
            </div>
          </div>
        </div>
      )}

      {showQuoteForm && (
        <QuoteRequestForm user={user} onClose={() => setShowQuoteForm(false)} onSent={() => { setShowQuoteForm(false); setQuoteSent(true); }} />
      )}
    </div>
  );
}