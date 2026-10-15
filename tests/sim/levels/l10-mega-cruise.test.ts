import { expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { megaAlpha } from '../../../src/data/megaAlpha';
import { curePursuitRoute } from '../../../src/levels/L10/district';

for (const tier of ['high', 'low'] as const) {
  test(`T-E32-10-production-pressure-${tier} @E32-AC10 R6 coarse pursuit cruises at 0.7× run and the courier outruns it`, async () => {
    const w = await loadLevel('L10', 32);
    try {
      const p = w.entities.get(1)!;
      Object.assign(p.transform, { x: 3317, z: 95 });
      w.physics.playerBody!.setTranslation(p.transform, true);
      w.chunks!.setQuality(tier); w.chunks!.update();
      const boss = w.megaPursuit!, id = boss.introduce({ x: 2977, z: 95 });
      let metres = 0;
      for (let tick = 0; tick < 240; tick++) {
        const previous = { ...boss.entity()!.transform };
        w.update();
        const now = boss.entity()!.transform, step = Math.hypot(now.x - previous.x, now.z - previous.z);
        metres += step;
        expect(step).toBeLessThanOrEqual(megaAlpha.cruiseMs / 60 * 1.02);
        expect(boss.state.mode).toBe('coarse');
        expect(boss.state.id).toBe(id);
      }
      expect(Math.abs(metres / 4 / megaAlpha.cruiseMs - 1)).toBeLessThanOrEqual(.02);
      const gap = boss.distance();
      w.setInput({ move: { x: 1, z: 0 } });
      for (let tick = 0; tick < 240; tick++) w.update();
      expect(boss.distance() - gap).toBeGreaterThan(4);
    } finally { w.dispose(); }
  });

  test(`T-E32-10-shortcuts-${tier} @E32-AC10 pursuit corner cuts clear the existing district at Mega radius`, async () => {
    const w = await loadLevel('L10', 32);
    try {
      w.chunks!.setQuality(tier);
      const nodes = curePursuitRoute.nodes;
      const shortcuts = curePursuitRoute.links.filter(([a, b]) => Math.abs(nodes.findIndex(n => n.id === a) - nodes.findIndex(n => n.id === b)) > 1);
      expect(shortcuts).toHaveLength(3);
      for (const [from, to] of shortcuts) {
        const a = nodes.find(n => n.id === from)!, b = nodes.find(n => n.id === to)!;
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        for (let metres = 0; metres <= length; metres += .5) {
          const x = a.x + (b.x - a.x) * metres / length, z = a.z + (b.z - a.z) * metres / length;
          w.chunks!.update([x, z]);
          expect(w.megaPursuit!.grid.clear(x, z, megaAlpha.radius), `${from} → ${to} at ${x},${z}`).toBe(true);
          expect(w.physics.floorHeight(x, z)).toBeGreaterThanOrEqual(0);
        }
      }
    } finally { w.dispose(); }
  });
}
