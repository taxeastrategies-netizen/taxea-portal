import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Muestra un estado de onboarding cuando el usuario no tiene empresa configurada.
 * Usado en todas las páginas que requieren company_id para cargar datos.
 */
export default function NoCompanyState({ pageName = 'esta sección' }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-jakarta font-bold text-foreground mb-2">
          Configura tu empresa primero
        </h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Para acceder a {pageName}, necesitas configurar los datos de tu empresa. 
          Es rápido y solo tienes que hacerlo una vez.
        </p>
        <Button asChild className="gap-2">
          <Link to="/ajustes">
            Configurar empresa <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}