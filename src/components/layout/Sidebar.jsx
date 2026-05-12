import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TaxeaIsotipo } from '@/components/brand/TaxeaLogo';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calculator, Users, FolderOpen, Settings, X,
  Shield, CheckSquare, Clock, AlertTriangle, BarChart2, Bell,
  Sparkles, Brain, Lightbulb, CloudUpload, MessageCircle,
  ChevronDown, FileText, TrendingUp, FileCheck, Receipt,
  Package, BookMarked, BookOpen, ScanLine, ScanText, Calendar,
  Lock, Wallet, Scale, UserCog, Cog
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_LABELS = {
  super_admin: { label: 'Super Admin', color: 'bg-red-50 border-red-200 text-red-600' },
  admin: { label: 'Administrador', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  advisor: { label: 'Asesor', color: 'bg-blue-50 border-blue-200 text-blue-600' },
};

const TAX_MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/tax-accounting/dashboard' },
  { id: 'facturas', label: 'Facturas', icon: FileText, path: '/tax-accounting/facturas' },
  { id: 'ingresos-gastos', label: 'Ingresos y Gastos', icon: TrendingUp, path: '/tax-accounting/ingresos-gastos' },
  { id: 'presupuestos', label: 'Presupuestos', icon: FileCheck, path: '/tax-accounting/presupuestos' },
  { id: 'proformas', label: 'Proformas', icon: Receipt, path: '/tax-accounting/proformas' },
  { id: 'productos', label: 'Productos / Servicios', icon: Package, path: '/tax-accounting/productos' },
  { id: 'notas', label: 'Notas Predefinidas', icon: BookMarked, path: '/tax-accounting/notas' },
  { id: 'libros', label: 'Libros Registro', icon: BookOpen, path: '/tax-accounting/libros' },
  { id: 'lector-gastos', label: 'Lector de Gastos', icon: ScanLine, path: '/tax-accounting/lector-gastos' },
  { id: 'lector-ingresos', label: 'Lector de Ingresos', icon: ScanText, path: '/tax-accounting/lector-ingresos' },
  { id: 'obligaciones', label: 'Obligaciones Fiscales', icon: Calendar, path: '/tax-accounting/obligaciones' },
];

