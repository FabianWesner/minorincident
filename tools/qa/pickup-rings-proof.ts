import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { provenance } from './accept/probe';

type Pickup = { id: number; present: boolean; markerMeshes: number; modelLoaded: boolean };
type Sample = { stage: string; backend: string; quality: string; pickups: Pickup[]; pixels: { id: number; yellowPixels: number }[];
  ledger: { collections: { id: number }[]; maxAwayAfterCollection: number; returned: boolean }; replacementAtCourierSpot: number[] };
type Receipt = { sourceHash: string; backend: string; tier: string; errors: string[]; rows: Sample[] };
const identity = provenance();
function qualify(receipt: Receipt) {
  assert.equal(receipt.sourceHash, identity.sourceHash); assert.deepEqual(receipt.errors, []);
  assert.equal(receipt.rows.length, 2);
  const [before, after] = receipt.rows;
  assert.equal(before.stage, 'before'); assert.equal(after.stage, 'after-revisit');
  for (const sample of receipt.rows) {
    assert.equal(sample.backend, receipt.backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(sample.quality, receipt.tier);
    assert.equal(sample.pickups.length, 2); assert.equal(sample.pixels.length, 2);
    assert.equal(sample.pickups[1].id, before.pickups[1].id);
    assert(sample.pickups[1].present && sample.pickups[1].modelLoaded);
    assert.equal(sample.pickups[1].markerMeshes, 0); assert.equal(sample.pixels[1].yellowPixels, 0);
  }
  assert(before.pickups.every(p => p.present && p.modelLoaded));
  assert.equal(before.pickups[0].markerMeshes, 1); assert(before.pixels[0].yellowPixels > 0);
  assert.equal(before.ledger.collections.length, 0);
  assert.equal(after.pickups[0].id, before.pickups[0].id);
  assert(!after.pickups[0].present); assert.equal(after.pickups[0].markerMeshes, 0);
  assert.deepEqual(after.replacementAtCourierSpot, []);
  assert.deepEqual(after.ledger.collections.map(e => e.id), [before.pickups[0].id]);
  assert(after.ledger.returned && after.ledger.maxAwayAfterCollection > 4);
}
const cells = [], faults = [];
for (const backend of ['webgl2', 'webgpu']) for (const tier of ['low', 'high']) {
  const file = `docs/reports/fix51-r10g/G-11-${backend}-${tier}.json`, raw = readFileSync(file);
  const receipt = JSON.parse(raw.toString()) as Receipt; assert.equal(receipt.backend, backend); assert.equal(receipt.tier, tier); qualify(receipt);
  cells.push({ backend, tier, file, sha256: createHash('sha256').update(raw).digest('hex'), pass: true });
  const mutations: [string, (r: Receipt) => void][] = [
    ['survivor-only ring rendered', r => { r.rows[0].pickups[1].markerMeshes = 1; r.rows[0].pixels[1].yellowPixels = r.rows[0].pixels[0].yellowPixels; }],
    ['ring pixels despite missing renderer metadata', r => { r.rows[0].pixels[1].yellowPixels = r.rows[0].pixels[0].yellowPixels; }],
    ['pickup resurrected at original position', r => { r.rows[1].pickups[0].present = true; }],
    ['replacement pickup spawned', r => { r.rows[1].replacementAtCourierSpot = [99]; }],
    ['duplicate collection', r => { r.rows[1].ledger.collections.push({ id: r.rows[0].pickups[0].id }); }],
    ['courier never returned', r => { r.rows[1].ledger.returned = false; }],
  ];
  for (const [name, mutate] of mutations) {
    const broken = structuredClone(receipt); mutate(broken); assert.throws(() => qualify(broken));
    faults.push({ backend, tier, name, detected: true });
  }
}
writeFileSync('docs/reports/fix51-r10g/G-11-proof.json', JSON.stringify({ ...identity, cells, faults,
  scope: 'Offline receipt mutation proof. These mutations do not claim injected rendered game faults; the actual paired courier ring is the positive pixel control.' }, null, 2) + '\n');
console.log(`G-11: ${cells.length} production receipts qualified, ${faults.length} receipt faults detected`);
