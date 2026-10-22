import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ScanLine, FolderOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {useMobileNavigation} from './MobileNavigation';

const TABS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, exact: true },
  { to: '/tax-accounting/facturas', label: 'Facturas', icon: FileText },
  { to: '/tax-accounting/lector-gastos', label: 'Escanear', icon: ScanLine },
  { to: '/documentos', label: 'Docs', icon: FolderOpen },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigation=useMobileNavigation();
  const ids=['home','invoices','scan','documents','settings'];

  return (
    <nav aria-label="Navegación principal móvil" className="taxea-future-bottomnav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch justify-around safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      {TABS.map(({ to, label, icon: Icon, exact },index) => {
        const isActive = navigation ? navigation.currentTab===ids[index] : exact ? location.pathname === to : location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive?'page':undefined}
            onClick={event=>{if(navigation&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigation.selectTab(ids[index]);}}}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2 flex-1 transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
            style={{ minHeight: 56 }}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

