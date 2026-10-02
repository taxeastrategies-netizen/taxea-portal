import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/facturas/InvoiceViewer.jsx', import.meta.url), 'utf8');
assert.equal(source.includes('<title>${filename}</title>'), false);
assert.equal(source.includes('<title>Factura ${invoice.numero_factura}</title>'), false);
assert.equal((source.match(/<title>Factura<\/title>/g) || []).length, 2);
assert.match(source, /w\.document\.title = filename/);
assert.match(source, /w\.document\.title = `Factura \$\{invoice\.numero_factura\}`/);
console.log('Visor de facturas: el titulo no interpola HTML almacenado.');
