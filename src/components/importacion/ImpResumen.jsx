import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle, FileText, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImpResumen({ stats, ejercicio, companyId }) {
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    base44.entities.ImportControlIssue.filter({ companyId, ejercicio: String(ejercicio) }, '-created_date', 50)
      .then(setIssues).catch(() => {});
  }, [companyId, ejercicio]);

  const ejercicios = [2023, 2024, 2025];

  return (
    <div className="space-y-6">
      {/* KPIs por ejercicio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ejercicios.map(ej => {
          const hasData = stats && (stats.lines > 0);
          return (
            <div key={ej} className="bg-card rounded-xl border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-jakarta font-bold text-lg">Ejercicio {ej}</h3>
                {ej === ejercicio
                  ? <span className="text-xs px-2 py-0.5 rounded bg-teal-light text-teal font-medium">Seleccionado</span>
                  : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {ej === 2025
                  ? 'Diario completo, IVA, balances y sumas y saldos.'
                  : 'Diario completo con asientos operativos, apertura, regularización y cierre.'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fuentes importadas */}
      {stats?.sources?.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <h3 className="font-jakarta font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Fuentes de origen
          </h3>
          <div className="space-y-1.5">
            {stats.sources.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-secondary/50">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-foreground truncate">{s.fuente}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground">
                  <span>{s.tipo}</span>
                  <span>Ej. {s.ejercicio}</span>
                  {s.lineasDiario > 0 && <span>{s.lineasDiario} líneas</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controles y discrepancias */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <h3 className="font-jakarta font-semibold text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Controles y discrepancias — Ejercicio {ejercicio}
        </h3>
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin controles registrados para este ejercicio.</p>
        ) : (
          <div className="space-y-2">
            {issues.map((iss, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                iss.estado === 'OK' ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              )}>
                {iss.estado === 'OK'
                  ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{iss.control}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{iss.detalle}</p>
                  {iss.delta !== 0 && (
                    <p className={cn("text-xs font-semibold mt-1", iss.estado === 'OK' ? "text-green-600" : "text-amber-600")}>
                      Delta: {iss.delta}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}