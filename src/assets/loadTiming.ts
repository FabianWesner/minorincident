/** Records a named load phase as a User Timing measure (visible in traces and the @load perf test). */
export function loadMeasure(name: string, start: number): number {
  const end = performance.now();
  try { performance.measure(name, { start, end }); } catch { /* measures are diagnostics only */ }
  return end;
}
