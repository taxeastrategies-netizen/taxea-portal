import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileText, BookOpen, PenLine, LayoutList, ArrowUpCircle,
  ArrowDownCircle, Receipt, TrendingUp, BarChart2, Settings2, Landmark, CalendarClock, Boxes
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FacturasPendientes from './FacturasPendientes';
import LibroDiario from './LibroDiario';
import AsientosManualesTab from './AsientosManualesTab';
import CuadrosCuentas from './CuadrosCuentas';
import LibroRegistroEmitidas from './LibroRegistroEmitidas';
import LibroRegistroRecibidas from './LibroRegistroRecibidas';
import IVAResumen from './IVAResumen';
import MayoresTab from './MayoresTab';
import BalancePyG from './BalancePyG';
import ConfigContable from './ConfigContable';
import AccountingControlCenter from './AccountingControlCenter';
import PeriodosContables from './PeriodosContables';
import ActivosContables from './ActivosContables';

const TABS = [
  { id: 'facturas', label: 'Facturas pendientes', icon: FileText },
  { id: 'diario', label: 'Libro diario', icon: BookOpen },
  { id: 'manuales', label: 'Asientos manuales', icon: PenLine },
  { id: 'cuentas', label: 'Cuadro de cuentas', icon: LayoutList },
  { id: 'emitidas', label: 'Registro emitidas', icon: ArrowUpCircle },
  { id: 'recibidas', label: 'Registro recibidas', icon: ArrowDownCircle },
  { id: 'iva', label: 'IVA / IGIC', icon: Receipt },
  { id: 'mayores', label: 'Mayores', icon: TrendingUp },
  { id: 'activos', label: 'Activos y amortización', icon: Boxes },
  { id: 'conciliacion', label: 'Conciliación', icon: Landmark },
  { id: 'balance', label: 'Balance y PyG', icon: BarChart2 },
  { id: 'periodos', label: 'Ejercicios y cierre', icon: CalendarClock },
  { id: 'config', label: 'Config. contable', icon: Settings2 },
];

export default function ContabilidadModule() {
  const { company, user, fiscalProfile } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('facturas');
  const companyId = company?.id;


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
                type="button"
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
        {activeTab === 'diario' && <LibroDiario companyId={companyId} user={user} />}
        {activeTab === 'manuales' && <AsientosManualesTab companyId={companyId} user={user} />}
        {activeTab === 'cuentas' && <CuadrosCuentas companyId={companyId} user={user} />}
        {activeTab === 'emitidas' && <LibroRegistroEmitidas companyId={companyId} />}
        {activeTab === 'recibidas' && <LibroRegistroRecibidas companyId={companyId} fiscalProfile={fiscalProfile} />}
        {activeTab === 'iva' && <IVAResumen companyId={companyId} />}
        {activeTab === 'mayores' && <MayoresTab companyId={companyId} />}
        {activeTab === 'activos' && <ActivosContables companyId={companyId} />}
        {activeTab === 'conciliacion' && <AccountingControlCenter companyId={companyId} />}
        {activeTab === 'balance' && <BalancePyG companyId={companyId} />}
        {activeTab === 'periodos' && <PeriodosContables companyId={companyId} />}
        {activeTab === 'config' && <ConfigContable companyId={companyId} />}
      </div>
    </div>
  );
}