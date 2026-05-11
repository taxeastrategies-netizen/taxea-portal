import { useState } from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DMS_STRUCTURE = [
  {
    id: 'legal', label: 'LEGAL', icon: '⚖️', color: 'text-blue-600 bg-blue-50',
    children: [
      { id: 'legal_escrituras', label: 'Escrituras' },
      { id: 'legal_contratos', label: 'Contratos' },
      { id: 'legal_pactos_socios', label: 'Pactos de socios' },
      { id: 'legal_actas', label: 'Actas' },
      { id: 'legal_poderes', label: 'Poderes' },
      { id: 'legal_proteccion_datos', label: 'Protección de datos' },
      { id: 'legal_marcas', label: 'Marcas' },
      { id: 'legal_licencias', label: 'Licencias' },
      { id: 'legal_compliance', label: 'Compliance' },
      { id: 'legal_mercantil', label: 'Mercantil' },
      { id: 'legal_due_diligence', label: 'Due Diligence' },
    ]
  },
  {
    id: 'fiscal', label: 'FISCAL', icon: '📊', color: 'text-red-600 bg-red-50',
    children: [
      { id: 'fiscal_modelos_aeat', label: 'Modelos AEAT' },
      { id: 'fiscal_modelos_atc', label: 'Modelos ATC' },
      { id: 'fiscal_iva', label: 'IVA' },
      { id: 'fiscal_igic', label: 'IGIC' },
      { id: 'fiscal_irpf', label: 'IRPF' },
      { id: 'fiscal_is', label: 'Impuesto Sociedades' },
      { id: 'fiscal_retenciones', label: 'Retenciones' },
      { id: 'fiscal_requerimientos', label: 'Requerimientos' },
      { id: 'fiscal_inspecciones', label: 'Inspecciones' },
      { id: 'fiscal_declaraciones', label: 'Declaraciones' },
      { id: 'fiscal_intracomunitarias', label: 'Intracomunitarias' },
    ]
  },
  {
    id: 'contabilidad', label: 'CONTABILIDAD', icon: '📚', color: 'text-green-600 bg-green-50',
    children: [
      { id: 'cont_fact_emitidas', label: 'Facturas emitidas' },
      { id: 'cont_fact_recibidas', label: 'Facturas recibidas' },
      { id: 'cont_libros', label: 'Libros contables' },
      { id: 'cont_libro_diario', label: 'Libro diario' },
      { id: 'cont_libro_mayor', label: 'Libro mayor' },
      { id: 'cont_pyl', label: 'P&L' },
      { id: 'cont_bancos', label: 'Bancos' },
      { id: 'cont_extractos', label: 'Extractos' },
      { id: 'cont_conciliaciones', label: 'Conciliaciones' },
      { id: 'cont_auditoria', label: 'Auditoría' },
      { id: 'cont_cuentas_anuales', label: 'Cuentas anuales' },
    ]
  },
  {
    id: 'laboral', label: 'LABORAL', icon: '👥', color: 'text-purple-600 bg-purple-50',
    children: [
      { id: 'lab_nominas', label: 'Nóminas' },
      { id: 'lab_contratos', label: 'Contratos trabajadores' },
      { id: 'lab_seguros_sociales', label: 'Seguros sociales' },
      { id: 'lab_altas_bajas', label: 'Altas y bajas' },
      { id: 'lab_prl', label: 'PRL' },
      { id: 'lab_convenios', label: 'Convenios' },
      { id: 'lab_vacaciones', label: 'Vacaciones' },
      { id: 'lab_partes_medicos', label: 'Partes médicos' },
      { id: 'lab_rnt', label: 'RNT' },
      { id: 'lab_rlc', label: 'RLC' },
    ]
  },
  {
    id: 'gestion', label: 'GESTIÓN', icon: '📁', color: 'text-amber-600 bg-amber-50',
    children: [
      { id: 'gest_bancos', label: 'Bancos' },
      { id: 'gest_presupuestos', label: 'Presupuestos' },
      { id: 'gest_seguros', label: 'Seguros' },
      { id: 'gest_proveedores', label: 'Proveedores' },
      { id: 'gest_clientes', label: 'Clientes' },
      { id: 'gest_marketing', label: 'Marketing' },
      { id: 'gest_operaciones', label: 'Operaciones' },
      { id: 'gest_proyectos', label: 'Proyectos' },
    ]
  },
];

export function getAllCarpetas() {
  const flat = [];
  DMS_STRUCTURE.forEach(root => {
    root.children.forEach(c => flat.push({ value: c.id, label: `${root.label} › ${c.label}`, root: root.id }));
  });
  return flat;
}

export function getCarpetaLabel(id) {
  for (const root of DMS_STRUCTURE) {
    const child = root.children.find(c => c.id === id);
    if (child) return `${root.label} › ${child.label}`;
  }
  return id;
}

export default function CarpetasTree({ selected, onSelect, docCounts = {} }) {
  const [expanded, setExpanded] = useState({ legal: true, fiscal: true, contabilidad: true, laboral: false, gestion: false });

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const rootCount = (root) => root.children.reduce((s, c) => s + (docCounts[c.id] || 0), 0);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelect(null)}
        className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          !selected ? 'bg-teal text-white' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}
      >
        <Folder className="w-4 h-4" />
        Todos los documentos
        {Object.values(docCounts).reduce((s, v) => s + v, 0) > 0 && (
          <span className="ml-auto text-xs opacity-70">{Object.values(docCounts).reduce((s, v) => s + v, 0)}</span>
        )}
      </button>

      {DMS_STRUCTURE.map(root => {
        const isExpanded = expanded[root.id];
        const count = rootCount(root);
        return (
          <div key={root.id}>
            <button
              onClick={() => toggle(root.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                'text-foreground hover:bg-secondary/40')}
            >
              <ChevronRight className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform text-muted-foreground', isExpanded && 'rotate-90')} />
              <span>{root.icon}</span>
              <span className="uppercase tracking-wide text-xs">{root.label}</span>
              {count > 0 && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
            </button>
            {isExpanded && (
              <div className="ml-4 space-y-0.5">
                {root.children.map(child => {
                  const isSelected = selected === child.id;
                  const cnt = docCounts[child.id] || 0;
                  return (
                    <button key={child.id} onClick={() => onSelect(child.id)}
                      className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all',
                        isSelected ? 'bg-teal/10 text-teal font-medium border border-teal/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40')}
                    >
                      {isSelected ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
                      <span className="truncate">{child.label}</span>
                      {cnt > 0 && <span className="ml-auto text-xs opacity-60">{cnt}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}