import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/ui/PageHeader';
import RiesgoBadge from '@/components/asistente/RiesgoBadge';
import {
  BarChart2, MessageSquare, Brain, CheckCircle, AlertTriangle,
  Plus, Pencil, Trash2, Eye, Filter, TrendingUp, Users, Zap,
  BookOpen, Lock, ThumbsUp, ThumbsDown, CheckSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

const IMPUESTOS = ['irpf','iva','igic','sociedades','facturacion','gastos_deducibles','modelos','retenciones','general','otro'];
const RIESGOS = ['verde','amarillo','rojo'];

const defaultRespuesta = {
  titulo: '', pregunta_tipo: '', palabras_clave: [],
  respuesta: '', nivel_riesgo: 'verde', impuesto: 'general',
  activa: true, aprobada: false, nota_interna: ''
};

export default function AdminAsistente() {
  const { user, isAdmin } = useOutletContext() || {};
  const [tab, setTab] = useState('consultas');
  const [consultas, setConsultas] = useState([]);
  const [respuestasBase, setRespuestasBase] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroRiesgo, setFiltroRiesgo] = useState('all');
  const [filtroImpuesto, setFiltroImpuesto] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(defaultRespuesta);
  const [kwInput, setKwInput] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      base44.entities.AIConsulta.list('-created_date', 200),
      base44.entities.AIRespuestaBase.list('-created_date', 100),
    ]);
    setConsultas(c || []);
    setRespuestasBase(r || []);
    setLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Acceso restringido a administradores</p>
        </div>
      </div>
    );
  }

  // Stats
  const totalConsultas = consultas.length;
  const criticas = consultas.filter(c => c.nivel_riesgo === 'rojo').length;
  const derivadas = consultas.filter(c => c.estado === 'derivada_asesor').length;
  const utiles = consultas.filter(c => c.valoracion === 'util').length;
  const sinValorar = consultas.filter(c => c.valoracion === 'sin_valorar').length;

  // FAQ automáticas: top impuestos
  const impuestoCount = {};
  consultas.forEach(c => { impuestoCount[c.impuesto_detectado] = (impuestoCount[c.impuesto_detectado] || 0) + 1; });
  const topImpuestos = Object.entries(impuestoCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Filtrar consultas
  const consultasFiltradas = consultas.filter(c => {
    const riesgoOk = filtroRiesgo === 'all' || c.nivel_riesgo === filtroRiesgo;
    const impOk = filtroImpuesto === 'all' || c.impuesto_detectado === filtroImpuesto;
    const busOk = !busqueda || c.pregunta?.toLowerCase().includes(busqueda.toLowerCase());
    return riesgoOk && impOk && busOk;
  });

  const abrirForm = (r = null) => {
    setEditando(r);
    setForm(r ? { ...r, palabras_clave: r.palabras_clave || [] } : defaultRespuesta);
    setKwInput('');
    setShowForm(true);
  };

  const guardarRespuesta = async () => {
    if (!form.titulo || !form.respuesta) return;
    const data = { ...form, creada_por: user?.email };
    if (editando) {
      await base44.entities.AIRespuestaBase.update(editando.id, data);
    } else {
      await base44.entities.AIRespuestaBase.create(data);
    }
    setShowForm(false);
    loadAll();
  };

  const eliminarRespuesta = async (id) => {
    await base44.entities.AIRespuestaBase.delete(id);
    loadAll();
  };

  const toggleAprobada = async (r) => {
    await base44.entities.AIRespuestaBase.update(r.id, { aprobada: !r.aprobada });
    loadAll();
  };

  const crearTareaDesdeConsulta = async (consulta) => {
    await base44.entities.Task.create({
      company_id: consulta.company_id,
      titulo: `Revisión fiscal: ${consulta.pregunta?.slice(0, 60)}`,
      descripcion: `Consulta derivada desde Asistente Fiscal.\n\nPregunta: ${consulta.pregunta}\n\nRespuesta orientativa: ${consulta.respuesta}`,
      prioridad: consulta.nivel_riesgo === 'rojo' ? 'alta' : 'media',
      estado: 'pendiente_taxea',
      responsable: 'taxea',
      creada_por: user?.email,
    });
    await base44.entities.AIConsulta.update(consulta.id, { tarea_creada: true, estado: 'cerrada' });
    loadAll();
  };

  const TABS = [
    { id: 'consultas', label: 'Consultas', icon: MessageSquare, count: totalConsultas },
    { id: 'base', label: 'Base de respuestas', icon: BookOpen, count: respuestasBase.length },
    { id: 'analytics', label: 'Analítica', icon: BarChart2 },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Panel IA Fiscal"
        subtitle="Gestión del Asistente Fiscal Taxea — consultas, entrenamiento y analítica"
      >
        {tab === 'base' && (
          <Button onClick={() => abrirForm()} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Nueva respuesta
          </Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Consultas totales', value: totalConsultas, icon: MessageSquare, color: 'text-primary' },
          { label: 'En riesgo alto', value: criticas, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Derivadas al asesor', value: derivadas, icon: CheckSquare, color: 'text-amber-500' },
          { label: 'Valoradas útil', value: utiles, icon: ThumbsUp, color: 'text-emerald-500' },
        ].map((k, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn('w-4 h-4', k.color)} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <div className="text-2xl font-bold font-jakarta">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count !== undefined && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Consultas */}
      {tab === 'consultas' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar consulta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-64"
            />
            <Select value={filtroRiesgo} onValueChange={setFiltroRiesgo}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Riesgo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los riesgos</SelectItem>
                <SelectItem value="verde">Verde</SelectItem>
                <SelectItem value="amarillo">Amarillo</SelectItem>
                <SelectItem value="rojo">Rojo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroImpuesto} onValueChange={setFiltroImpuesto}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Impuesto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {IMPUESTOS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Cargando consultas...</div>
          ) : consultasFiltradas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No hay consultas con esos filtros</div>
          ) : (
            <div className="space-y-2">
              {consultasFiltradas.map(c => (
                <div key={c.id} className="bg-card border border-border/60 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <RiesgoBadge nivel={c.nivel_riesgo} compact />
                        {c.impuesto_detectado && (
                          <span className="text-xs bg-primary/5 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{c.impuesto_detectado}</span>
                        )}
                        {c.fuente === 'preaprobada' && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Preaprobada</span>
                        )}
                        {c.tarea_creada && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">✓ Tarea creada</span>
                        )}
                        {c.valoracion === 'util' && <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />}
                        {c.valoracion === 'no_util' && <ThumbsDown className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <p className="font-medium text-sm text-foreground mb-1">❓ {c.pregunta}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{c.respuesta}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">{new Date(c.created_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        {c.fuente === 'ia_generada' && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">IA + Web</span>}
                        {c.fuente === 'preaprobada' && <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Base interna</span>}
                        {c.requiere_entrenamiento && <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">⚠ Revisar</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!c.tarea_creada && (
                        <Button size="sm" variant="outline" onClick={() => crearTareaDesdeConsulta(c)} className="text-xs h-7 gap-1">
                          <CheckSquare className="w-3 h-3" /> Tarea
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Base de respuestas */}
      {tab === 'base' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Cargando...</div>
          ) : respuestasBase.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay respuestas preaprobadas aún.</p>
              <Button onClick={() => abrirForm()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Crear primera respuesta
              </Button>
            </div>
          ) : (
            respuestasBase.map(r => (
              <div key={r.id} className={cn('bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow', r.aprobada ? 'border-emerald-200' : 'border-border/60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-semibold text-sm">{r.titulo}</span>
                      <RiesgoBadge nivel={r.nivel_riesgo} compact />
                      {r.aprobada
                        ? <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aprobada</span>
                        : <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Pendiente</span>
                      }
                      {r.impuesto && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{r.impuesto}</span>}
                      {r.veces_usada > 0 && <span className="text-xs text-blue-600">↗ {r.veces_usada} usos</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{r.respuesta}</p>
                    {r.palabras_clave?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.palabras_clave.map((k, i) => (
                          <span key={i} className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full border border-primary/20">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggleAprobada(r)} className="text-xs h-7">
                      {r.aprobada ? 'Desaprobar' : 'Aprobar'}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirForm(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => eliminarRespuesta(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Analítica */}
      {tab === 'analytics' && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Temas más consultados
            </h3>
            {topImpuestos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos aún</p>
            ) : (
              <div className="space-y-3">
                {topImpuestos.map(([imp, count]) => (
                  <div key={imp} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-36 capitalize">{imp}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(count / topImpuestos[0][1]) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> Distribución por riesgo
            </h3>
            {['verde','amarillo','rojo'].map(nivel => {
              const n = consultas.filter(c => c.nivel_riesgo === nivel).length;
              const pct = totalConsultas ? Math.round((n / totalConsultas) * 100) : 0;
              const colors = { verde: 'bg-emerald-500', amarillo: 'bg-amber-400', rojo: 'bg-red-500' };
              const labels = { verde: 'General (verde)', amarillo: 'Circunstancial (amarillo)', rojo: 'Alto riesgo (rojo)' };
              return (
                <div key={nivel} className="flex items-center gap-3 mb-3">
                  <span className="text-sm w-44">{labels[nivel]}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className={cn('h-2 rounded-full', colors[nivel])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-muted-foreground w-10 text-right">{n} ({pct}%)</span>
                </div>
              );
            })}
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5 sm:col-span-2">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Consultas sin valorar (requieren atención)
            </h3>
            {consultas.filter(c => c.valoracion === 'sin_valorar' && c.nivel_riesgo !== 'verde').length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin consultas pendientes de revisión</p>
            ) : (
              <div className="space-y-2">
                {consultas
                  .filter(c => c.valoracion === 'sin_valorar' && c.nivel_riesgo !== 'verde')
                  .slice(0, 8)
                  .map(c => (
                    <div key={c.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                      <RiesgoBadge nivel={c.nivel_riesgo} compact />
                      <p className="text-sm flex-1 text-foreground">{c.pregunta}</p>
                      {!c.tarea_creada && (
                        <Button size="sm" variant="outline" onClick={() => crearTareaDesdeConsulta(c)} className="text-xs h-7 flex-shrink-0 gap-1">
                          <CheckSquare className="w-3 h-3" /> Tarea
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal respuesta base */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar respuesta base' : 'Nueva respuesta preaprobada'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Gastos de software deducibles" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Tipo de pregunta *</Label>
                <Input value={form.pregunta_tipo} onChange={e => setForm(f => ({ ...f, pregunta_tipo: e.target.value }))} placeholder="Ej: deducibilidad_software" />
              </div>
              <div className="space-y-1.5">
                <Label>Nivel de riesgo</Label>
                <Select value={form.nivel_riesgo} onValueChange={v => setForm(f => ({ ...f, nivel_riesgo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verde">🟢 Verde — Consulta general</SelectItem>
                    <SelectItem value="amarillo">🟡 Amarillo — Depende de circunstancias</SelectItem>
                    <SelectItem value="rojo">🔴 Rojo — Requiere asesor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Impuesto / Área</Label>
                <Select value={form.impuesto} onValueChange={v => setForm(f => ({ ...f, impuesto: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPUESTOS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Palabras clave (para detección automática)</Label>
                <div className="flex gap-2">
                  <Input
                    value={kwInput}
                    onChange={e => setKwInput(e.target.value)}
                    placeholder="Añadir palabra clave..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && kwInput.trim()) {
                        setForm(f => ({ ...f, palabras_clave: [...(f.palabras_clave || []), kwInput.trim()] }));
                        setKwInput('');
                        e.preventDefault();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={() => {
                    if (kwInput.trim()) {
                      setForm(f => ({ ...f, palabras_clave: [...(f.palabras_clave || []), kwInput.trim()] }));
                      setKwInput('');
                    }
                  }}>Añadir</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(form.palabras_clave || []).map((k, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/5 text-primary border border-primary/20 px-2 py-1 rounded-full">
                      {k}
                      <button onClick={() => setForm(f => ({ ...f, palabras_clave: f.palabras_clave.filter((_, idx) => idx !== i) }))} className="hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Respuesta preaprobada *</Label>
                <Textarea value={form.respuesta} onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))} rows={6} placeholder="Escribe la respuesta en markdown. Usa listas, negritas, etc." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nota interna (solo admins)</Label>
                <Textarea value={form.nota_interna || ''} onChange={e => setForm(f => ({ ...f, nota_interna: e.target.value }))} rows={2} placeholder="Contexto interno, excepciones, referencias normativas..." />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="aprobada" checked={form.aprobada} onChange={e => setForm(f => ({ ...f, aprobada: e.target.checked }))} />
                <Label htmlFor="aprobada">Marcar como aprobada (será usada antes que la IA)</Label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="activa" checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} />
                <Label htmlFor="activa">Activa</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={guardarRespuesta} disabled={!form.titulo || !form.respuesta}>
              {editando ? 'Guardar cambios' : 'Crear respuesta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}