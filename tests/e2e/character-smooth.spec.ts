import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
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

/** PO (PROD, verbatim): "There is still flickering when I move around, but not always. The figure can run/drive smooth, but
 * after a pause it's flickering a lot when moving. Dog or area never flickers." / "Flickering happen on bike, not while walking".
 * Any clock pause (pause menu, hidden tab) zeroes the fixed-step accumulator, which lines the tick boundary up with vsync:
 * 60 Hz scatter then alternates 0/2 ticks per frame, and every presented transform must still move smoothly. */
type RideSample = { t: number; tick: number; clip: string; screen: Record<string, number[]>; bikeY: number; world: number[]; hip: number[]; seat: number[] | null };
const installPacing = (page: Page, pattern: readonly number[]) => page.addInitScript((steps: number[]) => {
  const real = window.requestAnimationFrame.bind(window);
  let lastReal = -1, virtual = 0, frame = 0;
  window.requestAnimationFrame = (callback: FrameRequestCallback) => real((now) => { if (now !== lastReal) { lastReal = now; virtual += steps[frame++ % steps.length]; } callback(virtual); });
}, [...pattern]);
/** Holds `keys` for `ms` (virtual) and records every frame after `settle` ms: screen points of bike and rider, sim tick, bike height.
 * Then lets the bike coast to a stop. */
const rideFrames = async (page: Page, keys = ['w', 'a'], ms = 2200, settle = 700): Promise<RideSample[]> => {
  for (const key of keys) await page.keyboard.down(key);
  const samples = await page.evaluate(({ ms, settle }) => new Promise<RideSample[]>((resolve) => {
    const api = window.__SS__!, out: RideSample[] = []; let start = -1;
    const screen = (p: number[]) => { const s = api.camera.project(p[0], p[1], p[2]); return [s[0] * innerWidth / 2, s[1] * innerHeight / 2]; };
    const record = (now: number) => {
      if (start < 0) start = now;
      if (now - start >= settle) {
        const render = api.getState().render, c = render.character!, b = render.bicycle;
        const points: Record<string, number[]> = { root: screen(c.position), pelvis: screen(c.pelvis!), head: screen(c.head!), footL: screen(c.feet![0]), footR: screen(c.feet![1]) };
        if (b) { points.bike = screen(b.position); if (b.seat) points.seat = screen(b.seat); }
        points.street = screen([-40, 0, 4]); // diagnostic: a fixed point on the pavement (camera presentation only)
        out.push({ t: now - start, tick: api.tick(), clip: c.clip ?? '', screen: points, bikeY: b?.position[1] ?? 0, world: c.position, hip: c.pelvis!, seat: b?.seat ?? null });
      }
      if (now - start < ms) requestAnimationFrame(record); else resolve(out);
    };
    requestAnimationFrame(record);
  }), { ms, settle });
  for (const key of keys) await page.keyboard.up(key);
  await page.waitForTimeout(3000);
  return samples;
};
/** `jitter` per screen point, skipping 100 ms windows where the bike changes paving height (kerbs and slabs are real steps). */
const rideJitter = (samples: RideSample[]): Record<string, number> => {
  const keep: RideSample[] = [];
  for (let start = 0; start < samples.length;) {
    let end = start; while (end < samples.length && samples[end].t - samples[start].t < 100) end++;
    const ys = samples.slice(start, end).map((s) => s.bikeY);
    if (Math.max(...ys) - Math.min(...ys) < .001) keep.push(...samples.slice(start, end));
    start = end;
  }
  const t = keep.map((s) => s.t), out: Record<string, number> = { frames: keep.length };
  for (const key of Object.keys(samples[0].screen)) out[key] = Math.hypot(jitter(t, keep.map((s) => s.screen[key][0])), jitter(t, keep.map((s) => s.screen[key][1])));
  return out;
};
const ticksPerFrame = (samples: RideSample[]) => samples.slice(1).reduce<Record<number, number>>((n, s, i) => { const k = s.tick - samples[i].tick; n[k] = (n[k] ?? 0) + 1; return n; }, {});

