import { expect, test } from 'vitest';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { loadL4 } from '../../../tools/sim-runner/l4Bots';

for (const kind of ['crawler', 'riot', 'firefighter', 'hazmat']) for (const rescued of [false, true]) test(`L4 native ${kind} contact ${rescued ? 'can be rescued' : 'can turn a defender'}`, async () => {
  const { world, mission } = await loadL4(2);
  try {
    const state = mission.state.l4!;
    const soldier = world.entities.get(state.soldierIds.find(id => id !== state.qmId)!)!;
    soldier.civilian!.ally = undefined;
    const id = world.infected!.spawn(`infected.${kind}`, { x: soldier.transform.x + .9, z: soldier.transform.z });
    const attacker = world.entities.get(id)!;
    attacker.infected!.heardTargetId = soldier.id;
    (world.infected as unknown as { attackVictim(e: EntitySnapshot, damage: number): void }).attackVictim(attacker, 10);
    expect(soldier.civilian!.state).toBe('grabbed');
    expect(world.npcs!.civilians.holds(id)).toBe(true);
    expect(soldier.infection).toBeUndefined();
    const neighbourId = world.infected!.spawn(`infected.${kind}`, { x: soldier.transform.x - .9, z: soldier.transform.z });
    const neighbour = world.entities.get(neighbourId)!; neighbour.infected!.heardTargetId = soldier.id;
    (world.infected as unknown as { attackVictim(e: EntitySnapshot, damage: number): void }).attackVictim(neighbour, 10);
    expect(soldier.civilian!.state).toBe('grabbed');
    expect(soldier.civilian!.attacker).toBe(id);
    world.tick += 90;
    if (rescued) attacker.combat!.staggerUntil = world.tick + 30;
    (world.npcs!.civilians.outbreak as unknown as { held(e: EntitySnapshot): void }).held(soldier);
    if (rescued) {
      expect(soldier.infection).toBeUndefined();
      expect(soldier.civilian!.state).toBe('flee');
      expect(world.npcs!.civilians.holds(id)).toBe(false);
    } else expect(soldier.infection).toBeDefined();
  } finally { world.dispose(); }
});
