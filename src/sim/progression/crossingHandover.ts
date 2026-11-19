import { catalog } from '../../data/actions/catalog';
import type { SimWorld } from '../world/SimWorld';
import type { CampaignSave } from './Campaign';
import { logSelectionFallback } from './selection';

/** S7: commit once after the completed crawl, before saving or requesting navigation. */
export function commitCrossingHandover(save: CampaignSave, world: SimWorld): void {
  if (save.crossingHandover) return;
  const crash = world.missions?.l9;
  if (!crash?.state.finished) throw new Error('Crossing handover requires completed crawl');
  const player = world.entities.get(1)!;
  // PO 2026-11-19: the crash takes the axe too. L10 starts on foot with no weapon (fists);
  // the crash-site machete (equal to the axe) is the first story find. The axe still
  // rides the crawl (L9-17) and joins lostWeapons with the rest of the arsenal history.
  const lostWeapons = [...new Set([...save.ownedActions, ...player.weapons?.LEFT.rack.map(s => s.id) ?? [], ...player.weapons?.RIGHT.rack.map(s => s.id) ?? []])]
    .filter(id => catalog[id]?.category !== 'ability');
  const passengerIds = crash.state.driving?.evacuated ?? save.transport?.occupants.filter(e => e.id !== 1).map(e => e.id) ?? [];
  const shelteredPassengers = passengerIds.map(id => world.getEntity(id) ?? save.transport!.occupants.find(e => e.id === id)!)
    .filter(e => e.health.current > 0 && !e.companion);
  const corgi = [...world.entities.iterate()].find(e => e.companion) ?? save.transport?.occupants.find(e => e.companion);
  const researchCompanion = crash.state.driving?.samId ? world.getEntity(crash.state.driving.samId) : undefined;
  save.crossingHandover = { applied: true, ...(corgi ? { corgi: structuredClone(corgi) } : {}), ...(researchCompanion && researchCompanion.health.current > 0 && !researchCompanion.infected ? { researchCompanion: structuredClone(researchCompanion) } : {}), checkpoint: 'cure-crash', anchor: { ...player.transform }, preCrashDurability: crash.state.preCrashDurability, lostWeapons, shelteredPassengers: structuredClone(shelteredPassengers) };
  save.ownedActions = ['weapon.fists', ...save.ownedActions.filter(id => catalog[id]?.category === 'ability')];
  save.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.fists'] };
  if (save.selectedAction && save.selectedAction !== 'weapon.fists') logSelectionFallback(save.selectedAction, 'weapon.fists', 'scripted crossing arsenal loss');
  save.selectedAction = 'weapon.fists';
  save.completedLevels = Math.max(9, save.completedLevels); save.unlockedLevel = 10;
  delete save.pending; delete save.transport; delete save.l9Crash;
  if (world.combat) { world.combat.projectiles.length = 0; world.combat.setLoadout(save.racks.LEFT, save.racks.RIGHT); }
  for (const e of [...world.entities.iterate()]) if (e.pickup && 'actionId' in e.pickup) { world.entities.remove(e.id); world.spatial.delete(e.id); }
  if (world.progression) { world.progression.pickups = []; world.progression.campaign = structuredClone(save); }
  // The L9 crawl clip is render-only state. Clear it with the other transient
  // player pose layers before L10 starts on foot.
  if (world.player) world.player.resetPose(world.tick);
  else if (player.survivor) {
    delete player.survivor.scriptedClip; delete player.survivor.knockdown; delete player.survivor.attack;
    player.survivor.animation = 'idle'; player.survivor.animationTick = world.tick;
  }
  player.health.current = player.health.max;
}
