import type { CampaignSave } from '../../src/sim/progression/Campaign';

/** Prepare the persisted loadout that the real Continue menu will resume. */
export function playtestSave(save: CampaignSave, heroine: CampaignSave['character'], kind: 'weapons' | 'fists'): CampaignSave {
  return { ...save, character: heroine, ...(kind === 'fists' ? { racks: { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] }, ownedActions: ['weapon.fists', 'weapon.kick'] } : {}) };
}

/** Validate observed bodies without depending on a particular crowd count. */
export function assertRenderedBodies(figures: { drawn: boolean; joints?: unknown }[]): void {
  if (figures.some(f => f.drawn) && !figures.some(f => f.drawn && f.joints)) throw new Error('L6 rendered-body observations are unavailable; combat playtest would be invalid');
}
