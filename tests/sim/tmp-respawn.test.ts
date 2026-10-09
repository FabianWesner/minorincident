import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { missionControls } from '../../src/sim/missions/controls';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

const out = (s: string) => appendFileSync(process.env.OUTF ?? '/tmp/x', s + '\n');
test('respawn spots', async () => {
  const { world, mission } = await loadL1(1);
  mission.loadCheckpoint('bat');
  const nav = world.infected!.nav, ctl = missionControls(world);
  const st = mission.state;
  const goal = st.marker ? mission.def.anchors[st.marker] : null;
  out(`marker=${st.marker} goal=${goal ? goal.x + ',' + goal.z : null}`);
  const goalCell = goal ? nav.nearestCell(goal.x, goal.z) : -1;
  const reach = goalCell >= 0 ? nav.reachableFrom(goalCell) : null;
  for (const [n, q] of [['A', { x: -2.82, z: 0.75 }], ['B', { x: 44.1, z: 9.5 }], ['B2', { x: 40.37, z: 5.36 }]] as const) { const c = nav.cell(q.x, q.z); out(`${n} cell blocked=${nav.blocked[c]} reachable-to-goal=${reach ? reach[c] : 'n/a'} clear.6=${nav.clear(q.x, q.z, .6)}`); }
  let bad = 0, total = 0;
  for (let x = -60; x <= 70; x += 13) for (let z = -45; z <= 45; z += 13) {
    const c = nav.cell(x, z); if (c < 0 || nav.blocked[c]) continue;
    ctl.teleport(1, { x, z });
    const l1 = (mission as any).l1;
    l1.noteDeath();
    world.entities.get(1)!.health.current = 0;
    l1.respawn();
    const p = world.entities.get(1)!.transform, cell = nav.cell(p.x, p.z);
    const ok = cell >= 0 && !nav.blocked[cell] && (!reach || reach[cell] === 1);
    total++; if (!ok) bad++;
    out(`death ${x},${z} -> ${p.x.toFixed(1)},${p.z.toFixed(1)} routable=${ok}`);
  }
  out(`SUMMARY bad=${bad} of ${total}`);
  world.dispose();
  expect(true).toBe(true);
}, 300000);
