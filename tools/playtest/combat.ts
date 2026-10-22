/** A short kick makes space while the real-input driver follows the visible retreat marker. */
export function keepMovingWithFists(level: string | null, step: string | null, fistsOnly: boolean, nearbyEnemies: number, healthRatio = 1): boolean {
  return healthRatio >= .3 && level === 'L6' && fistsOnly && (nearbyEnemies >= 3 || nearbyEnemies > 0 && (step === 'retreat' || step === 'exit'));
}

/** Shipped hand binding to hold while walking toward the visible retreat ring. */
export function fistsRetreatAttack(nearbyEnemies: number): 'KeyJ' | 'KeyK' {
  return nearbyEnemies < 3 ? 'KeyJ' : 'KeyK';
}

/** Visible allies under attack are an early shelter objective, including on an unarmed rack. */
export function canCoverVisibleAllies(level: string | null, step: string | null, unarmed: boolean): boolean {
  return !unarmed || level === 'L6' && (step === 'shelter' || step === 'stop');
}
