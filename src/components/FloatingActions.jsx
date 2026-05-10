import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Upload, FileText, FileCheck, MessageSquare, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
{ icon: TrendingDown, label: 'Subir gasto', color: 'bg-orange-500', path: '/lector-gastos' },
{ icon: Upload, label: 'Subir ingreso', color: 'bg-blue-500', path: '/lector-ingresos' },
{ icon: FileText, label: 'Crear factura', color: 'bg-taxea-red', path: '/facturas?nueva=true' },
{ icon: FileCheck, label: 'Crear presupuesto', color: 'bg-purple-500', path: '/presupuestos?nuevo=true' },
{ icon: MessageSquare, label: 'Mis tareas', color: 'bg-slate-600', path: '/tareas' },
];

export default function FloatingActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-fade-in">
          {actions.map((action) => (
            <button
              key={action.path}
              onClick={() => { navigate(action.path); setOpen(false); }}
              className="flex items-center gap-3 group"
            >
              <span className="bg-card shadow-card text-sm font-medium text-foreground px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {action.label}
              </span>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110",
                action.color
              )}>
                <action.icon className="w-4 h-4 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          open ? "bg-slate-700 rotate-45" : "bg-taxea-red hover:bg-taxea-accent"
        )}
      >
        {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}

      </button>
    </div>
  );
}