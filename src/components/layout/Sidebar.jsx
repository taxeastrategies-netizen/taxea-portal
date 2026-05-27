import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TaxeaIsotipo } from '@/components/brand/TaxeaLogo';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calculator, Users, FolderOpen, Settings, X,
  Shield, CheckSquare, Clock, AlertTriangle, BarChart2, Bell,
  Sparkles, Brain, Lightbulb, CloudUpload, MessageCircle,
  ChevronDown, FileText, TrendingUp, TrendingDown, FileCheck, Receipt,
  Package, BookMarked, BookOpen, ScanLine, ScanText, Calendar,
  Lock, Wallet, Scale, UserCog, Cog, Heart, Gavel, Building2, Target, PenLine, DollarSign,
  Warehouse, ArrowDownUp, Layers, Truck, Cpu, Map, Kanban,
  Folder, Zap, Megaphone
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

  { id: 'notas', label: 'Notas Predefinidas', icon: BookMarked, path: '/tax-accounting/notas' },
  { id: 'libros', label: 'Libros Registro', icon: BookOpen, path: '/tax-accounting/libros' },
  { id: 'lector-gastos', label: 'Lector de Gastos', icon: ScanLine, path: '/tax-accounting/lector-gastos' },
  { id: 'lector-ingresos', label: 'Lector de Ingresos', icon: ScanText, path: '/tax-accounting/lector-ingresos' },
  { id: 'obligaciones', label: 'Obligaciones Fiscales', icon: Calendar, path: '/tax-accounting/obligaciones' },
  { id: 'asistente', label: 'Asistente IA', icon: Sparkles, path: '/tax-accounting/asistente' },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, path: '/tax-accounting/notificaciones' },
  { id: 'timeline', label: 'Timeline', icon: Clock, path: '/tax-accounting/timeline' },
  { id: 'labor-ocr', label: 'OCR Laboral', icon: ScanLine, path: '/tax-accounting/labor-ocr' },
  { id: 'contabilidad', label: 'Contabilidad', icon: BookOpen, path: '/tax-accounting/contabilidad' },
  { id: 'registro-mercantil', label: 'Registro Mercantil', icon: Building2, path: '/tax-accounting/registro-mercantil' },
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
          { id: 'dashboard', label: 'Panel Finanzas', icon: LayoutDashboard, path: '/finance/dashboard' },
          { id: 'cashflow', label: 'Centro de Tesorería', icon: TrendingUp, path: '/finance/cashflow' },
          { id: 'treasury', label: 'Tesorería', icon: Wallet, path: '/finance/treasury' },
          { id: 'ar', label: 'Cuentas a Cobrar', icon: FileCheck, path: '/finance/ar' },
          { id: 'ap', label: 'Cuentas a Pagar', icon: Receipt, path: '/finance/ap' },
          { id: 'debt', label: 'Deuda y Financiación', icon: TrendingDown, path: '/finance/debt' },
          { id: 'investments', label: 'Inversiones', icon: BarChart2, path: '/finance/investments', adminOnly: true },
          { id: 'reporting', label: 'Centro de Informes', icon: FileText, path: '/finance/reporting' },
          { id: 'analysis', label: 'Análisis Financiero', icon: BarChart2, path: '/finance/analysis' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Core People',
    depts: [
      {
        id: 'people',
        label: 'People & HR',
        icon: Heart,
        activeColor: 'text-rose-600',
        activeBg: 'bg-rose-50',
        basePath: '/people',
        modules: [
          { id: 'dashboard',   label: 'Panel RRHH',           icon: LayoutDashboard, path: '/people/dashboard' },
          { id: 'employees',   label: 'Gestión de Empleados', icon: Users,           path: '/people/employees' },
          { id: 'documents',   label: 'Docs y Firmas',        icon: FileText,        path: '/people/documents' },
          { id: 'time',        label: 'Control Horario',      icon: Clock,           path: '/people/time' },
          { id: 'absences',    label: 'Ausencias',            icon: Calendar,        path: '/people/absences' },
          { id: 'hours-bank',  label: 'Banco de Horas',       icon: BarChart2,       path: '/people/hours-bank' },
          { id: 'performance', label: 'Rendimiento y Metas',  icon: TrendingUp,      path: '/people/performance' },
          { id: 'onboarding',  label: 'Incorporación / Baja', icon: UserCog,         path: '/people/onboarding' },
          { id: 'recruiting',  label: 'Selección',            icon: FileCheck,       path: '/people/recruiting' },
          { id: 'expenses',    label: 'Gastos RRHH',          icon: Receipt,         path: '/people/expenses' },
          { id: 'reports',     label: 'Analítica de Personal',icon: BarChart2,       path: '/people/reports' },
          { id: 'ai-assistant',label: 'Asistente IA RRHH',   icon: Brain,           path: '/people/ai-assistant' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Core Legal',
    depts: [
      {
        id: 'law',
        label: 'Law',
        adminOnly: true,
        icon: Scale,
        activeColor: 'text-slate-700',
        activeBg: 'bg-slate-100',
        basePath: '/law',
        modules: [
          { id: 'home',           label: 'Inicio Legal',         icon: Scale,          path: '/law' },
          { id: 'tax-dashboard',  label: 'Panel Fiscal',         icon: Calculator,     path: '/law/tax/dashboard' },
          { id: 'tax-compliance', label: 'Cumplimiento Fiscal',  icon: Shield,         path: '/law/tax/compliance' },
          { id: 'tax-litigation', label: 'Litigios Fiscales',    icon: Gavel,          path: '/law/tax/litigation' },
          { id: 'tax-inspect',    label: 'Inspecciones AEAT',    icon: FileText,       path: '/law/tax/inspections' },
          { id: 'tax-knowledge',  label: 'DGT & Base Conocim.',  icon: BookOpen,       path: '/law/tax/knowledge' },
          { id: 'tax-ai',         label: 'Asistente IA Fiscal',  icon: Brain,          path: '/law/tax/ai' },
          { id: 'legal-dash',     label: 'Panel Jurídico',       icon: LayoutDashboard, path: '/law/business/dashboard' },
          { id: 'contracts',      label: 'Centro de Contratos',  icon: FileCheck,      path: '/law/business/contracts' },
          { id: 'corporate',      label: 'Derecho Societario',   icon: Building2,      path: '/law/business/corporate' },
          { id: 'compliance',     label: 'Cumplimiento Legal',   icon: Shield,         path: '/law/business/compliance' },
          { id: 'legal-ai',       label: 'Asistente IA Legal',   icon: Brain,          path: '/law/business/ai' },
          { id: 'ma-dash',        label: 'Panel M&A',            icon: TrendingUp,     path: '/law/ma/dashboard' },
          { id: 'deal-pipeline',  label: 'Pipeline de Deals',    icon: Target,         path: '/law/ma/pipeline' },
          { id: 'due-dil',        label: 'Due Diligence',        icon: FileText,       path: '/law/ma/due-diligence' },
          { id: 'data-rooms',     label: 'Salas de Datos',       icon: Lock,           path: '/law/ma/data-rooms' },
          { id: 'valuation',      label: 'Valoración',           icon: BarChart2,      path: '/law/ma/valuation' },
          { id: 'ma-ai',          label: 'Asistente IA M&A',     icon: Brain,          path: '/law/ma/ai' },
          { id: 'knowledge',      label: 'Motor de Conocimiento',icon: BookOpen,       path: '/law/knowledge' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Operativo',
    depts: [
      {
        id: 'operations',
        label: 'Operations',
        adminOnly: true,
        icon: Cpu,
        activeColor: 'text-violet-600',
        activeBg: 'bg-violet-50',
        basePath: '/operations',
        modules: [
          { id: 'dashboard',  label: 'Dashboard',        icon: LayoutDashboard, path: '/operations/dashboard' },
          { id: 'today',      label: 'Hoy / Esta semana', icon: Clock,           path: '/operations/today' },
          { id: 'tasks',      label: 'Tareas / Kanban',   icon: Kanban,          path: '/operations/tasks' },
          { id: 'projects',   label: 'Proyectos',         icon: Folder,          path: '/operations/projects' },
          { id: 'roadmap',    label: 'Roadmap',           icon: Map,             path: '/operations/roadmap' },
          { id: 'processes',  label: 'Procesos / SOPs',   icon: Zap,             path: '/operations/processes' },
          { id: 'tickets',    label: 'Tickets internos',  icon: AlertTriangle,   path: '/operations/tickets' },
          { id: 'risks',      label: 'Riesgos',           icon: Shield,          path: '/operations/risks' },
          { id: 'calendar',   label: 'Calendario',        icon: Calendar,        path: '/operations/calendar' },
          { id: 'ai',         label: 'IA Director',       icon: Brain,           path: '/operations/ai' },
          { id: 'reports',    label: 'Informes',          icon: BarChart2,       path: '/operations/reports' },
        ],
      },
      {
        id: 'logistics',
        label: 'Logistics',
        adminOnly: true,
        icon: Warehouse,
        activeColor: 'text-orange-600',
        activeBg: 'bg-orange-50',
        basePath: '/logistics',
        modules: [
          { id: 'dashboard',     label: 'Dashboard Logístico',  icon: LayoutDashboard, path: '/logistics/dashboard' },
          { id: 'inventory',     label: 'Inventario',           icon: Package,         path: '/logistics/inventory' },
          { id: 'movements',     label: 'Entradas y Salidas',   icon: ArrowDownUp,     path: '/logistics/movements' },
          { id: 'valuation',     label: 'Valoración PMP/FIFO',  icon: Layers,          path: '/logistics/valuation' },
          { id: 'replenishment', label: 'Stock Crítico',        icon: AlertTriangle,   path: '/logistics/replenishment' },
          { id: 'import',        label: 'Importación IA',       icon: ScanLine,        path: '/logistics/import' },
          { id: 'suppliers',     label: 'Proveedores',          icon: Truck,           path: '/logistics/suppliers' },
          { id: 'reports',       label: 'Informes',             icon: FileText,        path: '/logistics/reports' },
        ],
      },
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
    groupLabel: 'Crecimiento',
    depts: [
      {
        id: 'growth',
        label: 'Marketing & Growth',
        adminOnly: true,
        icon: TrendingUp,
        activeColor: 'text-pink-600',
        activeBg: 'bg-pink-50',
        basePath: '/growth',
        modules: [
          { id: 'dashboard',      label: 'Command Center',        icon: LayoutDashboard, path: '/growth/dashboard' },
          { id: 'pnl',           label: 'Marketing P&L',         icon: DollarSign,      path: '/growth/pnl' },
          { id: 'unit-economics',label: 'CAC · LTV · Payback',   icon: TrendingUp,      path: '/growth/unit-economics' },
          { id: 'funnels',       label: 'Funnel Leak Detector',  icon: BarChart2,       path: '/growth/funnels' },
          { id: 'leads',         label: 'Lead Fit Score',        icon: Users,           path: '/growth/leads' },
          { id: 'campaigns',     label: 'Campanas',              icon: Megaphone,       path: '/growth/campaigns' },
          { id: 'content',       label: 'Contenido',             icon: FileText,        path: '/growth/content' },
          { id: 'seo',           label: 'SEO Center',            icon: Target,          path: '/growth/seo' },
          { id: 'ai-visibility', label: 'AI Visibility / GEO',  icon: Brain,           path: '/growth/ai-visibility' },
          { id: 'whatsapp',      label: 'WhatsApp Closing',      icon: MessageCircle,   path: '/growth/whatsapp' },
          { id: 'sales',         label: 'Sales Enablement',      icon: CheckSquare,     path: '/growth/sales' },
          { id: 'pricing',       label: 'Pricing Guardrail',     icon: Shield,          path: '/growth/pricing' },
          { id: 'compliance',    label: 'Marketing Legal Risk',  icon: AlertTriangle,   path: '/growth/compliance' },
          { id: 'fiscal-compliance', label: 'Fiscal SEO Checker',icon: FileText,        path: '/growth/fiscal-compliance' },
          { id: 'priorities',    label: 'Revenue Priorities',    icon: Zap,             path: '/growth/priorities' },
          { id: 'growth-lab',    label: 'Growth Lab',            icon: Cpu,             path: '/growth/growth-lab' },
          { id: 'analytics',     label: 'Analitica',             icon: BarChart2,       path: '/growth/analytics' },
          { id: 'retention',     label: 'Retencion',             icon: Heart,           path: '/growth/retention' },
          { id: 'reports',       label: 'Informes',              icon: FileText,        path: '/growth/reports' },
          { id: 'ai',            label: 'IA Director Growth',    icon: Sparkles,        path: '/growth/ai' },
          { id: 'settings',      label: 'Integraciones',         icon: Settings,        path: '/growth/settings' },
          { id: 'premium',       label: 'Growth Premium ⚡',     icon: Sparkles,        path: '/growth/premium' },
        ],
      },
    ],
  },
];

const DEPARTMENTS = DEPT_GROUPS.flatMap(g => g.depts);

const UTILS_ITEMS = [
  { to: '/tareas', label: 'Tareas', icon: CheckSquare },
  { to: '/sugerencias', label: 'Mejoras', icon: Lightbulb },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

const ADMIN_ITEMS = [
  { to: '/admin/clients', label: 'Clientes y accesos', icon: Users },
  { to: '/admin/estado-contable', label: 'Estado contable', icon: BookOpen },
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
                          onClick={() => dept.adminOnly && !isAdmin ? (navigate('/coming-soon'), onClose()) : handleDeptClick(dept)}
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
                          {dept.adminOnly && !isAdmin && (
                            <Lock className="w-3 h-3 text-slate-300" />
                          )}
                          {hasModules && (!dept.adminOnly || isAdmin) && (
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
                                  {dept.modules.filter(mod => !mod.adminOnly || isAdmin).map(mod => {
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