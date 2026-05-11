import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, AlertTriangle, CheckCircle, Clock, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const MODELOS = [
  { value: 'modelo_303', label: 'Modelo 303 - IVA Trimestral' },
  { value: 'modelo_390', label: 'Modelo 390 - Resumen Anual IVA' },
  { value: 'modelo_130', label: 'Modelo 130 - IRPF Trimestral' },
  { value: 'modelo_111', label: 'Modelo 111 - Retenciones IRPF' },
  { value: 'modelo_115', label: 'Modelo 115 - Retenciones Alquiler' },
  { value: 'modelo_202', label: 'Modelo 202 - Pago Fraccionado IS' },
  { value: 'modelo_200', label: 'Modelo 200 - Impuesto de Sociedades' },
  { value: 'modelo_349', label: 'Modelo 349 - Operaciones Intracomunitarias' },
  { value: 'modelo_420_igic', label: 'Modelo 420 - IGIC Trimestral' },
  { value: 'modelo_425_igic', label: 'Modelo 425 - Resumen Anual IGIC' },
  { value: 'renta', label: 'Declaración de la Renta (IRPF)' },
  { value: 'cuentas_anuales', label: 'Cuentas Anuales' },
  { value: 'libros_contables', label: 'Libros Contables' },
  { value: 'otra', label: 'Otra obligación' },
];

const EMPTY = {
  modelo: 'modelo_303', periodo: '', fecha_limite: '',
  estado: 'pendiente_documentacion', resultado: 'pendiente',
  importe: '', comentarios_asesor: '', anio: new Date().getFullYear(), trimestre: ''
};

export default function ObligacionesFiscales() {
  const { company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterEstado, setFilterEstado] = useState('all');

  useEffect(() => {
    if (company?.id) {
      load();
    } else if (!loadingCompany) {
      setLoading(false);
    }
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

  const isVencida = (obl) => {
    if (!obl.fecha_limite) return false;
    return new Date(obl.fecha_limite) < new Date() && !['finalizado', 'presentado', 'pagado'].includes(obl.estado);
  };

  const isProxima = (obl) => {
    if (!obl.fecha_limite) return false;
    const diff = (new Date(obl.fecha_limite) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 15 && !['finalizado', 'presentado', 'pagado'].includes(obl.estado);
  };

  const filtered = obligations.filter(o => filterEstado === 'all' || o.estado === filterEstado);

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Obligaciones Fiscales" />;

  return (
    <div>
      <PageHeader
        title="Obligaciones Fiscales"
        subtitle="Seguimiento de tus modelos y presentaciones fiscales"
      >
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nueva obligación
          </Button>
        )}
      </PageHeader>

      {/* Alertas */}
      {obligations.some(isVencida) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Tienes obligaciones vencidas sin presentar</p>
            <p className="text-xs text-red-600 mt-0.5">Contacta con tu asesor a la mayor brevedad posible</p>
          </div>
        </div>
      )}
      {obligations.some(isProxima) && !obligations.some(isVencida) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700">Tienes obligaciones fiscales próximas</p>
            <p className="text-xs text-amber-600 mt-0.5">Asegúrate de tener toda la documentación lista</p>
          </div>
        </div>
      )}

      {/* Filtro */}
      <div className="mb-5">
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente_documentacion">Pdte. documentación</SelectItem>
            <SelectItem value="en_preparacion">En preparación</SelectItem>
            <SelectItem value="presentado">Presentado</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="font-medium text-foreground">Sin obligaciones registradas</p>
              <p className="text-sm text-muted-foreground mt-1">Tu asesor irá añadiendo tus obligaciones fiscales</p>
            </div>
          ) : filtered.map(obl => (
            <div key={obl.id} className={cn(
              "bg-card rounded-xl border shadow-card p-5 flex items-start justify-between gap-4",
              isVencida(obl) ? "border-red-200 bg-red-50/30" :
              isProxima(obl) ? "border-amber-200 bg-amber-50/30" :
              "border-border"
            )}>
              <div className="flex items-start gap-4 flex-1">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  isVencida(obl) ? "bg-red-100" : isProxima(obl) ? "bg-amber-100" : "bg-teal-light"
                )}>
                  <Calendar className={cn("w-5 h-5", isVencida(obl) ? "text-red-600" : isProxima(obl) ? "text-amber-600" : "text-teal")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-jakarta font-semibold text-foreground">
                    {MODELOS.find(m => m.value === obl.modelo)?.label || obl.modelo}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    <span className="text-sm text-muted-foreground">Período: {obl.periodo || '—'}</span>
                    <span className="text-sm text-muted-foreground">Límite: {obl.fecha_limite || '—'}</span>
                    {obl.importe > 0 && (
                      <span className="text-sm font-medium text-foreground">{obl.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                    )}
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
                <StatusBadge status={obl.estado} />
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(obl); setForm({ ...obl }); setShowForm(true); }}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => base44.entities.TaxObligation.update(obl.id, { estado: 'en_preparacion' }).then(load)}>Marcar en preparación</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => base44.entities.TaxObligation.update(obl.id, { estado: 'presentado' }).then(load)}>Marcar presentado</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => base44.entities.TaxObligation.update(obl.id, { estado: 'finalizado' }).then(load)}>Marcar finalizado</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar obligación' : 'Nueva obligación fiscal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Modelo *</Label>
              <Select value={form.modelo} onValueChange={v => setForm(f => ({ ...f, modelo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODELOS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Período *</Label>
              <Input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Ej: 1T 2024, Enero 2024..." />
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
                  <SelectItem value="pendiente_documentacion">Pdte. documentación</SelectItem>
                  <SelectItem value="en_preparacion">En preparación</SelectItem>
                  <SelectItem value="presentado">Presentado</SelectItem>
                  <SelectItem value="domiciliado">Domiciliado</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
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