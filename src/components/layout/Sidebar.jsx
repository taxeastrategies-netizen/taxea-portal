import { Link, useLocation } from 'react-router-dom';
import { TaxeaIsotipo } from '@/components/brand/TaxeaLogo';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, TrendingUp, FileCheck, Receipt,
  Users, Package, BookOpen, BookMarked, ScanLine, ScanText,
  Calendar, FolderOpen, Settings, X, Shield, CheckSquare,
  Clock, AlertTriangle, BarChart2, Bell, Sparkles, Brain, Lightbulb, CloudUpload, MessageCircle
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

const ROLE_LABELS = {
  super_admin: { label: 'Super Admin', color: 'bg-red-500/20 border-red-500/30 text-red-300' },
  admin: { label: 'Administrador', color: 'bg-gold/20 border-gold/30 text-gold' },
  advisor: { label: 'Asesor', color: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
};

export default function Sidebar({ isOpen, onClose, isAdmin, isSuperAdmin, userRole }) {
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
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <TaxeaIsotipo size={32} />
            <div className="flex flex-col leading-none">
              <span className="text-white font-jakarta font-bold" style={{ fontSize: 13, letterSpacing: '0.07em' }}>
                TAXEA
              </span>
              <span className="font-inter font-normal uppercase" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.2em' }}>
                Strategies
              </span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        {isAdmin && ROLE_LABELS[userRole] && (
          <div className={`mx-4 mt-3 px-3 py-1.5 rounded-md border ${ROLE_LABELS[userRole].color}`}>
            <p className="text-xs font-medium text-center">{ROLE_LABELS[userRole].label}</p>
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
                { to: '/admin-asistente', label: 'Panel IA Fiscal', icon: Brain },
                { to: '/admin-sugerencias', label: 'Buzón Sugerencias', icon: Lightbulb },
                { to: '/admin-afiliados', label: 'Panel Afiliados', icon: Users },
                { to: '/subida-modelos', label: 'Subida Masiva Modelos', icon: CloudUpload },
                { to: '/admin-whatsapp', label: 'WhatsApp Notificaciones', icon: MessageCircle },
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

          {/* Tareas, Timeline, Notificaciones y Asistente (todos los usuarios) */}
          <div className="pt-3 mt-2 border-t border-white/10 space-y-0.5">
            {[
              { to: '/tareas', label: 'Tareas', icon: CheckSquare },
              { to: '/timeline', label: 'Timeline', icon: Clock },
              { to: '/notificaciones', label: 'Notificaciones', icon: Bell },
              { to: '/asistente', label: 'Asistente Fiscal IA', icon: Sparkles },
              { to: '/sugerencias', label: 'Buzón de Mejoras', icon: Lightbulb },
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