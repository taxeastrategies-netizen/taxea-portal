import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActions from '../FloatingActions';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';
import { getImpersonation } from '@/lib/impersonation';
import SubscriptionGate from './SubscriptionGate';

export default function AppLayout({ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const trackedRef = useRef(false);
  const impersonation = getImpersonation();

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

  // Tracking automático de primer acceso para clientes
  useEffect(() => {
    if (!user?.email || isAdmin || trackedRef.current) return;
    trackedRef.current = true;

    const trackAccess = async () => {
      try {
        const accounts = await base44.entities.ClientAccount.filter({ email: user.email });
        const account = accounts?.[0];
        if (!account) return;

        const now = new Date().toISOString();
        const updates = { lastLoginAt: now };

        if (!account.firstAccessCompleted) {
          updates.firstAccessCompleted = true;
          updates.passwordChangedByClient = true;
          updates.lastPasswordChangeAt = now;
          if (account.accessStatus === 'pendiente_primer_acceso') {
            updates.accessStatus = 'activa';
          }
          await base44.entities.ClientAccessAuditLog.create({
            clientAccountId: account.id,
            clientName: account.legalName,
            actionType: 'primer_acceso',
            actionBy: user.email,
            actionAt: now,
            details: 'Primer acceso completado. Contraseña establecida por el cliente.',
          });
        } else {
          await base44.entities.ClientAccessAuditLog.create({
            clientAccountId: account.id,
            clientName: account.legalName,
            actionType: 'login_correcto',
            actionBy: user.email,
            actionAt: now,
            details: 'Acceso al portal.',
          });
        }

        await base44.entities.ClientAccount.update(account.id, updates);
      } catch {}
    };

    trackAccess();
  }, [user?.email, isAdmin]);

  // Routes that are always accessible regardless of subscription
  const FREE_PATHS = ['/', '/ajustes', '/suscripcion', '/notificaciones'];
  const isFreePath = FREE_PATHS.some(p => location.pathname === p) || isAdmin;
  const needsGate = !isFreePath;

  // Department pages get full-width, no max-width container
  const isDeptPage = location.pathname.startsWith('/tax-accounting') || location.pathname.startsWith('/finance');

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col">
      {impersonation && <ImpersonationBanner impersonation={impersonation} />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
          />
          <main className="flex-1 overflow-y-auto">
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
            ) : isDeptPage ? (
              <div className="p-4 lg:p-6">
                {needsGate ? (
                  <SubscriptionGate subscription={subscription} isAdmin={isAdmin}>
                    <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany, subscription }} />
                  </SubscriptionGate>
                ) : (
                  <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany, subscription }} />
                )}
              </div>
            ) : (
              <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
                {needsGate ? (
                  <SubscriptionGate subscription={subscription} isAdmin={isAdmin}>
                    <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany, subscription }} />
                  </SubscriptionGate>
                ) : (
                  <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany, subscription }} />
                )}
              </div>
            )}
          </main>
        </div>
        <FloatingActions />
      </div>
    </div>
  );
}