/**
 * fix67-a (L3-13): mortal-free high/low L3 run up to the corridor end (native `complete` InputFrames), then the raised corridor
 * by physical keyboard only: WASD held toward the next point of the authored ramp road (projected to the screen), never a teleport.
 * Captures each gate at zoom 0.5 and 1.5 plus a 10 s settle frame, and lists living infected around the ramp apexes.
 * Usage: TIER=high sh tools/e2e-lock.sh npx tsx tools/qa/fix67/l3-ramp-keys.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { markerWalkKeys } from '../../playtest/input';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const tier = (process.env.TIER ?? 'high') as 'low' | 'high', backend = (process.env.BACKEND ?? 'webgl2') as 'webgl2' | 'webgpu';
const out = `test-results/fix67/ramp-${tier}-${backend}`;
mkdirSync(out, { recursive: true });
const [layout] = levelThreeLayouts([JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout]);
const route = layout.roads.edges.find(e => e.id === 'l3-highway')!.points.map(([x, z]) => ({ x, z }));
const gates = [141, 146, 150, 154, 158, 163, 170];
const s = new SceneSession({ tier, backend, query: { ui: '1' } });
const rows: unknown[] = [];
const census = () => s.page.evaluate(() => {
  const a = window.__SS__!, near: unknown[] = [], world = (window.__SCENE__ as unknown as { game: { world: { entities: { iterate(): Iterable<{ id: number; infected?: unknown; hidden?: boolean; health: { current: number }; transform: { x: number; y: number; z: number } }> } } } }).game.world;
  for (const e of world.entities.iterate()) if (e.infected && e.health.current > 0 && !e.hidden && e.transform.x > 136 && e.transform.x < 168) near.push({ id: e.id, x: +e.transform.x.toFixed(2), y: +e.transform.y.toFixed(2), z: +e.transform.z.toFixed(2) });
  const p = a.getEntity(1)!.transform;
  return { tick: a.getState().tick, player: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }, near };
});
const shoot = async (name: string, extra: Record<string, unknown>) => {
  for (const zoom of [0.5, 1.5]) {
    await s.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom); await s.step(2);
    await s.screenshot(`${out}/${name}-z${zoom}.png`);
    rows.push({ shot: `${name}-z${zoom}.png`, zoom, ...extra, ...(await census()) });
  }
  await s.page.evaluate(() => window.__SS__!.camera.zoom(1)); await s.step(2);
};
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.cheats.god(true); a.bot.start('complete', { street: 'auto' });
    for (let i = 0; i < 20000 && (a.getEntity(1)?.transform.x ?? -1e9) < 126; i++) { if (a.missions.state()?.phase !== 'playing') break; await a.step(5); }
    a.bot.stop(); a.input.clear();
  }, tier);
  const start = await census();
  rows.push({ handover: 'native bot stopped; keyboard from here', ...start });
  if (start.player.x < 120) throw Error(`bot did not reach the corridor end: ${JSON.stringify(start.player)}`);
  let next = route.findIndex(p => p.x > start.player.x + 1), gate = 0, phase = 0, held: string[] = [], stuck = 0, last = start.player;
  for (let i = 0; i < 4000 && next < route.length && gate < gates.length; i++) {
    const p = (await census()).player;
    while (next < route.length - 1 && Math.hypot(route[next].x - p.x, route[next].z - p.z) < 1.6) next++;
    const target = route[next];
    const [px, py, tx, ty] = await s.page.evaluate(q => {
      const view = (window.__SCENE__ as unknown as { game: { view: { project(x: number, y: number, z: number): number[] } } }).game.view;
      const u = view.project(q[0], q[1], q[2]), w = view.project(q[3], q[1], q[4]);
      return [u[0], u[1], w[0], w[1]];
    }, [p.x, p.y, p.z, target.x, target.z]);
    phase = (phase + .37) % 1;
    const keys = markerWalkKeys((tx - px) * 1000, -(ty - py) * 1000, phase);
    for (const k of held.filter(k => !keys.includes(k))) await s.page.keyboard.up(k);
    for (const k of keys.filter(k => !held.includes(k))) await s.page.keyboard.down(k);
    held = keys;
    await s.step(6);
    stuck = Math.hypot(p.x - last.x, p.z - last.z) < .02 ? stuck + 1 : 0; last = p;
    if (stuck > 60) throw Error(`keyboard walk stuck at ${JSON.stringify(p)}`);
    if (p.x >= gates[gate]) {
      for (const k of held) await s.page.keyboard.up(k); held = [];
      await shoot(`x${gates[gate]}`, { gate: gates[gate] });
      if (gates[gate] === 150) { await s.step(600); await shoot('x150-settle10s', { gate: 150, settleS: 10 }); }
      gate++;
    }
  }
  for (const k of held) await s.page.keyboard.up(k);
} finally { writeFileSync(`${out}/ramp.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
console.log(JSON.stringify(rows.map(r => { const x = r as { shot?: string; player: unknown; near: unknown[] }; return [x.shot ?? 'handover', x.player, x.near.length]; })));
