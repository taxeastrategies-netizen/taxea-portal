import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Lightbulb, CheckCircle, Clock, Rocket, AlertCircle, Loader2, ThumbsUp, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const ESTADOS = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'pendiente_revision', label: 'Pendiente revisión' },
  { value: 'en_estudio', label: 'En estudio' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'en_desarrollo', label: 'En desarrollo' },
  { value: 'implementada', label: 'Implementada' },
  { value: 'rechazada', label: 'Rechazada' },
];

const TIPOS_LABEL = {
  nueva_funcionalidad: '✨ Nueva funcionalidad', mejora_visual: '🎨 Mejora visual',
  error: '🐛 Error', ia: '🤖 IA', contabilidad: '📊 Contabilidad',
  facturacion: '🧾 Facturación', dashboard: '📈 Dashboard',
  rendimiento: '⚡ Rendimiento', movil: '📱 Móvil', otro: '💡 Otro',
};

const ESTADO_COLOR = {
  nueva: 'bg-blue-50 text-blue-700 border-blue-200',
  pendiente_revision: 'bg-amber-50 text-amber-700 border-amber-200',
  en_estudio: 'bg-purple-50 text-purple-700 border-purple-200',
  aprobada: 'bg-green-50 text-green-700 border-green-200',
  en_desarrollo: 'bg-orange-50 text-orange-700 border-orange-200',
  implementada: 'bg-teal-light text-teal border-teal/20',
  rechazada: 'bg-secondary text-muted-foreground border-border',
};

const PRIOR_COLOR = { baja: 'text-muted-foreground', media: 'text-blue-600', alta: 'text-orange-500', critica: 'text-red-600 font-bold' };

export default function AdminSugerencias() {
  const { user } = useOutletContext() || {};
  const [sugerencias, setSugerencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [notaEdit, setNotaEdit] = useState({});

  const load = () => {
    setLoading(true);
    base44.entities.Sugerencia.list('-created_date', 200).then(data => {
      setSugerencias(data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const updateEstado = async (s, estado) => {
    setUpdating(s.id);
    const patch = { estado };
    if (estado === 'implementada') patch.publica = true;
    if (notaEdit[s.id] !== undefined) patch.nota_admin = notaEdit[s.id];
    await base44.entities.Sugerencia.update(s.id, patch);
    if (estado === 'implementada') {
      await base44.entities.Notification.create({
        company_id: s.company_id,
        destinatario_email: s.usuario_email,
        titulo: `🚀 Tu sugerencia ha sido implementada`,
        mensaje: `Tu sugerencia "${s.titulo}" ya está disponible en Taxea Portal.`,
        tipo: 'aviso',
      });
    }
    setUpdating(null);
    load();
  };

  const saveNota = async (s) => {
    if (notaEdit[s.id] === undefined) return;
    setUpdating(s.id);
    await base44.entities.Sugerencia.update(s.id, { nota_admin: notaEdit[s.id] });
    setUpdating(null);
    setNotaEdit(n => { const copy = { ...n }; delete copy[s.id]; return copy; });
    load();
  };

  const filtered = sugerencias.filter(s => {
    if (filterEstado !== 'all' && s.estado !== filterEstado) return false;
    if (filterTipo !== 'all' && s.tipo !== filterTipo) return false;
    if (search && !s.titulo.toLowerCase().includes(search.toLowerCase()) && !s.usuario_email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = ESTADOS.reduce((acc, e) => {
    acc[e.value] = sugerencias.filter(s => s.estado === e.value).length;
    return acc;
  }, {});

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <div className="p-8 text-center text-muted-foreground">Acceso restringido a administradores.</div>;
  }

  return (
    <div>
      <PageHeader title="Buzón de Sugerencias" subtitle="Gestión de sugerencias y mejoras de usuarios" />

      {/* KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setFilterEstado(prev => prev === e.value ? 'all' : e.value)}
            className={`p-3 rounded-xl border text-center transition-all hover:shadow-card ${filterEstado === e.value ? 'border-teal bg-teal-light' : 'bg-card border-border'}`}
          >
            <p className="text-lg font-jakarta font-bold text-foreground">{counts[e.value] || 0}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{e.label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-52 h-9" />
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TIPOS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No hay sugerencias con estos filtros</p>
            </div>
          )}
          {filtered.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl shadow-card p-5">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-jakarta font-semibold text-foreground">{s.titulo}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border ${ESTADO_COLOR[s.estado]}`}>{ESTADOS.find(e => e.value === s.estado)?.label}</span>
                    <span className={`text-xs font-medium ${PRIOR_COLOR[s.prioridad]}`}>{s.prioridad?.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{TIPOS_LABEL[s.tipo]} · {s.usuario_email} · {new Date(s.created_date).toLocaleDateString('es-ES')}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{s.descripcion}</p>

                  {/* Nota admin */}
                  <div className="mt-3">
                    <Input
                      placeholder="Nota para el usuario (opcional)..."
                      value={notaEdit[s.id] !== undefined ? notaEdit[s.id] : (s.nota_admin || '')}
                      onChange={e => setNotaEdit(n => ({ ...n, [s.id]: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    {notaEdit[s.id] !== undefined && (
                      <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => saveNota(s)}>Guardar nota</Button>
                    )}
                  </div>
                </div>

                {/* Cambiar estado */}
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <Select value={s.estado} onValueChange={v => updateEstado(s, v)} disabled={updating === s.id}>
                    <SelectTrigger className="h-8 text-xs">
                      {updating === s.id ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>{ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}