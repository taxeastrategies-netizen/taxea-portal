// Document detection and image processing run entirely on the user's device.
const clamp = (n, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const defaultDocumentCorners = () => [{ x: .03, y: .03 }, { x: .97, y: .03 }, { x: .97, y: .97 }, { x: .03, y: .97 }];
export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
export function validDocumentCorners(q) {
  if (!Array.isArray(q) || q.length !== 4 || q.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  const crosses = q.map((a, i) => { const b = q[(i + 1) % 4], c = q[(i + 2) % 4]; return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); });
  return crosses.every(n => n > .0001) && polygonArea(q) > .025 && q.every((p, i) => distance(p, q[(i + 1) % 4]) > .025);
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
  while (q.length > 4) {
    let smallest = Infinity, remove = 0;
    q.forEach((p, i) => { const area = polygonArea([q[(i + q.length - 1) % q.length], p, q[(i + 1) % q.length]]); if (area < smallest) { smallest = area; remove = i; } });
    q.splice(remove, 1);
  }
  if (q.length !== 4) return null;
  const first = q.reduce((best, p, i) => p.x + p.y < q[best].x + q[best].y ? i : best, 0);
  return q.slice(first).concat(q.slice(0, first));
}
function components(mask, width, height, visit) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 1; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (mask[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; }
      }
    }
    if (tail < 65) continue;
    const points = [], step = Math.max(1, Math.floor(tail / 1600));
    for (let i = 0; i < tail; i += step) points.push({ x: queue[i] % width, y: Math.floor(queue[i] / width) });
    visit(points);
  }
}
export function detectDocument({ data, width, height }) {
  if (width < 32 || height < 32 || data.length !== width * height * 4) return null;
  const size = width * height, gray = new Uint8Array(size), edges = new Uint8Array(size), joined = new Uint8Array(size), bright = new Uint8Array(size), histogram = new Uint32Array(256);
  for (let p = 0; p < size; p++) { gray[p] = .299 * data[p * 4] + .587 * data[p * 4 + 1] + .114 * data[p * 4 + 2]; histogram[gray[p]]++; }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let lowerCount = 0, lowerSum = 0, variance = 0, threshold = 160;
  for (let i = 0; i < 255; i++) {
    lowerCount += histogram[i]; lowerSum += i * histogram[i];
    if (!lowerCount || lowerCount === size) continue;
    const delta = lowerSum / lowerCount - (sum - lowerSum) / (size - lowerCount), v = lowerCount * (size - lowerCount) * delta * delta;
    if (v > variance) { variance = v; threshold = i; }
  }
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const p = y * width + x;
    const gx = -gray[p - width - 1] + gray[p - width + 1] - 2 * gray[p - 1] + 2 * gray[p + 1] - gray[p + width - 1] + gray[p + width + 1];
    const gy = -gray[p - width - 1] - 2 * gray[p - width] - gray[p - width + 1] + gray[p + width - 1] + 2 * gray[p + width] + gray[p + width + 1];
    if (Math.abs(gx) + Math.abs(gy) > 135) edges[p] = 1;
    if (gray[p] > Math.max(95, Math.min(235, threshold))) bright[p] = 1;
  }
  // Join small gaps caused by text, shadows and camera noise.
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const p = y * width + x;
    if (edges[p]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) joined[p + dy * width + dx] = 1;
  }
  let best = null;
  const consider = points => {
    const raw = quadFromHull(points);
    if (!raw) return;
    const corners = raw.map(p => ({ x: p.x / (width - 1), y: p.y / (height - 1) })), area = polygonArea(corners);
    if (!validDocumentCorners(corners) || area < .09 || area > .94) return;
    // A document must have four visible edges, not just a large bright region.
    const support = raw.map((a, i) => {
      const b = raw[(i + 1) % 4]; let found = 0;
      for (let s = 1; s < 30; s++) {
        const x = Math.round(a.x + (b.x - a.x) * s / 30), y = Math.round(a.y + (b.y - a.y) * s / 30); let hit = false;
        for (let dy = -3; dy <= 3 && !hit; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && edges[(y + dy) * width + x + dx]) { hit = true; break; }
        }
        if (hit) found++;
      }
      return found / 29;
    });
    if (Math.min(...support) < .35) return;
    const edgeScore = support.reduce((a, b) => a + b, 0) / 4;
    const confidence = edgeScore * .7 + Math.min(1, area / .55) * .3;
    const rank = confidence * .5 + area * .5;
    if (confidence > .58 && (!best || rank > best.rank)) best = { corners, confidence, area, rank };
  };
  components(joined, width, height, consider);
  components(bright, width, height, consider);
  return best;
}
export function perspectiveMap(q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-10) throw new Error('El recorte no es válido. Separa las esquinas.');
  const g = (dx3 * dy2 - dx2 * dy3) / denominator, h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: ((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) / w, y: ((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) / w };
  };
}
export function rectifyPixels(source, corners, maxDimension = 2400) {
  if (!validDocumentCorners(corners)) throw new Error('Ajusta las cuatro esquinas sin cruzarlas.');
  const q = corners.map(p => ({ x: p.x * (source.width - 1), y: p.y * (source.height - 1) }));
  let width = Math.max(distance(q[0], q[1]), distance(q[3], q[2])), height = Math.max(distance(q[0], q[3]), distance(q[1], q[2]));
  const scale = Math.min(1, maxDimension / Math.max(width, height), Math.sqrt(3500000 / (width * height)));
  width = Math.max(2, Math.round(width * scale)); height = Math.max(2, Math.round(height * scale));
  const out = new Uint8ClampedArray(width * height * 4), map = perspectiveMap(q);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = map(x / (width - 1), y / (height - 1)), sx = clamp(p.x, 0, source.width - 1), sy = clamp(p.y, 0, source.height - 1);
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(source.width - 1, x0 + 1), y1 = Math.min(source.height - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
    const a = (y0 * source.width + x0) * 4, b = (y0 * source.width + x1) * 4, c = (y1 * source.width + x0) * 4, d = (y1 * source.width + x1) * 4, target = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) out[target + channel] = (source.data[a + channel] * (1 - fx) + source.data[b + channel] * fx) * (1 - fy) + (source.data[c + channel] * (1 - fx) + source.data[d + channel] * fx) * fy;
    out[target + 3] = 255;
  }
  return { data: out, width, height };
}
export function enhancePixels(image, mode = 'enhance') {
  if (mode === 'color') return image;
  const { width, height, data } = image, cell = 40, cols = Math.ceil(width / cell), rows = Math.ceil(height / cell), sums = new Float32Array(cols * rows), counts = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = (y * width + x) * 4, i = Math.floor(y / cell) * cols + Math.floor(x / cell); sums[i] += .299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2]; counts[i]++; }
  const background = new Float32Array(sums.length);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const nearby = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (y + dy >= 0 && y + dy < rows && x + dx >= 0 && x + dx < cols) { const i = (y + dy) * cols + x + dx; nearby.push(sums[i] / counts[i]); }
    nearby.sort((a, b) => a - b); background[y * cols + x] = Math.max(90, nearby[Math.floor((nearby.length - 1) * .8)]);
  }
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4, gx = x / cell, gy = y / cell, x0 = Math.min(cols - 1, Math.floor(gx)), y0 = Math.min(rows - 1, Math.floor(gy)), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), fx = gx - x0, fy = gy - y0;
    const bg = (background[y0 * cols + x0] * (1 - fx) + background[y0 * cols + x1] * fx) * (1 - fy) + (background[y1 * cols + x0] * (1 - fx) + background[y1 * cols + x1] * fx) * fy;
    if (mode === 'bw') { const lum = (.299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2]) * 248 / bg; const tone = clamp((lum - 155) * 2.5 + 155); output[p] = tone; output[p + 1] = tone; output[p + 2] = tone; }
    else for (let c = 0; c < 3; c++) output[p + c] = clamp((data[p + c] * (1 + (248 / bg - 1) * .85) - 128) * 1.1 + 128);
    output[p + 3] = 255;
  }
  return { data: output, width, height };
}
export async function imageCanvas(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('No se puede leer esta foto. Prueba JPG o PNG.')); image.src = url; });
    const scale = Math.min(1, 2600 / Math.max(img.naturalWidth, img.naturalHeight), Math.sqrt(4500000 / (img.naturalWidth * img.naturalHeight)));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); return canvas;
  } finally { URL.revokeObjectURL(url); }
}
export function detectionFromCanvas(source) {
  const canvas = document.createElement('canvas'), scale = Math.min(1, 384 / Math.max(source.width, source.height));
  canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return detectDocument(ctx.getImageData(0, 0, canvas.width, canvas.height));
}
export function canvasBlob(canvas, quality = .93) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar el escaneo.')), 'image/jpeg', quality));
}
export async function renderDocument(blob, corners, mode, rotation = 0) {
  const source = await imageCanvas(blob), ctx = source.getContext('2d', { willReadFrequently: true });
  const pixels = enhancePixels(rectifyPixels(ctx.getImageData(0, 0, source.width, source.height), corners), mode);
  const crop = document.createElement('canvas'); crop.width = pixels.width; crop.height = pixels.height;
  crop.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  if (!rotation) return canvasBlob(crop);
  const out = document.createElement('canvas'), swap = rotation % 180 !== 0; out.width = swap ? crop.height : crop.width; out.height = swap ? crop.width : crop.height;
  const draw = out.getContext('2d'); draw.translate(out.width / 2, out.height / 2); draw.rotate(rotation * Math.PI / 180); draw.drawImage(crop, -crop.width / 2, -crop.height / 2);
  return canvasBlob(out);
}

