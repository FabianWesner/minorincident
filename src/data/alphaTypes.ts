import type { InfectedSpecialMove } from './infected';

export type AlphaType = 'brute' | 'thrower' | 'screamer' | 'leaper' | 'armoured';
export interface AlphaTypeDefinition {
  readonly look: string;
  readonly moves: readonly InfectedSpecialMove[];
  readonly climbsLowBarricades?: boolean;
}

/** Alpha identities and available specials. Selection is a pure function of level and entity id. */
export const alphaTypes: Readonly<Record<AlphaType, AlphaTypeDefinition>> = {
  brute: { look: 'inf.alpha', moves: ['alpha.charge', 'alpha.ground-slam', 'alpha.grab-human'] },
  thrower: { look: 'inf.alpha-worker', moves: ['alpha.grab-throw', 'alpha.living-missile', 'alpha.barrage'] },
  screamer: { look: 'inf.alpha-hoodie', moves: ['alpha.roar'] },
  leaper: { look: 'inf.alpha-suit', moves: ['alpha.pounce'], climbsLowBarricades: true },
  armoured: { look: 'inf.alpha-fire', moves: ['alpha.shield-bash'] },
};

const levelMix: Readonly<Record<string, readonly AlphaType[]>> = {
  L3: ['brute', 'brute', 'thrower'], L4: ['brute', 'thrower', 'armoured'],
  L5: ['brute', 'thrower', 'leaper'], L6: ['screamer', 'leaper'],
  L7: ['brute', 'thrower', 'screamer'], L9: ['leaper', 'thrower'],
  L10: ['brute', 'thrower', 'screamer', 'leaper', 'armoured'],
};

/** The level's authored Alpha mix, in order (authored encounters pick slot n as mix[n % length] instead of hashing entity ids). */
export function alphaMixFor(level: string): readonly AlphaType[] { return levelMix[level] ?? ['brute']; }

/** Stable per-entity mix; earlier levels retain their original Alpha archetype and moves. */
export function alphaTypeFor(level: string | undefined, entityId: number): AlphaType {
  const mix = levelMix[level ?? ''];
  if (!mix) return 'brute';
  return mix[(entityId >>> 0) % mix.length]!;
}
