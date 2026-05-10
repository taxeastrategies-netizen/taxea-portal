import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, TrendingUp, FileCheck, Receipt,
  Users, Package, BookOpen, BookMarked, ScanLine, ScanText,
  Calendar, FolderOpen, Settings, X, Shield, CheckSquare,
  Clock, AlertTriangle, BarChart2
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Facturas', path: '/facturas' },
  { icon: TrendingUp, label: 'Ingresos y Gastos', path: '/ingresos-gastos' },
  { icon: FileCheck, label: 'Presupuestos', path: '/presupuestos' },
  { icon: Receipt, label: 'Facturas Proforma', path: '/proformas' },
  { icon: Users, label: 'Contactos', path: '/contactos' },
  { icon: Package, label: 'Productos/Servicios', path: '/productos' },
  { icon: BookMarked, label: 'Notas Predefinidas', path: '/notas' },
  { icon: BookOpen, label: 'Libro de Registros', path: '/libro-registros' },
  { icon: ScanLine, label: 'Lector de Gastos', path: '/lector-gastos' },
  { icon: ScanText, label: 'Lector de Ingresos', path: '/lector-ingresos' },
  { icon: Calendar, label: 'Obligaciones Fiscales', path: '/obligaciones' },
  { icon: FolderOpen, label: 'Documentos', path: '/documentos' },
  { icon: Settings, label: 'Ajustes', path: '/ajustes' },
];

export default function Sidebar({ isOpen, onClose, isAdmin }) {
  const location = useLocation();

  return (
    <>
      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300",
        "bg-sidebar text-sidebar-foreground",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:z-auto"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-jakarta font-700 text-sm leading-none">Taxea Portal</p>
              <p className="text-white/40 text-xs mt-0.5">Strategies</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin badge */}
        {isAdmin && (
          <div className="mx-4 mt-3 px-3 py-1.5 rounded-md bg-gold/20 border border-gold/30">
            <p className="text-gold text-xs font-medium text-center">Panel Administrador</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-teal text-white shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-white/50")} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Separador admin */}
          {isAdmin && (
            <div className="pt-3 mt-2 border-t border-white/10 space-y-0.5">
              <p className="text-white/25 text-xs px-3 pb-1 uppercase tracking-wider">Administración</p>
              {[
                { to: '/admin', label: 'Panel Admin', icon: Shield },
                { to: '/crm', label: 'CRM Interno', icon: BarChart2 },
                { to: '/errores', label: 'Detector Errores', icon: AlertTriangle },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border border-gold/20",
                    location.pathname.startsWith(to)
                      ? "bg-gold/20 text-gold"
                      : "text-gold/60 hover:text-gold hover:bg-gold/10"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Tareas y Timeline (todos los usuarios) */}
          <div className="pt-3 mt-2 border-t border-white/10 space-y-0.5">
            {[
              { to: '/tareas', label: 'Tareas', icon: CheckSquare },
              { to: '/timeline', label: 'Timeline', icon: Clock },
            ].map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive ? "bg-teal text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/8"
                  )}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-white/50")} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-white/25 text-xs text-center">© 2024 Taxea Strategies</p>
          <p className="text-white/15 text-xs text-center mt-0.5">Portal privado y confidencial</p>
        </div>
      </aside>
    </>
  );
}