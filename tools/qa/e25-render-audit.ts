/** Fresh WebGL2 E25 measurements via the shared headless browser pool. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { FieldLight } from '../../src/render/LightField';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

type Audit = { game: { world: Game['world']; view: Omit<Game['view'], never> & { lighting: Lighting } } };
const tier = process.argv.includes('--low') ? 'low' : 'high';
const out = process.env.E25_OUT ?? `test-results/epics/E25/fresh-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend: 'webgl2', tier });
const result: Record<string, unknown> = { at: new Date().toISOString(), tier, backend: 'webgl2' };
const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4;
const luminance = (p: PNG, x: number, y: number) => {
  const i = (Math.round(y) * p.width + Math.round(x)) * 4;
  return linear(p.data[i]) * .2126 + linear(p.data[i + 1]) * .7152 + linear(p.data[i + 2]) * .0722;
};
async function pixels(name: string) { return PNG.sync.read(await s.screenshot(`${out}/${name}.png`)); }
async function samples(points: number[][]) {
  return s.page.evaluate(points => points.map(p => window.__SCENE__!.project(p as [number, number, number])), points);
}
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
async function values(p: PNG, points: number[][]) {
  const q = await samples(points);
  return q.filter(p => p.x >= 1 && p.y >= 1 && p.x < 1279 && p.y < 719).map(q => luminance(p, q.x, q.y));
}
const base: SceneSpec = { name: 'light-lab', ground: 'asphalt', size: 60, time: 'night', dof: false,
  props: [{ id: 'trailer', asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { id: 'fence', asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }],
  actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [24, 32, 36], target: [0, 0, 0] }, frames: 120 };
try {
  await s.open(); console.log('opened', tier);
  await s.load(base); await s.step(120); await s.ready(); console.log('loaded light lab');
  result.lightLab = await s.page.evaluate(() => ({ state: window.__SS__!.getState().render, perf: window.__SS__!.perf() }));
  const fields = await s.page.evaluate(() => ((window.__SCENE__ as unknown as Audit).game.view.lighting.field as unknown as { statics: FieldLight[] }).statics);
  result.footprints = fields;
  const lit = await pixels('light-lab');
  const inside: number[][] = [], outside: number[][] = [], behind: number[][] = [];
  // Fixed world masks: open ground within the trailer pools, an unlit band 3 m outside their lateral extent,
  // and ground behind the fence. All are sampled in the same beauty frame and camera.
  for (let x = -1; x <= 5; x += .25) for (let z = -2; z <= 2; z += .25) if (Math.hypot(x, z) > 1) inside.push([x, .05, z]);
  const radius = Math.max(...fields.map(f => f.radius));
  for (let x = -1; x <= 5; x += .25) for (let z = radius + 3.6; z <= radius + 4.6; z += .25) outside.push([x, .05, z]);
  for (let x = 9; x <= 13; x += .25) for (let z = -2; z <= 2; z += .25) behind.push([x, .05, z]);
  await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as Audit).game; g.world.lightPower!.setGroup('trailer', false); g.view.update(1); });
  await s.step(1); const off = await pixels('light-lab-off');
  result.pool = { inside: mean(await values(lit, inside)), outside: mean(await values(lit, outside)), behind: mean(await values(lit, behind)), behindAmbient: mean(await values(off, behind)), sampleCounts: [inside.length, outside.length, behind.length] };
  result.powerOff = await s.page.evaluate(() => window.__SS__!.getState().render.lighting);
  await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as Audit).game; g.world.lightPower!.setGroup('trailer', true, false); g.view.update(1); });
  await s.step(30);
  // Compare the same ground behind the courier with the courier hidden (its shadow then disappears).
  await s.page.evaluate(() => window.__SCENE__!.hideProbe(true, false)); await s.step(1); const noBody = await pixels('light-lab-no-body');
  const shadow: number[][] = [], beside: number[][] = [];
  for (let x = 1; x <= 4; x += .2) for (let z = -.25; z <= .25; z += .125) shadow.push([x, .05, z]);
  for (let x = 1; x <= 4; x += .2) for (const z of [-1, 1]) beside.push([x, .05, z]);
  result.shadow = { behind: mean(await values(lit, shadow)), beside: mean(await values(lit, beside)), withoutBody: mean(await values(noBody, shadow)) };
  await s.page.evaluate(() => window.__SCENE__!.hideProbe(false, false));
  const reflection: SceneSpec = { name: 'reflection-lab', ground: 'asphalt', size: 50, time: 'night', weather: 'rain', weatherWarmup: 120, dof: false,
    props: [{ id: 'neon', asset: 'prop.jukebox', at: [-3, 0] }, { id: 'lamp', asset: 'prop.street-lamp', at: [3, 0] }, { id: 'car', asset: 'veh.sedan-green', at: [0, -4] }],
    actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] }, frames: 120 };
  await s.load(reflection); await s.step(120); const wet = await pixels('reflection-lab-wet');
  result.reflection = { state: await s.page.evaluate(() => window.__SS__!.getState().render), perf: await s.page.evaluate(() => window.__SS__!.perf()), streakLuminance: mean(await values(wet, [[-3, .06, 1.5], [3, .06, 1.5]])), neighborLuminance: mean(await values(wet, [[-1.5, .06, 1.5], [4.5, .06, 1.5]])) };
  await s.load({ ...reflection, weather: 'clear', weatherWarmup: 120 }); await s.step(120); await pixels('reflection-lab-dry');
  // Two real house azimuths, followed by the exact unpowered scene.
  const house = JSON.parse(readFileSync('tests/scenes/catalog/qa-w6-window-depth.json', 'utf8')) as SceneSpec;
  for (const azimuth of [45, 60]) {
    const angle = azimuth * Math.PI / 180;
    await s.load({ ...house, camera: { mode: 'pose', position: [Math.sin(angle) * 22, 14, Math.cos(angle) * 22], target: [0, 1.3, 0] } });
    await s.step(12); await pixels(`window-${azimuth}`);
    result[`window-${azimuth}`] = await s.page.evaluate(() => window.__SS__!.getState().render.lighting);
  }
  await s.load({ ...house, props: house.props!.map(p => ({ ...p, powered: false })) }); await s.step(12); await pixels('window-off');
  // Deterministic same-scene evidence for the metadata-only wreck anchor fix.
  await s.load({ name: 'wreck', ground: 'asphalt', size: 30, time: 'L4', props: [{ asset: 'veh.sedan-green', decay: 'wrecked', at: [0, 0] }], camera: { mode: 'game', target: [0, 0], zoom: 1 }, frames: 1 });
  await s.step(1); await pixels('wreck');
  result.errors = s.errors;
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2) + '\n');
  await s.close(); stopServer();
}
console.log(`${out}/measurements.json`);
