import { fnv1a } from '../../core/Rng';
import type { GameStateSnapshot } from './types';

/** Canonical, key-sorted JSON with floats rounded to 1e-4; excludes perf counters. */
export function canonicalJson(value: unknown): string {
  if (typeof value === 'number') return JSON.stringify(Math.round(value * 1e4) / 1e4);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function stateHash(state: GameStateSnapshot): string {
  const { tick, seed, scenario, entities, mission, progression, rng } = state;
  return fnv1a(canonicalJson({ tick, seed, scenario, entities, mission, progression, rng, ...(state.combat ? { combat: state.combat } : {}), ...(state.interactions ? { interactions: state.interactions } : {}) })).toString(16).padStart(8, '0');
}
