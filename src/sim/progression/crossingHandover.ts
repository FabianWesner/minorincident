import { catalog } from '../../data/actions/catalog';
import type { SimWorld } from '../world/SimWorld';
import type { CampaignSave } from './Campaign';

/** S7: commit once after the completed crawl, before saving or requesting navigation. */
export function commitCrossingHandover(save: CampaignSave, world: SimWorld): void {
  if (save.crossingHandover) return;
  const crash = world.missions?.l9;
  if (!crash?.state.finished) throw new Error('Crossing handover requires completed crawl');
  const player = world.entities.get(1)!;
  const lostWeapons = [...new Set([...save.ownedActions, ...player.weapons?.LEFT.rack.map(s => s.id) ?? [], ...player.weapons?.RIGHT.rack.map(s => s.id) ?? []])]
    .filter(id => catalog[id]?.category !== 'ability' && id !== 'weapon.fire-axe');
  const passengerIds = save.transport?.occupants.filter(e => e.id !== 1).map(e => e.id) ?? [];
  const shelteredPassengers = passengerIds.map(id => world.getEntity(id) ?? save.transport!.occupants.find(e => e.id === id)!)
    .filter(e => e.health.current > 0 && !e.companion);
  const corgi = [...world.entities.iterate()].find(e => e.companion) ?? save.transport?.occupants.find(e => e.companion);
  save.crossingHandover = { applied: true, ...(corgi ? { corgi: structuredClone(corgi) } : {}), checkpoint: 'cure-crash', anchor: { ...player.transform }, preCrashDurability: crash.state.preCrashDurability, lostWeapons, shelteredPassengers: structuredClone(shelteredPassengers) };
  save.ownedActions = ['weapon.fire-axe', ...save.ownedActions.filter(id => catalog[id]?.category === 'ability')];
  save.racks = { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] };
  save.completedLevels = Math.max(9, save.completedLevels); save.unlockedLevel = 10;
  delete save.pending; delete save.transport; delete save.l9Crash;
  if (world.combat) { world.combat.projectiles.length = 0; world.combat.setLoadout(save.racks.LEFT, save.racks.RIGHT); }
  for (const e of [...world.entities.iterate()]) if (e.pickup && 'actionId' in e.pickup) { world.entities.remove(e.id); world.spatial.delete(e.id); }
  if (world.progression) { world.progression.pickups = []; world.progression.campaign = structuredClone(save); }
  player.health.current = player.health.max;
}
