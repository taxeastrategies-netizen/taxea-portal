import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActions from '../FloatingActions';

export default function AppLayout({ user, company, isAdmin, isSuperAdmin, userRole }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            <Outlet context={{ user, company, isAdmin, isSuperAdmin, userRole }} />
          </div>
        </main>
      </div>
      <FloatingActions />
    </div>
  );
}