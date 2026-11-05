import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { vehicleDef } from '../../../src/data/vehicles';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

/** Boarding identity, wait guidance and weapon inventory are separate checks. */
export function l8BoardingReceipts(sourceHash: string, observerHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const proofPath = 'docs/reports/sweep-c/L8-09-boarding-native.json';
  const radarPath = 'docs/reports/sweep-c/L8-09-radar-replay.json';
  if (![proofPath, radarPath].every(existsSync)) return [];
  const proof = JSON.parse(readFileSync(proofPath, 'utf8')), radar = JSON.parse(readFileSync(radarPath, 'utf8'));
  if (proof.sourceHash !== sourceHash || proof.observerHash !== observerHash || radar.sourceHash !== sourceHash ||
    proof.toolSha256 !== sha(readFileSync('tools/qa/accept/l8-boarding-sweep.ts')) ||
    radar.producerSha256 !== sha(readFileSync('tools/qa/accept/l8-boarding-radar.mjs')) ||
    radar.nativeProofSha256 !== sha(readFileSync(proofPath)) || radar.errors.length) return [];
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const native = proof.rows.find((row: { tier: string }) => row.tier === tier);
    const ui = radar.rows.find((row: { tier: string }) => row.tier === tier);
    if (!native || !ui || sha(readFileSync(native.samplesPath)) !== native.samplesSha256 ||
      !ui.capture.seen?.trim() || !ui.capture.sheet || !evidenceIsArchivedOrMatches(ui.capture.sheet, ui.capture.sheetSha256)) continue;
    const samples = JSON.parse(gunzipSync(readFileSync(native.samplesPath)).toString()) as {
      tick: number; canDrive: boolean; ids: number[]; waiting: number[];
      actors: { id: number; companion?: unknown; hidden?: boolean; passengerOf?: number }[]; carId: number;
    }[];
    const nativeTransfer = native.transfer;
    const seats = nativeTransfer?.vehicle?.vehicle?.passengers as { id: number; phase: string }[] | undefined;
    const nativeIds = [...new Set(samples.flatMap(sample => sample.ids))];
    const continuous = samples.length === native.sampleCount && samples.every((sample, index) => !index || sample.tick === samples[index - 1].tick + 1);
    const completeSnapshots = samples.every(sample => sample.waiting.length === sample.actors.length && sample.waiting.every(id => sample.ids.includes(id) && sample.actors.some(actor => actor.id === id)));
    const nativeSeated = continuous && completeSnapshots && nativeIds.length > 1 && nativeIds.every(id => seats?.some(seat => seat.id === id && seat.phase === 'seated')) &&
      samples.every(sample => !sample.waiting.length || !sample.canDrive) && native.controlIdentical && native.nativeStateHash === native.controlStateHash;
    const base = `docs/reports/fix51-r10c/L7-L8-carried-${tier}`;
    const inputPath = `${base}-input.json`, reviewPath = `${base}/review.json`;
    const input = JSON.parse(readFileSync(inputPath, 'utf8')), review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    const producer = input.producer ?? 'tools/qa/accept/carried-input-r10.ts';
    if (!['tools/qa/accept/carried-input-r10.ts', 'tools/qa/accept/carried-input-r11.ts'].includes(producer) ||
      input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== sha(readFileSync(producer)) ||
      review.sourceHash !== sourceHash || review.browserHash !== browserHash ||
      !review.captures.length || !review.captures.every((capture: { sha256: string; seen: string }) => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) ||
      !review.sheets.length || !review.sheets.every((sheet: { file: string; sha256: string }) => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256))) continue;
    const archived = (name: string) => {
      const path = `${base}/${name}.json.gz`, artifact = review.artifacts.find((item: { file: string }) => item.file === path);
      const bytes = readFileSync(path), raw = gunzipSync(bytes);
      if (!artifact || sha(bytes) !== artifact.sha256 || sha(raw) !== artifact.uncompressedSha256) throw new Error(`Corrupt boarding archive ${path}`);
      return JSON.parse(raw.toString());
    };
    const completion = archived('late-input-completion'), ledger = archived('late-input-acceptance-ledger');
    const l8 = ledger.find((level: { level: string }) => level.level === 'L8');
    const result = completion.levels.find((level: { level: string }) => level.level === 'L8');
    const humans = result?.result?.escapedSurvivors as { id: number }[] | undefined;
    const transport = completion.campaign.transport, vehicle = transport?.vehicle;
    const physicalSeats = vehicle?.vehicle?.passengers as { id: number; phase: string }[] | undefined;
    const occupants = transport?.occupants as { id: number; companion?: unknown; archetype: string }[] | undefined;
    const corgi = occupants?.find(actor => actor.archetype === 'char.corgi');
    const rosterIds = [...new Set(l8.samples.flatMap((sample: { followers: { id: number }[] }) => sample.followers.map(actor => actor.id)))] as number[];
    const physicalIds = [...rosterIds, ...(corgi ? [corgi.id] : [])];
    const completed = !input.error && input.result.runs.some((run: { level: string; finished: boolean; skipped: string[] }) => run.level === 'L8' && run.finished && !run.skipped.length);
    const physicalSeated = completed && !!corgi && Array.isArray(humans) && humans.length === rosterIds.length &&
      rosterIds.every(id => humans.some(actor => actor.id === id)) && physicalIds.every(id => physicalSeats?.some(seat => seat.id === id && seat.phase === 'seated'));
    const humanSamples = samples.reduce((total, sample) => total + sample.actors.filter(actor => !actor.companion).length, 0);
    const internalPassengerSamples = samples.reduce((total, sample) => total + sample.actors.filter(actor => !actor.companion && actor.hidden && actor.passengerOf === sample.carId).length, 0);
    const guidance = samples.length > 0 && ui.ticks === samples.length && ui.humanSamples === humanSamples && humanSamples > 0 &&
      ui.internalPassengerSamples === internalPassengerSamples && ui.missingPins === 0 && ui.negativeMissingPinRejected && ui.failures.length === 0;
    const unarmed = vehicleDef('vehicle.military-apc').bodyVariant === 'unarmed' && vehicle.archetype === 'vehicle.military-apc' &&
      !vehicle.weapon && !vehicle.loadout && !vehicle.mounts && !vehicle.vehicle.weapon && !vehicle.vehicle.turret;
    const path = `${reportRoot}/receipts/L8-${tier}-boarding-sweep.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L8', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [
      { id: 'L8-09', clause: 'actual complete passenger identity boarding and wait gate', tier, policy: 'boarding-sweep', status: nativeSeated && physicalSeated ? 'PASS' : 'FAIL',
        value: { nativeSeated, continuous, completeSnapshots, nativeIds, physicalSeated, physicalIds, completed }, target: 'every living human and corgi seated in actual departure APC; no native departure while any passenger waits', receipt: path },
      { id: 'L8-09', clause: 'every outside waiting healthy survivor has production radar guidance', tier, policy: 'boarding-sweep', status: guidance ? 'PASS' : 'FAIL',
        value: { ticks: ui.ticks, humanSamples, internalPassengerSamples, missingPins: ui.missingPins, failures: ui.failures }, target: 'production radar DOM and CSS mark every actual native external waiting human on every boarding tick; hidden passengers already inside their assigned APC accounted separately; pin-removal control rejects', receipt: path },
      { id: 'L8-09', clause: 'actual departure APC is unarmed', tier, policy: 'boarding-sweep', status: unarmed ? 'PASS' : 'FAIL',
        value: { archetype: vehicle.archetype, bodyVariant: vehicleDef(vehicle.archetype).bodyVariant, components: Object.keys(vehicle), vehicleComponents: Object.keys(vehicle.vehicle) },
        target: 'actual carried military APC unarmed definition, no weapon/loadout/mount/turret components; current reviewed images independently show plain hatch', receipt: path },
    ], observations: { proofPath, radarPath, inputPath, reviewPath } };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
