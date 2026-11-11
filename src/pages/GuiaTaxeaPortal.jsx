import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Calculator, ChevronRight,
  CircleHelp, Compass, FileText, ScanLine, Search, Settings, Target, Users, Wallet, Wrench, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GUIDE_ARTICLES, GUIDE_EXAMPLES, GUIDE_FAQ, GUIDE_FEATURED, GUIDE_SECTIONS,
  guideHref, searchGuide,
} from '@/lib/taxea-guide/guide-data.mjs';

const SECTION_ICONS = {
  inicio: Compass, fiscalidad: Calculator, finanzas: Wallet, oportunidades: Target,
  personas: Users, operativa: Wrench, cuenta: Settings,
};
const FEATURED_ICONS = { 'emitir-factura': FileText, 'ocr-gastos': ScanLine, conciliacion: Wallet, libros: BookOpen };
const RELATED = {
  'emitir-factura': ['enviar-factura', 'recurrentes', 'anular-factura'],
  'ocr-gastos': ['revisar-gastos', 'documentos', 'libros'],
  'revisar-gastos': ['ocr-gastos', 'libros', 'ayuda'],
  conciliacion: ['tesoreria', 'cuentas-cobrar', 'cuentas-pagar'],
  libros: ['revisar-gastos', 'obligaciones', 'analisis'],
  obligaciones: ['documentos', 'vencimientos', 'ajustes'],
};
const byId = Object.fromEntries(GUIDE_ARTICLES.map(item => [item.id, item]));
const sectionHref = id => id ? `${guideHref()}?seccion=${encodeURIComponent(id)}` : guideHref();
const focusStyle = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function GuideLink({ article, state }) {
  return <Link to={guideHref(article.id)} state={state} className={`group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 ${focusStyle}`}>
    <div className="min-w-0 flex-1">
      <span className="text-xs font-semibold text-muted-foreground">{article.section.title}</span>
      <span className="block font-semibold leading-snug group-hover:text-primary">{article.title}</span>
      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{article.summary}</span>
    </div>
    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
  </Link>;
}

function Example({ example }) {
  return <figure className="overflow-hidden rounded-2xl border border-border bg-card">
    <figcaption className="border-b border-border bg-muted/45 px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold text-primary">Ejemplo con datos ficticios</p>
      <h2 className="mt-1 font-jakarta text-lg font-semibold">{example.title}</h2>
    </figcaption>
    <ol className="divide-y divide-border">
      {example.rows.map(([label, sample, note], index) => <li key={label} className="flex gap-3 px-4 py-3 sm:px-5">
        <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
        <div className="min-w-0 break-words">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-semibold">{sample}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{note}</p>
        </div>
      </li>)}
    </ol>
  </figure>;
}

