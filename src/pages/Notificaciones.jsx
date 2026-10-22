import { useState, useRef, useEffect } from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import { useOutletContext,Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck, Trash2, AlertTriangle, CheckSquare, FileText, Calendar, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {notificationReadOptions} from '@/lib/notificationMutation.mjs';
import {referenceDestination} from '@/lib/navigationStack.mjs';
import {notificationDeleteOptions} from '@/lib/notificationDeleteMutation.mjs';

const TIPO_CONFIG = {
  aviso: { icon: Info, color: 'bg-blue-50 text-blue-600' },
  tarea: { icon: CheckSquare, color: 'bg-amber-50 text-amber-600' },
  alerta_fiscal: { icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  documento_revisado: { icon: FileText, color: 'bg-green-50 text-green-600' },
  obligacion_proxima: { icon: Calendar, color: 'bg-purple-50 text-purple-600' },
};

export default function Notificaciones() {
  const { user } = useOutletContext() || {};
  const queryClient=useQueryClient(),queryKey=['notifications',user?.email||'anonymous'];
  const query=useQuery({queryKey,enabled:!!user?.email,queryFn:()=>base44.entities.Notification.filter({destinatario_email:user.email},'-created_date',100),staleTime:30000,retry:1});
  const notifs=query.data||[],loading=query.isPending&&query.fetchStatus==='fetching';
  const [filter, setFilter] = useState('all'); // all | unread | read
  const [busy,setBusy]=useState(false),[actionError,setError]=useState('');
  const error=actionError||(query.isError?'No se pudieron actualizar las notificaciones. Se conserva la última información disponible.':'');
  const flight=useRef(false),identity=useRef(user?.email);
  useEffect(()=>{identity.current=user?.email;return()=>{identity.current=null;};},[user?.email]);
  const scope=user?.email;
  const deleteMutation=useMutation({mutationKey:['notification-delete',scope],...notificationDeleteOptions({queryClient,queryKey,persist:id=>base44.entities.Notification.delete(id),isCurrent:()=>identity.current===scope})});

  const load=()=>{setError('');return query.refetch();};
  const readMutation=useMutation({mutationKey:['notification-read',user?.email],...notificationReadOptions({queryClient,queryKey,persist:id=>base44.entities.Notification.update(id,{leida:true})})});

  const markRead = async (ids) => {
    if(flight.current)return;flight.current=true;setBusy(true);setError('');
    try{const result=await readMutation.mutateAsync({rows:notifs,ids});if(result.failed.length)setError(`${result.failed.length} notificación(es) no se guardaron. Se ha restaurado su estado; puedes reintentar.`);
    }catch{setError('No se pudo guardar el cambio. Actualiza y vuelve a intentarlo.');
    }finally{flight.current=false;setBusy(false);}
  };

  const markAllRead = async () => {
    await markRead(notifs.filter(n=>!n.leida).map(n=>n.id));
  };

  const deleteNotif = async (id) => {
    if(flight.current)return;flight.current=true;setBusy(true);setError('');
    try{await deleteMutation.mutateAsync({rows:notifs,id});}
    catch{if(identity.current===scope)setError('No se pudo eliminar la notificación. Se ha restaurado en la lista para reintentar.');}
    finally{flight.current=false;if(identity.current===scope)setBusy(false);}
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
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy} className="gap-2">
            <CheckCheck className="w-4 h-4" /> Marcar todas leídas
          </Button>
        )}
      </PageHeader>
      {busy&&<p role="status" className="text-sm text-muted-foreground mb-3">Guardando cambios…</p>}
      {error&&<div role="alert" className="text-sm text-destructive mb-3">{error}{!notifs.length&&<Button variant="outline" onClick={load} disabled={loading}>Reintentar</Button>}</div>}

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
            const reference=referenceDestination(n.url_referencia,window.location.origin);
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
                          onClick={() => markRead([n.id])}
                          disabled={busy}
                          aria-label="Marcar notificación como leída"
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Marcar como leída"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        disabled={busy}
                        aria-label="Eliminar notificación"
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
                    {reference&&(reference.internal?<Link to={reference.to} className="text-xs text-primary hover:underline">Ver detalle →</Link>:<a href={reference.to} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Ver detalle ↗</a>)}
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

