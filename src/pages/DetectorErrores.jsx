import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Shield, MoreVertical, Sparkles, RefreshCw, TrendingUp, Lightbulb, Zap, Brain, Clock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const SEVERIDAD = {
  baja: { label: 'Baja', class: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400', order: 4 },
  media: { label: 'Media', class: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400', order: 3 },
  alta: { label: 'Alta', class: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', order: 2 },
  critica: { label: 'Crítica', class: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-600', order: 1 },
};

const ESTADO = {
  detectado: { label: 'Detectado', class: 'bg-slate-100 text-slate-600' },
  en_revision: { label: 'En revisión', class: 'bg-blue-50 text-blue-700' },
  pendiente_cliente: { label: 'Pdte. cliente', class: 'bg-amber-50 text-amber-700' },
  resuelto: { label: 'Resuelto', class: 'bg-green-50 text-green-700' },
  ignorado: { label: 'Ignorado', class: 'bg-slate-100 text-slate-400' },
};

const CATEGORIA_LABEL = {
  fiscal: 'Fiscal', datos: 'Datos', rendimiento: 'Rendimiento', seguridad: 'Seguridad', plataforma: 'Plataforma', predictivo: 'Predictivo',
};

const SUGERENCIA_TIPO = {
  nueva_funcionalidad: { label: 'Nueva funcionalidad', icon: Zap, class: 'bg-teal text-white' },
  mejora_visual: { label: 'Mejora visual', icon: Sparkles, class: 'bg-purple-500 text-white' },
  ia: { label: 'IA', icon: Brain, class: 'bg-indigo-500 text-white' },
  contabilidad: { label: 'Contabilidad', icon: TrendingUp, class: 'bg-green-500 text-white' },
  facturacion: { label: 'Facturación', icon: TrendingUp, class: 'bg-blue-500 text-white' },
  dashboard: { label: 'Dashboard', icon: TrendingUp, class: 'bg-orange-500 text-white' },
  rendimiento: { label: 'Rendimiento', icon: Zap, class: 'bg-amber-500 text-white' },
  movil: { label: 'Móvil', icon: Zap, class: 'bg-pink-500 text-white' },
  otro: { label: 'Otro', icon: Lightbulb, class: 'bg-slate-400 text-white' },
};

export default function DetectorErrores() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [errors, setErrors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('errores');
  const [filterSeveridad, setFilterSeveridad] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = isAdmin ? 'platform' : company?.id;
      if (!companyId && !isAdmin) { setLoading(false); return; }

      // Admin: load platform-wide + own company errors; Client: own only
      const fetchErrors = isAdmin
        ? base44.asServiceRole.entities.FiscalError.list('-created_date', 100)
        : base44.entities.FiscalError.filter({ company_id: company.id }, '-created_date');
      const fetchSuggestions = isAdmin
        ? base44.asServiceRole.entities.Sugerencia.list('-created_date', 50)
        : base44.entities.Sugerencia.filter({ company_id: company.id }, '-created_date');

      const [errData, sugData] = await Promise.all([fetchErrors, fetchSuggestions]);
      setErrors(errData || []);
      setSuggestions(sugData || []);

      // Find last analysis timestamp
      const lastIa = (errData || []).find(e => e.fuente === 'ia_diario' || e.fuente === 'ia_manual');
      setLastAnalysis(lastIa?.created_date || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [company?.id, isAdmin]);

  useEffect(() => { if (company?.id || isAdmin) load(); }, [company?.id, isAdmin, load]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const resp = await base44.functions.invoke('runPlatformAnalysis', { manual: true });
      if (resp?.data?.status === 'ok') {
        await load();
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    }
    setAnalyzing(false);
  };

  const updateEstado = async (id, estado) => {
    await base44.entities.FiscalError.update(id, { estado });
    if (estado === 'resuelto' && company?.id) {
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'error_resuelto', titulo: 'Error resuelto', color: 'verde',
        usuario_email: user?.email, visibilidad: 'ambos', afecta_riesgo: false,
      });
    }
    load();
  };

  const crearTarea = async (error) => {
    if (!company?.id) return;
    await base44.entities.Task.create({
      company_id: company.id,
      titulo: `Corregir: ${error.tipo}`,
      descripcion: `${error.descripcion}\n\nAcción recomendada: ${error.accion_recomendada || ''}`,
      prioridad: error.severidad === 'critica' ? 'urgente' : error.severidad === 'alta' ? 'alta' : 'media',
      estado: 'pendiente_cliente', responsable: 'cliente', creada_por: user?.email,
    });
  };

  // Sort errors: most severe first, then by date
  const sortedErrors = [...errors].sort((a, b) => {
    const sevA = SEVERIDAD[a.severidad]?.order || 5;
    const sevB = SEVERIDAD[b.severidad]?.order || 5;
    if (sevA !== sevB) return sevA - sevB;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const filtered = sortedErrors.filter(e => {
    const matchSev = filterSeveridad === 'all' || e.severidad === filterSeveridad;
    const matchEst = filterEstado === 'all' || e.estado === filterEstado;
    return matchSev && matchEst;
  });

  // Split into errors and predictions
  const realErrors = filtered.filter(e => e.categoria_analisis !== 'predictivo');
  const predictions = filtered.filter(e => e.categoria_analisis === 'predictivo');

  const criticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado)).length;
  const pendientes = errors.filter(e => !['resuelto', 'ignorado'].includes(e.estado)).length;
  const resueltos = errors.filter(e => e.estado === 'resuelto').length;

  return (
    <div>
      <PageHeader
        title="Detector de Errores y Sugerencias de Mejora IA"
        subtitle="Análisis inteligente de la plataforma con detección predictiva e ideas de mejora"
        actions={
          <Button onClick={runAnalysis} disabled={analyzing} className="bg-teal hover:bg-teal-dark gap-2">
            {analyzing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando...</> : <><Brain className="w-4 h-4" /> Análisis IA manual</>}
          </Button>
        }
      />

      {/* Last analysis info */}
      {lastAnalysis && (
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Último análisis IA: {new Date(lastAnalysis).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Críticos</p>
          <p className="text-2xl font-jakarta font-bold text-red-700">{criticos}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Pendientes</p>
          <p className="text-2xl font-jakarta font-bold text-amber-700">{pendientes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-1">Resueltos</p>
          <p className="text-2xl font-jakarta font-bold text-green-700">{resueltos}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-medium text-purple-700 mb-1">Ideas IA</p>
          <p className="text-2xl font-jakarta font-bold text-purple-700">{suggestions.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-border">
        {[
          { key: 'errores', label: 'Errores detectados', icon: AlertTriangle, count: realErrors.length },
          { key: 'predictivos', label: 'Análisis predictivo', icon: TrendingUp, count: predictions.length },
          { key: 'mejoras', label: 'Ideas de mejora', icon: Lightbulb, count: suggestions.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-teal text-teal"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", activeTab === tab.key ? "bg-teal text-white" : "bg-muted text-muted-foreground")}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters only on errors/predictive tabs */}
      {activeTab !== 'mejoras' && (
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
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'mejoras' ? (
        <SuggestionList suggestions={suggestions} />
      ) : activeTab === 'predictivos' ? (
        predictions.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Sin predicciones" subtitle="Ejecuta un análisis IA para detectar riesgos futuros" />
        ) : (
          <ErrorList errors={predictions} isAdmin={isAdmin} updateEstado={updateEstado} crearTarea={crearTarea} />
        )
      ) : realErrors.length === 0 ? (
        <EmptyState icon={Shield} title="Sin errores detectados" subtitle="La plataforma está limpia" />
      ) : (
        <ErrorList errors={realErrors} isAdmin={isAdmin} updateEstado={updateEstado} crearTarea={crearTarea} />
      )}
    </div>
  );
}

function ErrorList({ errors, isAdmin, updateEstado, crearTarea }) {
  return (
    <div className="space-y-3">
      {errors.map(error => {
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
                    {error.categoria_analisis && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{CATEGORIA_LABEL[error.categoria_analisis] || error.categoria_analisis}</span>
                    )}
                    {error.fuente?.startsWith('ia') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-medium flex items-center gap-1">
                        <Brain className="w-3 h-3" /> IA
                      </span>
                    )}
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
  );
}

function SuggestionList({ suggestions }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {suggestions.length === 0 ? (
        <div className="md:col-span-2">
          <EmptyState icon={Lightbulb} title="Sin ideas de mejora" subtitle="Ejecuta un análisis IA para generar sugerencias innovadoras" />
        </div>
      ) : (
        suggestions.map(s => {
          const tipoCfg = SUGERENCIA_TIPO[s.tipo] || SUGERENCIA_TIPO.otro;
          const TipoIcon = tipoCfg.icon;
          const prio = SEVERIDAD[s.prioridad] || SEVERIDAD.media;
          return (
            <div key={s.id} className="bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", tipoCfg.class)}>
                  <TipoIcon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-jakarta font-semibold text-sm text-foreground">{s.titulo}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", prio.class)}>{prio.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{tipoCfg.label}</span>
                  <p className="text-sm text-muted-foreground mt-2">{s.descripcion}</p>
                  {s.usuario_nombre === 'Análisis IA' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
                      <Brain className="w-3 h-3" /> Generado por IA
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <Icon className="w-12 h-12 text-green-400 mx-auto mb-3" />
      <p className="font-jakarta font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}