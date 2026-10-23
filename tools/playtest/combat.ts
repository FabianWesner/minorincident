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
export function campaignCombatWeapon(level: string | null, weapons: readonly string[]): string | null {
  if (level !== 'L7' && level !== 'L8' && level !== 'L10') return null;
  const order = ['weapon.rocket-launcher', 'weapon.army-mg', 'weapon.shotgun', 'weapon.handgun', 'weapon.pistol', 'weapon.fire-axe'];
  return order.find(id => weapons.includes(id)) ?? null;
}

/** The visible boss bar takes priority over a nearer ordinary walker during its kill objective. */
export function campaignThreat<T extends { hp: number; max: number; d: number; drawn: boolean }>(level: string | null, step: string | null, enemies: readonly T[], reach: number): T | undefined {
  const visible = enemies.filter(e => e.hp > 0 && e.drawn && e.d < reach);
  return (level === 'L10' && step === 'mega' ? visible.find(e => e.max >= 1000) : undefined) ?? visible[0];
}

/** Intercept a moving visible body using its observed velocity and the launcher's travel speed. */
export function rocketAimPoint(player: { x: number; z: number }, enemy: { x: number; z: number; vx: number; vz: number }): { x: number; z: number } {
  const dx = enemy.x - player.x, dz = enemy.z - player.z;
  const a = enemy.vx ** 2 + enemy.vz ** 2 - 18 ** 2, b = 2 * (dx * enemy.vx + dz * enemy.vz), c = dx ** 2 + dz ** 2;
  const discriminant = b * b - 4 * a * c;
  const roots = Math.abs(a) < 1e-6 ? [b ? -c / b : 0] : discriminant >= 0 ? [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)] : [];
  const positive = roots.filter(t => t >= 0);
  const flight = positive.length ? Math.min(2, ...positive) : 0;
  const seconds = Number.isFinite(flight) ? flight : 0;
  return { x: enemy.x + enemy.vx * seconds, z: enemy.z + enemy.vz * seconds };
}

/** A defensive walking goal derived from visible courier, console and enemy positions. */
export function finaleDodgeGoal(level: string | null, step: string | null, player: { x: number; z: number }, console: { x: number; z: number } | null, enemy: { x: number; z: number; d: number }): { x: number; z: number } | null {
  if (level !== 'L10' || (step !== 'hold' && step !== 'mega') || !console || enemy.d > 12) return null;
  const angle = Math.atan2(player.z - enemy.z, player.x - enemy.x);
  const goals = [angle, angle + Math.PI / 2, angle - Math.PI / 2].map(a => ({ x: player.x + Math.cos(a) * 8, z: player.z + Math.sin(a) * 8 }));
  // Charging needs the console's 25 m disc. The completed-charge boss fight
  // can retreat farther and return to the visible release marker afterwards.
  return step === 'mega' ? goals[0] : goals.find(g => Math.hypot(g.x - console.x, g.z - console.z) < 23) ?? console;
}
