import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';
import type { Tier } from './probe';

export async function axeFixture(tier: Tier) {
  const cells = [];
  for (const count of [1, 2, 3]) {
    const world = new SimWorld(); await world.init();
    try {
      world.loadScenario('horde-arena', 1); world.infected!.director.setTier(tier);
      world.combat!.setLoadout(['weapon.fire-axe'], ['weapon.kick']);
      const enemies = Array.from({ length: count }, (_, i) => {
        const id = world.infected!.spawn('infected.runner', { x: 1.5, z: (i - (count - 1) / 2) * 1.1 }, { state: 'idle' });
        const entity = world.entities.get(id)!;
        entity.infected!.speed = 0; entity.infected!.cooldown = 100000;
        return { id, entity, hitAt: null as { x: number; z: number } | null, maximumPush: 0 };
      });
      world.events.on('combat.hit', event => { if (event.type !== 'combat.hit' || event.sourceId !== 1) return; const enemy = enemies.find(enemy => enemy.id === event.targetId); if (enemy) enemy.hitAt ??= { x: enemy.entity.transform.x, z: enemy.entity.transform.z }; });
      world.applyInput({ ...emptyInput(), aim: { x: 1, z: 0 }, aimPoint: { x: 2, z: 0 }, left: { down: true, held: true, up: false } }, 'keyboard'); world.update();
      for (let tick = 0; tick < 150; tick++) {
        world.applyInput({ ...emptyInput(), aim: { x: 1, z: 0 }, aimPoint: { x: 2, z: 0 } }, 'keyboard'); world.update();
        for (const enemy of enemies) if (enemy.hitAt) enemy.maximumPush = Math.max(enemy.maximumPush, Math.hypot(enemy.entity.transform.x - enemy.hitAt.x, enemy.entity.transform.z - enemy.hitAt.z));
      }
      const events = world.events.events(), attack = events.find(event => event.type === 'combat.attack' && event.sourceId === 1);
      const hits = events.filter(event => event.type === 'combat.hit' && event.sourceId === 1 && event.attackId === (attack && 'attackId' in attack ? attack.attackId : -1));
      cells.push({ count, style: attack?.type === 'combat.attack' ? attack.style ?? 'single' : null, hitIds: [...new Set(hits.filter(event => event.type === 'combat.hit' && event.amount > 0).map(event => event.type === 'combat.hit' ? event.targetId : -1))], pushes: enemies.map(enemy => ({ id: enemy.id, metres: enemy.maximumPush })), setup: 'native AI update; walking speed fixed to0 to distinguish shove from walking' });
    } finally { world.dispose(); }
  }
  return cells;
}
