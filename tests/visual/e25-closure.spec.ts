import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, test, expect } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

test.use({ headless: true, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });

const out = 'test-results/epics/E25/closure';
export const lightLab: SceneSpec = {
  name: 'light-lab', ground: 'asphalt', size: 50, time: 'night', dof: false,
  props: [{ id: 'trailer', asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' },
    { id: 'fence', asset: 'prop.privacy-fence', at: [8, 0], yaw: 0, scale: [1, 1, 4] }],
  actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }],
  camera: { mode: 'pose', position: [20, 23, 25], target: [0, 0, 0] },
};
const lum = (r: number, g: number, b: number) => { const f = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
function patch(image: PNG, point: number[], radius = 4) {
  const cx = Math.round((point[0] + 1) / 2 * image.width), cy = Math.round((1 - point[1]) / 2 * image.height); let sum = 0, n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) { const at = (y * image.width + x) * 4; sum += lum(image.data[at], image.data[at + 1], image.data[at + 2]); n++; }
  return sum / n;
}
async function scene(page: import('@playwright/test').Page, spec: SceneSpec) { await boot(page, '/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1'); await page.evaluate(async spec => { await window.__SCENE__!.load(spec); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, spec); mkdirSync(out, { recursive: true }); }

test.describe('actual backend pool parity', () => {
  for (const quality of ['high', 'low']) test(`T-E25-04 @E25 @E25-AC04 ${quality} identical trailer pool mask differs by at most ten percent`, async ({ page }) => {
    mkdirSync(out, { recursive: true });
    const samples: { backend: string; mean: number; pixels: number }[] = [];
    let mask: Set<number> | undefined;
    for (const backend of ['webgl', 'webgpu']) {
      await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
      await page.evaluate(async spec => { await window.__SCENE__!.load(spec); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, lightLab);
      expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(backend);
      const png = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/parity-${quality}-${backend}.png` }));
      if (!mask) {
        // Include the pool's bright core and falloff, away from the trailer and fence.
        // Rasterize it once and use precisely the same screen pixels on both backends.
        const points = await page.evaluate(() => Array.from({ length: 57 * 49 }, (_, i) => window.__SS__!.camera.project(-7 + (i % 57) * .25, .05, -6 + Math.floor(i / 57) * .25)));
        mask = new Set<number>();
        for (const point of points) {
          const cx = Math.round((point[0] + 1) / 2 * png.width), cy = Math.round((1 - point[1]) / 2 * png.height);
          for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && y >= 0 && x < png.width && y < png.height) mask.add((y * png.width + x) * 4);
        }
      }
      expect(mask.size).toBeGreaterThan(1000);
      const mean = [...mask].reduce((sum, i) => sum + lum(png.data[i], png.data[i + 1], png.data[i + 2]), 0) / mask.size;
      expect(mean).toBeGreaterThan(.1); samples.push({ backend, mean, pixels: mask.size });
    }
    const relativeDifference = Math.abs(samples[1].mean - samples[0].mean) / samples[0].mean;
    writeFileSync(`${out}/parity-${quality}.json`, JSON.stringify({ samples, relativeDifference }, null, 2));
    expect(relativeDifference).toBeLessThanOrEqual(.1);
  });
});

test('T-E25-03 @E25 @E25-AC03 trailer pool ends at the fence and exceeds ambient by four', async ({ page }) => {
  await scene(page, lightLab);
  const points = await page.evaluate(() => [window.__SS__!.camera.project(3, .05, 0), window.__SS__!.camera.project(3, .05, 8), window.__SS__!.camera.project(11, .05, 0)]);
  const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/light-lab.png` }));
  const [inside, ambient, behind] = points.map(point => patch(image, point));
  writeFileSync(`${out}/light-lab.json`, JSON.stringify({ inside, ambient, behind, points }, null, 2));
  expect(inside / ambient).toBeGreaterThanOrEqual(4); expect(behind / ambient).toBeLessThanOrEqual(1.3);
});

test('T-E25-07 @E25 @E25-AC07 generator startup and one-frame shutdown drive every visible channel', async ({ page }) => {
  await scene(page, { ...lightLab, props: lightLab.props!.map(p => p.id === 'trailer' ? { ...p, powered: false } : p) });
  const result = await page.evaluate(async () => {
    const a = window.__SS__!, frames: number[] = [], start = a.tick();
    const id = a.spawn('device.generator', { x: -12, z: -8 }, { fuel: 3, holdTime: .1, powerGroup: 'trailer' });
    a.input.set({ interact: true }); await a.step(8); a.input.set({ interact: false });
    for (let tick = 0; tick < 90; tick++) { await a.step(1); frames.push(a.getState().render.lighting!.lamps.filter(lamp => lamp.group === 'trailer').reduce((sum, lamp) => sum + lamp.emissive, 0)); }
    // Sample the exact first frame that emits power.off, rather than a later settled frame.
    let shutdownTick = -1;
    for (let tick = 0; tick < 100; tick++) { await a.step(1); if (a.events(start).some(event => event.type === 'power.off')) { shutdownTick = a.tick(); break; } }
    return { id, shutdownTick, events: a.events(start).filter(event => event.type === 'power.on' || event.type === 'power.off').map(event => event.type), frames, end: a.getState().render?.lighting };
  });
  writeFileSync(`${out}/power.json`, JSON.stringify(result, null, 2));
  expect(result.events).toEqual(['power.on', 'power.off']);
  expect(result.frames.filter((value, index) => index > 0 && value !== result.frames[index - 1])).toHaveLength(3);
  expect(result.frames.at(-1)).toBe(4);
  expect(result.end!.lamps.filter(lamp => lamp.group === 'trailer').every(lamp => lamp.emissive === 0)).toBe(true);
  expect(result.shutdownTick).toBeGreaterThan(0);
  expect(result.end!.practicalEffects.beams).toBe(0); expect(result.end!.practicalEffects.reflections).toBe(0); expect(result.end!.lightField.litStatics).toBe(0);
});

test('T-E25-01 @E25 @E25-AC01 headless WebGL tone-mapping comparison records the same trailer and counters', async ({ page }) => {
  const comparisons = [];
  for (const tone of ['none', 'agx', 'aces']) {
    await boot(page, `/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1${tone === 'none' ? '' : `&tone=${tone}`}`);
    await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, lightLab);
    await page.locator('canvas').screenshot({ path: `${out}/tone-${tone}.png` });
    comparisons.push({ tone, ...await page.evaluate(() => ({ backend: window.__SS__!.getState().render.backend, perf: window.__SS__!.perf() })) });
  }
  writeFileSync(`${out}/tone-comparison.json`, JSON.stringify(comparisons, null, 2));
  expect(comparisons.every(item => item.backend === 'webgl')).toBe(true);
});

test('T-E25-16 @E25 @E25-AC16 production photo spots for the non-L6 lighting review', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted&dpr=1');
  for (const [level, spot] of [['L2', 'l2-streets-w1'], ['L3', 'l3-grove-boulevard'], ['L4', 'l4-plaza-safe'], ['L5', 'pair-plaza']]) {
    await page.evaluate(async ({ level, spot }) => {
      const a = window.__SS__!; await a.loadLevel(level); a.cheats.god(true); a.missions.begin(); a.pause();
      if (level === 'L5') { a.cheats.completeObjective('emerge'); await a.step(600); }
      a.camera.preset(`${level === 'L2' ? 'D-GROVE/W1' : level === 'L3' ? 'D-CORRIDOR/W2' : level === 'L4' ? 'D-FAIR/W0' : 'D-FAIR/W5'}/${spot}`);
      await a.step(90);
      if (level === 'L5') for (let i = 0; i < 150; i++) a.vfx.stepRender(.1);
      await a.screenshotReady();
    }, { level, spot });
    await page.locator('canvas').screenshot({ path: `${out}/${spot}.png` });
    writeFileSync(`${out}/${spot}.json`, JSON.stringify(await page.evaluate(() => window.__SS__!.getState().render.lighting), null, 2));
  }
  await scene(page, { name: 'mall-floor', ground: 'asphalt', size: 30, time: 'night', dof: false, props: [{ asset: 'int.mini-mall', at: [0, 0] }], actors: [{ kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [10, 8, 14], target: [0, 1, 0] } });
  await page.locator('canvas').screenshot({ path: `${out}/mall-floor.png` });
});

test('T-E25-10 @E25 @E25-AC10 wet reflection splats exceed the dry surface on both tiers', async ({ page }) => {
  const lab: SceneSpec = { name: 'reflection-lab', ground: 'asphalt', size: 40, time: 'night', dof: false,
    props: [{ asset: 'prop.street-lamp', at: [3, 0] }, { asset: 'prop.jukebox', at: [-3, 0] }],
    actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] } };
  const result = [];
  for (const quality of ['high', 'low'] as const) {
    await boot(page, `/?test=1&scenelab&renderer=webgl&quality=${quality}&audio=muted&dpr=1`);
    const images: PNG[] = [];
    for (const wet of [false, true]) {
      const spec: SceneSpec = { ...lab, weather: wet ? 'rain' : 'clear', weatherWarmup: wet ? 120 : 0 };
      await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(120); await window.__SS__!.screenshotReady(); }, spec);
      images.push(PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/reflection-${quality}-${wet ? 'wet' : 'dry'}.png` })));
    }
    const points = await page.evaluate(() => window.__SS__!.getState().render.lighting!.lamps.map(lamp => window.__SS__!.camera.project(lamp.position[0], .05, lamp.position[2] + 1.5)));
    const samples = points.map(point => ({ dry: patch(images[0], point), wet: patch(images[1], point) }));
    result.push({ quality, samples, points });
    for (const sample of samples) expect(sample.wet / sample.dry).toBeGreaterThan(2);
  }
  writeFileSync(`${out}/reflections.json`, JSON.stringify(result, null, 2));
});

/** Project a scanline on the actual bundled front-window primitive, so camera
 * rotation is removed before measuring the pattern's movement within its frame. */
async function windowLine(page: import('@playwright/test').Page): Promise<number[][]> {
  return page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    let line: number[][] = [];
    game.view.labProbes().districts?.traverse(object => {
      const mesh = object as import('three').InstancedMesh;
      if (!mesh.isInstancedMesh || !mesh.count || !mesh.geometry.hasAttribute('_window')) return;
      const g = mesh.geometry, mask = g.getAttribute('_window'), light = g.getAttribute('_light'), normal = g.getAttribute('normal'), positions = g.getAttribute('position');
      const vertices: number[][] = [];
      const instance = mesh.matrixWorld.clone(); mesh.getMatrixAt(0, instance);
      for (let i = 0; i < mask.count; i++) if (mask.getX(i) === 1 && light.getX(i) === 2 && normal.getX(i) > .8) vertices.push(mesh.position.clone().set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).toArray());
      if (!vertices.length) return;
      const min = [0, 1, 2].map(axis => Math.min(...vertices.map(p => p[axis]))), max = [0, 1, 2].map(axis => Math.max(...vertices.map(p => p[axis])));
      line = Array.from({ length: 200 }, (_, i) => window.__SS__!.camera.project(max[0] + .002, min[1] + (max[1] - min[1]) * .7, min[2] + (max[2] - min[2]) * i / 199));
    });
    return line;
  });
}

test('T-E25-11 T-E25-12 @E25 @E25-AC11 @E25-AC12 camera angles expose car environment highlights and measured window depth', async ({ page }) => {
  test.setTimeout(180_000);
  const house: SceneSpec = { name: 'interior-window', ground: 'asphalt', size: 30, time: 'night', dof: false, props: [{ asset: 'bld.house-a', at: [0, 0], powerGroup: 'residential' }] };
  const scenes: SceneSpec[] = [{ name: 'material-classes', ground: 'asphalt', size: 30, time: 'L4', dof: false, props: [{ asset: 'veh.sedan-green', at: [0, 0] }, { asset: 'prop.bench', at: [-5, 0] }] }, house];
  const evidence = [], windows: { angle: number; line: number[][]; luminance: number[]; edge: number; width: number }[] = [];
  for (const subject of scenes) for (const angle of [45, 60]) {
    const radians = angle * Math.PI / 180;
    await scene(page, { ...subject, camera: { mode: 'pose', position: [Math.cos(radians) * 12, 7, Math.sin(radians) * 12], target: [0, 1.3, 0] } });
    const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${subject.name}-${angle}.png` }));
    evidence.push({ subject: subject.name, angle, lighting: await page.evaluate(() => window.__SS__!.getState().render.lighting) });
    if (subject === house) {
      const line = await windowLine(page); expect(line).toHaveLength(200);
      const luminance = line.map(point => patch(image, point, 1));
      // Exclude the physical perimeter/middle mullion. The room's far wall
      // ends at a bright-to-dark boundary inside the central panes.
      let edge = 0, gradient = -Infinity;
      for (let i = 65; i < 138; i++) if (i < 88 || i > 112) { const delta = luminance[i - 2] - luminance[i + 2]; if (delta > gradient) { gradient = delta; edge = i; } }
      const width = Math.hypot((line.at(-1)![0] - line[0][0]) * image.width / 2, (line.at(-1)![1] - line[0][1]) * image.height / 2);
      windows.push({ angle, line, luminance, edge, width });
    }
  }
  const shiftPx = Math.abs(windows[0].edge - windows[1].edge) / 199 * Math.min(windows[0].width, windows[1].width);
  await scene(page, { ...house, props: house.props!.map(prop => ({ ...prop, powered: false })), camera: { mode: 'pose', position: [Math.SQRT1_2 * 12, 7, Math.SQRT1_2 * 12], target: [0, 1.3, 0] } });
  const off = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/interior-window-off.png` }));
  const dark = windows[0].line.map(point => patch(off, point, 1)), glowRatio = Math.max(...windows[0].luminance) / Math.max(...dark);
  writeFileSync(`${out}/surfaces.json`, JSON.stringify({ evidence, windows, shiftPx, dark, glowRatio }, null, 2));
  expect(shiftPx).toBeGreaterThanOrEqual(4); expect(glowRatio).toBeGreaterThan(4);
  expect(await page.evaluate(() => window.__SS__!.getState().render.lighting!.lamps.every(lamp => lamp.emissive === 0))).toBe(true);
});

test('T-E25-09 @E25 @E25-AC09 four spot cones fade across their ground intersection', async ({ page }) => {
  await scene(page, lightLab);
  const point = await page.evaluate(() => window.__SS__!.camera.project(3.5, .04, 0));
  const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/beam-intersection.png` }));
  const cx = Math.round((point[0] + 1) / 2 * image.width), cy = Math.round((1 - point[1]) / 2 * image.height);
  let gradient = 0;
  for (let y = cy - 15; y < cy + 15; y++) for (let x = cx - 15; x < cx + 15; x++) {
    const at = (y * image.width + x) * 4, next = at + image.width * 4;
    gradient = Math.max(gradient, Math.abs(lum(image.data[at], image.data[at + 1], image.data[at + 2]) - lum(image.data[next], image.data[next + 1], image.data[next + 2])));
  }
  const effects = await page.evaluate(() => window.__SS__!.getState().render.lighting!.practicalEffects);
  writeFileSync(`${out}/beam-intersection.json`, JSON.stringify({ gradient, effects, point }, null, 2));
  expect(effects.beams).toBe(4); expect(gradient).toBeLessThanOrEqual(.25);
});

