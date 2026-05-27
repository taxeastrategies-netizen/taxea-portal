import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, AlertTriangle, CheckCircle, Clock, XCircle,
  Building2, ChevronRight, RefreshCw, FileText, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CURRENT_YEAR = new Date().getFullYear();

const ESTADO_CFG = {
  no_iniciado:       { label: 'Sin iniciar',             color: 'bg-slate-100 text-slate-600 border-slate-200',    dot: 'bg-slate-400' },
  en_preparacion:    { label: 'En preparación',          color: 'bg-blue-100 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  pendiente_revision:{ label: 'Pdte. revisión',          color: 'bg-amber-100 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },
  presentado:        { label: 'Presentado',              color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  legalizado:        { label: 'Legalizado / inscrito',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  con_incidencias:   { label: 'Con incidencias',         color: 'bg-red-100 text-red-700 border-red-200',          dot: 'bg-red-500' },
  cerrado:           { label: 'Cerrado',                 color: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-300' },
};

const TIPO_LABEL = {
  sl: 'S.L.', sa: 'S.A.', otra_mercantil: 'Soc. Merc.', persona_fisica: 'Persona física',
  comunidad_bienes: 'C.B.', asociacion: 'Asociación', otra: 'Otra',
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.no_iniciado;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color + '/10')}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function MercantilDashboard({ onOpenExpediente, onCreateSociedad, isAdmin, user }) {
  const [sociedades, setSociedades] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterEjercicio, setFilterEjercicio] = useState(String(CURRENT_YEAR));

  const load = async () => {
    setLoading(true);
    const [socs, exps] = await Promise.all([
      base44.entities.MercantilSociedad.list('nombreFiscal', 200).catch(() => []),
      base44.entities.MercantilExpediente.list('-ultimaActualizacion', 500).catch(() => []),
    ]);
    setSociedades(socs || []);
    setExpedientes(exps || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const expsByEjercicio = expedientes.filter(e => !filterEjercicio || e.ejercicio === filterEjercicio);
  const expMap = {};
  expsByEjercicio.forEach(e => { expMap[e.sociedadId] = e; });

  const filtered = sociedades.filter(s => {
    const exp = expMap[s.id];
    const matchSearch = !search ||
      s.nombreFiscal?.toLowerCase().includes(search.toLowerCase()) ||
      s.nif?.includes(search);
    const matchEstado = filterEstado === 'all' || (exp?.estadoGlobal === filterEstado) || (!exp && filterEstado === 'no_iniciado');
    return matchSearch && matchEstado;
  });

  // KPIs
  const sinIniciar = sociedades.filter(s => !expMap[s.id]).length;
  const enPrep = expsByEjercicio.filter(e => e.estadoGlobal === 'en_preparacion').length;
  const conIncidencias = expsByEjercicio.filter(e => e.estadoGlobal === 'con_incidencias').length;
  const legalizados = expsByEjercicio.filter(e => e.estadoGlobal === 'legalizado' || e.estadoGlobal === 'cerrado').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">Registro Mercantil y Cuentas Anuales</h1>
          <p className="text-xs text-muted-foreground">Centro de control documental por sociedad y ejercicio.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-8"><RefreshCw className="w-3.5 h-3.5" /></Button>
          {isAdmin && (
            <Button size="sm" onClick={onCreateSociedad} className="h-8 gap-1.5"><Plus className="w-3.5 h-3.5" />Nueva sociedad</Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Sin expediente" value={sinIniciar} color="text-slate-500" icon={Clock} />
        <KpiCard label="En preparación" value={enPrep} color="text-blue-600" icon={FileText} />
        <KpiCard label="Con incidencias" value={conIncidencias} color="text-red-600" icon={AlertCircle} />
        <KpiCard label="Legalizados / cerrados" value={legalizados} color="text-emerald-600" icon={CheckCircle} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar sociedad o NIF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterEjercicio} onValueChange={setFilterEjercicio}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Ejercicio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Sin sociedades registradas.</p>
            {isAdmin && <Button size="sm" onClick={onCreateSociedad} className="mt-3 gap-1.5"><Plus className="w-3.5 h-3.5" />Crear primera sociedad</Button>}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 px-4 py-2.5 bg-secondary/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Sociedad</span><span>Tipo</span><span>NIF</span><span>Ejercicio</span><span>Estado expediente</span><span />
            </div>
            <div className="divide-y divide-border">
              {filtered.map(soc => {
                const exp = expMap[soc.id];
                const esPF = soc.tipoEntidad === 'persona_fisica';
                return (
                  <div key={soc.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 px-4 py-3 items-center hover:bg-secondary/10 group">
                    <div>
                      <p className="text-sm font-medium text-foreground">{soc.nombreFiscal}</p>
                      {soc.registroMercantil && <p className="text-[11px] text-muted-foreground">{soc.registroMercantil}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{TIPO_LABEL[soc.tipoEntidad] || '—'}</span>
                    <span className="text-xs font-mono text-foreground">{soc.nif}</span>
                    <span className="text-xs text-muted-foreground">{exp?.ejercicio || filterEjercicio}</span>
                    <div>
                      {esPF ? (
                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">No aplica (P.F.)</span>
                      ) : exp ? (
                        <EstadoBadge estado={exp.estadoGlobal} />
                      ) : (
                        <span className="text-[11px] text-slate-500">Sin expediente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                        onClick={() => onOpenExpediente(soc, exp, filterEjercicio)}>
                        {exp ? 'Abrir' : 'Crear expediente'} <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}