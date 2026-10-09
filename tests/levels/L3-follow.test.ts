import { describe, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { l3 } from '../../src/data/l3';
import { ArmyCheckpointBoom } from '../../src/sim/missions/ArmyCheckpointBoom';
import { loadL3, followFrustum } from '../../tools/sim-runner/l3Bots';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { Placement } from '../../src/levels/districts/types';

describe('L3 squad and checkpoint', () => {
  test('closed checkpoint boom stops a walking courier and shared NPC navigation; opening restores the lane', async () => {
    const { world: w } = await loadL3(1);
    try {
      const p = w.entities.get(1)!, start = { x: l3.finale.barrierX - 2, y: p.transform.y, z: 0 };
      Object.assign(p.transform, start); w.physics.playerBody!.setTranslation(start, true); w.spatial.set(1, start.x, 0);
      const boom = new ArmyCheckpointBoom(w, l3.finale.barrierX); boom.set(true);
      for (let i = 0; i < 120; i++) { w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'mouse-only'); w.update(); }
      expect(p.transform.x).toBeLessThan(l3.finale.barrierX);
      expect(w.infected!.nav.clear(l3.finale.barrierX, 0, .35)).toBe(false);
      boom.set(false);
      expect(w.infected!.nav.clear(l3.finale.barrierX, 0, .35)).toBe(true);
      for (let i = 0; i < 180; i++) { w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'mouse-only'); w.update(); }
      expect(p.transform.x, JSON.stringify(p.transform)).toBeGreaterThan(l3.finale.barrierX + 1);
    } finally { w.dispose(); }
  }, 120_000);
  test('boom waits for the last living officer; a dead officer cannot prevent closure', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const ids = [1, ...m.state.l3!.squadIds], boom = new ArmyCheckpointBoom(w, l3.finale.barrierX);
      ids.forEach(id => { w.entities.get(id)!.transform.x = 142; });
      const last = w.entities.get(ids.at(-1)!)!; last.transform.x = 136;
      expect(boom.ready(ids)).toBe(false);
      last.transform.x = 139; expect(boom.ready(ids)).toBe(true);
      last.transform.x = 136; last.health.current = 0; expect(boom.ready(ids)).toBe(true);
    } finally { w.dispose(); }
  }, 120_000);
  test('every closed army kit placement keeps the arm collider; only explicitly raised arms omit it', () => {
    const p: Placement = { id: 'checkpoint', assetId: 'kit.army-checkpoint', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-9, 0, -9], max: [9, 6, 9] } };
    const closed = placementColliders([p], []), open = placementColliders([{ ...p, boomOpen: true }], []);
    expect(closed.length - open.length).toBe(1);
    expect(closed.some(c => c.aabb.min[0] < -6 && c.aabb.max[0] > -6 && c.aabb.min[2] < 0 && c.aabb.max[2] > 0 && c.aabb.min[1] > 1)).toBe(true);
  });
  for (const street of ['commerce', 'blvd', 'oak'] as const) test(`living officers regroup on ${street} instead of being marked separated`, async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      // Isolate shared follower steering; street crowds are covered by the real-input playthrough.
      m.state.l3!.pending = []; m.state.l3!.waves = []; m.state.l3!.populated = [true, true, true];
      const p = w.entities.get(1)!, z = l3.map.streets[street];
      const start = { x: -110, y: p.transform.y, z }; Object.assign(p.transform, start); w.physics.playerBody!.setTranslation(start, true);
      const squad = m.state.l3!.squad;
      squad.forEach((q, i) => { const e = w.entities.get(q.id)!; Object.assign(e.transform, { x: -115 - i, z: z + (i % 2 ? 1 : -1) * 1.5 }); });
      const still = new Map<number, { x: number; z: number; ticks: number }>();
      let stuckTicks = 0;
      for (let tick = 0; tick < 900; tick++) {
        followFrustum(w); w.applyInput({ ...emptyInput(), moveTarget: { x: -62, z }, navigation: true }, 'mouse-only'); w.update();
        for (const q of squad) {
          const e = w.entities.get(q.id)!, previous = still.get(q.id);
          const ticks = previous && Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z) < .005 ? previous.ticks + 1 : 0;
          still.set(q.id, { x: e.transform.x, z: e.transform.z, ticks });
          if (Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) > 10) stuckTicks = Math.max(stuckTicks, ticks);
        }
      }
      expect(stuckTicks).toBeLessThanOrEqual(180);
      expect(p.transform.x).toBeGreaterThan(-64);
      expect(m.state.l3!.lost.filter(q => q.cause === 'separated')).toHaveLength(0);
      for (const q of squad) {
        const e = w.entities.get(q.id)!;
        expect(e.health.current).toBeGreaterThan(0);
        expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), JSON.stringify({ courier: p.transform, officer: e.transform })).toBeLessThanOrEqual(8);
      }
    } finally { w.dispose(); }
  }, 120_000);
});
