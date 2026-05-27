import { useState } from 'react';
import {
  FileText, BookOpen, PenLine, LayoutList, ArrowUpCircle,
  ArrowDownCircle, Receipt, TrendingUp, BarChart2, Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FacturasPendientes from './FacturasPendientes';
import LibroDiario from './LibroDiario';
import AsientosManualesTab from './AsientosManualesTab';
import CuadrosCuentas from './CuadrosCuentas';
import LibroRegistroEmitidas from './LibroRegistroEmitidas';
import LibroRegistroRecibidas from './LibroRegistroRecibidas';
import IVAResumen from './IVAResumen';
import MayorCuenta from './MayorCuenta';
import BalancePyG from './BalancePyG';
import ConfigContable from './ConfigContable';

const TABS = [
  { id: 'facturas', label: 'Facturas pendientes', icon: FileText },
  { id: 'diario', label: 'Libro diario', icon: BookOpen },
  { id: 'manuales', label: 'Asientos manuales', icon: PenLine },
  { id: 'cuentas', label: 'Cuadro de cuentas', icon: LayoutList },
  { id: 'emitidas', label: 'Registro emitidas', icon: ArrowUpCircle },
  { id: 'recibidas', label: 'Registro recibidas', icon: ArrowDownCircle },
  { id: 'iva', label: 'IVA / IGIC', icon: Receipt },
  { id: 'mayores', label: 'Mayores', icon: TrendingUp },
  { id: 'balance', label: 'Balance y PyG', icon: BarChart2 },
  { id: 'config', label: 'Config. contable', icon: Settings2 },
];

export default function ContabilidadModule() {
  const [activeTab, setActiveTab] = useState('facturas');

  return (
    <div className="space-y-0">
      {/* Tabs nav */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'facturas' && <FacturasPendientes />}
        {activeTab === 'diario' && <LibroDiario />}
        {activeTab === 'manuales' && <AsientosManualesTab />}
        {activeTab === 'cuentas' && <CuadrosCuentas />}
        {activeTab === 'emitidas' && <LibroRegistroEmitidas />}
        {activeTab === 'recibidas' && <LibroRegistroRecibidas />}
        {activeTab === 'iva' && <IVAResumen />}
        {activeTab === 'mayores' && <MayorCuenta />}
        {activeTab === 'balance' && <BalancePyG />}
        {activeTab === 'config' && <ConfigContable />}
      </div>
    </div>
  );
}