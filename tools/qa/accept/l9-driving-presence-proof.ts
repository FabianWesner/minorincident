import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { drivingPresence } from './l9-driving-presence';
import { provenance } from './probe';
import { atomicJson } from './report';

function trace(seconds: number, metresPerSecond: number, visible: (second: number) => boolean, hp = 60) {
  return Array.from({ length: seconds + 2 }, (_, second) => JSON.stringify({ observation: {
    tick: second * 60, player: { x: second * metresPerSecond, z: 0 },
    driving: second <= seconds ? { id: 7 } : null,
    enemies: visible(second) ? [{ drawn: true, hp }] : [],
  } })).join('\n');
}
const cases = [
  { name: '61 moving seconds without a body fails', value: drivingPresence(trace(61, 10, second => second === 0)), pass: false },
  { name: '90 stationary seconds do not become driving', value: drivingPresence(trace(90, 0, second => second === 0)), pass: true },
  { name: 'moving body contacts each30s pass', value: drivingPresence(trace(90, 10, second => second % 30 === 0)), pass: true },
  { name: 'drawn dead bodies cannot reset the gap', value: drivingPresence(trace(90, 10, () => true, 0)), pass: false },
  { name: 'exact0.5m/s remains driving', value: drivingPresence(trace(61, .5, second => second === 0)), pass: false },
];
for (const row of cases) assert.equal(row.value.pass, row.pass, row.name);
const sparse = [0, 70, 71].map(second => JSON.stringify({ observation: {
  tick: second * 60, player: { x: 0, z: 0 }, driving: second < 71 ? { id: 7 } : null,
  enemies: second === 0 ? [{ drawn: true, hp: 60 }] : [],
} })).join('\n');
assert.equal(drivingPresence(sparse).pass, false, 'long unknown intervals cannot be excluded as stationary');
assert.throws(() => drivingPresence(trace(4, 10, () => false).split('\n').reverse().join('\n')), /Non-monotonic/);

const identity = provenance();
const rows = [];
for (const tier of ['low', 'high']) for (const route of ['road', 'countryside', 'dry-shortcut']) {
  const inputPath = `docs/reports/fix51-r10c/L9-${tier}-webgl2-z1.5-${route}.json`;
  const reviewPath = `docs/reports/fix51-r10c/L9-${tier}-${route}-reviewed.json`;
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert.equal(input.sourceHash, identity.sourceHash, 'motion proof requires current-source routes');
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  const archive = readFileSync(review.logArchive), raw = gunzipSync(archive);
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(archive), review.archiveSha256); assert.equal(sha(raw), review.logSha256);
  assert.equal(review.logSha256, input.artifacts.logSha256);
  const visibility = drivingPresence(raw.toString());
  rows.push({ tier, route, inputPath, inputSha256: sha(readFileSync(inputPath)), reviewPath,
    logArchive: review.logArchive, logSha256: review.logSha256, archiveSha256: review.archiveSha256,
    originalProducerSha256: input.toolSha256, occupiedClockDiagnostic: input.visibility, visibility });
}
// The historical high-road occupancy failure is not an invariant of newer
// runs. Retain both actual clocks; the synthetic stationary/dead/unknown
// controls above test the evaluator independently of current game outcomes.
atomicJson(process.env.L9_MOTION_PROOF_OUT ?? 'docs/reports/sweep-c2/L9-03/motion-clock-proof.json', { ...provenance(),
  evaluatorSha256: createHash('sha256').update(readFileSync('tools/qa/accept/l9-driving-presence.ts')).digest('hex'),
  existingRule: 'tools/qa/fix51-road.mjs:22; >=0.5m/s from actual courier/APC x/z. No target change.',
  controls: cases.map(row => ({ name: row.name, expected: row.pass, actual: row.value.pass })),
  longUnknownInterval: 'FAIL', backwardsClock: 'rejected', rows });
console.log(rows.map(row => ({ tier: row.tier, route: row.route, occupied: row.occupiedClockDiagnostic.conservativeGapSeconds,
  driving: row.visibility.conservativeGapSeconds, pass: row.visibility.pass })));
