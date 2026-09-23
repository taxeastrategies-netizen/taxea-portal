import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { useCompanyContext, isAdminRole } from '@/lib/useCompanyContext';

// Code-split pages for smaller initial bundle (iOS/Android WebView performance)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Facturas = lazy(() => import('./pages/Facturas'));
const IngresosGastos = lazy(() => import('./pages/IngresosGastos'));
const Presupuestos = lazy(() => import('./pages/Presupuestos'));
const Proformas = lazy(() => import('./pages/Proformas'));
const Contactos = lazy(() => import('./pages/Contactos'));
const Productos = lazy(() => import('./pages/Productos'));
const NotasPredefinidas = lazy(() => import('./pages/NotasPredefinidas'));
const LibroRegistros = lazy(() => import('./pages/LibroRegistros'));
const LectorGastos = lazy(() => import('./pages/LectorGastos'));
const LectorIngresos = lazy(() => import('./pages/LectorIngresos'));
const ObligacionesFiscales = lazy(() => import('./pages/ObligacionesFiscales'));
const Documentos = lazy(() => import('./pages/Documentos'));
const Ajustes = lazy(() => import('./pages/Ajustes'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Tareas = lazy(() => import('./pages/Tareas'));
const DetectorErrores = lazy(() => import('./pages/DetectorErrores'));
const Notificaciones = lazy(() => import('./pages/Notificaciones'));
const AsistenteFiscal = lazy(() => import('./pages/AsistenteFiscal'));
const AdminAsistente = lazy(() => import('./pages/AdminAsistente'));
const BuzonSugerencias = lazy(() => import('./pages/BuzonSugerencias'));
const AdminSugerencias = lazy(() => import('./pages/AdminSugerencias'));
const AdminAfiliados = lazy(() => import('./pages/AdminAfiliados'));
const SubidaMasivaModelos = lazy(() => import('./pages/SubidaMasivaModelos'));
const AdminWhatsApp = lazy(() => import('./pages/AdminWhatsApp'));
const TaxAccounting = lazy(() => import('./pages/TaxAccounting'));
const Finance = lazy(() => import('./pages/Finance'));
const PeopleHR = lazy(() => import('./pages/PeopleHR.jsx'));
const Logistics = lazy(() => import('./pages/Logistics'));
const Operations = lazy(() => import('./pages/Operations'));
const Growth = lazy(() => import('./pages/Growth'));
const Law = lazy(() => import('./pages/Law'));
const PublicInvoiceViewer = lazy(() => import('./pages/PublicInvoiceViewer'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const AdminClients = lazy(() => import('./pages/AdminClients'));
const Suscripcion = lazy(() => import('./pages/Suscripcion'));
const GestionUsuarios = lazy(() => import('./pages/GestionUsuarios'));
const AdminAudit = lazy(() => import('./pages/AdminAudit'));
const AdminOcrCredits = lazy(() => import('./pages/AdminOcrCredits'));
const ImportacionContable = lazy(() => import('./pages/ImportacionContable'));
const AdminOcrBandeja = lazy(() => import('./pages/AdminOcrBandeja'));
const AdminBackupDrive = lazy(() => import('./pages/AdminBackupDrive'));
const SetupPassword = lazy(() => import('./pages/SetupPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Register = lazy(() => import('./pages/Register'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background safe-area-padded">
    <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppWithContext({ user }) {
  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const { company, loadingCompany, refreshCompany, setCompany } = useCompanyContext(user);

  // Admins no esperan a loadingCompany para ver el layout
  if (loadingCompany && !isAdmin) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background safe-area-padded">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-taxea-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout user={user} company={company} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} userRole={user?.role} loadingCompany={loadingCompany} refreshCompany={refreshCompany} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/facturas" element={<Facturas />} />
          <Route path="/ingresos-gastos" element={<IngresosGastos />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/proformas" element={<Proformas />} />
          <Route path="/contactos" element={<Contactos />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/notas" element={<NotasPredefinidas />} />
          <Route path="/libro-registros" element={<LibroRegistros />} />
          <Route path="/lector-gastos" element={<LectorGastos />} />
          <Route path="/lector-ingresos" element={<LectorIngresos />} />
          <Route path="/obligaciones" element={<ObligacionesFiscales />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/errores" element={<DetectorErrores />} />
          <Route path="/notificaciones" element={<Notificaciones />} />
          <Route path="/asistente" element={<AsistenteFiscal />} />
          <Route path="/admin-asistente" element={<AdminAsistente />} />
          <Route path="/sugerencias" element={<BuzonSugerencias />} />
          <Route path="/admin-sugerencias" element={<AdminSugerencias />} />
          <Route path="/admin-afiliados" element={<AdminAfiliados />} />
          <Route path="/subida-modelos" element={<SubidaMasivaModelos />} />
          <Route path="/admin-whatsapp" element={<AdminWhatsApp />} />
          <Route path="/tax-accounting" element={<TaxAccounting />} />
          <Route path="/tax-accounting/:module" element={<TaxAccounting />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/finance/:module" element={<Finance />} />
          <Route path="/people" element={<PeopleHR />} />
          <Route path="/people/:module" element={<PeopleHR />} />
          <Route path="/logistics" element={<Logistics />} />
          <Route path="/logistics/:module" element={<Logistics />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/operations/:module" element={<Operations />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/growth/:module" element={<Growth />} />
          <Route path="/law" element={<Law />} />
          <Route path="/law/:subdept" element={<Law />} />
          <Route path="/law/:subdept/:module" element={<Law />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/estado-contable" element={<Navigate to="/admin/ocr-bandeja" replace />} />
          <Route path="/suscripcion" element={<Suscripcion />} />
          <Route path="/admin/users" element={<GestionUsuarios />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/ocr-credits" element={<AdminOcrCredits />} />
          <Route path="/admin/ocr-bandeja" element={<AdminOcrBandeja />} />
          <Route path="/importacion-contable" element={<ImportacionContable />} />
          <Route path="/admin/backup-drive" element={<AdminBackupDrive />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background safe-area-padded">
        <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/register';
      if (!isOnLoginPage) { navigateToLogin(); return null; }
      // Already on login/register — just render those routes
      return (
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      );
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/public/invoice/:token" element={<PublicInvoiceViewer />} />
        <Route path="/setup-password" element={<SetupPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/*" element={<AppWithContext user={user} />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;