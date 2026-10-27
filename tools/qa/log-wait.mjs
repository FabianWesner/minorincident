import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [kind, startedText] = process.argv.slice(2);
if (!kind || !startedText) process.exit(2);
const started = Number(startedText), acquired = Date.now();
let lane = process.env.MI_SLUG ?? process.env.LANE ?? process.cwd().split('/').at(-1) ?? 'unknown';
try { if (!process.env.MI_SLUG && !process.env.LANE) lane = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || lane; } catch {}
const path = `${process.env.TMPDIR ?? '/tmp'}/mi-waits.jsonl`;
appendFileSync(path, JSON.stringify({ at: new Date(acquired).toISOString(), lane, kind, waitMs: Math.max(0, acquired - started) }) + '\n');
