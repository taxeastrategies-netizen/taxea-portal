import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Lock, RefreshCw } from 'lucide-react';
import {MobileNavigationProvider,MobileScreenCache,useMobileNavigation} from './MobileNavigation';
import usePullToRefresh from './usePullToRefresh';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActions from '../FloatingActions';
import MobileBottomNav from './MobileBottomNav';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';
import { getImpersonation } from '@/lib/impersonation';
import SubscriptionGate from './SubscriptionGate';
import FutureBackdrop from './FutureBackdrop';
import PageTransition from './PageTransition';
import useAppGestures from '@/hooks/useAppGestures';
import useShellScrollLock from '@/hooks/useShellScrollLock';

function AppLayoutInner({ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany }) {
  useShellScrollLock();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const trackedRef = useRef(false);
  const impersonation = getImpersonation();
  const mainRef=useRef(null);
  const shellRef=useRef(null);
  const navigation=useMobileNavigation();
  useAppGestures(shellRef,navigation?.mobile);
  const refresh=usePullToRefresh(mainRef,location.pathname,navigation?.mobile);
  const outletContext={user,company,isAdmin,isSuperAdmin,userRole,loadingCompany,refreshCompany,subscription};

  useEffect(() => {
    if (!user?.id || isAdmin) return;
    base44.entities.Subscription.filter({ userId: user.id }).then(subs => {
      setSubscription(subs?.[0] || null);
    }).catch(() => {});
  }, [user?.id, isAdmin]);

  // Verificar si el usuario ha sido eliminado y expulsarlo (al montar y al cambiar de ruta)
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    const checkDeleted = async () => {
      try {
        const me = await base44.auth.me();
        if (me?.is_deleted || me?.status === 'eliminado') {
          base44.auth.logout('/login');
        }
        if (me?.status === 'bloqueado') {
          base44.auth.logout('/login?banned=1');
        }
      } catch {
        base44.auth.logout('/login');
      }
    };
    checkDeleted();
  }, [user?.id, isAdmin, location.pathname]);

  // Portal access control
  const PORTAL_LOCKED_PATHS = ['/suscripcion', '/ajustes', '/notificaciones'];
  const isPortalLocked = !isAdmin && user && user.isPortalActive === false;
  const isOnLockedPath = PORTAL_LOCKED_PATHS.some(p => location.pathname === p);

  // Redirigir usuarios con portal bloqueado
  useEffect(() => {
    if (isPortalLocked && !isOnLockedPath) {
      navigate('/suscripcion', { replace: true });
    }
  }, [isPortalLocked, isOnLockedPath, navigate]);

  // El servidor valida la identidad y controla los únicos campos de acceso que pueden cambiar.
  useEffect(() => {
    if (!user?.email || isAdmin || trackedRef.current) return;
    trackedRef.current = true;

    base44.functions.invoke('trackClientAccess', {}).catch(() => {
      trackedRef.current = false;
    });
  }, [user?.email, isAdmin]);

  // Routes that are always accessible regardless of subscription
  const FREE_PATHS = ['/', '/ajustes', '/suscripcion', '/notificaciones'];
  const isFreePath = FREE_PATHS.some(p => location.pathname === p) || isAdmin;
  const needsGate = !isFreePath;

  // Department pages get full-width, no max-width container
  const isDeptPage = location.pathname.startsWith('/tax-accounting') || location.pathname.startsWith('/finance');

  return (
    <div ref={shellRef} className="taxea-future-shell relative isolate flex h-screen overflow-hidden bg-background flex-col">
      <FutureBackdrop />
      {impersonation && <ImpersonationBanner impersonation={impersonation} />}
      <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          userRole={userRole}
          isSubscriptionActive={isAdmin || subscription?.status === 'activa' || subscription?.status === 'prueba'}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            onMenuToggle={() => setSidebarOpen(true)}
            user={user}
            companyName={company?.nombre_comercial || company?.razon_social}
            isAdmin={isAdmin}
            onRefresh={refresh.refresh}
            refreshing={refresh.busy}
          />
          <main ref={mainRef} tabIndex={-1} className="taxea-future-main flex-1 overflow-y-auto overscroll-y-contain focus:outline-none" aria-busy={refresh.busy||navigation?.pending}>
            {navigation?.pending&&<p role="status" className="sticky top-0 z-20 bg-card/95 border-b border-border px-4 py-2 text-xs text-muted-foreground">Abriendo sección…</p>}
            <div className="sticky top-0 z-20 h-0 pointer-events-none flex justify-center" aria-hidden={refresh.distance===0&&!refresh.busy}>
              {(refresh.distance>0||refresh.busy)&&<div className="bg-card border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-2 text-xs" style={{transform:`translateY(${refresh.busy?12:Math.max(0,refresh.distance-20)}px)`}}><RefreshCw className={`w-4 h-4 ${refresh.busy?'animate-spin motion-reduce:animate-none':''}`}/>{refresh.busy?'Actualizando…':refresh.distance>=58?'Suelta para actualizar':'Desliza para actualizar'}</div>}
            </div>
            <p role="status" aria-live="polite" className={refresh.message&&!refresh.busy?'text-center text-xs text-muted-foreground px-4 py-2 bg-card/90':'sr-only'}>{refresh.message}</p>
            {isPortalLocked && !isOnLockedPath ? (
              <div className="flex items-center justify-center min-h-[60vh] p-6">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
                    <Lock className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="font-jakarta font-bold text-xl mb-2">Acceso pendiente de activación</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Tu cuenta todavía no está activa. Completa tu suscripción y espera la validación de Taxea.
                  </p>
                  <Button onClick={() => navigate('/suscripcion')} className="bg-teal hover:bg-teal-dark">
                    Ir a Suscripción
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`taxea-mobile-content p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 lg:p-6 ${isDeptPage?'':'max-w-[1400px] mx-auto'}`}>
                <SubscriptionGate required={needsGate} subscription={subscription} isAdmin={isAdmin}>
                  <PageTransition mainRef={mainRef}><MobileScreenCache context={outletContext} enabled={navigation?.mobile&&!impersonation&&!isAdmin} mainRef={mainRef}/></PageTransition>
                </SubscriptionGate>
              </div>
            )}
          </main>
        </div>
        <FloatingActions />
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default function AppLayout(props){
  const scope=`${props.user?.id||'anonymous'}:${props.company?.id||'no-company'}:${props.user?.role||'user'}`;
  return <MobileNavigationProvider key={scope}><AppLayoutInner {...props}/></MobileNavigationProvider>;
}

