import { expect, test } from 'vitest';
import { cureEncounterSlots, curePaceEncounters } from '../../src/levels/L10/encounters';
import { loadLevel } from '../../tools/sim-runner/levels';

test('L10 roadblocks open on the final permanent cohort kill on both tiers', async () => {
  const groups = ['setpiece-quarantine-gate', 'setpiece-burning-convoy', 'setpiece-dark-underpass', 'setpiece-field-hospital'];
  for (const tier of ['high', 'low'] as const) {
    const world = await loadLevel('L10', 1, undefined, 0, { quality: tier });
    try {
      const encounters = world.l10Encounters!;
      for (const groupId of groups) {
        const group = curePaceEncounters.find(g => g.id === groupId)!;
        const slots = cureEncounterSlots(group, tier);
        const gateId = world.interactables!.spawn('gate', { x: group.at[0], z: 95 }, { halfX: .2, halfZ: 50, radius: 2 });
        const gate = world.entities.get(gateId)!;
        gate.archetype = 'device.l10-roadblock';
        world.interactables!.block(gateId, { x: group.at[0], y: .7, z: 95, halfX: .2, halfY: 1.2, halfZ: 50 });
        (encounters.state.roadblockGates ??= {})[groupId] = gateId;
        (encounters.state.roadblockMountedApproach ??= {})[groupId] = true;
        (encounters.state.roadblockDismounted ??= {})[groupId] = true;
        for (const slot of slots) encounters.state.spawned[`${slot.key}:0`] = -1;
        delete encounters.state.spawned[`${slots[2].key}:0`];
        const actorId = world.infected!.spawn('infected.runner', { x: 5, z: 0 }, { offNav: true });
        encounters.state.spawned[`${slots[0].key}:0`] = actorId;
        const actor = world.entities.get(actorId)!;
        const survivorId = world.infected!.spawn('infected.runner', { x: 6, z: 0 }, { offNav: true });
        encounters.state.spawned[`${slots[1].key}:0`] = survivorId;
        const survivor = world.entities.get(survivorId)!;
        const hit = { attackId: 1, actionId: 'weapon.handgun', sourceId: 1, targetId: actorId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: actor.health.current, multiplier: 1, type: 'melee' as const, knockback: 0, stagger: 0 };
        world.combat!.damage.apply(hit);
        expect(actor.infected!.recoverAt, `${tier}/${groupId} knockdown`).toBeGreaterThan(world.tick);
        expect(gate.interactable!.open, `${tier}/${groupId} recoverable actor`).toBe(false);
        const tick = world.tick;
        world.combat!.damage.apply({ ...hit, actionId: 'weapon.rocket-launcher', type: 'explosive' });
        expect(gate.interactable!.open, `${tier}/${groupId} surviving member`).toBe(false);
        world.combat!.damage.apply({ ...hit, targetId: survivorId, base: survivor.health.current, actionId: 'weapon.rocket-launcher', type: 'explosive' });
        expect(gate.interactable!.open, `${tier}/${groupId} unadmitted member`).toBe(false);
        const lastId = world.infected!.spawn('infected.runner', { x: 7, z: 0 }, { offNav: true });
        encounters.state.spawned[`${slots[2].key}:0`] = lastId;
        world.combat!.damage.apply({ ...hit, targetId: lastId, base: world.entities.get(lastId)!.health.current, actionId: 'weapon.rocket-launcher', type: 'explosive' });
        expect(world.tick).toBe(tick);
        expect(gate.interactable!.open, `${tier}/${groupId} final kill`).toBe(true);
        expect(world.interactables!.walls.some(w => w.entityId === gateId)).toBe(false);
        expect(world.entities.get(actorId)).toBeDefined();
      }
    } finally { world.dispose(); }
  }
});
