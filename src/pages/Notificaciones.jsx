import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck, Trash2, AlertTriangle, CheckSquare, FileText, Calendar, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_CONFIG = {
  aviso: { icon: Info, color: 'bg-blue-50 text-blue-600' },
  tarea: { icon: CheckSquare, color: 'bg-amber-50 text-amber-600' },
  alerta_fiscal: { icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  documento_revisado: { icon: FileText, color: 'bg-green-50 text-green-600' },
  obligacion_proxima: { icon: Calendar, color: 'bg-purple-50 text-purple-600' },
};

export default function Notificaciones() {
  const { user } = useOutletContext() || {};
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | read

  useEffect(() => { if (user?.email) load(); }, [user?.email]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Notification.filter({ destinatario_email: user.email }, '-created_date', 100);
    setNotifs(data || []);
    setLoading(false);
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { leida: true });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.leida);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { leida: true })));
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  };

  const deleteNotif = async (id) => {
    await base44.entities.Notification.delete(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.leida;
    if (filter === 'read') return n.leida;
    return true;
  });

  const unreadCount = notifs.filter(n => !n.leida).length;

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        subtitle={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
      >
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="w-4 h-4" /> Marcar todas leídas
          </Button>
        )}
      </PageHeader>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'unread', label: `Sin leer (${unreadCount})` },
          { key: 'read', label: 'Leídas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-jakarta font-semibold text-foreground">Sin notificaciones</p>
          <p className="text-sm text-muted-foreground mt-1">Tu bandeja está vacía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.aviso;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={cn(
                  "bg-card border border-border rounded-xl p-4 flex items-start gap-4 transition-all",
                  !n.leida && "border-l-4 border-l-primary bg-primary/5"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn("text-sm font-semibold text-foreground", !n.leida && "text-primary")}>{n.titulo}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.mensaje}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.leida && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Marcar como leída"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotif(n.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {n.created_date ? format(new Date(n.created_date), "d MMM yyyy, HH:mm", { locale: es }) : ''}
                    </span>
                    {!n.leida && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    {n.url_referencia && (
                      <a href={n.url_referencia} className="text-xs text-primary hover:underline">Ver detalle →</a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}