/**
 * Calcula automáticamente el Health Score (0-100) basado en métricas reales.
 * También devuelve los factores que afectan al score para mostrar el desglose.
 */
export function calcularHealthScore({ errors = [], tasks = [], obligations = [], invoices = [] }) {
  let score = 100;
  const motivos = [];

  // Errores críticos: -15 por cada uno (max -45)
  const criticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado));
  if (criticos.length > 0) {
    const penalizacion = Math.min(45, criticos.length * 15);
    score -= penalizacion;
    motivos.push(`${criticos.length} error${criticos.length > 1 ? 'es' : ''} crítico${criticos.length > 1 ? 's' : ''} sin resolver (-${penalizacion} pts)`);
  }

  // Errores de alta severidad: -5 por cada uno (max -20)
  const altos = errors.filter(e => e.severidad === 'alta' && !['resuelto', 'ignorado'].includes(e.estado));
  if (altos.length > 0) {
    const penalizacion = Math.min(20, altos.length * 5);
    score -= penalizacion;
    motivos.push(`${altos.length} error${altos.length > 1 ? 'es' : ''} de alta severidad (-${penalizacion} pts)`);
  }

  // Tareas vencidas: -5 por cada una (max -20)
  const vencidas = tasks.filter(t =>
    t.fecha_limite && new Date(t.fecha_limite) < new Date() && !['completada', 'cancelada'].includes(t.estado)
  );
  if (vencidas.length > 0) {
    const penalizacion = Math.min(20, vencidas.length * 5);
    score -= penalizacion;
    motivos.push(`${vencidas.length} tarea${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} (-${penalizacion} pts)`);
  }

  // Obligaciones fiscales vencidas: -10 por cada una (max -30)
  const oblVencidas = obligations.filter(o => {
    const limite = new Date(o.fecha_limite);
    return limite < new Date() && !['presentado', 'finalizado', 'domiciliado'].includes(o.estado);
  });
  if (oblVencidas.length > 0) {
    const penalizacion = Math.min(30, oblVencidas.length * 10);
    score -= penalizacion;
    motivos.push(`${oblVencidas.length} obligación${oblVencidas.length > 1 ? 'es' : ''} fiscal${oblVencidas.length > 1 ? 'es' : ''} vencida${oblVencidas.length > 1 ? 's' : ''} (-${penalizacion} pts)`);
  }

  // Facturas vencidas sin cobrar: -3 por cada una (max -15)
  const facVencidas = invoices.filter(i => i.estado_cobro === 'vencida');
  if (facVencidas.length > 0) {
    const penalizacion = Math.min(15, facVencidas.length * 3);
    score -= penalizacion;
    motivos.push(`${facVencidas.length} factura${facVencidas.length > 1 ? 's' : ''} vencida${facVencidas.length > 1 ? 's' : ''} sin cobrar (-${penalizacion} pts)`);
  }

  // Facturas sin documentación: -2 por cada una sin archivo (max -10)
  const sinDoc = invoices.filter(i => !i.archivo_url && i.tipo === 'emitida').length;
  if (sinDoc > 0) {
    const penalizacion = Math.min(10, sinDoc * 2);
    score -= penalizacion;
    motivos.push(`${sinDoc} factura${sinDoc > 1 ? 's' : ''} sin archivo adjunto (-${penalizacion} pts)`);
  }

  // Bonus si todo está al día
  if (criticos.length === 0 && altos.length === 0 && vencidas.length === 0 && oblVencidas.length === 0) {
    motivos.push('✓ Sin errores ni tareas vencidas');
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    motivos,
  };
}