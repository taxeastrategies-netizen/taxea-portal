import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LIS_ROWS = [
  ['obra_civil_general', 'Obra civil general', 2, 100],
  ['pavimentos', 'Pavimentos', 6, 34],
  ['infraestructuras', 'Infraestructuras y obras mineras', 7, 30],
  ['centrales_hidraulicas', 'Centrales hidráulicas', 2, 100],
  ['centrales_nucleares', 'Centrales nucleares', 3, 60],
  ['centrales_carbon', 'Centrales de carbón', 4, 50],
  ['centrales_renovables', 'Centrales renovables', 7, 30],
  ['otras_centrales', 'Otras centrales', 5, 40],
  ['edificios_industriales', 'Edificios industriales', 3, 68],
  ['escombreras', 'Terrenos dedicados exclusivamente a escombreras', 4, 50],
  ['almacenes_depositos', 'Almacenes y depósitos', 7, 30],
  ['edificios_comerciales', 'Edificios comerciales, administrativos, de servicios y viviendas', 2, 100],
  ['redes_energia', 'Subestaciones y redes de transporte y distribución de energía', 5, 40],
  ['cables', 'Cables', 7, 30],
  ['resto_instalaciones', 'Resto de instalaciones', 10, 20],
  ['maquinaria', 'Maquinaria', 12, 18],
  ['equipos_medicos', 'Equipos médicos y asimilados', 15, 14],
  ['locomotoras', 'Locomotoras, vagones y equipos de tracción', 8, 25],
  ['buques_aeronaves', 'Buques y aeronaves', 10, 20],
  ['transporte_interno', 'Elementos de transporte interno', 10, 20],
  ['transporte_externo', 'Elementos de transporte externo', 16, 14],
  ['autocamiones', 'Autocamiones', 20, 10],
  ['mobiliario', 'Mobiliario', 10, 20],
  ['lenceria', 'Lencería', 25, 8],
  ['cristaleria', 'Cristalería', 50, 4],
  ['utiles_herramientas', 'Útiles y herramientas', 25, 8],
  ['moldes_matrices', 'Moldes, matrices y modelos', 33, 6],
  ['otros_enseres', 'Otros enseres', 15, 14],
  ['equipos_electronicos', 'Equipos electrónicos', 20, 10],
  ['equipos_informacion', 'Equipos para procesos de información', 25, 8],
  ['software', 'Sistemas y programas informáticos', 33, 6],
  ['audiovisual', 'Producciones cinematográficas, fonográficas, vídeos y series', 33, 6],
  ['otros_elementos', 'Otros elementos', 10, 20],
];

const EDS_ROWS = [
  ['eds_edificios', 'Edificios y otras construcciones', 3, 68],
  ['eds_instalaciones', 'Instalaciones, mobiliario y resto del inmovilizado material', 10, 20],
  ['eds_maquinaria', 'Maquinaria', 12, 18],
  ['eds_transporte', 'Elementos de transporte', 16, 14],
  ['eds_informatica', 'Equipos informáticos y programas', 26, 10],
  ['eds_utiles', 'Útiles y herramientas', 30, 8],
  ['eds_ganado', 'Ganado vacuno, porcino, ovino y caprino', 16, 14],
  ['eds_equino', 'Ganado equino y frutales no cítricos', 8, 25],
  ['eds_citricos', 'Frutales cítricos y viñedos', 4, 50],
  ['eds_olivar', 'Olivar', 2, 100],
];

const SOURCES = {
  lis: 'https://sede.agenciatributaria.gob.es/Sede/impuesto-sobre-sociedades/que-base-imponible-se-determina-sociedades/amortizaciones.html',
  eds: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/folleto-actividades-economicas/3-impuesto-sobre-renta-personas-fisicas/3_5-estimacion-directa-simplificada/3_5_4-tabla-amortizacion-simplificada.html',
};

export default function AeatAmortizationGuide({ onSelect }) {
  const [table, setTable] = useState('lis');
  const [search, setSearch] = useState('');
  const rows = table === 'lis' ? LIS_ROWS : EDS_ROWS;
  const visible = useMemo(() => rows.filter((row) => String(row[1]).toLowerCase().includes(search.toLowerCase())), [rows, search]);

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">Guía oficial de coeficientes de amortización AEAT</summary>
      <div className="border-t border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={table === 'lis' ? 'default' : 'outline'} onClick={() => setTable('lis')}>Sociedades · art. 12.1 LIS</Button>
          <Button type="button" size="sm" variant={table === 'eds' ? 'default' : 'outline'} onClick={() => setTable('eds')}>IRPF · directa simplificada</Button>
          <div className="relative ml-auto min-w-52 flex-1 sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-8 pl-8 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar elemento…" /></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">La tabla sirve de guía fiscal. El porcentaje contable debe reflejar la vida útil real; cualquier diferencia fiscal requiere su ajuste y revisión.</p>
        <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Elemento</th><th className="px-3 py-2 text-right">Coef. máximo</th><th className="px-3 py-2 text-right">Período máximo</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-border">{visible.map(([code, label, rate, years]) => <tr key={code}><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right font-mono">{rate}%</td><td className="px-3 py-2 text-right">{years} años</td><td className="px-3 py-2 text-right"><Button type="button" size="sm" variant="ghost" onClick={() => onSelect?.({ table, code, label, rate, years })}>Usar</Button></td></tr>)}</tbody>
          </table>
        </div>
        <a className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={SOURCES[table]} target="_blank" rel="noreferrer">Fuente oficial AEAT <ExternalLink className="h-3 w-3" /></a>
      </div>
    </details>
  );
}

