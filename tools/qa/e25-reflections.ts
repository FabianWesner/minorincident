/** Reflection beauty, proven wet/dry samples and a real SSR car-ID pass. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const tier = process.argv.includes('--low') ? 'low' : 'high';
const backend = (process.env.E25_BACKEND ?? 'webgl2') as Backend;
const out = process.env.E25_OUT ?? `test-results/epics/E25/final/reflections-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend });
const result: Record<string, unknown> = { tier, backend };
const lin = (v: number) => v <= 10.31475 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
function lum(p: PNG, x: number, y: number) { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return .2126 * lin(p.data[i]) + .7152 * lin(p.data[i + 1]) + .0722 * lin(p.data[i + 2]); }
async function shot(name: string) {
  await s.ready();
  const data = await s.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.view.renderer.nextNodeFrame();
    const f = (g.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame;
    f.time = f.deltaTime = 0; g.view.update(1);
    return g.view.renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  const bytes = Buffer.from(data, 'base64'); writeFileSync(`${out}/${name}.png`, bytes); return PNG.sync.read(bytes);
}
try {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  const spec: SceneSpec = { name: 'reflection-lab', ground: 'asphalt', size: 50, time: 'night', weather: 'rain', weatherWarmup: 45, dof: false,
    props: [{ id: 'neon', asset: 'prop.jukebox', at: [-3, 0] }, { id: 'lamp', asset: 'prop.street-lamp', at: [3, 0] }, { id: 'car', asset: 'veh.sedan-green', at: [0, -4] }],
    actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] } };
  await s.load(spec); await s.step(120);
  const native = await shot('native');
  const actualBackend = await s.page.evaluate(() => window.__SS__!.perf().backend);
  if (actualBackend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error(`Backend fallback: ${actualBackend}`);
  const helperPath = process.env.SCENE_SERVER === 'preview' ? '/build/e25-reflection-mask.js' : '/tools/qa/e25-reflection-mask.ts';
  const samples = await s.page.evaluate(async path => {
    const { surfaceWetness } = await import(/* @vite-ignore */ path) as typeof import('./e25-reflection-mask');
    const wetness = surfaceWetness();
    const wet = (x: number, z: number) => {
      const p = Math.sin(x * .65) * Math.sin(z * .5) * .5 + .5;
      const t = Math.max(0, Math.min(1, (p - (1 - wetness)) / .15)); return t * t * (3 - 2 * t);
    };
    return { wetness, lights: [-3, 3].map(x => {
      const candidates = [];
      for (let dx = -.5; dx <= .5; dx += .1) for (let z = -.5; z <= 3.5; z += .1) if (wet(x + dx, z) === 1) candidates.push({ world: [x + dx, .002, z], wet: wet(x + dx, z), screen: window.__SCENE__!.project([x + dx, .002, z]) });
      const dry = [];
      for (let dx = -2.5; dx <= 2.5; dx += .1) for (let z = -2; z <= 4; z += .1) {
        const pattern = Math.sin((x + dx) * .65) * Math.sin(z * .5) * .5 + .5;
        if (Math.abs(dx) > .8 && wet(x + dx, z) === 0 && pattern < 1 - wetness - .02) dry.push({ world: [x + dx, .002, z], wet: wet(x + dx, z), dryMargin: 1 - wetness - pattern, screen: window.__SCENE__!.project([x + dx, .002, z]) });
      }
      return { x, candidates, dry };
    }) };
  }, helperPath);
  await s.page.evaluate(() => {
    const view = (window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: { practicalEffects: { streaks: { visible: boolean } } }; postFx: { wetReflections?: { enabled: { value: number } } } };
    view.lighting.practicalEffects.streaks.visible = false;
    if (view.postFx.wetReflections) view.postFx.wetReflections.enabled.value = 0;
  });
  const noReflections = await shot('no-reflections');
  await s.page.evaluate(async path => {
    const { installGroundMask } = await import(/* @vite-ignore */ path) as typeof import('./e25-reflection-mask');
    const mask = installGroundMask((window.__SCENE__ as unknown as { game: Game }).game);
    (window as unknown as { e25GroundMask: typeof mask }).e25GroundMask = mask;
  }, helperPath);
  const ground = await shot('ground-id');
  const floor = (x: number, y: number, wet: boolean) => { const i = (Math.round(y) * ground.width + Math.round(x)) * 4; return ground.data[i] >= 240 && (wet ? ground.data[i + 1] === 255 : ground.data[i + 1] === 0); };
  result.streaks = samples.lights.map(light => {
    const wet = light.candidates.filter(p => floor(p.screen.x, p.screen.y, true)).map(p => ({ ...p, luminance: lum(native, p.screen.x, p.screen.y), control: lum(noReflections, p.screen.x, p.screen.y), reflectionDelta: lum(native, p.screen.x, p.screen.y) - lum(noReflections, p.screen.x, p.screen.y), groundId: true, gpuWetMask: 1 })).sort((a, b) => b.reflectionDelta - a.reflectionDelta)[0];
    if (!wet) throw Error(`No proven wet floor sample under light ${light.x}`);
    const dry = light.dry.filter(p => floor(p.screen.x, p.screen.y, false)).map(p => ({ ...p, luminance: lum(native, p.screen.x, p.screen.y), distance: Math.hypot(p.world[0] - wet.world[0], p.world[2] - wet.world[2]), groundId: true, gpuWetMask: 0 })).sort((a, b) => a.distance - b.distance)[0];
    if (!dry) throw Error(`No proven dry floor neighbor under light ${light.x}`);
    return { x: light.x, wetness: samples.wetness, wet, dry, ratio: wet.luminance / dry.luminance };
  });
  await s.page.evaluate(() => {
    (window as unknown as { e25GroundMask: ReturnType<typeof import('./e25-reflection-mask')['installGroundMask']> }).e25GroundMask.restore();
    const view = (window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: { practicalEffects: { streaks: { visible: boolean } } }; postFx: { wetReflections?: { enabled: { value: number } } } };
    view.lighting.practicalEffects.streaks.visible = true;
    if (view.postFx.wetReflections) view.postFx.wetReflections.enabled.value = 1;
  });
  result.perf = await s.page.evaluate(() => window.__SS__!.perf());
  if (tier === 'high') {
    await s.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const post = (g.view as unknown as { postFx: { wetReflections: { enabled: { value: number } } } }).postFx;
      post.wetReflections.enabled.value = 0;
    });
    await shot('ssr-off');
    // Keep every opaque surface in the depth buffer. Only the car supplies white colour to SSR.
    result.idSetup = await s.page.evaluate(async path => {
      const { installReflectionMask } = await import(/* @vite-ignore */ path) as typeof import('./e25-reflection-mask');
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const mask = installReflectionMask(g);
      (window as unknown as { e25ReflectionMask: typeof mask }).e25ReflectionMask = mask;
      return { meshes: mask.meshes };
    }, helperPath);
    const actual = await shot('ssr-car-id');
    await s.page.evaluate(() => (window as unknown as { e25ReflectionMask: ReturnType<typeof import('./e25-reflection-mask')['installReflectionMask']> }).e25ReflectionMask.expected());
    const expected = await shot('expected-car-id');
    let expectedPixels = 0, actualPixels = 0, intersection = 0;
    for (let i = 0; i < expected.data.length; i += 4) {
      const a = actual.data[i] > 10 || actual.data[i + 1] > 10 || actual.data[i + 2] > 10;
      const e = expected.data[i] > 200 && expected.data[i + 1] > 200 && expected.data[i + 2] > 200;
      if (a) actualPixels++; if (e) expectedPixels++; if (a && e) intersection++;
    }
    result.ssr = { expectedPixels, actualPixels, intersection, coverage: intersection / expectedPixels, iou: intersection / (expectedPixels + actualPixels - intersection) };
  }
} finally {
  result.errors = s.errors; writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2) + '\n');
  await s.close(); stopServer();
}