test('T-E25-15 @E25 @E25-AC15 production asset turntable emits night on/off views', async ({ page, baseURL }) => {
  const { captureTurntable } = await import('../../tools/assets/turntable');
  const coverage = await captureTurntable(page, 'prop.light-tower-trailer', `${out}/turntable`, baseURL!);
  expect(coverage.every(value => value > 0)).toBe(true);
  // Reusing main's batch viewer must retain night-off for the newly loaded asset.
  await page.evaluate(async () => {
    const a = window.__ASSET__!; await a.lighting!(true, false); await a.selectAsset!('prop.jukebox');
  });
  const switched = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/turntable/batch-night-off.png` }));
  await page.evaluate(async () => { await window.__ASSET__!.lighting!(true, false); });
  const explicit = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/turntable/batch-night-off-explicit.png` }));
  let difference = 0, maximumDifference = 0;
  for (let i = 0; i < switched.data.length; i++) if (i % 4 !== 3) {
    const delta = Math.abs(switched.data[i] - explicit.data[i]);
    difference += delta; maximumDifference = Math.max(maximumDifference, delta);
  }
  const meanDifference = difference / (switched.width * switched.height * 3);
  writeFileSync(`${out}/turntable/batch-power.json`, JSON.stringify({ meanDifference, maximumDifference }, null, 2));
  expect(meanDifference).toBeLessThan(.5);
  expect(maximumDifference).toBeLessThanOrEqual(2);
});

