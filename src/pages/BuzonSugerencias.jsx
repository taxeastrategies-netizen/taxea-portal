import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Lightbulb, Send, CheckCircle, Clock, Rocket, ThumbsUp, AlertCircle, Loader2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NoCompanyState from '@/components/ui/NoCompanyState';

const TIPOS = [
  { value: 'nueva_funcionalidad', label: '✨ Nueva funcionalidad' },
  { value: 'mejora_visual', label: '🎨 Mejora visual' },
  { value: 'error', label: '🐛 Error' },
  { value: 'ia', label: '🤖 IA' },
  { value: 'contabilidad', label: '📊 Contabilidad' },
  { value: 'facturacion', label: '🧾 Facturación' },
  { value: 'dashboard', label: '📈 Dashboard' },
  { value: 'rendimiento', label: '⚡ Rendimiento' },
  { value: 'movil', label: '📱 Móvil' },
  { value: 'otro', label: '💡 Otro' },
];

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica 🔥' },
];

const ESTADO_CONFIG = {
  nueva:             { label: 'Nueva', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Lightbulb },
  pendiente_revision:{ label: 'Pendiente revisión', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  en_estudio:        { label: 'En estudio', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Loader2 },
  aprobada:          { label: 'Aprobada ✓', color: 'bg-green-50 text-green-700 border-green-200', icon: ThumbsUp },
  en_desarrollo:     { label: 'En desarrollo 🔨', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Rocket },
  implementada:      { label: '🚀 Implementada', color: 'bg-teal-light text-teal border border-teal/20', icon: CheckCircle },
  rechazada:         { label: 'No aplica', color: 'bg-secondary text-muted-foreground border-border', icon: AlertCircle },
};

const BLANK = { titulo: '', descripcion: '', tipo: 'nueva_funcionalidad', prioridad: 'media' };

export default function BuzonSugerencias() {
  const { company, user, loadingCompany } = useOutletContext() || {};
  const [form, setForm] = useState(BLANK);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [misSugerencias, setMisSugerencias] = useState([]);
  const [novEdades, setNovEdades] = useState([]);
  const [loading, setLoading] = useState(true);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!company || !user) return;
    Promise.all([
      base44.entities.Sugerencia.filter({ usuario_email: user.email }),
      base44.entities.Sugerencia.filter({ estado: 'implementada', publica: true }),
    ]).then(([mis, pub]) => {
      setMisSugerencias(mis.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setNovEdades(pub.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)).slice(0, 6));
      setLoading(false);
    });
  }, [company, user, sent]);

  const handleSend = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim()) return;
    setSending(true);
    const sug = await base44.entities.Sugerencia.create({
      ...form,
      company_id: company.id,
      usuario_email: user.email,
      usuario_nombre: user.full_name || user.email,
      estado: 'nueva',
    });
    // Timeline
    await base44.entities.TimelineEvent.create({
      company_id: company.id,
      tipo: 'nota_interna',
      titulo: `💡 Sugerencia enviada: ${form.titulo}`,
      descripcion: `Tipo: ${TIPOS.find(t => t.value === form.tipo)?.label}`,
      color: 'azul',
      usuario_email: user.email,
      automatico: true,
      visibilidad: 'ambos',
    });
    // Notificación admin
    await base44.entities.Notification.create({
      company_id: company.id,
      destinatario_email: 'admin',
      titulo: `💡 Nueva sugerencia: ${form.titulo}`,
      mensaje: `${user.full_name || user.email} ha enviado una sugerencia de tipo "${TIPOS.find(t => t.value === form.tipo)?.label}".`,
      tipo: 'aviso',
    });
    setSending(false);
    setSent(true);
    setForm(BLANK);
    setTimeout(() => setSent(false), 3000);
  };

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Buzón de Sugerencias" />;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Buzón de Sugerencias"
        subtitle="Ayúdanos a mejorar Taxea Portal · Tu opinión vale"
      />

      {/* Formulario */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-teal" />
          </div>
          <div>
            <p className="font-jakarta font-semibold text-foreground">Nueva sugerencia</p>
            <p className="text-xs text-muted-foreground">Propon mejoras, reporta errores o pide funcionalidades</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input placeholder="Ej: Poder exportar facturas en ZIP" value={form.titulo} onChange={e => set('titulo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-none"
              placeholder="Describe con detalle tu sugerencia, el problema que resuelve o el comportamiento esperado..."
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || !form.titulo.trim() || !form.descripcion.trim()}
            className="w-full bg-teal hover:bg-teal-dark h-10 gap-2"
          >
            {sent ? <><CheckCircle className="w-4 h-4" /> ¡Enviada con éxito!</>
              : sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
              : <><Send className="w-4 h-4" /> Enviar sugerencia</>}
          </Button>
        </div>
      </div>

      {/* Novedades implementadas */}
      {novEdades.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-4 h-4 text-teal" />
            <p className="font-jakarta font-semibold text-foreground">🚀 Novedades Taxea Portal</p>
            <span className="ml-auto text-xs text-muted-foreground">Sugerencias implementadas</span>
          </div>
          <div className="space-y-2">
            {novEdades.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 bg-teal-light/40 rounded-lg border border-teal/10">
                <CheckCircle className="w-4 h-4 text-teal flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                  {s.descripcion && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.descripcion}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mis sugerencias */}
      {!loading && misSugerencias.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card p-6">
          <p className="font-jakarta font-semibold text-foreground mb-4">Mis sugerencias</p>
          <div className="space-y-2">
            {misSugerencias.map(s => {
              const cfg = ESTADO_CONFIG[s.estado] || ESTADO_CONFIG.nueva;
              const Icon = cfg.icon;
              return (
                <div key={s.id} className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg hover:bg-secondary/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{TIPOS.find(t => t.value === s.tipo)?.label} · {new Date(s.created_date).toLocaleDateString('es-ES')}</p>
                    {s.nota_admin && <p className="text-xs text-teal mt-1">💬 {s.nota_admin}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}