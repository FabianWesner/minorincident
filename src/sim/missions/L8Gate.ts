import { isSanctuaryHeavy } from '../../data/l8Gate';
import { transactArsenal } from '../progression/arsenal';
import type { SimWorld } from '../world/SimWorld';
import type { Mission } from './Mission';

/** Ticks between the soldier's line and the HUD line that names what was handed over. */
export const gateToastDelay = 4 * 60;

/**
 * L8 beat 1: at the gate a soldier collects the heavy weapons. Returns the removed ids. Runs before the 'sanctuary'
 * checkpoint is captured, so a retry or continue never gives the weapon back.
 */
export function surrenderHeavyWeapons(w: SimWorld, mission: Mission): string[] {
  const loadout = w.entities.get(1)?.weapons;
  const carried = [...new Set([...loadout?.LEFT.rack.map(s => s.id) ?? [], ...loadout?.RIGHT.rack.map(s => s.id) ?? [], ...w.progression?.campaign?.ownedActions ?? []])]
    .filter(isSanctuaryHeavy);
  mission.radio('L8.gate-soldier');
  if (!carried.length) return [];
  if (w.progression?.campaign) transactArsenal(w, [], carried);
  else if (w.combat && loadout) {
    const keep = (side: 'LEFT' | 'RIGHT') => loadout[side].rack.map(s => s.id).filter(id => !isSanctuaryHeavy(id));
    const left = keep('LEFT'), right = keep('RIGHT');
    w.combat.setLoadout(left.length ? left : ['weapon.fists'], right.length ? right : ['weapon.kick']);
  }
  return carried;
}
