import { catalog as actions } from './actions/catalog';

/** Spec 07 §5 blast classes. Toxic gas variants are a later E27 increment (no defs yet). */
export const blastClasses = ['small', 'medium', 'large', 'mega', 'toxic', 'incendiary'] as const;
export type BlastClass = typeof blastClasses[number];

/** Sim side of a blast. Distances in metres, durations in sim ticks (60 Hz) unless named seconds.
 * Damage curve (horizontal distance d, line of sight required): `damage × (1 − falloff × d / radius)` for d ≤ radius.
 * Impulse (Bruno Simon folio-2025 Explosions.js, MIT): direction = horizontal unit × 1/upward + up, normalised;
 * velocity change = impulse × linear falloff (1 at ≤ 1 m … 0 at radius) × mass response; applied one tick later. */
export interface ExplosionDef {
  id: string; class: BlastClass; fx: string;
  radius: number; damage: number; falloff: number;
  /** Peak velocity change (m/s) for a reference-mass body at the centre. */
  impulse: number;
  /** Ratio of vertical to horizontal impulse; Bruno uses 2 (0.5 out, 1 up). */
  upward: number;
  /** Displacement knockback (m) for characters at the centre, scaled by the damage falloff. */
  knockback: number; stagger: number;
  /** Multipliers on the curve damage for barricade rails and vehicles. */
  barricade: number; vehicle: number;
  /** Fuse (ticks) when this explosive is set off by damage or another blast (chain link delay). */
  chainDelay: number;
  /** Aftermath: persistent small fires (E11 fire hazards); `spread` = how many times each may spread once. */
  fires: { count: number; radius: number; seconds: number; spread: number };
  /** Bullet time when the player is within `within` m and the setting is on (sim emits, the clock applies). */
  slowMo: { scale: number; seconds: number; within: number } | null;
  /** Scripted multi-stage blasts (mega): later stages fire after `delay` ticks at an offset from the origin. */
  stages?: { delay: number; offset: { x: number; z: number }; def: string }[];
}

/** View side: one preset per look. Seconds are render time. */
export interface BlastFxPreset {
  id: string;
  /** Full-screen flash opacity before flash reduction (capped at 0.12 with reduction on). */
  flash: number;
  light: { color: number; intensity: number; range: number; seconds: number };
  fireball: { count: number; size: number; seconds: number; rise: number };
  sparks: number; dust: number;
  /** Smoke column: seconds emitting, puffs per second, puff size, ember-lit underside 0..1. */
  smoke: { seconds: number; rate: number; size: number; heat: number };
  /** Scorch decal diameter as a multiple of the radius (0 = none). */
  scorch: number;
  shake: number; roll: number;
}

const def = (id: string, cls: BlastClass, radius: number, damage: number, falloff: number, impulse: number, patch: Partial<ExplosionDef> = {}): ExplosionDef => ({
  id, class: cls, fx: `blast.${cls}`, radius, damage, falloff, impulse, upward: 2, knockback: cls === 'small' ? .8 : cls === 'medium' ? 1.2 : 1.8, stagger: .6,
  barricade: 1, vehicle: 1, chainDelay: 18, fires: { count: 0, radius: 1, seconds: 12, spread: 0 }, slowMo: null, ...patch,
});
/** Throwables and projectiles keep their E05/E06 damage resolver: the def mirrors the action numbers so they cannot diverge. */
const fromAction = (id: string, action: string, cls: BlastClass, impulse: number, patch: Partial<ExplosionDef> = {}): ExplosionDef => {
  const a = actions[action], splash = a.splash!;
  return def(id, cls, splash.radius, a.damage, splash.falloff, impulse, patch);
};

