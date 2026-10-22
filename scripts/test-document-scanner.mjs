import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { detectDocument, rectifyPixels, perspectiveMap, enhancePixels, validDocumentCorners } = await import(pathToFileURL(resolve(process.argv[2] || 'src/lib/documentScanner.mjs')).href);
function fixture(corners, { width = 360, height = 480, shadow = false, background = 35, paper = 230 } = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x, y) => { let yes = false; for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) if (((corners[i].y > y) !== (corners[j].y > y)) && x < (corners[j].x - corners[i].x) * (y - corners[i].y) / (corners[j].y - corners[i].y) + corners[i].x) yes = !yes; return yes; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const inPaper = inside(x / width, y / height); let color = inPaper ? paper - (shadow ? 65 * x / width : 0) : background; if (inPaper && y > height * .24 && y < height * .7 && x > width * .35 && x < width * .6 && y % 20 < 3) color = 30; const p = (y * width + x) * 4; data[p] = color; data[p + 1] = color; data[p + 2] = color; data[p + 3] = 255; }
  return { data, width, height };
}
const quads = [
  [{ x: .15, y: .08 }, { x: .85, y: .08 }, { x: .85, y: .91 }, { x: .15, y: .91 }],
  [{ x: .23, y: .12 }, { x: .82, y: .18 }, { x: .9, y: .88 }, { x: .1, y: .92 }],
  [{ x: .32, y: .06 }, { x: .66, y: .09 }, { x: .71, y: .94 }, { x: .28, y: .9 }],
];
for (const corners of quads) {
  const found = detectDocument(fixture(corners, { shadow: true }));
  assert.ok(found, 'Detects a complete document / perspective / narrow receipt');
  assert.ok(found.confidence > .58);
  assert.ok(Math.max(...found.corners.map((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y))) < .045, 'Corners stay near the actual paper boundary');
  const map = perspectiveMap(corners);
  for (const [i, uv] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [0, 1]]]) { const p = map(...uv); assert.ok(Math.hypot(p.x - corners[i].x, p.y - corners[i].y) < 1e-8); }
}
const blank = { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) };
assert.equal(detectDocument(blank), null, 'No fake detection on an empty surface');
assert.equal(validDocumentCorners([quads[0][0], quads[0][2], quads[0][1], quads[0][3]]), false, 'Crossed corners are rejected');
const input = fixture(quads[0]);
const before = input.data.slice();
const rectified = rectifyPixels(input, quads[0], 240);
assert.ok(rectified.width > 100 && rectified.height > 100 && Math.max(rectified.width, rectified.height) <= 240);
assert.deepEqual(input.data, before, 'The source pixels remain intact');
const improved = enhancePixels(rectified), bw = enhancePixels(rectified, 'bw');
assert.equal(improved.data.length, rectified.data.length);
assert.ok(improved.data[0] > rectified.data[0], 'Paper is brightened');
assert.ok(bw.data.every((value, i) => i % 4 > 0 || value === bw.data[i + 1] && value === bw.data[i + 2]));
assert.equal(enhancePixels(rectified, 'color'), rectified, 'Natural color keeps source tones');
assert.throws(() => rectifyPixels(input, []));
const started = performance.now(); for (let i = 0; i < 5; i++) detectDocument(input);
console.log(`Scanner: document, perspective, receipt, no-document, crop integrity and enhancement passed. Detection average: ${Math.round((performance.now() - started) / 5)}ms on this runtime.`);

