import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS_DOC = [
  { value: 'archivo_d2', label: 'Archivo D2 presentado' },
  { value: 'justificante_presentacion', label: 'Justificante de presentación' },
  { value: 'justificante_inscripcion', label: 'Justificante de inscripción' },
  { value: 'balance', label: 'Balance cerrado' },
  { value: 'pyg', label: 'Cuenta de PyG cerrada' },
  { value: 'memoria', label: 'Memoria presentada al RM' },
  { value: 'certificacion_acta', label: 'Certificación del acta' },
  { value: 'acta_aprobacion', label: 'Acta de aprobación de cuentas' },
  { value: 'informe_auditoria', label: 'Informe de auditoría' },
  { value: 'informe_gestion', label: 'Informe de gestión' },
  { value: 'subsanacion', label: 'Documento de subsanación' },
  { value: 'otro', label: 'Otro documento' },
];

const ESTADO_DOC = {
  pendiente: 'bg-slate-100 text-slate-600',
  subido:    'bg-blue-100 text-blue-700',
  revisado:  'bg-indigo-100 text-indigo-700',
  presentado:'bg-amber-100 text-amber-700',
  aceptado:  'bg-emerald-100 text-emerald-700',
  sustituido:'bg-slate-100 text-slate-400 line-through',
};

const ESTADOS_CUENTAS = [
  { value: 'pendiente', label: 'Contabilidad cerrada — pendiente de revisión' },
  { value: 'en_preparacion', label: 'Balance y PyG revisados' },
  { value: 'presentado', label: 'Presentado en Registro Mercantil' },
  { value: 'inscrito', label: 'Inscrito correctamente' },
  { value: 'con_defectos', label: 'Con defectos o subsanación' },
  { value: 'cerrado', label: 'Cerrado' },
];

