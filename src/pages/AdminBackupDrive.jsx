import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, HardDrive, RefreshCw, Play, CheckCircle, AlertTriangle, XCircle, Clock, FolderOpen, Loader2, History, Cloud } from 'lucide-react';
import BackupModal from '@/components/backup/BackupModal';

const STATUS_STYLES = {
  queued: { label: 'En cola', color: 'bg-gray-100 text-gray-700' },
  preparing: { label: 'Preparando', color: 'bg-blue-100 text-blue-700' },
  copying: { label: 'Copiando', color: 'bg-blue-100 text-blue-700' },
  verifying: { label: 'Verificando', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  completed_with_errors: { label: 'Completada con incidencias', color: 'bg-amber-100 text-amber-700' },
  failed: { label: 'Error', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' },
};

const JOB_TYPE_LABELS = { scheduled: 'Automática', manual: 'Manual', verification: 'Verificación', retry_failed: 'Reintento' };

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function AdminBackupDrive() {
  const { user } = useOutletContext() || {};
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('documentBackupToDrive', { action: 'status' });
      setStatus(res.data);
      setJobs(res.data?.recentJobs || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleBackup = async () => {
    setShowModal(false);
    setRunning(true);
    setRunResult(null);
    try {
      const res = await base44.functions.invoke('documentBackupToDrive', { action: 'backup' });
      setRunResult(res.data);
      await loadStatus();
    } catch (e) {
      setRunResult({ status: 'failed', error: e.response?.data?.error || e.message });
    }
    setRunning(false);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await base44.functions.invoke('documentBackupToDrive', { action: 'verify' });
      setVerifyResult(res.data);
    } catch (e) {
      setVerifyResult({ status: 'error', error: e.response?.data?.error || e.message });
    }
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const config = status?.config;
  const isCorrectAccount = status?.isCorrectAccount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguridad y Copias"
        subtitle="Copia de seguridad documental automática en Google Drive"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleVerify} disabled={verifying || !jobs.length} className="gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verificar última copia
            </Button>
            <Button onClick={() => setShowModal(true)} disabled={running} className="bg-teal hover:bg-teal-dark gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Copia seguridad
            </Button>
          </div>
        }
      />

      {/* Drive Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="w-5 h-5 text-teal" /> Estado de Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cuenta conectada</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{status?.connectedEmail || 'No conectada'}</span>
                {isCorrectAccount
                  ? <CheckCircle className="w-4 h-4 text-green-500" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500" />
                }
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Carpeta raíz</p>
              <p className="text-sm font-medium">{config?.rootFolderName || 'Taxea Strategies - Backups'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Modo de backup</p>
              <Badge variant="secondary" className="text-xs">
                {config?.backupMode === 'full_daily_copy' ? 'Copia completa diaria' : 'Incremental + manifiesto'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hora programada</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {config?.scheduleTime || '03:00'} (Atlantic/Canary)
              </p>
            </div>
          </div>

          {!isCorrectAccount && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Cuenta incorrecta</p>
                <p className="text-xs text-amber-700">
                  La cuenta conectada no es <strong>{status?.requiredEmail}</strong>. Contacta con Alexis antes de activar copias.
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Activa verificación en dos pasos en la cuenta de Google Drive usada para copias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{formatDateTime(config?.lastSuccessfulBackupAt) === '—' ? '—' : '✓'}</p>
            <p className="text-xs text-muted-foreground">Última copia correcta</p>
            <p className="text-xs font-medium mt-1">{formatDateTime(config?.lastSuccessfulBackupAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <HardDrive className="w-5 h-5 text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{status?.pendingCount || 0}</p>
            <p className="text-xs text-muted-foreground">Documentos pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <XCircle className="w-5 h-5 text-red-500 mb-1" />
            <p className="text-2xl font-bold">{status?.failedCount || 0}</p>
            <p className="text-xs text-muted-foreground">Incidencias abiertas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <Clock className="w-5 h-5 text-purple-500 mb-1" />
            <p className="text-sm font-bold">{config?.scheduleEnabled ? config.scheduleTime : 'Desactivada'}</p>
            <p className="text-xs text-muted-foreground">Próxima copia programada</p>
          </CardContent>
        </Card>
      </div>

      {/* Running progress */}
      {running && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-5 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-900">Ejecutando copia de seguridad...</p>
              <p className="text-xs text-blue-700">Los documentos se están copiando a Google Drive. Esto puede tardar varios minutos.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {runResult && !running && (
        <Card className={runResult.status === 'failed' ? 'border-red-200 bg-red-50/50' : runResult.status === 'completed_with_errors' ? 'border-amber-200 bg-amber-50/50' : 'border-green-200 bg-green-50/50'}>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              {runResult.status === 'completed' ? <CheckCircle className="w-6 h-6 text-green-600" /> : runResult.status === 'failed' ? <XCircle className="w-6 h-6 text-red-600" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {runResult.status === 'completed' ? 'Copia completada correctamente' : runResult.status === 'failed' ? 'Error en la copia' : 'Copia completada con incidencias'}
                </p>
                {runResult.status !== 'failed' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                    <div><span className="text-muted-foreground">Revisados:</span> <strong>{runResult.documentsScanned}</strong></div>
                    <div><span className="text-muted-foreground">Copiados:</span> <strong>{runResult.documentsCopied}</strong></div>
                    <div><span className="text-muted-foreground">Omitidos:</span> <strong>{runResult.documentsSkipped}</strong></div>
                    <div><span className="text-muted-foreground">Fallidos:</span> <strong>{runResult.documentsFailed}</strong></div>
                  </div>
                )}
                {runResult.driveFolderPath && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" /> {runResult.driveFolderPath}
                  </p>
                )}
                {runResult.error && <p className="text-xs text-red-600 mt-2">{runResult.error}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verify result */}
      {verifyResult && (
        <Card className={verifyResult.status === 'ok' ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              {verifyResult.status === 'ok' ? <CheckCircle className="w-6 h-6 text-green-600" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
              <div>
                <p className="text-sm font-medium">
                  {verifyResult.status === 'ok' ? 'Verificación correcta' : 'Verificación con incidencias'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verificados: {verifyResult.verified} · Faltantes: {verifyResult.missing}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-teal" /> Historial de copias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay copias registradas todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Estado</th>
                    <th className="pb-2 pr-4 font-medium text-right">Revisados</th>
                    <th className="pb-2 pr-4 font-medium text-right">Copiados</th>
                    <th className="pb-2 pr-4 font-medium text-right">Errores</th>
                    <th className="pb-2 pr-4 font-medium text-right">Tamaño</th>
                    <th className="pb-2 pr-4 font-medium text-right">Duración</th>
                    <th className="pb-2 font-medium">Ejecutado por</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => {
                    const st = STATUS_STYLES[job.status] || { label: job.status, color: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={job.id} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="py-2.5 pr-4 whitespace-nowrap">{formatDateTime(job.startedAt)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className="text-xs">{JOB_TYPE_LABELS[job.jobType] || job.jobType}</Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{job.documentsScanned || 0}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{job.documentsCopied || 0}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{job.documentsFailed || 0}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums whitespace-nowrap">{formatBytes(job.bytesCopied)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums whitespace-nowrap">{job.durationSeconds ? `${job.durationSeconds}s` : '—'}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">{job.triggeredByEmail || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showModal && (
        <BackupModal
          config={config}
          driveEmail={status?.connectedEmail}
          onConfirm={handleBackup}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}