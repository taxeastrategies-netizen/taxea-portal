import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CopyCheck, Loader2, Trash2, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: 'Pendiente',
  review_required: 'Revisión',
  validated: 'Validada',
  accounted: 'Contabilizada',
  rejected: 'Rechazada',
  cancelled_by_client: 'Cancelada',
  pendiente: 'Pendiente',
  contabilizada: 'Contabilizada',
  en_revision: 'En revisión',
  revisada: 'Revisada',
  asiento_propuesto: 'Asiento propuesto',
  rechazada: 'Rechazada',
};

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  pendiente: 'bg-gray-100 text-gray-700',
  review_required: 'bg-amber-100 text-amber-700',
  en_revision: 'bg-amber-100 text-amber-700',
  validated: 'bg-blue-100 text-blue-700',
  revisada: 'bg-blue-100 text-blue-700',
  accounted: 'bg-green-100 text-green-700',
  contabilizada: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  rechazada: 'bg-red-100 text-red-700',
  cancelled_by_client: 'bg-gray-100 text-gray-500',
  asiento_propuesto: 'bg-purple-100 text-purple-700',
};

export default function DuplicateCheckModal({ open, onClose, companyId, scope, scopeLabel }) {
  const [periodType, setPeriodType] = useState('quarter');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodValue, setPeriodValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const periodOptions = periodType === 'month'
    ? Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][i] }))
    : periodType === 'quarter'
    ? [{ value: 'T1', label: 'T1 (Ene-Mar)' }, { value: 'T2', label: 'T2 (Abr-Jun)' }, { value: 'T3', label: 'T3 (Jul-Sep)' }, { value: 'T4', label: 'T4 (Oct-Dic)' }]
    : [];

  const handleCheck = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('checkDuplicates', {
        company_id: companyId,
        scope,
        period_type: periodType,
        year: periodType === 'all' ? null : year,
        period_value: periodType === 'all' ? null : periodValue
      });
      const data = res?.data || res;
      setResult(data);
    } catch (err) {
      toast.error('Error al analizar duplicados: ' + (err.message || 'desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!result || !result.duplicateGroups) return;
    const toDelete = result.duplicateGroups.flatMap(g => g.toDelete);
    if (toDelete.length === 0) return;

    setDeleting(true);
    let deleted = 0;
    let errors = 0;

    for (const item of toDelete) {
      try {
        if (item.entityType === 'OcrInvoiceDocument') {
          await base44.entities.OcrInvoiceDocument.delete(item.id);
        } else if (item.entityType === 'Invoice') {
          await base44.entities.Invoice.delete(item.id);
        }
        deleted++;
      } catch {
        errors++;
      }
    }

    setDeleting(false);
    if (errors === 0) {
      toast.success(`${deleted} duplicados eliminados correctamente`);
    } else {
      toast.warning(`${deleted} eliminados, ${errors} errores`);
    }
    setResult(null);
    onClose();
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyCheck className="w-5 h-5 text-taxea-red" />
            Chequeo de Duplicados — {scopeLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Period selectors */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Análisis por</Label>
            <Select value={periodType} onValueChange={(v) => { setPeriodType(v); setPeriodValue(''); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
                <SelectItem value="all">Todo el histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodType !== 'all' && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Año</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType !== 'all' && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{periodType === 'month' ? 'Mes' : 'Trimestre'}</Label>
              <Select value={periodValue} onValueChange={setPeriodValue}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleCheck}
            disabled={loading || (periodType !== 'all' && !periodValue)}
            className="bg-teal hover:bg-teal-dark h-9"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyCheck className="w-4 h-4" />}
            {loading ? 'Analizando...' : 'Analizar duplicados'}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {result.duplicateGroupsCount === 0 ? (
                <span className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  No se detectaron duplicados. {result.totalRecordsAnalyzed} registros analizados.
                </span>
              ) : (
                <span className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  {result.duplicateGroupsCount} grupo(s) de duplicados · {result.totalToDelete} registro(s) a eliminar · {result.totalRecordsAnalyzed} analizados
                </span>
              )}
            </div>

            {result.duplicateGroups?.map((group, idx) => (
              <div key={idx} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
                  <p className="text-sm font-medium text-amber-900">
                    Grupo {idx + 1}: {group.reason}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {group.allItems.map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${item.action === 'delete' ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                      <div className="flex-shrink-0">
                        {item.action === 'keep'
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Trash2 className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Nº: </span>
                          <span className="font-medium truncate">{item.numero || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Proveedor/Cliente: </span>
                          <span className="font-medium truncate">{item.proveedor_cliente || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fecha: </span>
                          <span className="font-medium">{item.fecha || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.total != null ? `${item.total}€` : '—'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[item.status] || item.status || '—'}
                          </span>
                        </div>
                      </div>
                      {item.originalFileName && (
                        <div className="flex-shrink-0 hidden lg:block max-w-[180px]">
                          <span className="text-[10px] text-muted-foreground truncate block flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {item.originalFileName}
                          </span>
                        </div>
                      )}
                      <div className="flex-shrink-0 text-xs font-medium">
                        {item.action === 'keep'
                          ? <span className="text-green-600">Mantener</span>
                          : <span className="text-red-500">Eliminar</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {result.duplicateGroupsCount > 0 && (
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleClose} disabled={deleting}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Eliminando...' : `Eliminar ${result.totalToDelete} duplicado(s)`}
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}