/** Paired E25 pool masks and caster controls; uses the shared headless GPU browser pool. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const backend = (process.env.E25_BACKEND ?? 'webgl2') as Backend, tier = process.argv.includes('--low') ? 'low' : 'high';
const phase = process.env.E25_PHASE ?? 'before', out = `test-results/epics/E25/rest/${phase}/${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier }), rows: unknown[] = [], captures: unknown[] = [];
const lin = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
const rgb = (p: PNG, x: number, y: number) => { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return [...p.data.subarray(i, i + 3)]; };
const lum = (c: number[]) => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const hue = (c: number[]) => { const hi = Math.max(...c), lo = Math.min(...c), d = hi - lo; return d === 0 ? null : (((hi === c[0] ? (c[1] - c[2]) / d : hi === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4) * 60 + 360) % 360); };
const inside: number[][] = [], behind: number[][] = [], beside: number[][] = [];
for (let x = -1; x <= 5; x += .25) for (let z = -2; z <= 2; z += .25) if (Math.hypot(x, z) > 1) inside.push([x, .05, z]);
for (let x = 1; x <= 4; x += .2) for (let z = -.25; z <= .25; z += .125) behind.push([x, .05, z]);
for (let x = 1; x <= 4; x += .2) for (const z of [-1, 1]) beside.push([x, .05, z]);
const fixture: SceneSpec = { name: 'light-lab', seed: 1, ground: 'asphalt', size: 60, time: 'night', dof: false, props: [{ id: 'trailer', asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { id: 'fence', asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }], actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [24, 32, 36], target: [0, 0, 0] } };
const tones: unknown[] = [];
const project = (points: number[][]) => s.page.evaluate(points => points.map(p => window.__SCENE__!.project(p as [number, number, number])), points);
async function shot(name: string) {
  await s.ready();
  const snapshot = await s.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const frame = (g.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame;
    g.view.renderer.nextNodeFrame(); frame.time = frame.deltaTime = 0; g.view.update(1);
    const lighting = (g.view as unknown as { lighting: Lighting }).lighting;
    return { png: g.view.renderer.domElement.toDataURL('image/png').split(',')[1], perf: window.__SS__!.perf(), state: window.__SS__!.getState().render, camera: g.view.view.getState(), tick: g.world.tick, shadowHue: lighting.shadowHue.value.toArray(), shadow: lighting.shadow.value.toArray(), look: lighting.look.values };
  });
  if (snapshot.perf.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error(`Backend fallback: ${snapshot.perf.backend}`);
  const bytes = Buffer.from(snapshot.png, 'base64'), path = `${out}/${name}.png`; writeFileSync(path, bytes);
  const { png: _png, ...metrics } = snapshot; void _png;
  captures.push({ name, path, sha256: createHash('sha256').update(bytes).digest('hex'), ...metrics });
  return PNG.sync.read(bytes);
}
try {
  await s.open(); await s.page.evaluate('globalThis.__name = fn => fn');
  await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game, reset = g.clock.reset.bind(g.clock); g.clock.reset = () => { reset(); g.clock.pause(); }; g.clock.resume = () => {}; g.clock.pause(); });
  await s.load(fixture); await s.step(120);
  for (const zoom of [1, 1.5]) {
    await s.page.evaluate(zoom => { const g = (window.__SCENE__ as unknown as { game: Game }).game, rig = g.view.view; rig.follow(); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.preset('e25-zoom', { position: [24 * zoom, 32 * zoom, 36 * zoom], target: [0, 0, 0] }); g.view.update(1); }, zoom);
    const lit = await shot(`light-lab-z${zoom}`), pool = await project(inside), q = await project(behind), b = await project(beside);
    const colors = q.map(p => rgb(lit, p.x, p.y));
    await s.page.evaluate(() => window.__SCENE__!.hideProbe(true, false)); const off = await shot(`no-caster-z${zoom}`);
    await s.page.evaluate(() => window.__SCENE__!.hideProbe(false, false));
    const qualifying = q.map((p, i) => ({ rgb: colors[i], darkness: 1 - lum(colors[i]) / lum(rgb(off, p.x, p.y)) })).filter(p => p.darkness >= .35);
    const shadowRgb = [0, 1, 2].map(c => avg(qualifying.map(p => p.rgb[c]))), behindMean = avg(colors.map(lum)), besideMean = avg(b.map(p => lum(rgb(lit, p.x, p.y))));
    rows.push({ zoom, pool: { meanLuminance: avg(pool.map(p => lum(rgb(lit, p.x, p.y)))), count: pool.length, projectedMask: pool }, shadow: { behindMean, besideMean, darkness: 1 - behindMean / besideMean, qualifyingPixels: qualifying.length, sampleCount: q.length, projectedMask: q, meanDarkness: avg(qualifying.map(p => p.darkness)), rgb: shadowRgb, hue: hue(shadowRgb) } });
  }
  if (process.env.E25_TONES === '1') {
    for (const [name, tone] of [['shipping', 0], ['aces', 4], ['agx', 6]] as const) {
      await s.page.evaluate(tone => { (window.__SCENE__ as unknown as { game: Game }).game.view.renderer.toneMapping = tone; }, tone);
      const p = await shot(`tone-${name}`), values: number[] = [];
      for (let y = 0; y < p.height; y += 4) for (let x = 0; x < p.width; x += 4) values.push(lum(rgb(p, x, y)));
      tones.push({ name, meanLuminance: avg(values) });
    }
  }
} finally { writeFileSync(`${out}/measurements.json`, JSON.stringify({ at: new Date().toISOString(), phase, backend, tier, rows, tones, captures, errors: s.errors }, null, 2) + '\n'); await s.close(); stopServer(); }
console.log(`${out}/measurements.json`);
