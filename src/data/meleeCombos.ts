import type { ActionDef } from './actions/schema';
import { catalog } from './actions/catalog';

/** One authored beat of a melee chain. Ticks are 60 Hz sim ticks (research-figures §5
 * timing sheet): anticipation → strike → follow-through/recovery. Omitted fields keep
 * the weapon's catalog value. Knockback is metres, stagger seconds. */
export interface MeleeMove {
  name: string; windup: number; active: number; recovery: number;
  damage?: number; knockback?: number; stagger?: number; range?: number; arc?: number; maxTargets?: number;
  /** Render-only impact freeze on a connecting hit (E19 §5.6 feel, 00 §6.3). */
  hitStopMs?: number; knockdown?: boolean;
}
const move = (name: string, windup: number, active: number, recovery: number, extra: Omit<MeleeMove, 'name' | 'windup' | 'active' | 'recovery'> = {}): MeleeMove => ({ name, windup, active, recovery, ...extra });

/** Unarmed stays at 9 damage (5 hits per common infected); bat stays at 22 (2 hits).
 * Normal beats use brief flinches and small displacement (00 §6.2). Only the
 * explicit bat overhead finisher knocks down; unarmed kicks are normal beats. */
export const meleeMoves: Readonly<Record<string, readonly MeleeMove[]>> = {
  'weapon.fists': [
    move('jab', 3, 3, 10, { knockback: .15, stagger: .15, hitStopMs: 45 }),
    move('cross', 4, 4, 10, { knockback: .2, stagger: .2, hitStopMs: 50 }),
    move('front-kick', 6, 5, 17, { knockback: .3, stagger: .2, range: 1.55, arc: 60, hitStopMs: 60 }),
    move('roundhouse-kick', 7, 5, 18, { knockback: .3, stagger: .2, range: 1.6, arc: 110, maxTargets: 2, hitStopMs: 60 }),
    move('uppercut', 6, 5, 12, { knockback: .25, stagger: .25, hitStopMs: 50 }),
    move('knee', 4, 4, 10, { knockback: .2, stagger: .2, range: 1.45, hitStopMs: 50 }),
    move('spinning-backfist', 8, 5, 14, { knockback: .25, stagger: .2, range: 1.4, arc: 120, maxTargets: 2, hitStopMs: 60 }),
  ],
  'weapon.bat': [
    move('forehand', 5, 4, 11, { damage: 22, knockback: .25, stagger: .2, hitStopMs: 42 }),
    move('backhand', 4, 4, 10, { damage: 22, knockback: .3, stagger: .2, hitStopMs: 42 }),
    move('overhead', 9, 5, 14, { damage: 30, knockback: 3.3, stagger: .6, knockdown: true, arc: 70, hitStopMs: 67 }),
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
      knockdown: authored.knockdown ?? def.knockdown,
      ...(authored.hitStopMs === undefined ? {} : { hitStopMs: authored.hitStopMs }) };
  }
  if (!meleeChains[def.id] || combo === 0) return def;
  const finisher = combo === 2;
  const duration = Math.round(Math.round((def.windup + def.active + def.recovery) * 60) * (finisher ? 1.08 : .92)) / 60;
  return { ...def, windup: duration * .2, active: .1, recovery: duration * .8 - .1, cooldown: duration,
    knockdown: def.knockdown || finisher, damage: def.damage, range: def.range + (finisher ? .12 : .04),
    arc: Math.min(150, def.arc + (finisher ? -8 : 10)), knockback: def.knockback * (finisher ? 1.5 : 1), stagger: def.stagger * (finisher ? 1.5 : 1) };
}
