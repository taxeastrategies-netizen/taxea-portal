import { useState } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ETIQUETAS_SUGERIDAS = [
  'IVA trimestral', 'IGIC', 'Renta', 'Sociedades', 'Intracomunitaria',
  'Autónomo', 'Subvención', 'Importación', 'Exento', 'Recargo equivalencia',
  'Operación especial', 'Retención IRPF', 'Régimen simplificado', 'Módulos',
];

const COLORES = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
];

function getTagColor(tag) {
  const idx = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length;
  return COLORES[idx];
}

export default function EtiquetasManager({ etiquetas = [], onChange, readOnly = false, className }) {
  const [input, setInput] = useState('');
  const [showSugg, setShowSugg] = useState(false);

  const add = (tag) => {
    const clean = tag.trim();
    if (!clean || etiquetas.includes(clean)) return;
    onChange([...etiquetas, clean]);
    setInput('');
    setShowSugg(false);
  };

  const remove = (tag) => {
    onChange(etiquetas.filter(t => t !== tag));
  };

  const suggestions = ETIQUETAS_SUGERIDAS.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !etiquetas.includes(s)
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5 min-h-8">
        {etiquetas.map(tag => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium",
              getTagColor(tag)
            )}
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
            {!readOnly && (
              <button onClick={() => remove(tag)} className="hover:opacity-70 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {etiquetas.length === 0 && readOnly && (
          <span className="text-xs text-muted-foreground italic">Sin etiquetas</span>
        )}
      </div>

      {!readOnly && (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => { setInput(e.target.value); setShowSugg(true); }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
              placeholder="Añadir etiqueta..."
              className="h-8 text-xs flex-1"
            />
            <button
              onClick={() => add(input)}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-md bg-secondary hover:bg-secondary/80 flex items-center justify-center disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showSugg && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-md overflow-hidden">
              {suggestions.slice(0, 6).map(s => (
                <button
                  key={s}
                  onMouseDown={() => add(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}