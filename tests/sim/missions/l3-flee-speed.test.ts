import { expect, test } from 'vitest';
import { l3 } from '../../../src/data/l3';
import { emptyInput } from '../../../src/input/InputFrame';
import { followFrustum, loadL3 } from '../../../tools/sim-runner/l3Bots';

test('T-E21-flee-speed @E21 regulars stay below courier speed, sprinters are at most 5% of successful spawns', async () => {
  const { world: w } = await loadL3(1);
  try {
    const ai = w.infected!, at = { x: 32, z: .5 };
    let sprinters = 0;
    for (let i = 1; i <= 60; i++) {
      // Rejected requests and recycled pool entries must not earn extra sprinters.
      expect(() => ai.spawn('infected.sprinter', { x: -9999, z: -9999 })).toThrow();
      const id = ai.spawn('infected.sprinter', at, { tier: 'athletic', variant: 'inf.jogger' });
      const e = w.entities.get(id)!;
      if (e.archetype === 'infected.sprinter') sprinters++;
      else {
        expect(e.infected!.speed).toBeLessThanOrEqual(4);
        expect(e.infected!.l1!.runSpeed).toBeLessThanOrEqual(4);
      }
      expect(sprinters / i).toBeLessThanOrEqual(.05);
      ai.release(e);
    }
    expect(sprinters).toBe(3);
    const id = ai.spawn('infected.runner', at, { tier: 'athletic' }), e = w.entities.get(id)!;
    const p = w.entities.get(1)!;
    Object.assign(p.transform, { x: 35, z: .5 });
    w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, 35, .5);
    w.combat!.damage.god = true;
    // At contact range this exercises the accelerated bite approach and actual lunge impulse.
    let attacked = false, maxSpeed = 0;
    for (let i = 0; i < 240; i++) {
      followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update();
      attacked ||= e.infected!.state === 'attack';
      maxSpeed = Math.max(maxSpeed, Math.hypot(e.locomotion?.vx ?? 0, e.locomotion?.vz ?? 0));
    }
    expect(attacked).toBe(true);
    expect(maxSpeed).toBeLessThanOrEqual(4 + 1e-6);
    // The same athletic tier retains its original speed outside L3.
    ai.release(e); w.scenario = 'L1';
    const other = w.entities.get(ai.spawn('infected.runner', at, { tier: 'athletic' }))!;
    expect(other.infected!.l1!.runSpeed).toBeGreaterThan(4);
  } finally { w.dispose(); }
}, 120_000);

test('T-E21-flee-density @E21 S2 Boulevard is thinned to <=60% while the fivefold segment total stays queued', () => {
  const groups = l3.density.groups[1];
  const boulevard = groups.filter(([, street]) => street === 'blvd').reduce((sum, [, , n]) => sum + n * l3.density.streetMultiplier, 0);
  expect(boulevard).toBeLessThanOrEqual(200 * .6);
  expect(groups.reduce((sum, [, , n]) => sum + n * l3.density.streetMultiplier, 0)).toBe(600);
  // Preserve the existing low-tier rounding before multiplication too (315 residents).
  expect(groups.reduce((sum, [, , n]) => sum + 5 * Math.ceil(n * .5 * l3.density.streetMultiplier / 5), 0)).toBe(315);
});
