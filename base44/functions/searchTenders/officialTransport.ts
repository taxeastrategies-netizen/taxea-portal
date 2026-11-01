const MAX_BYTES = 25_000_000;
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);
export async function fetchOfficialAtom(initialUrl: string, validate: (url: string) => string, { fetcher = fetch, timeoutMs = 18000, wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retry = false;
    try {
      let url = validate(initialUrl), response: Response | undefined;
      for (let redirect = 0; redirect <= 2; redirect++) {
        response = await fetcher(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/atom+xml, application/xml;q=0.9' } });
        if (![301,302,303,307,308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirect === 2) throw new Error('Redirección oficial inválida o excesiva.');
        url = validate(new URL(location, url).toString());
      }
      if (!response?.ok) {
        retry = TRANSIENT.has(response?.status || 0);
        throw new Error('La Plataforma devolvió ' + response?.status);
      }
      if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('Feed oficial demasiado grande');
      if (!response.body) throw new Error('Respuesta oficial vacía');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let size = 0, xml = '';
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Feed oficial demasiado grande'); }
          xml += decoder.decode(part.value, { stream: true });
        }
        xml += decoder.decode();
      } finally { reader.releaseLock(); }
      if (!xml.trim() || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Formato XML oficial no permitido');
      return xml;
    } catch (error) {
      lastError = error;
      retry = retry || controller.signal.aborted || error instanceof TypeError;
      if (!retry || attempt === 1) throw error;
    } finally { clearTimeout(timer); }
    await wait(300);
  }
  throw lastError || new Error('La fuente oficial no responde');
}
