import { useNavigate } from 'react-router-dom';
import { LogOut, Eye } from 'lucide-react';
import { endImpersonation } from '@/lib/impersonation';

export default function ImpersonationBanner({ impersonation }) {
  const navigate = useNavigate();

  if (!impersonation) return null;

  const handleExit = () => {
    endImpersonation();
    navigate('/admin/clients');
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm flex-shrink-0">
      <div className="flex items-center gap-2 text-amber-800">
        <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span>
          <span className="font-semibold">Modo vista cliente:</span>{' '}
          estás viendo Taxea Portal como{' '}
          <span className="font-bold">{impersonation.clientName}</span>
        </span>
        <span className="text-amber-500 text-xs hidden sm:inline">· Sesión iniciada por administrador</span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        Volver a Admin
      </button>
    </div>
  );
}