import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

/** Both depth-tested iris islands must survive; a single visible eye is insufficient. */
export function eyeComponents(black: PNG, naked: PNG, wearing: PNG) {
  const { width, height } = naked, active = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const energy = (image: PNG, p: number) => image.data[p * 4] + image.data[p * 4 + 1] + image.data[p * 4 + 2];
  for (let p = 0; p < active.length; p++) active[p] = Number(energy(naked, p) - energy(black, p) >= 6);
  const components: { pixels: number; visibility: number }[] = [];
  for (let p = 0; p < active.length; p++) if (active[p]) {
    let from = 0, to = 1, reference = 0, retained = 0; queue[0] = p; active[p] = 0;
    while (from < to) {
      const at = queue[from++], base = energy(black, at), a = energy(naked, at) - base;
      reference += a; retained += Math.max(0, Math.min(a, energy(wearing, at) - base));
      const x = at % width, y = Math.floor(at / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = at + dy * width + dx;
        if (active[next]) { active[next] = 0; queue[to++] = next; }
      }
    }
    if (to >= 2) components.push({ pixels: to, visibility: retained / reference });
  }
  return components.sort((a, b) => b.pixels - a.pixels).slice(0, 2);
}

/** Compare the face around the projected irises, excluding the courier and background. */
export function faceTintError(original: PNG, retagged: PNG, black: PNG, eyes: PNG) {
  const { width, height } = original;
  let left = width, top = height, right = 0, bottom = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4, energy = eyes.data[i] + eyes.data[i + 1] + eyes.data[i + 2] - black.data[i] - black.data[i + 1] - black.data[i + 2];
    if (energy < 6) continue;
    left = Math.min(left, p % width); right = Math.max(right, p % width); top = Math.min(top, Math.floor(p / width)); bottom = Math.max(bottom, Math.floor(p / width));
  }
  assert.ok(right > left && bottom > top, 'resolved face probe');
  const span = right - left;
  const x0 = Math.max(0, Math.floor(left - span)), x1 = Math.min(width, Math.ceil(right + span));
  const y0 = Math.max(0, Math.floor(top - span * 1.3)), y1 = Math.min(height, Math.ceil(bottom + span * .7));
  let error = 0, maxError = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) {
    const i = (y * width + x) * 4 + c, d = Math.abs(original.data[i] - retagged.data[i]); error += d; maxError = Math.max(maxError, d);
  }
  const pixels = (x1 - x0) * (y1 - y0);
  return { meanError: error / (pixels * 3), maxError, pixels, region: [x0, y0, x1 - x0, y1 - y0] };
}

// Reanalyse captured passes without opening another browser.
if (process.argv[1]?.endsWith('/eye-components.ts') && process.argv[2]) {
  const directory = resolve(process.argv[2]), path = resolve(directory, 'hat-eye-gate.json');
  const report = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(report.pass, 'the geometry, tint and eye gate must already be green');
  for (const row of report.receipts) for (const eye of row.eyePixels) {
    const name = `${row.model}-${row.hat}-${row.infected ? 'infected' : 'live'}-z${eye.zoom}`;
    const read = (pass: string) => PNG.sync.read(readFileSync(resolve(directory, `${name}-${pass}.png`)));
    eye.eyes = eyeComponents(read('black'), read('eyes'), read('hat'));
    assert.equal(eye.eyes.length, 2, `${name}: both iris islands are resolved`);
    assert.ok(eye.eyes.every((e: { visibility: number }) => e.visibility >= .95), `${name}: both eyes unoccluded`);
  }
  for (const model of Object.keys(report.continuity)) {
    const row = report.receipts.find((r: { model: string; infected: boolean }) => r.model === model && r.infected);
    const name = `${model}-${row.hat}-infected-close`;
    const read = (file: string) => PNG.sync.read(readFileSync(resolve(directory, file)));
    Object.assign(report.continuity[model], faceTintError(read(`${name}-native.png`), read(`${model}-continuous-tint.png`), read(`${name}-black.png`), read(`${name}-eyes.png`)));
    assert.ok(report.continuity[model].meanError < .25, `${model}: per-pixel face tint is independent of triangle tags`);
  }
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.receipts.length * 2} game-camera passes: both eyes resolved and unoccluded`);
}
