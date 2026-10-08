import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';

/** Same emulated display pacing as camera-smooth.spec.ts: synthetic RAF timestamps, one virtual frame per real frame. */
const pacings = { '60hz': [1000 / 60], '120hz': [1000 / 120], 'uneven-120hz': [6.1, 10.9, 7.4, 9.8, 5.6, 11.2, 8.3, 7.2], 'uneven-60hz': [14, 19, 15.2, 18.1, 16.9, 16.4], 'vsync-60hz': [16.2, 17.1, 16.5, 16.9, 15.9, 17.4], 'hitch-30hz': [8.3, 25, 33.3, 16.7, 8.3, 41.7] } as const;
type Sample = { t: number; screen: Record<string, number[]>; feet: number[][]; world: number[]; dog: number[] | null; skinned: boolean };
/** High-pass: residual of a quadratic fit over 100 ms windows (the gait bob is smooth at that scale), px RMS. */
const jitter = (t: number[], y: number[]): number => {
  let sum = 0, count = 0;
  for (let start = 0; start < t.length;) {
    let end = start; while (end < t.length && t[end] - t[start] < 100) end++;
    if (end - start >= 5) {
      const t0 = t[start], s = [0, 0, 0, 0, 0], r = [0, 0, 0];
      for (let i = start; i < end; i++) { const x = (t[i] - t0) / 100; let p = 1; for (let k = 0; k < 5; k++) { s[k] += p; if (k < 3) r[k] += p * y[i]; p *= x; } }
      const m = [[s[0], s[1], s[2], r[0]], [s[1], s[2], s[3], r[1]], [s[2], s[3], s[4], r[2]]];
      for (let c = 0; c < 3; c++) for (let row = c + 1; row < 3; row++) { const f = m[row][c] / m[c][c]; for (let k = c; k < 4; k++) m[row][k] -= f * m[c][k]; }
      const a = [0, 0, 0]; for (let row = 2; row >= 0; row--) { let v = m[row][3]; for (let k = row + 1; k < 3; k++) v -= m[row][k] * a[k]; a[row] = v / m[row][row]; }
      for (let i = start; i < end; i++) { const x = (t[i] - t0) / 100, e = y[i] - (a[0] + a[1] * x + a[2] * x * x); sum += e * e; count++; }
    }
    start = end;
  }
  return Math.sqrt(sum / Math.max(1, count));
};

for (const [name, steps] of Object.entries(pacings)) test(`T-E04-present-${name} @E04 courier and corgi present smoothly while running (${name})`, async ({ page }) => {
  await page.addInitScript((pattern: number[]) => {
    const real = window.requestAnimationFrame.bind(window);
    let lastReal = -1, virtual = 0, frame = 0;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => real((now) => {
      if (now !== lastReal) { lastReal = now; virtual += pattern[frame++ % pattern.length]; }
      callback(virtual);
    });
  }, [...steps]);
  await boot(page, `${testUrl}&skin=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L1', { seed: 1 }));
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.resume());
  await page.keyboard.down('w'); await page.keyboard.down('d');
  // Wait until the run is under way (the first frames after the briefing may not take input yet).
  const start = await page.evaluate(() => window.__SS__!.getState().render.character!.position);
  await page.waitForFunction((p) => { const c = window.__SS__!.getState().render.character!.position; return Math.hypot(c[0] - p[0], c[2] - p[2]) > .5; }, start);
  const samples = await page.evaluate(() => new Promise<Sample[]>((resolve) => {
    const api = window.__SS__!, out: Sample[] = [], dog = api.query({ kind: 'companion' })[0]?.id;
    let start = -1;
    const screen = (p: number[]) => { const s = api.camera.project(p[0], p[1], p[2]); return [s[0] * innerWidth / 2, s[1] * innerHeight / 2]; };
    const record = (now: number) => {
      if (start < 0) start = now;
      const elapsed = now - start;
      if (elapsed >= 1500) {
        const render = api.getState().render, c = render.character!, hero = render.npcs?.heroes.find((h) => h.id === dog);
        const points: Record<string, number[]> = { root: screen(c.position), pelvis: screen(c.pelvis!), head: screen(c.head!) };
        if (hero) { points.corgi = screen(hero.position); if (hero.head) points.corgiHead = screen(hero.head); }
        // Footprints (contact shadows) under the courier and the corgi: nearest footprint to each presented root.
        const near = (x: number, z: number) => (render.contactShadows ?? []).reduce<number[] | null>((best, p) => !best || Math.hypot(p[0] - x, p[1] - z) < Math.hypot(best[0] - x, best[1] - z) ? p : best, null);
        const blob = near(c.position[0], c.position[2]); if (blob) points.blob = screen([blob[0], 0, blob[1]]);
        const dogBlob = hero && near(hero.position[0], hero.position[2]); if (dogBlob) points.corgiBlob = screen([dogBlob[0], 0, dogBlob[1]]);
        out.push({ t: elapsed, screen: points, feet: c.feet!, world: c.position, dog: hero?.position ?? null, skinned: c.skinned });
      }
      if (elapsed < 3000) requestAnimationFrame(record); else resolve(out);
    };
    requestAnimationFrame(record);
  }));
  await page.keyboard.up('w'); await page.keyboard.up('d');
  const t = samples.map((s) => s.t), result: Record<string, number> = {};
  for (const key of Object.keys(samples[0].screen)) result[key] = Math.hypot(jitter(t, samples.map((s) => s.screen[key][0])), jitter(t, samples.map((s) => s.screen[key][1])));
  // Planted feet: frames where a foot barely moved; within each planted run it must not creep or buzz (world metres).
  let creep = 0;
  for (const side of [0, 1]) {
    let anchor: number[] | null = null;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1].feet[side], b = samples[i].feet[side], step = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (step < .002) { anchor ??= a; creep = Math.max(creep, Math.hypot(b[0] - anchor[0], b[2] - anchor[2])); } else anchor = null;
    }
  }
  const travel = Math.hypot(samples.at(-1)!.world[0] - samples[0].world[0], samples.at(-1)!.world[2] - samples[0].world[2]);
  const dogTravel = samples[0].dog ? Math.hypot(samples.at(-1)!.dog![0] - samples[0].dog[0], samples.at(-1)!.dog![2] - samples[0].dog[2]) : 0;
  mkdirSync('test-results/epics/E04', { recursive: true });
  writeFileSync(`test-results/epics/E04/present-${name}.json`, JSON.stringify({ frames: samples.length, jitterPx: result, plantedCreepM: creep, travelM: travel, dogTravelM: dogTravel, skinned: samples[0].skinned }, null, 2) + '\n');
  expect(samples[0].skinned, 'skinned courier').toBe(true);
  expect(travel, 'the courier runs').toBeGreaterThan(5); expect(dogTravel, 'the corgi follows').toBeGreaterThan(3);
  expect(result.root, 'courier root jitter px RMS').toBeLessThanOrEqual(.25);
  expect(result.head, 'courier head jitter px RMS').toBeLessThanOrEqual(.25);
  expect(result.corgi, 'corgi root jitter px RMS').toBeLessThanOrEqual(.25);
  expect(result.corgiHead, 'corgi head jitter px RMS').toBeLessThanOrEqual(.25);
  expect(result.blob, 'courier footprint jitter px RMS').toBeLessThanOrEqual(.25);
  expect(result.corgiBlob, 'corgi footprint jitter px RMS').toBeLessThanOrEqual(.25);
  expect(creep, 'planted feet stay put').toBeLessThan(.01);
});
