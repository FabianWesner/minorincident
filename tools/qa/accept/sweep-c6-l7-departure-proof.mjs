import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { l7DepartureReceipts } from './l7-departure-receipts.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
const p = provenance(), hash = browserHash(), root = 'docs/reports/sweep-c6/L7-11';
const ip = `${root}/low-physical.json.gz`, rp = `${root}/low-review.json`;
const original = readFileSync(ip), originalReview = readFileSync(rp), sha = b => createHash('sha256').update(b).digest('hex');
const run = () => l7DepartureReceipts(p.sourceHash, hash).flatMap(r => r.receipt.checks), cases = [];
assert.equal(run().length, 4); assert(run().every(c => c.status === 'PASS'), 'baseline');
for (const fault of ['stale-source', 'wrong-browser', 'wrong-producer', 'short-duration', 'long-duration', 'short-displacement', 'replaced-bus', 'hidden-bus', 'tick-gap', 'native-driver', 'input-gap', 'missing-frame', 'frame-gap', 'unreviewed', 'skyline', 'truck', 'gore', 'edge', 'wrong-quality', 'console-error']) {
  try {
    const a = JSON.parse(gunzipSync(original)), v = JSON.parse(originalReview), r = a.result;
    if (fault === 'stale-source') a.sourceHash = '0'.repeat(64);
    if (fault === 'wrong-browser') a.browserHash = '0'.repeat(64);
    if (fault === 'wrong-producer') a.toolSha256 = '0'.repeat(64);
    if (fault === 'short-duration') r.finish.departure.startedAt = r.finish.tick - 359;
    if (fault === 'long-duration') r.finish.departure.startedAt = r.finish.tick - 601;
    if (fault === 'short-displacement') r.finish.bus.position = { ...r.ticks.find(t => t.departure.phase === 'departing').bus.position };
    if (fault === 'replaced-bus') r.finish.bus.id += 1;
    if (fault === 'hidden-bus') r.ticks.find(t => t.departure.phase === 'departing').bus.hidden = true;
    if (fault === 'tick-gap') r.ticks.splice(r.ticks.findIndex(t => t.departure.phase === 'departing') + 100, 1);
    if (fault === 'native-driver') r.inputs[100].nativeDriver = true;
    if (fault === 'input-gap') r.inputs.splice(100, 1);
    if (fault === 'missing-frame') a.captures.pop();
    if (fault === 'frame-gap') a.captures.find(c => c.label === 'departure-2.5').state.tick += 60;
    if (fault === 'unreviewed') v.allPersonallyReviewed = false;
    for (const [key, index] of [['skyline', 0], ['truck', 1], ['gore', 2], ['edge', 3]]) if (fault === key) v.visuals[index].pass = false;
    if (fault === 'wrong-quality') a.setup.quality = 'high';
    if (fault === 'console-error') a.errors.push('injected error');
    const raw = Buffer.from(JSON.stringify(a)); v.inputSha256 = sha(raw);
    writeFileSync(ip, gzipSync(raw)); writeFileSync(rp, JSON.stringify(v));
    const checks = run(), rejected = checks.length !== 4 || checks.some(c => c.status !== 'PASS');
    assert(rejected, fault); cases.push({ fault, rejected });
  } finally { writeFileSync(ip, original); writeFileSync(rp, originalReview); }
}
assert.equal(run().length, 4); assert(run().every(c => c.status === 'PASS'), 'restored');
writeFileSync(`${root}/coverage-proof.json`, JSON.stringify({ ...p, browserHash: hash, method: 'Deliberate semantic mutations exercise the actual dedicated L7-11 consumer. Input/review links are rehashed; original bytes restored after every case.', cases }, null, 2) + '\n');
