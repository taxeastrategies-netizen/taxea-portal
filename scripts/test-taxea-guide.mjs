import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canAccessTaxModule } from '../src/lib/taxModuleAccess.mjs';
import { GUIDE_PATH, GUIDE_ARTICLES, GUIDE_SECTIONS, GUIDE_FEATURED, GUIDE_EXAMPLES, GUIDE_FAQ, guideHref, searchGuide } from '../src/lib/taxea-guide/guide-data.mjs';

const sidebar = readFileSync('src/components/layout/Sidebar.jsx', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');
const topbar = readFileSync('src/components/layout/TopBar.jsx', 'utf8');
const routes = new Set(GUIDE_ARTICLES.map(article => article.path));
const ids = new Set(GUIDE_ARTICLES.map(article => article.id));
assert.equal(ids.size, GUIDE_ARTICLES.length);
assert.equal(new Set(GUIDE_SECTIONS.map(section => section.id)).size, GUIDE_SECTIONS.length);

const expected = new Set(['/', '/notificaciones']);
const start = sidebar.indexOf('const TAX_MODULES');
const end = sidebar.indexOf('const ADMIN_ITEMS');
assert(start > 0 && end > start);
for (const line of sidebar.slice(start, end).split('\n')) {
  const [, key] = line.match(/(?:path|to|basePath): '(\/[^']+)'/) || [];
  if (!key || key === GUIDE_PATH || ['/tax-accounting', '/finance', '/people'].includes(key) || key.startsWith('/law') || /adminOnly: true/.test(line)) continue;
  const [, taxModule] = key.match(/^\/tax-accounting\/([^/]+)$/) || [];
  if (taxModule && !canAccessTaxModule(taxModule, 'user')) continue;
  expected.add(key);
}
assert.deepEqual([...routes].sort(), [...expected].sort(), 'all customer menu destinations plus notifications');
assert.match(sidebar, /\{ to: '\/ajustes'[^\n]+\n\s+\{ to: '\/guia-taxea-portal', label: 'Guía Taxea Portal'/);
assert.match(topbar, /'\/guia-taxea-portal': \['Guía Taxea Portal'\]/);
const protectedStart = app.indexOf('<Route element={<AppLayout');
const protectedEnd = app.indexOf('<Route path="*" element={<PageNotFound', protectedStart);
assert(protectedStart > 0 && protectedEnd > protectedStart);
assert(app.slice(protectedStart, protectedEnd).includes(`path="${GUIDE_PATH}" element={<GuiaTaxeaPortal />}`));
assert.equal(app.split(`path="${GUIDE_PATH}"`).length, 2, 'guide exists once and only in the authenticated layout');

for (const article of GUIDE_ARTICLES) {
  assert.match(article.id, /^[a-z][a-z0-9-]+$/);
  assert(article.title.length > 5 && article.summary.length > 20 && article.check.length > 20, article.id);
  assert(article.steps.length >= 2 && article.steps.every(step => step.length > 20), article.id);
  assert.equal(new URL(guideHref(article.id), 'https://test.invalid').searchParams.get('articulo'), article.id);
  const matchingRoute = [...app.matchAll(/<Route path="([^"]+)"/g)].some(([, path]) => path === article.path || (path.includes('/:') && article.path.startsWith(path.split('/:')[0] + '/') && article.path.split('/').length === path.split('/').length));
  assert(matchingRoute, `Destination registered: ${article.path}`);
}
for (const id of [...GUIDE_FEATURED, ...Object.keys(GUIDE_EXAMPLES), ...GUIDE_FAQ.map(([, , id]) => id)]) assert(ids.has(id), id);
for (const [query, id] of [['emitir factura', 'emitir-factura'], ['camara movil', 'ocr-gastos'], ['conciliación bancaria', 'conciliacion'], ['gmail', 'enviar-factura'], ['cpv', 'licitaciones'], ['pdf reordenar', 'kit-pdf'], ['eliminar cuenta', 'seguridad']]) {
  assert(searchGuide(query).slice(0, 5).some(a => a.id === id), `${query}: expected ${id}`);
}
assert.deepEqual(searchGuide('revisión'), searchGuide('revision'));
assert.equal(searchGuide('zzz999 sin resultados').length, 0);
assert.equal(searchGuide('').length, GUIDE_ARTICLES.length);
assert(searchGuide('', 'fiscalidad').every(a => a.section.id === 'fiscalidad'));
assert(!searchGuide('legal').some(a => a.path.startsWith('/law')));
console.log(`${GUIDE_SECTIONS.length} capítulos, ${GUIDE_ARTICLES.length} artículos, ${routes.size} destinos cliente; acceso, enlaces y búsqueda OK`);
