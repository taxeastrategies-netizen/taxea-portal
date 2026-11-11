import { start, tax } from './guide-core.mjs';
import { finance, opportunities } from './guide-finance.mjs';
import { people, operations, account } from './guide-operations.mjs';

export const GUIDE_PATH = '/guia-taxea-portal';
export const GUIDE_SECTIONS = [start, tax, finance, opportunities, people, operations, account];
export const GUIDE_ARTICLES = GUIDE_SECTIONS.flatMap(section => section.articles.map(article => ({ ...article, section })));
export const GUIDE_FEATURED = ['emitir-factura', 'ocr-gastos', 'excel-novedades', 'conciliacion'];

export const GUIDE_FAQ = [
  ['He subido una factura, ¿por qué no la veo en Facturas?', 'En el OCR, localízala en Pendientes, En revisión o Procesados. En el listado de Facturas, comprueba si buscas una emitida o recibida y limpia filtros de año y estado.', 'revisar-gastos'],
  ['¿Qué diferencia hay entre cobrado y conciliado?', 'Cobrado indica que se registró el cobro. Conciliado indica que un apunte bancario quedó relacionado con el documento. Comprueba si ya existe un cobro antes de volver a registrarlo.', 'conciliacion'],
  ['¿Dónde veo los impuestos que ha preparado mi asesor?', 'En Calendario y obligaciones → Documentos fiscales encontrarás los documentos vinculados al perfil. Consulta también la ficha de la obligación y la carpeta correspondiente de Documentos.', 'obligaciones'],
  ['¿Por qué no encuentro un apartado?', 'Comprueba la empresa activa, tu suscripción y los permisos de tu perfil. En móvil, abre el menú principal para ver los apartados que no están en la barra inferior.', 'empezar'],
];

export { GUIDE_SCREENS as GUIDE_EXAMPLES } from './guide-screens.mjs';

export function guideHref(articleId) {
  return articleId ? `${GUIDE_PATH}?articulo=${encodeURIComponent(articleId)}` : GUIDE_PATH;
}

export function normalizeGuideText(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const INDEX = GUIDE_ARTICLES.map(article => ({
  article,
  title: normalizeGuideText(article.title),
  keywords: normalizeGuideText(article.keywords),
  body: normalizeGuideText([article.section.title, article.summary, ...article.steps, article.check].join(' ')),
}));

export function searchGuide(query, sectionId = '') {
  const normalized = normalizeGuideText(query);
  const tokens = [...new Set(normalized.split(' ').filter(Boolean))];
  return INDEX.filter(({ article }) => !sectionId || article.section.id === sectionId)
    .map(({ article, title, keywords, body }, index) => ({ article, index,
      score: tokens.every(token => title.includes(token) || keywords.includes(token) || body.includes(token))
        ? (normalized && title.includes(normalized) ? 16 : 0) + tokens.reduce((acc, token) => acc + (title.includes(token) ? 8 : keywords.includes(token) ? 4 : 1), 0)
        : -1,
    }))
    .filter(row => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(row => row.article);
}
