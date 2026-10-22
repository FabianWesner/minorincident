# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/horde.spec.ts >> T-E07-12 @E07 @E07-AC12 @perf 200 infected render in fixed scene graph and at most 30 crowd draws
- Location: tests/perf/horde.spec.ts:7:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 141
Received: 185
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: N ▲
```

# Test source

```ts
  1  | import { regularInfectedModels } from '../../src/data/crowdAppearance';
  2  | import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
  3  | import { expect, test, boot } from '../e2e/fixtures';
  4  | import { PNG } from 'pngjs';
  5  | import { infectedDefinitions } from '../../src/data/infected';
  6  | const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; status: string }[];
  7  | test('T-E07-12 @E07 @E07-AC12 @perf 200 infected render in fixed scene graph and at most 30 crowd draws', async ({ page }) => {
  8  |   mkdirSync('test-results/epics/E07', { recursive: true });
  9  |   await boot(page); await page.evaluate(async () => {
  10 |     const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
  11 |     for (let i = 0; i < 200; i++) api.spawn('infected.runner', i === 199 ? { x: 50, z: 50 } : { x: i % 20 * 0.8 - 8, z: Math.floor(i / 20) * 0.8 - 4 }, { state: 'chase' });
  12 |     await api.step(0); await api.screenshotReady();
  13 |   });
  14 |   const proof = await page.evaluate(() => ({ ai: window.__SS__!.getState().ai!, crowd: window.__SS__!.getState().render.crowd!, perf: window.__SS__!.perf() }));
  15 |   const runners = proof.crowd.batches.filter((b) => b.id === 'infected.runner' || regularInfectedModels.some(model=>model===b.id));
  16 |   if (manifest.find((asset) => asset.id === 'inf.common-worker')!.status === 'integrated') expect(runners.every(batch => batch.source === 'glb' || batch.source === 'pending' && batch.instances === 0)).toBe(true);
  17 |   expect(proof.ai.count).toBe(200);
  18 |   const rendered = runners.reduce((sum, batch) => sum + batch.instances, 0);
  19 |   expect(rendered).toBeGreaterThan(0); expect(rendered).toBeLessThan(200);
  20 |   expect(runners.filter(batch => batch.lod === 'lod0').reduce((n,b)=>n+b.instances,0)).toBe(8);
  21 |   expect(proof.crowd.meshDrawCalls).toBeLessThanOrEqual(30); expect(proof.crowd.nonInstancedMeshes).toBe(0);
> 22 |   expect(proof.crowd.objects).toBe(proof.crowd.batches.length + 3); // Fixed cap/shadow meshes and the empty static-corpse group; telegraphs live in VfxView.
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  23 |   const offscreen = await page.evaluate(() => {
  24 |     const api = window.__SS__!, e = api.query({ kind: 'infected' }).find(e => e.transform.x === 50)!;
  25 |     return { projected: api.camera.project(e.transform.x, e.transform.y, e.transform.z), drawn: api.crowdFigures().some(f => f.id === e.id && f.drawn) };
  26 |   });
  27 |   expect(Math.max(Math.abs(offscreen.projected[0]), Math.abs(offscreen.projected[1]))).toBeGreaterThan(1.5);
  28 |   expect(offscreen.drawn).toBe(false);
  29 |   mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/render-perf.json', JSON.stringify(proof, null, 2) + '\n');
  30 |   await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-200.png' });
  31 |   // Death retains bodies; only an explicit level reset provides an empty crowd baseline.
  32 |   const settled = await page.evaluate(async () => {
  33 |     const api = window.__SS__!; api.cheats.killAll(); await api.step(121); await api.screenshotReady();
  34 |     return { corpses: api.query({ kind: 'infected' }).filter(e => e.corpse).length, active: api.getState().ai!.count, draws: api.perf().drawCalls };
  35 |   });
  36 |   expect(settled.corpses).toBe(200); expect(settled.active).toBe(0);
  37 |   const before = proof.perf.drawCalls; const after = await page.evaluate(async () => {
  38 |     const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause(); await api.screenshotReady(); return api.perf().drawCalls;
  39 |   });
  40 |   expect(before - after).toBeGreaterThan(0); expect(before - after).toBeLessThanOrEqual(30);
  41 |   writeFileSync('test-results/epics/E07/render-perf.json', JSON.stringify({ ...proof, settled, emptyDrawCalls: after, crowdDrawDelta: before - after }, null, 2) + '\n');
  42 |   const roles = infectedDefinitions.filter((def) => def.id !== 'infected.crow').map((def) => def.id);
  43 |   const mixed = await page.evaluate(async (roles) => {
  44 |     const api = window.__SS__!;
  45 |     for (let i = 0; i < 190; i++) api.spawn(roles[i % roles.length], { x: i % 20 * 1.2 - 12, z: Math.floor(i / 20) * 1.2 - 6 }, { state: 'idle', perched: false });
  46 |     api.spawn('infected.crow', { x: -8, z: -4 }); api.spawn('infected.crow', { x: 8, z: -4 });
  47 |     await api.step(0); await api.screenshotReady(); return api.getState();
  48 |   }, roles);
  49 |   expect(mixed.ai!.count).toBe(200); expect(mixed.render.crowd!.meshDrawCalls).toBeLessThanOrEqual(30); expect(mixed.render.crowd!.objects).toBe(proof.crowd.objects); expect(mixed.render.crowd!.nonInstancedMeshes).toBe(0);
  50 |   await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-archetypes.png' });
  51 |   writeFileSync('test-results/epics/E07/mixed-render.json', JSON.stringify(mixed.render.crowd, null, 2) + '\n');
  52 | });
  53 | test('T-E07-13 @E07 @E07-AC13 @vision golden-hour street has 60 separable runners glowing eyes and an identifiable player', async ({ page }) => {
  54 |   mkdirSync('test-results/epics/E07', { recursive: true });
  55 |   await boot(page); await page.evaluate(async () => {
  56 |     const api = window.__SS__!; await api.loadScenario('horde-readability'); api.pause();
  57 |     for (let i = 0; i < 60; i++) api.spawn('infected.runner', { x: i % 6 * 0.9 - 2.3, z: Math.floor(i / 6) * 1.2 - 14 }, { state: 'idle', yaw: -Math.PI / 4 });
  58 |     api.spawn('weapon.bat', { x: -3, z: 3 }); api.spawn('weapon.grenade', { x: 2, z: 5 });
  59 |     api.camera.preset('horde-readability'); api.settings.set({ timeOfDay: 'golden', bloom: true }); await api.step(0); await api.screenshotReady();
  60 |   });
  61 |   const image = await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-readability.png' }), pixels = PNG.sync.read(image);
  62 |   let eyePixels = 0, redPixels = 0;
  63 |   for (let i = 0; i < pixels.data.length; i += 4) { const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]; if (r > 200 && r > g * 1.8 && r > b * 1.8) eyePixels++; if (r > 110 && r > g * 1.4 && r > b * 1.2) redPixels++; }
  64 |   expect(eyePixels).toBeGreaterThan(40); expect(redPixels).toBeGreaterThan(200);
  65 |   const state = await page.evaluate(() => window.__SS__!.getState()); expect(state.ai!.count).toBe(60); const visibleRunners = state.render.crowd!.batches.filter((b) => b.id === 'infected.runner' || regularInfectedModels.some(model=>model===b.id)).reduce((sum, batch) => sum + batch.instances, 0); expect(visibleRunners).toBeGreaterThan(0); expect(visibleRunners).toBeLessThanOrEqual(60); expect(state.render.lighting!.preset).toBe('golden');
  66 |   await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  67 |   const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/player-mask.png' }));
  68 |   let heroPixels = 0; for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) heroPixels++;
  69 |   expect(heroPixels).toBeGreaterThan(1000);
  70 |   await page.evaluate(async () => { const api = window.__SS__!; api.settings.set({ idPass: false }); api.spawn('infected.brute', { x: -2, z: -2 }, { state: 'chase' }); api.spawn('infected.runner', { x: -1.5, z: 1 }, { state: 'chase' }); await api.step(1); await api.screenshotReady(); });
  71 |   await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/telegraphs.png' });
  72 |   const burst = await page.evaluate(async () => {
  73 |     const api = window.__SS__!;
  74 |     // The varied 60-person scene above checks readability. Keep this separate three-archetype corpse fixture
  75 |     // at its original 63 bodies and seven draws; an explicit worker reference is intentional here.
  76 |     await api.loadScenario('horde-readability'); api.pause(); api.camera.preset('horde-readability');
  77 |     for (let i=0;i<60;i++) api.spawn('infected.runner', {x:i%6*.9-2.3,z:Math.floor(i/6)*1.2-14}, {state:'idle',variant:'inf.common-worker'});
  78 |     api.spawn('infected.brute',{x:-2,z:-2},{state:'chase'});
  79 |     api.spawn('infected.runner',{x:-1.5,z:1},{state:'chase',variant:'inf.common-worker'});
  80 |     api.spawn('infected.bloated', { x: 3, z: 0 }, { state: 'idle' }); api.cheats.killAll(); await api.step(1); await api.screenshotReady();
  81 |     return {state:api.getState(),bodies:api.query({kind:'infected'}).length};
  82 |   });
  83 |   expect(burst.bodies).toBe(63);
  84 |   expect(burst.state.render.crowd!.meshDrawCalls).toBeLessThanOrEqual(7); // Three corpse archetypes can each occupy two LODs, plus one explosion telegraph.
  85 |   await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/bloated-windup.png' });
  86 |   writeFileSync('test-results/epics/E07/readability.json', JSON.stringify({ eyePixels, redPixels, heroPixels, crowd: state.render.crowd, lighting: state.render.lighting }, null, 2) + '\n');
  87 | });
  88 | 
```