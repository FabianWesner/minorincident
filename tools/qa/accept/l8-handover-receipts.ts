import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
type Car = { id: number; archetype: string; health: { current: number; max: number }; vehicle: { driver: number; passengers: { id: number; phase: string }[] } };
export type Handover = { sourceHash: string; browserHash: string; toolSha256: string; errors: string[];
  physical: { input: { file: string; sha256: string }; completion: { file: string; sha256: string } };
  setup: { level: string; backend: string; quality: string; physicalDeparture: { vehicle: Car } };
  captures: { sha256: string; stage: string; seen?: string }[];
  result: { ms: number; level: string; backend: string; quality: string; loading: boolean; active: number; car: Car; physicalDeparture: { vehicle: Car } } };
export function handoverChecks(proof: Handover, tier: string) {
  const r = proof.result, before = proof.setup?.physicalDeparture?.vehicle, after = r?.car;
  const valid = !proof.errors.length && proof.setup?.level === 'L8' && proof.setup.backend === 'webgl' && proof.setup.quality === tier &&
    r?.level === 'L9' && r.backend === 'webgl' && r.quality === tier && !r.loading &&
    ['outgoing-resident', 'incoming'].every(stage => proof.captures.some(capture => capture.stage === stage && /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen?.trim()));
  const ids = (car: Car) => car.vehicle.passengers.map(passenger => passenger.id).sort((a, b) => a - b);
  const transport = valid && !!before && !!after && before.id === after.id && r.physicalDeparture.vehicle.id === before.id &&
    before.archetype === 'vehicle.military-apc' && after.archetype === before.archetype && before.health.current === after.health.current && before.health.max === after.health.max &&
    before.vehicle.driver === 1 && after.vehicle.driver === 1 && r.active === after.id && before.vehicle.passengers.length > 1 &&
    before.vehicle.passengers.every(passenger => passenger.phase === 'seated') && after.vehicle.passengers.every(passenger => passenger.phase === 'seated') && JSON.stringify(ids(before)) === JSON.stringify(ids(after));
  return { valid, transport, clock: valid && Number.isFinite(r.ms) && r.ms > 0 && r.ms <= 6000, ms: r?.ms };
}
export function l8HandoverReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex'), results = [];
  for (const tier of ['low', 'high'] as const) {
    const proofPath = `docs/reports/sweep-c5/L8-10/${tier}-handover.json`;
    if (!existsSync(proofPath)) continue;
    const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as Handover;
    if (proof.errors.length || proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.toolSha256 !== sha(readFileSync('tools/qa/accept/sweep-c5-l8-handover.mjs'))) continue;
    if (![proof.physical.input, proof.physical.completion].every(ref => existsSync(ref.file) && sha(readFileSync(ref.file)) === ref.sha256)) continue;
    const input = JSON.parse(readFileSync(proof.physical.input.file, 'utf8')), completion = JSON.parse(gunzipSync(readFileSync(proof.physical.completion.file)).toString());
    if (input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== sha(readFileSync(input.producer)) || input.error ||
      !input.result.runs.some((run: { level: string; finished: boolean; skipped: string[] }) => run.level === 'L8' && run.finished && !run.skipped.length) ||
      JSON.stringify(completion.campaign.transport) !== JSON.stringify(proof.setup.physicalDeparture) || JSON.stringify(completion.campaign.transport) !== JSON.stringify(proof.result.physicalDeparture)) continue;
    const measured = handoverChecks(proof, tier), path = `${reportRoot}/receipts/L8-${tier}-handover.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L8', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [
      { id: 'L8-10', clause: 'production L8 to L9 handover first frame within6s', tier, policy: 'production-handover', status: measured.clock ? 'PASS' : 'FAIL', value: { ms: measured.ms, valid: measured.valid }, target: 'continueCampaign through first frame≤6000ms with outgoing scene resident; same method as existing handover probe, no frame profiler', receipt: proofPath },
      { id: 'L8-10', clause: 'actual physical departure APC identity durability and seats retained', tier, policy: 'production-handover', status: measured.transport ? 'PASS' : 'FAIL', value: { before: proof.setup.physicalDeparture.vehicle, after: proof.result.car, active: proof.result.active }, target: 'incoming live APC matches actual qualified physical departure ID/HP/seated identities; driver1 retained', receipt: proofPath },
    ] }; atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
