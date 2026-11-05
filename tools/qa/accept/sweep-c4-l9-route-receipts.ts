import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Capture = { file: string; sha256: string };
type Hit = { type: string; source?: string; targetId: number; contactId: number | null; attackId: number | null; before: number; after: number };
type Route = { tier: string; mode: string; errors: string[]; setup: { before: number; after: number; backend: string; quality: string }; captures: Capture[]; commands: { keys: string[] }[]; samples: { phase: string; hp: number; position: { x: number; z: number } }[]; result: { phase: string; preCrashDurability: number; inputs: { drive?: { throttle: number } }[]; events: Hit[] } };
type Proof = { sourceHash: string; browserHash: string; toolSha256: string; rows: Route[] };

export function sweepC4L9RouteReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const reviewPath = 'docs/reports/sweep-c4/L9-04-review.json';
  if (!existsSync(reviewPath)) return [];
  const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as { sourceHash: string; browserHash: string; producer: Capture; proofs: Capture[]; captures: (Capture & { seen: string })[]; sheets: Capture[] };
  const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  if (review.sourceHash !== sourceHash || review.browserHash !== browserHash || !review.producer || !existsSync(review.producer.file) || sha(readFileSync(review.producer.file)) !== review.producer.sha256) return [];
  const results = [];
  for (const tier of ['low', 'high'] as const) {
    const proofPath = `docs/reports/sweep-c4/L9-04-${tier}-physical.json.gz`;
    if (!existsSync(proofPath)) continue;
    const bytes = readFileSync(proofPath), proof = JSON.parse(gunzipSync(bytes).toString()) as Proof;
    if (proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.toolSha256 !== review.producer.sha256 || !review.proofs.some(file => file.file === proofPath && file.sha256 === sha(bytes))) continue;
    const safe = proof.rows.find(row => row.tier === tier && row.mode === 'safe'), shortcut = proof.rows.find(row => row.tier === tier && row.mode === 'shortcut');
    if (!safe || !shortcut) continue;
    const seen = (row: Route) => row.captures.length >= 4 && row.captures.every(capture => review.captures.some(file => file.file === capture.file && file.sha256 === capture.sha256 && file.seen?.trim()));
    const valid = (row: Route) => !row.errors.length && row.setup.backend === 'webgl' && row.setup.quality === tier && row.setup.before === row.setup.after && row.setup.after > 0 && row.result.phase === 'approach' && row.result.preCrashDurability === row.samples.at(-1)?.hp && row.commands.some(command => command.keys.includes('KeyW')) && row.result.inputs.some(input => (input.drive?.throttle ?? 0) > 0) && seen(row);
    const pair = valid(safe) && valid(shortcut) && safe.setup.after === shortcut.setup.after && safe.samples[0].position.x === shortcut.samples[0].position.x && safe.samples[0].position.z === shortcut.samples[0].position.z && review.sheets.length > 0 && review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256));
    const hits = [...safe.result.events, ...shortcut.result.events].filter(event => event.type === 'vehicle.durability-hit' && ['contact', 'attack'].includes(event.source ?? ''));
    const billing = [safe, shortcut].every(row => {
      const events = row.result.events.filter(event => event.type === 'vehicle.durability-hit' && ['contact', 'attack'].includes(event.source ?? ''));
      return new Set(events.map(event => `${event.source}/${event.targetId}/${event.contactId}/${event.attackId}`)).size === events.length && events.every(event => event.after === Math.max(0, event.before - 10));
    });
    const path = `${reportRoot}/receipts/L9-${tier}-sweep-c4-routes.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L9', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [...safe.errors, ...shortcut.errors], observations: { proofPath, reviewPath }, checks: [
      { id: 'L9-04', clause: 'physical matched safe route retains more durability than shortcut', tier, policy: 'real-input-webgl2', value: { validPair: pair, safe: safe.result.preCrashDurability, shortcut: shortcut.result.preCrashDurability }, target: 'same healthy seed1 start; both physical drives finish at normal pre-crash approach; safe pre-crash HP strictly greater', status: !pair ? 'NOT CHECKED' : safe.result.preCrashDurability > shortcut.result.preCrashDurability ? 'PASS' : 'FAIL', receipt: proofPath },
      { id: 'L9-04', clause: 'physical route contact and attack billing', tier, policy: 'real-input-webgl2', value: hits, target: 'nonempty actual hit ledger; ten damage per unique contact/attack transaction', status: !pair || !hits.length ? 'NOT CHECKED' : billing ? 'PASS' : 'FAIL', receipt: proofPath },
    ] };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
