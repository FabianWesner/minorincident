import { catalog } from '../../data/actions/catalog';
import { rackSize, type CampaignSave } from './Campaign';
import type { SimWorld } from '../world/SimWorld';

/** Apply a single grant/removal before the mission captures its checkpoint at tick end. No encounter side effects. */
export function transactArsenal(world: SimWorld, add: string[], remove: string[]): void {
  if ([...add, ...remove].some(id => !catalog[id]) || add.some(id => remove.includes(id)) || remove.includes('weapon.fire-axe')) throw new Error('Invalid arsenal transaction');
  const save = world.progression?.campaign;
  if (!save || !world.combat) throw new Error('Arsenal transaction needs campaign progression and combat');
  const acquired = add.filter(id => !save.ownedActions.includes(id));
  const owned = [...new Set([...save.ownedActions.filter(id => !remove.includes(id)), ...add])];
  const racks = structuredClone(save.racks), size = rackSize(save.unlockedLevel);
  for (const side of ['LEFT', 'RIGHT'] as const) racks[side] = racks[side].filter(id => owned.includes(id));
  for (const id of add) {
    const side = catalog[id].category === 'melee' ? 'LEFT' : 'RIGHT';
    if (!racks[side].includes(id)) racks[side] = [...racks[side], id].slice(-size);
  }
  for (const side of ['LEFT', 'RIGHT'] as const) if (!racks[side].length) racks[side] = ['weapon.fire-axe'];
  Object.assign(save, { ownedActions: owned, racks });
  world.combat.setLoadout(racks.LEFT, racks.RIGHT);
  // Match existing mission pickups: select the newly recovered weapon before snapshotting.
  const equipped = add.at(-1);
  if (equipped) {
    const side = catalog[equipped].category === 'melee' ? 'LEFT' : 'RIGHT';
    world.combat.runner.loadout.state.selectedSide = side;
    world.combat.runner.loadout.state[side].index = racks[side].indexOf(equipped);
  }
  for (const actionId of acquired) world.events.emit({ type: 'pickup.collected', tick: world.tick, sourceId: 1, pickupId: 0, side: catalog[actionId].category === 'melee' ? 'LEFT' : 'RIGHT', actionId, replaced: null });
}
/** At R1 only abilities and the axe are usable, including when loading an older save with historical unlocks. */
export function enforceCureArsenal(save: CampaignSave): void {
  if (save.cureResume) return;
  save.ownedActions = ['weapon.fire-axe', ...save.ownedActions.filter(id => catalog[id]?.category === 'ability')];
  save.racks = { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] };
}
