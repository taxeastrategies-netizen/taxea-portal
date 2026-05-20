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

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Facturas from './pages/Facturas';
import IngresosGastos from './pages/IngresosGastos';
import Presupuestos from './pages/Presupuestos';
import Proformas from './pages/Proformas';
import Contactos from './pages/Contactos';
import Productos from './pages/Productos';
import NotasPredefinidas from './pages/NotasPredefinidas';
import LibroRegistros from './pages/LibroRegistros';
import LectorGastos from './pages/LectorGastos';
import LectorIngresos from './pages/LectorIngresos';
import ObligacionesFiscales from './pages/ObligacionesFiscales';
import Documentos from './pages/Documentos';
import Ajustes from './pages/Ajustes';
import AdminPanel from './pages/AdminPanel';
import Timeline from './pages/Timeline';
import Tareas from './pages/Tareas';
import DetectorErrores from './pages/DetectorErrores';
import CRMInterno from './pages/CRMInterno';
import Notificaciones from './pages/Notificaciones';
import AsistenteFiscal from './pages/AsistenteFiscal';
import AdminAsistente from './pages/AdminAsistente';
import BuzonSugerencias from './pages/BuzonSugerencias';
import AdminSugerencias from './pages/AdminSugerencias';
import AdminAfiliados from './pages/AdminAfiliados';
import SubidaMasivaModelos from './pages/SubidaMasivaModelos';
import AdminWhatsApp from './pages/AdminWhatsApp';
import TaxAccounting from './pages/TaxAccounting';
import Finance from './pages/Finance';
import PeopleHR from './pages/PeopleHR.jsx';
import Logistics from './pages/Logistics';
import Operations from './pages/Operations';
import Law from './pages/Law';
import PublicInvoiceViewer from './pages/PublicInvoiceViewer';

function AppWithContext({ user }) {
  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const { company, loadingCompany, refreshCompany, setCompany } = useCompanyContext(user);

  // Admins no esperan a loadingCompany para ver el layout
  if (loadingCompany && !isAdmin) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-taxea-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  return (
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
        <Route path="/crm" element={<CRMInterno />} />
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
        <Route path="/law" element={<Law />} />
        <Route path="/law/:subdept" element={<Law />} />
        <Route path="/law/:subdept/:module" element={<Law />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public/invoice/:token" element={<PublicInvoiceViewer />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/*" element={<AppWithContext user={user} />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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