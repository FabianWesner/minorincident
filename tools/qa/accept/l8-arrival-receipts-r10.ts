import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

export function l8ArrivalReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const proofPath = 'docs/reports/fix51-r10c/L8-arrival-proof.json';
  if (!existsSync(proofPath)) return [];
  const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
  if (proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.toolSha256 !== sha(readFileSync('tools/qa/accept/l8-arrival-r10.ts'))) return [];
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const row = proof.rows.find((item: { tier: string }) => item.tier === tier);
    if (!row || row.inputSha256 !== sha(readFileSync(row.inputPath)) || row.completionArchiveSha256 !== sha(readFileSync(row.completionArchive))) continue;
    const base = `docs/reports/fix51-r10c/L7-L8-carried-${tier}`;
    const review = JSON.parse(readFileSync(`${base}/review.json`, 'utf8'));
    if (review.sourceHash !== sourceHash || review.browserHash !== browserHash || !review.captures.length ||
      !review.captures.every((capture: { sha256: string; seen: string }) => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) ||
      !review.sheets.length || !review.sheets.every((sheet: { file: string; sha256: string }) => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256))) continue;
    const read = (name: string) => {
      const path = `${base}/${name}.gz`, bytes = readFileSync(path);
      const entry = review.artifacts.find((item: { file: string }) => item.file === path);
      if (!entry || sha(bytes) !== entry.sha256 || sha(gunzipSync(bytes)) !== entry.uncompressedSha256) throw new Error(`Corrupt archived handover artifact ${path}`);
      return gunzipSync(bytes).toString();
    };
    const input = JSON.parse(readFileSync(row.inputPath, 'utf8'));
    const producer = input.producer ?? 'tools/qa/accept/carried-input-r10.ts';
    if (!['tools/qa/accept/carried-input-r10.ts', 'tools/qa/accept/carried-input-r11.ts'].includes(producer) ||
      input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== sha(readFileSync(producer))) continue;
    const completion = JSON.parse(read('late-input-completion.json'));
    const ledger = JSON.parse(read('late-input-acceptance-ledger.json'));
    const expected = completion.levels.find((level: { level: string }) => level.level === 'L7')?.result.escapedSurvivors as { id: number; health: { max: number } }[];
    const actual = ledger.find((level: { level: string }) => level.level === 'L8')?.samples[0]?.followers as { id: number; hp: number }[];
    const sortIds = (actors: { id: number }[]) => actors.map(actor => actor.id).sort((a, b) => a - b);
    const idsMatch = Array.isArray(expected) && Array.isArray(actual) && JSON.stringify(sortIds(expected)) === JSON.stringify(sortIds(actual));
    const humansFull = idsMatch && actual.every(actor => actor.hp === expected.find(person => person.id === actor.id)?.health.max);
    const logs = read('log-late-input.jsonl').trim().split('\n').map(line => JSON.parse(line));
    const boundary = logs.findIndex(entry => entry.levelStart === 'L8');
    const before = logs.slice(0, boundary).filter(entry => entry.observation).at(-1)?.observation.player.weapon;
    const after = logs.slice(boundary).find(entry => entry.observation)?.observation.player.weapon;
    const l7 = input.result?.runs.find((run: { level: string }) => run.level === 'L7');
    const l8 = input.result?.runs.find((run: { level: string }) => run.level === 'L8');
    // PO 2026-11-19 s190: the constructor has already run the rocket-only armory handover.
    const expectedRacks = { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun'] };
    const weapons = (ids: string[]) => ids.filter(id => id.startsWith('weapon.') && id !== 'weapon.fists' && id !== 'weapon.kick');
    const racksMatch = JSON.stringify(weapons(row.racks.LEFT)) === JSON.stringify(expectedRacks.LEFT) && JSON.stringify(weapons(row.racks.RIGHT)) === JSON.stringify(expectedRacks.RIGHT);
    const nativeFull = Array.isArray(expected) && Array.isArray(row.humans) && row.humans.length === expected.length && JSON.stringify(sortIds(row.humans)) === JSON.stringify(sortIds(expected)) && row.humans.every((actor: { hp: number; max: number }) => actor.hp === actor.max) && row.companions.length > 0 && row.companions.every((actor: { hp: number; max: number }) => actor.hp === actor.max) && row.readOnlyStateHash === row.controlHash;
    const runtimeMatches = completion.backend === 'webgl' && completion.quality === tier && Math.abs(completion.camera.zoom - 1.5) < 1e-9;
    // L8-01 qualifies arrival; a later departure failure does not erase a measured handover.
    const completed = runtimeMatches && !!l7?.finished && !!l8 && !l7.skipped.length && !l8.skipped.length && !input.error;
    const pass = completed && humansFull && racksMatch && nativeFull && after === 'weapon.handgun' && row.selected === 'weapon.handgun';
    const path = `${reportRoot}/receipts/L8-${tier}-arrival-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L8', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [
      { id: 'L8-01', clause: 'actual carried L7 roster full health racks and selected weapon', tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL',
        value: { completed, expected: Array.isArray(expected) ? sortIds(expected) : null, actual, humansFull, racksMatch, expectedRacks, nativeFull, before, after, proofPath, reviewPath: `${base}/review.json` },
        target: 'same explicit L7 roster (0–35 allowed) at full HP; PO 2026-11-19 s190 L8 rack after rocket handover and selected handgun; native constructor confirms full-HP humans/corgi with identical read-only control', receipt: path },
    ], observations: { browserHash, proofPath, inputPath: row.inputPath } };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
