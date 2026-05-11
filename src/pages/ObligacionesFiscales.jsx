import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, LayoutList, Clock, Globe } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODELOS_AEAT, getModeloInfo } from '@/components/obligaciones/CalendarioAEAT';
import KPIsObligaciones from '@/components/obligaciones/KPIsObligaciones';
import VistaTimeline from '@/components/obligaciones/VistaTimeline';
import ProximosVencimientos from '@/components/obligaciones/ProximosVencimientos';
import CalendarioGeneral from '@/components/obligaciones/CalendarioGeneral';
import StatusBadge from '@/components/ui/StatusBadge';

const TABS = [
  { id: 'proximos', label: 'Próximos vencimientos', icon: Clock },
  { id: 'lista', label: 'Mis obligaciones', icon: LayoutList },
  { id: 'timeline', label: 'Timeline anual', icon: Calendar },
  { id: 'aeat', label: 'Calendario AEAT', icon: Globe },
];

const EMPTY = {
  modelo: 'modelo_303', periodo: '', fecha_limite: '',
  estado: 'pendiente_documentacion', resultado: 'pendiente',
  importe: '', comentarios_asesor: '', anio: new Date().getFullYear(), trimestre: ''
};

const ESTADO_COLOR = {
  pendiente_documentacion: 'bg-secondary text-muted-foreground border-border',
  en_preparacion: 'bg-blue-50 text-blue-700 border-blue-200',
  presentado: 'bg-green-100 text-green-800 border-green-300',
  domiciliado: 'bg-green-50 text-green-700 border-green-200',
  pagado: 'bg-green-100 text-green-800 border-green-300',
  finalizado: 'bg-green-100 text-green-800 border-green-300',
};

const ESTADO_LABELS = {
  pendiente_documentacion: 'Pdte. documentación',
  en_preparacion: 'En preparación',
  presentado: 'Presentado',
  domiciliado: 'Domiciliado',
  pagado: 'Pagado',
  finalizado: 'Finalizado',
};

export default function ObligacionesFiscales() {
  const { company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('proximos');
  const [filterEstado, setFilterEstado] = useState('all');

  useEffect(() => {
    if (company?.id) load();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TaxObligation.filter({ company_id: company.id });
    setObligations(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company.id, importe: parseFloat(form.importe) || 0 };
    if (editing) await base44.entities.TaxObligation.update(editing.id, payload);
    else await base44.entities.TaxObligation.create(payload);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const handleCambiarEstado = async (id, estado) => {
    await base44.entities.TaxObligation.update(id, { estado });
    load();
  };

  const filtered = obligations.filter(o => filterEstado === 'all' || o.estado === filterEstado);

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Obligaciones Fiscales" />;

  return (
    <div>
      <PageHeader title="Obligaciones Fiscales" subtitle="Calendario tributario y seguimiento de modelos">
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nueva obligación
          </Button>
        )}
      </PageHeader>

      <KPIsObligaciones obligations={obligations} />

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-5 bg-secondary/40 border border-border rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === t.id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <>
          {activeTab === 'proximos' && (
            <div className="bg-card border border-border rounded-xl shadow-card p-5">
              <ProximosVencimientos obligations={obligations} onCambiarEstado={isAdmin ? handleCambiarEstado : null} />
            </div>
          )}

          {activeTab === 'lista' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pendiente_documentacion">Pdte. documentación</SelectItem>
                    <SelectItem value="en_preparacion">En preparación</SelectItem>
                    <SelectItem value="presentado">Presentado</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filtered.length} obligaciones</span>
              </div>
              {filtered.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-foreground">Sin obligaciones</p>
                  <p className="text-sm text-muted-foreground mt-1">Tu asesor irá añadiendo tus obligaciones fiscales</p>
                </div>
              ) : filtered.map(obl => {
                const info = getModeloInfo(obl.modelo);
                const now = new Date();
                const isVencida = obl.fecha_limite && new Date(obl.fecha_limite) < now && !['finalizado','presentado','pagado','domiciliado'].includes(obl.estado);
                const isProxima = !isVencida && obl.fecha_limite && (new Date(obl.fecha_limite) - now) / 86400000 <= 15 && !['finalizado','presentado','pagado','domiciliado'].includes(obl.estado);
                return (
                  <div key={obl.id} className={cn('bg-card rounded-xl border shadow-card p-5 flex items-start justify-between gap-4',
                    isVencida ? 'border-red-200 bg-red-50/30' : isProxima ? 'border-amber-200 bg-amber-50/30' : 'border-border')}>
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
                        isVencida ? 'bg-red-100' : isProxima ? 'bg-amber-100' : 'bg-teal-light')}>
                        {info.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-jakarta font-semibold text-foreground">{info.label}</p>
                        <p className="text-xs text-muted-foreground">{info.desc}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                          <span className="text-sm text-muted-foreground">Período: {obl.periodo || '—'}</span>
                          {obl.fecha_limite && <span className={cn('text-sm font-medium', isVencida ? 'text-red-600' : isProxima ? 'text-amber-600' : 'text-muted-foreground')}>
                            Límite: {new Date(obl.fecha_limite).toLocaleDateString('es-ES')}
                          </span>}
                          {obl.importe > 0 && <span className="text-sm font-medium text-foreground">{obl.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>}
                        </div>
                        {obl.comentarios_asesor && (
                          <div className="mt-2 bg-teal/5 border border-teal/15 rounded-lg px-3 py-2">
                            <p className="text-xs text-muted-foreground font-medium mb-0.5">Nota del asesor</p>
                            <p className="text-sm text-foreground">{obl.comentarios_asesor}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', ESTADO_COLOR[obl.estado] || 'bg-secondary text-muted-foreground border-border')}>
                        {ESTADO_LABELS[obl.estado] || obl.estado}
                      </span>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(obl); setForm({ ...obl }); setShowForm(true); }}>Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCambiarEstado(obl.id, 'en_preparacion')}>En preparación</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCambiarEstado(obl.id, 'presentado')}>Marcar presentado</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCambiarEstado(obl.id, 'finalizado')}>Marcar finalizado</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'timeline' && <VistaTimeline obligations={obligations} />}

          {activeTab === 'aeat' && <CalendarioGeneral obligacionesActivas={obligations} />}
        </>
      )}

      {/* Formulario */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar obligación' : 'Nueva obligación fiscal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Modelo *</Label>
              <Select value={form.modelo} onValueChange={v => setForm(f => ({ ...f, modelo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS_AEAT.map(m => <SelectItem key={m.value} value={m.value}>{m.icon} {m.label} — {m.desc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Período *</Label>
              <Input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Ej: 1T 2025..." />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha límite *</Label>
              <Input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resultado</Label>
              <Select value={form.resultado} onValueChange={v => setForm(f => ({ ...f, resultado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="a_pagar">A pagar</SelectItem>
                  <SelectItem value="a_devolver">A devolver</SelectItem>
                  <SelectItem value="cero">Cero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Importe (€)</Label>
              <Input type="number" step="0.01" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Input type="number" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: parseInt(e.target.value) }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Comentarios del asesor</Label>
              <Textarea value={form.comentarios_asesor || ''} onChange={e => setForm(f => ({ ...f, comentarios_asesor: e.target.value }))} placeholder="Notas o instrucciones para el cliente..." rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}