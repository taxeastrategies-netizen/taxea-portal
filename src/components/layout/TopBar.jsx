import { Menu, Bell, ChevronDown, LogOut, User, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import {useMobileNavigation} from './MobileNavigation';
import OcrTopBarBadge from '@/components/ocr/OcrTopBarBadge';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const BREADCRUMBS = {
  '/tax-accounting/dashboard': ['Fiscalidad y Contabilidad', 'Dashboard'],
  '/tax-accounting/asesoria': ['Fiscalidad y Contabilidad', 'Bandeja del asesor'],
  '/tax-accounting/facturas': ['Fiscalidad y Contabilidad', 'Facturas'],
  '/tax-accounting/ingresos-gastos': ['Fiscalidad y Contabilidad', 'Ingresos y Gastos'],
  '/tax-accounting/presupuestos': ['Fiscalidad y Contabilidad', 'Presupuestos'],
  '/tax-accounting/proformas': ['Fiscalidad y Contabilidad', 'Proformas'],
  '/tax-accounting/productos': ['Fiscalidad y Contabilidad', 'Productos / Servicios'],
  '/tax-accounting/notas': ['Fiscalidad y Contabilidad', 'Notas Predefinidas'],
  '/tax-accounting/libros': ['Fiscalidad y Contabilidad', 'Libros Registro'],
  '/tax-accounting/lector-gastos': ['Fiscalidad y Contabilidad', 'OCR facturas recibidas'],
  '/tax-accounting/lector-ingresos': ['Fiscalidad y Contabilidad', 'OCR facturas emitidas'],
  '/tax-accounting/obligaciones': ['Fiscalidad y Contabilidad', 'Obligaciones Fiscales'],
  '/tax-accounting/impuestos': ['Fiscalidad y Contabilidad', 'Modelos tributarios'],
  '/tax-accounting/contabilidad': ['Fiscalidad y Contabilidad', 'Contabilidad'],
  '/tax-accounting': ['Fiscalidad y Contabilidad', 'Dashboard'],
  '/finance/dashboard': ['Finanzas y tesorería', 'Panel Finanzas'],
  '/finance': ['Finanzas y tesorería', 'Panel Finanzas'],
  '/finance/treasury': ['Finanzas y tesorería', 'Tesorería'],
  '/finance/ar': ['Finanzas y tesorería', 'Cuentas a cobrar'],
  '/finance/ap': ['Finanzas y tesorería', 'Cuentas a pagar'],
  '/finance/cashflow': ['Finanzas y tesorería', 'Centro de Tesorería'],
  '/finance/debt': ['Finanzas y tesorería', 'Deuda y Financiación'],
  '/finance/investments': ['Finanzas y tesorería', 'Inversiones'],
  '/finance/reporting': ['Finanzas y tesorería', 'Centro de Informes'],
  '/finance/analysis': ['Finanzas y tesorería', 'Análisis Financiero'],
  '/ajustes': ['Ajustes'],
  '/notificaciones': ['Notificaciones'],
  '/sugerencias': ['Mejoras'],
  '/suscripcion': ['Suscripción'],
  '/facturas': ['Fiscalidad y Contabilidad', 'Facturas'],
  '/lector-gastos': ['Fiscalidad y Contabilidad', 'OCR facturas recibidas'],
  '/lector-ingresos': ['Fiscalidad y Contabilidad', 'OCR facturas emitidas'],
  '/herramientas': ['Core Operativo', 'Herramientas'],
  '/herramientas/renombrador': ['Herramientas', 'Renombrador OCR'],
  '/herramientas/pdf-imagenes': ['Herramientas', 'Kit PDF e imágenes'],
  '/herramientas/extractor': ['Herramientas', 'Extractor de documentos'],
  '/herramientas/calculadora': ['Herramientas', 'Calculadora comercial'],
  '/herramientas/vencimientos': ['Herramientas', 'Vencimientos'],
  '/contactos': ['Contactos'],
  '/documentos': ['Documentos'],
  '/timeline': ['Herramientas', 'Timeline'],
  '/asistente': ['Herramientas', 'Asistente IA'],
  '/': ['Dashboard'],
};

export default function TopBar({ onMenuToggle, user, companyName, notificationsCount = 0, isAdmin, onRefresh, refreshing, safeAreaTop = true }) {
  const location = useLocation();
  const navigation=useMobileNavigation();
  const crumbs = BREADCRUMBS[location.pathname] || null;

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <header className={`taxea-future-topbar ${safeAreaTop?'taxea-top-inset':''} h-14 shrink-0 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30`}>
      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Abrir menú principal"
          className="lg:hidden min-w-11 min-h-11 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        {location.pathname!=='/'&&<button type="button" aria-label="Volver a la pantalla anterior" onClick={()=>navigation?.goBack()} className="taxea-mobile-back min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-secondary"><ChevronLeft className="w-5 h-5"/></button>}
        <span className="taxea-mobile-title sm:hidden text-sm font-semibold truncate">{crumbs?.at(-1)||({'/ajustes':'Ajustes','/suscripcion':'Suscripción','/notificaciones':'Avisos'}[location.pathname])||'Taxea'}</span>

        {/* Breadcrumb o empresa */}
        {crumbs && crumbs.length > 1 ? (
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <span className="text-muted-foreground/60 font-medium">{crumbs[0]}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
            <span className="text-foreground font-semibold">{crumbs[1]}</span>
          </nav>
        ) : companyName ? (
          <div className="taxea-topbar-company hidden sm:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
            <span className="text-sm font-medium text-foreground truncate max-w-xs">{companyName}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-0 sm:gap-2 shrink-0">
        <div className="taxea-topbar-ocr hidden sm:block"><OcrTopBarBadge isAdmin={isAdmin} /></div>
        {onRefresh&&<button type="button" aria-label="Actualizar datos sin salir de la pantalla" disabled={refreshing} onClick={onRefresh} className="taxea-mobile-refresh md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${refreshing?'animate-spin motion-reduce:animate-none':''}`}/></button>}
        {/* Notificaciones */}
        <Link
          to="/notificaciones"
          aria-label={notificationsCount > 0 ? `Notificaciones: ${notificationsCount} pendientes` : 'Notificaciones'}
          className="relative min-w-11 min-h-11 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-150 flex items-center justify-center"
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
            <button aria-label="Menú de tu cuenta" className="min-w-11 min-h-11 flex items-center justify-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary transition-all duration-150 sm:ml-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-taxea-red to-taxea-red-dark flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="taxea-user-name hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
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
                <Link to="/ajustes" className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Perfil y Ajustes
                </Link>
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

