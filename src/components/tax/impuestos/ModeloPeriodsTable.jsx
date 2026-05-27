import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeadlines } from './aeatDeadlines';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';

const PERIODOS_TRIMESTRAL = ['T1', 'T2', 'T3', 'T4'];
const PERIODOS_ANUAL = ['Anual'];
const PERIODOS_MENSUAL = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

// Plazos reales: ver aeatDeadlines.js

function getPeriodos(modelo) {
  const m = modelos_per.find(x => x.codigo === modelo);
  if (!m) return PERIODOS_TRIMESTRAL;
  if (m.periodicidad === 'anual') return PERIODOS_ANUAL;
  if (m.periodicidad === 'mensual') return PERIODOS_MENSUAL;
  return PERIODOS_TRIMESTRAL;
}
const modelos_per = [
  { codigo: '303', periodicidad: 'trimestral' }, { codigo: '390', periodicidad: 'anual' },
  { codigo: '349', periodicidad: 'trimestral' }, { codigo: '347', periodicidad: 'anual' },
  { codigo: '130', periodicidad: 'trimestral' }, { codigo: '111', periodicidad: 'trimestral' },
  { codigo: '190', periodicidad: 'anual' }, { codigo: '115', periodicidad: 'trimestral' },
  { codigo: '180', periodicidad: 'anual' }, { codigo: '123', periodicidad: 'trimestral' },
  { codigo: '193', periodicidad: 'anual' }, { codigo: '420', periodicidad: 'trimestral' },
  { codigo: '425', periodicidad: 'anual' }, { codigo: '415', periodicidad: 'anual' },
];

export default function ModeloPeriodsTable({ modeloCodigo, companyId, year, estadoConfig }) {
  const qc = useQueryClient();
  const periodos = getPeriodos(modeloCodigo);

  const { data: taxPeriods = [] } = useQuery({
    queryKey: ['taxPeriods', companyId, year, modeloCodigo],
    queryFn: () => base44.entities.TaxPeriod.filter({ companyId, ejercicio: year, modeloCodigo }),
    enabled: !!companyId,
  });

  const createPeriod = useMutation({
    mutationFn: (periodo) => {
      const dl = getDeadlines(modeloCodigo, periodo, year);
      return base44.entities.TaxPeriod.create({
        companyId, modeloCodigo, ejercicio: year, periodo,
        estado: 'sin_datos',
        fechaInicio: null,
        fechaFin: null,
        fechaLimiteInterna: dl?.limiteInterno || dl?.presentacion || null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxPeriods'] }),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Periodo</th>
            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Dom.</th>
            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Presentación</th>
            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Base imponible</th>
            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Cuota rep.</th>
            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Cuota sop.</th>
            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Total</th>
            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Estado</th>
            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map(p => {
            const tp = taxPeriods.find(x => x.periodo === p);
            const cfg = estadoConfig[tp?.estado] || estadoConfig.sin_datos;
            return (
              <tr key={p} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2.5 px-3 font-medium">{p} {year}</td>
                <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{getDeadlines(modeloCodigo, p, year)?.domiciliacion || '—'}</td>
                <td className="py-2.5 px-3 text-center text-xs font-medium">{getDeadlines(modeloCodigo, p, year)?.presentacion || '—'}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {tp ? '—' : <span className="text-xs text-muted-foreground/60">Sin datos</span>}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">—</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">—</td>
                <td className="py-2.5 px-3 text-right font-medium">
                  {tp?.importeConfirmado != null ? `${tp.importeConfirmado.toFixed(2)} €` : '—'}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {tp ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                      <Eye className="w-3 h-3" /> Ver
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => createPeriod.mutate(p)}>
                      <Plus className="w-3 h-3" /> Crear
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-3 px-2">
        Los importes se calcularán automáticamente desde facturas y asientos contabilizados al crear el borrador.
      </p>
    </div>
  );
}