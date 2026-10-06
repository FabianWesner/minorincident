import type { ActionDef } from './actions/schema';
import { catalog } from './actions/catalog';

/** One authored beat of a melee chain. Ticks are 60 Hz sim ticks (research-figures §5
 * timing sheet): anticipation → strike → follow-through/recovery. Omitted fields keep
 * the weapon's catalog value. Knockback is metres, stagger seconds. */
export interface MeleeMove {
  name: string; windup: number; active: number; recovery: number;
  damage?: number; knockback?: number; stagger?: number; range?: number; arc?: number; maxTargets?: number;
  /** Render-only impact freeze on a connecting hit (E19 §5.6 feel, 00 §6.3). */
  hitStopMs?: number;
}
const move = (name: string, windup: number, active: number, recovery: number, extra: Omit<MeleeMove, 'name' | 'windup' | 'active' | 'recovery'> = {}): MeleeMove => ({ name, windup, active, recovery, ...extra });

/** E19 §5.6: unarmed is one 7-move style with equal damage (9 of 9–11 → 5 hits per 40 HP
 * infected, never a one-shot); punches flinch only, kicks shove 1.5–2.5 m with a 0.4 s
 * stagger. The bat lands 22, its overhead finisher 30 (2 hits) with 2.5–3.5 m knockback. */
export const meleeMoves: Readonly<Record<string, readonly MeleeMove[]>> = {
  'weapon.fists': [
    move('jab', 3, 3, 10, { knockback: .12, stagger: 0, hitStopMs: 25 }),
    move('cross', 4, 4, 10, { knockback: .25, stagger: 0, hitStopMs: 33 }),
    move('front-kick', 6, 5, 13, { knockback: 2, stagger: .4, range: 1.55, arc: 60, hitStopMs: 60 }),
    move('roundhouse-kick', 7, 5, 14, { knockback: 1.7, stagger: .4, range: 1.6, arc: 110, maxTargets: 2, hitStopMs: 60 }),
    move('uppercut', 6, 5, 12, { knockback: .45, stagger: .15, hitStopMs: 50 }),
    move('knee', 4, 4, 10, { knockback: .3, stagger: 0, range: 1.15, hitStopMs: 33 }),
    move('spinning-backfist', 8, 5, 14, { knockback: .7, stagger: .2, range: 1.4, arc: 120, maxTargets: 2, hitStopMs: 60 }),
  ],
  'weapon.bat': [
    move('forehand', 5, 4, 11, { damage: 22, knockback: 2.6, stagger: .4, hitStopMs: 42 }),
    move('backhand', 4, 4, 10, { damage: 22, knockback: 2.8, stagger: .4, hitStopMs: 42 }),
    move('overhead', 9, 5, 14, { damage: 30, knockback: 3.3, stagger: .6, arc: 70, hitStopMs: 67 }),
  ],
};

/** Linked M1 strikes trade reach/tempo; the third beat is a heavier finisher. */
export const meleeChains: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(Object.entries(meleeMoves).map(([id, moves]) => [id, moves.map(m => m.name)])),
  'weapon.crowbar': ['hook', 'reverse-hook', 'driving-blow'], 'weapon.machete': ['diagonal-cut', 'reverse-cut', 'chop'], 'weapon.kick': ['front-kick', 'spin-kick'],
};

export function comboDefinition(def: ActionDef, combo: number): ActionDef {
  const authored = meleeMoves[def.id]?.[combo];
  if (authored) {
    const windup = authored.windup / 60, active = authored.active / 60, recovery = authored.recovery / 60;
    // Authored beats are relative to the roster weapon, so E13 upgrades (damage, knockback) still scale them.
    const base = catalog[def.id], damage = base?.damage ? def.damage / base.damage : 1, knockback = base?.knockback ? def.knockback / base.knockback : 1;
    return { ...def, windup, active, recovery, cooldown: windup + active + recovery,
      damage: authored.damage === undefined ? def.damage : authored.damage * damage, knockback: authored.knockback === undefined ? def.knockback : authored.knockback * knockback, stagger: authored.stagger ?? def.stagger,
      range: authored.range ?? def.range, arc: authored.arc ?? def.arc, maxTargets: authored.maxTargets ?? def.maxTargets,
      ...(authored.hitStopMs === undefined ? {} : { hitStopMs: authored.hitStopMs }) };
  }
  if (!meleeChains[def.id] || combo === 0) return def;
  const finisher = combo === 2;
  const duration = Math.round(Math.round((def.windup + def.active + def.recovery) * 60) * (finisher ? 1.08 : .92)) / 60;
  return { ...def, windup: duration * .2, active: .1, recovery: duration * .8 - .1, cooldown: duration,
    damage: def.damage, range: def.range + (finisher ? .12 : .04),
    arc: Math.min(150, def.arc + (finisher ? -8 : 10)), knockback: def.knockback * (finisher ? 1.5 : 1), stagger: def.stagger * (finisher ? 1.5 : 1) };
}
