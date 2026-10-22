import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RotateCw, Check, Plus, X, ChevronLeft, ChevronRight, Trash2, Crop, Loader2, ImagePlus, ScanLine } from 'lucide-react';
import { canvasBlob, defaultDocumentCorners, detectDocument, detectionFromCanvas, imageCanvas, renderDocument, validDocumentCorners } from '@/lib/documentScanner.mjs';

const MAX_PHOTOS = 20;
const CORNER_LABELS = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda'];
const FILTERS = [{ id: 'enhance', label: 'Mejora automática' }, { id: 'color', label: 'Color natural' }, { id: 'bw', label: 'Blanco y negro' }];
const cameraError = error => ({ NotAllowedError: 'No hay permiso para la cámara. Puedes usar la cámara del móvil o seleccionar una foto.', NotFoundError: 'No se ha encontrado una cámara. Puedes seleccionar una foto.', NotReadableError: 'La cámara está ocupada. Cierra la otra aplicación o usa la cámara del móvil.', SecurityError: 'Este navegador no permite acceder a la cámara aquí. Prueba desde Taxea en tu navegador.' }[error?.name] || 'No se pudo iniciar la cámara en directo. Usa la cámara del móvil o selecciona una foto.');

export default function MobileScanner({ onCapture, onClose }) {
  const inputRef = useRef(null), videoRef = useRef(null), stageRef = useRef(null), rootRef = useRef(null), streamRef = useRef(null);
  const pagesRef = useRef([]), alive = useRef(true), captureLock = useRef(false), renderJob = useRef(0), urls = useRef(new Set());
  const [pages, setPages] = useState([]), [current, setCurrent] = useState(0), [mode, setMode] = useState('camera');
  const [cameraAttempt, setCameraAttempt] = useState(0), [cameraState, setCameraState] = useState('starting');
  const [detection, setDetection] = useState(null), [stable, setStable] = useState(false), [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [stageSize, setStageSize] = useState({ width: 320, height: 460 });
  const [acquiring, setAcquiring] = useState(false), [rendering, setRendering] = useState(false), [sending, setSending] = useState(false);
  const [error, setError] = useState(''), [cropMode, setCropMode] = useState(false), [showOriginal, setShowOriginal] = useState(false);
  const selected = pages[current];
  const registerUrl = useCallback(blob => { const url = URL.createObjectURL(blob); urls.current.add(url); return url; }, []);
  const releaseUrl = useCallback(url => { if (url) { URL.revokeObjectURL(url); urls.current.delete(url); } }, []);
  const updatePages = useCallback(fn => { const next = fn(pagesRef.current); pagesRef.current = next; setPages(next); }, []);
  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; }, []);

  useEffect(() => {
    alive.current = true;
    const focusBefore = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; rootRef.current?.focus();
    return () => { alive.current = false; renderJob.current++; stopCamera(); document.body.style.overflow = overflow; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus(); };
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    if (mode !== 'camera') { stopCamera(); return; }
    setCameraState('starting'); setDetection(null); setStable(false);
    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCameraState('unavailable'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
        if (cancelled || !alive.current || document.hidden) { stream.getTracks().forEach(track => track.stop()); if (!cancelled && alive.current) setCameraState('paused'); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stopCamera(); return; }
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setVideoSize({ width: video.videoWidth, height: video.videoHeight }); setCameraState('ready'); setError('');
      } catch (problem) { if (!cancelled && alive.current) { stopCamera(); setCameraState('unavailable'); setError(cameraError(problem)); } }
    };
    start();
    const suspend = () => { if (document.hidden) { stopCamera(); setCameraState('paused'); } };
    document.addEventListener('visibilitychange', suspend);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', suspend); stopCamera(); };
  }, [mode, cameraAttempt, stopCamera]);

  useEffect(() => {
    if (!stageRef.current) return;
    const measure = () => { const box = stageRef.current?.getBoundingClientRect(); if (box) setStageSize({ width: box.width, height: box.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [mode, cropMode]);

  useEffect(() => {
    if (cameraState !== 'ready' || mode !== 'camera') return;
    let cancelled = false, timer, previous = null, steady = 0;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    const inspect = () => {
      const video = videoRef.current;
      if (cancelled || document.hidden || !video?.videoWidth || video.readyState < 2 || !streamRef.current) return;
      try {
        const scale = 384 / Math.max(video.videoWidth, video.videoHeight); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const found = detectDocument(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const delta = found && previous ? Math.max(...found.corners.map((p, i) => Math.hypot(p.x - previous.corners[i].x, p.y - previous.corners[i].y))) : 1;
        steady = found && delta < .025 ? steady + 1 : 0;
        if (found && previous && delta < .08) found.corners = found.corners.map((p, i) => ({ x: p.x * .55 + previous.corners[i].x * .45, y: p.y * .55 + previous.corners[i].y * .45 }));
        previous = found; setDetection(found); setStable(steady >= 2);
      } catch { previous = null; setDetection(null); setStable(false); }
      if (!cancelled) timer = window.setTimeout(inspect, 330);
    };
    inspect(); return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cameraState, mode]);

  const addPhoto = async blob => {
    if (!blob || pagesRef.current.length >= MAX_PHOTOS) return;
    setAcquiring(true); setError('');
    try {
      const canvas = await imageCanvas(blob), found = detectionFromCanvas(canvas);
      if (!alive.current) return;
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const item = { id, source: blob, sourceUrl: registerUrl(blob), corners: found?.corners || defaultDocumentCorners(), detected: !!found, filter: 'enhance', rotation: 0, resultUrl: '', file: null };
      const nextIndex = pagesRef.current.length; updatePages(prev => [...prev, item]); setCurrent(nextIndex); setCropMode(!found); setShowOriginal(false); setMode('preview');
    } catch (problem) { if (alive.current) setError(problem.message || 'No se pudo leer la foto.'); }
    finally { captureLock.current = false; if (alive.current) setAcquiring(false); }
  };

  const capture = async () => {
    if (captureLock.current || cameraState !== 'ready') return;
    captureLock.current = true; setAcquiring(true);
    try {
      const video = videoRef.current;
      if (!video?.videoWidth) throw new Error('Espera a que la cámara esté lista.');
      let blob;
      const track = streamRef.current?.getVideoTracks()[0];
      if (track && typeof window.ImageCapture === 'function') { try { blob = await new window.ImageCapture(track).takePhoto(); } catch { /* Video snapshot is supported by Safari and WebViews. */ } }
      if (!blob) { const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); blob = await canvasBlob(canvas, .97); }
      if (alive.current) await addPhoto(blob);
    } catch (problem) { captureLock.current = false; if (alive.current) { setAcquiring(false); setError(problem.message || 'No se pudo tomar la foto.'); } }
  };

  useEffect(() => {
    if (!selected || mode !== 'preview') return;
    const request = ++renderJob.current, id = selected.id, corners = selected.corners;
    setRendering(true); setError('');
    // Debounce corner dragging; rendering never starts a network/OCR request.
    const timer = window.setTimeout(async () => {
      try {
        const blob = await renderDocument(selected.source, corners, selected.filter, selected.rotation);
        if (!alive.current || request !== renderJob.current) return;
        const url = registerUrl(blob), file = new File([blob], `Taxea_escaneo_${id.slice(0, 8)}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
        updatePages(prev => prev.map(p => { if (p.id !== id) return p; releaseUrl(p.resultUrl); return { ...p, resultUrl: url, file }; }));
      } catch (problem) { if (alive.current && request === renderJob.current) setError(problem.message || 'No se pudo mejorar la imagen. Ajusta el recorte o usa Color natural.'); }
      finally { if (alive.current && request === renderJob.current) setRendering(false); }
    }, 160);
    return () => { renderJob.current++; window.clearTimeout(timer); };
  }, [selected?.id, selected?.corners, selected?.filter, selected?.rotation, mode, registerUrl, releaseUrl, updatePages]);

  const changeSelected = patch => updatePages(prev => prev.map(p => p.id === selected?.id ? { ...p, ...patch, file: null } : p));
  const moveCorner = (index, x, y) => {
    const next = selected.corners.map((p, i) => i === index ? { x: Math.max(.002, Math.min(.998, x)), y: Math.max(.002, Math.min(.998, y)) } : p);
    if (validDocumentCorners(next)) changeSelected({ corners: next, detected: false });
  };
  const pointerCorner = (event, index) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = event.currentTarget.parentElement.getBoundingClientRect(); moveCorner(index, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  };
  const removeCurrent = () => {
    releaseUrl(selected?.sourceUrl); releaseUrl(selected?.resultUrl);
    updatePages(prev => prev.filter(p => p.id !== selected?.id)); setCurrent(index => Math.max(0, index - 1));
    if (pagesRef.current.length === 0) setMode('camera');
  };
  const confirm = async () => {
    if (sending || rendering || acquiring || pagesRef.current.some(p => !p.file)) return;
    setSending(true); setError(''); stopCamera();
    try { await onCapture(pagesRef.current.map(p => p.file)); if (alive.current) onClose(); }
    catch (problem) { if (alive.current) setError(problem.message || 'No se pudo añadir el escaneo. Puedes volver a intentarlo.'); }
    finally { if (alive.current) setSending(false); }
  };
  const startAgain = () => { setCropMode(false); setShowOriginal(false); setMode('camera'); setCameraAttempt(n => n + 1); };
  const aspect = (mode === 'camera' ? videoSize.width / videoSize.height : 1);
  const frameWidth = Math.min(stageSize.width, stageSize.height * aspect), frameHeight = frameWidth / aspect;
  const focusTrap = event => {
    if (event.key === 'Escape' && !sending) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...rootRef.current.querySelectorAll('button:not([disabled]), input:not([type="file"]):not([disabled]), [tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return createPortal(<div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="scanner-title" tabIndex={-1} onKeyDown={focusTrap} onClick={event => event.stopPropagation()} onDrop={event => { event.preventDefault(); event.stopPropagation(); }} className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-slate-950 text-white outline-none" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
      <button type="button" aria-label="Cerrar escáner" disabled={sending} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"><X className="h-5 w-5" /></button>
      <div className="min-w-0 text-center"><h2 id="scanner-title" className="text-sm font-semibold">Escáner de documentos</h2><p className="text-xs text-slate-400">{mode === 'camera' ? 'Encuadra la factura o el ticket' : `Foto ${current + 1} de ${pages.length}`}</p></div>
      {pages.length > 0 ? <button type="button" onClick={confirm} disabled={rendering || acquiring || sending || pages.some(p => !p.file)} className="flex min-h-11 items-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-semibold disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Usar{pages.length > 1 ? ` (${pages.length})` : ''}</button> : <span className="w-11" />}
    </header>
    {error && <p role="alert" className="shrink-0 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">{error}</p>}
    <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {mode === 'camera' ? <>
        <div className="relative" style={{ width: frameWidth, height: frameHeight }}>
          <video ref={videoRef} autoPlay muted playsInline aria-label="Vista en directo de la cámara" className="h-full w-full object-contain" />
          {cameraState === 'ready' && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">{detection ? <polygon points={detection.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="rgba(59,130,246,.12)" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : <rect x="90" y="70" width="820" height="860" rx="12" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="14 10" vectorEffect="non-scaling-stroke" />}</svg>}
        </div>
        {cameraState !== 'ready' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">{cameraState === 'starting' ? <Loader2 className="h-9 w-9 animate-spin text-blue-400" /> : <Camera className="h-12 w-12 text-blue-400" />}<p className="max-w-sm text-sm text-slate-200">{cameraState === 'starting' ? 'Abriendo la cámara…' : cameraState === 'paused' ? 'Cámara en pausa' : 'Puedes escanear usando la cámara del móvil o una foto guardada.'}</p>{cameraState !== 'starting' && <button type="button" onClick={() => setCameraAttempt(n => n + 1)} className="min-h-11 rounded-xl border border-white/30 px-4 text-sm">Activar cámara en directo</button>}</div>}
        {cameraState === 'ready' && <p role="status" className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 px-3 py-2 text-center text-xs text-white">{detection ? stable ? 'Documento detectado. Listo para capturar.' : 'Documento detectado. Mantén el móvil quieto.' : 'Guía de encuadre: muestra los cuatro bordes sobre un fondo de contraste.'}</p>}
      </> : selected && <>
        <div className="relative flex h-full w-full items-center justify-center p-4">
          {cropMode ? <div className="relative max-h-full max-w-full" style={{ aspectRatio: selected.dimensions ? selected.dimensions.width / selected.dimensions.height : undefined }}>
            <img src={selected.sourceUrl} alt="Foto original para ajustar el recorte" className="block max-h-[calc(100dvh-300px)] max-w-full object-contain" onLoad={event => { const img = event.currentTarget; if (!selected.dimensions) updatePages(prev => prev.map(p => p.id === selected.id ? { ...p, dimensions: { width: img.naturalWidth, height: img.naturalHeight } } : p)); }} />
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none"><polygon points={selected.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="rgba(59,130,246,.12)" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
            {selected.corners.map((point, index) => <button key={index} type="button" aria-label={`Esquina ${CORNER_LABELS[index]}. Arrastra o usa las flechas para ajustar.`} className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full focus:ring-2 focus:ring-white" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => pointerCorner(event, index)} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); moveCorner(index, point.x + (event.key === 'ArrowLeft' ? -.005 : event.key === 'ArrowRight' ? .005 : 0), point.y + (event.key === 'ArrowUp' ? -.005 : event.key === 'ArrowDown' ? .005 : 0)); } }}><span className="h-5 w-5 rounded-full border-2 border-white bg-blue-500 shadow-lg" /></button>)}
          </div> : <img src={showOriginal ? selected.sourceUrl : selected.resultUrl || selected.sourceUrl} alt={showOriginal ? 'Foto original' : 'Documento recortado y mejorado'} className="max-h-full max-w-full object-contain" />}
        </div>
        {rendering && !cropMode && <span role="status" className="absolute bottom-3 flex items-center gap-2 rounded-xl bg-black/70 px-3 py-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Mejorando legibilidad…</span>}
      </>}
      {acquiring && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="h-9 w-9 animate-spin" /><span className="sr-only">Preparando foto</span></div>}
    </div>
    {mode === 'preview' && selected && <div className="shrink-0 space-y-2 border-t border-white/10 px-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-1">{FILTERS.map(filter => <button key={filter.id} type="button" aria-pressed={selected.filter === filter.id} onClick={() => { changeSelected({ filter: filter.id }); setShowOriginal(false); }} className={`min-h-11 rounded-xl px-3 text-xs ${selected.filter === filter.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200'}`}>{filter.label}</button>)}</div>
      <p className="text-center text-[11px] text-slate-300">{cropMode ? 'Arrastra las cuatro esquinas. Revisa que no falte texto.' : 'Revisa los importes y el texto antes de usar el escaneo.'}</p>
      <div className="flex items-center justify-between gap-1">
        <button type="button" aria-label="Foto anterior" disabled={current === 0} onClick={() => { setCurrent(n => n - 1); setShowOriginal(false); }} className="h-11 w-11 rounded-xl disabled:opacity-25"><ChevronLeft className="mx-auto h-5 w-5" /></button>
        <button type="button" onClick={() => { setCropMode(v => !v); setShowOriginal(false); }} className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs"><Crop className="h-4 w-4" />{cropMode ? 'Ver resultado' : 'Recortar'}</button>
        <button type="button" disabled={cropMode} aria-pressed={showOriginal} onClick={() => setShowOriginal(v => !v)} className="min-h-11 rounded-xl px-2 text-xs disabled:opacity-30">{showOriginal ? 'Resultado' : 'Ver original'}</button>
        <button type="button" aria-label="Rotar foto" disabled={rendering || cropMode} onClick={() => changeSelected({ rotation: (selected.rotation + 90) % 360 })} className="h-11 w-11 rounded-xl disabled:opacity-30"><RotateCw className="mx-auto h-5 w-5" /></button>
        <button type="button" aria-label="Eliminar esta foto" disabled={sending} onClick={removeCurrent} className="h-11 w-11 rounded-xl text-red-300"><Trash2 className="mx-auto h-5 w-5" /></button>
        <button type="button" aria-label="Foto siguiente" disabled={current >= pages.length - 1} onClick={() => { setCurrent(n => n + 1); setShowOriginal(false); }} className="h-11 w-11 rounded-xl disabled:opacity-25"><ChevronRight className="mx-auto h-5 w-5" /></button>
      </div>
    </div>}
    <footer className="shrink-0 border-t border-white/10 px-4 py-3">
      <div className="flex items-center justify-center gap-5">
        <button type="button" disabled={acquiring || sending || pages.length >= MAX_PHOTOS} onClick={() => inputRef.current?.click()} className="flex min-h-11 max-w-32 items-center gap-2 text-left text-xs text-slate-200 disabled:opacity-30"><ImagePlus className="h-5 w-5 shrink-0" />Cámara del móvil / foto</button>
        {mode === 'camera' ? <button type="button" aria-label="Capturar documento" disabled={cameraState !== 'ready' || acquiring || pages.length >= MAX_PHOTOS} onClick={capture} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-blue-600 disabled:opacity-30"><Camera className="h-7 w-7" /></button> : <button type="button" disabled={acquiring || sending || rendering || pages.length >= MAX_PHOTOS} onClick={startAgain} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm disabled:opacity-30"><Plus className="h-5 w-5" />Añadir foto</button>}
        {mode === 'camera' && pages.length > 0 && <button type="button" onClick={() => setMode('preview')} className="flex min-h-11 items-center gap-1 text-xs"><ScanLine className="h-5 w-5" />Ver {pages.length}</button>}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">Cada foto se añade como documento independiente · Hasta {MAX_PHOTOS} por tanda</p>
    </footer>
    <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { stopCamera(); setCameraState('paused'); addPhoto(file); } }} />
  </div>, document.body);
}

