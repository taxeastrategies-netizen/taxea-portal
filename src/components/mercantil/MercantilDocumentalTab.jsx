import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Search, FileText, ExternalLink, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

const CARPETAS = [
  { value: '01_libros', label: '01 Legalización de libros' },
  { value: '02_cuentas_anuales', label: '02 Cuentas anuales' },
  { value: '03_justificantes_rm', label: '03 Justificantes Registro Mercantil' },
  { value: '04_subsanaciones', label: '04 Subsanaciones' },
  { value: '05_documentacion_final', label: '05 Documentación final cerrada' },
];

const ETIQUETAS = ['A3','Legalia','D2','Registro Mercantil','Balance','PyG','Memoria','Actas','Socios','Subsanación'];

const ESTADO_COLORS = {
  pendiente: 'text-slate-500 bg-slate-50 border-slate-200',
  subido: 'text-blue-700 bg-blue-50 border-blue-200',
  revisado: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  presentado: 'text-amber-700 bg-amber-50 border-amber-200',
  aceptado: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  sustituido: 'text-slate-400 bg-slate-50 border-slate-100',
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export default function MercantilDocumentalTab({ expediente, user, isAdmin }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCarpeta, setFilterCarpeta] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ carpeta: '03_justificantes_rm', nombre: '', etiquetas: [], comentarios: '' });
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MercantilDocumento.filter({ expedienteId: expediente.id }, '-created_date', 200).catch(() => []);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { if (expediente) load(); }, [expediente.id]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.MercantilDocumento.create({
      expedienteId: expediente.id,
      sociedadId: expediente.sociedadId,
      carpeta: uploadForm.carpeta,
      nombre: uploadForm.nombre || file.name,
      estado: 'subido',
      fechaSubida: new Date().toISOString(),
      subidoPor: user?.email || 'admin',
      version: 1,
      fileUrl: file_url,
      etiquetas: uploadForm.etiquetas,
      comentarios: uploadForm.comentarios,
      tipoDocumento: 'otro',
    });
    await base44.entities.MercantilHistorial.create({
      expedienteId: expediente.id, sociedadId: expediente.sociedadId,
      fecha: new Date().toISOString(), usuario: user?.email || 'admin',
      accion: `Documento subido al gestor: ${uploadForm.nombre || file.name}`,
      tipoAccion: 'documento_subido',
    });
    setUploading(false);
    setShowUpload(false);
    setUploadForm({ carpeta: '03_justificantes_rm', nombre: '', etiquetas: [], comentarios: '' });
    load();
  };

  const toggleEtiqueta = (tag) => {
    setUploadForm(p => ({
      ...p,
      etiquetas: p.etiquetas.includes(tag) ? p.etiquetas.filter(t => t !== tag) : [...p.etiquetas, tag]
    }));
  };

  const updateEstado = async (doc, estado) => {
    if (estado === 'sustituido' && !isAdmin) { alert('Solo un administrador puede marcar un documento como sustituido.'); return; }
    await base44.entities.MercantilDocumento.update(doc.id, { estado });
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, estado } : d));
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.nombre?.toLowerCase().includes(search.toLowerCase()) || (d.etiquetas || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCarpeta = filterCarpeta === 'all' || d.carpeta === filterCarpeta;
    const matchEstado = filterEstado === 'all' || d.estado === filterEstado;
    return matchSearch && matchCarpeta && matchEstado;
  });

  // Group by carpeta
  const grouped = {};
  filtered.forEach(d => {
    const c = d.carpeta || '05_documentacion_final';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(d);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Gestor documental</h3>
          <p className="text-xs text-muted-foreground">Archivo completo por carpeta. Control de versiones y estado.</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(!showUpload)} className="h-8 gap-1.5"><Upload className="w-3.5 h-3.5" />Subir documento</Button>
      </div>

      {showUpload && (
        <div className="bg-secondary/20 border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Carpeta destino</label>
              <Select value={uploadForm.carpeta} onValueChange={v => setUploadForm(p => ({ ...p, carpeta: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARPETAS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nombre del documento</label>
              <Input value={uploadForm.nombre} onChange={e => setUploadForm(p => ({ ...p, nombre: e.target.value }))} className="h-8 text-xs" placeholder="Nombre descriptivo (opcional)" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">Etiquetas</label>
              <div className="flex flex-wrap gap-1.5">
                {ETIQUETAS.map(tag => (
                  <button key={tag} onClick={() => toggleEtiqueta(tag)}
                    className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors', uploadForm.etiquetas.includes(tag) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="cursor-pointer block">
            <div className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 rounded-xl px-4 py-5 hover:bg-secondary/30 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{uploading ? 'Subiendo...' : 'Selecciona archivo para subir'}</span>
            </div>
            <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar documento o etiqueta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterCarpeta} onValueChange={setFilterCarpeta}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Carpeta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las carpetas</SelectItem>
            {CARPETAS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.keys(ESTADO_COLORS).map(k => <SelectItem key={k} value={k} className="capitalize text-xs">{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin documentos en el archivo.</p>
      ) : (
        <div className="space-y-4">
          {CARPETAS.filter(c => grouped[c.value]?.length > 0).map(carpeta => (
            <div key={carpeta.value} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-secondary/30 border-b border-border">
                <p className="text-xs font-semibold text-foreground">{carpeta.label}</p>
              </div>
              <div className="divide-y divide-border">
                {grouped[carpeta.value].map(doc => (
                  <div key={doc.id} className={cn('flex items-center gap-3 px-4 py-2.5', doc.estado === 'sustituido' && 'opacity-50')}>
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', doc.estado === 'sustituido' && 'line-through text-muted-foreground')}>{doc.nombre}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{fmtDate(doc.fechaSubida)} · v{doc.version} · {doc.subidoPor}</span>
                        {(doc.etiquetas || []).map(tag => (
                          <span key={tag} className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-0.5">
                            <Tag className="w-2 h-2" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Select value={doc.estado} onValueChange={v => updateEstado(doc, v)}>
                      <SelectTrigger className={cn('h-6 w-24 text-[10px] border rounded-full', ESTADO_COLORS[doc.estado])}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(ESTADO_COLORS).map(k => <SelectItem key={k} value={k} className="text-xs capitalize">{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}