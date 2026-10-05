import { expect, test } from 'vitest';
import { arena, spawn, step } from './helpers';
test('T-E07-turning @E07 adult-only E08 grab hook is deterministic and preserves mapped variants within caps', async () => {
  const w = await arena(), butcher = spawn(w, 'butcher', 1, 0, 'idle'), ai = w.infected!;
  expect(ai.tryGrabCivilian(butcher.id, { id: 99, adult: false, variant: 'child', position: { x: 1, z: 0 } })).toBeNull();
  expect(ai.tryGrabCivilian(butcher.id, { id: 99, adult: true, variant: 'cashier', position: { x: 20, z: 0 } })).toBeNull();
  const trials = Array.from({ length: 100 }, () => ai.tryGrabCivilian(butcher.id, { id: 99, adult: true, variant: 'cashier', position: { x: 1, z: 0 } })); expect(trials.filter(Boolean).length).toBeGreaterThan(40); expect(trials.filter(Boolean).length).toBeLessThan(80); expect(trials.find(Boolean)!.rescueUntil).toBe(90);
  ai.director.levelCap = 1; ai.turnCivilian({ adult: true, variant: 'inf.cashier', archetype: 'infected.runner', position: { x: 2, z: 0 } }); step(w, 1); expect(ai.director.queue).toHaveLength(1); butcher.health.current = 0; step(w, 1); expect(ai.active.find((e) => e.health.current > 0)!.infected!.variant).toBe('inf.cashier'); expect(ai.director.count).toBe(1);
});
