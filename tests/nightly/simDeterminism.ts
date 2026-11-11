import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import baseline from './sim-determinism.baseline.json';

// Linux-generated sequence receipts run unchanged on Mac: every tick participates, including transient differences.
export function checkSimDeterminism(): void {
  const directory = mkdtempSync(join(tmpdir(), 'mi-determinism-'));
  try {
    for (const run of baseline.runs) {
      const output = join(directory, `${run.level}.json`);
      execFileSync(process.execPath, ['--import', 'tsx/esm', 'tools/sim-runner/hash-level.ts', '--level', run.level, '--ticks', String(run.ticks), '--seed', String(run.seed), '--quality', run.quality, '--policy', run.policy, '--out', output], { timeout: 600_000, stdio: 'pipe' });
      const receipt = JSON.parse(readFileSync(output, 'utf8')) as { hashes: { tick: number; exact: string }[] };
      assert.equal(receipt.hashes.length, run.samples, run.level);
      const digest = createHash('sha256').update(receipt.hashes.map(row => `${row.tick}:${row.exact}\n`).join('')).digest('hex');
      assert.equal(digest, run.sha256, `${run.level}: exact per-tick sequence`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
