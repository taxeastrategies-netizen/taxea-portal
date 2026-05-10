import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Shield, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const SEVERIDAD = {
  baja: { label: 'Baja', class: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  media: { label: 'Media', class: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  alta: { label: 'Alta', class: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  critica: { label: 'Crítica', class: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-600' },
};

const ESTADO = {
  detectado: { label: 'Detectado', class: 'bg-slate-100 text-slate-600' },
  en_revision: { label: 'En revisión', class: 'bg-blue-50 text-blue-700' },
  pendiente_cliente: { label: 'Pdte. cliente', class: 'bg-amber-50 text-amber-700' },
  resuelto: { label: 'Resuelto', class: 'bg-green-50 text-green-700' },
  ignorado: { label: 'Ignorado', class: 'bg-slate-100 text-slate-400' },
};

export default function DetectorErrores() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeveridad, setFilterSeveridad] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.FiscalError.filter({ company_id: company.id }, '-created_date');
    setErrors(data || []);
    setLoading(false);
  };

  const updateEstado = async (id, estado) => {
    await base44.entities.FiscalError.update(id, { estado });
    if (estado === 'resuelto') {
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'error_resuelto',
        titulo: 'Error resuelto',
        color: 'verde',
        usuario_email: user?.email,
        visibilidad: 'ambos',
        afecta_riesgo: false,
      });
    }
    load();
  };

  const crearTarea = async (error) => {
    await base44.entities.Task.create({
      company_id: company.id,
      titulo: `Corregir: ${error.tipo}`,
      descripcion: `${error.descripcion}\n\nAcción recomendada: ${error.accion_recomendada || ''}`,
      prioridad: error.severidad === 'critica' ? 'urgente' : error.severidad === 'alta' ? 'alta' : 'media',
      estado: 'pendiente_cliente',
      responsable: 'cliente',
      creada_por: user?.email,
    });
    // Notificar al cliente
    const comp = await base44.entities.Company.filter({ id: company.id });
    const ownerEmail = comp?.[0]?.owner_email;
    if (ownerEmail) {
      await base44.entities.Notification.create({
        company_id: company.id,
        destinatario_email: ownerEmail,
        titulo: `Error fiscal detectado: ${error.tipo}`,
        mensaje: error.accion_recomendada || error.descripcion,
        tipo: 'alerta_fiscal',
        leida: false,
        url_referencia: '/errores',
      });
    }
    // Timeline
    await base44.entities.TimelineEvent.create({
      company_id: company.id,
      tipo: 'error_detectado',
      titulo: `Error detectado: ${error.tipo}`,
      descripcion: error.descripcion,
      color: error.severidad === 'critica' ? 'rojo' : 'amarillo',
      usuario_email: user?.email,
      automatico: false,
      visibilidad: 'admin',
      afecta_riesgo: true,
    });
  };

  const filtered = errors.filter(e => {
    const matchSev = filterSeveridad === 'all' || e.severidad === filterSeveridad;
    const matchEst = filterEstado === 'all' || e.estado === filterEstado;
    return matchSev && matchEst;
  });

  const criticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado)).length;
  const pendientes = errors.filter(e => !['resuelto', 'ignorado'].includes(e.estado)).length;

  return (
    <div>
      <PageHeader
        title="Detector de Errores"
        subtitle="Incidencias fiscales y documentales detectadas automáticamente"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Errores críticos</p>
          <p className="text-2xl font-jakarta font-bold text-red-700">{criticos}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Pendientes</p>
          <p className="text-2xl font-jakarta font-bold text-amber-700">{pendientes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-1">Resueltos</p>
          <p className="text-2xl font-jakarta font-bold text-green-700">{errors.filter(e => e.estado === 'resuelto').length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={filterSeveridad} onValueChange={setFilterSeveridad}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Severidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="detectado">Detectado</SelectItem>
            <SelectItem value="en_revision">En revisión</SelectItem>
            <SelectItem value="pendiente_cliente">Pdte. cliente</SelectItem>
            <SelectItem value="resuelto">Resuelto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="font-jakarta font-semibold text-foreground">Sin errores detectados</p>
          <p className="text-sm text-muted-foreground mt-1">Tu documentación está limpia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(error => {
            const sev = SEVERIDAD[error.severidad] || SEVERIDAD.media;
            const est = ESTADO[error.estado] || ESTADO.detectado;
            return (
              <div key={error.id} className={cn(
                "bg-card rounded-xl border shadow-card p-5",
                error.severidad === 'critica' ? "border-red-200 bg-red-50/20" :
                error.severidad === 'alta' ? "border-orange-200 bg-orange-50/10" : "border-border"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0", sev.dot)} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{error.tipo}</p>
                        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", sev.class)}>{sev.label}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", est.class)}>{est.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{error.descripcion}</p>
                      {error.accion_recomendada && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-blue-700 mb-0.5">Acción recomendada</p>
                          <p className="text-xs text-blue-600">{error.accion_recomendada}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isAdmin && <DropdownMenuItem onClick={() => updateEstado(error.id, 'en_revision')}>Marcar en revisión</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => updateEstado(error.id, 'resuelto')}>Marcar resuelto</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateEstado(error.id, 'ignorado')}>Ignorar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => crearTarea(error)}>Crear tarea</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}