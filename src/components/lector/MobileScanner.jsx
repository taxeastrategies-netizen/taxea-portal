import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RotateCw, Check, Plus, X, ChevronLeft, ChevronRight, Trash2, Crop, Loader2, ImagePlus, ScanLine, Flashlight, Sparkles, Maximize } from 'lucide-react';
import { canvasBlob, createDocumentTracker, defaultDocumentCorners, detectFromCanvas, imageCanvas, renderDocument, validDocumentCorners } from '@/lib/documentScanner.mjs';
import { createScannerProcessor } from '@/lib/scannerProcessor.mjs';

const MAX_PHOTOS = 20;
const CORNER_LABELS = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda'];
const FILTERS = [{ id: 'enhance', label: 'Mejora automática' }, { id: 'color', label: 'Color natural' }, { id: 'bw', label: 'Blanco y negro' }];
const cameraError = error => ({ NotAllowedError: 'No hay permiso para la cámara. Puedes usar la cámara del móvil o seleccionar una foto.', NotFoundError: 'No se ha encontrado una cámara. Puedes seleccionar una foto.', NotReadableError: 'La cámara está ocupada. Cierra la otra aplicación o usa la cámara del móvil.', SecurityError: 'Este navegador no permite acceder a la cámara aquí. Prueba desde Taxea en tu navegador.' }[error?.name] || 'No se pudo iniciar la cámara en directo. Usa la cámara del móvil o selecciona una foto.');

