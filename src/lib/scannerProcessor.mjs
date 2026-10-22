import { detectDocument, processScannerPixels } from './documentScanner.mjs';

// One job in flight; keep only the latest pending edit, never a backlog of photos.
export function createScannerProcessor(workerFactory = () => new Worker(new URL('./documentScanner.worker.mjs', import.meta.url), { type: 'module' })) {
  let worker = null, closed = false, active = null, sequence = 0, timer;
  const queue = [];
  const problem = (message, code) => Object.assign(new Error(message), { code });
  const settle = (error, result) => {
    clearTimeout(timer); const job = active; active = null;
    if (job) { if (error) job.reject(error); else job.resolve(result); }
    pump();
  };
  try {
    worker = workerFactory();
    worker.onmessage = ({ data }) => { if (active?.id === data.id) settle(data.error ? problem(data.error, 'IMAGE_ERROR') : null, data.result); };
    worker.onerror = () => { worker?.terminate(); worker = null; settle(problem('El procesador de imagen se reinició. Vuelve a intentarlo.', 'WORKER_FAILED')); };
  } catch { worker = null; }
  function pump() {
    if (closed || active || !queue.length) return;
    active = queue.shift(); const job = active;
    if (!worker) {
      // Compatibility fallback, after yielding a paint to keep the feedback visible.
      timer = setTimeout(() => {
        if (closed || active?.id !== job.id) return;
        try { settle(null, job.kind === 'detect' ? detectDocument(job.payload.image, job.payload.options) : processScannerPixels(job.payload)); }
        catch (error) { settle(error); }
      }, 0);
      return;
    }
    timer = setTimeout(() => { worker?.terminate(); worker = null; settle(problem('La imagen tardó demasiado. Puedes reintentar o usar color natural.', 'WORKER_FAILED')); }, job.kind === 'detect' ? 8000 : 45000);
    try {
      const pixels = job.kind === 'detect' ? job.payload.image.data : job.payload.source.data;
      worker.postMessage({ id: job.id, kind: job.kind, payload: job.payload }, [pixels.buffer]);
    } catch (error) { settle(error); }
  }
  function request(kind, payload) {
    if (closed) return Promise.reject(problem('Escáner cerrado.', 'DISPOSED'));
    return new Promise((resolve, reject) => {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === kind) queue.splice(i, 1)[0].reject(problem('Se ha solicitado un ajuste más reciente.', 'SUPERSEDED'));
      const job = { id: ++sequence, kind, payload, resolve, reject };
      if (kind === 'process') queue.unshift(job); else queue.push(job);
      pump();
    });
  }
  return {
    get mode() { return worker ? 'worker' : 'compatibility'; },
    detect(image, options = {}) { return request('detect', { image: { data: image.data, width: image.width, height: image.height }, options }); },
    process(payload) { return request('process', payload); },
    dispose() {
      closed = true; clearTimeout(timer); worker?.terminate(); worker = null;
      const error = problem('Escáner cerrado.', 'DISPOSED'); active?.reject(error); active = null;
      queue.splice(0).forEach(job => job.reject(error));
    },
  };
}

