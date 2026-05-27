import { useState } from 'react';
import { LayoutDashboard, Settings, FileText, FilePen, Send, Archive, Calendar, BookOpen, AlertTriangle, History } from 'lucide-react';
import ImpuestosPanel from './ImpuestosPanel';
import ConfiguracionFiscal from './ConfiguracionFiscal';
import ModelosConfig from './ModelosConfig';
import BorradoresTab from './BorradoresTab';
import PresentacionesTab from './PresentacionesTab';
import ImpuestosComingSoon from './ImpuestosComingSoon';

const TABS = [
  { id: 'panel', label: 'Panel', icon: LayoutDashboard },
  { id: 'configuracion', label: 'Configuración fiscal', icon: Settings },
  { id: 'modelos', label: 'Modelos', icon: BookOpen },
  { id: 'borradores', label: 'Borradores', icon: FilePen },
  { id: 'presentaciones', label: 'Presentaciones', icon: Send },
  { id: 'justificantes', label: 'Justificantes', icon: Archive },
  { id: 'calendario', label: 'Calendario fiscal', icon: Calendar },
  { id: 'reglas', label: 'Reglas fiscales', icon: BookOpen },
  { id: 'errores', label: 'Errores y validaciones', icon: AlertTriangle },
  { id: 'historial', label: 'Historial', icon: History },
];

export default function ImpuestosModule() {
  const [activeTab, setActiveTab] = useState('panel');

  const renderTab = () => {
    switch (activeTab) {
      case 'panel': return <ImpuestosPanel />;
      case 'configuracion': return <ConfiguracionFiscal />;
      case 'modelos': return <ModelosConfig />;
      case 'borradores': return <BorradoresTab />;
      case 'presentaciones': return <PresentacionesTab />;
      default: return <ImpuestosComingSoon tab={TABS.find(t => t.id === activeTab)?.label} />;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold font-jakarta text-foreground">Impuestos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Confección, revisión y presentación de modelos fiscales</p>
          </div>
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-sm">
            Los importes proceden exclusivamente de facturas y asientos reales. No se generan datos ficticios.
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {renderTab()}
      </div>
    </div>
  );
}