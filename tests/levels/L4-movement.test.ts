import { afterEach, expect, test } from 'vitest';
import { survivor } from '../../src/data/survivor';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function place(w: SimWorld, at: { x: number; z: number }): void {
  w.clearInput(); w.player!.locomotion.reset();
  const p = w.entities.get(1)!.transform;
  Object.assign(p, at, { y: .72 }); w.physics.playerBody!.setTranslation(p, true); w.physics.playerBody!.setNextKinematicTranslation(p); w.spatial.set(1, p.x, p.z);
}
for (const phase of ['plaza', 'war', 'respawn']) test(`@E22 L4 ${phase} permits mouse and direct movement on open plaza tiles`, async () => {
  const loaded = await loadL4(2); world = loaded.world;
  const w = world, m = loaded.mission;
  while (m.state.l4!.phase === 'convoy') w.update();
  w.combat!.damage.god = true; if (phase !== 'plaza') m.completeObjective('quartermaster');
  if (phase !== 'plaza') { while (!m.state.l4!.turnAt) w.update(); step(w, 180); }
  if (phase === 'respawn') {
    w.player!.damage(1000, w.tick, true); step(w, 180);
    expect(w.entities.get(1)!.health.current).toBeGreaterThan(0); expect(m.state.checkpoint).toBe('turn');
  }
  // Centre shifted 0.7 m west of the original (-17.5, 4): the parked convoy's nav margin (l4-bus-clear: hull + .85 m) now covers the
  // old east goal tile (-13.26, -0.24). The test still walks the same 6 m diagonals in all four directions from one start; only the
  // start moved so that every goal tile is genuinely open ground.
  // Before pickup, the north-west goal must also clear the active quartermaster's interaction ring.
  const center = phase === 'plaza' ? { x: -20.5, z: 1 } : { x: -18.2, z: 4 }, d = 6 / Math.SQRT2;
  for (const [dx, dz] of [[-d, d], [d, -d], [-d, -d], [d, d]]) for (const scheme of ['mouse-only', 'keyboard', 'touch'] as const) {
    const target = { x: center.x + dx, z: center.z + dz };
    expect(w.infected!.nav.clear(target.x, target.z, survivor.radius)).toBe(true);
    expect(m.interactSnap(target) ?? target, 'ground goal is outside active interaction rings').toEqual(target);
    place(w, center);
    expect(w.infected!.nav.visible(center, target, survivor.radius), `${scheme}: open straight route`).toBe(true);
    if (scheme === 'mouse-only') {
      w.setInput({ moveTarget: target }); w.update(); w.applyInput(emptyInput(), scheme); step(w, 240);
    } else {
      w.applyInput({ ...emptyInput(), move: { x: dx / 6, z: dz / 6 } }, scheme); step(w, 82); w.applyInput(emptyInput(), scheme); step(w, 10);
    }
    const p = w.entities.get(1)!.transform;
    expect(Math.hypot(p.x - target.x, p.z - target.z), `${phase}/${scheme}/${dx},${dz}`).toBeLessThan(1);
  }
}, 120_000);

test('@E22 a real L4 armory-table corner cannot trap an outward click', async () => {
  const loaded = await loadL4(2); world = loaded.world;
  const w = world;
  while (loaded.mission.state.l4!.phase === 'convoy') w.update();
  const corner = { x: -25.855, z: 1.855 }, target = { x: corner.x - Math.SQRT2, z: corner.z + Math.SQRT2 };
  expect(w.infected!.nav.clear(corner.x, corner.z, survivor.radius, true)).toBe(true);
  expect(w.infected!.nav.clear(corner.x, corner.z, survivor.radius + .02)).toBe(false);
  place(w, corner);
  w.setInput({ moveTarget: target }); w.update(); w.applyInput(emptyInput(), 'mouse-only'); step(w, 120);
  const p = w.entities.get(1)!.transform;
  expect(Math.hypot(p.x - target.x, p.z - target.z)).toBeLessThan(1);
}, 120_000);
