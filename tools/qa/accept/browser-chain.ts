import type { Issue, LevelRun } from '../../playtest/session';
import type { FixtureReceipt } from './fixtures';

export interface BrowserReceipt extends FixtureReceipt {
  browserHash: string; run: LevelRun[]; issues: Issue[]; frameTiming: false;
  backend: 'webgl2' | 'webgpu'; zoom: number;
  batch?: {
    index: number; yielded: boolean; startSaveHash: string | null; endSaveHash: string | null;
    startSeconds: number | null; endSeconds: number | null; savePath: string | null;
  };
  batches?: { path: string; batch: BrowserReceipt['batch']; run: LevelRun[] }[];
}

/** A completed tail is valid only after an uninterrupted chain of actual production saves. */
export function mergeBrowserBatches(items: { path: string; receipt: BrowserReceipt }[], path: string): BrowserReceipt {
  if (!items.length) throw new Error('No browser batches');
  const first = items[0].receipt, last = items.at(-1)!.receipt;
  const errors = items.flatMap(item => item.receipt.errors);
  const issues = items.flatMap(item => item.receipt.issues);
  const runs = items.flatMap(item => item.receipt.run);
  if (first.batch?.startSaveHash !== null) errors.push('First batch did not start the full level');
  for (const [index, { receipt }] of items.entries()) {
    if (receipt.sourceHash !== first.sourceHash || receipt.browserHash !== first.browserHash || receipt.backend !== first.backend || receipt.tier !== first.tier || receipt.zoom !== first.zoom)
      errors.push(`Batch ${index + 1}: game, observer or matrix identity changed`);
    if (receipt.batch?.index !== index + 1 || receipt.run.length !== 1 || receipt.run[0].level !== first.level)
      errors.push(`Batch ${index + 1}: missing or mismatched route`);
    if (index && (!items[index - 1].receipt.batch?.yielded || !receipt.batch?.startSaveHash || receipt.batch.startSaveHash !== items[index - 1].receipt.batch?.endSaveHash))
      errors.push(`Batch ${index + 1}: Resume does not continue the preceding yielded save`);
    if (receipt.batch?.yielded && (!receipt.batch.endSaveHash || !receipt.batch.savePath || receipt.batch.endSeconds === null || receipt.batch.endSeconds <= (receipt.batch.startSeconds ?? 0)))
      errors.push(`Batch ${index + 1}: yielded without a progressing production save`);
  }
  const completed = !errors.length && !last.batch?.yielded && !!last.run[0]?.finished && runs.every(run => !run.skipped.length);
  const consoleErrors = issues.filter(issue => issue.kind === 'console-error' || issue.kind === 'page-error');
  const aggregate = runs[0] ? { ...runs[0], finished: completed, skipped: runs.flatMap(run => run.skipped),
    wallSeconds: runs.reduce((n, run) => n + run.wallSeconds, 0), simSeconds: runs.reduce((n, run) => n + run.simSeconds, 0),
    deaths: runs.reduce((n, run) => n + run.deaths, 0), assists: runs.reduce((n, run) => n + run.assists, 0),
    maxNoProgressSeconds: Math.max(...runs.map(run => run.maxNoProgressSeconds)), weaponsEnd: runs.at(-1)!.weaponsEnd,
    attacks: Object.fromEntries([...new Set(runs.flatMap(run => Object.keys(run.attacks)))].map(weapon => [weapon, runs.reduce((n, run) => n + (run.attacks[weapon] ?? 0), 0)])),
    steps: runs.flatMap(run => run.steps) } : null;
  return { ...first, run: aggregate ? [aggregate] : [], issues, errors, batch: undefined,
    batches: items.map(item => ({ path: item.path, batch: item.receipt.batch, run: item.receipt.run })),
    checks: [{ id: 'G-25', clause: 'physical WASD/mouse full-level browser console', tier: first.tier, policy: `real-input-${first.backend}`,
      status: consoleErrors.length ? 'FAIL' : completed ? 'PASS' : 'NOT CHECKED',
      value: { backend: first.backend, zoom: first.zoom, completed, skipped: aggregate?.skipped ?? [], consoleErrors, immortal: true, frameTiming: false,
        batches: items.map(item => item.path) }, target: 'complete ordinary-input route; zero console/page errors; no objective skips', receipt: path }] };
}
