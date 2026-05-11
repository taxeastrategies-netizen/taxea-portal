import { useRef, useState, useCallback } from 'react';
import { Camera, RotateCcw, Check, Plus, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * MobileScanner — abre la cámara trasera directamente, permite
 * capturar múltiples páginas, previsualizar, rotar y confirmar.
 * Al confirmar, llama onCapture(files[]) con los archivos resultantes.
 */
export default function MobileScanner({ onCapture, onClose }) {
  const cameraInputRef = useRef();
  const [pages, setPages] = useState([]); // [{dataUrl, rotation}]
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState('capture'); // 'capture' | 'preview'

  const openCamera = () => cameraInputRef.current?.click();

  const handleCapture = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPages(prev => {
        const next = [...prev, { dataUrl, rotation: 0, file }];
        setCurrent(next.length - 1);
        return next;
      });
      setMode('preview');
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const rotateCurrent = () => {
    setPages(prev => prev.map((p, i) =>
      i === current ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    ));
  };

  const removeCurrent = () => {
    setPages(prev => {
      const next = prev.filter((_, i) => i !== current);
      setCurrent(Math.max(0, current - 1));
      if (next.length === 0) setMode('capture');
      return next;
    });
  };

  const addAnother = () => openCamera();

  const handleConfirm = () => {
    if (!pages.length) return;

    const promises = pages.map(({ dataUrl, rotation, file }) => {
      if (rotation === 0) return Promise.resolve(file);
      // Rotate via canvas
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const rad = (rotation * Math.PI) / 180;
          const swap = rotation === 90 || rotation === 270;
          canvas.width = swap ? img.height : img.width;
          canvas.height = swap ? img.width : img.height;
          const ctx = canvas.getContext('2d');
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(rad);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          canvas.toBlob(blob => {
            const rotFile = new File([blob], file.name, { type: file.type });
            resolve(rotFile);
          }, file.type);
        };
        img.src = dataUrl;
      });
    });

    Promise.all(promises).then(files => {
      onCapture(files);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 safe-area-top">
        <button onClick={onClose} className="text-white p-2 -ml-2">
          <X className="w-5 h-5" />
        </button>
        <span className="text-white font-semibold text-sm">
          {mode === 'capture' ? 'Escáner móvil' : `Página ${current + 1} de ${pages.length}`}
        </span>
        {mode === 'preview' && pages.length > 0 ? (
          <Button size="sm" className="bg-teal hover:bg-teal-dark h-8 text-sm gap-1" onClick={handleConfirm}>
            <Check className="w-4 h-4" /> Usar {pages.length > 1 ? `(${pages.length})` : ''}
          </Button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden relative">
        {mode === 'preview' && pages[current] ? (
          <>
            <img
              src={pages[current].dataUrl}
              alt={`Página ${current + 1}`}
              className="max-h-full max-w-full object-contain transition-transform duration-300"
              style={{ transform: `rotate(${pages[current].rotation}deg)` }}
            />
            {/* Navegación multipágina */}
            {pages.length > 1 && (
              <>
                <button
                  className={cn('absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2', current === 0 && 'opacity-30 pointer-events-none')}
                  onClick={() => setCurrent(c => c - 1)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className={cn('absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2', current === pages.length - 1 && 'opacity-30 pointer-events-none')}
                  onClick={() => setCurrent(c => c + 1)}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {/* Miniaturas */}
            {pages.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-4 pb-3 overflow-x-auto bg-gradient-to-t from-black/60">
                {pages.map((p, i) => (
                  <button key={i} onClick={() => setCurrent(i)}
                    className={cn('flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden', i === current ? 'border-teal-400' : 'border-transparent opacity-60')}>
                    <img src={p.dataUrl} className="w-full h-full object-cover" style={{ transform: `rotate(${p.rotation}deg)` }} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Estado inicial capture */
          <div className="text-center text-white">
            <div className="w-20 h-20 border-2 border-white/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera className="w-10 h-10 opacity-60" />
            </div>
            <p className="text-sm text-white/70">Pulsa el botón para fotografiar<br />tu factura o ticket</p>
          </div>
        )}
      </div>

      {/* Toolbar acciones */}
      <div className="bg-black/90 px-4 py-4 safe-area-bottom">
        {mode === 'preview' ? (
          <div className="flex items-center justify-between gap-3">
            <button onClick={rotateCurrent} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-xs">Rotar</span>
            </button>

            {/* Botón captura central */}
            <button onClick={addAnother} className="flex flex-col items-center gap-1 text-white">
              <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-teal/80 hover:bg-teal transition-colors">
                <Plus className="w-7 h-7" />
              </div>
              <span className="text-xs text-white/80">Añadir página</span>
            </button>

            <button onClick={removeCurrent} className="flex flex-col items-center gap-1 text-white/80 hover:text-red-400 transition-colors">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="text-xs">Eliminar</span>
            </button>
          </div>
        ) : (
          /* Botón captura principal */
          <div className="flex justify-center">
            <button onClick={openCamera} className="flex flex-col items-center gap-2 text-white">
              <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-teal/80 hover:bg-teal active:scale-95 transition-all">
                <Camera className="w-9 h-9" />
              </div>
              <span className="text-sm font-medium">Escanear documento</span>
            </button>
          </div>
        )}
      </div>

      {/* Input oculto cámara trasera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
    </div>
  );
}