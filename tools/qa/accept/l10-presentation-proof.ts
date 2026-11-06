import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { presentationChecks, type Presentation } from './l10-presentation-receipts';
import { atomicJson } from './report';
import { provenance } from './probe';
const cases = [];
for (const tier of ['low', 'high']) {
  const original = JSON.parse(gunzipSync(readFileSync(`docs/reports/sweep-c5/L10-07/${tier}-presentation.json.gz`)).toString()) as Presentation;
  const baseline = presentationChecks(original);
  assert(baseline.ring && baseline.audio, `${tier}: original current measurements must pass`);
  cases.push({ tier, fault: 'unaltered current observation', ring: baseline.ring, audio: baseline.audio });
  for (const fault of ['Mega pin', 'off-center ring', 'stopped pulse', 'flat gain', 'missing impact', 'muted graph', 'insufficient duration']) {
    const broken = structuredClone(original), samples = broken.rows.slice(0, -1) as Exclude<Presentation['rows'][number], { captures: unknown }>[];
    for (const sample of samples) {
      if (fault === 'Mega pin') sample.pins.push(sample.id);
      if (fault === 'off-center ring') sample.ring.centerError = 8;
      if (fault === 'stopped pulse') sample.ring.animations = [];
      if (fault === 'muted graph') sample.audio.muted = true;
      if (fault === 'flat gain') for (const cue of sample.audio.cues) cue.gain = .1;
      if (fault === 'missing impact') sample.audio.cues = sample.audio.cues.filter(cue => cue.cue !== 'mega.impact');
      if (fault === 'insufficient duration') sample.tick = 0;
    }
    const result = presentationChecks(broken), rejected = fault.includes('ring') || ['Mega pin', 'stopped pulse'].includes(fault) ? !result.ring : !result.audio;
    assert(rejected, `${tier}: ${fault}`); cases.push({ tier, fault, rejected });
  }
}
atomicJson('docs/reports/sweep-c5/L10-07/checker-controls.json', { ...provenance(), cases });
console.log(cases);
