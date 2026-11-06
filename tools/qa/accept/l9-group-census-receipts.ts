import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { FixtureReceipt } from './fixtures';
import type { NativeReceipt } from './probe';
import { atomicJson, reportRoot } from './report';

/** Consume the standalone real-input census without requiring unrelated native L9 fixtures. */
export function l9GroupCensusReceipts(sourceHash: string): { path: string; receipt: FixtureReceipt }[] {
  const censusPath = 'docs/reports/sweep-c/L9-02-census.json';
  if (!existsSync(censusPath)) return [];
  const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  const census = JSON.parse(readFileSync(censusPath, 'utf8')) as {
    sourceHash: string; observerHash: string; toolSha256: string;
    cells: { tier: string; route: string; finished: boolean; finalHash: string; controlHash: string; controlIdentical: boolean;
      groups: unknown[]; detours: { id: string; route: string; minimumDriveClearance: number }[] }[];
    rows: { tier: string; groups: { id: string; route: string; ids: number[]; actors: { id: number; archetype: string }[]; actualCount?: number }[];
      detours: { id: string; route: string; minimumDriveClearance: number }[] }[];
  };
  if (census.sourceHash !== sourceHash || census.toolSha256 !== sha(readFileSync('tools/qa/accept/l9-group-census.ts'))) return [];
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const control = JSON.parse(readFileSync(`${reportRoot}/receipts/L9-${tier}-complete.json`, 'utf8')) as NativeReceipt;
    if (control.sourceHash !== sourceHash || control.observerHash !== census.observerHash) continue;
    const row = census.rows.find(item => item.tier === tier);
    const cells = census.cells.filter(cell => cell.tier === tier);
    if (!row || cells.length !== 3 || !cells.every(cell => cell.finished && cell.controlIdentical && cell.finalHash === cell.controlHash &&
      cell.detours.length === (cell.route === 'road' ? 2 : cell.route === 'countryside' ? 3 : 6)) ||
      !cells.some(cell => cell.route === 'road' && cell.finalHash === control.nativeStateHash)) continue;
    const groups = row.groups;
    const expected = [['road', 2, 6], ['countryside', 3, 6], ['dry-shortcut', 6, 8]] as const;
    const composition = expected.every(([route, count, size]) => groups.filter(group => group.route === route).length === count &&
      Array.from({ length: count }, (_, i) => `${route}-${i + 1}`).every(id => groups.filter(group => group.id === id && group.route === route).length === 1) &&
      groups.filter(group => group.route === route).every(group => group.ids.length === size && new Set(group.ids).size === size &&
        group.actors.length === size && new Set(group.actors.map(actor => actor.id)).size === size && group.ids.every(id => group.actors.some(actor => actor.id === id)))) &&
      groups.every(group => group.actors.every(actor => ['infected.runner', 'infected.alpha'].includes(actor.archetype))) &&
      groups.filter(group => group.route === 'dry-shortcut').flatMap(group => group.actors).filter(actor => actor.archetype === 'infected.alpha').length === 2;
    const detours = row.detours.length === 11 && groups.every(group => row.detours.filter(detour => detour.id === group.id && detour.route === group.route && detour.minimumDriveClearance >= 20).length === 1);
    const path = `${reportRoot}/receipts/L9-${tier}-group-census.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L9', tier, sourceHash,
      fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], observations: { censusPath }, checks: [
        { id: 'L9-02', clause: 'actual admitted route group census and driven detour clearance', tier, policy: 'controlled-physical',
          status: composition && detours ? 'PASS' : 'FAIL', value: { groups, detours: row.detours },
          target: 'road2×6; countryside3×6; shortcut6×8 total including exactly2 Alphas; ordinary input drives each authored detour at least20m from every group', receipt: censusPath },
      ] };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
