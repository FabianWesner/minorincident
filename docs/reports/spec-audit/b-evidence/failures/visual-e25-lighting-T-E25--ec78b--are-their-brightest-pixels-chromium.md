# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual/e25-lighting.spec.ts >> T-E25-13 @E25 @E25-AC13 night-street: player contrast against its 2 m ring with no practical light nearby; infected eyes are their brightest pixels
- Location: tests/visual/e25-lighting.spec.ts:43:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 60
Received:    -60
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: N ▲
```

# Test source

```ts
  1   | import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import { PNG } from 'pngjs';
  3   | import { test, expect, boot } from '../e2e/fixtures';
  4   | import type { Page } from '@playwright/test';
  5   |
  6   | const out = 'test-results/epics/E25';
  7   | const lum = (r: number, g: number, b: number) => { const c = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };
  8   | const hue = (r: number, g: number, b: number) => { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min || 1; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  9   | async function shot(page: Page, name: string) { return PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}.png` })); }
  10  | /** Average colour of a small disc of canvas pixels around an NDC point. */
  11  | function patch(png: PNG, ndc: number[], radius = 6) {
  12  |   const cx = Math.round((ndc[0] + 1) / 2 * png.width), cy = Math.round((1 - ndc[1]) / 2 * png.height); let r = 0, g = 0, b = 0, n = 0;
  13  |   for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
  14  |     if (x < 0 || y < 0 || x >= png.width || y >= png.height || Math.hypot(x - cx, y - cy) > radius) continue;
  15  |     const i = (y * png.width + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  16  |   }
  17  |   return { r: r / n, g: g / n, b: b / n, l: lum(r / n, g / n, b / n) };
  18  | }
  19  | const lampSpot = { x: 62.2, z: -1.4 };
  20  |
  21  | test.beforeAll(() => mkdirSync(out, { recursive: true }));
  22  |
  23  | test('T-E25-moods @E25 @vision game-camera mood per time-of-day preset: readable player, infected and pickups', async ({ page }) => {
  24  |   test.setTimeout(180_000);
  25  |   await boot(page);
  26  |   await page.evaluate(async (spot) => {
  27  |     const a = window.__SS__!; await a.loadLevel('D-GROVE'); a.pause(); a.cheats.god(true);
  28  |     a.teleport('player', spot);
  29  |     for (let i = 0; i < 6; i++) a.spawn('infected.runner', { x: 58 + i * 1.3, z: 2 + (i % 2) }, { state: 'idle', yaw: -Math.PI / 4 });
  30  |     a.spawn('weapon.pistol', { x: spot.x + 2.5, z: spot.z + 2 });
  31  |     a.camera.follow(); await a.step(30); await a.screenshotReady();
  32  |   }, lampSpot);
  33  |   const report: Record<string, unknown> = {};
  34  |   for (const preset of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'night'] as const) {
  35  |     report[preset] = await page.evaluate(async (preset) => { const a = window.__SS__!; a.settings.set({ timeOfDay: preset }); await a.step(1); await a.screenshotReady(); return { lighting: a.perf().lighting, drawCalls: a.perf().drawCalls }; }, preset);
  36  |     await shot(page, `mood-${preset}`);
  37  |   }
  38  |   writeFileSync(`${out}/moods.json`, JSON.stringify(report, null, 2) + '\n');
  39  |   const moods = report as Record<string, { lighting: { lightPools: number; preset: string } }>;
  40  |   expect(moods.L1.lighting.lightPools).toBe(0); expect(moods.night.lighting.lightPools).toBeGreaterThan(40);
  41  | });
  42  |
  43  | test('T-E25-13 @E25 @E25-AC13 night-street: player contrast against its 2 m ring with no practical light nearby; infected eyes are their brightest pixels', async ({ page }) => {
  44  |   test.setTimeout(180_000);
  45  |   await boot(page);
  46  |   const setup = await page.evaluate(async () => {
  47  |     const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
  48  |     const spot = { x: 51, z: -32.5 }; a.teleport('player', spot);
  49  |     // The AI turns idle threats towards the courier during the warm-up. Keep them
  50  |     // southwest on the open road, outside the contrast ring, with faces in the viewport.
  51  |     const ids = [0, 1, 2].map(i => a.spawn('infected.runner', { x: spot.x - 4 - i * .6, z: spot.z + 2.5 }, { state: 'idle', yaw: -Math.PI / 4 }));
  52  |     a.camera.follow(); await a.step(90); await a.screenshotReady();
  53  |     const p = a.query({ kind: 'player' })[0]?.transform ?? a.getEntity(1)!.transform;
  54  |     const ring = [0, 1, 2, 3, 4, 5, 6, 7].map(k => a.camera.project(p.x + 2 * Math.cos(k * Math.PI / 4), .05, p.z + 2 * Math.sin(k * Math.PI / 4)));
  55  |     const heads = ids.map(id => { const t = a.getEntity(id)!.transform; return { head: a.camera.project(t.x, t.y + .75, t.z), feet: a.camera.project(t.x, t.y - .7, t.z) }; });
  56  |     return { ring, heads, lighting: a.perf().lighting, pools: a.lights.state() };
  57  |   });
  58  |   expect(setup.lighting!.preset).toBe('night');
  59  |   for (const { head } of setup.heads) for (const ndc of head.slice(0, 2)) expect(Math.abs(ndc), 'Eyes must be inside the camera viewport').toBeLessThan(.95);
  60  |   const image = await shot(page, 'night-street');
  61  |   await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  62  |   const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/night-street-player-mask.png` }));
  63  |   await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
  64  |   let sum = 0, n = 0;
  65  |   for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += lum(image.data[i], image.data[i + 1], image.data[i + 2]); n++; }
  66  |   // Ring samples hidden behind the survivor's own silhouette are not part of its surroundings.
  67  |   const covered = (ndc: number[]) => { const i = (Math.round((1 - ndc[1]) / 2 * mask.height) * mask.width + Math.round((ndc[0] + 1) / 2 * mask.width)) * 4; return mask.data[i] > 240 && mask.data[i + 1] < 20; };
  68  |   const ringPatches = setup.ring.filter(p => !covered(p)).map(p => patch(image, p, 5)), player = sum / n, ring = ringPatches.reduce((s, v) => s + v.l, 0) / ringPatches.length;
  69  |   const contrast = (player + .05) / (ring + .05);
  70  |   // Eyes: inside each infected's head box, the brightest pixel is red-dominant.
  71  |   const eyes = setup.heads.map(({ head, feet }) => {
  72  |     const x0 = Math.round((head[0] + 1) / 2 * image.width), y0 = Math.round((1 - head[1]) / 2 * image.height), y1 = Math.round((1 - feet[1]) / 2 * image.height), half = Math.max(8, Math.round((y1 - y0) * .45));
  73  |     let best = { l: -1, r: 0, g: 0, b: 0 };
  74  |     for (let y = y0 - half; y <= y1; y++) for (let x = x0 - half; x <= x0 + half; x++) { const i = (y * image.width + x) * 4, l = lum(image.data[i], image.data[i + 1], image.data[i + 2]); if (l > best.l) best = { l, r: image.data[i], g: image.data[i + 1], b: image.data[i + 2] }; }
  75  |     return best;
  76  |   });
  77  |   writeFileSync(`${out}/night-readability.json`, JSON.stringify({ playerPixels: n, player, ring, contrast, ringPatches, ringNdc: setup.ring, eyes, lighting: setup.lighting, pools: setup.pools }, null, 2) + '\n');
  78  |   expect(n).toBeGreaterThan(800);
  79  |   expect(contrast).toBeGreaterThanOrEqual(3);
  80  |   // Bloomed eye centres saturate towards pink-white; the brightest pixel must still be clearly red (hue 330-20°).
