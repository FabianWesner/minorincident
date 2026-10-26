// Keep lane timing beside disposable receipts, including failing and interrupted runs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';

const [lane, command, ...args] = process.argv.slice(2);
if (!lane || !command || !/^[\w-]+$/.test(lane)) throw new Error('Usage: test-lane.mjs <lane> <command> [args...]');
const revision = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
const startedAt = new Date().toISOString(), start = performance.now();
const result = spawnSync(command, args, { stdio: 'inherit' });
const exitCode = result.status ?? 1;
mkdirSync('test-results/timings', { recursive: true });
writeFileSync(`test-results/timings/${lane}.json`, JSON.stringify({
  lane, revision: process.env.MI_SOURCE_REVISION ?? (revision.status === 0 ? revision.stdout.trim() : null),
  startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - start,
  host: hostname(), command: [command, ...args], exitCode, signal: result.signal, error: result.error?.message,
}, null, 2) + '\n');
process.exitCode = exitCode;
