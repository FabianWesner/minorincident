import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { sweepC4L9RouteReceipts } from './sweep-c4-l9-route-receipts.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
const root = 'docs/reports/sweep-c5/L9-04', path = `${root}/L9-04-review.json`;
const bytes = readFileSync(path), baseline = JSON.parse(bytes), identity = provenance(), hash = browserHash();
const sha = b => createHash('sha256').update(b).digest('hex');
const run = () => sweepC4L9RouteReceipts(identity.sourceHash, hash, root).flatMap(r => r.receipt.checks);
assert.equal(run().length, 4); assert(run().every(c => c.status === 'PASS'));
const cases = [];
for (const fault of ['stale-source','unseen-image','missing-high','unfinished','changed-start','missing-input','wrong-quality','console-error','safe-lower','wrong-contact-damage','duplicate-contact']) {
 const review = structuredClone(baseline), file = `${root}/L9-04-high-physical.json.gz`, original = readFileSync(file);
 try {
  const proof = JSON.parse(gunzipSync(original));
  if (fault === 'stale-source') proof.sourceHash = '0'.repeat(64);
  else if (fault === 'unseen-image') review.captures.forEach(c => c.seen = '');
  else if (fault === 'missing-high') proof.rows = [];
  else if (fault === 'unfinished') proof.rows[0].result.phase = 'driving';
  else if (fault === 'changed-start') proof.rows[0].setup.after -= 1;
  else if (fault === 'missing-input') proof.rows[0].commands = [];
  else if (fault === 'wrong-quality') proof.rows[0].setup.quality = 'low';
  else if (fault === 'console-error') proof.rows[0].errors.push('control');
  else if (fault === 'safe-lower') { proof.rows[0].result.preCrashDurability = 0; proof.rows[0].samples.at(-1).hp = 0; }
  else {
   const row = proof.rows.find(r => r.mode === 'shortcut');
   const hit = row.result.events.find(e => e.type === 'vehicle.durability-hit' && ['contact','attack'].includes(e.source));
   assert(hit, 'actual nonempty contact ledger');
   if (fault === 'wrong-contact-damage') hit.after = hit.before - 1;
   else row.result.events.push(structuredClone(hit));
  }
  const changed = gzipSync(JSON.stringify(proof), { mtime: 0 }); writeFileSync(file, changed);
  review.proofs.find(p => p.file === file).sha256 = sha(changed); writeFileSync(path, JSON.stringify(review));
  const checks = run(), rejected = checks.length !== 4 || checks.some(c => c.status !== 'PASS'); assert(rejected, fault);
  cases.push({ fault, rejected, checks: checks.map(c => ({ tier:c.tier, clause:c.clause, status:c.status })) });
 } finally { writeFileSync(file, original); writeFileSync(path, bytes); }
}
assert(run().length === 4 && run().every(c => c.status === 'PASS'));
writeFileSync(`${root}/coverage-proof.json`, JSON.stringify({ ...identity, method: 'Actual unchanged consumer; each semantic fault rehashed to prevent digest rejection masking semantic failures. All original evidence bytes restored.', cases }, null, 2)+'\n');
