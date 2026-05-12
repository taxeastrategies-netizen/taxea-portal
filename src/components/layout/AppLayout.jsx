import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActions from '../FloatingActions';

export default function AppLayout({ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Department pages get full-width, no max-width container
  const isDeptPage = location.pathname.startsWith('/tax-accounting') || location.pathname.startsWith('/finance');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        userRole={userRole}
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
              <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany }} />
            </div>
          ) : (
            <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
              <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole, loadingCompany, refreshCompany }} />
            </div>
          )}
        </main>
      </div>
      <FloatingActions />
    </div>
  );
}