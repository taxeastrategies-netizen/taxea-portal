import { useState } from 'react';
import { Download, Eye, MoreVertical, FileText, FileImage, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getCarpetaLabel } from './CarpetasTree';
import { cn } from '@/lib/utils';

async function downloadFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar el archivo');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename || 'documento';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

const ESTADO_COLORS = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  en_revision: 'bg-blue-50 text-blue-700 border-blue-200',
  revisado: 'bg-teal-light text-teal border-teal/20',
  aprobado: 'bg-green-50 text-green-700 border-green-200',
  rechazado: 'bg-red-50 text-red-700 border-red-200',
};
const ESTADO_LABELS = {
  pendiente: 'Pendiente', en_revision: 'En revisión', revisado: 'Revisado',
  aprobado: 'Aprobado', rechazado: 'Rechazado',
};

function getFileIcon(tipo, nombre) {
  const ext = (nombre || '').split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return <FileImage className="w-5 h-5 text-blue-400" />;
  if (['xls','xlsx','csv'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function getExtBadge(nombre) {
  const ext = (nombre || '').split('.').pop()?.toLowerCase();
  const colors = { pdf: 'bg-red-50 text-red-600', xlsx: 'bg-green-50 text-green-600', xls: 'bg-green-50 text-green-600',
    jpg: 'bg-blue-50 text-blue-600', jpeg: 'bg-blue-50 text-blue-600', png: 'bg-blue-50 text-blue-600',
    docx: 'bg-indigo-50 text-indigo-600', doc: 'bg-indigo-50 text-indigo-600',
  };
  return { ext: ext?.toUpperCase() || 'DOC', color: colors[ext] || 'bg-secondary text-muted-foreground' };
}

export default function DocCard({ doc, isAdmin, onUpdate, view = 'grid' }) {
  const { ext, color } = getExtBadge(doc.nombre);

  if (view === 'list') {
    return (
      <tr className="hover:bg-secondary/20 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            {getFileIcon(doc.tipo_archivo, doc.nombre)}
            <div>
              <p className="text-sm font-medium text-foreground truncate max-w-xs">{doc.nombre}</p>
              {doc.etiquetas?.length > 0 && (
                <div className="flex gap-1 mt-0.5">
                  {doc.etiquetas.slice(0, 3).map(e => (
                    <span key={e} className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{getCarpetaLabel(doc.carpeta)}</td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', color)}>{ext}</span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
          {doc.created_date ? new Date(doc.created_date).toLocaleDateString('es-ES') : '—'}
        </td>
        <td className="px-4 py-3">
          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', ESTADO_COLORS[doc.estado] || 'bg-secondary text-muted-foreground border-border')}>
            {ESTADO_LABELS[doc.estado] || doc.estado}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <DocActions doc={doc} isAdmin={isAdmin} onUpdate={onUpdate} />
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-4 hover:shadow-card-hover transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', 'bg-secondary/50')}>
          {getFileIcon(doc.tipo_archivo, doc.nombre)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold', color)}>{ext}</span>
          <DocActions doc={doc} isAdmin={isAdmin} onUpdate={onUpdate} />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{doc.nombre}</p>
      <p className="text-xs text-muted-foreground truncate mb-2">{getCarpetaLabel(doc.carpeta)}</p>
      {doc.etiquetas?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {doc.etiquetas.slice(0, 3).map(e => (
            <span key={e} className="text-xs bg-teal-light text-teal px-1.5 py-0.5 rounded">{e}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', ESTADO_COLORS[doc.estado] || 'bg-secondary text-muted-foreground border-border')}>
          {ESTADO_LABELS[doc.estado] || doc.estado}
        </span>
        <span className="text-xs text-muted-foreground">{doc.created_date ? new Date(doc.created_date).toLocaleDateString('es-ES') : '—'}</span>
      </div>
    </div>
  );
}

function DocActions({ doc, isAdmin, onUpdate }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!doc.archivo_url || downloading) return;
    setDownloading(true);
    try {
      await downloadFile(doc.archivo_url, doc.nombre || 'documento');
    } catch {
      // Fallback: abrir en nueva pestaña como último recurso
      window.open(doc.archivo_url, '_blank');
    }
    setDownloading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {doc.archivo_url && (
          <>
            <DropdownMenuItem asChild>
              <a href={doc.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> Ver documento
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
              {downloading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Descargando...</>
                : <><Download className="w-3.5 h-3.5" /> Descargar</>}
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => onUpdate(doc.id, { estado: 'revisado' })}>Marcar revisado</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(doc.id, { estado: 'aprobado' })}>Aprobar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(doc.id, { estado: 'rechazado' })}>Rechazar</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}