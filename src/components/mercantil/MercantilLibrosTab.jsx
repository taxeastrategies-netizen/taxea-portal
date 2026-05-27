import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const LIBROS_CONFIG = [
  { tipo: 'diario', label: 'Libro Diario' },
  { tipo: 'inventarios_cuentas', label: 'Libro de Inventarios y Cuentas Anuales' },
  { tipo: 'balance_situacion', label: 'Balance de Situación' },
  { tipo: 'pyg', label: 'Cuenta de Pérdidas y Ganancias' },
  { tipo: 'balance_sumas_saldos', label: 'Balance de Sumas y Saldos' },
  { tipo: 'socios', label: 'Libro de Socios' },
  { tipo: 'actas', label: 'Libro de Actas' },
  { tipo: 'otros', label: 'Otros libros' },
];

const ESTADO_CFG = {
  pendiente:     { label: 'Pendiente',    color: 'bg-slate-100 text-slate-600' },
  preparado:     { label: 'Preparado',    color: 'bg-blue-100 text-blue-700' },
  revisado:      { label: 'Revisado',     color: 'bg-indigo-100 text-indigo-700' },
  presentado:    { label: 'Presentado',   color: 'bg-amber-100 text-amber-700' },
  legalizado:    { label: 'Legalizado ✓', color: 'bg-emerald-100 text-emerald-700' },
  con_incidencia:{ label: 'Incidencia',   color: 'bg-red-100 text-red-700' },
};

function UploadBtn({ label, url, onUpload, disabled }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await onUpload(file_url);
    setUploading(false);
  };
  return (
    <div className="flex items-center gap-1.5">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-primary underline flex items-center gap-0.5">
          Ver <ExternalLink className="w-2.5 h-2.5" />
        </a>
      ) : null}
      <label className={cn('cursor-pointer text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 border border-dashed border-border rounded px-1.5 py-0.5', disabled && 'opacity-40 pointer-events-none')}>
        <Upload className="w-2.5 h-2.5" />
        {uploading ? 'Subiendo...' : (url ? 'Actualizar' : label)}
        <input type="file" className="hidden" onChange={handle} disabled={disabled || uploading} />
      </label>
    </div>
  );
}

