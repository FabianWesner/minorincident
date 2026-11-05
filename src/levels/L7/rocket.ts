import { l7DefaultArsenal, l7Rocket } from '../../data/l7';
import { action } from '../../data/actions/catalog';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { Vec2 } from '../../input/InputFrame';

/** Integration hook until D-FAIR L7 exists. Preserve every campaign-owned weapon as selectable. */
export function equipL7Arsenal(world: SimWorld, owned?: readonly string[]): void {
  const weapons = owned?.filter(id => id !== l7Rocket.action).filter(id => action(id).category === 'melee' || action(id).category === 'ranged');
  const left = weapons?.filter(id => action(id).category === 'melee') ?? l7DefaultArsenal.LEFT;
  const right = weapons?.filter(id => action(id).category === 'ranged') ?? l7DefaultArsenal.RIGHT;
  world.combat!.rackCapacity = Math.max(world.combat!.rackCapacity, left.length, right.length + 1);
  world.combat!.setLoadout(left.length ? left : ['weapon.fists'], right.length ? right : ['weapon.kick']);
}
/** Place the wreck using vehicleExitOffset in the district; no hardcoded replacement for the shared exit. */
export function spawnL7Rocket(world: SimWorld, exit: Vec2): number {
  const position = { x: exit.x + l7Rocket.exitOffset[0], z: exit.z + l7Rocket.exitOffset[1] };
  const existing = world.entities.values().find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action);
  if (existing) return existing.id;
  if (world.combat!.runner.loadout.activeEntries().some(e => e.id === l7Rocket.action)) return 0;
  return world.combat!.pickups.spawn(l7Rocket.action, position, false, { retain: true, interactTicks: l7Rocket.interactTicks, surfaceY: world.districts?.groundHeight(position.x, position.z) ?? 0 });
}
