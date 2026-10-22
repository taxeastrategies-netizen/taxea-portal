import { detectDocument, processScannerPixels } from './documentScanner.mjs';

self.onmessage = ({ data: { id, kind, payload } }) => {
  try {
    const result = kind === 'detect' ? detectDocument(payload.image, payload.options) : processScannerPixels(payload);
    if (kind === 'process') self.postMessage({ id, result }, [result.data.buffer]);
    else self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error: error.message || 'No se pudo analizar la imagen.' }); }
};

