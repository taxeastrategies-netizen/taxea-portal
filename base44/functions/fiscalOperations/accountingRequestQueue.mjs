// Request-scoped only: no shared tenant cache, no credentials, no automatic replay of writes.
export function queuedAccountingClient(service, { intervalMs = 350, readRetries = 2,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  let tail = Promise.resolve(), previousStart = -Infinity;
  const schedule = task => {
    const next = tail.then(async () => {
      const remaining = intervalMs - (now() - previousStart);
      if (remaining > 0) await sleep(remaining);
      previousStart = now();
      return task();
    });
    tail = next.then(() => undefined, () => undefined);
    return next;
  };
  const entities = new Map();
  return { ...service, entities: new Proxy({}, { get(_target, name) {
    if (entities.has(name)) return entities.get(name);
    const entity = service.entities[name];
    const wrapped = new Proxy(entity, { get(target, method) {
      if (typeof target[method] !== 'function') return target[method];
      return async (...args) => {
        const canRetry = ['get', 'filter', 'list'].includes(String(method));
        for (let attempt = 0; ; attempt++) {
          try { return await schedule(() => target[method](...args)); }
          catch (error) {
            const status = Number(error?.response?.status || error?.status);
            const limited = status === 429 || /rate limit exceeded/i.test(String(error?.message || ''));
            if (!canRetry || !limited || attempt >= readRetries) throw error;
            await sleep(2000 * (attempt + 1));
          }
        }
      };
    } });
    entities.set(name, wrapped);
    return wrapped;
  } }) };
}
