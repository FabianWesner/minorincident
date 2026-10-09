import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

const out = (s: string) => appendFileSync(process.env.OUTF ?? '/tmp/x', s + '\n');
test('nav', async () => {
  const { world, mission } = await loadL1(1);
  mission.loadCheckpoint('bat');
  const nav = world.infected!.nav;
  const goal = { x: 40.03, z: -40.65 };
  const gc = nav.nearestCell(goal.x, goal.z);
  out(`goal cell ${gc} at ${nav.x(gc).toFixed(2)},${nav.z(gc).toFixed(2)} blocked=${nav.blocked[gc]} directClear=${nav.clear(goal.x, goal.z, .45)} clear0.6=${nav.clear(goal.x, goal.z, .6)}`);
  for (const [name, from] of [['B', { x: 44.1, z: 9.5 }], ['C', { x: 60.6, z: -17.5 }]] as const) {
    const fc = nav.nearestCell(from.x, from.z);
    const path: number[] = [];
    const ok = nav.path(fc, gc, path, 5_000_000);
    out(`${name} from cell ${fc} blocked=${nav.blocked[fc]} route=${ok} len=${path.length}`);
  }
  const pos = { x: 44.1, z: 9.5 }, radius = 0.42;
  const cell = nav.cell(pos.x, pos.z), near = nav.nearestCell(pos.x, pos.z, radius);
  out(`own cell ${cell} blocked=${nav.blocked[cell]} nearestCell(r)=${near} at ${nav.x(near).toFixed(2)},${nav.z(near).toFixed(2)} start=${nav.startCell(pos, radius)} escape=${nav.escapeCell(pos, radius)}`);
  const vis: string[] = [];
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const c = nav.cell(pos.x + dx * .5, pos.z + dz * .5); if (c < 0 || nav.blocked[c]) continue; const pt = { x: nav.x(c), z: nav.z(c) }; vis.push(`${pt.x.toFixed(2)},${pt.z.toFixed(2)}:${nav.visible(pos, pt, radius)}`); }
  out('FREE NEIGHBOURS ' + vis.join(' '));
  const route = { path: [] as number[], goal: -1, pathIndex: 0, hold: 0 }, wp = { x: 0, z: 0 };
  const ok = nav.steer(pos, { x: 40.03, z: -40.65 }, route, radius, wp, 3000, true);
  out(`steer first=${ok} pathLen=${route.path.length} wp=${wp.x.toFixed(2)},${wp.z.toFixed(2)}`);
  for (let i = 0; i < 40 && !ok; i++) { if (nav.steer(pos, { x: 40.03, z: -40.65 }, route, radius, wp, 3000, true)) { out(`steer ok after ${i + 1} calls pathLen=${route.path.length} wp=${wp.x.toFixed(2)},${wp.z.toFixed(2)}`); break; } }
  world.dispose();
  expect(true).toBe(true);
}, 120000);
