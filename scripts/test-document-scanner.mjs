import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
const lib = await import(pathToFileURL(resolve(process.argv[2] || 'src/lib/documentScanner.mjs')).href);
const old = process.argv[3] ? await import(pathToFileURL(resolve(process.argv[3])).href) : null;
const { detectDocument, rectifyPixels, perspectiveMap, enhancePixels, validDocumentCorners, createDocumentTracker, defaultDocumentCorners } = lib;
const rectangle = [{ x: .14, y: .09 }, { x: .85, y: .09 }, { x: .85, y: .92 }, { x: .14, y: .92 }];
const perspective = [{ x: .23, y: .12 }, { x: .82, y: .18 }, { x: .9, y: .88 }, { x: .1, y: .92 }];
const receipt = [{ x: .36, y: .07 }, { x: .64, y: .1 }, { x: .7, y: .94 }, { x: .29, y: .91 }];
const rotated = [{ x: .4, y: .06 }, { x: .91, y: .36 }, { x: .62, y: .94 }, { x: .08, y: .65 }];
const clamp = n => Math.max(0, Math.min(255, n));
function inside(x, y, corners) {
  let yes = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) if (((corners[i].y > y) !== (corners[j].y > y)) && x < (corners[j].x - corners[i].x) * (y - corners[i].y) / (corners[j].y - corners[i].y) + corners[i].x) yes = !yes;
  return yes;
}
function fixture(corners, { width = 360, height = 480, paper = 232, background = 38, shadow = 0, noise = 0, texture = false, colour = false, sameLum = false, blur = 0, borderGap = false, internalRules = false } = {}) {
  const data = new Uint8ClampedArray(width * height * 4); let seed = 4271;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const on = corners && inside(x / width, y / height, corners), shade = shadow * (x / width * .6 + (1 - y / height) * .4), grain = (random() - .5) * noise;
    let value = (on ? paper - shade : background + (texture ? 13 * Math.sin(y / 8) + 8 * Math.sin(x / 13) : 0)) + grain;
    const text = on && y / height > .25 && y / height < .76 && x / width > .36 && x / width < .62 && y % 22 < 2 && x % 33 < 25;
    if (text) value = paper * .15 - shade * .1 + grain;
    if (internalRules && on && x / width > .12 && x / width < .92 && [.27, .5, .72].some(at => Math.abs(y - height * at) < 1)) value = 35;
    const p = (y * width + x) * 4;
    const rgb = !on && colour ? sameLum ? [value + 48, value - 29, value + 25] : [value * .6, value, value * 1.5] : [value, value, value];
    for (let c = 0; c < 3; c++) data[p + c] = clamp(rgb[c]); data[p + 3] = 255;
    if (borderGap && x > width * .13 && x < width * .27 && y > height * .08 && y < height * .14) { data[p] = data[p + 1] = data[p + 2] = background; }
  }
  for (let round = 0; round < blur; round++) { const input = data.slice(); for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) for (let c = 0; c < 3; c++) { let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += input[((y + dy) * width + x + dx) * 4 + c]; data[(y * width + x) * 4 + c] = sum / 9; } }
  return { data, width, height };
}
const cases = [
  ['rectangular', rectangle, {}], ['perspective', perspective, {}], ['narrow-receipt', receipt, {}], ['rotation', rotated, {}],
  ['heavy-shadow', perspective, { shadow: 105, noise: 7 }], ['low-light', rectangle, { paper: 112, background: 30, noise: 8 }],
  ['low-contrast', perspective, { paper: 207, background: 183, noise: 5 }], ['textured-background', perspective, { background: 110, texture: true, noise: 12 }],
  ['coloured-background', rectangle, { background: 140, colour: true, noise: 10 }], ['same-luminance-colour', perspective, { paper: 170, background: 170, colour: true, sameLum: true, noise: 3 }],
  ['moderate-blur', perspective, { blur: 2, noise: 5 }], ['partly-broken-edge', rectangle, { borderGap: true }],
];
const metrics = []; let baselinePass = 0;
for (const [name, corners, options] of cases) {
  const input = fixture(corners, options), started = performance.now(), found = detectDocument(input);
  const elapsed = performance.now() - started, error = found ? Math.max(...found.corners.map((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y))) : 1;
  if (old) { const b = old.detectDocument(input); if (b && Math.max(...b.corners.map((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y))) < .065) baselinePass++; }
  metrics.push({ name, found: !!found, cornerError: +error.toFixed(3), confidence: +(found?.confidence || 0).toFixed(2), ms: Math.round(elapsed) });
}
console.table(metrics);
if (old) console.log(`Baseline correctly detected: ${baselinePass}/${cases.length}; v2: ${metrics.filter(p => p.cornerError < .065).length}/${cases.length}`);
assert.ok(metrics.every(p => p.cornerError < .065), 'Every positive scenario detects the paper boundary within tolerance');
for (const height of [320, 480, 640, 720, 800]) {
  const found = detectDocument(fixture(perspective, { width: Math.round(height * .75), height, background: 95, texture: true, shadow: 95, internalRules: true }));
  assert.ok(found && Math.max(...found.corners.map((p, i) => Math.hypot(p.x - perspective[i].x, p.y - perspective[i].y))) < .03, `At ${height}px the invoice rules must not turn into an outer page boundary`);
}
console.log('PASS: internal table rules under shadows at five analysis resolutions.');
for (const background of [18, 130, 245]) assert.equal(detectDocument(fixture(null, { background, noise: 4 })), null, 'No blue detection on an empty surface');
assert.equal(detectDocument(fixture(null, { background: 130, noise: 75 })), null, 'Texture/noise alone is not a document');
assert.equal(detectDocument(fixture([{ x: -.1, y: .15 }, { x: .8, y: .15 }, { x: .8, y: .9 }, { x: -.1, y: .9 }])), null, 'A cut-off fourth edge is not invented');
assert.equal(detectDocument({ width: 5, height: 5, data: new Uint8ClampedArray(100) }), null);
assert.equal(validDocumentCorners([rectangle[0], rectangle[2], rectangle[1], rectangle[3]]), false);
const source = fixture(perspective), before = source.data.slice(), map = perspectiveMap(perspective);
for (const [i, uv] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [0, 1]]]) { const p = map(...uv); assert.ok(Math.hypot(p.x - perspective[i].x, p.y - perspective[i].y) < 1e-8); }
const cropped = rectifyPixels(source, perspective, 240);
assert.ok(cropped.width > 100 && cropped.height > 100 && Math.max(cropped.width, cropped.height) <= 240);
assert.deepEqual(source.data, before);
assert.equal(enhancePixels(cropped, 'color'), cropped);
assert.equal(enhancePixels(cropped, 'enhance', 0), cropped);
const enhanced = enhancePixels(cropped), bw = enhancePixels(cropped, 'bw');
assert.equal(enhanced.data.length, cropped.data.length);
assert.ok(bw.data.every((value, i) => i % 4 > 0 || value === bw.data[i + 1] && value === bw.data[i + 2]));
// Shadow equalisation must improve paper uniformity, not flatten fine dark text.
const shadowed = fixture(rectangle, { paper: 225, shadow: 95 }), cleaned = enhancePixels(shadowed);
const left = (Math.floor(shadowed.height * .82) * shadowed.width + Math.floor(shadowed.width * .22)) * 4, right = (Math.floor(shadowed.height * .82) * shadowed.width + Math.floor(shadowed.width * .76)) * 4;
assert.ok(Math.abs(cleaned.data[left] - cleaned.data[right]) < Math.abs(shadowed.data[left] - shadowed.data[right]), 'Uneven lighting is reduced');
const tracker = createDocumentTracker(), detected = { corners: rectangle, confidence: .9, area: .5 };
for (let i = 0; i < 6; i++) tracker.update(detected, i * 100);
assert.equal(tracker.update(detected, 650).stable, true);
assert.equal(tracker.update(null, 750).held, true);
assert.equal(tracker.update(null, 1200).detection, null, 'Stale blue borders disappear');
tracker.reset(); tracker.update(detected, 0);
const jump = { ...detected, corners: rectangle.map(p => ({ x: p.x * .6, y: p.y * .6 })) };
assert.deepEqual(tracker.update(jump, 100).detection.corners, rectangle, 'One outlier cannot make the border jump');
tracker.update(jump, 200); assert.ok(tracker.update(jump, 300).detection.corners[1].x < .7, 'A persistent new page is acquired');
assert.deepEqual(defaultDocumentCorners(), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
console.log('PASS: detection, negatives, temporal stability, crop integrity, enhancement and colour fallback.');
if (process.argv[4]) {
  const { createScannerProcessor } = await import(pathToFileURL(resolve(process.argv[4])).href);
  const fallback = createScannerProcessor(() => { throw new Error('Worker not available'); });
  assert.ok(await fallback.detect(fixture(rectangle)));
  fallback.dispose(); await assert.rejects(fallback.detect(source), e => e.code === 'DISPOSED');
  class FakeWorker {
    postMessage(message) { this.lastTimer = setTimeout(() => this.onmessage({ data: { id: message.id, result: message.kind === 'detect' ? { corners: rectangle } : source } }), 15); }
    terminate() { clearTimeout(this.lastTimer); }
  }
  const processor = createScannerProcessor(() => new FakeWorker());
  const first = processor.process({ source, corners: rectangle, mode: 'color' });
  const superseded = processor.process({ source, corners: rectangle, mode: 'color' }).catch(e => e.code);
  const latest = processor.process({ source, corners: rectangle, mode: 'color' });
  assert.equal(await superseded, 'SUPERSEDED'); assert.equal((await first).width, source.width); assert.equal((await latest).width, source.width);
  const pending = processor.detect(source).catch(e => e.code); processor.dispose(); assert.equal(await pending, 'DISPOSED');
  console.log('PASS: processor fallback, edit coalescing, disposal and rejected post-close requests.');
}

