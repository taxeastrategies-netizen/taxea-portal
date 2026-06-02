import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  CreditCard, CheckCircle, Clock, XCircle, AlertCircle, Zap,
  Building2, User, Star, Shield
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  sin_suscripcion:      { label: 'Sin suscripción',        color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',   icon: XCircle },
  pendiente_seleccion:  { label: 'Pendiente de selección', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  pendiente_pago:       { label: 'Pendiente de pago',      color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: AlertCircle },
  pendiente_validacion: { label: 'Pendiente de validación',color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     icon: Clock },
  activa:               { label: 'Activa',                 color: 'text-green-600',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle },
  suspendida:           { label: 'Suspendida',             color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       icon: AlertCircle },
  cancelada:            { label: 'Cancelada',              color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-200',  icon: XCircle },
  prueba:               { label: 'En prueba',              color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: Zap },
  caducada:             { label: 'Caducada',               color: 'text-red-500',    bg: 'bg-red-50 border-red-200',       icon: XCircle },
};

const PLANS = [
  { id: 'autonomo',     name: 'Autónomo',      icon: User,      desc: 'Para trabajadores autónomos y freelancers' },
  { id: 'empresa',      name: 'Empresa',       icon: Building2, desc: 'Para pymes y empresas en crecimiento' },
  { id: 'premium',      name: 'Premium',       icon: Star,      desc: 'Servicio completo con dedicación exclusiva', highlight: true },
  { id: 'personalizado',name: 'Personalizado', icon: Zap,       desc: 'Plan adaptado a tus necesidades concretas' },
];

const FEATURES_LIST = [
  'Gestión fiscal completa',
  'Declaraciones trimestrales y anuales',
  'Lector OCR de facturas con IA',
  'Informes financieros personalizados',
  'Asistente IA fiscal',
  'Atención directa con tu asesor',
];

export default function Suscripcion() {
  const { user } = useOutletContext() || {};
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadSubscription = async () => {
    if (!user?.id) return;
    setLoading(true);
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    setSubscription(subs?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { loadSubscription(); }, [user?.id]);

  const handleChoosePlan = async () => {
    if (!selectedPlan) return;
    setConfirming(true);
    if (subscription?.id) {
      await base44.entities.Subscription.update(subscription.id, {
        plan: selectedPlan,
        status: 'pendiente_validacion',
        requestedAt: new Date().toISOString(),
      });
    } else {
      await base44.entities.Subscription.create({
        userId: user.id,
        plan: selectedPlan,
        status: 'pendiente_validacion',
        requestedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      });
    }
    await base44.entities.UserAuditLog.create({
      userId: user.id,
      actionType: 'suscripcion_solicitada',
      actionBy: user.email,
      actionAt: new Date().toISOString(),
      details: `Plan solicitado: ${selectedPlan}`,
    });
    setConfirming(false);
    setShowPlans(false);
    setSuccess(true);
    loadSubscription();
  };

  const cfg = STATUS_CONFIG[subscription?.status] || STATUS_CONFIG.sin_suscripcion;
  const StatusIcon = cfg.icon;
  const hasActive = subscription?.status === 'activa' || subscription?.status === 'prueba';
  const canChoose = !subscription || !['activa', 'pendiente_validacion', 'pendiente_pago'].includes(subscription?.status);

  if (loading) {
    return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      <PageHeader title="Mi Suscripción" subtitle="Estado de tu plan y acceso a Taxea Portal" />

      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        {/* Estado */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-card">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">Estado actual</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-5 ${cfg.bg}`}>
            <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
            <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
          </div>

          {subscription && subscription.plan && subscription.plan !== 'sin_suscripcion' && (
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{subscription.plan}</span>
              </div>
              {subscription.startedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha de alta</span>
                  <span className="font-medium">{new Date(subscription.startedAt).toLocaleDateString('es-ES')}</span>
                </div>
              )}
              {subscription.renewalAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Próxima renovación</span>
                  <span className="font-medium">{new Date(subscription.renewalAt).toLocaleDateString('es-ES')}</span>
                </div>
              )}
            </div>
          )}

          {!subscription && (
            <p className="text-sm text-muted-foreground mb-5">Todavía no tienes ningún plan contratado.</p>
          )}

          {subscription?.status === 'pendiente_validacion' && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 mb-4">
              Tu solicitud ha sido recibida. Taxea revisará tu alta y activará el servicio en breve.
            </div>
          )}

          {canChoose && (
            <Button onClick={() => { setShowPlans(true); setSuccess(false); setSelectedPlan(null); }}
              className="w-full bg-teal hover:bg-teal-dark">
              Elegir plan
            </Button>
          )}
        </div>

        {/* Features */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-card">
          <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wide font-semibold">Incluye tu plan</p>
          {hasActive ? (
            <ul className="space-y-3">
              {FEATURES_LIST.map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Activa un plan para acceder a todas las funcionalidades de Taxea Portal.</p>
            </div>
          )}
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            <strong>¡Solicitud recibida!</strong> El equipo de Taxea revisará tu alta y activará el servicio cuando corresponda.
          </p>
        </div>
      )}

      {/* Modal planes */}
      {showPlans && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowPlans(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-jakarta font-bold">Elige tu plan</h2>
              <p className="text-sm text-muted-foreground mt-1">Selecciona el plan que mejor se adapta. Taxea validará y activará tu acceso.</p>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              {PLANS.map(plan => {
                const PIcon = plan.icon;
                const sel = selectedPlan === plan.id;
                return (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                    className={`text-left p-5 rounded-xl border-2 transition-all ${sel ? 'border-teal bg-teal/5' : 'border-border hover:border-teal/40'} ${plan.highlight ? 'ring-1 ring-amber-200' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sel ? 'bg-teal text-white' : 'bg-secondary text-muted-foreground'}`}>
                        <PIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{plan.name}</p>
                        {plan.highlight && <span className="text-xs text-amber-600 font-medium">Más popular</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.desc}</p>
                    <p className="text-xs font-medium text-foreground mt-2">Consultar precio</p>
                  </button>
                );
              })}
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPlans(false)}>Cancelar</Button>
              <Button onClick={handleChoosePlan} disabled={!selectedPlan || confirming} className="bg-teal hover:bg-teal-dark">
                {confirming ? 'Enviando solicitud...' : 'Solicitar plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}