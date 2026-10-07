import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';

/** Emulated display pacing: the game's RAF receives synthetic timestamps (one virtual frame per real frame),
 * so a headless 60 Hz browser presents like a 120 Hz ProMotion panel or an unevenly paced one. */
const pacings = { '60hz': [1000 / 60], '120hz': [1000 / 120], 'uneven-120hz': [6.1, 10.9, 7.4, 9.8, 5.6, 11.2, 8.3, 7.2] } as const;
const rms = (t: number[], y: number[]): number => {
  // High-pass: residual from a local linear fit over 100 ms windows (the scroll is smooth at that scale).
  let sum = 0, count = 0;
  for (let start = 0; start < t.length;) {
    let end = start; while (end < t.length && t[end] - t[start] < 100) end++;
    const n = end - start;
    if (n >= 5) {
      let st = 0, sy = 0, stt = 0, sty = 0; for (let i = start; i < end; i++) { st += t[i]; sy += y[i]; stt += t[i] * t[i]; sty += t[i] * y[i]; }
      const slope = (n * sty - st * sy) / (n * stt - st * st), offset = (sy - slope * st) / n;
      for (let i = start; i < end; i++) { const e = y[i] - (offset + slope * t[i]); sum += e * e; count++; }
    }
    start = end;
  }
  return Math.sqrt(sum / count);
};

for (const [name, steps] of Object.entries(pacings)) for (const keys of [['w'], ['w', 'd']]) {
  test(`T-E02-scroll-${name}-${keys.join('')} @E02 running scrolls the world and keeps the courier steady on screen (${name}, ${keys.join('+')})`, async ({ page }) => {
    await page.addInitScript((pattern: number[]) => {
      const real = window.requestAnimationFrame.bind(window);
      let lastReal = -1, virtual = 0, frame = 0;
      window.requestAnimationFrame = (callback: FrameRequestCallback) => real((now) => {
        if (now !== lastReal) { lastReal = now; virtual += pattern[frame++ % pattern.length]; }
        callback(virtual);
      });
    }, [...steps]);
    await boot(page);
    await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('survivor'); api.resume(); });
    for (const key of keys) await page.keyboard.down(key);
    const samples = await page.evaluate(() => new Promise<{ t: number; prop: number[]; player: number[] }[]>((resolve) => {
      const api = window.__SS__!, out: { t: number; prop: number[]; player: number[] }[] = [];
      let start = -1, prop: number[] | null = null;
      const record = (now: number) => {
        if (start < 0) start = now;
        const elapsed = now - start;
        if (elapsed >= 1200) {
          const character = api.getState().render.character!.position as number[];
          prop ??= [character[0] + 1, 0, character[2] + 1];
          const p = api.camera.project(prop[0], prop[1], prop[2]), c = api.camera.project(character[0], character[1] + 0.7, character[2]);
          out.push({ t: elapsed, prop: [p[0] * innerWidth / 2, p[1] * innerHeight / 2], player: [c[0] * innerWidth / 2, c[1] * innerHeight / 2] });
        }
        if (elapsed < 2400) requestAnimationFrame(record); else resolve(out);
      };
      requestAnimationFrame(record);
    }));
    for (const key of keys) await page.keyboard.up(key);
    const t = samples.map((s) => s.t);
    const jitter = (pick: (s: typeof samples[number]) => number[]) => Math.hypot(rms(t, samples.map((s) => pick(s)[0])), rms(t, samples.map((s) => pick(s)[1])));
    const prop = jitter((s) => s.prop), player = jitter((s) => s.player);
    const travel = Math.hypot(samples.at(-1)!.prop[0] - samples[0].prop[0], samples.at(-1)!.prop[1] - samples[0].prop[1]);
    mkdirSync('test-results/epics/E02', { recursive: true });
    writeFileSync(`test-results/epics/E02/scroll-${name}-${keys.join('')}.json`, JSON.stringify({ frames: samples.length, propJitterPx: prop, playerJitterPx: player, propTravelPx: travel }, null, 2) + '\n');
    expect(travel, 'the world scrolls while running').toBeGreaterThan(100);
    expect(prop, 'static prop screen jitter (px RMS)').toBeLessThanOrEqual(0.25);
    expect(player, 'courier screen jitter (px RMS)').toBeLessThanOrEqual(0.25);
  });
}
