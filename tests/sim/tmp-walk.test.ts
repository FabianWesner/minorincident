import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import { missionControls } from '../../src/sim/missions/controls';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

const out = (s: string) => appendFileSync(process.env.OUTF ?? '/tmp/x', s + '\n');
const frame = (patch: Partial<InputFrame>) => ({ ...emptyInput(), ...patch }) as InputFrame;
for (const [name, from, to] of [
  ['B', { x: 44.1, z: 9.5 }, { x: 40.03, z: -40.65 }],
] as const) test(`walk ${name}`, async () => {
  const { world, mission } = await loadL1(1);
  mission.loadCheckpoint('bat');
  const ctl = missionControls(world);
  world.combat!.damage.god = true;
  ctl.teleport(1, from);
  const p = world.entities.get(1)!.transform;
  const nav = world.infected!.nav;
  for (const r of [.3, .32, .34, .4, .42]) out(`clear@44.1,9.5 r=${r}: ${nav.clear(44.1, 9.5, r)}  z+.06:${nav.clear(44.1, 9.56, r)} x-.045:${nav.clear(44.055, 9.5, r)} both:${nav.clear(44.055, 9.559, r)}`);
  const q = { x: 44.1, z: 9.5 }; nav.move(q, -0.0447, 0.0588, .34); out(`move -> ${q.x},${q.z}`);
  for (let t = 0; t < 900; t++) {
    world.applyInput(frame(t === 0 ? { moveTarget: to } : {}), 'mouse-only');
    world.update();
    const c = world.controls as any;
    if (t % 150 === 0) out(`t=${t} p=${p.x.toFixed(3)},${p.z.toFixed(3)} wp=${c.waypoint.x.toFixed(2)},${c.waypoint.z.toFixed(2)} path=${c.route.path.length} idx=${c.route.pathIndex} dbg=${(globalThis as any).__dbg} eff.move=${world.effectiveInput.move.x.toFixed(2)},${world.effectiveInput.move.z.toFixed(2)} nav=${world.effectiveInput.navigation}`);
  }
  world.dispose();
  expect(true).toBe(true);
}, 120000);
