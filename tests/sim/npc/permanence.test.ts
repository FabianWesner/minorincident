import { expect, test } from 'vitest';
import { groveWorld, step, anchor } from './l1-grove';
import { missionControls } from '../../../src/sim/missions/controls';

test('20 corpses keep their IDs and positions after leaving 60 m and returning @smoke', async () => {
  const { w } = await groveWorld(1, { civilians: 0 });
  try {
    const ai = w.infected!, at = anchor('lab-exit-front'), ids: number[] = [];
    for (let i = 0; i < 20; i++) {
      const cell = ai.nav.nearestCell(at.x - 8 - i % 5, at.z + Math.floor(i / 5));
      const id = ai.spawn('infected.runner', { x: ai.nav.x(cell), z: ai.nav.z(cell) }, { state: 'idle' });
      ids.push(id); w.entities.get(id)!.health.current = 0;
    }
    step(w, 121); const poses = ids.map(id => ({ ...w.entities.get(id)!.transform }));
    expect(ai.active).toHaveLength(0); expect(ai.pool).toHaveLength(350);
    const controls = missionControls(w); controls.teleport('player', { x: at.x - 65, z: at.z });
    step(w, 3601); controls.teleport('player', at); step(w, 1);
    for (const [i, id] of ids.entries()) {
      expect(w.entities.get(id)).toMatchObject({ id, corpse: true, health: { current: 0 }, transform: poses[i] });
      expect(w.entities.get(id)!.motion).toBeUndefined(); expect(w.entities.get(id)!.locomotion).toBeUndefined();
    }
  } finally { w.dispose(); }
});

test('a dropped hand prop and an uncollected weapon persist for the level', async () => {
  const { w, outbreak } = await groveWorld(1, { civilians: 0 });
  try {
    const id = outbreak.spawnPedestrian({ x: 55, z: -10 }, { handProp: 'coffee', schedule: [{ activity: 'look', anchor: 'test', target: { x: 55, z: -10 }, ticks: 60000 }] });
    outbreak.infect(w.entities.get(id)!, 1); step(w, 1);
    const dropped = [...w.entities.iterate()].find(e => e.droppedProp)!; expect(dropped.droppedProp).toBe('coffee');
    const weapon = w.combat!.pickups.spawn('weapon.bat', { x: 50, z: -10 }, true);
    step(w, 3601); expect(w.entities.get(dropped.id)).toBe(dropped); expect(w.entities.get(weapon)).toBeDefined();
  } finally { w.dispose(); }
});