export default function MobileScanner({ onCapture, onClose }) {
  const inputRef = useRef(null), videoRef = useRef(null), stageRef = useRef(null), rootRef = useRef(null), streamRef = useRef(null), processorRef = useRef(null);
  const pagesRef = useRef([]), alive = useRef(true), captureLock = useRef(false), renderJob = useRef(0), urls = useRef(new Set()), autoSince = useRef(0);
  const [pages, setPages] = useState([]), [current, setCurrent] = useState(0), [mode, setMode] = useState('camera');
  const [cameraAttempt, setCameraAttempt] = useState(0), [cameraState, setCameraState] = useState('starting');
  const [tracking, setTracking] = useState({ detection: null, stable: false, held: false }), [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [stageSize, setStageSize] = useState({ width: 320, height: 460 }), [autoCapture, setAutoCapture] = useState(false), [torchAvailable, setTorchAvailable] = useState(false), [torch, setTorch] = useState(false);
  const [acquiring, setAcquiring] = useState(false), [rendering, setRendering] = useState(false), [sending, setSending] = useState(false), [dragCorner, setDragCorner] = useState(null);
  const [error, setError] = useState(''), [cropMode, setCropMode] = useState(false), [showOriginal, setShowOriginal] = useState(false);
  const selected = pages[current], { detection, stable, held } = tracking;
  const registerUrl = useCallback(blob => { const url = URL.createObjectURL(blob); urls.current.add(url); return url; }, []);
  const releaseUrl = useCallback(url => { if (url) { URL.revokeObjectURL(url); urls.current.delete(url); } }, []);
  const updatePages = useCallback(fn => { const next = fn(pagesRef.current); pagesRef.current = next; setPages(next); }, []);
  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; }, []);

  useEffect(() => {
    alive.current = true; processorRef.current = createScannerProcessor();
    const focusBefore = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; rootRef.current?.focus();
    return () => { alive.current = false; renderJob.current++; stopCamera(); processorRef.current?.dispose(); processorRef.current = null; document.body.style.overflow = overflow; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus(); };
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    if (mode !== 'camera') { stopCamera(); return; }
    setCameraState('starting'); setTracking({ detection: null, stable: false, held: false }); setTorch(false); setTorchAvailable(false); autoSince.current = 0;
    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCameraState('unavailable'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
        if (cancelled || !alive.current || document.hidden) { stream.getTracks().forEach(track => track.stop()); if (!cancelled && alive.current) setCameraState('paused'); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0], capabilities = track?.getCapabilities?.() || {}, advanced = {};
        if (capabilities.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
        if (capabilities.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
        if (capabilities.whiteBalanceMode?.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
        if (Object.keys(advanced).length) { try { await track.applyConstraints({ advanced: [advanced] }); } catch { /* Optional hardware capabilities vary by phone. */ } }
        if (cancelled || !alive.current || document.hidden) { stopCamera(); return; }
        const video = videoRef.current; if (!video) { stopCamera(); return; }
        video.srcObject = stream; await video.play(); if (cancelled) return;
        setVideoSize({ width: video.videoWidth, height: video.videoHeight }); setTorchAvailable(!!capabilities.torch); setCameraState('ready'); setError('');
      } catch (problem) { if (!cancelled && alive.current) { stopCamera(); setCameraState('unavailable'); setError(cameraError(problem)); } }
    };
    start();
    const suspend = () => { if (document.hidden) { stopCamera(); setCameraState('paused'); setTorch(false); autoSince.current = 0; } };
    document.addEventListener('visibilitychange', suspend);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', suspend); stopCamera(); };
  }, [mode, cameraAttempt, stopCamera]);

  useEffect(() => {
    if (!stageRef.current) return;
    const measure = () => { const box = stageRef.current?.getBoundingClientRect(); if (box) setStageSize({ width: box.width, height: box.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(stageRef.current); return () => observer.disconnect();
  }, [mode, cropMode]);

  useEffect(() => {
    if (cameraState !== 'ready' || mode !== 'camera') return;
    let cancelled = false, timer, last = null, dimension = 480;
    const tracker = createDocumentTracker();
    const inspect = async () => {
      const video = videoRef.current;
      if (cancelled || document.hidden || !video?.videoWidth || !streamRef.current) return;
      if (video.readyState < 2) { timer = window.setTimeout(inspect, 120); return; }
      const started = performance.now();
      try {
        const scale = dimension / Math.max(video.videoWidth, video.videoHeight), canvas = document.createElement('canvas'); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const found = await processorRef.current.detect(ctx.getImageData(0, 0, canvas.width, canvas.height), { previous: last?.corners });
        if (cancelled || !alive.current) return;
        const result = tracker.update(found); last = result.detection; setTracking(result);
        if (performance.now() - started > 330) dimension = 384;
      } catch { if (!cancelled && alive.current) { const result = tracker.update(null); setTracking(result); } }
      if (!cancelled) timer = window.setTimeout(inspect, Math.max(75, 245 - (performance.now() - started)));
    };
    inspect(); return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cameraState, mode]);

  const addPhoto = useCallback(async blob => {
    if (!blob || pagesRef.current.length >= MAX_PHOTOS) return;
    captureLock.current = true; setAcquiring(true); setError(''); autoSince.current = 0;
    try {
      const canvas = await imageCanvas(blob), found = await detectFromCanvas(canvas, processorRef.current, 720);
      if (!alive.current) return;
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const item = { id, source: blob, sourceUrl: registerUrl(blob), dimensions: { width: canvas.width, height: canvas.height }, corners: found?.corners || defaultDocumentCorners(), detected: !!found, quality: found?.quality, filter: 'enhance', strength: 70, rotation: 0, resultUrl: '', file: null };
      const nextIndex = pagesRef.current.length; updatePages(prev => [...prev, item]); setCurrent(nextIndex); setCropMode(!found); setShowOriginal(false); setDragCorner(null); setMode('preview');
    } catch (problem) { if (alive.current) setError(problem.message || 'No se pudo leer la foto.'); }
    finally { captureLock.current = false; if (alive.current) setAcquiring(false); }
  }, [registerUrl, updatePages]);

  const capture = useCallback(async () => {
    if (captureLock.current || cameraState !== 'ready') return;
    captureLock.current = true; setAcquiring(true);
    try {
      const video = videoRef.current; if (!video?.videoWidth) throw new Error('Espera a que la cámara esté lista.');
      let blob; const track = streamRef.current?.getVideoTracks()[0];
      if (track && typeof window.ImageCapture === 'function') { try { blob = await new window.ImageCapture(track).takePhoto(); } catch { /* Safari/WebViews use a high-resolution video snapshot. */ } }
      if (!blob) { const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); blob = await canvasBlob(canvas, .98); }
      if (alive.current) await addPhoto(blob);
    } catch (problem) { captureLock.current = false; if (alive.current) { setAcquiring(false); setError(problem.message || 'No se pudo tomar la foto.'); } }
  }, [cameraState, addPhoto]);

  useEffect(() => {
    const acceptable = autoCapture && mode === 'camera' && stable && !held && detection && detection.area > .16 && !detection.quality?.dark && !detection.quality?.blurry;
    if (!acceptable || acquiring) { autoSince.current = 0; return; }
    if (!autoSince.current) autoSince.current = performance.now();
    if (performance.now() - autoSince.current > 900) { autoSince.current = 0; capture(); }
  }, [autoCapture, mode, stable, held, detection, acquiring, capture]);

  useEffect(() => {
    if (!selected || mode !== 'preview') return;
    const request = ++renderJob.current, id = selected.id;
    setRendering(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const blob = await renderDocument(selected.source, selected.corners, selected.filter, selected.rotation, { strength: selected.strength, processor: processorRef.current });
        if (!alive.current || request !== renderJob.current) return;
        const url = registerUrl(blob), file = new File([blob], `Taxea_escaneo_${id.slice(0, 8)}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
        updatePages(prev => prev.map(p => { if (p.id !== id) return p; releaseUrl(p.resultUrl); return { ...p, resultUrl: url, file }; }));
      } catch (problem) { if (alive.current && request === renderJob.current && problem.code !== 'SUPERSEDED') setError(problem.message || 'No se pudo mejorar la imagen. Reintenta con Color natural.'); }
      finally { if (alive.current && request === renderJob.current) setRendering(false); }
    }, 220);
    return () => { renderJob.current++; window.clearTimeout(timer); };
  }, [selected?.id, selected?.corners, selected?.filter, selected?.strength, selected?.rotation, mode, registerUrl, releaseUrl, updatePages]);

  const changeSelected = patch => updatePages(prev => prev.map(p => p.id === selected?.id ? { ...p, ...patch, file: null } : p));
  const moveCorner = (index, x, y) => {
    const next = selected.corners.map((p, i) => i === index ? { x: Math.max(.001, Math.min(.999, x)), y: Math.max(.001, Math.min(.999, y)) } : p);
    if (validDocumentCorners(next)) changeSelected({ corners: next, detected: false });
  };
  const pointerCorner = (event, index) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = event.currentTarget.parentElement.getBoundingClientRect(); moveCorner(index, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  };
  const redetect = async () => {
    if (acquiring) return; setAcquiring(true); setError('');
    try { const source = await imageCanvas(selected.source), found = await detectFromCanvas(source, processorRef.current, 800); if (alive.current) { if (found) changeSelected({ corners: found.corners, detected: true, quality: found.quality }); else setError('No se distinguen los cuatro bordes con suficiente seguridad. Ajusta las esquinas o usa la foto completa.'); } }
    catch (problem) { if (alive.current) setError(problem.message); } finally { if (alive.current) setAcquiring(false); }
  };
  const toggleTorch = async () => {
    try { await streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(v => !v); }
    catch { setError('Este dispositivo no permite activar la linterna desde el navegador.'); }
  };
  const removeCurrent = () => {
    releaseUrl(selected?.sourceUrl); releaseUrl(selected?.resultUrl); updatePages(prev => prev.filter(p => p.id !== selected?.id)); setCurrent(index => Math.max(0, index - 1)); setDragCorner(null);
    if (pagesRef.current.length === 0) { setRendering(false); setMode('camera'); }
  };
  const confirm = async () => {
    if (sending || rendering || acquiring || pagesRef.current.some(p => !p.file)) return;
    setSending(true); setError(''); stopCamera();
    try { await onCapture(pagesRef.current.map(p => p.file)); if (alive.current) onClose(); }
    catch (problem) { if (alive.current) setError(problem.message || 'No se pudo añadir el escaneo. Puedes volver a intentarlo.'); }
    finally { if (alive.current) setSending(false); }
  };
  const startAgain = () => { setCropMode(false); setShowOriginal(false); setMode('camera'); setCameraAttempt(n => n + 1); };
  const fit = (aspect, margin = 0) => { const width = Math.min(Math.max(1, stageSize.width - margin), Math.max(1, stageSize.height - margin) * aspect); return { width, height: width / aspect }; };
  const liveFrame = fit(videoSize.width / videoSize.height), cropFrame = fit(selected ? selected.dimensions.width / selected.dimensions.height : 1, 48);
  const focusTrap = event => {
    if (event.key === 'Escape' && !sending) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...rootRef.current.querySelectorAll('button:not([disabled]), input:not([type="file"]):not([disabled]), [tabindex="0"]')].filter(node => node.getClientRects().length), first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const liveHint = held ? 'Volviendo a localizar los bordes…' : !detection ? 'Muestra los cuatro bordes. Evita reflejos y separa el papel del fondo.' : detection.quality?.dark ? 'Falta luz. Enciende la linterna o busca una zona más iluminada.' : detection.area < .16 ? 'Acerca el móvil al documento para conservar el texto pequeño.' : detection.quality?.blurry ? 'Revisa el enfoque y mantén el móvil quieto.' : stable ? autoCapture ? 'Documento estable. Captura automática en un instante…' : 'Cuatro bordes detectados. Listo para capturar.' : 'Documento detectado. Mantén el móvil quieto.';

  return createPortal(<div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="scanner-title" tabIndex={-1} onKeyDown={focusTrap} onClick={event => event.stopPropagation()} onDrop={event => { event.preventDefault(); event.stopPropagation(); }} className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-slate-950 text-white outline-none" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
      <button type="button" aria-label="Cerrar escáner" disabled={sending} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"><X className="h-5 w-5" /></button>
      <div className="min-w-0 text-center"><h2 id="scanner-title" className="text-sm font-semibold">Escáner inteligente</h2><p className="text-xs text-slate-400">{mode === 'camera' ? 'Bordes · enfoque · luz' : `Foto ${current + 1} de ${pages.length}`}</p></div>
      {pages.length > 0 ? <button type="button" onClick={confirm} disabled={rendering || acquiring || sending || pages.some(p => !p.file)} className="flex min-h-11 items-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-semibold disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Usar{pages.length > 1 ? ` (${pages.length})` : ''}</button> : <span className="w-11" />}
    </header>
    {error && <p role="alert" className="shrink-0 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">{error}</p>}
    <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {mode === 'camera' ? <>
        <div className="relative" style={liveFrame}>
          <video ref={videoRef} autoPlay muted playsInline aria-label="Vista en directo de la cámara" className="h-full w-full object-contain" />
          {cameraState === 'ready' && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">{detection ? <>
            <path d={`M0,0H1000V1000H0Z M${detection.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join('L')}Z`} fill="rgba(0,0,0,.38)" fillRule="evenodd" />
            <polygon points={detection.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill={stable ? 'rgba(56,189,248,.09)' : 'rgba(59,130,246,.05)'} stroke={held ? '#93c5fd' : stable ? '#38bdf8' : '#3b82f6'} strokeWidth={stable ? 3.5 : 2.5} strokeDasharray={held ? '8 6' : undefined} vectorEffect="non-scaling-stroke" />
            {detection.corners.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="7" fill="#3b82f6" stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
          </> : <rect x="100" y="80" width="800" height="840" rx="12" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="14 10" vectorEffect="non-scaling-stroke" />}</svg>}
        </div>
        {cameraState !== 'ready' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">{cameraState === 'starting' ? <Loader2 className="h-9 w-9 animate-spin text-blue-400" /> : <Camera className="h-12 w-12 text-blue-400" />}<p className="max-w-sm text-sm text-slate-200">{cameraState === 'starting' ? 'Abriendo la cámara…' : cameraState === 'paused' ? 'Cámara en pausa' : 'Puedes escanear usando la cámara del móvil o una foto guardada.'}</p>{cameraState !== 'starting' && <button type="button" onClick={() => setCameraAttempt(n => n + 1)} className="min-h-11 rounded-xl border border-white/30 px-4 text-sm">Activar cámara en directo</button>}</div>}
        {cameraState === 'ready' && <p role="status" className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/75 px-3 py-2 text-center text-xs text-white">{!detection && <span className="block font-semibold text-blue-300">Guía de encuadre · buscando documento</span>}{liveHint}</p>}
      </> : selected && <>
        {cropMode ? <div className="relative" style={cropFrame}>
          <img src={selected.sourceUrl} alt="Foto original para ajustar el recorte" className="block h-full w-full object-fill" />
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path d={`M0,0H1000V1000H0Z M${selected.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join('L')}Z`} fill="rgba(0,0,0,.4)" fillRule="evenodd" /><polygon points={selected.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="rgba(59,130,246,.07)" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
          {selected.corners.map((point, index) => <button key={index} type="button" disabled={acquiring || sending} aria-label={`Esquina ${CORNER_LABELS[index]}. Arrastra o usa las flechas para ajustar.`} className="absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full focus:ring-2 focus:ring-white" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragCorner(index); }} onPointerMove={event => pointerCorner(event, index)} onPointerCancel={() => setDragCorner(null)} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragCorner(null); }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); moveCorner(index, point.x + (event.key === 'ArrowLeft' ? -.003 : event.key === 'ArrowRight' ? .003 : 0), point.y + (event.key === 'ArrowUp' ? -.003 : event.key === 'ArrowDown' ? .003 : 0)); } }}><span className="h-5 w-5 rounded-full border-2 border-white bg-blue-500 shadow-lg" /></button>)}
        </div> : <img src={showOriginal ? selected.sourceUrl : selected.resultUrl || selected.sourceUrl} alt={showOriginal ? 'Foto original' : 'Documento recortado y mejorado'} className="max-h-full max-w-full object-contain p-3" />}
        {cropMode && dragCorner !== null && <div aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-[120px] w-[120px] rounded-2xl border-2 border-blue-400 bg-black shadow-xl" style={{ backgroundImage: `url(${selected.sourceUrl})`, backgroundRepeat: 'no-repeat', backgroundSize: `${cropFrame.width * 3}px ${cropFrame.height * 3}px`, backgroundPosition: `${60 - selected.corners[dragCorner].x * cropFrame.width * 3}px ${60 - selected.corners[dragCorner].y * cropFrame.height * 3}px` }}><span className="absolute inset-0 flex items-center justify-center text-xl text-blue-500">+</span></div>}
        {rendering && !cropMode && <span role="status" className="absolute bottom-3 flex items-center gap-2 rounded-xl bg-black/75 px-3 py-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Corrigiendo sombras y detalle…</span>}
      </>}
      {acquiring && <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/65"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm">Localizando los cuatro bordes…</span></div>}
    </div>
    {mode === 'preview' && selected && <div className="shrink-0 space-y-1 border-t border-white/10 px-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-1">{FILTERS.map(filter => <button key={filter.id} type="button" disabled={acquiring || sending} aria-pressed={selected.filter === filter.id} onClick={() => { changeSelected({ filter: filter.id }); setShowOriginal(false); }} className={`min-h-11 rounded-xl px-3 text-xs ${selected.filter === filter.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200'}`}>{filter.label}</button>)}</div>
      {!cropMode && selected.filter !== 'color' && <label className="mx-auto flex max-w-md items-center gap-3 px-2 text-[11px] text-slate-300">Intensidad<input aria-label="Intensidad de mejora" type="range" min="0" max="100" step="5" value={selected.strength} disabled={acquiring || sending} onChange={event => changeSelected({ strength: Number(event.target.value) })} className="h-7 min-w-0 flex-1 accent-blue-500" /><span className="w-8 text-right">{selected.strength}%</span></label>}
      {cropMode ? <div className="flex items-center justify-center gap-2"><button type="button" disabled={acquiring || sending} onClick={redetect} className="flex min-h-10 items-center gap-1 rounded-xl bg-white/10 px-3 text-xs"><ScanLine className="h-4 w-4" />Detectar bordes</button><button type="button" disabled={acquiring || sending} onClick={() => changeSelected({ corners: defaultDocumentCorners(), detected: false })} className="flex min-h-10 items-center gap-1 rounded-xl bg-white/10 px-3 text-xs"><Maximize className="h-4 w-4" />Foto completa</button></div> : <p className="text-center text-[11px] text-slate-300">{selected.quality?.dark ? 'La foto está oscura: revisa que se lean todos los importes.' : 'Revisa texto pequeño, importes y bordes antes de usar el escaneo.'}</p>}
      <div className="flex items-center justify-between gap-1">
        <button type="button" aria-label="Foto anterior" disabled={current === 0 || rendering || acquiring || sending} onClick={() => { setCurrent(n => n - 1); setShowOriginal(false); setDragCorner(null); }} className="h-11 w-11 shrink-0 rounded-xl disabled:opacity-25"><ChevronLeft className="mx-auto h-5 w-5" /></button>
        <button type="button" disabled={acquiring || sending} onClick={() => { setCropMode(v => !v); setShowOriginal(false); setDragCorner(null); }} className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs"><Crop className="h-4 w-4" />{cropMode ? 'Ver resultado' : 'Recortar'}</button>
        <button type="button" disabled={cropMode || acquiring || sending} aria-pressed={showOriginal} onClick={() => setShowOriginal(v => !v)} className="min-h-11 rounded-xl px-2 text-xs disabled:opacity-30">{showOriginal ? 'Resultado' : 'Ver original'}</button>
        <button type="button" aria-label="Rotar foto" disabled={rendering || cropMode || acquiring || sending} onClick={() => changeSelected({ rotation: (selected.rotation + 90) % 360 })} className="h-11 w-11 shrink-0 rounded-xl disabled:opacity-30"><RotateCw className="mx-auto h-5 w-5" /></button>
        <button type="button" aria-label="Eliminar esta foto" disabled={sending || acquiring} onClick={removeCurrent} className="h-11 w-11 shrink-0 rounded-xl text-red-300"><Trash2 className="mx-auto h-5 w-5" /></button>
        <button type="button" aria-label="Foto siguiente" disabled={current >= pages.length - 1 || rendering || acquiring || sending} onClick={() => { setCurrent(n => n + 1); setShowOriginal(false); setDragCorner(null); }} className="h-11 w-11 shrink-0 rounded-xl disabled:opacity-25"><ChevronRight className="mx-auto h-5 w-5" /></button>
      </div>
    </div>}
    <footer className="shrink-0 border-t border-white/10 px-4 py-2">
      {mode === 'camera' && <div className="mb-2 flex items-center justify-center gap-3"><button type="button" aria-pressed={autoCapture} onClick={() => setAutoCapture(v => !v)} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs ${autoCapture ? 'bg-blue-600' : 'bg-white/10'}`}><Sparkles className="h-4 w-4" />Captura automática: {autoCapture ? 'sí' : 'no'}</button>{torchAvailable && <button type="button" aria-label="Linterna" aria-pressed={torch} onClick={toggleTorch} className={`flex h-10 w-10 items-center justify-center rounded-xl ${torch ? 'bg-amber-500 text-black' : 'bg-white/10'}`}><Flashlight className="h-5 w-5" /></button>}</div>}
      <div className="flex items-center justify-center gap-5">
        <button type="button" disabled={acquiring || sending || rendering || pages.length >= MAX_PHOTOS} onClick={() => inputRef.current?.click()} className="flex min-h-11 max-w-32 items-center gap-2 text-left text-xs text-slate-200 disabled:opacity-30"><ImagePlus className="h-5 w-5 shrink-0" />Cámara del móvil / foto</button>
        {mode === 'camera' ? <button type="button" aria-label="Capturar documento" disabled={cameraState !== 'ready' || acquiring || pages.length >= MAX_PHOTOS} onClick={capture} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-blue-600 disabled:opacity-30"><Camera className="h-7 w-7" /></button> : <button type="button" disabled={acquiring || sending || rendering || pages.length >= MAX_PHOTOS} onClick={startAgain} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm disabled:opacity-30"><Plus className="h-5 w-5" />Añadir foto</button>}
        {mode === 'camera' && pages.length > 0 && <button type="button" onClick={() => setMode('preview')} className="flex min-h-11 items-center gap-1 text-xs"><ScanLine className="h-5 w-5" />Ver {pages.length}</button>}
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-400">Cada foto es un documento independiente · Hasta {MAX_PHOTOS} por tanda</p>
    </footer>
    <input ref={inputRef} type="file" accept="image/*" capture="environment" disabled={acquiring || sending} className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { stopCamera(); setCameraState('paused'); addPhoto(file); } }} />
  </div>, document.body);
}

