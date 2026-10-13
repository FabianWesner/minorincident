import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('remote cache GC removes inactive caches while retaining current caches and live jobs', () => {
  const root = mkdtempSync(join(tmpdir(), 'mi-cache-gc-'));
  try {
    const ws = join(root, 'ws'), jobs = join(root, 'jobs'), proc = join(root, 'proc');
    const current = join(ws, 'current'), stale = join(ws, 'stale'), active = join(ws, 'active');
    const idleJob = join(jobs, 'stale-123'), liveJob = join(jobs, 'active-456');
    const age = new Date(Date.now() - 3 * 3600_000);
    for (const dir of [current, stale, active, idleJob, liveJob, join(proc, '42')]) {
      mkdirSync(dir, { recursive: true }); utimesSync(dir, age, age);
    }
    symlinkSync(liveJob, join(proc, '42', 'cwd'));
    const source = readFileSync('tools/remote/run.sh', 'utf8');
    const assignment = source.split('\n').find(line => line.startsWith('GC='))!
      .replaceAll('/srv/mi/ws', ws).replaceAll('/srv/mi/jobs', jobs).replaceAll('/proc/', `${proc}/`);
    const quote = source.split('\n').find(line => line.startsWith('sq()'))!;
    // Deterministic free space keeps this focused on stale-cache retention.
    const shell = `df() { printf 'Filesystem blocks used available capacity mount\\nfixture 30000000 1000000 29000000 4%% /\\n'; }\n${quote}\nCACHE=$1\n${assignment}\neval "$GC"`;
    execFileSync('sh', ['-c', shell, 'sh', current]);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(current)).toBe(true);
    expect(existsSync(active)).toBe(true);
    expect(existsSync(idleJob)).toBe(true);
    expect(existsSync(liveJob)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
