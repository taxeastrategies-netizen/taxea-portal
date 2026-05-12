import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, RefreshCw, Send, CheckCircle2, 
  Clock, AlertTriangle, Eye, Phone
} from 'lucide-react';

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: 'bg-slate-100 text-slate-600', icon: Clock },
  enviado:      { label: 'Enviado',      color: 'bg-blue-100 text-blue-700',   icon: Send },
  entregado:    { label: 'Entregado',    color: 'bg-teal/10 text-teal',        icon: CheckCircle2 },
  leido:        { label: 'Leído',        color: 'bg-green-100 text-green-700', icon: Eye },
  error:        { label: 'Error',        color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  reintentando: { label: 'Reintentando', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
};

export default function AdminWhatsApp() {
  const { user, isAdmin } = useOutletContext() || {};
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [selectedLog, setSelectedLog] = useState(null);
  const [reenviando, setReenviando] = useState(null);

  useEffect(() => {
    cargarLogs();
  }, []);

  const cargarLogs = async () => {
    setLoading(true);
    const data = await base44.entities.WhatsAppLog.list('-created_date', 100);
    setLogs(data || []);
    setLoading(false);
  };

  const handleReenviar = async (log) => {
    setReenviando(log.id);
    await base44.entities.WhatsAppLog.update(log.id, { estado: 'reintentando' });
    await base44.functions.invoke('enviarWhatsApp', {
      to: log.destinatario_telefono,
      mensaje: log.mensaje,
      whatsapp_log_id: log.id,
    });
    await cargarLogs();
    setReenviando(null);
  };

  const logsFiltrados = filtroEstado === 'todos'
    ? logs
    : logs.filter(l => l.estado === filtroEstado);

  const stats = {
    total: logs.length,
    enviado: logs.filter(l => l.estado === 'enviado').length,
    entregado: logs.filter(l => l.estado === 'entregado').length,
    leido: logs.filter(l => l.estado === 'leido').length,
    error: logs.filter(l => l.estado === 'error').length,
    pendiente: logs.filter(l => l.estado === 'pendiente').length,
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-center">
      <p className="text-sm text-muted-foreground">Acceso restringido a administradores</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="WhatsApp Notificaciones"
        subtitle="Seguimiento de mensajes automáticos enviados a clientes"
      >
        <Button variant="outline" size="sm" onClick={cargarLogs} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pendiente', value: stats.pendiente, color: 'text-slate-500' },
          { label: 'Enviado', value: stats.enviado, color: 'text-blue-600' },
          { label: 'Entregado', value: stats.entregado, color: 'text-teal' },
          { label: 'Leído', value: stats.leido, color: 'text-green-600' },
          { label: 'Error', value: stats.error, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 text-center shadow-card">
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Lista */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-card overflow-hidden">
          {/* Filtros */}
          <div className="flex items-center gap-1.5 p-3 border-b border-border flex-wrap">
            {['todos', 'pendiente', 'enviado', 'entregado', 'leido', 'error'].map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                  filtroEstado === e
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                )}
              >
                {e === 'todos' ? 'Todos' : ESTADO_CONFIG[e]?.label}
                {e !== 'todos' && <span className="ml-1 opacity-60">{stats[e] || 0}</span>}
              </button>
            ))}
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sin mensajes</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logsFiltrados.map(log => {
                const cfg = ESTADO_CONFIG[log.estado] || ESTADO_CONFIG.pendiente;
                const Icon = cfg.icon;
                const fecha = log.created_date ? new Date(log.created_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors',
                      selectedLog?.id === log.id && 'bg-secondary/40'
                    )}
                  >
                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{log.destinatario_nombre || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.modelo_label}{log.periodo ? ` · ${log.periodo}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{fecha}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detalle */}
        {selectedLog && (
          <div className="w-80 flex-shrink-0 bg-card border border-border rounded-xl shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Detalle del mensaje</p>
              <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* Info cliente */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-light rounded-full flex items-center justify-center text-teal text-sm font-bold">
                    {selectedLog.destinatario_nombre?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedLog.destinatario_nombre}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedLog.destinatario_telefono}
                    </p>
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Estado</p>
                {(() => {
                  const cfg = ESTADO_CONFIG[selectedLog.estado] || ESTADO_CONFIG.pendiente;
                  const Icon = cfg.icon;
                  return (
                    <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium', cfg.color)}>
                      <Icon className="w-3.5 h-3.5" /> {cfg.label}
                    </span>
                  );
                })()}
                {selectedLog.error_detalle && (
                  <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg p-2">{selectedLog.error_detalle}</p>
                )}
              </div>

              {/* Modelo */}
              {(selectedLog.modelo_label || selectedLog.periodo) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Obligación</p>
                  <p className="text-sm font-medium">{selectedLog.modelo_label}</p>
                  {selectedLog.periodo && <p className="text-xs text-muted-foreground">{selectedLog.periodo}</p>}
                </div>
              )}

              {/* Mensaje */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Mensaje enviado</p>
                <pre className="text-xs text-foreground bg-secondary/40 rounded-xl p-3 whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedLog.mensaje}
                </pre>
              </div>
            </div>

            {/* Acciones */}
            <div className="p-3 border-t border-border">
              <Button
                className="w-full bg-teal hover:bg-teal-dark"
                size="sm"
                onClick={() => handleReenviar(selectedLog)}
                disabled={reenviando === selectedLog.id}
              >
                {reenviando === selectedLog.id
                  ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Reenviando...</>
                  : <><Send className="w-3.5 h-3.5 mr-1.5" /> Reenviar WhatsApp</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}