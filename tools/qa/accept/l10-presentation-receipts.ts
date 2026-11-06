import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';

type Cue = { cue: string; tick: number; sourceId: number; gain: number };
type Sample = { tick: number; id: number; band: string | null; distance: number;
  ring: { hidden: boolean; band: string; width: string; height: string; centerError: number; animation: string; opacity: string;
    attributes: [string, string][]; animations: { name: string; state: string; keyframes: { opacity: string }[] }[] };
  pins: number[]; audio: { state: string; unlocked: boolean; muted: boolean; background: boolean; master: number; output: number; errors: string[]; cues: Cue[] } };
type Event = { tick: number; sourceId: number; kind: string; band: string; distance: number };
export type Presentation = { sourceHash: string; browserHash: string; toolSha256: string; seed: { file: string; sha256: string }; rows: [...Sample[], { captures: { file: string; sha256: string; band: string | null; seen?: string }[]; events: Event[]; errors: string[] }] };
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Use real scheduled graph gains, paired to actual pursuit events, not configuration values. */
export function presentationChecks(proof: Presentation) {
  const samples = proof.rows.slice(0, -1) as Sample[], final = proof.rows.at(-1) as { captures: { file: string; sha256: string; band: string | null; seen?: string }[]; events: Event[]; errors: string[] };
  const visible = samples.filter(sample => sample.band !== null), bands = [...new Set(visible.map(sample => sample.band))];
  const complete = samples.length >= 60 && samples.at(-1)!.tick - samples[0].tick >= 3000 && !final.errors.length;
  const ring = complete && ['approaching', 'near'].every(band => bands.includes(band)) && visible.every(sample =>
    !sample.ring.hidden && sample.ring.band === sample.band && sample.ring.centerError < .5 && !sample.pins.includes(sample.id) &&
    sample.ring.width === sample.ring.height && sample.ring.width === (sample.band === 'near' ? '44%' : sample.band === 'approaching' ? '68%' : '88%') &&
    !sample.ring.attributes.some(([name]) => /entity|world|bearing/.test(name)) &&
    sample.ring.animations.some(animation => animation.name === 'mega-pulse' && animation.state === 'running' && animation.keyframes.some(frame => Number(frame.opacity) < .8))) &&
    Math.max(...visible.map(sample => Number(sample.ring.opacity))) - Math.min(...visible.map(sample => Number(sample.ring.opacity))) > .2;
  const cues = samples.flatMap(sample => sample.audio.cues);
  const pairs = final.events.filter(event => event.kind === 'roar').map(event => ({ ...event,
    roar: cues.find(cue => cue.cue === 'mega.roar' && cue.tick === event.tick && cue.sourceId === event.sourceId),
    impact: cues.find(cue => cue.cue === 'mega.impact' && cue.tick === event.tick && cue.sourceId === event.sourceId) }));
  const approaching = pairs.find(pair => pair.band === 'approaching'), near = pairs.find(pair => pair.band === 'near');
  const gaps = pairs.slice(1).map((pair, index) => (pair.tick - pairs[index].tick) / 60);
  const audio = complete && visible.every(sample => sample.audio.state === 'running' && sample.audio.unlocked && !sample.audio.muted && !sample.audio.background && sample.audio.master > 0 && sample.audio.output > 0 && !sample.audio.errors.length) &&
    pairs.length >= 3 && gaps.every(gap => gap >= 20 && gap <= 35) && pairs.every(pair => pair.roar && pair.impact) && !!approaching && !!near &&
    near.distance < approaching.distance && near.roar!.gain > approaching.roar!.gain && near.impact!.gain > approaching.impact!.gain;
  return { ring, audio, bands, pairs, gaps, samples: samples.length };
}

export function l10PresentationReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const results = [];
  for (const tier of ['low', 'high'] as const) {
    const proofPath = `docs/reports/sweep-c5/L10-07/${tier}-presentation.json.gz`;
    if (!existsSync(proofPath)) continue;
    const proof = JSON.parse(gunzipSync(readFileSync(proofPath)).toString()) as Presentation;
    if (proof.seed.file !== `docs/reports/fix51-r10c/L10-${tier}-dog-save.json.gz` || proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.toolSha256 !== sha(readFileSync('tools/qa/accept/sweep-c5-l10-presentation.mjs')) || !existsSync(proof.seed.file) || sha(readFileSync(proof.seed.file)) !== proof.seed.sha256) continue;
    const value = presentationChecks(proof), path = `${reportRoot}/receipts/L10-${tier}-presentation.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [
      { id: 'L10-07', clause: 'actual centered pulsing band ring without Mega pin', tier, policy: 'real-input-webgl2', status: value.ring ? 'PASS' : 'FAIL', value, target: 'both distance bands, centered animated ring, no Mega entity pin or bearing', receipt: proofPath },
      { id: 'L10-07', clause: 'actual paired audio gains increase at closer distance', tier, policy: 'real-input-webgl2', status: value.audio ? 'PASS' : 'FAIL', value, target: 'normal-clock unlocked unmuted graph; >=3 paired20–35s cues, closer roar and impact gains both greater', receipt: proofPath },
    ] };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
