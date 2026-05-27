import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, BookText, FileCheck, FolderOpen, Clock,
  AlertTriangle, CheckCircle, Building2, AlertCircle, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MercantilLibrosTab from './MercantilLibrosTab';
import MercantilCuentasTab from './MercantilCuentasTab';
import MercantilDocumentalTab from './MercantilDocumentalTab';
import MercantilHistorialTab from './MercantilHistorialTab';

const ESTADO_CFG = {
  no_iniciado:       { label: 'Sin iniciar',           color: 'bg-slate-100 text-slate-600 border-slate-200' },
  en_preparacion:    { label: 'En preparación',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  pendiente_revision:{ label: 'Pdte. revisión',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  presentado:        { label: 'Presentado',            color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  legalizado:        { label: 'Legalizado / inscrito', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  con_incidencias:   { label: 'Con incidencias',       color: 'bg-red-100 text-red-700 border-red-200' },
  cerrado:           { label: 'Cerrado',               color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const TABS = [
  { id: 'libros', label: 'Legalización de libros', icon: BookText },
  { id: 'cuentas', label: 'Cuentas anuales', icon: FileCheck },
  { id: 'documental', label: 'Gestor documental', icon: FolderOpen },
  { id: 'historial', label: 'Historial', icon: Clock },
];

const TIPO_LABEL = {
  sl: 'S.L.', sa: 'S.A.', otra_mercantil: 'Soc. Merc.', persona_fisica: 'Persona física',
  comunidad_bienes: 'C.B.', asociacion: 'Asociación', otra: 'Otra',
};

export default function MercantilExpedienteDetail({ sociedad, expediente: initialExp, ejercicio, onBack, isAdmin, user }) {
  const [activeTab, setActiveTab] = useState('libros');
  const [expediente, setExpediente] = useState(initialExp);
  const [savingEstado, setSavingEstado] = useState(false);
  const [showIncidencia, setShowIncidencia] = useState(false);
  const [incidenciaTexto, setIncidenciaTexto] = useState('');
  const [creating, setCreating] = useState(!initialExp);

  const esPF = sociedad.tipoEntidad === 'persona_fisica';

  const createExpediente = async () => {
    setCreating(false);
    const exp = await base44.entities.MercantilExpediente.create({
      sociedadId: sociedad.id,
      sociedadNombre: sociedad.nombreFiscal,
      ejercicio: ejercicio || String(new Date().getFullYear()),
      estadoGlobal: 'no_iniciado',
      estadoLibros: 'pendiente',
      estadoCuentas: 'pendiente',
      responsable: user?.email || '',
      ultimaActualizacion: new Date().toISOString(),
    });
    await base44.entities.MercantilHistorial.create({
      expedienteId: exp.id, sociedadId: sociedad.id,
      fecha: new Date().toISOString(), usuario: user?.email || 'admin',
      accion: `Expediente creado para el ejercicio ${ejercicio || new Date().getFullYear()}`,
      tipoAccion: 'expediente_creado',
    });
    setExpediente(exp);
  };

  useEffect(() => {
    if (!initialExp && !esPF) createExpediente();
  }, []);

  const refreshExpediente = async () => {
    if (!expediente) return;
    const updated = await base44.entities.MercantilExpediente.get(expediente.id).catch(() => null);
    if (updated) setExpediente(updated);
  };

  const updateEstadoGlobal = async (nuevoEstado) => {
    if (nuevoEstado === 'con_incidencias' && !incidenciaTexto && !showIncidencia) {
      setShowIncidencia(true); return;
    }
    setSavingEstado(true);
    const changes = { estadoGlobal: nuevoEstado, ultimaActualizacion: new Date().toISOString() };
    if (nuevoEstado === 'con_incidencias') changes.incidenciaAbierta = true;
    if (nuevoEstado === 'cerrado' || nuevoEstado === 'legalizado') changes.incidenciaAbierta = false;
    await base44.entities.MercantilExpediente.update(expediente.id, changes);
    await base44.entities.MercantilHistorial.create({
      expedienteId: expediente.id, sociedadId: sociedad.id,
      fecha: new Date().toISOString(), usuario: user?.email || 'admin',
      accion: `Estado global cambiado a: ${ESTADO_CFG[nuevoEstado]?.label}`,
      estadoAnterior: expediente.estadoGlobal,
      estadoNuevo: nuevoEstado,
      tipoAccion: 'cambio_estado',
      comentario: incidenciaTexto || '',
    });
    setExpediente(prev => ({ ...prev, ...changes }));
    setSavingEstado(false);
    setShowIncidencia(false);
    setIncidenciaTexto('');
  };

  const handleCerrar = async () => {
    if (!isAdmin) { alert('Solo un administrador puede cerrar un expediente.'); return; }
    if (!expediente.justificanteLibrosUrl && !expediente.motivoCierreManual) {
      const motivo = prompt('Falta justificante de legalización de libros. Introduce el motivo del cierre manual:');
      if (!motivo) return;
      await base44.entities.MercantilExpediente.update(expediente.id, { motivoCierreManual: motivo });
    }
    await updateEstadoGlobal('cerrado');
  };

  // Bloqueo persona física
  if (esPF && !isAdmin) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="w-4 h-4" />Volver</Button>
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <h3 className="font-jakarta font-bold text-amber-900">Obligación no aplicable — Persona física</h3>
          </div>
          <p className="text-sm text-amber-800">
            Esta obligación aplica exclusivamente a sociedades mercantiles. Para personas físicas, este expediente no resulta aplicable salvo criterio profesional específico.
          </p>
          <p className="text-xs text-amber-700">Para forzar la apertura del expediente, es necesaria la intervención de un administrador con justificación documentada.</p>
        </div>
      </div>
    );
  }

  if (creating || !expediente) {
    return (
      <div className="p-10 text-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Creando expediente...</p>
      </div>
    );
  }

  const estadoCfg = ESTADO_CFG[expediente.estadoGlobal] || ESTADO_CFG.no_iniciado;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-8"><ArrowLeft className="w-4 h-4" />Volver</Button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-jakarta font-bold text-foreground text-sm">{sociedad.nombreFiscal}</p>
              <p className="text-[11px] text-muted-foreground">{TIPO_LABEL[sociedad.tipoEntidad]} · {sociedad.nif} · Ejercicio {expediente.ejercicio}</p>
            </div>
          </div>
          <span className={cn('ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full border', estadoCfg.color)}>
            {estadoCfg.label}
          </span>
        </div>

        {/* Estado + acciones */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-2 bg-secondary/20">
          <p className="text-xs text-muted-foreground mr-1">Cambiar estado:</p>
          {Object.entries(ESTADO_CFG).filter(([k]) => k !== expediente.estadoGlobal).map(([k, v]) => (
            <Button key={k} size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => k === 'cerrado' ? handleCerrar() : updateEstadoGlobal(k)} disabled={savingEstado}>
              {v.label}
            </Button>
          ))}
        </div>

        {showIncidencia && (
          <div className="px-5 py-3 bg-red-50 border-t border-red-200 space-y-2">
            <p className="text-xs font-medium text-red-700">Describe la incidencia o subsanación requerida: *</p>
            <div className="flex gap-2">
              <Input value={incidenciaTexto} onChange={e => setIncidenciaTexto(e.target.value)} className="h-8 text-xs flex-1" placeholder="Descripción de la incidencia..." />
              <Button size="sm" onClick={() => updateEstadoGlobal('con_incidencias')} disabled={!incidenciaTexto}>Registrar</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowIncidencia(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {expediente.incidenciaAbierta && (
          <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-t border-red-200">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">Subsanación abierta — revisar expediente</p>
          </div>
        )}

        {/* Fechas de control */}
        <div className="px-5 py-3 border-t border-border grid grid-cols-3 gap-4">
          {[
            { label: 'Fecha cierre contable', key: 'fechaCierreContable' },
            { label: 'Límite legalización (control)', key: 'fechaLimiteLibros' },
            { label: 'Límite depósito cuentas (control)', key: 'fechaLimiteCuentas' },
          ].map(f => (
            <div key={f.key} className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">{f.label}</p>
              <Input type="date" defaultValue={expediente[f.key] || ''} className="h-7 text-xs"
                onBlur={async e => {
                  await base44.entities.MercantilExpediente.update(expediente.id, { [f.key]: e.target.value, ultimaActualizacion: new Date().toISOString() });
                  refreshExpediente();
                }} />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <Icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {activeTab === 'libros' && <MercantilLibrosTab expediente={expediente} isAdmin={isAdmin} user={user} onRefresh={refreshExpediente} />}
          {activeTab === 'cuentas' && <MercantilCuentasTab expediente={expediente} user={user} onRefresh={refreshExpediente} />}
          {activeTab === 'documental' && <MercantilDocumentalTab expediente={expediente} user={user} isAdmin={isAdmin} />}
          {activeTab === 'historial' && <MercantilHistorialTab expediente={expediente} user={user} />}
        </div>
      </div>
    </div>
  );
}