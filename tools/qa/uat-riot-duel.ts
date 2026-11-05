/** Before/after main's close-range shield calculator on the same progressed L4 save. */
import { writeFileSync } from 'node:fs';
import { loadL4 } from '../sim-runner/l4Bots';
import { damageAmount, type DamageEvent } from '../../src/sim/combat/Damage';
import { Status } from '../../src/sim/combat/Status';
import type { EntitySnapshot } from '../../src/sim/world/types';

const results: unknown[] = [];
for (const before of [true, false]) {
  const { world, mission } = await loadL4(1, 'low');
  try {
    mission.loadCheckpoint('turn');
    const ai = world.infected!, player = world.entities.get(1)!;
    ai.director.update = () => {};
    for (const e of [...ai.active]) ai.release(e);
    for (const e of world.entities.iterate()) if (e.civilian?.ally) { e.civilian.ally.nextAttack = world.tick + 100_000; e.civilian.ally.strikeAt = 0; }
    Object.assign(player.transform, { x: -17, z: 3 });
    const dog = [...world.entities.iterate()].find(e => e.companion)!; Object.assign(dog.transform, { x: -17, z: 5 });
    const id = ai.spawn('infected.riot', { x: -16.1, z: 3 }, { yaw: Math.PI, state: 'chase' }), riot = world.entities.get(id)!;
    riot.infected!.scripted = { ...riot.transform };
    if (before) {
      // Exact pre-lane main contact/stagger allowance (38434ae26). At contact
      // it opens the shield, so this comparison does not approximate shot angles.
      const damage = world.combat!.damage as unknown as { amount: (hit: DamageEvent, target: EntitySnapshot) => number };
      damage.amount = (hit, target) => {
        const origin = hit.shotOrigin ?? hit.origin;
        const open = !!target.combat?.shield && (Status.stunned(target, world.tick) || Math.hypot(origin.x - target.transform.x, origin.z - target.transform.z) <= target.combat.radius + .8);
        return damageAmount(hit, target, open);
      };
    }
    const start = world.tick;
    world.setInput({ aim: { x: 1, z: 0 }, right: { down: false, held: true, up: false } });
    while (world.tick - start < 900 && riot.health.current > 0 && player.health.current > 0) world.update();
    results.push({ calculator: before ? 'pre-lane main 38434ae26' : 'current', gear: player.survivor!.gearTier,
      seconds: (world.tick - start) / 60, playerHp: player.health.current, enemyHp: riot.health.current,
      attacks: world.events.events(start).filter(e => e.type === 'infected.attack' && e.sourceId === id && e.amount > 0) });
  } finally { world.dispose(); }
}
writeFileSync('test-results/uat-l4-infected/duel-before-after.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
