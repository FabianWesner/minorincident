/** Retains full beauty and beams-disabled intersection samples without changing the 25% limit. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { PlacedLight } from '../../src/data/placedLights';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const tier = process.argv.includes('--low') ? 'low' : 'high', out = process.env.E25_OUT ?? `test-results/epics/E25/final/beams-${tier}`;
const backend = (process.env.E25_BACKEND ?? 'webgl2') as Backend;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend });
const result: Record<string, unknown> = { tier, backend };
const lin = (v: number) => v <= 10.31475 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
function luminance(p: PNG, x: number, y: number) { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return .2126 * lin(p.data[i]) + .7152 * lin(p.data[i + 1]) + .0722 * lin(p.data[i + 2]); }
async function shot(name: string) {
  await s.ready(); const data = await s.page.evaluate(() => {
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
  const actualBackend = await s.page.evaluate(() => window.__SS__!.perf().backend);
  if (actualBackend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error(`Backend fallback: ${actualBackend}`);
  const spec: SceneSpec = { name: 'light-lab', ground: 'asphalt', size: 60, time: 'night', dof: false, props: [{ asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }], actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [24, 32, 36], target: [0, 0, 0] } };
  await s.load(spec); await s.step(120);
  if (process.env.E25_NO_VISIBILITY === '1') await s.page.evaluate(() => {
    const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting;
    const fields = (l.field as unknown as { statics: import('../../src/render/LightField').FieldLight[] }).statics;
    l.field.setStatic(fields.map(f => ({ ...f, visibility: undefined })));
  });
  const on = await shot('on');
  const setup = await s.page.evaluate(() => {
    const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting;
    const effects = l.practicalEffects as unknown as { beams: { visible: boolean }; lights: PlacedLight[] };
    effects.beams.visible = false;
    const fields = (l.field as unknown as { statics: { x: number; y: number; z: number; aimX: number; aimZ: number }[] }).statics;
    const project = (p: number[]) => window.__SCENE__!.project(p as [number, number, number]);
    const original = fields.map(f => ({ field: f, a: project([f.x + f.aimX, .02, f.z + f.aimZ]), b: project([f.x + f.aimX * (1 - .8 / f.y), .8, f.z + f.aimZ * (1 - .8 / f.y)]) }));
    const actual = effects.lights.filter(l => l.anchor.type === 'spot' && l.anchor.beam !== 'none').flatMap(light => {
      const [x, y, z] = light.position, directionLength = Math.hypot(...light.direction);
      const [dx, dy, dz] = light.direction.map(v => v / directionLength);
      const h = Math.hypot(dx, dz), c = Math.cos((light.anchor.angle ?? 45) * Math.PI / 360), t = Math.sin((light.anchor.angle ?? 45) * Math.PI / 360);
      // Every azimuth on the actual cone surface: axis +/- two perpendicular basis vectors.
      const u = h > 1e-5 ? [dz / h, 0, -dx / h] : [1, 0, 0];
      const v = [dy * u[2] - dz * u[1], dz * u[0] - dx * u[2], dx * u[1] - dy * u[0]];
      return Array.from({ length: 12 }, (_, i) => {
        const a = i / 12 * Math.PI * 2, ray = [dx, dy, dz].map((d, k) => d * c + (u[k] * Math.cos(a) + v[k] * Math.sin(a)) * t);
        if (ray[1] >= -.01) return null;
        const ground = (light.ground - y) / ray[1], above = (light.ground + .8 - y) / ray[1];
        if (ground > light.anchor.range) return null;
        return { id: light.id, azimuth: i * 30, a: project([x + ray[0] * ground, light.ground + .02, z + ray[2] * ground]), b: project([x + ray[0] * above, light.ground + .8, z + ray[2] * above]) };
      }).filter(v => v !== null);
    });
    return { original, actual };
  });
  const off = await shot('off');
  const measure = (line: { a: { x: number; y: number }; b: { x: number; y: number } }) => {
    const length = Math.max(1, Math.round(Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y)));
    const samples = Array.from({ length: length + 1 }, (_, i) => {
      const x = line.a.x + (line.b.x - line.a.x) * i / length, y = line.a.y + (line.b.y - line.a.y) * i / length;
      return { x, y, on: luminance(on, x, y), off: luminance(off, x, y) };
    });
    const gradients = samples.slice(1).map((v, i) => {
      const p = samples[i], denominator = Math.max(.001, v.on, p.on);
      return { at: [v.x, v.y], beauty: Math.abs(v.on - p.on) / denominator, background: Math.abs(v.off - p.off) / denominator, beam: Math.abs((v.on - v.off) - (p.on - p.off)) / denominator };
    });
    return { ...line, pixels: length, samples, gradients, maxBeauty: Math.max(...gradients.map(g => g.beauty)), maxBackground: Math.max(...gradients.map(g => g.background)), maxBeam: Math.max(...gradients.map(g => g.beam)) };
  };
  result.original = setup.original.map(measure); result.actual = setup.actual.map(measure);
  const masks = await s.page.evaluate(() => {
    const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting;
    const fields = (l.field as unknown as { statics: { radius: number }[] }).statics;
    const inside = [], outside = [], behind = [], radius = Math.max(...fields.map(f => f.radius));
    for (let x = -1; x <= 5; x += .25) for (let z = -2; z <= 2; z += .25) if (Math.hypot(x, z) > 1) inside.push(window.__SCENE__!.project([x, .05, z]));
    for (let x = -1; x <= 5; x += .25) for (let z = radius + 3.6; z <= radius + 4.6; z += .25) outside.push(window.__SCENE__!.project([x, .05, z]));
    for (let x = 9; x <= 13; x += .25) for (let z = -2; z <= 2; z += .25) behind.push(window.__SCENE__!.project([x, .05, z]));
    (window.__SCENE__ as unknown as { game: Game }).game.world.lightPower!.setGroup('trailer', false);
    return { inside, outside, behind };
  });
  const ambient = await shot('ambient');
  const mean = (p: PNG, points: { x: number; y: number }[]) => points.reduce((sum, q) => sum + luminance(p, q.x, q.y), 0) / points.length;
  result.pool = { inside: mean(on, masks.inside), outside: mean(on, masks.outside), behind: mean(on, masks.behind), behindAmbient: mean(ambient, masks.behind), sampleCounts: [masks.inside.length, masks.outside.length, masks.behind.length] };
} finally { result.errors = s.errors; writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2) + '\n'); await s.close(); stopServer(); }