const DEPT_GROUPS = [
  {
    groupLabel: 'Core Financiero',
    depts: [
      {
        id: 'tax',
        label: 'Tax & Accounting',
        icon: Calculator,
        activeColor: 'text-taxea-red',
        activeBg: 'bg-taxea-red/8',
        basePath: '/tax-accounting',
        modules: TAX_MODULES,
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        activeColor: 'text-emerald-600',
        activeBg: 'bg-emerald-50',
        basePath: '/finance',
        modules: [
          { id: 'dashboard', label: 'Finance Dashboard', icon: LayoutDashboard, path: '/finance/dashboard' },
          { id: 'cashflow', label: 'Cashflow Center', icon: TrendingUp, path: '/finance/cashflow' },
          { id: 'treasury', label: 'Treasury / Tesorería', icon: Wallet, path: '/finance/treasury' },
          { id: 'ar', label: 'Accounts Receivable', icon: FileCheck, path: '/finance/ar' },
          { id: 'ap', label: 'Accounts Payable', icon: Receipt, path: '/finance/ap' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Operativo',
    depts: [
      {
        id: 'contacts',
        label: 'Contactos',
        icon: Users,
        activeColor: 'text-blue-600',
        activeBg: 'bg-blue-50',
        basePath: '/contactos',
        modules: [],
      },
      {
        id: 'docs',
        label: 'Documentos',
        icon: FolderOpen,
        activeColor: 'text-violet-600',
        activeBg: 'bg-violet-50',
        basePath: '/documentos',
        modules: [],
      },
    ],
  },
  {
    groupLabel: 'Próximamente',
    depts: [
      { id: 'legal', label: 'Legal', icon: Scale, basePath: null, comingSoon: true },
      { id: 'rrhh', label: 'RRHH', icon: UserCog, basePath: null, comingSoon: true },
      { id: 'ops', label: 'Operaciones', icon: Cog, basePath: null, comingSoon: true },
    ],
  },
];

const DEPARTMENTS = DEPT_GROUPS.flatMap(g => g.depts);

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
  const navigate = useNavigate();

  const getActiveDept = () => {
    for (const dept of DEPARTMENTS) {
      if (dept.basePath && location.pathname.startsWith(dept.basePath)) return dept.id;
    }
    return null;
  };

  const activeDeptId = getActiveDept();
  const [expanded, setExpanded] = useState(activeDeptId || 'tax');

  const handleDeptClick = (dept) => {
    if (dept.comingSoon) return;
    if (dept.modules && dept.modules.length > 0) {
      if (expanded === dept.id) {
        setExpanded(null);
      } else {
        setExpanded(dept.id);
        if (!location.pathname.startsWith(dept.basePath)) {
          navigate(dept.modules[0].path);
          onClose();
        }
      }
    } else {
      navigate(dept.basePath);
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full w-60 z-50 flex flex-col transition-transform duration-300",
        "bg-white border-r border-slate-100",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:z-auto"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
            <TaxeaIsotipo size={30} />
            <div className="flex flex-col leading-none">
              <span className="text-slate-800 font-jakarta font-bold" style={{ fontSize: 13, letterSpacing: '0.07em' }}>TAXEA</span>
              <span className="font-inter font-normal uppercase" style={{ fontSize: 8, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.22em' }}>Business OS</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-700 transition-colors">
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
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">

          {/* Dashboard principal */}
          <Link
            to="/"
            onClick={onClose}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
              location.pathname === '/'
                ? "bg-taxea-red/8 text-taxea-red font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <LayoutDashboard className={cn("w-4 h-4 flex-shrink-0", location.pathname === '/' ? "text-taxea-red" : "text-slate-400")} />
            <span>Dashboard</span>
          </Link>

          {/* Departments grouped */}
          <div className="space-y-3">
            {DEPT_GROUPS.map((group, gi) => (
              <div key={group.groupLabel}>
                <p className="text-[10px] text-slate-400 px-3 pb-1.5 uppercase tracking-widest font-semibold">
                  {group.groupLabel}
                </p>
                <div className="space-y-0.5">
                  {group.depts.map(dept => {
                    const DeptIcon = dept.icon;
                    const isActiveDept = activeDeptId === dept.id;
                    const isExpanded = expanded === dept.id;
                    const hasModules = dept.modules && dept.modules.length > 0;

                    if (dept.comingSoon) {
                      return (
                        <div
                          key={dept.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg opacity-40 cursor-not-allowed select-none"
                        >
                          <Lock className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" />
                          <span className="text-xs text-slate-400 font-medium">{dept.label}</span>
                          <span className="ml-auto text-slate-300 text-[10px] leading-none bg-slate-100 px-1.5 py-0.5 rounded">Soon</span>
                        </div>
                      );
                    }

                    return (
                      <div key={dept.id}>
                        <button
                          onClick={() => handleDeptClick(dept)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left group",
                            isActiveDept
                              ? `${dept.activeBg} ${dept.activeColor} ring-1 ring-inset ring-black/5`
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <DeptIcon className={cn(
                            "w-4 h-4 flex-shrink-0",
                            isActiveDept ? dept.activeColor : "text-slate-400 group-hover:text-slate-600"
                          )} />
                          <span className="flex-1">{dept.label}</span>
                          {hasModules && (
                            <ChevronDown className={cn(
                              "w-3.5 h-3.5 transition-transform duration-200",
                              isExpanded ? "rotate-0" : "-rotate-90",
                              isActiveDept ? "opacity-50" : "opacity-40"
                            )} />
                          )}
                        </button>

                        {hasModules && (
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="mt-0.5 ml-3 pl-3 border-l border-slate-100 space-y-0.5 py-1">
                                  {dept.modules.map(mod => {
                                    const ModIcon = mod.icon;
                                    const isActiveModule = location.pathname === mod.path;
                                    return (
                                      <Link
                                        key={mod.id}
                                        to={mod.path}
                                        onClick={onClose}
                                        className={cn(
                                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                                          isActiveModule
                                            ? "bg-taxea-red/8 text-taxea-red border-l-2 border-taxea-red pl-2"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                        )}
                                      >
                                        <ModIcon className={cn("w-3 h-3 flex-shrink-0", isActiveModule ? "text-taxea-red" : "text-slate-350")} />
                                        <span className={isActiveModule ? "font-semibold" : ""}>{mod.label}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    );
                  })}
                </div>
                {gi < DEPT_GROUPS.length - 1 && (
                  <div className="mt-3 mx-2 border-t border-slate-100" />
                )}
              </div>
            ))}
          </div>

          {/* Utils */}
          <div>
            <p className="text-[10px] text-slate-400 px-3 pb-1.5 uppercase tracking-widest font-semibold">Herramientas</p>
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
                        ? "bg-taxea-red/8 text-taxea-red"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-taxea-red" : "text-slate-400")} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Admin */}
          {isAdmin && (
            <div>
              <p className="text-[10px] text-amber-500/80 px-3 pb-1.5 uppercase tracking-widest font-semibold">Admin</p>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                      location.pathname.startsWith(to)
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : "text-slate-500 hover:text-amber-700 hover:bg-amber-50/60"
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
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-slate-300 text-xs text-center">© 2025 Taxea Strategies</p>
        </div>
      </aside>
    </>
  );
}