import type { CampaignSave } from '../../src/sim/progression/Campaign';

/** Prepare the persisted loadout that the real Continue menu will resume. */
export function playtestSave(save: CampaignSave, heroine: CampaignSave['character'], kind: 'weapons' | 'fists'): CampaignSave {
  return { ...save, character: heroine, ...(kind === 'fists' ? { racks: { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] } } : {}) };
}

/** Validate observed bodies without depending on a particular crowd count. */
export function assertRenderedBodies(figures: { drawn: boolean; joints?: unknown }[]): void {
  if (figures.some(f => f.drawn) && !figures.some(f => f.drawn && f.joints)) throw new Error('L6 rendered-body observations are unavailable; combat playtest would be invalid');
}

/** The same visible Resume action a player uses after a foreground or Home pause. */
export function shouldResumePause(menu: string | null, loading: boolean): boolean {
  return menu === 'pause' && !loading;
}

/** Never advance past the L10 Mega objective with the boss still alive. */
export function isMandatoryBossObjective(level: string | null, step: string | null): boolean {
  return level === 'L10' && step === 'mega';
}

/** A dead renderer must not hold an unattended driver forever inside evaluate(). */
export async function observeWithin<T>(operation: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Playtest observation timed out after ${timeoutMs} ms; browser renderer is unresponsive`)), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
