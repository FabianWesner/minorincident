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
  // PO 10-08 (verbatim): "You need to increase the speed of fight movements. Every click needs to be a kick, no matter
  // how fast I click." Diablo-paced flurry: 14-18 ticks per beat (~0.27 s, was 16-30), contact at <= 30 % of the beat;
  // 6 damage (7 hits, was 9 x 5) keeps a 1v1 at the same ~1.9 s; half the shove so a fast flurry keeps the target in reach.
  'weapon.fists': [
    move('jab', 3, 2, 9, { damage: 6, knockback: .08, stagger: .15, hitStopMs: 40 }),
    move('cross', 3, 3, 9, { damage: 6, knockback: .1, stagger: .2, hitStopMs: 40 }),
    move('front-kick', 4, 3, 11, { damage: 6, knockback: .15, stagger: .2, range: 1.55, arc: 60, hitStopMs: 45 }),
    move('roundhouse-kick', 5, 3, 10, { damage: 6, knockback: .15, stagger: .2, range: 1.6, arc: 110, maxTargets: 2, hitStopMs: 45 }),
    move('uppercut', 4, 3, 10, { damage: 6, knockback: .12, stagger: .25, hitStopMs: 40 }),
    move('knee', 3, 3, 9, { damage: 6, knockback: .1, stagger: .2, range: 1.45, hitStopMs: 40 }),
    move('spinning-backfist', 5, 3, 10, { damage: 6, knockback: .12, stagger: .2, range: 1.4, arc: 120, maxTargets: 2, hitStopMs: 45 }),
  ],
  // Bat beats keep their ~0.33 s tempo; the overhead finisher is quicker (23 ticks, was 28) and no longer flings the
  // target 3.3 m out of reach (the courier then walked after it: the ~1 s gaps the PO felt): 0.5 m, inside the bat's reach.
  'weapon.bat': [
    move('forehand', 5, 4, 11, { damage: 22, knockback: .25, stagger: .2, hitStopMs: 42 }),
    move('backhand', 4, 4, 10, { damage: 22, knockback: .3, stagger: .2, hitStopMs: 42 }),
    move('overhead', 7, 4, 12, { damage: 30, knockback: .5, stagger: .6, knockdown: true, arc: 70, hitStopMs: 60 }),
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
