import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { sweepC3L9Receipts } from './sweep-c3-l9-receipts.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

const path = 'docs/reports/sweep-c3/L9-05/qualification.json', original = readFileSync(path);
const baseline = JSON.parse(original.toString()), identity = provenance(), hash = browserHash();
const row = process.argv[2] ?? 'L9-05';
const sha = b => createHash('sha256').update(b).digest('hex');
const run = () => sweepC3L9Receipts(identity.sourceHash, hash).flatMap(r => r.receipt.checks).filter(c => c.id === row);
assert(run().length === 2 && run().every(c => c.status === 'PASS'));
const cases = [];
for (const fault of row === 'L9-07' ? ['duplicate-impact', 'early-objective', 'early-hud', 'missing-hull', 'missing-wheel', 'unfinished-drive', 'unseen-image', 'stale-source'] : ['positive-zero-hp', 'unfinished-drive', 'slow-speed', 'fast-speed', 'missing-smoke', 'unseen-image', 'stale-source', 'missing-high']) {
  const manifest = structuredClone(baseline);
  const key = fault === 'unseen-image' ? 'zeroReview' : fault.includes('speed') ? 'speed' : 'zero';
  const file = manifest[key].file, bytes = readFileSync(file);
  try {
    if (fault === 'missing-smoke') manifest.visual.smokeObserved = false;
    else {
      const candidate = JSON.parse((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString());
      if (fault === 'unseen-image') candidate.captures[0].seen = '';
      else if (fault === 'stale-source') candidate.sourceHash = '0'.repeat(64);
      else if (fault === 'missing-high') candidate.rows = candidate.rows.filter(r => r.tier !== 'high');
      else if (fault === 'positive-zero-hp') candidate.rows[0].samples[0].hp = 1;
      else if (fault === 'unfinished-drive') candidate.rows[0].samples.at(-1).phase = 'driving';
      else if (fault === 'duplicate-impact') candidate.rows[0].result.events.push(candidate.rows[0].result.events.find(e => e.name === 'l9.crash-impact'));
      else if (fault === 'early-objective') candidate.rows[0].result.events.find(e => e.id === 'reach-outskirts').tick = 0;
      else if (fault === 'early-hud') candidate.rows[0].samples[0].hud = 'Get clear of the wreck';
      else if (fault === 'missing-hull') candidate.rows[0].samples.find(s => s.phase === 'fall').vehiclePresent = false;
      else if (fault === 'missing-wheel') candidate.rows[0].samples.find(s => s.phase === 'fall').wheels = 0;
      else for (const row of candidate.rows.filter(r => r.mode === 'zero')) for (const sample of row.samples) sample.speed = fault === 'slow-speed' ? .01 : 100;
      const raw = Buffer.from(JSON.stringify(candidate)), changed = file.endsWith('.gz') ? gzipSync(raw, { mtime: 0 }) : raw;
      writeFileSync(file, changed); manifest[key].sha256 = sha(changed);
    }
    writeFileSync(path, JSON.stringify(manifest));
    const checks = run(), rejected = checks.length !== 2 || checks.some(c => c.status !== 'PASS');
    assert(rejected, fault); cases.push({ fault, rejected, checks: checks.map(c => ({ tier: c.tier, status: c.status })) });
  } finally { writeFileSync(file, bytes); writeFileSync(path, original); }
}
assert(readFileSync(path).equals(original));
assert(run().every(c => c.status === 'PASS'));
writeFileSync(`docs/reports/sweep-c3/${row}/coverage-proof.json`, JSON.stringify({ method: 'Actual production consumer; temporary source-bound evidence faults with updated artifact SHA must reject. Exact original manifest/artifact bytes restored in finally; no game changes.', cases }, null, 2) + '\n');
