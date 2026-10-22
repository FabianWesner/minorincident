import { expect, test, vi } from 'vitest';
import { loadLevel } from './world';
import { l2 } from '../../../src/data/l2';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';

for (const tier of ['high', 'low'] as const) test(`5 L2 escape ${tier}: every street batch and bridge cluster admits its quota and reaches its authored home`, async () => {
  const w = await loadLevel('L2', 1, tier);
  try {
    const s = w.missions!.state.l2!, c = w.missions!.l2! as unknown as { spawnEscape(): void; emergePending(all?: boolean): void };
    w.combat!.damage.god = true; w.update(); c.spawnEscape();
    // Leave all entrances out of the courier's admission exclusion. The real cap, emergence, rush and navigation stay live.
    const player = w.entities.get(1)!; Object.assign(player.transform, { x: 85, z: 80 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    const entries = s.pending as { id: number; home: { x: number; z: number } }[], admitted = new Set<number>(), reached = new Set<number>();
    const scale = tier === 'low' ? l2.escape.lowScale : 1;
    const expected = Math.ceil(l2.cluster.count * scale) + l2.escape.groups.reduce((n, [, , count]) => n + Math.ceil(count * scale), 0);
    expect(entries.length, 'authoring must enumerate every escape batch').toBe(expected);
    // Keep phase calm to isolate this quota from the later market-collapse alarm.
    s.phase = 'calm';
    for (let i = 0; i < 90 * 60 && reached.size < expected; i++) {
      followFrustum(w); c.emergePending(true);
      for (const q of entries) { const e = w.entities.get(q.id); if (e) e.health.current = e.health.max = 1_000_000; }
      w.update();
      for (const q of entries) {
        const e = w.entities.get(q.id); if (!e || e.hidden || e.pendingAdmission || e.infected?.hidden) continue;
        admitted.add(q.id);
        if (!e.emerging && Math.hypot(e.transform.x - q.home.x, e.transform.z - q.home.z) <= 10) { reached.add(q.id); w.infected!.release(e); }
      }
    }
    console.log(`[qa:invariants] L2/${tier}/escape authored=${expected} admitted=${admitted.size} reached=${reached.size}`);
    expect({ admitted: admitted.size, reached: reached.size }, 'waves invariant: every authored escape arrival').toEqual({ admitted: expected, reached: expected });
  } finally { vi.restoreAllMocks(); w.dispose(); }
}, 240_000);
