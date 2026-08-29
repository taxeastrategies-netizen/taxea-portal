import { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TaxDashboard = lazy(() => import('@/components/tax/TaxDashboard'));
const Facturas = lazy(() => import('./Facturas'));
const IngresosGastos = lazy(() => import('./IngresosGastos'));
const Presupuestos = lazy(() => import('./Presupuestos'));
const Proformas = lazy(() => import('./Proformas'));
const NotasPredefinidas = lazy(() => import('./NotasPredefinidas'));
const LibroRegistros = lazy(() => import('./LibroRegistros'));
const LectorGastos = lazy(() => import('./LectorGastos'));
const LectorIngresos = lazy(() => import('./LectorIngresos'));
const ObligacionesFiscales = lazy(() => import('./ObligacionesFiscales'));
const AsistenteFiscal = lazy(() => import('./AsistenteFiscal'));
const Notificaciones = lazy(() => import('./Notificaciones'));
const Timeline = lazy(() => import('./Timeline'));
const LaborOcr = lazy(() => import('./LaborOcr'));
const ContabilidadModule = lazy(() => import('@/components/tax/contabilidad/ContabilidadModule'));
const ImpuestosModule = lazy(() => import('@/components/tax/impuestos/ImpuestosModule'));
const RegistroMercantilModule = lazy(() => import('@/components/mercantil/RegistroMercantilModule'));

export default function TaxAccounting() {
  const { module } = useParams();
  const navigate = useNavigate();

  const handleNavigate = (moduleId) => {
    navigate(`/tax-accounting/${moduleId}`);
  };

  switch (module) {
    case 'facturas': return <Facturas />;
    case 'ingresos-gastos': return <IngresosGastos />;
    case 'presupuestos': return <Presupuestos />;
    case 'proformas': return <Proformas />;

    case 'notas': return <NotasPredefinidas />;
    case 'libros': return <LibroRegistros />;
    case 'lector-gastos': return <LectorGastos />;
    case 'lector-ingresos': return <LectorIngresos />;
    case 'obligaciones': return <ObligacionesFiscales />;
    case 'asistente': return <AsistenteFiscal />;
    case 'notificaciones': return <Notificaciones />;
    case 'timeline': return <Timeline />;
    case 'labor-ocr': return <LaborOcr />;
    case 'impuestos': return <ImpuestosModule />;
    case 'contabilidad': return <ContabilidadModule />;
    case 'registro-mercantil': return <RegistroMercantilModule />;
    case 'dashboard':
    default:
      return <TaxDashboard onNavigate={handleNavigate} />;
  }
}