// Local-only scanner. No image, camera frame or diagnostic leaves this module.
const clamp = (n, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const defaultDocumentCorners = () => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
export function polygonArea(q) {
  return Math.abs(q.reduce((sum, a, i) => { const b = q[(i + 1) % q.length]; return sum + a.x * b.y - b.x * a.y; }, 0)) / 2;
}
export function validDocumentCorners(q) {
  if (!Array.isArray(q) || q.length !== 4 || q.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  return polygonArea(q) > .025 && q.every((a, i) => {
    const b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    return distance(a, b) > .025 && (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > .0001;
  });
}
function orderedQuad(q) {
  const center = q.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
  q = [...q].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const first = q.reduce((best, p, i) => p.x + p.y < q[best].x + q[best].y ? i : best, 0);
  return q.slice(first).concat(q.slice(0, first));
}
function hull(points) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = list => { const out = []; for (const p of list) { while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); } return out; };
  const lower = half(points), upper = half([...points].reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function quadFromHull(points) {
  const q = hull(points);
  while (q.length > 12) {
    let smallest = Infinity, remove = 0;
    q.forEach((p, i) => { const area = polygonArea([q[(i + q.length - 1) % q.length], p, q[(i + 1) % q.length]]); if (area < smallest) { smallest = area; remove = i; } });
    q.splice(remove, 1);
  }
  if (q.length < 4) return null;
  let best = null, area = 0;
  for (let a = 0; a < q.length - 3; a++) for (let b = a + 1; b < q.length - 2; b++) for (let c = b + 1; c < q.length - 1; c++) for (let d = c + 1; d < q.length; d++) {
    const candidate = [q[a], q[b], q[c], q[d]], value = polygonArea(candidate); if (value > area) { area = value; best = candidate; }
  }
  return best ? orderedQuad(best) : null;
}
function quantile(hist, fraction, total = hist.reduce((a, b) => a + b, 0)) {
  let sum = 0; for (let i = 0; i < hist.length; i++) { sum += hist[i]; if (sum >= total * fraction) return i; } return hist.length - 1;
}
function otsu(hist) {
  const total = hist.reduce((a, b) => a + b, 0), sum = hist.reduce((a, b, i) => a + i * b, 0);
  let count = 0, lower = 0, best = 0, result = 160;
  for (let i = 0; i < 255; i++) { count += hist[i]; lower += i * hist[i]; if (!count || count === total) continue; const d = lower / count - (sum - lower) / (total - count), score = count * (total - count) * d * d; if (score > best) { best = score; result = i; } }
  return result;
}
function blur3(input, width, height) {
  const temp = new Float32Array(input.length), out = new Float32Array(input.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; temp[p] = (input[y * width + Math.max(0, x - 1)] + 2 * input[p] + input[y * width + Math.min(width - 1, x + 1)]) / 4; }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; out[p] = (temp[Math.max(0, y - 1) * width + x] + 2 * temp[p] + temp[Math.min(height - 1, y + 1) * width + x]) / 4; }
  return out;
}
function prepareEdges(image) {
  const { data, width: w, height: h } = image, n = w * h, hist = new Uint32Array(256), lum = new Float32Array(n), chroma = new Float32Array(n);
  for (let p = 0; p < n; p++) { const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2]; lum[p] = .299 * r + .587 * g + .114 * b; chroma[p] = Math.max(r, g, b) - Math.min(r, g, b); hist[Math.round(lum[p])]++; }
  const gray = blur3(lum, w, h), color = blur3(chroma, w, h), mag = new Float32Array(n), gx = new Float32Array(n), gy = new Float32Array(n), gh = new Uint32Array(1024);
  const a = [0, 0], b = [0, 0];
  const sobel = (source, p, out) => { out[0] = -source[p - w - 1] + source[p - w + 1] - 2 * source[p - 1] + 2 * source[p + 1] - source[p + w - 1] + source[p + w + 1]; out[1] = -source[p - w - 1] - 2 * source[p - w] - source[p - w + 1] + source[p + w - 1] + 2 * source[p + w] + source[p + w + 1]; };
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const p = y * w + x; sobel(gray, p, a); sobel(color, p, b);
    const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], use = b2 * .64 > a2 ? b : a;
    gx[p] = use[0]; gy[p] = use[1]; mag[p] = Math.sqrt(use === b ? b2 : a2); if (mag[p] > 4) gh[Math.min(1023, Math.round(mag[p]))]++;
  }
  // Adaptive Canny: suppress grain and text noise without requiring a white sheet.
  const high = clamp(quantile(gh, .76), 18, 180), low = high * .38, weak = new Uint8Array(n), edge = new Uint8Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const p = y * w + x, value = mag[p]; if (value < low) continue;
    const ax = Math.abs(gx[p]), ay = Math.abs(gy[p]);
    const d = ay < ax * .4142 ? 1 : ax < ay * .4142 ? w : gx[p] * gy[p] > 0 ? w + 1 : w - 1;
    if (value < mag[p - d] || value < mag[p + d]) continue;
    weak[p] = 1; if (value >= high) { edge[p] = 1; queue[tail++] = p; }
  }
  while (head < tail) { const p = queue[head++]; for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) { const t = p + d; if (weak[t] && !edge[t]) { edge[t] = 1; queue[tail++] = t; } } }
  return { gray, lum, chroma, hist, mag, gx, gy, edge, high, width: w, height: h };
}
function morphology(mask, w, h, dilate) {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x; let value = dilate ? 0 : 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) value = dilate ? value | mask[p + dy * w + dx] : value & mask[p + dy * w + dx];
    out[p] = value;
  }
  return out;
}
function componentQuads(mask, w, h, visit) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length), neighbours = [-w, -1, 1, w];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 1; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      for (let k = 0; k < 4; k++) {
        if (k === 0 && y === 0 || k === 1 && x === 0 || k === 2 && x === w - 1 || k === 3 && y === h - 1) continue;
        const t = p + neighbours[k]; if (mask[t] && !seen[t]) { seen[t] = 1; queue[tail++] = t; }
      }
    }
    if (tail < Math.min(w, h) * .9) continue;
    let points = [];
    for (let i = 0; i < tail; i++) { const p = queue[i], x = p % w, y = Math.floor(p / w); if (x > 1 && x < w - 2 && y > 1 && y < h - 2 && (!mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w])) points.push({ x, y }); }
    if (points.length > 5000) { const step = Math.ceil(points.length / 5000); points = points.filter((_, i) => i % step === 0); }
    if (points.length > 10) { const q = quadFromHull(points); if (q) visit(q); }
  }
}
function intersect(a, b) {
  const det = a.nx * b.ny - b.nx * a.ny; if (Math.abs(det) < .15) return null;
  return { x: (a.c * b.ny - b.c * a.ny) / det, y: (a.nx * b.c - b.nx * a.c) / det };
}
function houghQuads(f, visit) {
  const { width: w, height: h, edge, gx, gy, mag } = f, diag = Math.ceil(Math.hypot(w, h)), bins = 60, rhoCount = 2 * diag + 1;
  const votes = new Float32Array(bins * rhoCount), cos = new Float32Array(bins), sin = new Float32Array(bins);
  for (let i = 0; i < bins; i++) { cos[i] = Math.cos(i * Math.PI / bins); sin[i] = Math.sin(i * Math.PI / bins); }
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    const p = y * w + x; if (!edge[p]) continue;
    let angle = Math.atan2(gy[p], gx[p]); if (angle < 0) angle += Math.PI; if (angle >= Math.PI) angle -= Math.PI;
    const at = Math.round(angle * bins / Math.PI), weight = Math.min(2, mag[p] / Math.max(25, f.high));
    for (let d = -3; d <= 3; d++) { const t = (at + d + bins) % bins, r = Math.round(x * cos[t] + y * sin[t]) + diag; votes[t * rhoCount + r] += weight * (1 - .1 * Math.abs(d)); }
  }
  const peaks = [];
  for (let t = 0; t < bins; t++) for (let r = 2; r < rhoCount - 2; r++) {
    const v = votes[t * rhoCount + r]; if (v < Math.min(w, h) * .12) continue;
    if (v >= votes[t * rhoCount + r - 1] && v >= votes[t * rhoCount + r + 1]) peaks.push({ nx: cos[t], ny: sin[t], c: r - diag, v });
  }
  peaks.sort((a, b) => b.v - a.v);
  const lines = [];
  for (const line of peaks) {
    if (lines.some(a => Math.abs(a.nx * line.nx + a.ny * line.ny) > .985 && Math.abs(a.c - Math.sign(a.nx * line.nx + a.ny * line.ny) * line.c) < 8)) continue;
    lines.push(line); if (lines.length >= 22) break;
  }
  const pairs = [];
  for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
    const l = lines[a], r = lines[b], dot = l.nx * r.nx + l.ny * r.ny;
    if (Math.abs(dot) < .72 || Math.abs(l.c - Math.sign(dot) * r.c) < Math.min(w, h) * .13) continue;
    pairs.push({ a, b });
  }
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const a = pairs[i], b = pairs[j]; if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
    if (Math.abs(lines[a.a].nx * lines[b.a].nx + lines[a.a].ny * lines[b.a].ny) > .72) continue;
    const raw = [intersect(lines[a.a], lines[b.a]), intersect(lines[a.b], lines[b.a]), intersect(lines[a.b], lines[b.b]), intersect(lines[a.a], lines[b.b])];
    if (raw.some(p => !p || p.x < 2 || p.y < 2 || p.x >= w - 2 || p.y >= h - 2)) continue;
    visit(orderedQuad(raw));
  }
}
function edgeEvidence(raw, f) {
  const { width: w, height: h, gray, gx, gy, mag } = f, supports = [], contrasts = [], strengths = [];
  for (let side = 0; side < 4; side++) {
    const a = raw[side], b = raw[(side + 1) % 4], length = distance(a, b), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    let covered = 0, visible = 0, polarity = 0, contrast = 0, strength = 0;
    for (let s = 1; s < 38; s++) {
      const x = a.x + (b.x - a.x) * s / 38, y = a.y + (b.y - a.y) * s / 38; let best = 0;
      for (let offset = -2; offset <= 2; offset++) {
        const xx = Math.round(x + nx * offset), yy = Math.round(y + ny * offset); if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
        const p = yy * w + xx, aligned = Math.abs(gx[p] * nx + gy[p] * ny); if (aligned / Math.max(1, mag[p]) > .72) best = Math.max(best, aligned);
      }
      const ix = Math.round(x + nx * 4), iy = Math.round(y + ny * 4), ox = Math.round(x - nx * 4), oy = Math.round(y - ny * 4);
      if (Math.min(ix, ox) < 0 || Math.max(ix, ox) >= w || Math.min(iy, oy) < 0 || Math.max(iy, oy) >= h) continue;
      visible++; const lightDelta = gray[iy * w + ix] - gray[oy * w + ox], colourDelta = (f.chroma[iy * w + ix] - f.chroma[oy * w + ox]) * .7;
      const delta = Math.abs(lightDelta) > Math.abs(colourDelta) ? lightDelta : colourDelta;
      contrast += Math.abs(delta); polarity += delta > 3 ? 1 : delta < -3 ? -1 : 0;
      if (best > Math.max(10, f.high * .22)) covered++;
      strength += Math.min(1, best / 85);
    }
    supports.push(covered / Math.max(1, visible)); contrasts.push(contrast / Math.max(1, visible)); strengths.push(strength / Math.max(1, visible));
    // Interior page text alone cannot masquerade as a complete outer page border.
    if (visible < 20 || covered / visible < .48 || contrast / visible < 3.5 || Math.abs(polarity) / visible < .25) return null;
  }
  return { support: supports.reduce((a, b) => a + b) / 4, weakest: Math.min(...supports), contrast: contrasts.reduce((a, b) => a + b) / 4, strength: strengths.reduce((a, b) => a + b) / 4 };
}
function refineQuad(raw, f) {
  const { width: w, height: h, gx, gy, mag } = f, fitted = [];
  for (let i = 0; i < 4; i++) {
    const a = raw[i], b = raw[(i + 1) % 4], length = distance(a, b), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length, points = [];
    for (let s = 2; s < 48; s++) {
      const x = a.x + (b.x - a.x) * s / 50, y = a.y + (b.y - a.y) * s / 50; let best = 0, point;
      for (let d = -5; d <= 5; d++) {
        const xx = Math.round(x + nx * d), yy = Math.round(y + ny * d); if (xx < 2 || yy < 2 || xx >= w - 2 || yy >= h - 2) continue;
        const p = yy * w + xx, alignment = Math.abs(gx[p] * nx + gy[p] * ny), score = alignment * (1 - Math.abs(d) * .06);
        if (alignment / Math.max(1, mag[p]) > .8 && score > best) { best = score; point = { x: xx, y: yy, weight: Math.min(3, score / 35) }; }
      }
      if (point && best > Math.max(10, f.high * .22)) points.push(point);
    }
    if (points.length < 20) return raw;
    // Robust parallel-line fit: reject text/shadow outliers before total least squares.
    const offsets = points.map(p => p.x * nx + p.y * ny).sort((a, b) => a - b), median = offsets[Math.floor(offsets.length / 2)];
    const use = points.filter(p => Math.abs(p.x * nx + p.y * ny - median) < 3.5);
    let total = 0, mx = 0, my = 0; for (const p of use) { total += p.weight; mx += p.x * p.weight; my += p.y * p.weight; } mx /= total; my /= total;
    let xx = 0, xy = 0, yy = 0; for (const p of use) { xx += p.weight * (p.x - mx) ** 2; xy += p.weight * (p.x - mx) * (p.y - my); yy += p.weight * (p.y - my) ** 2; }
    const angle = .5 * Math.atan2(2 * xy, xx - yy), fx = -Math.sin(angle), fy = Math.cos(angle);
    fitted.push({ nx: fx, ny: fy, c: fx * mx + fy * my });
  }
  const q = fitted.map((line, i) => intersect(fitted[(i + 3) % 4], line));
  return q.some(p => !p || p.x < 1 || p.y < 1 || p.x >= w - 1 || p.y >= h - 1) ? raw : q;
}
export function detectDocument(image, options = {}) {
  const { width: w, height: h, data } = image;
  if (w < 32 || h < 32 || data.length !== w * h * 4) return null;
  const f = prepareEdges(image), candidates = [], seen = new Set();
  const consider = raw => {
    const q = raw.map(p => ({ x: p.x / (w - 1), y: p.y / (h - 1) })), area = polygonArea(q);
    if (!validDocumentCorners(q) || area < .065 || area > .95) return;
    for (let i = 0; i < 4; i++) { const a = raw[(i + 3) % 4], b = raw[i], c = raw[(i + 1) % 4], cosine = ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (distance(a, b) * distance(c, b)); if (Math.abs(cosine) > .8) return; }
    const key = q.map(p => `${Math.round(p.x * 40)},${Math.round(p.y * 40)}`).join(':'); if (seen.has(key)) return; seen.add(key);
    const evidence = edgeEvidence(raw, f); if (!evidence) return;
    const confidence = evidence.support * .42 + evidence.weakest * .22 + Math.min(1, evidence.contrast / 28) * .2 + evidence.strength * .16;
    if (confidence < .61) return;
    let continuity = 0;
    if (options.previous?.length === 4) continuity = Math.max(0, 1 - Math.max(...q.map((p, i) => distance(p, options.previous[i]))) / .12);
    let neutral = 0, ink = 0; const light = [], samples = [];
    const map = perspectiveMap(raw);
    for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) { const p = map(x / 10, y / 10), at = Math.round(p.y) * w + Math.round(p.x); samples.push(at); light.push(f.gray[at]); if (f.chroma[at] < 30) neutral++; }
    light.sort((a, b) => a - b); const paperTone = light[Math.floor(light.length * .75)];
    for (const p of samples) if (f.gray[p] < paperTone * .72) ink++;
    const paperScore = neutral / 64 * .65 + Math.min(1, ink / 5) * .35;
    const rank = confidence * .53 + Math.min(.78, area) * .23 + paperScore * .15 + continuity * .08;
    candidates.push({ raw, corners: q, area, confidence, rank });
  };
  const edgeJoined = morphology(f.edge, w, h, true);
  componentQuads(edgeJoined, w, h, consider);
  // Multi-exposure masks, plus neutral-paper separation on coloured surfaces.
  const levels = [...new Set([otsu(f.hist), quantile(f.hist, .45), quantile(f.hist, .7), (quantile(f.hist, .18) + quantile(f.hist, .88)) / 2].map(v => Math.round(v)))];
  for (const level of levels) {
    const mask = new Uint8Array(w * h); for (let p = 0; p < mask.length; p++) mask[p] = f.gray[p] > level ? 1 : 0;
    componentQuads(morphology(morphology(mask, w, h, true), w, h, false), w, h, consider);
  }
  const neutral = new Uint8Array(w * h); for (let p = 0; p < neutral.length; p++) neutral[p] = f.chroma[p] < 27 && f.gray[p] > 65 ? 1 : 0;
  componentQuads(morphology(morphology(neutral, w, h, true), w, h, false), w, h, consider);
  houghQuads(f, consider);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.rank - a.rank);
  const best = candidates[0], refined = refineQuad(best.raw, f);
  // Expand about one analysis pixel to retain edge-adjacent invoice text.
  const center = refined.reduce((a, b) => ({ x: a.x + b.x / 4, y: a.y + b.y / 4 }), { x: 0, y: 0 });
  const corners = refined.map(p => { const d = distance(p, center); return { x: clamp((p.x + (p.x - center.x) / d * .8) / (w - 1), 0, 1), y: clamp((p.y + (p.y - center.y) / d * .8) / (h - 1), 0, 1) }; });
  return { ...best, raw: undefined, corners: validDocumentCorners(corners) ? corners : best.corners, quality: imageQuality(image, best.corners) };
}
export function imageQuality({ data, width: w, height: h }, corners) {
  const hist = new Uint32Array(256); let count = 0, sharp = 0, sharpCount = 0;
  const sample = p => .299 * data[p * 4] + .587 * data[p * 4 + 1] + .114 * data[p * 4 + 2];
  const q = corners || defaultDocumentCorners(), left = Math.max(2, Math.floor(Math.min(...q.map(p => p.x)) * w)), right = Math.min(w - 2, Math.ceil(Math.max(...q.map(p => p.x)) * w)), top = Math.max(2, Math.floor(Math.min(...q.map(p => p.y)) * h)), bottom = Math.min(h - 2, Math.ceil(Math.max(...q.map(p => p.y)) * h));
  for (let y = top; y < bottom; y += 2) for (let x = left; x < right; x += 2) {
    const p = y * w + x, lum = sample(p); hist[Math.round(lum)]++; count++;
    const lap = Math.abs(4 * lum - sample(p - 1) - sample(p + 1) - sample(p - w) - sample(p + w));
    if (lap > 5) { sharp += lap * lap; sharpCount++; }
  }
  const contrast = quantile(hist, .9, count) - quantile(hist, .1, count), paper = quantile(hist, .75, count), sharpness = Math.sqrt(sharp / Math.max(1, sharpCount));
  return { dark: paper < 100, lowContrast: contrast < 14, blurry: sharpCount > 30 && sharpness < 13, sharpness, brightness: paper };
}
export function createDocumentTracker() {
  let current = null, candidate = null, pending = 0, steady = 0, lastSeen = 0;
  return {
    reset() { current = candidate = null; pending = steady = lastSeen = 0; },
    update(found, now = performance.now()) {
      if (!found) { steady = 0; if (now - lastSeen > 420) current = null; return { detection: current, stable: false, held: !!current }; }
      let corners = found.corners;
      if (current) {
        // Cyclic matching prevents sudden 90-degree corner relabelling on rotation.
        const rotations = corners.map((_, i) => corners.slice(i).concat(corners.slice(0, i)));
        rotations.sort((a, b) => a.reduce((s, p, i) => s + distance(p, current.corners[i]), 0) - b.reduce((s, p, i) => s + distance(p, current.corners[i]), 0)); corners = rotations[0];
        const delta = Math.max(...corners.map((p, i) => distance(p, current.corners[i])));
        if (delta > .12) {
          const same = candidate && Math.max(...corners.map((p, i) => distance(p, candidate[i]))) < .045;
          pending = same ? pending + 1 : 1; candidate = corners; steady = 0;
          if (pending < 3 && now - lastSeen < 650) return { detection: current, stable: false, held: true };
          current = null;
        } else {
          steady = delta < .016 && found.confidence > .67 ? steady + 1 : 0;
          const blend = delta < .012 ? .32 : .64;
          corners = corners.map((p, i) => ({ x: p.x * blend + current.corners[i].x * (1 - blend), y: p.y * blend + current.corners[i].y * (1 - blend) }));
        }
      }
      pending = 0; candidate = null; lastSeen = now; current = { ...found, corners };
      return { detection: current, stable: steady >= 3, held: false };
    },
  };
}
export function perspectiveMap(q) {
  const [p0, p1, p2, p3] = q, dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1; if (Math.abs(det) < 1e-10) throw new Error('El recorte no es válido. Separa las esquinas.');
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  return (u, v) => { const den = g * u + h * v + 1; return { x: ((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) / den, y: ((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) / den }; };
}
export function rectifyPixels(source, corners, maxDimension = 2800) {
  if (!validDocumentCorners(corners)) throw new Error('Ajusta las cuatro esquinas sin cruzarlas.');
  const q = corners.map(p => ({ x: p.x * (source.width - 1), y: p.y * (source.height - 1) }));
  let width = Math.max(distance(q[0], q[1]), distance(q[3], q[2])), height = Math.max(distance(q[0], q[3]), distance(q[1], q[2]));
  const scale = Math.min(1, maxDimension / Math.max(width, height), Math.sqrt(4200000 / (width * height)));
  width = Math.max(2, Math.round(width * scale)); height = Math.max(2, Math.round(height * scale));
  const out = new Uint8ClampedArray(width * height * 4), map = perspectiveMap(q);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = map(x / (width - 1), y / (height - 1)), sx = clamp(p.x, 0, source.width - 1), sy = clamp(p.y, 0, source.height - 1), x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(source.width - 1, x0 + 1), y1 = Math.min(source.height - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
    const a = (y0 * source.width + x0) * 4, b = (y0 * source.width + x1) * 4, c = (y1 * source.width + x0) * 4, d = (y1 * source.width + x1) * 4, target = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) out[target + channel] = (source.data[a + channel] * (1 - fx) + source.data[b + channel] * fx) * (1 - fy) + (source.data[c + channel] * (1 - fx) + source.data[d + channel] * fx) * fy;
    out[target + 3] = 255;
  }
  return { data: out, width, height };
}
function paperBackground(lum, width, height) {
  const cell = Math.max(16, Math.round(Math.min(width, height) / 26)), cols = Math.ceil(width / cell), rows = Math.ceil(height / cell), hist = new Uint32Array(cols * rows * 64), counts = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const c = Math.floor(y / cell) * cols + Math.floor(x / cell); hist[c * 64 + (Math.round(lum[y * width + x]) >> 2)]++; counts[c]++; }
  const bg = new Float32Array(counts.length);
  for (let c = 0; c < counts.length; c++) bg[c] = quantile(hist.subarray(c * 64, c * 64 + 64), .88, counts[c]) * 4 + 2;
  const filtered = new Float32Array(bg.length);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const values = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values.push(bg[clamp(y + dy, 0, rows - 1) * cols + clamp(x + dx, 0, cols - 1)]);
    values.sort((a, b) => a - b); filtered[y * cols + x] = Math.max(45, values[5]);
  }
  return (x, y) => {
    const px = clamp(x / cell - .5, 0, cols - 1), py = clamp(y / cell - .5, 0, rows - 1), x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), fx = px - x0, fy = py - y0;
    return (filtered[y0 * cols + x0] * (1 - fx) + filtered[y0 * cols + x1] * fx) * (1 - fy) + (filtered[y1 * cols + x0] * (1 - fx) + filtered[y1 * cols + x1] * fx) * fy;
  };
}
function localStatistics(lum, width, height) {
  // Statistics at <= 900px avoid large integral-image allocations on phones.
  const scale = Math.min(1, 900 / Math.max(width, height)), w = Math.max(2, Math.round(width * scale)), h = Math.max(2, Math.round(height * scale)), stride = w + 1;
  const integral = new Float64Array((w + 1) * (h + 1)), squares = new Float64Array(integral.length);
  for (let y = 0; y < h; y++) { let row = 0, sq = 0; for (let x = 0; x < w; x++) { const value = lum[Math.min(height - 1, Math.round(y / scale)) * width + Math.min(width - 1, Math.round(x / scale))], p = (y + 1) * stride + x + 1; row += value; sq += value * value; integral[p] = integral[p - stride] + row; squares[p] = squares[p - stride] + sq; } }
  const radius = Math.max(8, Math.round(Math.min(w, h) / 30));
  return (x, y) => {
    const xx = Math.min(w - 1, Math.round(x * scale)), yy = Math.min(h - 1, Math.round(y * scale)), x0 = Math.max(0, xx - radius), y0 = Math.max(0, yy - radius), x1 = Math.min(w, xx + radius + 1), y1 = Math.min(h, yy + radius + 1), count = (x1 - x0) * (y1 - y0);
    const sum = a => (a[y1 * stride + x1] - a[y0 * stride + x1] - a[y1 * stride + x0] + a[y0 * stride + x0]) / count, mean = sum(integral);
    return { mean, std: Math.sqrt(Math.max(0, sum(squares) - mean * mean)) };
  };
}
export function enhancePixels(image, mode = 'enhance', strength = 70) {
  if (mode === 'color' || strength === 0) return image;
  const { width, height, data } = image, n = width * height, amount = clamp(strength, 0, 100) / 100, lum = new Float32Array(n), normalized = new Float32Array(n), hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) lum[p] = .299 * data[p * 4] + .587 * data[p * 4 + 1] + .114 * data[p * 4 + 2];
  const background = paperBackground(lum, width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x, gain = Math.min(3.2, 250 / background(x, y)); normalized[p] = clamp(lum[p] * (1 + (gain - 1) * amount)); hist[Math.round(normalized[p])]++; }
  const black = Math.min(32, quantile(hist, .018) * .55), white = Math.max(220, quantile(hist, .97));
  const stats = mode === 'bw' ? localStatistics(normalized, width, height) : null, out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, p = i * 4, value = normalized[i]; let target;
    if (mode === 'bw') {
      const { mean, std } = stats(x, y), sauvola = mean * (1 + .18 * (std / 128 - 1));
      const threshold = Math.max(sauvola, mean - 13 - (1 - amount) * 12);
      target = clamp((value - threshold) * (1.2 + amount * 2) + 180);
    } else {
      const near = (normalized[y * width + Math.max(0, x - 1)] + normalized[y * width + Math.min(width - 1, x + 1)] + normalized[Math.max(0, y - 1) * width + x] + normalized[Math.min(height - 1, y + 1) * width + x]) / 4;
      const detail = value - near;
      // Suppress flat-region grain, sharpen real strokes conservatively, preserve colour.
      const clean = Math.abs(detail) < 4 ? value * .8 + near * .2 : value + clamp(detail, -20, 20) * .24 * amount;
      const contrast = (clean - black * amount) * 250 / (white - black * amount);
      target = clamp(clean * (1 - amount * .4) + contrast * amount * .4);
    }
    if (mode === 'bw') out[p] = out[p + 1] = out[p + 2] = target;
    else { const gain = lum[i] > 1 ? target / lum[i] : 1; for (let c = 0; c < 3; c++) out[p + c] = clamp(data[p + c] * gain); }
    out[p + 3] = 255;
  }
  return { data: out, width, height };
}
export function processScannerPixels({ source, corners, mode, strength }) {
  return enhancePixels(rectifyPixels(source, corners), mode, strength);
}
export async function imageCanvas(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('No se puede leer esta foto. Prueba JPG o PNG.')); image.src = url; });
    const scale = Math.min(1, 3200 / Math.max(img.naturalWidth, img.naturalHeight), Math.sqrt(5200000 / (img.naturalWidth * img.naturalHeight)));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale)); const draw = canvas.getContext('2d'); draw.fillStyle = '#fff'; draw.fillRect(0, 0, canvas.width, canvas.height); draw.drawImage(img, 0, 0, canvas.width, canvas.height); return canvas;
  } finally { URL.revokeObjectURL(url); }
}
export function analysisPixels(source, maxSize = 640) {
  const canvas = document.createElement('canvas'), scale = Math.min(1, maxSize / Math.max(source.width, source.height)); canvas.width = Math.max(2, Math.round(source.width * scale)); canvas.height = Math.max(2, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, canvas.width, canvas.height); return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
export function detectionFromCanvas(source) { return detectDocument(analysisPixels(source)); }
export async function detectFromCanvas(source, processor, maxSize = 640) {
  if (!processor) return detectDocument(analysisPixels(source, maxSize));
  try { return await processor.detect(analysisPixels(source, maxSize)); }
  catch (error) { if (error.code === 'DISPOSED' || error.code === 'SUPERSEDED') throw error; return detectDocument(analysisPixels(source, maxSize)); }
}
export function canvasBlob(canvas, quality = .95) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar el escaneo.')), 'image/jpeg', quality)); }
export async function renderDocument(blob, corners, mode, rotation = 0, options = {}) {
  const source = await imageCanvas(blob), ctx = source.getContext('2d', { willReadFrequently: true }), data = ctx.getImageData(0, 0, source.width, source.height);
  const payload = { source: { data: data.data, width: data.width, height: data.height }, corners, mode, strength: options.strength ?? 70 };
  let pixels;
  try { pixels = options.processor ? await options.processor.process(payload) : processScannerPixels(payload); }
  catch (error) {
    if (error.code === 'DISPOSED' || error.code === 'SUPERSEDED') throw error;
    const fresh = ctx.getImageData(0, 0, source.width, source.height); pixels = processScannerPixels({ ...payload, source: { data: fresh.data, width: fresh.width, height: fresh.height } });
  }
  const crop = document.createElement('canvas'); crop.width = pixels.width; crop.height = pixels.height; crop.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  if (!rotation) return canvasBlob(crop);
  const out = document.createElement('canvas'), swap = rotation % 180 !== 0; out.width = swap ? crop.height : crop.width; out.height = swap ? crop.width : crop.height; const draw = out.getContext('2d'); draw.translate(out.width / 2, out.height / 2); draw.rotate(rotation * Math.PI / 180); draw.drawImage(crop, -crop.width / 2, -crop.height / 2); return canvasBlob(out);
}

