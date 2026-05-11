import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown, Copy, CheckCircle, UserCircle, ExternalLink, Shield, Globe, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RiesgoBadge from './RiesgoBadge';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// ── Nivel de confianza ──
function ConfianzaBadge({ nivel }) {
  if (!nivel) return null;
  const cfg = {
    alta: { label: 'Confianza alta', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: Shield },
    media: { label: 'Confianza media', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle },
    baja: { label: 'Requiere revisión', color: 'text-red-700 bg-red-50 border-red-200', icon: AlertTriangle },
  };
  const c = cfg[nivel];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full', c.color)}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

// ── Fuentes consultadas ──
function FuentesConsultadas({ fuentes }) {
  if (!fuentes || fuentes.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border/40">
      <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
        <Globe className="w-3 h-3" /> Fuentes consultadas
      </p>
      <div className="space-y-1">
        {fuentes.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground mt-0.5 flex-shrink-0">{i + 1}.</span>
            <div className="min-w-0">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  {f.nombre}
                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-xs font-medium text-foreground">{f.nombre}</span>
              )}
              {f.descripcion && (
                <p className="text-xs text-muted-foreground leading-snug">{f.descripcion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  // ── Mensaje del usuario ──
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

  // ── Mensaje del asistente ──
  const esDerivado = mensaje.derivar_asesor;
  const burbuja = esDerivado
    ? 'bg-red-50 border border-red-200'
    : mensaje.nivel_riesgo === 'amarillo'
    ? 'bg-amber-50 border border-amber-100'
    : 'bg-card border border-border/60';

  return (
    <div className="flex gap-2 group">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <span className="text-white text-xs font-bold">T</span>
      </div>

      <div className="max-w-[88%] space-y-2 min-w-0">
        {/* Burbuja principal */}
        <div className={cn('rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed', burbuja)}>
          <ReactMarkdown
            className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 space-y-1 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 space-y-1 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
              table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
              th: ({ children }) => <th className="border border-border/50 px-2 py-1 bg-muted text-left font-semibold">{children}</th>,
              td: ({ children }) => <td className="border border-border/50 px-2 py-1">{children}</td>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic text-xs">
                  {children}
                </blockquote>
              ),
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  {children}<ExternalLink className="w-2.5 h-2.5" />
                </a>
              ),
            }}
          >
            {mensaje.contenido}
          </ReactMarkdown>

          {/* Fuentes dentro de la burbuja */}
          <FuentesConsultadas fuentes={mensaje.fuentes_usadas} />
        </div>

        {/* Metadata: badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {mensaje.nivel_riesgo && <RiesgoBadge nivel={mensaje.nivel_riesgo} compact />}
          {mensaje.nivel_confianza && <ConfianzaBadge nivel={mensaje.nivel_confianza} />}
          {mensaje.fuente === 'preaprobada' && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Validado Taxea
            </span>
          )}
          {mensaje.fuente === 'ia_generada' && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full">
              <Globe className="w-3 h-3" /> IA + Búsqueda web
            </span>
          )}
          {mensaje.impuesto && mensaje.impuesto !== 'general' && (
            <span className="text-xs bg-secondary text-secondary-foreground border border-border/60 px-2 py-0.5 rounded-full capitalize">
              {mensaje.impuesto}
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
                  if (s.toLowerCase().includes('tarea') || s.toLowerCase().includes('revisión') || s.toLowerCase().includes('asesor')) {
                    onCrearTarea?.(mensaje);
                  }
                }}
                className="text-xs px-2.5 py-1 rounded-full border border-primary/25 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Acciones hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={copiar}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Copiar respuesta"
          >
            {copiado ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => valorar('util')}
            className={cn('p-1 rounded hover:bg-secondary transition-colors', valorado === 'util' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground')}
            title="Respuesta útil"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => valorar('no_util')}
            className={cn('p-1 rounded hover:bg-secondary transition-colors', valorado === 'no_util' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')}
            title="Respuesta no útil"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground ml-1">{mensaje.hora}</span>
        </div>
      </div>
    </div>
  );
}