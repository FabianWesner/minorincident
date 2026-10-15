import { expect, test } from 'vitest';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { followFrustum } from '../../tools/sim-runner/l3Bots';
import { l6Doors, l6Entries } from '../../src/data/l6';
test('@E24 PO35 tunnel entries telegraph, alternate sides, and stagger small groups ahead of the courier', async () => {
  const { world: w, mission: m } = await loadL6();
  try {
    w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
    const bangs: { tick: number; door: number }[] = [];
    w.events.on('l6.bang', e => { if (e.type === 'l6.bang') bangs.push({ tick: e.tick, door: e.breach - 1 }); });
    const p = w.entities.get(1)!;
    for (const entry of l6Entries) {
      const door = l6Doors[entry.door]; Object.assign(p.transform, { x: door.x - 27, z: 15 }); w.physics.playerBody!.setTranslation(p.transform, true);
      for (let i=0;i<155;i++) { followFrustum(w); w.update(); }
      const spawned = m.state.l6!.spawnLog.filter(s => s.wave === 4 && s.door === entry.door);
      expect(spawned).toHaveLength(2); expect(spawned[0].tick - bangs.find(b => b.door === entry.door)!.tick).toBeGreaterThanOrEqual(120);
      expect(spawned[1].tick - spawned[0].tick).toBeGreaterThanOrEqual(30); expect(spawned.every(s => s.offscreen && s.x > p.transform.x)).toBe(true);
    }
    expect(l6Entries.some(e => l6Doors[e.door].z > 15)).toBe(true); expect(l6Entries.some(e => l6Doors[e.door].z < 15)).toBe(true);
  } finally { w.dispose(); }
});
