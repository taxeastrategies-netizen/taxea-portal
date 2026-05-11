import { MODELOS_AEAT, VENCIMIENTOS_TRIMESTRALES, VENCIMIENTOS_ANUALES, COLOR_MAP } from './CalendarioAEAT';

const MESES_TRIMESTRE = {
  T1: ['Enero', 'Febrero', 'Marzo'],
  T2: ['Abril', 'Mayo', 'Junio'],
  T3: ['Julio', 'Agosto', 'Septiembre'],
  T4: ['Octubre', 'Noviembre', 'Diciembre'],
};

export default function CalendarioGeneral({ obligacionesActivas = [] }) {
  const activasSet = new Set(obligacionesActivas.map(o => o.modelo));

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-700 mb-1">📅 Calendario AEAT {new Date().getFullYear()}</p>
        <p className="text-xs text-amber-600">Fechas orientativas. Consulta siempre el calendario oficial de la AEAT. Las obligaciones marcadas en verde son las asignadas a tu empresa.</p>
      </div>

      {/* Trimestral */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Obligaciones trimestrales</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(VENCIMIENTOS_TRIMESTRALES).map(([t, info]) => (
            <div key={t} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-jakarta font-bold text-foreground">{t}</span>
                <span className="text-xs text-muted-foreground">{info.label}</span>
              </div>
              <p className="text-xs text-red-600 font-medium mb-3">⏰ Límite: {info.limite}</p>
              <div className="space-y-1.5">
                {MODELOS_AEAT.filter(m => m.frecuencia === 'trimestral').map(m => {
                  const activo = activasSet.has(m.value);
                  return (
                    <div key={m.value} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${activo ? 'bg-teal-light border-teal/20 text-teal font-medium' : 'border-border text-muted-foreground'}`}>
                      <span>{m.icon}</span>
                      <span className="font-medium">{m.label}</span>
                      <span className="opacity-70 truncate">— {m.desc}</span>
                      {activo && <span className="ml-auto text-teal font-bold">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anual */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Obligaciones anuales</h3>
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Modelo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Descripción</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Fecha límite</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {VENCIMIENTOS_ANUALES.map(v => {
                const info = MODELOS_AEAT.find(m => m.value === v.modelo);
                const activo = activasSet.has(v.modelo);
                return (
                  <tr key={v.modelo} className={`${activo ? 'bg-teal/5' : ''} hover:bg-secondary/10`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{info?.icon || '📄'}</span>
                        <span className={`font-medium text-sm ${activo ? 'text-teal' : 'text-foreground'}`}>{info?.label || v.modelo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{v.desc}</td>
                    <td className="px-4 py-3"><span className="text-xs text-red-600 font-medium">{v.limite}</span></td>
                    <td className="px-4 py-3">
                      {activo ? (
                        <span className="text-xs bg-teal-light text-teal border border-teal/20 px-2 py-0.5 rounded font-medium">Asignada ✓</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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