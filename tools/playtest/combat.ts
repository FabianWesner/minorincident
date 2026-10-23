/** A short kick makes space while the real-input driver follows the visible retreat marker. */
export function keepMovingWithFists(level: string | null, step: string | null, fistsOnly: boolean, nearbyEnemies: number, healthRatio = 1, targetDistance = 0): boolean {
  return targetDistance <= 1.3 && healthRatio >= .3 && level === 'L6' && fistsOnly && (nearbyEnemies >= 3 || nearbyEnemies > 0 && (step === 'retreat' || step === 'exit'));
}

/** Shipped hand binding to hold while walking toward the visible retreat ring. */
export function fistsRetreatAttack(nearbyEnemies: number): 'KeyJ' | 'KeyK' {
  return nearbyEnemies < 3 ? 'KeyJ' : 'KeyK';
}

/** Unarmed cover follows the visible shelter or rear-cover request and living, drawn allies. */
export function canCoverVisibleAllies(level: string | null, step: string | null, unarmed: boolean, ally: { drawn: boolean; hp: number; corpse: boolean; underAttack?: boolean }, objective = ''): boolean {
  const coverRequested = step === 'shelter' || step === 'stop' || (step === 'retreat' || step === 'exit') && (/cover the rear|Stay with the group/.test(objective) || ally.underAttack === true);
  return !unarmed || level === 'L6' && coverRequested && ally.drawn && ally.hp > 0 && !ally.corpse;
}

/** Choose between the courier's closest contact and a visible ally's attacker. */
export function prioritizeAllyThreat<T>(unarmed: boolean, nearby: T | undefined, allyThreat: T | undefined): T | undefined {
  return unarmed ? allyThreat ?? nearby : nearby ?? allyThreat;
}

/** Choose from the carried HUD arsenal, including L10's recovered checkpoint weapons. */
export function campaignCombatWeapon(level: string | null, weapons: readonly string[], nearestEnemyM = Infinity): string | null {
  if (level !== 'L7' && level !== 'L8' && level !== 'L10') return null;
  const order = nearestEnemyM < 6
    ? ['weapon.army-mg', 'weapon.shotgun', 'weapon.handgun', 'weapon.pistol', 'weapon.rocket-launcher', 'weapon.fire-axe']
    : ['weapon.rocket-launcher', 'weapon.army-mg', 'weapon.shotgun', 'weapon.handgun', 'weapon.pistol', 'weapon.fire-axe'];
  return order.find(id => weapons.includes(id)) ?? null;
}

/** A defensive walking goal derived from visible courier, console and enemy positions. */
export function finaleDodgeGoal(level: string | null, step: string | null, player: { x: number; z: number }, console: { x: number; z: number } | null, enemy: { x: number; z: number; d: number }): { x: number; z: number } | null {
  if (level !== 'L10' || (step !== 'hold' && step !== 'mega') || !console || enemy.d > 12) return null;
  const dx = player.x - console.x, dz = player.z - console.z;
  const angle = Math.hypot(dx, dz) < 1 ? Math.atan2(player.z - enemy.z, player.x - enemy.x) : Math.atan2(dz, dx) + Math.PI / 4;
  return { x: console.x + Math.cos(angle) * 12, z: console.z + Math.sin(angle) * 12 };
}