export const explosionDefs: Readonly<Record<string, ExplosionDef>> = Object.fromEntries([
  fromAction('explosion.grenade', 'weapon.grenade', 'small', 6),
  // Throwables leave scorch and smoke only: aftermath fires would change the E05/E06 TTK bands.
  fromAction('explosion.pipe-bomb', 'weapon.pipe-bomb', 'small', 7),
  fromAction('explosion.rocket', 'weapon.rocket-launcher', 'medium', 8),
  fromAction('explosion.molotov', 'weapon.molotov', 'incendiary', 0, { knockback: 0, stagger: 0 }),
  // E11 propane/barrel retain their tested 100 × (r − d) / r curve and 18-tick (0.3 s) chain fuse.
  def('explosion.propane', 'medium', 5, 100, 1, 8, { fires: { count: 2, radius: 1.1, seconds: 14, spread: 1 } }),
  def('explosion.barrel', 'medium', 5, 100, 1, 8, { fires: { count: 3, radius: 1.2, seconds: 18, spread: 1 } }),
  def('explosion.car', 'large', 7, 150, 1, 9, { vehicle: .8, fires: { count: 3, radius: 1.3, seconds: 30, spread: 1 }, slowMo: { scale: .5, seconds: .35, within: 6 } }),
  def('explosion.gas-pump', 'large', 8, 220, .6, 9, { fx: 'blast.large', fires: { count: 2, radius: 1.4, seconds: 30, spread: 1 } }),
  def('explosion.gas-canopy', 'large', 10, 220, .6, 9, { fx: 'blast.large', fires: { count: 2, radius: 1.4, seconds: 30, spread: 1 } }),
  def('explosion.gas-tanks', 'mega', 14, 420, .5, 12, { barricade: 2, fires: { count: 5, radius: 1.6, seconds: 45, spread: 1 }, slowMo: { scale: .35, seconds: .6, within: 15 } }),
  // L5 gas station scripted chain: pump → canopy → tanks (spec 07 §5, E27-AC06).
  def('explosion.gas-station', 'mega', 8, 220, .6, 9, { fx: 'blast.large', stages: [
    { delay: 0, offset: { x: 0, z: 0 }, def: 'explosion.gas-pump' },
    { delay: 15, offset: { x: 3, z: 0 }, def: 'explosion.gas-canopy' },
    { delay: 36, offset: { x: -2, z: 3 }, def: 'explosion.gas-tanks' },
  ] }),
].map(d => [d.id, d]));

const preset = (id: string, p: Omit<BlastFxPreset, 'id'>): BlastFxPreset => ({ id, ...p });
export const blastFxPresets: Readonly<Record<string, BlastFxPreset>> = Object.fromEntries([
  preset('blast.small', { flash: .35, light: { color: 0xffb060, intensity: 60, range: 12, seconds: .45 }, fireball: { count: 6, size: 1.4, seconds: .7, rise: 1.2 }, sparks: 40, dust: 18, smoke: { seconds: 3, rate: 4, size: 1.4, heat: .5 }, scorch: .3, shake: .18, roll: .5 }),
  preset('blast.medium', { flash: .5, light: { color: 0xffa050, intensity: 120, range: 18, seconds: .7 }, fireball: { count: 10, size: 2.1, seconds: .9, rise: 2 }, sparks: 64, dust: 26, smoke: { seconds: 14, rate: 5, size: 1.9, heat: .8 }, scorch: .32, shake: .28, roll: .8 }),
  preset('blast.large', { flash: .6, light: { color: 0xff9a40, intensity: 220, range: 24, seconds: .9 }, fireball: { count: 14, size: 2.8, seconds: 1.1, rise: 2.6 }, sparks: 90, dust: 34, smoke: { seconds: 30, rate: 6, size: 2.4, heat: 1 }, scorch: .32, shake: .36, roll: 1 }),
  preset('blast.mega', { flash: .7, light: { color: 0xff8a30, intensity: 420, range: 40, seconds: 1.4 }, fireball: { count: 20, size: 4.5, seconds: 1.6, rise: 4 }, sparks: 140, dust: 48, smoke: { seconds: 45, rate: 8, size: 3.6, heat: 1 }, scorch: .3, shake: .4, roll: 1.4 }),
  preset('blast.incendiary', { flash: .12, light: { color: 0xff8a30, intensity: 50, range: 10, seconds: 1 }, fireball: { count: 4, size: 1.2, seconds: .6, rise: .6 }, sparks: 16, dust: 0, smoke: { seconds: 6, rate: 3, size: 1.3, heat: .9 }, scorch: .4, shake: .05, roll: 0 }),
].map(p => [p.id, p]));

/** Every explosive placement references a def: E11 hazard kinds, throwables/projectiles and scripted blasts. */
export const hazardExplosions: Readonly<Record<string, string>> = { propane: 'explosion.propane', barrel: 'explosion.barrel' };
export const actionExplosions: Readonly<Record<string, string>> = { 'weapon.grenade': 'explosion.grenade', 'weapon.pipe-bomb': 'explosion.pipe-bomb', 'weapon.rocket-launcher': 'explosion.rocket', 'weapon.molotov': 'explosion.molotov' };
export const vehicleExplosion = 'explosion.car';
export const scriptedExplosions: readonly string[] = ['explosion.gas-station'];

