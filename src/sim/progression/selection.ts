import type { Side } from '../../data/actions/schema';
import { weaponKey } from '../../data/weaponKeys';
import { action } from '../../data/actions/catalog';
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
  const entries = (['LEFT', 'RIGHT'] as const).flatMap(side => loadout.state[side].rack.map((slot, index) => ({ side, index, id: slot.id })));
  const usable = (entry: { side: Side; index: number }) => loadout.hasAmmo(loadout.state[entry.side].rack[entry.index]);
  let entry: { side: Side; index: number; id: string } | undefined = previous ? entries.find(e => e.id === previous && usable(e)) : undefined;
  if (!entry) {
    const priority = (id: string): number => {
      const def = action(id);
      // hasAmmo treats the campaign's bottomless guns as usable too.
      if (def.category === 'ranged') return 0;
      if (id === 'weapon.fire-axe') return 1;
      if (id === 'weapon.bat') return 2;
      if (id === 'weapon.fists' || id === 'weapon.kick') return 4;
      return 3;
    };
    entry = entries.filter(e => usable(e) && save.ownedActions.includes(e.id) && action(e.id).category !== 'ability')
      .sort((a, b) => priority(a.id) - priority(b.id)
        || (weaponKey(b.id) ?? -1) - (weaponKey(a.id) ?? -1)
        || action(b.id).tier - action(a.id).tier
        || a.id.localeCompare(b.id))[0]
      ?? { side: 'LEFT', index: -1, id: 'weapon.fists' };
    if (previous) logSelectionFallback(previous, entry.id, entries.some(e => e.id === previous) ? 'empty' : 'not in destination rack');
  }
  loadout.state.selectedSide = entry.side;
  loadout.state[entry.side].index = entry.index;
  return entry.id;
}