function ArticleView({ article, headingRef, state }) {
  const { section } = article;
  const index = section.articles.findIndex(item => item.id === article.id);
  const previous = section.articles[index - 1];
  const next = section.articles[index + 1];
  const example = GUIDE_EXAMPLES[article.id];
  const related = (RELATED[article.id] || []).map(id => byId[id]);

  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(210px,16.5rem)] xl:gap-7">
    <article className="min-w-0 space-y-5" aria-labelledby="guide-title">
      <nav aria-label="Ruta de la guía" className="flex min-h-11 flex-wrap items-center gap-x-2 text-sm">
        <Link to={guideHref()} state={state} className={`inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-primary ${focusStyle}`}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Índice de la guía</Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
        <Link to={sectionHref(section.id)} className={`inline-flex min-h-11 items-center rounded-md text-muted-foreground hover:text-foreground ${focusStyle}`}>{section.title}</Link>
      </nav>
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h1 id="guide-title" tabIndex={-1} ref={headingRef} className="font-jakarta text-2xl font-extrabold tracking-tight outline-none sm:text-4xl">{article.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{article.summary}</p>
        <Button asChild className="mt-5 min-h-11 w-full sm:w-auto">
          <Link to={article.path}>Abrir en Taxea <ArrowUpRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
        </Button>
      </header>
      {example && <Example example={example} />}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7" aria-labelledby="guide-steps">
        <h2 id="guide-steps" className="font-jakarta text-xl font-bold">Paso a paso</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-6 text-sm leading-relaxed marker:font-bold marker:text-primary sm:text-base">
          {article.steps.map(step => <li key={step} className="pl-1">{step}</li>)}
        </ol>
        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-bold">Qué comprobar</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{article.check}</p>
        </div>
      </section>
      {!!related.length && <section aria-labelledby="guide-related">
        <h2 id="guide-related" className="mb-3 font-jakarta text-lg font-bold">También te puede servir</h2>
        <div className="grid gap-2">{related.map(item => <GuideLink key={item.id} article={item} state={state} />)}</div>
      </section>}
      {(previous || next) && <nav aria-label="Anterior y siguiente" className="grid gap-2 sm:grid-cols-2">
        {[[previous, 'Anterior', ArrowLeft], [next, 'Siguiente', ArrowRight]].map(([item, label, Icon]) => item
          ? <Link key={label} to={guideHref(item.id)} state={state} className={`flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 ${focusStyle}`}>
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /><span><span className="block text-xs text-muted-foreground">{label}</span>{item.title}</span>
            </Link>
          : <span key={label} className="hidden sm:block" />)}
      </nav>}
    </article>
    <nav aria-label={`Artículos de ${section.title}`} className="h-fit rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-4">
      <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">En este capítulo</p>
      <ul className="space-y-1">
        {section.articles.map(item => <li key={item.id}>
          <Link to={guideHref(item.id)} state={state} aria-current={item.id === article.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-lg px-2.5 py-2 text-sm leading-snug ${item.id === article.id ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted'} ${focusStyle}`}>{item.title}</Link>
        </li>)}
      </ul>
    </nav>
  </div>;
}

export default function GuiaTaxeaPortal() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [query, setQuery] = useState(() => location.state?.guideQuery || '');
  const titleRef = useRef(null);
  const searchRef = useRef(null);
  const articleId = params.get('articulo') || '';
  const article = Object.hasOwn(byId, articleId) ? byId[articleId] : null;
  const section = GUIDE_SECTIONS.find(item => item.id === params.get('seccion'));
  const searching = Boolean(query.trim());
  const results = searching || section ? searchGuide(query, section?.id) : [];
  const linkState = query ? { guideQuery: query } : undefined;

  useLayoutEffect(() => {
    if (articleId || section) {
      titleRef.current?.closest('main')?.scrollTo({ top: 0, behavior: 'instant' });
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [articleId, section]);

  if (article) return <ArticleView article={article} headingRef={titleRef} state={linkState} />;

  return <section aria-labelledby="guide-title" className="min-w-0 space-y-7 pb-2">
    <header className="relative overflow-hidden rounded-3xl border border-rose-500/20 bg-[#240e15] px-5 py-7 text-white sm:px-9 sm:py-9" style={{ backgroundImage: 'radial-gradient(ellipse at 100% 0%, #812538 0%, transparent 55%), linear-gradient(120deg, #230e15, #3f1520)' }}>
      <div className="relative max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-200"><BookOpen aria-hidden="true" className="h-4 w-4" /> Centro de ayuda</p>
        <h1 id="guide-title" tabIndex={-1} ref={titleRef} className="mt-3 font-jakarta text-3xl font-extrabold tracking-tight outline-none sm:text-5xl">Guía Taxea Portal</h1>
        <p className="mt-3 text-sm leading-relaxed text-rose-100 sm:text-base">Aprende a usar el portal paso a paso. Busca una tarea o explora la guía por departamentos.</p>
        <label htmlFor="guide-search" className="sr-only">Buscar en la guía</label>
        <div className="mt-5 flex min-h-12 items-center gap-2 rounded-xl border border-white/30 bg-white px-3 text-slate-900 focus-within:ring-2 focus-within:ring-rose-300 sm:px-4">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-800" />
          <input id="guide-search" ref={searchRef} type="search" autoComplete="off" maxLength={160} value={query} onChange={event => setQuery(event.target.value)} placeholder="Ej.: escanear factura, conciliar, exportar Excel" className="min-h-12 min-w-0 flex-1 appearance-none bg-transparent text-base outline-none placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden" />
          {query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-700"><X aria-hidden="true" className="h-4 w-4" /></button>}
        </div>
      </div>
    </header>

    {articleId && <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm">Este artículo ya no está disponible en ese enlace. Puedes encontrarlo en el índice o con la búsqueda.</p>}

    {searching || section ? <section aria-labelledby="guide-results">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
        <h2 id="guide-results" className="font-jakarta text-xl font-bold">{section ? section.title : 'Resultados de búsqueda'}</h2>
        {section && <Link to={guideHref()} state={linkState} className={`inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary ${focusStyle}`}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Todos los capítulos</Link>}
      </div>
      <p role="status" className="mb-3 text-sm text-muted-foreground">{results.length} {results.length === 1 ? 'artículo' : 'artículos'}{searching ? ' encontrados' : ''}</p>
      {results.length ? <div className="grid gap-2 sm:grid-cols-2">{results.map(item => <GuideLink key={item.id} article={item} state={linkState} />)}</div>
        : <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">Prueba con otro término o busca el nombre de la herramienta, por ejemplo «OCR», «Gmail» o «Tesorería».</div>}
    </section> : <>
      <section aria-labelledby="guide-featured">
        <h2 id="guide-featured" className="mb-3 font-jakarta text-lg font-bold sm:text-xl">Tareas frecuentes</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {GUIDE_FEATURED.map(id => {
            const Icon = FEATURED_ICONS[id];
            return <Link to={guideHref(id)} key={id} className={`group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5 ${focusStyle}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1 leading-snug">{byId[id].title}</span><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>;
          })}
        </div>
      </section>
      <section aria-labelledby="guide-chapters">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="guide-chapters" className="font-jakarta text-lg font-bold sm:text-xl">Explora por departamento</h2>
          <span className="text-sm text-muted-foreground">{GUIDE_ARTICLES.length} artículos</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GUIDE_SECTIONS.map(item => {
            const Icon = SECTION_ICONS[item.id];
            return <Link to={sectionHref(item.id)} key={item.id} className={`group flex min-h-32 flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 ${focusStyle}`}>
              <div className="mb-2 flex items-center gap-3"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" /><h3 className="font-jakarta font-bold leading-tight">{item.title}</h3></div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              <span className="mt-2 flex items-center justify-between text-xs font-semibold text-primary">{item.articles.length} {item.articles.length === 1 ? 'artículo' : 'artículos'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
            </Link>;
          })}
        </div>
      </section>
      <section aria-labelledby="guide-faq" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 id="guide-faq" className="mb-2 flex items-center gap-2 font-jakarta text-lg font-bold"><CircleHelp aria-hidden="true" className="h-5 w-5 text-primary" /> Preguntas frecuentes</h2>
        <div className="divide-y divide-border">
          {GUIDE_FAQ.map(([question, answer, id]) => <details className="group" key={question}>
            <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden ${focusStyle}`}>
              <span className="flex-1">{question}</span><ArrowDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-180" />
            </summary>
            <p className="px-2 pb-1 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            <Link to={guideHref(id)} className={`inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary ${focusStyle}`}>Ver guía <span className="sr-only">: {byId[id].title}</span><ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
          </details>)}
        </div>
      </section>
    </>}
  </section>;
}
