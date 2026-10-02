import assert from 'node:assert/strict';
import { safeDocumentUrl } from '../src/lib/safeDocumentUrl.js';
const base = 'https://taxeaportal.com/documentos';
assert.equal(safeDocumentUrl('https://media.base44.com/file.pdf', base), 'https://media.base44.com/file.pdf');
assert.equal(safeDocumentUrl('/archivo.pdf', base), 'https://taxeaportal.com/archivo.pdf');
assert.equal(safeDocumentUrl('javascript:alert(1)', base), '');
assert.equal(safeDocumentUrl('data:text/html,<script>alert(1)</script>', base), '');
assert.equal(safeDocumentUrl('file:///etc/passwd', base), '');
console.log('Documentos: solo URLs HTTP(S) llegan a enlaces, fetch o window.open.');
