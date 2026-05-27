import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getPeriodosDelModelo } from './aeatDeadlines';

function fmt(n) { return n != null ? `${Number(n).toFixed(2)} €` : '—'; }

function facturaEnEjercicio(f, year) {
  const anio = f.anio || (f.fecha_emision && new Date(f.fecha_emision).getFullYear());
  return anio === year;
}

export default function ErroresValidacionesTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();

  const { data: modelos = [] } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => base44.entities.Invoice.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ['taxPeriods', companyId, currentYear],
    queryFn: () => base44.entities.TaxPeriod.filter({ companyId, ejercicio: currentYear }),
    enabled: !!companyId,
  });

  if (!companyId) return <div className="text-center py-16 text-sm text-gray-400">Selecciona un cliente.</div>;

  const activeModelos = modelos.filter(m => m.activo);
  const yearInvoices = invoices.filter(f => !f.anulada && facturaEnEjercicio(f, currentYear));

  // Generar validaciones automáticas
  const errores = [];
  const advertencias = [];
  const ok = [];

  // 1. Facturas sin NIF
  const sinNif = yearInvoices.filter(f => !f.cliente_nif && !f.proveedor_nif);
  if (sinNif.length > 0) {
    advertencias.push({
      tipo: 'advertencia',
      codigo: 'VAL-001',
      titulo: `${sinNif.length} factura(s) sin NIF/CIF del contraparte`,
      descripcion: 'Las facturas sin identificación fiscal pueden ser rechazadas en modelos 303 y 347.',
      afectados: sinNif.slice(0, 3).map(f => f.numero_factura).join(', ') + (sinNif.length > 3 ? '...' : ''),
    });
  }

  // 2. Facturas sin tipo IVA
  const sinIva = yearInvoices.filter(f => f.cuota_iva == null || f.tipo_iva == null);
  if (sinIva.length > 0) {
    advertencias.push({
      tipo: 'advertencia',
      codigo: 'VAL-002',
      titulo: `${sinIva.length} factura(s) sin tipo IVA definido`,
      descripcion: 'Sin tipo IVA, el modelo 303 no puede calcularse correctamente.',
      afectados: sinIva.slice(0, 3).map(f => f.numero_factura).join(', ') + (sinIva.length > 3 ? '...' : ''),
    });
  }

  // 3. Facturas no contabilizadas
  const noContab = yearInvoices.filter(f => f.estado_contable !== 'contabilizada' && !f.linked_journal_entry_id);
  if (noContab.length > 0) {
    advertencias.push({
      tipo: 'advertencia',
      codigo: 'VAL-003',
      titulo: `${noContab.length} factura(s) pendientes de contabilizar`,
      descripcion: 'Los importes de borradores pueden ser incompletos hasta que todas las facturas estén contabilizadas.',
      afectados: '',
    });
  }

  // 4. Modelos anuales sin configurar (sin TaxPeriod creado)
  const modelosAnuales = activeModelos.filter(m => ['390','190','180','193','347','415','425'].includes(m.codigo));
  modelosAnuales.forEach(m => {
    const hasPeriod = periods.find(p => p.modeloCodigo === m.codigo && p.periodo === 'Anual');
    if (!hasPeriod) {
      advertencias.push({
        tipo: 'advertencia',
        codigo: 'VAL-004',
        titulo: `Modelo ${m.codigo} anual sin período iniciado`,
        descripcion: `El modelo ${m.codigo} es anual. Crea el período "Anual ${currentYear}" en la sección Modelos.`,
        afectados: '',
      });
    }
  });

  // 5. Sin modelos configurados
  if (activeModelos.length === 0) {
    errores.push({
      tipo: 'error',
      codigo: 'CFG-001',
      titulo: 'Sin modelos fiscales configurados',
      descripcion: 'El cliente no tiene ningún modelo activo. Ve a Configuración fiscal para activarlos.',
      afectados: '',
    });
  } else {
    ok.push({ titulo: `${activeModelos.length} modelos activos configurados correctamente` });
  }

  // 6. Facturas sin errores
  if (sinNif.length === 0 && sinIva.length === 0 && noContab.length === 0) {
    ok.push({ titulo: 'Todas las facturas del ejercicio tienen datos fiscales completos' });
  }

  const total = errores.length + advertencias.length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Errores y validaciones</h2>
          <p className="text-sm text-gray-500 mt-0.5">Comprobaciones automáticas del ejercicio {currentYear}</p>
        </div>
        <div className="flex gap-3 text-sm">
          {errores.length > 0 && <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertCircle className="w-4 h-4" />{errores.length} errores</span>}
          {advertencias.length > 0 && <span className="flex items-center gap-1.5 text-amber-600 font-medium"><AlertTriangle className="w-4 h-4" />{advertencias.length} advertencias</span>}
          {ok.length > 0 && <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle className="w-4 h-4" />{ok.length} correctos</span>}
        </div>
      </div>

      {/* Errores */}
      {errores.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Errores</p>
          {errores.map((e, i) => (
            <div key={i} className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-red-800">{e.titulo}</p>
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-mono">{e.codigo}</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{e.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advertencias */}
      {advertencias.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Advertencias</p>
          {advertencias.map((e, i) => (
            <div key={i} className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-amber-800">{e.titulo}</p>
                  <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-mono">{e.codigo}</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">{e.descripcion}</p>
                {e.afectados && <p className="text-xs text-amber-600 mt-1 font-mono">Afectados: {e.afectados}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OK */}
      {ok.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Correcto</p>
          {ok.map((e, i) => (
            <div key={i} className="flex gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{e.titulo}</p>
            </div>
          ))}
        </div>
      )}

      {total === 0 && ok.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Sin datos suficientes para ejecutar validaciones.
        </div>
      )}
    </div>
  );
}