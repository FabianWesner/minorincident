# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual/e25-closure.spec.ts >> T-E25-11 T-E25-12 @E25 @E25-AC11 @E25-AC12 camera angles expose car environment highlights and measured window depth
- Location: tests/visual/e25-closure.spec.ts:125:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 200
Received length: 0
Received array:  []
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]: N ▲
```

# Test source

```ts
  36  |     a.input.set({ interact: true }); await a.step(8); a.input.set({ interact: false });
  37  |     for (let tick = 0; tick < 90; tick++) { await a.step(1); frames.push(a.getState().render.lighting!.lamps.filter(lamp => lamp.group === 'trailer').reduce((sum, lamp) => sum + lamp.emissive, 0)); }
  38  |     // Sample the exact first frame that emits power.off, rather than a later settled frame.
  39  |     let shutdownTick = -1;
  40  |     for (let tick = 0; tick < 100; tick++) { await a.step(1); if (a.events(start).some(event => event.type === 'power.off')) { shutdownTick = a.tick(); break; } }
  41  |     return { id, shutdownTick, events: a.events(start).filter(event => event.type === 'power.on' || event.type === 'power.off').map(event => event.type), frames, end: a.getState().render?.lighting };
  42  |   });
  43  |   writeFileSync(`${out}/power.json`, JSON.stringify(result, null, 2));
  44  |   expect(result.events).toEqual(['power.on', 'power.off']);
  45  |   expect(result.frames.filter((value, index) => index > 0 && value !== result.frames[index - 1])).toHaveLength(3);
  46  |   expect(result.frames.at(-1)).toBe(4);
  47  |   expect(result.end!.lamps.filter(lamp => lamp.group === 'trailer').every(lamp => lamp.emissive === 0)).toBe(true);
  48  |   expect(result.shutdownTick).toBeGreaterThan(0);
  49  |   expect(result.end!.practicalEffects.beams).toBe(0); expect(result.end!.practicalEffects.reflections).toBe(0); expect(result.end!.lightField.litStatics).toBe(0);
  50  | });
  51  |
  52  | test('T-E25-01 @E25 @E25-AC01 headless WebGL tone-mapping comparison records the same trailer and counters', async ({ page }) => {
  53  |   const comparisons = [];
  54  |   for (const tone of ['none', 'agx', 'aces']) {
  55  |     await boot(page, `/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1${tone === 'none' ? '' : `&tone=${tone}`}`);
  56  |     await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, lightLab);
  57  |     await page.locator('canvas').screenshot({ path: `${out}/tone-${tone}.png` });
  58  |     comparisons.push({ tone, ...await page.evaluate(() => ({ backend: window.__SS__!.getState().render.backend, perf: window.__SS__!.perf() })) });
  59  |   }
  60  |   writeFileSync(`${out}/tone-comparison.json`, JSON.stringify(comparisons, null, 2));
  61  |   expect(comparisons.every(item => item.backend === 'webgl')).toBe(true);
  62  | });
  63  |
  64  | test('T-E25-16 @E25 @E25-AC16 production photo spots for the non-L6 lighting review', async ({ page }) => {
  65  |   test.setTimeout(240_000);
  66  |   await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted&dpr=1');
  67  |   for (const [level, spot] of [['L2', 'l2-streets-w1'], ['L3', 'l3-grove-boulevard'], ['L4', 'l4-plaza-safe'], ['L5', 'pair-plaza']]) {
  68  |     await page.evaluate(async ({ level, spot }) => {
  69  |       const a = window.__SS__!; await a.loadLevel(level); a.cheats.god(true); a.missions.begin(); a.pause();
  70  |       if (level === 'L5') { a.cheats.completeObjective('emerge'); await a.step(600); }
  71  |       a.camera.preset(`${level === 'L2' ? 'D-GROVE/W1' : level === 'L3' ? 'D-CORRIDOR/W2' : level === 'L4' ? 'D-FAIR/W0' : 'D-FAIR/W5'}/${spot}`);
  72  |       await a.step(90);
  73  |       if (level === 'L5') for (let i = 0; i < 150; i++) a.vfx.stepRender(.1);
  74  |       await a.screenshotReady();
  75  |     }, { level, spot });
  76  |     await page.locator('canvas').screenshot({ path: `${out}/${spot}.png` });
  77  |     writeFileSync(`${out}/${spot}.json`, JSON.stringify(await page.evaluate(() => window.__SS__!.getState().render.lighting), null, 2));
  78  |   }
  79  |   await scene(page, { name: 'mall-floor', ground: 'asphalt', size: 30, time: 'night', dof: false, props: [{ asset: 'int.mini-mall', at: [0, 0] }], actors: [{ kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [10, 8, 14], target: [0, 1, 0] } });
  80  |   await page.locator('canvas').screenshot({ path: `${out}/mall-floor.png` });
  81  | });
  82  |
  83  | test('T-E25-10 @E25 @E25-AC10 wet reflection splats exceed the dry surface on both tiers', async ({ page }) => {
  84  |   const lab: SceneSpec = { name: 'reflection-lab', ground: 'asphalt', size: 40, time: 'night', dof: false,
  85  |     props: [{ asset: 'prop.street-lamp', at: [3, 0] }, { asset: 'prop.jukebox', at: [-3, 0] }],
  86  |     actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] } };
  87  |   const result = [];
  88  |   for (const quality of ['high', 'low'] as const) {
  89  |     await boot(page, `/?test=1&scenelab&renderer=webgl&quality=${quality}&audio=muted&dpr=1`);
  90  |     const images: PNG[] = [];
  91  |     for (const wet of [false, true]) {
  92  |       const spec: SceneSpec = { ...lab, weather: wet ? 'rain' : 'clear', weatherWarmup: wet ? 120 : 0 };
  93  |       await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, spec);
  94  |       images.push(PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/reflection-${quality}-${wet ? 'wet' : 'dry'}.png` })));
  95  |     }
  96  |     const points = await page.evaluate(() => window.__SS__!.getState().render.lighting!.lamps.map(lamp => window.__SS__!.camera.project(lamp.position[0], .05, lamp.position[2] + 1.5)));
  97  |     const samples = points.map(point => ({ dry: patch(images[0], point), wet: patch(images[1], point) }));
  98  |     result.push({ quality, samples, points });
  99  |     for (const sample of samples) expect(sample.wet / sample.dry).toBeGreaterThan(2);
  100 |   }
  101 |   writeFileSync(`${out}/reflections.json`, JSON.stringify(result, null, 2));
  102 | });
  103 |
  104 | /** Project a scanline on the actual bundled front-window primitive, so camera
  105 |  * rotation is removed before measuring the pattern's movement within its frame. */
  106 | async function windowLine(page: import('@playwright/test').Page): Promise<number[][]> {
  107 |   return page.evaluate(() => {
  108 |     const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
  109 |     let line: number[][] = [];
  110 |     game.view.labProbes().districts?.traverse(object => {
  111 |       const mesh = object as import('three').InstancedMesh;
  112 |       if (!mesh.isInstancedMesh || !mesh.count || !mesh.geometry.hasAttribute('_window')) return;
  113 |       const g = mesh.geometry, mask = g.getAttribute('_window'), light = g.getAttribute('_light'), normal = g.getAttribute('normal'), positions = g.getAttribute('position');
  114 |       const vertices: number[][] = [];
  115 |       const instance = mesh.matrixWorld.clone(); mesh.getMatrixAt(0, instance);
  116 |       for (let i = 0; i < mask.count; i++) if (mask.getX(i) === 1 && light.getX(i) === 2 && normal.getX(i) > .8) vertices.push(mesh.position.clone().set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).toArray());
  117 |       if (!vertices.length) return;
  118 |       const min = [0, 1, 2].map(axis => Math.min(...vertices.map(p => p[axis]))), max = [0, 1, 2].map(axis => Math.max(...vertices.map(p => p[axis])));
  119 |       line = Array.from({ length: 200 }, (_, i) => window.__SS__!.camera.project(max[0] + .002, min[1] + (max[1] - min[1]) * .7, min[2] + (max[2] - min[2]) * i / 199));
  120 |     });
  121 |     return line;
  122 |   });
  123 | }
  124 |
  125 | test('T-E25-11 T-E25-12 @E25 @E25-AC11 @E25-AC12 camera angles expose car environment highlights and measured window depth', async ({ page }) => {
  126 |   test.setTimeout(180_000);
  127 |   const house: SceneSpec = { name: 'interior-window', ground: 'asphalt', size: 30, time: 'night', dof: false, props: [{ asset: 'bld.house-a', at: [0, 0], powerGroup: 'residential' }] };
  128 |   const scenes: SceneSpec[] = [{ name: 'material-classes', ground: 'asphalt', size: 30, time: 'L4', dof: false, props: [{ asset: 'veh.sedan-green', at: [0, 0] }, { asset: 'prop.bench', at: [-5, 0] }] }, house];
  129 |   const evidence = [], windows: { angle: number; line: number[][]; luminance: number[]; edge: number; width: number }[] = [];
  130 |   for (const subject of scenes) for (const angle of [45, 60]) {
  131 |     const radians = angle * Math.PI / 180;
  132 |     await scene(page, { ...subject, camera: { mode: 'pose', position: [Math.cos(radians) * 12, 7, Math.sin(radians) * 12], target: [0, 1.3, 0] } });
  133 |     const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${subject.name}-${angle}.png` }));
  134 |     evidence.push({ subject: subject.name, angle, lighting: await page.evaluate(() => window.__SS__!.getState().render.lighting) });
  135 |     if (subject === house) {
> 136 |       const line = await windowLine(page); expect(line).toHaveLength(200);
      |                                                         ^ Error: expect(received).toHaveLength(expected)
  137 |       const luminance = line.map(point => patch(image, point, 1));
  138 |       // Exclude the physical perimeter/middle mullion. The room's far wall
  139 |       // ends at a bright-to-dark boundary inside the central panes.
  140 |       let edge = 0, gradient = -Infinity;
  141 |       for (let i = 65; i < 138; i++) if (i < 88 || i > 112) { const delta = luminance[i - 2] - luminance[i + 2]; if (delta > gradient) { gradient = delta; edge = i; } }
  142 |       const width = Math.hypot((line.at(-1)![0] - line[0][0]) * image.width / 2, (line.at(-1)![1] - line[0][1]) * image.height / 2);
  143 |       windows.push({ angle, line, luminance, edge, width });
  144 |     }
  145 |   }
  146 |   const shiftPx = Math.abs(windows[0].edge - windows[1].edge) / 199 * Math.min(windows[0].width, windows[1].width);
  147 |   await scene(page, { ...house, props: house.props!.map(prop => ({ ...prop, powered: false })), camera: { mode: 'pose', position: [Math.SQRT1_2 * 12, 7, Math.SQRT1_2 * 12], target: [0, 1.3, 0] } });
  148 |   const off = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/interior-window-off.png` }));
  149 |   const dark = windows[0].line.map(point => patch(off, point, 1)), glowRatio = Math.max(...windows[0].luminance) / Math.max(...dark);
  150 |   writeFileSync(`${out}/surfaces.json`, JSON.stringify({ evidence, windows, shiftPx, dark, glowRatio }, null, 2));
  151 |   expect(shiftPx).toBeGreaterThanOrEqual(4); expect(glowRatio).toBeGreaterThan(4);
  152 |   expect(await page.evaluate(() => window.__SS__!.getState().render.lighting!.lamps.every(lamp => lamp.emissive === 0))).toBe(true);
  153 | });
  154 |
  155 | test('T-E25-09 @E25 @E25-AC09 four spot cones fade across their ground intersection', async ({ page }) => {
  156 |   await scene(page, lightLab);
  157 |   const point = await page.evaluate(() => window.__SS__!.camera.project(3.5, .04, 0));
  158 |   const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/beam-intersection.png` }));
  159 |   const cx = Math.round((point[0] + 1) / 2 * image.width), cy = Math.round((1 - point[1]) / 2 * image.height);
  160 |   let gradient = 0;
  161 |   for (let y = cy - 15; y < cy + 15; y++) for (let x = cx - 15; x < cx + 15; x++) {
  162 |     const at = (y * image.width + x) * 4, next = at + image.width * 4;
  163 |     gradient = Math.max(gradient, Math.abs(lum(image.data[at], image.data[at + 1], image.data[at + 2]) - lum(image.data[next], image.data[next + 1], image.data[next + 2])));
  164 |   }
  165 |   const effects = await page.evaluate(() => window.__SS__!.getState().render.lighting!.practicalEffects);
  166 |   writeFileSync(`${out}/beam-intersection.json`, JSON.stringify({ gradient, effects, point }, null, 2));
  167 |   expect(effects.beams).toBe(4); expect(gradient).toBeLessThanOrEqual(.25);
  168 | });
  169 |
  170 | test('T-E25-15 @E25 @E25-AC15 production asset turntable emits night on/off views', async ({ page, baseURL }) => {
  171 |   const { captureTurntable } = await import('../../tools/assets/turntable');
  172 |   const coverage = await captureTurntable(page, 'prop.light-tower-trailer', `${out}/turntable`, baseURL!);
  173 |   expect(coverage.every(value => value > 0)).toBe(true);
  174 |   // Reusing main's batch viewer must retain night-off for the newly loaded asset.
  175 |   await page.evaluate(async () => {
  176 |     const a = window.__ASSET__!; await a.lighting!(true, false); await a.selectAsset!('prop.jukebox');
  177 |   });
  178 |   const switched = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/turntable/batch-night-off.png` }));
  179 |   await page.evaluate(async () => { await window.__ASSET__!.lighting!(true, false); });
  180 |   const explicit = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/turntable/batch-night-off-explicit.png` }));
  181 |   let difference = 0, maximumDifference = 0;
  182 |   for (let i = 0; i < switched.data.length; i++) if (i % 4 !== 3) {
  183 |     const delta = Math.abs(switched.data[i] - explicit.data[i]);
  184 |     difference += delta; maximumDifference = Math.max(maximumDifference, delta);
  185 |   }
  186 |   const meanDifference = difference / (switched.width * switched.height * 3);
  187 |   writeFileSync(`${out}/turntable/batch-power.json`, JSON.stringify({ meanDifference, maximumDifference }, null, 2));
  188 |   expect(meanDifference).toBeLessThan(.5);
  189 |   expect(maximumDifference).toBeLessThanOrEqual(2);
  190 | });
  191 |
  192 | test('T-E25-05v @E25 @E25-AC05 sixty seconds past forty lights: promotion rate and per-frame pool luminance', async ({ page }) => {
  193 |   test.setTimeout(900_000);
  194 |   await scene(page, { name: 'forty-lights', ground: 'asphalt', size: 220, time: 'night', dof: false,
  195 |     props: Array.from({ length: 40 }, (_, i) => ({ asset: 'prop.street-lamp', at: [i * 2.5 - 50, 0] as [number, number] })),
  196 |     actors: [{ kind: 'courier', at: [-55, 4] }], camera: { mode: 'game', target: [-55, 4] } });
  197 |   await page.evaluate(() => window.__SS__!.camera.follow());
  198 |   const viewport = page.viewportSize()!;
  199 |   const samples = []; let maxDelta = 0;
  200 |   const prior = new Map<string, number>(), measured = new Map<string, number>();
  201 |   for (let frame = 0; frame < 3600; frame++) {
  202 |     const state = await page.evaluate(async () => {
  203 |       const a = window.__SS__!; a.input.set({ move: { x: 1, z: 0 }, walk: true }); await a.step(1); await a.screenshotReady();
  204 |       const p = a.getEntity(1)!.transform, lighting = a.getState().render.lighting!;
  205 |       // Fixed ground samples in each pool's central 2 m region, clear of the lamp's solid base.
  206 |       const points = lighting.lamps.filter(lamp => Math.abs(lamp.position[0] - p.x) < 8).map(lamp => ({ id: lamp.id, point: a.camera.project(lamp.position[0] + 1, .05, lamp.position[2] + 1) }));
  207 |       return { tick: a.tick(), x: p.x, lighting, points };
  208 |     });
  209 |     const { width, height } = viewport;
  210 |     const points = state.points.map(probe => ({ id: probe.id, x: Math.round((probe.point[0] + 1) / 2 * width), y: Math.round((1 - probe.point[1]) / 2 * height) })).filter(probe => probe.x > 8 && probe.x < width - 8 && probe.y > 8 && probe.y < height - 8);
  211 |     const x = Math.min(...points.map(p => p.x)) - 4, y = Math.min(...points.map(p => p.y)) - 4;
  212 |     const clip = { x, y, width: Math.max(...points.map(p => p.x)) + 5 - x, height: Math.max(...points.map(p => p.y)) + 5 - y };
  213 |     const image = points.length ? PNG.sync.read(await page.screenshot({ clip })) : null;
  214 |     const pools = points.map(p => {
  215 |       let mean = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const at = ((p.y - y + dy) * image!.width + p.x - x + dx) * 4; mean += lum(image!.data[at], image!.data[at + 1], image!.data[at + 2]); } mean /= 81;
  216 |       const before = prior.get(p.id); if (before !== undefined && before > .001) maxDelta = Math.max(maxDelta, Math.abs(mean - before) / before);
  217 |       prior.set(p.id, mean); measured.set(p.id, (measured.get(p.id) ?? 0) + 1); return { id: p.id, luminance: mean };
  218 |     });
  219 |     for (const id of prior.keys()) if (!points.some(point => point.id === id)) prior.delete(id);
  220 |     samples.push({ tick: state.tick, x: state.x, hero: state.lighting.heroLight, blend: state.lighting.promotionBlend, pools });
  221 |     expect(state.lighting.heroLights).toBeLessThanOrEqual(8); expect(state.lighting.heroShadowMaps).toBeLessThanOrEqual(3);
  222 |   }
  223 |   const rate = new Map<number, number>(); let hero = samples[0].hero;
  224 |   for (const sample of samples) if (sample.hero !== hero) { const second = Math.floor((sample.tick - samples[0].tick) / 60); rate.set(second, (rate.get(second) ?? 0) + 1); hero = sample.hero; }
  225 |   writeFileSync(`${out}/hero-walk.json`, JSON.stringify({ samples, changesPerSecond: [...rate], measured: [...measured], maxDelta }, null, 2));
  226 |   expect(measured.size).toBe(40); expect(Math.min(...measured.values())).toBeGreaterThan(18);
  227 |   expect(samples.at(-1)!.x - samples[0].x).toBeGreaterThan(110);
  228 |   expect(Math.max(...rate.values())).toBeLessThanOrEqual(2); expect(maxDelta).toBeLessThanOrEqual(.15);
  229 | });
  230 |
```
