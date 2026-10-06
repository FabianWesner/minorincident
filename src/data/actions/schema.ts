export type Side = 'LEFT' | 'RIGHT';
export type StatusKind = 'burning' | 'stunned' | 'slowed' | 'toxic' | 'bleeding';
export interface StatusDef { kind: StatusKind; duration: number; maxStacks: number; dps: number; slow: number }
export interface ActionEffect { kind: 'fire' | 'lure' | 'smoke' | 'shield' | 'adrenaline' | 'turret'; radius: number; duration: number }
export interface ActionDef {
  /** Catalog effects persist in sim ticks; fixture actions may omit these extensions. */
  effect?: ActionEffect | null; pellets?: number; distanceFalloff?: { start: number; end: number; minimum: number } | null;
  /** Render-only impact freeze for a connecting melee hit; absent = 50 ms. */
  hitStopMs?: number;
  id: string; category: 'melee' | 'ranged' | 'throwable' | 'ability'; sideAgnostic: true;
  damage: number; range: number; arc: number; spread: number; maxTargets: number;
  windup: number; active: number; recovery: number; cooldown: number; fireRate: number;
  magazine: number; reloadTime: number; charges: number; recharge: number;
  projectile: { speed: number; gravity: number; pierce: number } | null;
  splash: { radius: number; falloff: number } | null; fuse: number;
  knockback: number; stagger: number; status: StatusDef | null; noiseRadius: number;
  aimIndicator: 'line' | 'cone' | 'arc' | 'circle'; tier: number;
  upgradeHooks: string[]; viewAssetId: string; iconId: string;
}
export const ticks = (seconds: number): number => Math.ceil(seconds * 60 - 1e-9);
/** Boot validation is shared by fixture data and the E06 catalog. Durations are seconds. */
export function validateAction(def: ActionDef): ActionDef {
  if (!def.id || !['melee', 'ranged', 'throwable', 'ability'].includes(def.category) || def.sideAgnostic !== true) throw new Error('Invalid action identity');
  for (const key of ['damage', 'range', 'arc', 'spread', 'maxTargets', 'windup', 'active', 'recovery', 'cooldown', 'fireRate', 'magazine', 'reloadTime', 'charges', 'recharge', 'fuse', 'knockback', 'stagger', 'noiseRadius', 'tier'] as const) {
    if (!Number.isFinite(def[key]) || def[key] < 0) throw new Error(`Invalid ${def.id}.${key}`);
  }
  for (const key of ['projectile', 'splash', 'status'] as const) if (def[key] === undefined) throw new Error(`Missing ${key}`);
  if (def.pellets !== undefined && (!Number.isInteger(def.pellets) || def.pellets < 1 || def.pellets > 32)) throw new Error('Invalid pellets');
  if (def.distanceFalloff && (!Number.isFinite(def.distanceFalloff.start) || !Number.isFinite(def.distanceFalloff.end) || def.distanceFalloff.start < 0 || def.distanceFalloff.end <= def.distanceFalloff.start || !Number.isFinite(def.distanceFalloff.minimum) || def.distanceFalloff.minimum < 0 || def.distanceFalloff.minimum > 1)) throw new Error('Invalid distance falloff');
  if (def.effect && (!['fire', 'lure', 'smoke', 'shield', 'adrenaline', 'turret'].includes(def.effect.kind) || !Number.isFinite(def.effect.radius) || def.effect.radius <= 0 || !Number.isFinite(def.effect.duration) || def.effect.duration <= 0)) throw new Error('Invalid action effect');
  if (def.range === 0 || def.active === 0 || def.maxTargets < 1 || def.arc > 360 || def.spread > 180) throw new Error('Invalid hit query');
  for (const key of ['maxTargets', 'magazine', 'charges', 'tier'] as const) if (!Number.isInteger(def[key])) throw new Error(`Invalid integer ${key}`);
  if (def.magazine && (!def.reloadTime || !def.fireRate)) throw new Error('Magazine requires reload and fire rate');
  if (def.charges && !def.recharge) throw new Error('Charges require recharge');
  if (def.projectile && (!Number.isFinite(def.projectile.speed) || def.projectile.speed <= 0 || !Number.isFinite(def.projectile.gravity) || def.projectile.gravity < 0 || !Number.isInteger(def.projectile.pierce) || def.projectile.pierce < 0)) throw new Error('Invalid projectile');
  if (def.splash && (!Number.isFinite(def.splash.radius) || def.splash.radius <= 0 || !Number.isFinite(def.splash.falloff) || def.splash.falloff < 0 || def.splash.falloff > 1)) throw new Error('Invalid splash');
  if (def.status && (!['burning', 'stunned', 'slowed', 'toxic', 'bleeding'].includes(def.status.kind) || !Number.isFinite(def.status.duration) || def.status.duration <= 0 || !Number.isInteger(def.status.maxStacks) || def.status.maxStacks < 1 || !Number.isFinite(def.status.dps) || def.status.dps < 0 || !Number.isFinite(def.status.slow) || def.status.slow < 0 || def.status.slow > 1)) throw new Error('Invalid status');
  if (!['line', 'cone', 'arc', 'circle'].includes(def.aimIndicator) || typeof def.viewAssetId !== 'string' || !def.viewAssetId || typeof def.iconId !== 'string' || !def.iconId || !Array.isArray(def.upgradeHooks) || def.upgradeHooks.some((hook) => typeof hook !== 'string')) throw new Error('Invalid action presentation');
  return def;
}
