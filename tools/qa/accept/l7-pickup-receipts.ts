import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';
import type { FixtureReceipt } from './fixtures';

const root = 'docs/reports/fix72-c/L7-01';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
interface Event { type: string; actionId?: string; pickupId?: number; sourceId?: number; at: number; tick: number; moving: boolean; player: { x: number; z: number } }
interface Frame { at: number; ms: number; playMs: number; phase: string; loading: boolean; paused: boolean; level: string }
interface Input {
  sourceHash: string; browserHash: string; toolSha256: string; probeSha256: string; tier: string; errors: string[]; gate: { distance: number; windows: unknown[]; pass: boolean };
  seed: { file: string; sha256: string };
  setup: { backend: string; quality: string; driverDetached: boolean; god: boolean; player: { x: number; z: number }; pickup: { id: number; position: { x: number; z: number } }; initialRack: { id: string }[] };
  result: { events: Event[]; frames: Frame[]; inputs: { tick: number; driver: boolean; interact: boolean; mouseAttack: boolean }[]; final: { pickupRemaining: boolean; rack: { id: string }[] } };
  captures: { file: string; sha256: string; zoom: number }[];
}
interface Review { sourceHash: string; browserHash: string; allPersonallyReviewed: boolean; tiers: { tier: string; inputSha256: string; captures: { file: string; sha256: string; seen: string }[] }[] }
export function measurePickup(d: Input, sourceHash: string, browserHash: string) {
  // The producer retains its failed gate assertion as a measured FAIL, not a collection error.
  const collected = d.errors.length === 0 || !d.gate.pass && d.errors.length === 1 && d.errors[0] === `AssertionError [ERR_ASSERTION]: L7-01 frame gate ${JSON.stringify(d.gate)}`;
  const valid = collected && d.sourceHash === sourceHash && d.browserHash === browserHash && d.setup.backend === 'webgl' && d.setup.quality === d.tier && d.setup.driverDetached && !d.setup.god &&
    d.toolSha256 === sha('tools/qa/accept/fix72-c-l7-pickup.mjs') && d.probeSha256 === sha('tools/playtest/frames.ts') && d.seed.sha256 === sha(d.seed.file);
  const pickups = d.result.events.filter(e => e.type === 'pickup.collected' && e.actionId === 'weapon.rocket-launcher' && e.pickupId === d.setup.pickup.id);
  const shots = d.result.events.filter(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher');
  const p = d.setup.player, q = d.setup.pickup.position, distance = Math.hypot(p.x - q.x, p.z - q.z);
  const mechanics = pickups.length === 1 && shots.length === 1 && pickups[0].moving && shots[0].tick > pickups[0].tick && distance <= 5 &&
    Math.hypot(pickups[0].player.x - q.x, pickups[0].player.z - q.z) <= 2.2 && !d.setup.initialRack.some(s => s.id === 'weapon.rocket-launcher') &&
    !d.result.final.pickupRemaining && d.result.final.rack.some(s => s.id === 'weapon.rocket-launcher') && d.result.inputs.length > 0 &&
    d.result.inputs.every(f => !f.driver && !f.interact && (f.tick >= pickups[0].tick || !f.mouseAttack));
  const windows = [...pickups, ...shots].map(event => {
    const frames = d.result.frames.filter(f => f.playMs > 0 && f.at >= event.at - 100 && f.at - f.ms <= event.at + 250);
    return { event: event.type, tick: event.tick, samples: frames.length, valid: frames.every(f => !f.paused && !f.loading && f.level === 'L7' && f.phase === 'playing'), maxMs: Math.max(0, ...frames.map(f => f.playMs)) };
  });
  return { valid, mechanics, distance, windows, frameGate: windows.length === 2 && windows.every(w => w.samples >= 3 && w.valid && w.maxMs <= 50) };
}
export function l7PickupReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  if (!existsSync(`${root}/review.json`)) return [];
  const review = JSON.parse(readFileSync(`${root}/review.json`, 'utf8')) as Review;
  return ['low', 'high'].map(tier => {
    const file = `${root}/${tier}.json`, d = JSON.parse(readFileSync(file, 'utf8')) as Input, m = measurePickup(d, sourceHash, browserHash);
    const r = review.tiers.find(r => r.tier === tier);
    const seen = review.sourceHash === sourceHash && review.browserHash === browserHash && review.allPersonallyReviewed && r?.inputSha256 === sha(file) &&
      [.5, 1.5].every(z => d.captures.some(c => c.zoom === z)) && d.captures.every(c => r.captures.some(v => v.file === c.file && v.sha256 === c.sha256 && !!v.seen.trim()) && evidenceIsArchivedOrMatches(c.file, c.sha256));
    const path = `${reportRoot}/receipts/L7-${tier}-pickup-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L7', tier: tier as 'low' | 'high', sourceHash, fixtureHash: sha(new URL(import.meta.url).pathname), errors: [], checks: [
      { id: 'L7-01', clause: 'physical launcher approach pickup and first rocket frame gate', tier, policy: 'physical-pickup', status: m.valid && m.mechanics && m.frameGate ? 'PASS' : 'FAIL', value: m, target: 'Exit≤5m, moving auto-pickup without E, first physical rocket; each event frame≤50ms in an unpaused quiet context.', receipt: file },
      { id: 'L7-01', clause: 'reviewed actual launcher first-rocket captures', tier, policy: 'physical-pickup', status: m.valid && seen ? 'PASS' : 'NOT CHECKED', value: { seen }, target: 'Current both-tier low/high zoom0.5/1.5 images personally reviewed with exact SHA-256.', receipt: `${root}/review.json` },
    ] };
    atomicJson(path, receipt); return { path, receipt };
  });
}
