import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown, Copy, CheckCircle, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RiesgoBadge from './RiesgoBadge';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function MensajeChat({ mensaje, onCrearTarea }) {
  const [copiado, setCopiado] = useState(false);
  const [valorado, setValorado] = useState(null);

  const copiar = () => {
    navigator.clipboard.writeText(mensaje.contenido);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const valorar = async (v) => {
    setValorado(v);
    if (mensaje.consulta_id) {
      await base44.functions.invoke('valorarConsulta', { consulta_id: mensaje.consulta_id, valoracion: v });
    }
  };

  if (mensaje.rol === 'user') {
    return (
      <div className="flex justify-end gap-2 group">
        <div className="max-w-[80%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
            {mensaje.contenido}
          </div>
          <div className="text-xs text-muted-foreground text-right mt-1 pr-1">{mensaje.hora}</div>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <UserCircle className="w-4 h-4 text-primary" />
        </div>
      </div>
    );
  }

  // Mensaje del asistente
  return (
    <div className="flex gap-2 group">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <span className="text-white text-xs font-bold">T</span>
      </div>

      <div className="max-w-[85%] space-y-2">
        {/* Burbuja principal */}
        <div className={cn(
          'rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed',
          mensaje.nivel_riesgo === 'rojo'
            ? 'bg-red-50 border border-red-100'
            : mensaje.nivel_riesgo === 'amarillo'
            ? 'bg-amber-50 border border-amber-100'
            : 'bg-card border border-border/60'
        )}>
          <ReactMarkdown
            className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 space-y-1 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 space-y-1 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >
            {mensaje.contenido}
          </ReactMarkdown>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2">
          {mensaje.nivel_riesgo && <RiesgoBadge nivel={mensaje.nivel_riesgo} compact />}
          {mensaje.fuente === 'preaprobada' && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Validado Taxea
            </span>
          )}
        </div>

        {/* Sugerencias de acción */}
        {mensaje.sugerencias?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mensaje.sugerencias.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  if (s.toLowerCase().includes('tarea')) onCrearTarea?.(mensaje);
                }}
                className="text-xs px-2.5 py-1 rounded-full border border-primary/25 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={copiar} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
            {copiado ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => valorar('util')}
            className={cn('p-1 rounded hover:bg-secondary transition-colors', valorado === 'util' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground')}
            title="Útil"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => valorar('no_util')}
            className={cn('p-1 rounded hover:bg-secondary transition-colors', valorado === 'no_util' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')}
            title="No útil"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground ml-1">{mensaje.hora}</span>
        </div>
      </div>
    </div>
  );
}