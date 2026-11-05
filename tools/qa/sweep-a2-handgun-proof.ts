/** Reject incomplete/stale shot trials and unmounted HUDs before the exact-clause review is registered. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { atomicJson } from './accept/report';
import { provenance } from './accept/probe';

interface Trial { tier: string; handgunAt: number; shots: number[]; hud: { tick: number; text: string }[]; captures: { shots: number }[] }
interface Proof { sourceHash: string; observerHash: string; runs: Trial[] }
const identity = provenance();
function measure(proof: Proof) {
  const runs = proof.runs.map(r => ({ tier: r.tier, acquisitionSeconds: r.handgunAt / 60,
    shots: r.shots.length, gaps: [...new Set(r.shots.slice(1).map((tick, i) => tick - r.shots[i]))],
    hudSamples: r.hud.length, mountedSamples: r.hud.filter(h => h.text.includes('100 / 100') && h.text.includes('Corgi · following')).length,
    captures: r.captures.map(c => c.shots) }));
  const pass = proof.sourceHash === identity.sourceHash && proof.observerHash === identity.observerHash && runs.length === 2 &&
    ['low', 'high'].every(tier => runs.filter(r => r.tier === tier).length === 1) && runs.every(r =>
      r.acquisitionSeconds > 0 && r.acquisitionSeconds <= 40 && r.shots === 600 && r.gaps.length === 1 && r.gaps[0] === 20 &&
      r.hudSamples === 800 && r.mountedSamples === 800 && JSON.stringify(r.captures) === JSON.stringify([0, 100, 200, 300, 400, 500, 600]));
  return { runs, pass };
}
const file = 'docs/reports/sweep-a2/L3-01-browser-ledger.json.gz';
const proof = JSON.parse(gunzipSync(readFileSync(file)).toString()) as Proof;
const missing = structuredClone(proof); missing.runs.pop();
const duplicate = structuredClone(proof); duplicate.runs[1].tier = duplicate.runs[0].tier;
const truncated = structuredClone(proof); truncated.runs[0].shots.pop();
const interrupted = structuredClone(proof); interrupted.runs[0].shots[1]++;
const late = structuredClone(proof); late.runs[0].handgunAt = 2401;
const absentHud = structuredClone(proof); absentHud.runs[0].hud[1].text = '';
const stale = structuredClone(proof); stale.sourceHash = '0'.repeat(64);
const controls = [
  { test: 'missing quality rejected', pass: !measure(missing).pass },
  { test: 'duplicate quality rejected', pass: !measure(duplicate).pass },
  { test: '599-shot incomplete trial rejected', pass: !measure(truncated).pass },
  { test: 'interrupted cadence rejected', pass: !measure(interrupted).pass },
  { test: 'acquisition beyond40seconds rejected', pass: !measure(late).pass },
  { test: 'unmounted HUD sample rejected', pass: !measure(absentHud).pass },
  { test: 'stale source rejected', pass: !measure(stale).pass },
];
const result = measure(proof);
atomicJson('docs/reports/sweep-a2/L3-01-shot-proof.json', { ...identity, ...result, controls,
  ledger: { file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') },
  method: 'Actual production combat.attack handgun events from ordinary input; full UI mounted and sampled every15ticks. All599 gaps20ticks show no reload interruption. These checks do not substitute for personally inspected UI pixels, armory location or independent40HP/two-hit fixtures.' });
assert(controls.every(c => c.pass));
assert(result.pass, 'Incomplete current-source600-shot/full-HUD proof');
console.log(result.runs, controls.length, 'controls pass');
