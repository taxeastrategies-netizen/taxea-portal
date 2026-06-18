import { Menu, Bell, ChevronDown, LogOut, User, ChevronRight } from 'lucide-react';
import OcrTopBarBadge from '@/components/ocr/OcrTopBarBadge';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const BREADCRUMBS = {
  '/tax-accounting/dashboard': ['Tax & Accounting', 'Dashboard'],
  '/tax-accounting/facturas': ['Tax & Accounting', 'Facturas'],
  '/tax-accounting/ingresos-gastos': ['Tax & Accounting', 'Ingresos y Gastos'],
  '/tax-accounting/presupuestos': ['Tax & Accounting', 'Presupuestos'],
  '/tax-accounting/proformas': ['Tax & Accounting', 'Proformas'],
  '/tax-accounting/productos': ['Tax & Accounting', 'Productos / Servicios'],
  '/tax-accounting/notas': ['Tax & Accounting', 'Notas Predefinidas'],
  '/tax-accounting/libros': ['Tax & Accounting', 'Libros Registro'],
  '/tax-accounting/lector-gastos': ['Tax & Accounting', 'Lector de Gastos'],
  '/tax-accounting/lector-ingresos': ['Tax & Accounting', 'Lector de Ingresos'],
  '/tax-accounting/obligaciones': ['Tax & Accounting', 'Obligaciones Fiscales'],
  '/tax-accounting': ['Tax & Accounting', 'Dashboard'],
  '/finance/dashboard': ['Finance', 'Dashboard'],
  '/finance': ['Finance', 'Dashboard'],
  '/contactos': ['Contactos'],
  '/documentos': ['Documentos'],
  '/tareas': ['Herramientas', 'Tareas'],
  '/timeline': ['Herramientas', 'Timeline'],
  '/asistente': ['Herramientas', 'Asistente IA'],
  '/': ['Dashboard'],
};

export default function TopBar({ onMenuToggle, user, companyName, notificationsCount = 0, isAdmin }) {
  const location = useLocation();
  const crumbs = BREADCRUMBS[location.pathname] || null;

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <header className="h-14 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb o empresa */}
        {crumbs && crumbs.length > 1 ? (
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <span className="text-muted-foreground/60 font-medium">{crumbs[0]}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
            <span className="text-foreground font-semibold">{crumbs[1]}</span>
          </nav>
        ) : companyName ? (
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground truncate max-w-xs">{companyName}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <OcrTopBarBadge isAdmin={isAdmin} />
        {/* Company badge — mobile */}
        {companyName && (
          <div className="sm:hidden flex items-center gap-1.5 bg-secondary rounded-lg px-2.5 py-1.5 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-foreground truncate max-w-[80px]">{companyName}</span>
          </div>
        )}

        {/* Notificaciones */}
        <Link
          to="/notificaciones"
          className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-150"
        >
          <Bell className="w-4 h-4" />
          {notificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-taxea-red text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none shadow">
              {notificationsCount > 9 ? '9+' : notificationsCount}
            </span>
          )}
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-secondary transition-all duration-150 ml-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-taxea-red to-taxea-red-dark flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {user?.full_name?.split(' ')[0] || user?.email}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border border-border">
            <div className="px-3 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            </div>
            <div className="p-1">
              <DropdownMenuItem asChild>
                <a href="/ajustes" className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Perfil y Ajustes
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer rounded-lg px-2 py-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}