import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, TrendingUp, AlertTriangle, CheckSquare, Euro, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

function getHealthColor(score) {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

const SEMAFORO = {
  verde: { dot: 'bg-green-500', label: 'Correcto' },
  amarillo: { dot: 'bg-amber-500', label: 'Atención' },
  rojo: { dot: 'bg-red-500', label: 'Urgente' },
  gris: { dot: 'bg-slate-400', label: 'Sin datos' },
};

export default function AdminOverview() {
  const [companies, setCompanies] = useState([]);
  const [crmMap, setCrmMap] = useState({});
  const [errorsMap, setErrorsMap] = useState({});
  const [tasksMap, setTasksMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [comps, crms, errors, tasks] = await Promise.all([
      base44.entities.Company.list(),
      base44.entities.ClientCRM.list(),
      base44.entities.FiscalError.filter({ estado: 'detectado' }),
      base44.entities.Task.filter({ estado: 'pendiente_cliente' }),
    ]);

    const cm = {};
    (crms || []).forEach(c => { cm[c.company_id] = c; });
    setCrmMap(cm);

    const em = {};
    (errors || []).forEach(e => {
      if (!em[e.company_id]) em[e.company_id] = 0;
      em[e.company_id]++;
    });
    setErrorsMap(em);

    const tm = {};
    (tasks || []).forEach(t => {
      if (!tm[t.company_id]) tm[t.company_id] = 0;
      tm[t.company_id]++;
    });
    setTasksMap(tm);

    setCompanies(comps || []);
    setLoading(false);
  };

  const totalHonorarios = Object.values(crmMap).reduce((s, c) => s + (c.honorarios_mensuales || 0), 0);
  const totalClientes = companies.filter(c => c.activa).length;
  const clientesRiesgo = companies.filter(c => {
    const crm = crmMap[c.id];
    return crm && (crm.estado_fiscal === 'rojo' || (crm.health_score || 75) < 50);
  }).length;

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* KPIs globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Clientes activos</p>
          </div>
          <p className="text-2xl font-jakarta font-bold text-foreground">{totalClientes}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Euro className="w-4 h-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Honorarios/mes</p>
          </div>
          <p className="text-2xl font-jakarta font-bold text-green-600">{totalHonorarios.toLocaleString('es-ES')} €</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Clientes en riesgo</p>
          </div>
          <p className="text-2xl font-jakarta font-bold text-red-600">{clientesRiesgo}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Tareas pdte. clientes</p>
          </div>
          <p className="text-2xl font-jakarta font-bold text-amber-600">
            {Object.values(tasksMap).reduce((s, v) => s + v, 0)}
          </p>
        </div>
      </div>

      {/* Tabla de clientes con semáforos */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-jakarta font-semibold text-foreground text-sm">Vista global de clientes</h3>
          <Link to="/crm" className="text-xs text-primary hover:underline">Ver CRM completo →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Empresa</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Health</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Errores</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Tareas pdte.</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Honorarios/mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.filter(c => c.activa).map(comp => {
                const crm = crmMap[comp.id];
                const score = crm?.health_score || 75;
                const semaforo = SEMAFORO[crm?.estado_fiscal || 'gris'];
                return (
                  <tr key={comp.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground text-xs">{comp.razon_social || comp.nombre_comercial}</p>
                          <p className="text-xs text-muted-foreground">{comp.nif_cif}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", semaforo.dot)} />
                        <span className="text-xs text-muted-foreground">{semaforo.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", getHealthColor(score))}>
                        {score}/100
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {errorsMap[comp.id] ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">{errorsMap[comp.id]} error{errorsMap[comp.id] > 1 ? 'es' : ''}</span>
                      ) : (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {tasksMap[comp.id] ? (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{tasksMap[comp.id]} tarea{tasksMap[comp.id] > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs font-medium">
                      {crm?.honorarios_mensuales ? `${crm.honorarios_mensuales.toLocaleString('es-ES')} €` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}