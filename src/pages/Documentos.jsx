import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Upload, FolderOpen, Download, MoreVertical, Search, File } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CARPETAS = [
  { value: 'facturas_emitidas', label: 'Facturas Emitidas' },
  { value: 'facturas_recibidas', label: 'Facturas Recibidas' },
  { value: 'bancos', label: 'Bancos' },
  { value: 'contratos', label: 'Contratos' },
  { value: 'escrituras', label: 'Escrituras' },
  { value: 'modelos_fiscales', label: 'Modelos Fiscales' },
  { value: 'certificados', label: 'Certificados' },
  { value: 'nominas', label: 'Nóminas' },
  { value: 'seguros_sociales', label: 'Seguros Sociales' },
  { value: 'renta', label: 'Renta' },
  { value: 'otros', label: 'Otros Documentos' },
];

export default function Documentos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filterCarpeta, setFilterCarpeta] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', carpeta: 'otros', comentarios: '' });
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (company?.id) {
      load();
    } else if (!loadingCompany) {
      setLoading(false);
    }
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Document.filter({ company_id: company.id });
    setDocs(data || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      ...formData,
      company_id: company.id,
      archivo_url: file_url,
      tipo_archivo: file.type,
      anio: new Date().getFullYear(),
      estado: 'pendiente',
      subido_por: user?.email,
    });
    setUploading(false);
    setShowUpload(false);
    setFile(null);
    setFormData({ nombre: '', carpeta: 'otros', comentarios: '' });
    load();
  };

  const grouped = CARPETAS.map(carpeta => ({
    ...carpeta,
    docs: docs.filter(d => d.carpeta === carpeta.value)
  })).filter(c => (filterCarpeta === 'all' || filterCarpeta === c.value) && c.docs.length > 0);

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchCarpeta = filterCarpeta === 'all' || d.carpeta === filterCarpeta;
    return matchSearch && matchCarpeta;
  });

  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Documentos" />;

  return (
    <div>
      <PageHeader title="Documentos" subtitle="Repositorio documental privado">
        <Button onClick={() => setShowUpload(true)} className="bg-teal hover:bg-teal-dark h-9">
          <Upload className="w-4 h-4 mr-1.5" /> Subir documento
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar documentos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterCarpeta} onValueChange={setFilterCarpeta}>
          <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Carpeta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las carpetas</SelectItem>
            {CARPETAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">Sin documentos</p>
          <p className="text-sm text-muted-foreground mt-1">Sube tu primer documento para empezar</p>
          <Button onClick={() => setShowUpload(true)} className="mt-4 bg-teal hover:bg-teal-dark">
            <Upload className="w-4 h-4 mr-2" /> Subir documento
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Carpeta</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Subido por</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-foreground truncate max-w-xs">{doc.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CARPETAS.find(c => c.value === doc.carpeta)?.label || doc.carpeta}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{doc.subido_por || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {doc.created_date ? new Date(doc.created_date).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={doc.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {doc.archivo_url && (
                            <DropdownMenuItem asChild>
                              <a href={doc.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                <Download className="w-3.5 h-3.5" /> Descargar
                              </a>
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => base44.entities.Document.update(doc.id, { estado: 'revisado' }).then(load)}>Marcar revisado</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => base44.entities.Document.update(doc.id, { estado: 'aprobado' }).then(load)}>Aprobar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => base44.entities.Document.update(doc.id, { estado: 'rechazado' }).then(load)}>Rechazar</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Subir documento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre del documento *</Label>
              <Input value={formData.nombre} onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Contrato de alquiler local..." />
            </div>
            <div className="space-y-1.5">
              <Label>Carpeta</Label>
              <Select value={formData.carpeta} onValueChange={v => setFormData(f => ({ ...f, carpeta: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARPETAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Archivo *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-teal/50 transition-colors"
                onClick={() => document.getElementById('file-upload').click()}>
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                {file ? (
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Haz clic para seleccionar</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG hasta 25MB</p>
                  </>
                )}
                <input id="file-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => setFile(e.target.files[0])} />
                <input id="file-camera" type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => setFile(e.target.files[0])} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Comentarios</Label>
              <Input value={formData.comentarios} onChange={e => setFormData(f => ({ ...f, comentarios: e.target.value }))} placeholder="Notas adicionales..." />
            </div>
          </div>
          <div className="flex gap-2 lg:hidden mt-1">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => document.getElementById('file-camera').click()}>
              📷 Usar cámara
            </Button>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !file || !formData.nombre} className="bg-teal hover:bg-teal-dark">
              {uploading ? 'Subiendo...' : 'Subir documento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}