test('T-E25-05v @E25 @E25-AC05 sixty seconds past forty lights: promotion rate and per-frame pool luminance', async ({ page }) => {
  test.setTimeout(900_000);
  await scene(page, { name: 'forty-lights', ground: 'asphalt', size: 220, time: 'night', dof: false,
    props: Array.from({ length: 40 }, (_, i) => ({ asset: 'prop.street-lamp', at: [i * 2.5 - 50, 0] as [number, number] })),
    actors: [{ kind: 'courier', at: [-55, 4] }], camera: { mode: 'game', target: [-55, 4] } });
  await page.evaluate(() => window.__SS__!.camera.follow());
  const viewport = page.viewportSize()!;
  const samples = []; let maxDelta = 0;
  const prior = new Map<string, number>(), measured = new Map<string, number>();
  for (let frame = 0; frame < 3600; frame++) {
    const state = await page.evaluate(async () => {
      const a = window.__SS__!; a.input.set({ move: { x: 1, z: 0 }, walk: true }); await a.step(1); await a.screenshotReady();
      const p = a.getEntity(1)!.transform, lighting = a.getState().render.lighting!;
      // Fixed ground samples in each pool's central 2 m region, clear of the lamp's solid base.
      const points = lighting.lamps.filter(lamp => Math.abs(lamp.position[0] - p.x) < 8).map(lamp => ({ id: lamp.id, point: a.camera.project(lamp.position[0] + 1, .05, lamp.position[2] + 1) }));
      return { tick: a.tick(), x: p.x, lighting, points };
    });
    const { width, height } = viewport;
    const points = state.points.map(probe => ({ id: probe.id, x: Math.round((probe.point[0] + 1) / 2 * width), y: Math.round((1 - probe.point[1]) / 2 * height) })).filter(probe => probe.x > 8 && probe.x < width - 8 && probe.y > 8 && probe.y < height - 8);
    const x = Math.min(...points.map(p => p.x)) - 4, y = Math.min(...points.map(p => p.y)) - 4;
    const clip = { x, y, width: Math.max(...points.map(p => p.x)) + 5 - x, height: Math.max(...points.map(p => p.y)) + 5 - y };
    const image = points.length ? PNG.sync.read(await page.screenshot({ clip })) : null;
    const pools = points.map(p => {
      let mean = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const at = ((p.y - y + dy) * image!.width + p.x - x + dx) * 4; mean += lum(image!.data[at], image!.data[at + 1], image!.data[at + 2]); } mean /= 81;
      const before = prior.get(p.id); if (before !== undefined && before > .001) maxDelta = Math.max(maxDelta, Math.abs(mean - before) / before);
      prior.set(p.id, mean); measured.set(p.id, (measured.get(p.id) ?? 0) + 1); return { id: p.id, luminance: mean };
    });
    for (const id of prior.keys()) if (!points.some(point => point.id === id)) prior.delete(id);
    samples.push({ tick: state.tick, x: state.x, hero: state.lighting.heroLight, blend: state.lighting.promotionBlend, pools });
    expect(state.lighting.heroLights).toBeLessThanOrEqual(8); expect(state.lighting.heroShadowMaps).toBeLessThanOrEqual(3);
  }
  const rate = new Map<number, number>(); let hero = samples[0].hero;
  for (const sample of samples) if (sample.hero !== hero) { const second = Math.floor((sample.tick - samples[0].tick) / 60); rate.set(second, (rate.get(second) ?? 0) + 1); hero = sample.hero; }
  writeFileSync(`${out}/hero-walk.json`, JSON.stringify({ samples, changesPerSecond: [...rate], measured: [...measured], maxDelta }, null, 2));
  expect(measured.size).toBe(40); expect(Math.min(...measured.values())).toBeGreaterThan(18);
  expect(samples.at(-1)!.x - samples[0].x).toBeGreaterThan(110);
  expect(Math.max(...rate.values())).toBeLessThanOrEqual(2); expect(maxDelta).toBeLessThanOrEqual(.15);
});
