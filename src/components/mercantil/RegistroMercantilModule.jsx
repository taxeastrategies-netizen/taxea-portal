import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import MercantilDashboard from './MercantilDashboard';
import MercantilExpedienteDetail from './MercantilExpedienteDetail';
import MercantilSociedadForm from './MercantilSociedadForm';

export default function RegistroMercantilModule() {
  const ctx = useOutletContext() || {};
  const { isAdmin, user } = ctx;

  const [view, setView] = useState('dashboard'); // 'dashboard' | 'expediente'
  const [selectedSociedad, setSelectedSociedad] = useState(null);
  const [selectedExpediente, setSelectedExpediente] = useState(null);
  const [selectedEjercicio, setSelectedEjercicio] = useState(null);
  const [showCreateSociedad, setShowCreateSociedad] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenExpediente = (sociedad, expediente, ejercicio) => {
    setSelectedSociedad(sociedad);
    setSelectedExpediente(expediente || null);
    setSelectedEjercicio(ejercicio);
    setView('expediente');
  };

  const handleBack = () => {
    setView('dashboard');
    setSelectedSociedad(null);
    setSelectedExpediente(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div>
      {view === 'dashboard' && (
        <MercantilDashboard
          key={refreshKey}
          onOpenExpediente={handleOpenExpediente}
          onCreateSociedad={() => setShowCreateSociedad(true)}
          isAdmin={isAdmin}
          user={user}
        />
      )}

      {view === 'expediente' && selectedSociedad && (
        <MercantilExpedienteDetail
          sociedad={selectedSociedad}
          expediente={selectedExpediente}
          ejercicio={selectedEjercicio}
          onBack={handleBack}
          isAdmin={isAdmin}
          user={user}
        />
      )}

      <MercantilSociedadForm
        open={showCreateSociedad}
        onClose={() => setShowCreateSociedad(false)}
        onSaved={() => { setShowCreateSociedad(false); setRefreshKey(k => k + 1); }}
      />
    </div>
  );
}