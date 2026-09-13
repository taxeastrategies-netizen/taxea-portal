import { useState } from 'react';
import { Calculator, Settings, FilePen, Send, AlertTriangle, History } from 'lucide-react';
import TaxModelWorkbench from './TaxModelWorkbench';
import ConfiguracionFiscal from './ConfiguracionFiscal';
import BorradoresTab from './BorradoresTab';
import PresentacionesTab from './PresentacionesTab';
import ErroresValidacionesTab from './ErroresValidacionesTab';
import HistorialFiscalTab from './HistorialFiscalTab';

const TABS = [
  { id: 'preparacion', label: 'Modelos y periodos', icon: Calculator },
  { id: 'borradores', label: 'Borradores', icon: FilePen },
  { id: 'errores', label: 'Validaciones', icon: AlertTriangle },
  { id: 'presentaciones', label: 'Presentaciones', icon: Send },
  { id: 'configuracion', label: 'Configuración fiscal', icon: Settings },
  { id: 'historial', label: 'Historial', icon: History },
];

export default function ImpuestosModule() {
  const [activeTab, setActiveTab] = useState('preparacion');
  const [workbenchSelection, setWorkbenchSelection] = useState(null);

  const openModel = selection => {
    setWorkbenchSelection({ ...selection, requestId: Date.now() });
    setActiveTab('preparacion');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'preparacion': return <TaxModelWorkbench initialSelection={workbenchSelection} />;
      case 'borradores': return <BorradoresTab onOpenModel={openModel} />;
      case 'presentaciones': return <PresentacionesTab onOpenModel={openModel} />;
      case 'errores': return <ErroresValidacionesTab onOpenModel={openModel} onOpenConfig={() => setActiveTab('configuracion')} />;
      case 'configuracion': return <ConfiguracionFiscal />;
      case 'historial': return <HistorialFiscalTab onOpenModel={openModel} />;
      default: return <TaxModelWorkbench initialSelection={workbenchSelection} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-white px-6 pt-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-jakarta text-xl font-semibold text-foreground">Modelos tributarios</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Cálculo, revisión, trazabilidad y exportación controlada desde la contabilidad real</p>
          </div>
          <div className="max-w-xl rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-800">
            Taxea muestra las incidencias como recomendaciones y mantiene disponible la exportación. La sede AEAT o el programa ATC realizan la validación definitiva antes de presentar.
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">{renderTab()}</div>
    </div>
  );
}