export default function MercantilLibrosTab({ expediente, isAdmin, user, onRefresh }) {
  const [libros, setLibros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmacionRM, setConfirmacionRM] = useState({ registroMercantil: '', numPresentacion: '', fechaPresentacion: '', fechaLegalizacion: '', resultado: '', observaciones: '' });
  const [savingRM, setSavingRM] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MercantilLibro.filter({ expedienteId: expediente.id }).catch(() => []);
    // Ensure all libro types exist
    const existing = (data || []);
    const missing = LIBROS_CONFIG.filter(lc => !existing.find(l => l.tipoLibro === lc.tipo));
    if (missing.length > 0) {
      const created = await base44.entities.MercantilLibro.bulkCreate(
        missing.map(lc => ({ expedienteId: expediente.id, sociedadId: expediente.sociedadId, tipoLibro: lc.tipo, aplica: true, estado: 'pendiente' }))
      ).catch(() => []);
      setLibros([...existing, ...(created || [])]);
    } else {
      setLibros(existing);
    }
    // Load RM confirmation from expediente
    setConfirmacionRM({
      registroMercantil: expediente.registroMercantilRef || '',
      numPresentacion: expediente.numPresentacionLibros || '',
      fechaPresentacion: expediente.fechaPresentacionLibros || '',
      fechaLegalizacion: expediente.fechaLegalizacionLibros || '',
      resultado: expediente.resultadoLibros || '',
      observaciones: '',
    });
    setLoading(false);
  };

  useEffect(() => { if (expediente) load(); }, [expediente.id]);

  const updateLibro = async (libro, changes) => {
    await base44.entities.MercantilLibro.update(libro.id, changes);
    setLibros(prev => prev.map(l => l.id === libro.id ? { ...l, ...changes } : l));
    await base44.entities.MercantilHistorial.create({
      expedienteId: expediente.id, sociedadId: expediente.sociedadId,
      fecha: new Date().toISOString(), usuario: user?.email || 'admin',
      accion: `Libro "${LIBROS_CONFIG.find(c => c.tipo === libro.tipoLibro)?.label}": ${JSON.stringify(changes)}`,
      tipoAccion: 'cambio_estado',
    });
  };

  const saveRM = async () => {
    setSavingRM(true);
    await base44.entities.MercantilExpediente.update(expediente.id, {
      registroMercantilRef: confirmacionRM.registroMercantil,
      numPresentacionLibros: confirmacionRM.numPresentacion,
      fechaPresentacionLibros: confirmacionRM.fechaPresentacion,
      fechaLegalizacionLibros: confirmacionRM.fechaLegalizacion,
      resultadoLibros: confirmacionRM.resultado,
      ultimaActualizacion: new Date().toISOString(),
    });
    setSavingRM(false);
    onRefresh?.();
  };

  if (loading) return <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const sortedLibros = LIBROS_CONFIG.map(lc => libros.find(l => l.tipoLibro === lc.tipo)).filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Checklist libros */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Libros contables y societarios</h3>
          <p className="text-xs text-muted-foreground">Marca estado, sube archivos fuente y justificantes por libro.</p>
        </div>
        <div className="divide-y divide-border overflow-x-auto">
          <div className="grid grid-cols-[2fr_1fr_80px_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-secondary/20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[900px]">
            <span>Libro</span><span>Estado</span><span>Aplica</span><span>Fuente / PDF</span><span>Justificante</span><span>Confirmación RM</span><span>Fechas</span>
          </div>
          {sortedLibros.map(libro => {
            const cfg = LIBROS_CONFIG.find(c => c.tipo === libro.tipoLibro);
            return (
              <div key={libro.id} className={cn('grid grid-cols-[2fr_1fr_80px_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 items-center min-w-[900px]', !libro.aplica && 'opacity-40')}>
                <span className={cn('text-xs font-medium', libro.estado === 'legalizado' ? 'text-emerald-700' : 'text-foreground')}>
                  {libro.estado === 'legalizado' && <CheckCircle className="w-3 h-3 inline mr-1 text-emerald-500" />}
                  {libro.estado === 'con_incidencia' && <AlertTriangle className="w-3 h-3 inline mr-1 text-red-500" />}
                  {cfg?.label}
                </span>
                <Select value={libro.estado} onValueChange={v => updateLibro(libro, { estado: v })}>
                  <SelectTrigger className="h-7 text-[11px] w-full">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', ESTADO_CFG[libro.estado]?.color)}>{ESTADO_CFG[libro.estado]?.label}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO_CFG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={!!libro.aplica} onChange={e => updateLibro(libro, { aplica: e.target.checked })} className="w-3.5 h-3.5" />
                  <span className="text-[10px] text-muted-foreground">{libro.aplica ? 'Aplica' : 'N/A'}</span>
                </label>
                <UploadBtn label="Subir fuente" url={libro.archivoFuenteUrl} disabled={!libro.aplica}
                  onUpload={url => updateLibro(libro, { archivoFuenteUrl: url })} />
                <UploadBtn label="Justificante" url={libro.justificantePresentacionUrl} disabled={!libro.aplica}
                  onUpload={url => updateLibro(libro, { justificantePresentacionUrl: url })} />
                <UploadBtn label="Confirma. RM" url={libro.confirmacionRegistroUrl} disabled={!libro.aplica}
                  onUpload={url => updateLibro(libro, { confirmacionRegistroUrl: url })} />
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <div>Prep: <Input type="date" value={libro.fechaPreparacion || ''} onChange={e => updateLibro(libro, { fechaPreparacion: e.target.value })} className="h-5 text-[10px] border-0 p-0 w-24 inline-block" /></div>
                  <div>Pres: <Input type="date" value={libro.fechaPresentacion || ''} onChange={e => updateLibro(libro, { fechaPresentacion: e.target.value })} className="h-5 text-[10px] border-0 p-0 w-24 inline-block" /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmación RM */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Confirmación del Registro Mercantil</h3>
          <p className="text-xs text-muted-foreground">Referencia, resultado y justificante de la legalización de libros.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Registro Mercantil', key: 'registroMercantil', placeholder: 'RM de...' },
            { label: 'Nº / Ref. presentación', key: 'numPresentacion', placeholder: 'Ref. entrada...' },
            { label: 'Fecha de presentación', key: 'fechaPresentacion', type: 'date' },
            { label: 'Fecha de legalización', key: 'fechaLegalizacion', type: 'date' },
          ].map(field => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <Input type={field.type || 'text'} value={confirmacionRM[field.key] || ''} placeholder={field.placeholder}
                onChange={e => setConfirmacionRM(p => ({ ...p, [field.key]: e.target.value }))} className="h-8 text-xs" />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Resultado</label>
            <Select value={confirmacionRM.resultado} onValueChange={v => setConfirmacionRM(p => ({ ...p, resultado: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="correcto">Correcto</SelectItem>
                <SelectItem value="pendiente_respuesta">Pendiente de respuesta</SelectItem>
                <SelectItem value="subsanacion">Subsanación requerida</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveRM} disabled={savingRM}>{savingRM ? 'Guardando...' : 'Guardar confirmación'}</Button>
        </div>
      </div>
    </div>
  );
}