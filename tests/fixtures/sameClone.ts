import { isDeepStrictEqual } from 'node:util';

/** Same values and the same sharing graph: two clones are equivalent when every original object maps to one clone object in each. */
export function sameClone(original: unknown, a: unknown, b: unknown): boolean {
  if (!isDeepStrictEqual(a, b)) return false;
  const mapA = new Map<object, unknown>(), mapB = new Map<object, unknown>();
  const walk = (o: unknown, x: unknown, y: unknown): boolean => {
    if (o === null || typeof o !== 'object') return true;
    if (mapA.has(o)) return mapA.get(o) === x && mapB.get(o) === y;
    if (x === o || y === o) return false;
    mapA.set(o, x); mapB.set(o, y);
    for (const key of Object.keys(o)) if (!walk((o as Record<string, unknown>)[key], (x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key])) return false;
    return true;
  };
  return walk(original, a, b);
}
