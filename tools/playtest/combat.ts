/** A short kick makes space while the real-input driver follows the visible retreat marker. */
export function keepMovingWithFists(level: string | null, step: string | null, fistsOnly: boolean, nearbyEnemies: number, healthRatio = 1): boolean {
  return healthRatio >= .3 && level === 'L6' && fistsOnly && (nearbyEnemies >= 3 || nearbyEnemies > 0 && (step === 'retreat' || step === 'exit'));
}

/** Shipped hand binding to hold while walking toward the visible retreat ring. */
export function fistsRetreatAttack(nearbyEnemies: number): 'KeyJ' | 'KeyK' {
  return nearbyEnemies < 3 ? 'KeyJ' : 'KeyK';
}

/** Unarmed cover follows the visible shelter or rear-cover request and living, drawn allies. */
export function canCoverVisibleAllies(level: string | null, step: string | null, unarmed: boolean, ally: { drawn: boolean; hp: number; corpse: boolean }, objective = ''): boolean {
  const coverRequested = step === 'shelter' || step === 'stop' || (step === 'retreat' || step === 'exit') && /cover the rear|Stay with the group/.test(objective);
  return !unarmed || level === 'L6' && coverRequested && ally.drawn && ally.hp > 0 && !ally.corpse;
}

/** Choose between the courier's closest contact and a visible ally's attacker. */
export function prioritizeAllyThreat<T>(unarmed: boolean, nearby: T | undefined, allyThreat: T | undefined): T | undefined {
  return unarmed ? allyThreat ?? nearby : nearby ?? allyThreat;
}
