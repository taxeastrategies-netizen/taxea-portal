import { Button } from '@/components/ui/button';
import { Cloud, AlertTriangle } from 'lucide-react';

export default function BackupModal({ config, driveEmail, onConfirm, onCancel }) {
  const isFullCopy = config?.backupMode === 'full_daily_copy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center flex-shrink-0">
            <Cloud className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="font-jakarta font-bold text-foreground">Copia de seguridad documental</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Se iniciará una copia en Google Drive. Los documentos seguirán guardados en Taxea Portal.</p>
          </div>
        </div>

        <div className="space-y-3 bg-secondary/40 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cuenta Drive destino</span>
            <span className="font-medium">{driveEmail || 'No conectada'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Modo de copia</span>
            <span className="font-medium">{isFullCopy ? 'Copia completa' : 'Incremental + manifiesto'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Carpeta raíz</span>
            <span className="font-medium">{config?.rootFolderName || 'Taxea Strategies - Backups'}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-5">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            La copia se ejecuta en segundo plano. No cierres esta ventana hasta que finalice. Evita pulsar el botón múltiples veces.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} className="bg-teal hover:bg-teal-dark gap-2">
            Ejecutar copia ahora
          </Button>
        </div>
      </div>
    </div>
  );
}