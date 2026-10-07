// Read the complete OCR queue; do not silently show only the first SDK page.
export async function loadOcrDocuments(entity, query = {}) {
  const rows = new Map();
  const limit = 500;
  let lastId = '';
  for (let page = 0; page < 100; page++) {
    // The SDK supports skip. Range filters on the virtual id silently omit rows.
    const data = await entity.filter(query, 'id', limit, page * limit);
    if (!Array.isArray(data)) throw new Error('Respuesta OCR no válida; se mantiene la última información.');
    for (const row of data) rows.set(row.id, row);
    if (data.length < limit) return [...rows.values()].sort((a,b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')) || String(b.id).localeCompare(String(a.id)));
    const next = data[data.length - 1]?.id;
    if (!next || next === lastId) throw new Error('No se pudo completar la paginación OCR; vuelve a actualizar.');
    lastId = next;
  }
  throw new Error('La cola supera el límite de lectura completo. Filtra por cliente antes de continuar.');
}
