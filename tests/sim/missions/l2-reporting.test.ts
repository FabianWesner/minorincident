import { expect, test } from 'vitest';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';

test('@E20-AC05 ride control latency stays on its observed clock after checkpoint respawn', async () => {
  const { world, mission } = await loadL2(1);
  let arrivalAt = 0, killed = false;
  try {
    const report = runL2(world, mission, 'complete', {
      maxSeconds: 100,
      stopWhen: m => {
        const s = m.state.l2!, player = world.entities.get(1)!;
        if (!arrivalAt && s.arrivedAt) arrivalAt = s.arrivedAt;
        if (!killed && m.state.checkpoint === 'doors' && player.health.current > 0 && world.tick >= player.survivor!.invulnerableUntil) {
          world.player!.damage(player.health.current, world.tick);
          killed = true;
        }
        return killed && player.health.current > 0 && s.arrivedAt > arrivalAt;
      },
    });
    expect(killed).toBe(true);
    expect(report.deaths).toBeGreaterThan(0);
    expect(mission.state.l2!.arrivedAt).toBeGreaterThan(arrivalAt);
    expect(report.ride).not.toBeNull();
    expect(report.ride!.controlS).toBeGreaterThanOrEqual(0);
    expect(report.ride!.controlS).toBeLessThanOrEqual(.5);
  } finally { world.dispose(); }
}, 120_000);
