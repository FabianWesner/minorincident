/** Publish the fresh physical L4 pickup ledger through the existing browser-receipt path. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { l4PickupVerdict } from './l4-pickup';
import { browserHash } from './browser';
import { provenance } from './probe';
import type { FixtureReceipt } from './fixtures';
const root = 'docs/reports/fix53-b';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const input = process.argv[2] ?? `${root}/L4-opening/matrix.json.gz`;
type Events = Parameters<typeof l4PickupVerdict>[0];
const cells = JSON.parse(gunzipSync(readFileSync(input)).toString()) as { sourceHash: string; browserHash: string; quality: 'low'|'high'; zoom: number; renderer: string; processExitCode: number; issues: unknown[]; ledger: { level: string; events: Events }[] }[];
const identity = provenance(), hash = browserHash();
assert.equal(cells.length, 4);
const results = cells.map(cell => {
  assert.equal(cell.sourceHash, identity.sourceHash); assert.equal(cell.browserHash, hash);
  assert.equal(cell.renderer, 'webgl'); assert.equal(cell.processExitCode, 0); assert.equal(cell.issues.length, 0);
  const events = cell.ledger.find(record => record.level === 'L4')!.events;
  const result = l4PickupVerdict(events); assert.equal(result.status, 'PASS');
  const controls: { name: string; status: string }[] = [];
  for (const type of ['l4.gun', 'l4.firstTurn', 'actual-klaxon-start', 'actual-l4-admissions']) {
    const copy = structuredClone(events); copy.find(event => event.type === type)!.tick++;
    const status = l4PickupVerdict(copy).status; assert.notEqual(status, 'PASS'); controls.push({ name: `${type} delayed one tick`, status });
  }
  for (const name of ['observed tick delayed', 'missing graph voices', 'missing admissions']) {
    const copy = structuredClone(events), alarm = copy.find(event => event.type === 'actual-klaxon-start')!;
    if (name === 'observed tick delayed') alarm.observedWorldTick!++;
    else if (name === 'missing graph voices') alarm.voices = [];
    else for (let i = copy.length - 1; i >= 0; i--) if (copy[i].type === 'actual-l4-admissions') copy.splice(i, 1);
    const status = l4PickupVerdict(copy).status; assert.notEqual(status, 'PASS'); controls.push({ name, status });
  }
  return { tier: cell.quality, routeZoom: cell.zoom, ...result, controls };
});
const proofPath = `${root}/L4-03.json`;
writeFileSync(proofPath, JSON.stringify({ ...identity, browserHash: hash, input, inputSha256: sha(input), results }, null, 2) + '\n');
for (const row of results) {
  const path = `docs/reports/fix51-verify/receipts/L4-${row.tier}-webgl2-z${row.routeZoom}-browser.json`;
  const receipt: FixtureReceipt & { browserHash: string } = { version: 1, level: 'L4', tier: row.tier, sourceHash: identity.sourceHash,
    fixtureHash: sha('tools/qa/accept/fix53-l4-opening.ts'), browserHash: hash, errors: [],
    checks: [{ id: 'L4-03', clause: 'actual MG pickup klaxon and attack start share simulation tick', tier: row.tier, policy: 'real-input-webgl2', status: row.status,
      value: { ...row.value as object, routeZoom: row.routeZoom, proofPath, proofSha256: sha(proofPath) }, target: 'actual pickup, gun/turn events, live positive-gain klaxon voices and first living admissions all share the same simulation tick', receipt: path }],
    observations: { input, inputSha256: sha(input), scope: '90second opening only; no full-level completion or performance claim' } };
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
}
const reviewPath = 'docs/qa/reviews/L4-03.json';
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
Object.assign(review, { reviewer: 'Codex/fix53-b', date: '2026-11-04', commit: identity.revision });
review.clauses[0].note = 'All four fresh physical-input cells pass: pickup/gun/turn/actual klaxon voices/living alarm admissions share the same tick. All28 delayed/missing-evidence controls reject PASS. Every original frame is inspected separately in the linked review manifest.';
review.evidence = [proofPath, process.argv[3] ?? `${root}/L4-opening-review.json`].map(file => ({ file, sha256: sha(file), what: file === proofPath ? 'Four actual tick/voice/admission ledgers and28 negative controls.' : 'Every original capture inspected, with per-image SHA256/seen notes and retained contact-sheet/archive hashes.' }));
review.notes = 'Shared headless Metal WebGL2; physical WASD/mouse/E; courier protected. Bounded opening evidence only. Stills do not establish tick equality; the read-only event/actual-audio graph ledger does.';
writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n');
console.log('L4-03: four physical cells PASS;28 missing/delayed-evidence controls reject PASS.');
