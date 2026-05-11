import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllCarpetas, DMS_STRUCTURE } from './CarpetasTree';
import { cn } from '@/lib/utils';

const ALL_CARPETAS = getAllCarpetas();

// IA: clasificar documento por nombre
async function clasificarConIA(nombre) {
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza el nombre de este documento y clasifícalo en la carpeta correcta de un despacho fiscal/legal.
Documento: "${nombre}"

Carpetas disponibles:
${ALL_CARPETAS.map(c => `- ${c.value}: ${c.label}`).join('\n')}

Responde SOLO con el id de la carpeta más apropiada (ej: "fiscal_modelos_aeat") y las etiquetas relevantes.`,
      response_json_schema: {
        type: 'object',
        properties: {
          carpeta: { type: 'string' },
          etiquetas: { type: 'array', items: { type: 'string' } },
          confianza: { type: 'number' }
        }
      }
    });
    return result;
  } catch {
    return null;
  }
}

export default function UploadDialog({ open, onClose, company, user, onSuccess }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', carpeta: '', comentarios: '' });
  const [etiquetas, setEtiquetas] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [clasificando, setClasificando] = useState(false);
  const [sugerencia, setSugerencia] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (f) => {
    setFile(f);
    const nombre = f.name.replace(/\.[^/.]+$/, '');
    setFormData(p => ({ ...p, nombre }));
    // Clasificar con IA automáticamente
    setClasificando(true);
    const ia = await clasificarConIA(f.name);
    setClasificando(false);
    if (ia) {
      setSugerencia(ia);
      setFormData(p => ({ ...p, carpeta: ia.carpeta || p.carpeta }));
      setEtiquetas(ia.etiquetas || []);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file || !formData.nombre || !formData.carpeta) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      company_id: company.id,
      nombre: formData.nombre,
      carpeta: formData.carpeta,
      comentarios: formData.comentarios,
      archivo_url: file_url,
      tipo_archivo: file.type,
      anio: new Date().getFullYear(),
      estado: 'pendiente',
      subido_por: user?.email,
      etiquetas,
    });
    setUploading(false);
    setFile(null);
    setFormData({ nombre: '', carpeta: '', comentarios: '' });
    setEtiquetas([]);
    setSugerencia(null);
    onSuccess();
    onClose();
  };

  const close = () => {
    setFile(null); setFormData({ nombre: '', carpeta: '', comentarios: '' });
    setEtiquetas([]); setSugerencia(null); onClose();
  };

  const carpetaLabel = ALL_CARPETAS.find(c => c.value === formData.carpeta)?.label || '';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Subir documento</DialogTitle></DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn('border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              dragOver ? 'border-teal bg-teal/5' : file ? 'border-teal/40 bg-teal/5' : 'border-border hover:border-teal/40')}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-teal-light rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-teal" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setSugerencia(null); }} className="ml-auto">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Arrastra aquí o haz clic</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, imágenes, ZIP · Máx. 25MB</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip,.ppt,.pptx"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>

          {/* IA sugerencia */}
          {clasificando && (
            <div className="flex items-center gap-2 px-4 py-3 bg-teal/5 border border-teal/20 rounded-lg">
              <Loader2 className="w-4 h-4 text-teal animate-spin" />
              <p className="text-sm text-teal">IA clasificando documento...</p>
            </div>
          )}
          {sugerencia && !clasificando && (
            <div className="flex items-center gap-2 px-4 py-3 bg-teal/5 border border-teal/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-teal flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-teal font-medium">IA sugiere: <strong>{carpetaLabel}</strong></p>
                {sugerencia.confianza && <p className="text-xs text-muted-foreground">Confianza: {Math.round(sugerencia.confianza * 100)}%</p>}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nombre del documento *</Label>
            <Input value={formData.nombre} onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre descriptivo..." />
          </div>

          <div className="space-y-1.5">
            <Label>Carpeta *</Label>
            <Select value={formData.carpeta} onValueChange={v => setFormData(p => ({ ...p, carpeta: v }))}>
              <SelectTrigger className={!formData.carpeta ? 'border-amber-300' : ''}><SelectValue placeholder="Seleccionar carpeta..." /></SelectTrigger>
              <SelectContent className="max-h-64">
                {DMS_STRUCTURE.map(root => (
                  <div key={root.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{root.icon} {root.label}</div>
                    {root.children.map(c => (
                      <SelectItem key={c.id} value={c.id} className="pl-6">{c.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {etiquetas.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Etiquetas IA</Label>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map(e => (
                  <span key={e} className="flex items-center gap-1 text-xs bg-teal-light text-teal px-2 py-0.5 rounded">
                    {e}
                    <button onClick={() => setEtiquetas(prev => prev.filter(x => x !== e))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Comentarios</Label>
            <Input value={formData.comentarios} onChange={e => setFormData(p => ({ ...p, comentarios: e.target.value }))} placeholder="Notas adicionales..." />
          </div>
        </div>

        <div className="flex gap-2 lg:hidden mt-2">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
            inp.onchange = e => e.target.files[0] && handleFile(e.target.files[0]);
            inp.click();
          }}>📷 Usar cámara</Button>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={uploading || !file || !formData.nombre || !formData.carpeta} className="bg-teal hover:bg-teal-dark">
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</> : <><Upload className="w-4 h-4 mr-2" />Subir documento</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}