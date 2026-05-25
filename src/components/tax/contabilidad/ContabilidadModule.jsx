import { useState } from 'react';
import { BookOpen, BookText, TrendingUp, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import CuadrosCuentas from './CuadrosCuentas';
import LibroDiario from './LibroDiario';
import PerdidasGanancias from './PerdidasGanancias';
import BalanceSituacion from './BalanceSituacion';

const TABS = [
  { id: 'cuadro', label: 'Cuadro de cuentas', icon: BookOpen },
  { id: 'diario', label: 'Libro diario', icon: BookText },
  { id: 'pyg', label: 'Pérdidas y ganancias', icon: TrendingUp },
  { id: 'balance', label: 'Balance de situación', icon: Scale },
];

export default function ContabilidadModule() {
  const [activeTab, setActiveTab] = useState('cuadro');

  return (
    <div className="space-y-0 -mt-2">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border bg-card overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="pt-4">
        {activeTab === 'cuadro' && <CuadrosCuentas />}
        {activeTab === 'diario' && <LibroDiario />}
        {activeTab === 'pyg' && <PerdidasGanancias />}
        {activeTab === 'balance' && <BalanceSituacion />}
      </div>
    </div>
  );
}