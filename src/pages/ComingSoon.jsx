import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-10">
      <div className="text-center max-w-md px-8">
        {/* Taxea Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/fd5032746_ChatGPTImage7may202610_56_53pm.png"
            alt="Taxea Strategies"
            className="h-20 object-contain"
          />
        </div>

        {/* Lock icon */}
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>

        {/* Text */}
        <h1 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
          Próximamente
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-2">
          Estamos desarrollando nuevas herramientas para ti.
        </p>
        <p className="text-slate-400 text-xs leading-relaxed mb-8">
          Esta sección estará disponible muy pronto con funcionalidades avanzadas diseñadas especialmente para tu negocio.
        </p>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-taxea-red/8 text-taxea-red text-xs font-semibold px-4 py-2 rounded-full mb-8">
          <Wrench className="w-3.5 h-3.5" />
          En desarrollo — Coming soon
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
        </div>
      </div>
    </div>
  );
}