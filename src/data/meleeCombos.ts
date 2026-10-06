import type { ActionDef } from './actions/schema';
/** Linked M1 strikes trade reach/tempo; the third beat is a heavier finisher. */
export const meleeChains: Readonly<Record<string, readonly string[]>> = {
  'weapon.fists': ['jab', 'cross', 'front-kick', 'roundhouse-kick', 'uppercut', 'knee', 'spinning-backfist'], 'weapon.bat': ['forehand', 'backhand', 'overhead'],
  'weapon.crowbar': ['hook', 'reverse-hook', 'driving-blow'], 'weapon.machete': ['diagonal-cut', 'reverse-cut', 'chop'], 'weapon.kick': ['front-kick', 'spin-kick'],
};
export function comboDefinition(def: ActionDef, combo: number): ActionDef {
  if (def.id === 'weapon.fists') return { ...def, knockback: [2, 3, 5].includes(combo) ? .45 : .2 };
  if (!meleeChains[def.id] || combo === 0) return def;
  const finisher = combo === 2;
  const duration = Math.round(Math.round((def.windup + def.active + def.recovery) * 60) * (finisher ? 1.08 : .92)) / 60;
  return { ...def, windup: duration * .2, active: .1, recovery: duration * .8 - .1, cooldown: duration,
    damage: def.damage, range: def.range + (finisher ? .12 : .04),
    arc: Math.min(150, def.arc + (finisher ? -8 : 10)), knockback: def.knockback * (finisher ? 1.5 : 1), stagger: def.stagger * (finisher ? 1.5 : 1) };
}
