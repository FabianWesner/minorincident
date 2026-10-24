import type { Side } from '../../data/actions/schema';
import { weaponKey } from '../../data/weaponKeys';
import type { Loadout, LoadoutState } from '../combat/Loadout';
import type { CampaignSave } from './Campaign';

export function heldAction(state: LoadoutState): string {
  const side = state[state.selectedSide ?? 'LEFT'];
  return side.rack[side.index ?? 0]?.id ?? 'weapon.fists';
}

export function logSelectionFallback(from: string, to: string, reason: string): void {
  (globalThis as { console?: { info(message: string): void } }).console?.info(`[campaign] selected action ${from} unavailable (${reason}); falling back to ${to}`);
}

/** Restore indices directly: selecting a boundary loadout must not spend ammo or start a swap cooldown. */
export function restoreSelectedAction(loadout: Loadout, save: CampaignSave): string {
  const previous = save.selectedAction;
  if (!previous) return heldAction(loadout.state); // Old saves retain their established level default.
  const entries = (['LEFT', 'RIGHT'] as const).flatMap(side => loadout.state[side].rack.map((slot, index) => ({ side, index, id: slot.id })));
  let entry: { side: Side; index: number; id: string } | undefined = entries.find(e => e.id === previous);
  // Fists are innate even when the campaign racks contain only carried weapons.
  if (!entry && previous === 'weapon.fists') entry = { side: 'LEFT', index: -1, id: 'weapon.fists' };
  if (!entry) {
    entry = entries.filter(e => save.ownedActions.includes(e.id) && weaponKey(e.id) !== undefined).sort((a, b) => weaponKey(b.id)! - weaponKey(a.id)!)[0]
      ?? { side: 'LEFT', index: -1, id: 'weapon.fists' };
    logSelectionFallback(previous, entry.id, 'not in destination rack');
  }
  loadout.state.selectedSide = entry.side;
  loadout.state[entry.side].index = entry.index;
  return entry.id;
}
