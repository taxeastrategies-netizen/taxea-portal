import { Link, useLocation } from 'react-router-dom';
import { TaxeaIsotipo } from '@/components/brand/TaxeaLogo';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calculator, Users, FolderOpen, Settings, X,
  Shield, CheckSquare, Clock, AlertTriangle, BarChart2, Bell,
  Sparkles, Brain, Lightbulb, CloudUpload, MessageCircle,
  ChevronRight
} from 'lucide-react';

const ROLE_LABELS = {
  super_admin: { label: 'Super Admin', color: 'bg-red-500/20 border-red-500/30 text-red-300' },
  admin: { label: 'Administrador', color: 'bg-gold/20 border-gold/30 text-gold' },
  advisor: { label: 'Asesor', color: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
};

// Main departments
const DEPARTMENTS = [
  {
    id: 'tax',
    label: 'Tax & Accounting',
    sublabel: 'Fiscal y Contabilidad',
    icon: Calculator,
    path: '/tax-accounting',
    color: 'text-taxea-red',
    activeBg: 'bg-taxea-red',
    hoverBg: 'hover:bg-taxea-red/10',
    badgeColor: 'bg-taxea-red/20 text-taxea-red border-taxea-red/30',
  },
  {
    id: 'contacts',
    label: 'Contactos',
    sublabel: 'Clientes y proveedores',
    icon: Users,
    path: '/contactos',
    color: 'text-blue-400',
    activeBg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-500/10',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-400/30',
    comingSoon: false,
  },
  {
    id: 'docs',
    label: 'Documentos',
    sublabel: 'Archivos y gestión',
    icon: FolderOpen,
    path: '/documentos',
    color: 'text-violet-400',
    activeBg: 'bg-violet-500',
    hoverBg: 'hover:bg-violet-500/10',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-400/30',
  },
];

const UTILS_ITEMS = [
  { to: '/tareas', label: 'Tareas', icon: CheckSquare },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/notificaciones', label: 'Notificaciones', icon: Bell },
  { to: '/asistente', label: 'Asistente IA', icon: Sparkles },
  { to: '/sugerencias', label: 'Mejoras', icon: Lightbulb },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

const ADMIN_ITEMS = [
  { to: '/admin', label: 'Panel Admin', icon: Shield },
  { to: '/crm', label: 'CRM Interno', icon: BarChart2 },
  { to: '/errores', label: 'Detector Errores', icon: AlertTriangle },
  { to: '/admin-asistente', label: 'Panel IA Fiscal', icon: Brain },
  { to: '/admin-sugerencias', label: 'Buzón Sugerencias', icon: Lightbulb },
  { to: '/admin-afiliados', label: 'Panel Afiliados', icon: Users },
  { to: '/subida-modelos', label: 'Subida Modelos', icon: CloudUpload },
  { to: '/admin-whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function Sidebar({ isOpen, onClose, isAdmin, isSuperAdmin, userRole }) {
  const location = useLocation();

  const isDeptActive = (dept) => {
    if (dept.path === '/tax-accounting') {
      return location.pathname === '/tax-accounting' || location.hash.includes('#');
    }
    return location.pathname.startsWith(dept.path);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full w-60 z-50 flex flex-col transition-transform duration-300",
        "bg-[#0a0a0c] text-white",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:z-auto"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/6">
          <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
            <TaxeaIsotipo size={30} />
            <div className="flex flex-col leading-none">
              <span className="text-white font-jakarta font-bold" style={{ fontSize: 13, letterSpacing: '0.07em' }}>TAXEA</span>
              <span className="font-inter font-normal uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.22em' }}>Business OS</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        {isAdmin && ROLE_LABELS[userRole] && (
          <div className={`mx-3 mt-3 px-3 py-1 rounded-md border ${ROLE_LABELS[userRole].color}`}>
            <p className="text-xs font-medium text-center">{ROLE_LABELS[userRole].label}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-6">

          {/* Dashboard principal */}
          <div>
            <Link
              to="/"
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                location.pathname === '/'
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/6"
              )}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Departments */}
          <div>
            <p className="text-white/25 text-xs px-3 pb-2 uppercase tracking-widest font-medium">Departamentos</p>
            <div className="space-y-1.5">
              {DEPARTMENTS.map(dept => {
                const Icon = dept.icon;
                const isActive = isDeptActive(dept);
                return (
                  <Link
                    key={dept.id}
                    to={dept.path}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group border",
                      isActive
                        ? `${dept.activeBg} text-white border-transparent shadow-sm`
                        : `text-white/50 hover:text-white border-white/5 hover:border-white/10 ${dept.hoverBg}`
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : dept.color)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold leading-none", isActive ? "text-white" : "text-white/70")}>{dept.label}</p>
                      <p className={cn("text-xs mt-0.5 truncate", isActive ? "text-white/70" : "text-white/30")}>{dept.sublabel}</p>
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", isActive ? "text-white/60 translate-x-0" : "text-white/20 group-hover:translate-x-0.5")} />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Utils */}
          <div>
            <p className="text-white/25 text-xs px-3 pb-2 uppercase tracking-widest font-medium">Herramientas</p>
            <div className="space-y-0.5">
              {UTILS_ITEMS.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/45 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-white" : "text-white/35")} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Admin */}
          {isAdmin && (
            <div>
              <p className="text-gold/40 text-xs px-3 pb-2 uppercase tracking-widest font-medium">Admin</p>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                      location.pathname.startsWith(to)
                        ? "bg-gold/15 text-gold"
                        : "text-gold/40 hover:text-gold/70 hover:bg-gold/8"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/6">
          <p className="text-white/20 text-xs text-center">© 2025 Taxea Strategies</p>
        </div>
      </aside>
    </>
  );
}