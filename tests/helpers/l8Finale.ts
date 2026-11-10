import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
/** Controller fixture only: real conversion and charge, with the other arenas already clear. */
export function playHaleCharge(world: SimWorld): { distance: number; move: string | undefined } {
  const zoo = world.missions!.l8!, arena = zoo.state.arenas.find(a => a.id === 'elephant')!;
  const elephant = world.entities.get(arena.ids[0])!, player = world.entities.get(1)!, origin = { ...player.transform };
  const protectedPlayer = world.combat!.damage.god; world.combat!.damage.god = true;
  let distance = Infinity, move: string | undefined;
  const stop = world.events.on('dialogue.line', event => {
    if (event.type !== 'dialogue.line' || event.id !== 'L8.hale-dying') return;
    const hale = world.entities.get(zoo.state.haleId)!;
    distance = Math.hypot(hale.transform.x - elephant.transform.x, hale.transform.z - elephant.transform.z);
    move = elephant.infected?.specialAttack?.move;
  });
  try {
    arena.phase = 0; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    world.solids.relocate(player, { x: 96, z: 58, y: .7 }, 'fixture.hale-charge-entry', 2);
    world.npcs!.civilians.outbreak!.infect(elephant, 1);
    for (let tick = 0; tick < 1800 && !world.missions!.state.states['hale-fallen']; tick++) { world.applyInput(emptyInput(), 'keyboard'); world.update(); }
    world.combat!.damage.apply({ sourceId: 1, targetId: elephant.id, attackId: 1, actionId: 'weapon.army-mg', origin: player.transform, direction: { x: 1, z: 0 }, base: 1e9, multiplier: 1, type: 'bullet', permanent: true, knockback: 0, stagger: 0 });
    zoo.update();
    world.solids.relocate(player, origin, 'fixture.hale-charge-return', 2);
    return { distance, move };
  } finally { stop(); world.combat!.damage.god = protectedPlayer; }
}
