import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Upload, Search, LayoutGrid, LayoutList, FolderOpen, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import CarpetasTree, { getCarpetaLabel, DMS_STRUCTURE } from '@/components/documentos/CarpetasTree';
import DocCard from '@/components/documentos/DocCard';
import UploadDialog from '@/components/documentos/UploadDialog';

export default function Documentos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCarpeta, setSelectedCarpeta] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [filterEstado, setFilterEstado] = useState('all');

  useEffect(() => {
    if (company?.id) load();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Document.filter({ company_id: company.id });
    setDocs(data || []);
    setLoading(false);
  };

  const handleUpdate = async (id, updates) => {
    await base44.entities.Document.update(id, updates);
    load();
  };

  // Contar docs por carpeta para el árbol
  const docCounts = useMemo(() => {
    const counts = {};
    docs.forEach(d => { counts[d.carpeta] = (counts[d.carpeta] || 0) + 1; });
    return counts;
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const matchCarpeta = !selectedCarpeta || d.carpeta === selectedCarpeta;
      const matchEstado = filterEstado === 'all' || d.estado === filterEstado;
      const matchSearch = !search || d.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        d.etiquetas?.some(e => e.toLowerCase().includes(search.toLowerCase()));
      return matchCarpeta && matchEstado && matchSearch;
    });
  }, [docs, selectedCarpeta, search, filterEstado]);

  // Título de la sección actual
  const sectionTitle = selectedCarpeta ? getCarpetaLabel(selectedCarpeta) : 'Todos los documentos';
  const rootSection = selectedCarpeta ? DMS_STRUCTURE.find(r => r.children?.some(c => c.id === selectedCarpeta)) : null;

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Documentos" />;

  return (
    <div>
      <PageHeader title="Documentos" subtitle="Repositorio documental privado · Big4 DMS">
        <Button onClick={() => setShowUpload(true)} className="bg-teal hover:bg-teal-dark h-9">
          <Upload className="w-4 h-4 mr-1.5" /> Subir documento
        </Button>
      </PageHeader>

      <div className="flex gap-5">
        {/* Árbol de carpetas — sidebar */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-card border border-border rounded-xl shadow-card p-3 sticky top-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Carpetas</p>
            <CarpetasTree selected={selectedCarpeta} onSelect={setSelectedCarpeta} docCounts={docCounts} />
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          {/* Barra herramientas */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Selector carpeta mobile */}
            <div className="lg:hidden w-full">
              <Select value={selectedCarpeta || 'all'} onValueChange={v => setSelectedCarpeta(v === 'all' ? null : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Carpeta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las carpetas</SelectItem>
                  {DMS_STRUCTURE.map(root => (
                    <div key={root.id}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{root.icon} {root.label}</div>
                      {root.children.map(c => <SelectItem key={c.id} value={c.id} className="pl-5">{c.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o etiqueta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>

            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_revision">En revisión</SelectItem>
                <SelectItem value="revisado">Revisado</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView('grid')} className={cn('p-2 transition-colors', view === 'grid' ? 'bg-teal text-white' : 'hover:bg-secondary text-muted-foreground')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} className={cn('p-2 transition-colors', view === 'list' ? 'bg-teal text-white' : 'hover:bg-secondary text-muted-foreground')}>
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Encabezado sección */}
          <div className="flex items-center gap-2 mb-3">
            {rootSection && <span className="text-lg">{rootSection.icon}</span>}
            <h2 className="text-sm font-semibold text-foreground">{sectionTitle}</h2>
            <span className="text-xs text-muted-foreground ml-1">({filtered.length})</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground">
                {search ? 'Sin resultados para esa búsqueda' : 'Carpeta vacía'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? 'Prueba con otro término' : 'Sube documentos aquí para organizarlos'}
              </p>
              {!search && (
                <Button onClick={() => setShowUpload(true)} className="mt-4 bg-teal hover:bg-teal-dark">
                  <Upload className="w-4 h-4 mr-2" /> Subir documento
                </Button>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(doc => (
                <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onUpdate={handleUpdate} view="grid" />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Documento</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Carpeta</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(doc => (
                      <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onUpdate={handleUpdate} view="list" />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        company={company}
        user={user}
        onSuccess={load}
      />
    </div>
  );
}