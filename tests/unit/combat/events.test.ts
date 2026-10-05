import { expect, test } from 'vitest';
import { arena, dummy, equip, fire, step } from '../../sim/combat/helpers';

test('T-E05-12 @E05 @E05-AC12 attack/hit/kill carry stable entity IDs, positions and one lethal event', async () => {
  for (const id of ['weapon.bat', 'weapon.pistol', 'weapon.grenade', 'ability.ground-slam', 'weapon.test-projectile']) {
    const w = await arena(); equip(w, [id]); w.combat!.damage.god = true;
    const target = dummy(w, 1, 0, 10); fire(w, 'LEFT', { x: 1, z: 0 }, { x: 1, z: 0 }); step(w, 120);
    const events = w.events.events(), attack = events.find((e) => e.type === 'combat.attack');
    expect(attack).toMatchObject({ sourceId: 1, actionId: id, side: 'LEFT', attackId: 1, position: { y: expect.any(Number), x: expect.any(Number), z: expect.any(Number) } });
    const hit = events.find((e) => e.type === 'combat.hit' && e.targetId === target);
    expect(hit).toMatchObject({ sourceId: 1, targetId: target, attackId: 1, position: { x: 1, y: 0.7, z: 0 }, amount: 10 });
    expect(events.filter((e) => e.type === 'combat.kill')).toEqual([{ ...hit, type: 'combat.kill' }]);
    expect(events.indexOf(attack!)).toBeLessThan(events.indexOf(hit!));
    if (id === 'weapon.bat') expect(events).toContainEqual({ type: 'combat.hit-stop', tick: 7, sourceId: 1, durationMs: 50 });
  }
});
