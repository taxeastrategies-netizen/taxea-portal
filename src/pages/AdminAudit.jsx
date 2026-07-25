import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Plus, Search, FileText, AlertTriangle, Eye, Loader2, Lock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/ui/StatusBadge';
import AuditCaseForm from '@/components/audit/AuditCaseForm';
import AuditCaseDetail from '@/components/audit/AuditCaseDetail';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const AUDIT_TYPES = {
  revision_modelo_fiscal: 'Modelo Fiscal',
  revision_modelo_200: 'Modelo 200',
  revision_iva: 'IVA',
  revision_igic: 'IGIC',
  revision_irpf: 'IRPF',
  revision_retenciones: 'Retenciones',
  revision_contable: 'Contable',
  revision_escrituras_societarias: 'Escrituras/Societaria',
  revision_contratos: 'Contratos',
  revision_operaciones_vinculadas: 'Operaciones Vinculadas',
  revision_requerimiento_aeat_atc: 'Requerimiento AEAT/ATC',
  revision_cierre_anual: 'Cierre Anual',
  revision_cierre_trimestral: 'Cierre Trimestral',
  due_diligence_documental: 'Due Diligence',
  auditoria_libre: 'Auditoría Libre'
};

const STATUS_LABELS = {
  borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
  documentos_subidos: { label: 'Documentos subidos', color: 'bg-blue-50 text-blue-700' },
  procesando: { label: 'Procesando', color: 'bg-amber-50 text-amber-700' },
  pendiente_ocr: { label: 'Pendiente OCR', color: 'bg-orange-50 text-orange-700' },
  analisis_completado: { label: 'Análisis completado', color: 'bg-green-50 text-green-700' },
  investigacion_pendiente: { label: 'Investigación pendiente', color: 'bg-purple-50 text-purple-700' },
  investigacion_completada: { label: 'Investigación completada', color: 'bg-indigo-50 text-indigo-700' },
  informe_generado: { label: 'Informe generado', color: 'bg-teal-50 text-teal-700' },
  pendiente_revision_admin: { label: 'Pendiente revisión', color: 'bg-yellow-50 text-yellow-700' },
  validado_admin: { label: 'Validado', color: 'bg-emerald-50 text-emerald-700' },
  cerrado: { label: 'Cerrado', color: 'bg-slate-100 text-slate-500' },
  con_error: { label: 'Con error', color: 'bg-red-50 text-red-700' }
};

const RISK_COLORS = {
  bajo: 'bg-green-50 text-green-700 border-green-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  alto: 'bg-orange-50 text-orange-700 border-orange-200',
  critico: 'bg-red-50 text-red-700 border-red-200'
};

export default function AdminAudit() {
  const { user, isAdmin } = useOutletContext() || {};
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const queryClient = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['auditCases'],
    queryFn: () => base44.entities.TaxeaAuditCase.list('-created_date', 100),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TaxeaAuditCase.create({ ...data, createdBy: user?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditCases'] });
      toast.success('Expediente de auditoría creado');
      setShowForm(false);
    },
    onError: (e) => toast.error('Error: ' + e.message)
  });

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <Lock className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="font-medium text-foreground">Acceso no autorizado</p>
        <p className="text-sm text-muted-foreground">Audit es una zona exclusiva para administradores.</p>
      </div>
    );
  }

  if (selectedCaseId) {
    return <AuditCaseDetail caseId={selectedCaseId} onBack={() => setSelectedCaseId(null)} />;
  }

  const filtered = cases.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientNif?.toLowerCase().includes(search.toLowerCase())
  );

  const bloqueos = cases.filter(c => c.status === 'pendiente_revision_admin').length;
  const informesPendientes = cases.filter(c => c.status === 'informe_generado').length;
  const casosAbiertos = cases.filter(c => !['cerrado', 'validado_admin'].includes(c.status)).length;
  const casosRiesgo = cases.filter(c => ['alto', 'critico'].includes(c.riskLevel)).length;

  return (
    <div>
      <PageHeader title="Audit" subtitle="Auditoría documental, fiscal, contable y jurídica · Zona exclusiva Admin">
        <Button onClick={() => setShowForm(true)} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo expediente
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Expedientes abiertos</p>
          <p className="text-2xl font-jakarta font-bold text-foreground">{casosAbiertos}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendientes revisión</p>
          <p className="text-2xl font-jakarta font-bold text-amber-600">{bloqueos}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Informes generados</p>
          <p className="text-2xl font-jakarta font-bold text-teal">{informesPendientes}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Riesgo alto/crítico</p>
          <p className="text-2xl font-jakarta font-bold text-red-600">{casosRiesgo}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-jakarta font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal" /> Expedientes de Auditoría
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar expediente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 text-teal animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">Sin expedientes. Crea uno para comenzar.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(c => {
              const status = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-slate-100 text-slate-600' };
              const risk = RISK_COLORS[c.riskLevel] || RISK_COLORS.bajo;
              return (
                <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedCaseId(c.id)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-teal" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.clientName || 'Sin cliente'} · {AUDIT_TYPES[c.auditType] || c.auditType} · Ej. {c.taxYear || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${risk}`}>{c.riskLevel || 'bajo'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.color}`}>{status.label}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedCaseId(c.id); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AuditCaseForm open={showForm} onOpenChange={setShowForm} onSubmit={createMutation.mutate} saving={createMutation.isPending} />
    </div>
  );
}