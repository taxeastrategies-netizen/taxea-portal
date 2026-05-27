import { useParams, useNavigate } from 'react-router-dom';
import TaxDashboard from '@/components/tax/TaxDashboard';
import Facturas from './Facturas';
import IngresosGastos from './IngresosGastos';
import Presupuestos from './Presupuestos';
import Proformas from './Proformas';
import Productos from './Productos';
import NotasPredefinidas from './NotasPredefinidas';
import LibroRegistros from './LibroRegistros';
import LectorGastos from './LectorGastos';
import LectorIngresos from './LectorIngresos';
import ObligacionesFiscales from './ObligacionesFiscales';
import AsistenteFiscal from './AsistenteFiscal';
import Notificaciones from './Notificaciones';
import Timeline from './Timeline';
import LaborOcr from './LaborOcr';
import ContabilidadModule from '@/components/tax/contabilidad/ContabilidadModule';
import RegistroMercantilModule from '@/components/mercantil/RegistroMercantilModule';

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
    case 'contabilidad': return <ContabilidadModule />;
    case 'registro-mercantil': return <RegistroMercantilModule />;
    case 'dashboard':
    default:
      return <TaxDashboard onNavigate={handleNavigate} />;
  }
}