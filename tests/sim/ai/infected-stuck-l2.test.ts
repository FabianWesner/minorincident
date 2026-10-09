import { expect, test } from 'vitest';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';

/**
 * PO 2026-10-09: "sometimes Zombies are stuck somewhere, like this one is not moving at all." One L2 run (complete bot,
 * seed 1, 150 s, god mode): no active infected that should be moving (not pausing, winding up, biting, staggered, rising
 * or attached) stands still for more than 5 s. Before the fix: 9540 of 41794 samples (23 %), runs up to 23 s, mostly
 * wanderers wedged in yard-fence gaps (no nav cell at the 0.65 m clearance, A* from a 3-cell pocket) and route starvation
 * by goals with no route re-requested every tick.
 */
test('L2: infected never stand frozen (single seed, 150 s)', async () => {
  const { world: w, mission } = await loadL2(1);
  const track = new Map<number, { x: number; z: number; since: number }>();
  let stuck = 0, samples = 0, worst = 0, worstAt = '';
  runL2(w, mission, 'complete', { maxSeconds: 150, god: true, stopWhen: () => {
    if (w.tick % 6) return false;
    for (const e of w.infected!.active) {
      const b = e.infected!, l = b.l1;
      if (!l || e.health.current <= 0 || e.hidden || e.attachedTo !== undefined || (e.infectionRise && w.tick < e.infectionRise.until)) { track.delete(e.id); continue; }
      const idle = w.tick < l.pauseUntil || b.state === 'attack' || l.mode === 'bite' || l.cueUntil > 0 || e.combat!.staggerUntil > w.tick;
      const t = track.get(e.id) ?? { x: e.transform.x, z: e.transform.z, since: w.tick };
      if (idle || Math.hypot(e.transform.x - t.x, e.transform.z - t.z) > .3) { t.x = e.transform.x; t.z = e.transform.z; t.since = w.tick; }
      track.set(e.id, t); samples++;
      const still = (w.tick - t.since) / 60;
      if (still > 2) stuck++;
      if (still > worst) { worst = still; worstAt = `id ${e.id} ${l.mode} at ${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} t=${(w.tick / 60).toFixed(0)} s`; }
    }
    return false;
  } });
  console.info(`[l2-stuck] still > 2 s in ${stuck} of ${samples} samples (${(stuck / samples * 100).toFixed(2)} %); longest ${worst.toFixed(1)} s (${worstAt})`);
  expect(samples).toBeGreaterThan(10_000);
  expect(stuck / samples).toBeLessThan(0.01);
  expect(worst).toBeLessThanOrEqual(5);
}, 600_000);
