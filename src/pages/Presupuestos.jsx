import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Search, FileCheck, MoreVertical, TrendingUp, Clock, BarChart3, FileText, Filter, Download } from 'lucide-react';
import { downloadPresupuestosPDF } from '@/lib/generateSummaryPDF';
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadPresupuestosPDF(items, company)} className="gap-1.5 h-9">
            <Download className="w-4 h-4" /> Descargar resumen
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-taxea-red hover:bg-taxea-red-dark h-9 gap-1.5">
            <Plus className="w-4 h-4" /> Nuevo presupuesto
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Total presupuestos</p>
          <p className="text-3xl font-bold text-foreground mb-4">{kpis.total}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-gray-50 rounded-lg px-2 py-1.5">
              <p className="text-xs text-muted-foreground">Borradores</p>
              <p className="text-sm font-semibold text-foreground">{kpis.borradores}</p>
            </div>
            <div className="bg-blue-50 rounded-lg px-2 py-1.5">
              <p className="text-xs text-blue-600">Enviados</p>
              <p className="text-sm font-semibold text-blue-700">{kpis.enviados}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
              <p className="text-xs text-emerald-600">Aceptados</p>
              <p className="text-sm font-semibold text-emerald-700">{kpis.aceptados}</p>
            </div>
            <div className="bg-red-50 rounded-lg px-2 py-1.5">
              <p className="text-xs text-red-500">Rechazados</p>
              <p className="text-sm font-semibold text-red-600">{kpis.rechazados}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Valor total</p>
          <p className="text-3xl font-bold text-foreground mb-1">{fmt(kpis.valorTotal)} <span className="text-lg font-medium text-muted-foreground">&#8364;</span></p>
          <p className="text-xs text-muted-foreground mb-4">Importe presupuestado</p>
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Aceptado</span>
              <span className="text-xs font-semibold text-emerald-600">{fmt(kpis.valorAceptado)} &#8364;</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Por aceptar</span>
              <span className="text-xs font-semibold text-amber-600">{fmt(kpis.valorPendiente)} &#8364;</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Tasa de conversión</p>
          <p className="text-3xl font-bold text-taxea-red mb-1">{kpis.tasa}<span className="text-xl">%</span></p>
          <p className="text-xs text-muted-foreground mb-4">Presupuestos aceptados</p>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-taxea-red h-1.5 rounded-full transition-all" style={{ width: `${kpis.tasa}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{kpis.enviados} enviados</span>
            <span>{kpis.aceptados} aceptados</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Pendientes</p>
          <p className="text-3xl font-bold text-amber-600 mb-1">{kpis.pendientes}</p>
          <p className="text-xs text-muted-foreground mb-4">Requieren seguimiento</p>
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Por enviar</span>
              <span className="text-xs font-semibold">{kpis.borradores}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Esperando respuesta</span>
              <span className="text-xs font-semibold text-amber-600">{kpis.enviados}</span>
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