import { cn } from '@/lib/utils';

const statusConfig = {
  pendiente: { label: 'Pendiente', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_revision: { label: 'En revisión', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  revisado: { label: 'Revisado', class: 'bg-teal-50 text-teal-700 border-teal-200' },
  contabilizado: { label: 'Contabilizado', class: 'bg-green-50 text-green-700 border-green-200' },
  presentado: { label: 'Presentado', class: 'bg-purple-50 text-purple-700 border-purple-200' },
  rechazado: { label: 'Rechazado', class: 'bg-red-50 text-red-700 border-red-200' },
  pendiente_documentacion: { label: 'Pdte. documentación', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_preparacion: { label: 'En preparación', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  domiciliado: { label: 'Domiciliado', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  pagado: { label: 'Pagado', class: 'bg-green-50 text-green-700 border-green-200' },
  finalizado: { label: 'Finalizado', class: 'bg-slate-50 text-slate-700 border-slate-200' },
  cobrada: { label: 'Cobrada', class: 'bg-green-50 text-green-700 border-green-200' },
  vencida: { label: 'Vencida', class: 'bg-red-50 text-red-700 border-red-200' },
  aprobado: { label: 'Aprobado', class: 'bg-green-50 text-green-700 border-green-200' },
  borrador: { label: 'Borrador', class: 'bg-slate-50 text-slate-600 border-slate-200' },
  enviado: { label: 'Enviado', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  aceptado: { label: 'Aceptado', class: 'bg-green-50 text-green-700 border-green-200' },
  convertido_factura: { label: 'Convertido', class: 'bg-teal-50 text-teal-700 border-teal-200' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, class: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      config.class, className
    )}>
      {config.label}
    </span>
  );
}