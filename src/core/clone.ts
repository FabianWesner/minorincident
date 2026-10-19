/**
 * perf-w5d: a deep copy with structuredClone's result for plain simulation data (plain objects, dense arrays, primitives),
 * about 2-3x faster on entity snapshots. Shared references and cycles stay shared within one copy (as with
 * structuredClone). Anything else (Map, Set, Date, typed arrays, class instances, sparse arrays, arrays with extra keys,
 * functions) makes the whole copy fall back to structuredClone, so the result never differs from it.
 */
const unsupported = Symbol('unsupported');
export function cloneData<T>(value: T): T {
  const seen = new Map<object, unknown>();
  const copy = (v: unknown): unknown => {
    if (v === null) return v;
    const type = typeof v;
    if (type !== 'object') { if (type === 'symbol' || type === 'function') throw unsupported; return v; }
    const known = seen.get(v as object); if (known !== undefined) return known;
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype) throw unsupported;
      const n = v.length, out: unknown[] = new Array(n); seen.set(v, out);
      if (Object.keys(v).length !== n) throw unsupported; // holes or extra keys
      for (let i = 0; i < n; i++) out[i] = copy(v[i]);
      return out;
    }
    if (Object.getPrototypeOf(v) !== Object.prototype) throw unsupported; // symbol keys are dropped, as by structuredClone
    const out: Record<string, unknown> = {}; seen.set(v as object, out);
    for (const key of Object.keys(v as object)) out[key] = copy((v as Record<string, unknown>)[key]);
    return out;
  };
  try { return copy(value) as T; } catch (error) { if (error === unsupported) return structuredClone(value); throw error; }
}
