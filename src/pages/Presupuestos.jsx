import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, FileCheck, MoreVertical, TrendingUp, Clock, BarChart3, FileText, Filter } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DocumentWorkspace from '@/components/quotes/DocumentWorkspace';
import DocumentForm from '@/components/quotes/DocumentForm';

export default function Presupuestos() {
  const { company, user, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterYear, setFilterYear] = useState('todos');

  useEffect(() => {
    if (company?.id) { load(); }
    else if (!loadingCompany) { setLoading(false); }
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Quote.filter({ company_id: company.id });
    setItems(data || []);
    if (selectedDoc) {
      const updated = (data || []).find(d => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    }
    setLoading(false);
  };

  const fmt = n => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const years = useMemo(() => {
    const ys = new Set(items.map(i => i.fecha ? new Date(i.fecha).getFullYear() : null).filter(Boolean));
    return Array.from(ys).sort((a, b) => b - a);
  }, [items]);

  const kpis = useMemo(() => {
    const total = items.length;
    const borradores = items.filter(i => i.estado === 'borrador' || !i.estado).length;
    const enviados = items.filter(i => i.estado === 'enviado').length;
    const aceptados = items.filter(i => i.estado === 'aceptado').length;
    const rechazados = items.filter(i => i.estado === 'rechazado').length;
    const pendientes = items.filter(i => ['enviado', 'pendiente'].includes(i.estado)).length;
    const valorTotal = items.reduce((s, i) => s + (i.total || 0), 0);
    const valorAceptado = items.filter(i => i.estado === 'aceptado').reduce((s, i) => s + (i.total || 0), 0);
    const valorPendiente = items.filter(i => ['enviado', 'pendiente'].includes(i.estado)).reduce((s, i) => s + (i.total || 0), 0);
    const tasa = total > 0 ? Math.round((aceptados / total) * 100) : 0;
    return { total, borradores, enviados, aceptados, rechazados, pendientes, valorTotal, valorAceptado, valorPendiente, tasa };
  }, [items]);

  const filtered = items.filter(i => {
    const matchSearch = !search || i.numero_presupuesto?.toLowerCase().includes(search.toLowerCase()) || i.cliente_nombre?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || i.estado === filterStatus || (filterStatus === 'borrador' && !i.estado);
    const matchYear = filterYear === 'todos' || (i.fecha && new Date(i.fecha).getFullYear() === Number(filterYear));
    return matchSearch && matchStatus && matchYear;
  });

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Presupuestos" />;

  if (selectedDoc) {
    return (
      <DocumentWorkspace
        doc={selectedDoc}
        docType="quote"
        company={company}
        user={user}
        onClose={() => setSelectedDoc(null)}
        onEdit={(q) => { setEditing(q); setSelectedDoc(null); setShowForm(true); }}
        onRefresh={load}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">Presupuestos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestiona tus presupuestos comerciales</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-taxea-red hover:bg-taxea-red-dark h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo presupuesto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Resumen */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Resumen</p>
              <p className="text-xs text-muted-foreground">Estado general</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-3">{kpis.total}</p>
          <div className="space-y-1">
            {[
              { label: 'Borradores', val: kpis.borradores, dot: 'bg-gray-400' },
              { label: 'Enviados', val: kpis.enviados, dot: 'bg-blue-400' },
              { label: 'Aceptados', val: kpis.aceptados, dot: 'bg-emerald-500' },
              { label: 'Rechazados', val: kpis.rechazados, dot: 'bg-red-400' },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.dot} inline-block`} /> {r.label}
                </span>
                <span className="font-medium">{r.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Valor económico */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Valor económico</p>
              <p className="text-xs text-muted-foreground">Importe presupuestado</p>
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-600 mb-3">{fmt(kpis.valorTotal)} &#8364;</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Presupuestos aceptados</span>
              <span className="font-medium text-emerald-600">{fmt(kpis.valorAceptado)} &#8364;</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pendientes de aceptar</span>
              <span className="font-medium text-amber-600">{fmt(kpis.valorPendiente)} &#8364;</span>
            </div>
          </div>
        </div>

        {/* Tasa de conversión */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Tasa de conversión</p>
              <p className="text-xs text-muted-foreground">Efectividad</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-violet-600 mb-3">{kpis.tasa}%</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Presupuestos enviados</span>
              <span className="font-medium">{kpis.enviados}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Presupuestos aceptados</span>
              <span className="font-medium">{kpis.aceptados}</span>
            </div>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Pendientes</p>
              <p className="text-xs text-muted-foreground">Requieren seguimiento</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mb-3">{kpis.pendientes}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Por enviar</span>
              <span className="font-medium">{kpis.borradores}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Esperando respuesta</span>
              <span className="font-medium">{kpis.enviados}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {['todos', 'borrador', 'enviado', 'aceptado', 'rechazado'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filterStatus === s
                ? 'bg-taxea-red text-white border-taxea-red'
                : 'bg-card border-border text-muted-foreground hover:border-taxea-red/40'
            }`}>
            {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {years.length > 0 && (
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-foreground">
            <option value="todos">Todos los años</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar presupuesto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Listado de presupuestos</p>
          <p className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {loading
          ? <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin mx-auto" /></div>
          : filtered.length === 0
          ? (
            <div className="p-14 text-center">
              <FileCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground mb-1">Sin presupuestos</p>
              <p className="text-xs text-muted-foreground mb-4">No hay presupuestos que coincidan con los filtros aplicados.</p>
              <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear presupuesto
              </Button>
            </div>
          )
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">N&#186;</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(q => (
                    <tr key={q.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => setSelectedDoc(q)}>
                      <td className="px-4 py-3 font-medium text-foreground">{q.numero_presupuesto}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.fecha}</td>
                      <td className="px-4 py-3">{q.cliente_nombre || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(q.total)} &#8364;</td>
                      <td className="px-4 py-3"><StatusBadge status={q.estado} /></td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedDoc(q)}>Ver documento</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditing(q); setShowForm(true); }}>Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => base44.entities.Quote.update(q.id, { estado: 'aceptado' }).then(load)}>Marcar aceptado</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      <DocumentForm
        open={showForm}
        onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}
        editing={editing}
        docType="quote"
        company={company}
        user={user}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}