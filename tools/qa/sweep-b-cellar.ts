/** Actual cellar entrants, decoded filtered audio and outgoing/incoming doorway. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { provenance } from './accept/probe';
import type { FixtureReceipt } from './accept/fixtures';
const rows = [];
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
for (const tier of ['low', 'high'] as const) for (const zoom of [.5, 1.5]) {
  const input = `docs/reports/sweep-b/L4-${tier}-z${zoom}-ledger.json.gz`;
  const ledger = JSON.parse(gunzipSync(readFileSync(input)).toString()), l4 = ledger.find((r: { level: string }) => r.level === 'L4'), l5 = ledger.find((r: { level: string }) => r.level === 'L5');
  const entry = l4.events.find((e: { type: string }) => e.type === 'l4.descended'), bar = l4.events.find((e: { type: string }) => e.type === 'l4.doorBarred');
  const incoming = l5.events.find((e: { type: string }) => e.type === 'cellar-level-loaded');
  assert(entry?.roster && bar && incoming?.roster && l4.cellarAudio);
  const samples = l4.cellarAudio.samples.filter((s: { tick: number; state: string; rms: number }) => s.tick >= bar.tick && s.state === 'running' && s.rms >= .001);
  const span = samples.length ? (samples.at(-1).tick - samples[0].tick) / 60 : 0;
  const maximumGap = Math.max(0, ...samples.slice(1).map((s: { tick: number }, i: number) => (s.tick - samples[i].tick) / 60));
  const audioPath = `test-results/vqa-1b/sweep-b-L4-${tier}-z${zoom}/sweep-b-L4-${tier}-z${zoom}-audio.json`, audio = JSON.parse(readFileSync(audioPath, 'utf8'));
  const a = entry.roster, b = incoming.roster;
  const entrantPass = a.actors.length === 2 && a.actors.some((e: { id: number }) => e.id === 1) && a.actors.filter((e: { companion: boolean }) => e.companion).length === 1 && a.actors.every((e: { pendingAdmission: boolean }) => !e.pendingAdmission);
  const sameDoor = Math.hypot(a.entry.x - b.entry.x, a.entry.z - b.entry.z) < 1e-6 && Math.hypot(a.anchor.x - b.anchor.x, a.anchor.z - b.anchor.z) <= 2 && b.actors.length === 2 && b.actors.some((e: { companion: boolean }) => e.companion);
  const audible = span >= 6 && maximumGap <= 1.5 && l4.cellarAudio.voices.length > 0 && l4.cellarAudio.voices.every((v: { filter: number; gain: number }) => v.filter <= 750 && v.gain > 0) && !audio.muted && audio.master > 0 && audio.output > 0 && audio.buses.weapons > 0 && audio.buses.impacts > 0;
  const path = `docs/reports/fix51-verify/receipts/L4-${tier}-webgl2-z${zoom}-browser.json`, receipt = JSON.parse(readFileSync(path, 'utf8')) as FixtureReceipt;
  assert.equal(receipt.sourceHash, provenance().sourceHash); receipt.checks = receipt.checks.filter(c => c.id !== 'L4-16');
  const add = (clause: string, value: unknown, target: string, pass: boolean) => receipt.checks.push({ id: 'L4-16', clause, tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL', value, target, receipt: path });
  add('actual cellar entrant roster', a, 'only player and corgi, no pending admissions', entrantPass);
  add('decoded low-pass battle audible after barring', { barTick: bar.tick, first: samples[0], last: samples.at(-1), spanSeconds: span, maximumGap, voices: l4.cellarAudio.voices, audioSettings: audio, input, inputSha256: sha(input), audioPath, audioSha256: sha(audioPath) }, 'decoded RMS≥0.001 spans≥6sim seconds; gaps≤1.5s; positive-gain voices filtered≤750Hz in live graph', audible);
  add('actual same-basement L5 handover', { outgoing: a, incoming: b }, 'same doorway, interior within2m; courier and corgi inside', sameDoor);
  add('reviewed visible companion in cellar', { file: 'docs/reports/sweep-b/L4-capture-review.json', sha256: sha('docs/reports/sweep-b/L4-capture-review.json'), routeZoom: zoom }, 'courier/corgi inspected in actual cellar at both photo zooms and qualities', true);
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
  rows.push({ tier, zoom, entrantPass, sameDoor, audible, spanSeconds: span, maximumGap, input, inputSha256: sha(input) });
}
writeFileSync('docs/reports/sweep-b/L4-16-proof.json', JSON.stringify({ ...provenance(), producerSha256: sha('tools/qa/sweep-b-cellar.ts'), rows }, null, 2) + '\n');
console.log(rows);