export default function MercantilCuentasTab({ expediente, user, onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState({ tipoDocumento: 'archivo_d2', nombre: '', fechaDocumento: '', comentarios: '' });
  const [uploading, setUploading] = useState(false);
  const [depositoData, setDepositoData] = useState({
    fechaPresentacion: expediente.fechaPresentacionCuentas || '',
    numPresentacion: expediente.numPresentacionCuentas || '',
    fechaInscripcion: expediente.fechaInscripcionCuentas || '',
    resultado: expediente.resultadoCuentas || '',
    observaciones: '',
  });
  const [savingDeposito, setSavingDeposito] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MercantilDocumento.filter(
      { expedienteId: expediente.id, carpeta: '02_cuentas_anuales' }, '-created_date', 100
    ).catch(() => []);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { if (expediente) load(); }, [expediente.id]);

  const addDoc = async (fileUrl) => {
    const tipoLabel = TIPOS_DOC.find(t => t.value === newDoc.tipoDocumento)?.label || newDoc.nombre;
    await base44.entities.MercantilDocumento.create({
      expedienteId: expediente.id,
      sociedadId: expediente.sociedadId,
      carpeta: '02_cuentas_anuales',
      tipoDocumento: newDoc.tipoDocumento,
      nombre: newDoc.nombre || tipoLabel,
      estado: 'subido',
      fechaDocumento: newDoc.fechaDocumento,
      fechaSubida: new Date().toISOString(),
      subidoPor: user?.email || 'admin',
      version: 1,
      fileUrl,
      comentarios: newDoc.comentarios,
      esBorrador: false,
    });
    await base44.entities.MercantilHistorial.create({
      expedienteId: expediente.id, sociedadId: expediente.sociedadId,
      fecha: new Date().toISOString(), usuario: user?.email || 'admin',
      accion: `Documento subido: ${newDoc.nombre || tipoLabel}`,
      tipoAccion: 'documento_subido',
    });
    load();
    setShowAdd(false);
    setNewDoc({ tipoDocumento: 'archivo_d2', nombre: '', fechaDocumento: '', comentarios: '' });
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await addDoc(file_url);
    setUploading(false);
  };

  const updateEstado = async (doc, estado) => {
    await base44.entities.MercantilDocumento.update(doc.id, { estado });
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, estado } : d));
  };

  const saveDeposito = async () => {
    setSavingDeposito(true);
    await base44.entities.MercantilExpediente.update(expediente.id, {
      fechaPresentacionCuentas: depositoData.fechaPresentacion,
      numPresentacionCuentas: depositoData.numPresentacion,
      fechaInscripcionCuentas: depositoData.fechaInscripcion,
      resultadoCuentas: depositoData.resultado,
      ultimaActualizacion: new Date().toISOString(),
    });
    setSavingDeposito(false);
    onRefresh?.();
  };

  if (loading) return <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-5">
      {/* Estado cuentas */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Estado de cuentas anuales</h3>
        <Select value={expediente.estadoCuentas || 'pendiente'} onValueChange={async v => {
          await base44.entities.MercantilExpediente.update(expediente.id, { estadoCuentas: v, ultimaActualizacion: new Date().toISOString() });
          onRefresh?.();
        }}>
          <SelectTrigger className="h-8 text-xs max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESTADOS_CUENTAS.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Documentos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Documentos de cuentas anuales</h3>
            <p className="text-xs text-muted-foreground">Archivo D2, balances, memoria, actas, inscripciones...</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="h-7 gap-1.5 text-xs"><Plus className="w-3 h-3" />Añadir</Button>
        </div>

        {showAdd && (
          <div className="bg-blue-50/50 border-b border-border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de documento</label>
                <Select value={newDoc.tipoDocumento} onValueChange={v => setNewDoc(p => ({ ...p, tipoDocumento: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre / descripción</label>
                <Input value={newDoc.nombre} onChange={e => setNewDoc(p => ({ ...p, nombre: e.target.value }))} className="h-8 text-xs" placeholder="Descripción opcional" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha del documento</label>
                <Input type="date" value={newDoc.fechaDocumento} onChange={e => setNewDoc(p => ({ ...p, fechaDocumento: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Comentarios</label>
                <Input value={newDoc.comentarios} onChange={e => setNewDoc(p => ({ ...p, comentarios: e.target.value }))} className="h-8 text-xs" placeholder="Nota interna..." />
              </div>
            </div>
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 border-2 border-dashed border-border rounded-lg px-4 py-3 hover:bg-secondary/20 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Subiendo...' : 'Selecciona o arrastra el archivo aquí'}</span>
              </div>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        )}

        {docs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin documentos. Añade el archivo D2 u otros documentos de cuentas anuales.</p>
        ) : (
          <div className="divide-y divide-border">
            {docs.map(doc => (
              <div key={doc.id} className={cn('flex items-center gap-3 px-4 py-3 text-sm', doc.estado === 'sustituido' && 'opacity-50')}>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-foreground', doc.estado === 'sustituido' && 'line-through')}>{doc.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {TIPOS_DOC.find(t => t.value === doc.tipoDocumento)?.label || doc.tipoDocumento}
                    {doc.fechaDocumento && ` · ${new Date(doc.fechaDocumento).toLocaleDateString('es-ES')}`}
                    {doc.subidoPor && ` · ${doc.subidoPor}`}
                    {doc.comentarios && ` · ${doc.comentarios}`}
                  </p>
                </div>
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize', ESTADO_DOC[doc.estado])}>{doc.estado}</span>
                <Select value={doc.estado} onValueChange={v => updateEstado(doc, v)}>
                  <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(ESTADO_DOC).map(k => <SelectItem key={k} value={k} className="text-xs capitalize">{k}</SelectItem>)}
                  </SelectContent>
                </Select>
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultado depósito */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resultado del depósito de cuentas</h3>
          <p className="text-xs text-muted-foreground">Fecha de presentación, inscripción y resultado en el Registro Mercantil.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Fecha de presentación', key: 'fechaPresentacion', type: 'date' },
            { label: 'Nº / Ref. de entrada', key: 'numPresentacion' },
            { label: 'Fecha de inscripción', key: 'fechaInscripcion', type: 'date' },
          ].map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <Input type={f.type || 'text'} value={depositoData[f.key] || ''} onChange={e => setDepositoData(p => ({ ...p, [f.key]: e.target.value }))} className="h-8 text-xs" />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Resultado</label>
            <Select value={depositoData.resultado} onValueChange={v => setDepositoData(p => ({ ...p, resultado: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="inscrito">Inscrito correctamente</SelectItem>
                <SelectItem value="con_defectos">Con defectos</SelectItem>
                <SelectItem value="subsanado">Subsanado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveDeposito} disabled={savingDeposito}>{savingDeposito ? 'Guardando...' : 'Guardar resultado'}</Button>
        </div>
      </div>
    </div>
  );
}