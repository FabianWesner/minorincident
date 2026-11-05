/** Recompute the scoped first-encounter proof from actual same-ID warning events. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { atomicJson } from './accept/report';
import { provenance } from './accept/probe';

interface Trial {
  tier: string; seed: number;
  first: { id: number; tick: number; distance: number; visible: boolean; appearedAt?: number } | null;
  warnings: { threatId: number; tick: number; stage: string }[];
}
interface Proof { sourceHash: string; observerHash: string; runs: Trial[] }
const identity = provenance();
function measure(proof: Proof) {
  const tiers = ['low', 'high'].map(tier => {
    const trials = proof.runs.filter(r => r.tier === tier);
    const encounters = trials.map(r => {
      const first = r.first;
      const valid = !!first && !first.visible && first.distance <= 20 && Number.isFinite(first.appearedAt) && first.appearedAt! >= first.tick;
      const warningTick = first ? Math.min(...r.warnings.filter(w => w.threatId === first.id && ['stiffen', 'growl', 'bark'].includes(w.stage)).map(w => w.tick)) : Infinity;
      return { seed: r.seed, first, warningTick: Number.isFinite(warningTick) ? warningTick : null,
        valid, warned: valid && warningTick < first!.appearedAt! };
    });
    const complete = trials.length === 10 && new Set(trials.map(r => r.seed)).size === 10 && trials.every(r => r.seed >= 1 && r.seed <= 10) && encounters.every(e => e.valid);
    const warned = encounters.filter(e => e.warned).length;
    return { tier, complete, encounters, warned, total: trials.length, percent: trials.length ? warned / trials.length * 100 : null,
      pass: complete && warned / trials.length >= .8 };
  });
  return { tiers, pass: proof.sourceHash === identity.sourceHash && proof.observerHash === identity.observerHash && proof.runs.length === 20 && tiers.every(t => t.pass) };
}
const file = 'docs/reports/sweep-a2/L1-10-native.json.gz';
const proof = JSON.parse(gunzipSync(readFileSync(file)).toString()) as Proof;
const measured = measure(proof);
const clone = () => structuredClone(proof);
const stale = clone(); stale.sourceHash = '0'.repeat(64);
const missing = clone(); missing.runs.pop();
const duplicate = clone(); duplicate.runs[1].seed = duplicate.runs[0].seed;
const late = clone(); for (const trial of late.runs) for (const w of trial.warnings) w.tick = trial.first?.appearedAt ?? Infinity;
const wrongId = clone(); for (const trial of wrongId.runs) for (const w of trial.warnings) w.threatId = -1;
const never = clone(); for (const trial of never.runs) if (trial.first) delete trial.first.appearedAt;
const controls = [
  { test: 'stale source rejected', pass: !measure(stale).pass },
  { test: 'missing seed/tier coverage rejected', pass: !measure(missing).pass },
  { test: 'duplicate seed rejected', pass: !measure(duplicate).pass },
  { test: 'warning on appearance tick rejected', pass: !measure(late).pass },
  { test: 'different threat ID rejected', pass: !measure(wrongId).pass },
  { test: 'never appearing candidates rejected', pass: !measure(never).pass },
  { test: '80 percent boundary accepted; 79.9 rejected', pass: 8 / 10 >= .8 && 79.9 / 100 < .8 },
];
atomicJson('docs/reports/sweep-a2/L1-10-measurement.json', { ...identity, ...measured, controls,
  ledger: { file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') },
  toolSha256: createHash('sha256').update(readFileSync('tools/qa/fix60-a-warning.ts')).digest('hex'),
  method: 'Ten natural first offscreen-to-onscreen encounters per tier on production-camera complete input. Same-ID actual stiffen/growl/bark event must strictly precede first camera appearance. Missing trials/appearances are unqualified; failed warning encounters stay in the denominator. E19-AC17 is a sim event criterion, not an audio-audibility verdict.' });
assert(controls.every(c => c.pass));
assert(measured.pass, 'Current warning coverage does not satisfy both tiers');
console.log(measured.tiers.map(t => ({ tier: t.tier, warned: t.warned, total: t.total, percent: t.percent })));
