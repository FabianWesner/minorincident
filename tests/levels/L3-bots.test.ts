import { beforeAll, expect, test } from 'vitest';
import { runLevel, type LevelReport } from '../../tools/sim-runner/levels';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'test-results/epics/E21';
const median = (numbers: number[]) => { const sorted = [...numbers].sort((a, b) => a-b); return (sorted[9]+sorted[10])/2; };
const reports: Record<string, LevelReport[]> = { market: [], park: [], newbie: [] };
beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  for (let seed = 1; seed <= 20; seed++) {
    reports.market.push(await runLevel('L3', 'complete', seed, 720, 'market'));
    reports.park.push(await runLevel('L3', 'complete', seed, 720, 'park'));
    reports.newbie.push(await runLevel('L3', 'newbie', seed, 720, seed % 2 ? 'market' : 'park'));
    writeFileSync(`${output}/bots.json`, JSON.stringify(reports, null, 2));
    console.log(JSON.stringify({ seed, market: reports.market.at(-1)?.time, park: reports.park.at(-1)?.time, newbie: reports.newbie.at(-1)?.time, completed: reports.newbie.at(-1)?.completed }));
  }
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/bots.json`, JSON.stringify(reports, null, 2));
}, 1_800_000);
for (const route of ['market', 'park'] as const) {
  test(`@E21 @E21-AC02 complete bot: 20/20 forced ${route} from L3-default`, () => {
    expect(reports[route].map(r => [r.seed, r.completed, r.blocker])).toEqual(reports[route].map(r => [r.seed, true, null]));
    expect(reports[route].every(r => (r.maxConcurrentInfected ?? Infinity) <= 60)).toBe(true);
  });
}
test('@E21 @E21-AC03 newbie: >=18/20, 5–10 minute median, <=2 deaths and >=120s left', () => {
  const runs = reports.newbie;
  expect(runs.filter(r => r.completed).length).toBeGreaterThanOrEqual(18);
  expect(Math.max(...runs.map(r => r.deaths))).toBeLessThanOrEqual(2);
  expect(median(runs.map(r => r.timerRemaining ?? 0))).toBeGreaterThanOrEqual(120);
  expect(median(runs.map(r => r.time))).toBeGreaterThanOrEqual(300);
  expect(median(runs.map(r => r.time))).toBeLessThanOrEqual(600);
});
test('@E21 @E21-AC04 bot enters, drives, kills >=5 by runover and smashes >=3 light obstacles', () => {
  for (const r of [...reports.market, ...reports.park]) { expect(r.runovers).toBeGreaterThanOrEqual(5); expect(r.smashed).toBeGreaterThanOrEqual(3); }
});
test('@E21 @E21-AC05 measured complete route times differ <=30%', () => {
  const a = median(reports.market.map(r => r.time)), b = median(reports.park.map(r => r.time));
  expect(Math.abs(a-b)/Math.min(a,b)).toBeLessThanOrEqual(.3);
});
