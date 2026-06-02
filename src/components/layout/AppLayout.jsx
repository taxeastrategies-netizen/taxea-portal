import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
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
  const trackedRef = useRef(false);
  const impersonation = getImpersonation();

  useEffect(() => {
    if (!user?.id || isAdmin) return;
    base44.entities.Subscription.filter({ userId: user.id }).then(subs => {
      setSubscription(subs?.[0] || null);
    }).catch(() => {});
  }, [user?.id, isAdmin]);

  // Verificar periódicamente si el usuario ha sido eliminado y expulsarlo
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    const checkDeleted = async () => {
      const users = await base44.entities.User.filter({ id: user.id });
      const u = users?.[0];
      if (u?.is_deleted || u?.status === 'eliminado') {
        base44.auth.logout('/login');
      }
    };
    checkDeleted();
    const interval = setInterval(checkDeleted, 30000);
    return () => clearInterval(interval);
  }, [user?.id, isAdmin]);

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
            {isDeptPage ? (
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