import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MensajeChat from '@/components/asistente/MensajeChat';
import SugerenciasRapidas from '@/components/asistente/SugerenciasRapidas';
import {
  Send, Sparkles, MessageSquare, ChevronDown,
  AlertCircle, CheckSquare, Trash2, RefreshCw, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const AVISO_LEGAL = 'La información facilitada tiene carácter orientativo y general. No constituye asesoramiento fiscal vinculante ni sustituye la revisión profesional personalizada por parte de Taxea Strategies.';

const sesionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const msgBienvenida = {
  id: 'welcome',
  rol: 'assistant',
  contenido: `¡Hola! Soy el **Asistente Fiscal Taxea** 👋

Puedo ayudarte con consultas sobre **IVA, IRPF, IGIC, gastos deducibles, modelos tributarios, facturación** y mucho más.

Recuerda que mis respuestas son orientativas. El equipo de **Taxea Strategies** supervisa y valida la información para garantizar calidad y precisión.

¿En qué puedo ayudarte hoy?`,
  hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  nivel_riesgo: null,
};

export default function AsistenteFiscal() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [mensajes, setMensajes] = useState([msgBienvenida]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(true);
  const [scrollBottom, setScrollBottom] = useState(true);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (scrollBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  const enviar = async (texto) => {
    const pregunta = (texto || input).trim();
    if (!pregunta || cargando || !company?.id) return;

    setMostrarSugerencias(false);
    setInput('');
    setCargando(true);

    const msgUsuario = {
      id: Date.now(),
      rol: 'user',
      contenido: pregunta,
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
    setMensajes(prev => [...prev, msgUsuario]);

    const historial = mensajes
      .filter(m => m.rol !== 'welcome' && m.id !== 'welcome')
      .slice(-6)
      .map(m => ({ rol: m.rol, contenido: m.contenido }));

    const res = await base44.functions.invoke('asistenteFiscal', {
      pregunta,
      company_id: company.id,
      historial,
      sesion_id: sesionId,
    });

    const data = res.data;
    const msgAsistente = {
      id: Date.now() + 1,
      rol: 'assistant',
      contenido: data.respuesta || 'No pude procesar tu consulta. Por favor, inténtalo de nuevo.',
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      nivel_riesgo: data.nivel_riesgo,
      impuesto: data.impuesto_detectado,
      sugerencias: data.sugerencias || [],
      fuente: data.fuente,
      derivar_asesor: data.derivar_asesor,
      consulta_id: data.consulta_id,
    };

    setMensajes(prev => [...prev, msgAsistente]);
    setCargando(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const limpiarChat = () => {
    setMensajes([msgBienvenida]);
    setMostrarSugerencias(true);
    setInput('');
  };

  const crearTareaDesdeConsulta = async (mensaje) => {
    if (!company?.id) return;
    await base44.entities.Task.create({
      company_id: company.id,
      titulo: `Revisión fiscal: ${mensajes.find(m => m.rol === 'user' && mensajes.indexOf(m) < mensajes.indexOf(mensaje))?.contenido?.slice(0, 60) || 'Consulta del asistente'}`,
      descripcion: `Consulta derivada desde el Asistente Fiscal Taxea.\n\nRespuesta orientativa del asistente:\n${mensaje.contenido}`,
      prioridad: mensaje.nivel_riesgo === 'rojo' ? 'alta' : 'media',
      estado: 'pendiente_taxea',
      responsable: 'taxea',
      creada_por: user?.email,
    });
    if (mensaje.consulta_id) {
      await base44.functions.invoke('valorarConsulta', { consulta_id: mensaje.consulta_id, tarea_creada: true });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border/60 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-jakarta font-bold text-foreground text-lg leading-tight">Asistente Fiscal Taxea</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Activo · Supervisado por Taxea Strategies</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <a href="/admin-asistente" className="gap-2 text-xs">
                  <BarChart2 className="w-3.5 h-3.5" /> Panel admin
                </a>
              </Button>
            )}
            <button onClick={limpiarChat} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Nueva conversación">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Área de mensajes */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-background"
        onScroll={(e) => {
          const el = e.currentTarget;
          setScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
        }}
      >
        {mensajes.map((msg) => (
          <MensajeChat key={msg.id} mensaje={msg} onCrearTarea={crearTareaDesdeConsulta} />
        ))}

        {/* Indicador de escritura */}
        {cargando && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sugerencias */}
        {mostrarSugerencias && mensajes.length <= 1 && (
          <div className="mt-2">
            <SugerenciasRapidas onSelect={(p) => enviar(p)} />
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Aviso legal */}
      <div className="flex-shrink-0 px-4 py-2 bg-muted/40 border-t border-border/40">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{AVISO_LEGAL}</p>
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-border/60 bg-card">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta fiscal... (Enter para enviar)"
              className="resize-none min-h-[44px] max-h-[120px] pr-12 text-sm"
              rows={1}
              disabled={cargando}
            />
            <div className="absolute right-2 bottom-2">
              <Button
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => enviar()}
                disabled={!input.trim() || cargando}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        {!mostrarSugerencias && (
          <button
            onClick={() => setMostrarSugerencias(true)}
            className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Ver preguntas frecuentes
          </button>
        )}
      </div>
    </div>
  );
}