> 81  |   for (const eye of eyes) { expect(eye.r - Math.max(eye.g, eye.b)).toBeGreaterThanOrEqual(60); const h = hue(eye.r, eye.g, eye.b); expect(h >= 330 || h <= 20).toBe(true); }
      |                                                                    ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  82  | });
  83  |
  84  | test('T-E25-06 @E25 @E25-AC06 hero shadow: under a promoted hero lamp the survivor shadow is >=35% darker than beside it and tinted, not black', async ({ page }) => {
  85  |   test.setTimeout(180_000);
  86  |   await boot(page);
  87  |   const probe = await page.evaluate(async (spot) => {
  88  |     const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
  89  |     a.teleport('player', spot); a.camera.follow(); await a.step(90); await a.screenshotReady();
  90  |     const lighting = a.getState().render.lighting!, p = a.getEntity(1)!.transform, d = lighting.shadowDirection as number[];
  91  |     const h = Math.hypot(d[0], d[2]), ax = -d[0] / h, az = -d[2] / h;
  92  |     // Behind: along the cast direction, past the feet. Beside: the same distance, perpendicular, still inside the pool.
  93  |     return { lighting, perf: a.perf().lighting, behind: a.camera.project(p.x + ax * .9, .03, p.z + az * .9), beside: a.camera.project(p.x - az * .9, .03, p.z + ax * .9) };
  94  |   }, lampSpot);
  95  |   const image = await shot(page, 'hero-shadow');
  96  |   const behind = patch(image, probe.behind, 4), beside = patch(image, probe.beside, 4);
  97  |   writeFileSync(`${out}/hero-shadow.json`, JSON.stringify({ ...probe, behindColor: behind, besideColor: beside, darker: 1 - behind.l / beside.l, hue: hue(behind.r, behind.g, behind.b) }, null, 2) + '\n');
  98  |   expect(probe.perf!.heroShadow).toBe(1); expect(probe.perf!.shadowMaps).toBe(1);
  99  |   expect(1 - behind.l / beside.l).toBeGreaterThanOrEqual(.35);
  100 |   const h = hue(behind.r, behind.g, behind.b); expect(h).toBeGreaterThanOrEqual(230); expect(h).toBeLessThanOrEqual(290);
  101 | });
  102 |
```
