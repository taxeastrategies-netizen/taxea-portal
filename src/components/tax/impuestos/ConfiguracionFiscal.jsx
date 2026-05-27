import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, CheckCircle } from 'lucide-react';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { useAuth } from '@/lib/AuthContext';

const MODELOS_IVA = [
  { codigo: '303', nombre: 'Modelo 303 – Autoliquidación periódica IVA', periodicidad: 'trimestral' },
  { codigo: '390', nombre: 'Modelo 390 – Resumen anual IVA', periodicidad: 'anual' },
  { codigo: '349', nombre: 'Modelo 349 – Operaciones intracomunitarias', periodicidad: 'trimestral' },
  { codigo: '347', nombre: 'Modelo 347 – Operaciones con terceros', periodicidad: 'anual' },
];
const MODELOS_IRPF = [
  { codigo: '130', nombre: 'Modelo 130 – Pago fraccionado IRPF', periodicidad: 'trimestral' },
  { codigo: '111', nombre: 'Modelo 111 – Retenciones trabajo/profesionales', periodicidad: 'trimestral' },
  { codigo: '190', nombre: 'Modelo 190 – Resumen anual M.111', periodicidad: 'anual' },
  { codigo: '115', nombre: 'Modelo 115 – Retenciones alquileres', periodicidad: 'trimestral' },
  { codigo: '180', nombre: 'Modelo 180 – Resumen anual M.115', periodicidad: 'anual' },
  { codigo: '123', nombre: 'Modelo 123 – Capital mobiliario', periodicidad: 'trimestral' },
  { codigo: '193', nombre: 'Modelo 193 – Resumen anual M.123', periodicidad: 'anual' },
];
const MODELOS_IGIC = [
  { codigo: '420', nombre: 'Modelo 420 – Autoliquidación trimestral IGIC', periodicidad: 'trimestral' },
  { codigo: '425', nombre: 'Modelo 425 – Resumen anual IGIC', periodicidad: 'anual' },
  { codigo: '415', nombre: 'Modelo 415 – Operaciones con terceros (Canarias)', periodicidad: 'anual' },
];

export default function ConfiguracionFiscal() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const qc = useQueryClient();
  const companyId = company?.id;

  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const upsertModel = useMutation({
    mutationFn: async ({ codigo, activo, periodicidad, fuenteValidacion }) => {
      const existing = modelos.find(m => m.codigo === codigo);
      if (existing) {
        return base44.entities.TaxModel.update(existing.id, { activo, periodicidad, fuenteValidacion });
      }
      return base44.entities.TaxModel.create({
        companyId, codigo, activo, periodicidad, fuenteValidacion,
        nombre: [...MODELOS_IVA, ...MODELOS_IRPF, ...MODELOS_IGIC].find(m => m.codigo === codigo)?.nombre || codigo,
        impuesto: MODELOS_IVA.find(m => m.codigo === codigo) ? 'IVA' : MODELOS_IRPF.find(m => m.codigo === codigo) ? 'IRPF' : 'IGIC',
        administracion: MODELOS_IGIC.find(m => m.codigo === codigo) ? 'ATC' : 'AEAT',
        fechaAlta: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxModels', companyId] }),
  });

  const getModel = (codigo) => modelos.find(m => m.codigo === codigo);
  const isActive = (codigo) => getModel(codigo)?.activo ?? false;

  const toggle = (modelo) => {
    upsertModel.mutate({
      codigo: modelo.codigo,
      activo: !isActive(modelo.codigo),
      periodicidad: getModel(modelo.codigo)?.periodicidad || modelo.periodicidad,
      fuenteValidacion: getModel(modelo.codigo)?.fuenteValidacion || 'pendiente_confirmar',
    });
  };

  const renderGroup = (title, lista, badge) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{badge.includes('blue') ? 'AEAT' : badge.includes('purple') ? 'AEAT' : 'ATC'}</span>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        {lista.map((m, i) => {
          const active = isActive(m.codigo);
          const saved = getModel(m.codigo);
          return (
            <div key={m.codigo} className={`flex items-center justify-between px-4 py-3 ${i < lista.length - 1 ? 'border-b border-border' : ''} ${active ? 'bg-white' : 'bg-muted/30'}`}>
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={() => toggle(m)} />
                <div>
                  <p className="text-sm font-medium text-foreground">{m.nombre}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.periodicidad}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    saved.fuenteValidacion === 'certificado_censal' ? 'bg-green-100 text-green-700' :
                    saved.fuenteValidacion === 'criterio_asesor' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {saved.fuenteValidacion === 'certificado_censal' ? 'Censal' :
                     saved.fuenteValidacion === 'criterio_asesor' ? 'Asesor' :
                     saved.fuenteValidacion === 'alta_manual' ? 'Manual' : 'Pendiente'}
                  </span>
                )}
                {active && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!companyId) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Selecciona un cliente para configurar sus obligaciones fiscales.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Configuración fiscal del cliente</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Cliente</Label>
            <p className="text-sm font-medium text-foreground">{company?.legalName || company?.displayName || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">NIF / CIF</Label>
            <p className="text-sm font-medium text-foreground">{company?.taxId || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Territorio fiscal</Label>
            <p className="text-sm font-medium text-foreground capitalize">{company?.taxRegime === 'igic' ? 'Agencia Tributaria Canaria / IGIC' : company?.taxRegime === 'iva' ? 'AEAT / IVA' : company?.taxRegime === 'mixto' ? 'Mixto' : 'Pendiente de configuración'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tipo de cliente</Label>
            <p className="text-sm font-medium text-foreground capitalize">{company?.clientType === 'autonomo' ? 'Persona física / Autónomo' : 'Sociedad mercantil'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Activación de modelos fiscales</h2>
        <p className="text-xs text-muted-foreground mb-5">Activa los modelos aplicables a este cliente. Cada cambio queda registrado con trazabilidad.</p>
        {renderGroup('IVA — AEAT', MODELOS_IVA, 'bg-blue-100 text-blue-700')}
        {renderGroup('IRPF — AEAT', MODELOS_IRPF, 'bg-purple-100 text-purple-700')}
        {renderGroup('IGIC — Agencia Tributaria Canaria', MODELOS_IGIC, 'bg-orange-100 text-orange-700')}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        La información fiscal debe ser revisada por un profesional antes de su presentación. Taxea Portal genera borradores basados en los datos disponibles, pero no sustituye la validación fiscal.
      </div>
    </div>
  );
}