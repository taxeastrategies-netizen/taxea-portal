import { useState } from 'react';
import { FileText, ImageIcon } from 'lucide-react';

const selectedStyle = 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background';
const markerStyle = 'inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#9e1730] text-[11px] font-bold leading-none text-white';

function Marker({ number, active, notes, onSelect }) {
  if (!number) return null;
  if (!onSelect) return <span className={markerStyle}>{number}</span>;
  return <button
    type="button"
    aria-label={`Indicador ${number}. ${notes[number - 1].label}`}
    aria-pressed={active === number}
    onClick={() => onSelect(number)}
    className={`${markerStyle} relative outline-none before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active === number ? 'bg-[#641025]' : 'hover:bg-[#641025]'}`}
  >{number}</button>;
}

function ScreenBody({ screen, active, onSelect, compact }) {
  const renderMarker = number => <Marker number={number} active={active} notes={screen.notes} onSelect={onSelect} />;
  const isActive = number => number && number === active ? selectedStyle : '';
  const renderControls = (controls, className = '') => controls?.length > 0 && (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {controls.map(([label, number, variant]) => <div key={label} className={`flex min-h-8 max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs ${isActive(number)} ${variant === 'primary' ? 'border-[#9e1730] bg-[#9e1730] font-semibold text-white' : variant === 'active' ? 'border-primary/25 bg-primary/10 font-semibold text-foreground' : 'border-border bg-card text-muted-foreground'}`}>
        <span className="min-w-0 break-words">{label}</span>{renderMarker(number)}
      </div>)}
    </div>
  );

  const form = screen.fields && <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
    {screen.fields.map(([label, value, number]) => <div className={`min-w-0 rounded-lg border border-border bg-card p-2.5 ${isActive(number)}`} key={label}>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm font-medium"><span className="min-w-0 break-words">{value}</span>{renderMarker(number)}</div>
    </div>)}
  </div>;

  return <div className={`min-w-0 space-y-3 p-3 sm:p-4 ${compact ? 'sm:p-3' : ''}`}>
    {renderControls(screen.controls)}
    {renderControls(screen.filters, 'border-t border-border pt-3')}
    {screen.metrics && <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {screen.metrics.map(([label, value, number]) => <div className={`min-w-0 rounded-lg border border-border bg-card p-2.5 ${isActive(number)}`} key={label}>
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-sm font-bold sm:text-base"><span>{value}</span>{renderMarker(number)}</div>
      </div>)}
    </div>}
    {screen.columns && <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/70 text-muted-foreground"><tr>
          {screen.columns.map(label => <th className="px-2.5 py-2 font-semibold" key={label} scope="col">{label}</th>)}
          <th className="w-8 px-1.5" scope="col"><span className="sr-only">Indicador</span></th>
        </tr></thead>
        <tbody>{screen.rows.map(([values, number, variant], index) => <tr key={index} className={`border-t border-border ${variant === 'green' ? 'bg-[#DCFCE7] font-bold text-[#14532D]' : ''} ${active === number ? 'outline outline-2 -outline-offset-2 outline-primary/50' : ''}`}>
          {values.map((value, cell) => <td key={cell} className="px-2.5 py-2 align-middle">{value}</td>)}
          <td className="px-1.5 py-2">{renderMarker(number)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {screen.document ? <div className="grid min-w-0 gap-3 md:grid-cols-2">
      <div className={`min-w-0 rounded-lg border border-border bg-muted/60 p-3 ${isActive(screen.document[4])}`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground"><FileText aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{screen.document[0]}</span>{renderMarker(screen.document[4])}</div>
        <div className="mx-auto mt-3 max-w-64 rounded-sm border border-border bg-card p-3 text-xs shadow-sm sm:p-4">
          <p className="font-bold">{screen.document[1]}</p>
          <p className="mt-1 text-muted-foreground">{screen.document[2]}</p>
          <div aria-hidden="true" className="mt-3 space-y-1.5"><div className="h-1 w-full rounded bg-muted" /><div className="h-1 w-4/5 rounded bg-muted" /><div className="h-1 w-2/3 rounded bg-muted" /></div>
          <p className="mt-3 border-t border-border pt-2 text-right text-sm font-bold">{screen.document[3]}</p>
        </div>
      </div>
      {form}
    </div> : form}
    {screen.detail && <div className={`flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 ${isActive(screen.detail[2])}`}>
      <div className="min-w-0 flex-1 text-xs"><p className="font-bold">{screen.detail[0]}</p><p className="mt-1 text-muted-foreground">{screen.detail[1]}</p></div>{renderMarker(screen.detail[2])}
    </div>}
    {renderControls(screen.actions, 'justify-end')}
  </div>;
}

function ScreenFrame({ screen, active, onSelect, compact = false }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
    <div className={`flex items-center gap-2 bg-[#260e17] px-3 py-2.5 text-xs font-semibold text-white ${compact ? 'truncate' : ''}`}>
      <span aria-hidden="true" className="rounded border border-white/30 px-1.5 py-0.5 text-[9px] tracking-wider text-rose-100">{screen.layout === 'sheet' ? 'XLS' : 'TAXEA'}</span>
      <span className="min-w-0 break-words">{screen.title}</span>
    </div>
    <ScreenBody screen={screen} active={active} onSelect={onSelect} compact={compact} />
  </div>;
}

export function GuideScreenPreview({ screen }) {
  return <div aria-hidden="true" className="pointer-events-none mb-3 h-28 overflow-hidden rounded-xl border border-border bg-background">
    <div className="w-[165%] origin-top-left scale-[0.61]">
      <ScreenFrame screen={screen} compact />
    </div>
  </div>;
}

export default function GuideScreen({ screen }) {
  const [active, setActive] = useState(1);
  return <figure className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <figcaption className="mb-3">
      <h2 className="flex items-center gap-2 font-jakarta text-lg font-bold"><ImageIcon aria-hidden="true" className="h-5 w-5 text-primary" /> Qué verás en pantalla</h2>
      <p className="mt-1 text-sm text-muted-foreground">Vista ilustrada con datos ficticios. Selecciona un número para localizar el control.</p>
    </figcaption>
    <ScreenFrame screen={screen} active={active} onSelect={setActive} />
    <ol className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Explicación de los indicadores">
      {screen.notes.map(({ label, explanation }, index) => <li key={label} className="min-w-0">
        <button type="button" aria-pressed={active === index + 1} onClick={() => setActive(index + 1)} className={`flex h-full w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === index + 1 ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/60'}`}>
          <span aria-hidden="true" className={markerStyle}>{index + 1}</span>
          <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground sm:text-sm">{explanation}</span></span>
        </button>
      </li>)}
    </ol>
  </figure>;
}
