import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { measurePickup } from './l7-pickup-receipts.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
const identity = provenance(), bh = browserHash(), cases = [];
for (const tier of ['low', 'high']) {
  const d = JSON.parse(readFileSync(`docs/reports/fix72-c/L7-01/${tier}.json`));
  const check = value => measurePickup(value, identity.sourceHash, bh);
  const baseline = check(d); assert(baseline.valid && baseline.mechanics && baseline.frameGate);
  const event = d.result.events.find(e => e.type === 'pickup.collected' && e.actionId === 'weapon.rocket-launcher');
  const frameIndex = d.result.frames.findIndex(f => f.playMs > 0 && f.at >= event.at && f.at - f.ms <= event.at + 250);
  assert(frameIndex >= 0);
  // Synthetic boundary controls only: the original measured failures stay unchanged.
  const boundary = structuredClone(d); boundary.errors = [];
  for (const frame of boundary.result.frames) if (frame.playMs > 0) frame.ms = frame.playMs = 50;
  assert(check(boundary).frameGate, '50ms boundary must pass');
  const faults = [
    ['frame50.01ms', x => { x.result.frames[frameIndex].ms = x.result.frames[frameIndex].playMs = 50.01; }, 'frameGate'],
    ['missing frames', x => { x.result.frames = []; }, 'frameGate'],
    ['stationary pickup', x => { x.result.events.find(e => e.type === 'pickup.collected').moving = false; }, 'mechanics'],
    ['E used', x => { x.result.inputs[0].interact = true; }, 'mechanics'],
    ['shot before pickup', x => { x.result.events.find(e => e.type === 'combat.attack' && e.sourceId === 1).tick = event.tick - 1; }, 'mechanics'],
    ['pickup remains', x => { x.result.final.pickupRemaining = true; }, 'mechanics'],
    ['launcher outside5m', x => { x.setup.pickup.position = { x: x.setup.player.x + 5.01, z: x.setup.player.z }; }, 'mechanics'],
    ['collection outside2.2m', x => { x.result.events.find(e => e.type === 'pickup.collected').player = { x: x.setup.pickup.position.x + 2.201, z: x.setup.pickup.position.z }; }, 'mechanics'],
    ['unmatched seed', x => { x.seed.sha256 = '0'.repeat(64); }, 'valid'],
    ['unmatched producer', x => { x.toolSha256 = '0'.repeat(64); }, 'valid'],
    ['unmatched source', x => { x.sourceHash = '0'.repeat(64); }, 'valid'],
  ];
  for (const [name, inject, field] of faults) { const x = structuredClone(boundary); inject(x); assert.equal(check(x)[field], false, `${tier} ${name}`); cases.push({ tier, name, rejected: true }); }
}
writeFileSync('docs/reports/fix72-c/L7-01/fault-proof.json', JSON.stringify({ ...identity, browserHash: bh, adapterSha256: createHash('sha256').update(readFileSync('tools/qa/accept/l7-pickup-receipts.ts')).digest('hex'), boundary50ms: 'PASS', cases }, null, 2) + '\n');
console.log(`${cases.length} L7-01 counterexamples rejected`);
