import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, TrendingUp, FileCheck, Receipt,
  Package, BookMarked, BookOpen, ScanLine, ScanText, Calendar,
  ChevronRight, Menu, X
} from 'lucide-react';

// Sub-pages (rendered inline via hash/tab)
import TaxDashboard from '@/components/tax/TaxDashboard';
import Facturas from './Facturas';
import IngresosGastos from './IngresosGastos';
import Presupuestos from './Presupuestos';
import Proformas from './Proformas';
import Productos from './Productos';
import NotasPredefinidas from './NotasPredefinidas';
import LibroRegistros from './LibroRegistros';
import LectorGastos from './LectorGastos';
import LectorIngresos from './LectorIngresos';
import ObligacionesFiscales from './ObligacionesFiscales';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortLabel: 'Dashboard' },
  { id: 'facturas', label: 'Facturas', icon: FileText, shortLabel: 'Facturas' },
  { id: 'ingresos-gastos', label: 'Ingresos y Gastos', icon: TrendingUp, shortLabel: 'P&L' },
  { id: 'presupuestos', label: 'Presupuestos', icon: FileCheck, shortLabel: 'Presupuestos' },
  { id: 'proformas', label: 'Proformas', icon: Receipt, shortLabel: 'Proformas' },
  { id: 'productos', label: 'Productos / Servicios', icon: Package, shortLabel: 'Productos' },
  { id: 'notas', label: 'Notas Predefinidas', icon: BookMarked, shortLabel: 'Notas' },
  { id: 'libros', label: 'Libros Registro', icon: BookOpen, shortLabel: 'Libros' },
  { id: 'lector-gastos', label: 'Lector de Gastos', icon: ScanLine, shortLabel: 'OCR Gastos' },
  { id: 'lector-ingresos', label: 'Lector de Ingresos', icon: ScanText, shortLabel: 'OCR Ingresos' },
  { id: 'obligaciones', label: 'Obligaciones Fiscales', icon: Calendar, shortLabel: 'Obligaciones' },
];

export default function TaxAccounting() {
  // Context flows to sub-pages via React Router's useOutletContext automatically
  const location = useLocation();
  const navigate = useNavigate();

  // Parse section from URL hash or search
  const getActiveFromUrl = () => {
    const hash = location.hash.replace('#', '');
    return NAV_ITEMS.find(n => n.id === hash) ? hash : 'dashboard';
  };

  const [activeSection, setActiveSection] = useState(getActiveFromUrl);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const setSection = (id) => {
    setActiveSection(id);
    navigate(`/tax-accounting#${id}`, { replace: true });
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <TaxDashboard onNavigate={setSection} />;
      case 'facturas': return <Facturas />;
      case 'ingresos-gastos': return <IngresosGastos />;
      case 'presupuestos': return <Presupuestos />;
      case 'proformas': return <Proformas />;
      case 'productos': return <Productos />;
      case 'notas': return <NotasPredefinidas />;
      case 'libros': return <LibroRegistros />;
      case 'lector-gastos': return <LectorGastos />;
      case 'lector-ingresos': return <LectorIngresos />;
      case 'obligaciones': return <ObligacionesFiscales />;
      default: return <TaxDashboard onNavigate={setSection} />;
    }
  };

  const activeItem = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <div className="flex -m-4 lg:-m-6 h-[calc(100vh-56px)] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Internal Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0",
        "w-56 bg-[#0f0f11] border-r border-white/6",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/6">
          <div>
            <p className="text-white text-xs font-semibold uppercase tracking-widest opacity-40">Departamento</p>
            <p className="text-white font-jakarta font-bold text-sm mt-0.5">Tax & Accounting</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/30 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-left",
                  isActive
                    ? "bg-taxea-red text-white shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-white" : "text-white/40")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/6">
          <p className="text-white/20 text-xs text-center">Tax & Accounting</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Internal topbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <Menu className="w-4 h-4" />
          </button>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Tax & Accounting</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-foreground font-semibold">{activeItem?.label}</span>
          </div>
          {/* Quick nav pills — desktop */}
          <div className="hidden xl:flex items-center gap-1 ml-4 flex-1 overflow-x-auto">
            {NAV_ITEMS.slice(1).map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                  activeSection === item.id
                    ? "bg-taxea-red/10 text-taxea-red"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-3 h-3" />
                {item.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}