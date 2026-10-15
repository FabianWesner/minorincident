import { writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../../../../src/sim/ai/NavGrid';
import { runFinaleCalibration } from '../../../../tools/sim-runner/l10-finale-calibration';
const versions = new WeakMap<NavGrid, number>(), ids = new WeakMap<NavGrid, number>(); let next = 0;
for (const method of ['rebake', 'setBlocker', 'setPlayerBounds'] as const) {
  const original = NavGrid.prototype[method] as (...args: unknown[]) => unknown;
  (NavGrid.prototype[method] as (...args: unknown[]) => unknown) = function (this: NavGrid, ...args: unknown[]) {
    versions.set(this, (versions.get(this) ?? 0) + 1); return original.apply(this, args);
  };
}
const spans = new Map<string, { calls: number; ms: number; cells: number; path: number }>();
const original = NavGrid.prototype.reachPath;
NavGrid.prototype.reachPath = function (from, target, result, budget = Infinity) {
  if (!ids.has(this)) ids.set(this, ++next);
  const key = `${ids.get(this)}:${versions.get(this) ?? 0}:${from}:${target.x},${target.z}:${budget}`;
  const start = performance.now(), answer = original.call(this, from, target, result, budget);
  const row = spans.get(key) ?? { calls: 0, ms: 0, cells: this.blocked.length, path: 0 };
  row.calls++; row.ms += performance.now() - start; row.path = result.length; spans.set(key, row);
  return answer;
};
await runFinaleCalibration('high');
const rows = [...spans].map(([key, row]) => ({ key, ...row })).sort((a,b) => b.ms-a.ms);
const result = { calls: rows.reduce((sum,r) => sum+r.calls,0), unique: rows.length, ms: rows.reduce((sum,r) => sum+r.ms,0), repeatedCalls: rows.reduce((sum,r) => sum+r.calls-1,0), top: rows.slice(0,30) };
mkdirSync('test-results/astra-hitches', { recursive: true }); writeFileSync('test-results/astra-hitches/reach-profile.json', JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
