/** Normalize only text responses. Structured JSON keeps its requested schema. */
export function limitedTextResult(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.result === 'string') return value.result;
    if (typeof value.text === 'string') return value.text;
  }
  throw new Error('La respuesta de IA no contiene texto válido. Vuelve a intentarlo.');
}