test('T-E19-ride-present-after-pause @E19 courier on the bike presents smoothly after idling, a pause and a hidden tab (vsync-60hz)', async ({ page }) => {
  test.setTimeout(240_000);
  // Defaults keep the gate short; the lane measured 5/15/30 s idle and a 10 s pause with RIDE_IDLE_MS / RIDE_PAUSE_MS.
  const idleMs = Number(process.env.RIDE_IDLE_MS ?? 5000), pauseMs = Number(process.env.RIDE_PAUSE_MS ?? 3000);
  await installPacing(page, pacings['vsync-60hz']);
  await boot(page, `${testUrl}&skin=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L1', { seed: 1 }));
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(async () => {
    const a = window.__SS__!; a.pause();
    const bike = a.getState().entities.find(e => e.bicycle)!;
    a.teleport('player', { x: bike.transform.x + .9, z: bike.transform.z }); a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false }); await a.step(40);
    a.input.clear(); a.teleport('player', { x: -34, z: 0 }); await a.step(5); a.resume();
  });
  const runs: Record<string, RideSample[]> = {};
  // Every run rides west down the main road (asphalt z -2.5..2.5) from the same spot; the teleport keeps her seated.
  // A first unmeasured ride swings the bike round from its parking heading so all runs share the straight line.
  const back = () => page.evaluate(() => window.__SS__!.teleport('player', { x: -34, z: 0 }));
  await rideFrames(page); await back();
  runs.first = await rideFrames(page);
  await back(); await page.waitForTimeout(idleMs); // standing still on the bike
  runs.idle = await rideFrames(page);
  // Pause menu: the same clock.pause()/resume path (accumulator zeroed, ticker reset).
  await page.evaluate(() => window.__SS__!.pause()); await back(); await page.waitForTimeout(pauseMs); await page.evaluate(() => window.__SS__!.resume());
  runs.paused = await rideFrames(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await back(); await page.waitForTimeout(2000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); window.__SS__!.resume(); });
  runs.hidden = await rideFrames(page);
  const report: Record<string, { jitterPx: Record<string, number>; travelM: number; seatedM: number; ticksPerFrame: Record<number, number>; clips: string[] }> = {};
  for (const [name, samples] of Object.entries(runs)) {
    const travel = Math.hypot(samples.at(-1)!.world[0] - samples[0].world[0], samples.at(-1)!.world[2] - samples[0].world[2]);
    const seated = Math.max(...samples.filter((s) => s.seat).map((s) => Math.hypot(s.hip[0] - s.seat![0], s.hip[1] - s.seat![1] + .04, s.hip[2] - s.seat![2])));
    report[name] = { jitterPx: rideJitter(samples), travelM: travel, seatedM: seated, ticksPerFrame: ticksPerFrame(samples), clips: [...new Set(samples.map((s) => s.clip))] };
  }
  mkdirSync('test-results/epics/E19', { recursive: true });
  writeFileSync('test-results/epics/E19/ride-present-after-pause.json', JSON.stringify(report, null, 2) + '\n');
  writeFileSync('test-results/epics/E19/ride-present-frames.json', JSON.stringify(runs));
  for (const [name, r] of Object.entries(report)) {
    expect(r.clips, `${name}: riding`).toEqual(['ride']);
    expect(r.travelM, `${name}: the bike moves`).toBeGreaterThan(4);
    expect(r.jitterPx.frames, `${name}: flat frames measured`).toBeGreaterThan(40);
    expect(r.seatedM, `${name}: pelvis stays on the saddle`).toBeLessThan(.01);
    for (const key of ['bike', 'seat', 'root', 'pelvis', 'head', 'footL', 'footR']) expect(r.jitterPx[key], `${name}: ${key} jitter px RMS`).toBeLessThanOrEqual(.25);
  }
});
