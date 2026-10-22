import {Lock} from 'lucide-react';
import {Link} from 'react-router-dom';
export default function SubscriptionGate({subscription,isAdmin,required=true,children}){
  if(!required||isAdmin||subscription?.status==='activa'||subscription?.status==='prueba')return children;
  // Never mount hidden financial screens while access is locked. This also
  // clears cached mobile forms if a subscription is suspended mid-session.
  return <div className="relative min-h-[60vh] flex items-center justify-center">
    <div className="relative z-10 text-center max-w-sm mx-auto px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5"><Lock className="w-8 h-8 text-primary"/></div>
      <h2 className="text-lg font-jakarta font-bold text-foreground mb-2">Acceso pendiente de activación</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">Esta sección se desbloqueará una vez que tu asesor de Taxea revise y active tu suscripción.</p>
      <Link to="/suscripcion" className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors">Ver estado de mi suscripción</Link>
      <p className="text-xs text-muted-foreground mt-4">¿Tienes dudas? Contacta con tu asesor.</p>
    </div>
  </div>;
}

