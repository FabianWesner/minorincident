import { expect, test } from 'vitest';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { missionIds } from '../../src/levels/missions';
import { loadLevel } from '../../tools/sim-runner/levels';

// Production PO seed and refuge-door-13, plus every campaign level using refuge-door-*.
test('@E22 PO15 closed refuge doors keep the entire fleeing group visibly in the world, across L1–L10', async () => {
  for (const level of new Set([...missionIds, 'L7'] as const)) {
    const w = level === 'L4' ? (await loadL4(1)).world : await loadLevel(level, 1);
    try {
      if (level === 'L4') while (w.missions!.state.l4!.phase === 'convoy') w.update();
      const outbreak = w.npcs?.civilians.outbreak;
      const refuge = outbreak?.refuges.find(r => r.id === 'refuge-door-13') ?? outbreak?.refuges.find(r => r.id.startsWith('refuge-door-'));
      if (!outbreak || !refuge) continue;
      const ids = Array.from({ length: 6 }, (_, i) => outbreak.spawnPedestrian({ x: refuge.x, z: refuge.z }, { role: i === 0 ? 'soldier' : undefined }));
      const before = [...w.entities.iterate()].filter(e => e.civilian).length;
      // Start the actual arrival beat at its already snapped exterior target, with no combat to confound persistence.
      for (const id of ids) {
        const e = w.entities.get(id)!, c = e.civilian!;
        c.state = 'flee'; c.l1!.refuge = refuge.id; c.l1!.target = { x: refuge.x, z: refuge.z }; c.l1!.repickAt = 100000000;
      }
      for (let i = 0; i < 240; i++) { w.tick++; outbreak.update(); }
      expect([...w.entities.iterate()].filter(e => e.civilian).length, level).toBe(before);
      for (const id of ids) {
        const e = w.entities.get(id)!;
        expect(e, `${level}/${id}`).toBeDefined(); expect(e.hidden, level).not.toBe(true);
        expect(e.civilian!.state, level).toBe('calm');
        expect(e.civilian!.story?.clip, level).toBe('npc-cower');
        expect(Math.hypot(e.transform.x - refuge.x, e.transform.z - refuge.z), level).toBeLessThan(1.5);
      }
      expect(w.openDoors.has(refuge.id), 'closed door stays closed; nobody crosses it').toBe(false);
    } finally { w.dispose(); }
  }
}, 240000);