export function explosionDef(id: string): ExplosionDef {
  const d = explosionDefs[id]; if (!d) throw new Error(`Unknown explosion: ${id}`); return d;
}
/** Boot/CI validation: numeric ranges, presets, stage references and every explosive source's reference. */
export function validateExplosions(defs: Readonly<Record<string, ExplosionDef>> = explosionDefs, presets: Readonly<Record<string, BlastFxPreset>> = blastFxPresets): void {
  const positive = (v: number) => Number.isFinite(v) && v > 0, nonNegative = (v: number) => Number.isFinite(v) && v >= 0;
  for (const [id, d] of Object.entries(defs)) {
    if (d.id !== id || !blastClasses.includes(d.class)) throw new Error(`Invalid explosion identity ${id}`);
    if (!presets[d.fx]) throw new Error(`Explosion ${id} references missing preset ${d.fx}`);
    if (!positive(d.radius) || !nonNegative(d.damage) || !(d.falloff >= 0 && d.falloff <= 1) || !nonNegative(d.impulse) || !positive(d.upward)) throw new Error(`Invalid explosion curve ${id}`);
    if (![d.knockback, d.stagger, d.barricade, d.vehicle].every(nonNegative) || !Number.isInteger(d.chainDelay) || d.chainDelay < 9 || d.chainDelay > 18) throw new Error(`Invalid explosion response ${id}`);
    if (!Number.isInteger(d.fires.count) || d.fires.count < 0 || d.fires.count > 8 || !positive(d.fires.radius) || !positive(d.fires.seconds) || !Number.isInteger(d.fires.spread) || d.fires.spread < 0) throw new Error(`Invalid explosion fires ${id}`);
    if (d.slowMo && (!(d.slowMo.scale > 0 && d.slowMo.scale < 1) || !positive(d.slowMo.seconds) || d.slowMo.seconds > 1 || !positive(d.slowMo.within))) throw new Error(`Invalid explosion slow motion ${id}`);
    for (const s of d.stages ?? []) if (!defs[s.def] || defs[s.def].stages || !Number.isInteger(s.delay) || s.delay < 0 || ![s.offset.x, s.offset.z].every(Number.isFinite)) throw new Error(`Invalid explosion stage ${id} → ${s.def}`);
  }
  for (const [id, p] of Object.entries(presets)) {
    if (p.id !== id || !(p.flash >= 0 && p.flash <= 1) || !positive(p.light.range) || !nonNegative(p.light.intensity) || !positive(p.light.seconds)) throw new Error(`Invalid blast preset ${id}`);
    if (!Number.isInteger(p.fireball.count) || p.fireball.count < 0 || p.fireball.count > 24 || !positive(p.fireball.size) || !positive(p.fireball.seconds)) throw new Error(`Invalid fireball ${id}`);
    if (![p.sparks, p.dust, p.smoke.rate, p.smoke.seconds, p.scorch, p.shake, p.roll].every(nonNegative) || !(p.smoke.heat >= 0 && p.smoke.heat <= 1)) throw new Error(`Invalid blast preset ${id}`);
  }
  for (const [source, id] of [...Object.entries(hazardExplosions), ...Object.entries(actionExplosions), ['vehicle', vehicleExplosion], ...scriptedExplosions.map(s => ['scripted', s])]) if (!defs[id]) throw new Error(`${source} references missing explosion ${id}`);
  for (const [id, a] of Object.entries(actions)) {
    const explosive = a.splash && a.damage > 0 && (a.category === 'throwable' || a.projectile);
    if (explosive && !actionExplosions[id]) throw new Error(`Explosive action ${id} has no ExplosionDef`);
    const ref = actionExplosions[id] ? defs[actionExplosions[id]] : null;
    if (ref && (ref.radius !== a.splash!.radius || ref.damage !== a.damage || ref.falloff !== a.splash!.falloff)) throw new Error(`ExplosionDef ${ref.id} diverges from ${id}`);
  }
}

/** Sim curve shared by blasts and tests: damage at horizontal distance d. */
export function blastDamage(d: ExplosionDef, distance: number, radius = d.radius): number {
  // (r − f·d) / r keeps E11's exact 100 × (r − d) / r values (no 1 − d/r rounding below a hazard's HP).
  return distance > radius ? 0 : d.damage * Math.max(0, radius - d.falloff * distance) / radius;
}
