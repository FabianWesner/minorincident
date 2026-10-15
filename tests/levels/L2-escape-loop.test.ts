import { afterEach, describe, expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';

/** PO 10-09: the escape checkpoint was saved mid-chase, so every death respawned the courier into the same scrum (death loop). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const near = (w: SimWorld, r: number) => { const p = w.entities.get(1)!.transform; return w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < r).length; };
async function atRadio(): Promise<{ w: SimWorld; m: Mission }> {
  const l = await loadL2(2); world = l.world;
  runL2(l.world, l.mission, 'complete', { stopWhen: m => m.state.l2!.radioAt > 0 && m.world.tick - m.state.l2!.radioAt > 60 * 25 });
  return { w: l.world, m: l.mission };
}
/** Puts up to `n` live infected in a ring of 3-8 m around the courier (a chase scrum). */
function scrum(w: SimWorld, n: number): number {
  const p = w.entities.get(1)!.transform, list = w.infected!.active.filter(e => e.health.current > 0).slice(0, n);
  list.forEach((e, i) => { const a = i / list.length * Math.PI * 2, r = 3 + (i % 6); e.transform.x = p.x + Math.cos(a) * r; e.transform.z = p.z + Math.sin(a) * r; w.spatial.set(e.id, e.transform.x, e.transform.z); });
  return list.length;
}
function die(w: SimWorld, m: Mission, id: string): void {
  const p = w.entities.get(1)!; while (w.tick < p.survivor!.invulnerableUntil) w.update();
  w.player!.damage(p.health.current, w.tick);
  for (let i = 0; i < 400 && m.state.checkpoint === id && w.entities.get(1)!.health.current <= 0; i++) w.update();
  w.update();
}

describe('L2 escape death loop', () => {
  test('the escape checkpoint waits for a calm moment (nothing within 10 m, health >= 70 %)', async () => {
    const l = await loadL2(2); world = l.world; const w = l.world, m = l.mission;
    runL2(w, m, 'complete', { stopWhen: mm => mm.state.l2!.radioAt > 0 });
    expect(m.state.l2!.radioAt).toBeGreaterThan(0);
    // Hold a scrum on the courier: no escape checkpoint while it lasts.
    for (let i = 0; i < 300; i++) { scrum(w, 6); w.entities.get(1)!.health.current = w.entities.get(1)!.health.max; w.update(); }
    expect(m.state.checkpoint, 'checkpoint while infected within 10 m').toBe('doors');
    // Calm: the pending checkpoint is taken.
    const population = w.infected!.active.length, player = w.entities.get(1)!;
    for (const e of w.infected!.active) {
      let moved = false;
      for (let bearing = 0; bearing < 8 && !moved; bearing++) {
        const angle = bearing * Math.PI / 4;
        moved = w.solids.relocate(e, { x: player.transform.x + Math.cos(angle) * 30, z: player.transform.z + Math.sin(angle) * 30, y: e.transform.y }, 'test.calm-relocation', 6);
      }
      expect(moved).toBe(true);
      expect(Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)).toBeGreaterThanOrEqual(10);
    }
    expect(w.infected!.active).toHaveLength(population);
    // The final scrum tick may have dealt damage after its fixture heal. Gate
    // health independently of crowd geometry, including the exact 70% boundary.
    player.health.current = player.health.max * .69;
    for (let i = 0; i < 40; i++) w.update();
    expect(m.state.checkpoint).toBe('doors');
    player.health.current = player.health.max * .7;
    for (let i = 0; i < 40 && m.state.checkpoint !== 'escape'; i++) w.update();
    expect(m.state.checkpoint).toBe('escape');
  }, 600_000);

  test('a courier who dies twice at the same checkpoint respawns with fewer infected within 25 m (the shared respawn already pushes them out of 9 m)', async () => {
    const { w, m } = await atRadio();
    const n = scrum(w, 12); expect(n).toBeGreaterThanOrEqual(8);
    m.state.l2!.cpWait = []; m.requestCheckpoint('escape'); w.update(); w.update();
    expect(m.state.checkpoint).toBe('escape');
    const counts: number[] = [];
    for (let death = 1; death <= 4; death++) { die(w, m, 'escape'); counts.push(near(w, 25)); }
    // Death 1 respawns into the full scrum; from the 2nd respawn on it thins, step by step.
    expect(counts[0]).toBeGreaterThanOrEqual(n - 2);
    expect(counts[1]).toBeLessThan(counts[0]);
    expect(counts[3]).toBeLessThan(counts[1]);
    expect(counts[3]).toBeLessThanOrEqual(Math.ceil(n * (1 - l2.mercy.maxFrac)) + 1);
  }, 600_000);
});
