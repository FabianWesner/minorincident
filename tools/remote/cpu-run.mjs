// Vitest 5's public pool API: finish active files, gate each new worker/file.
// Keep the normal config, reporters, CLI filters, and exit status.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// run.sh may live in another lane with a different node_modules installation.
const fromWorktree = createRequire(resolve('package.json'));
const { parseCLI, createVitest, ThreadsPoolWorker } = await import(pathToFileURL(fromWorktree.resolve('vitest/node')).href);

const exec = promisify(execFile);
const probe = fileURLToPath(new URL('./local-slot.py', import.meta.url));
const { filter, options } = parseCLI(['vitest', ...process.argv.slice(2)]);
let preparing = true;
let active = 0, yielded = false, firstFile = true, sample;
function title() {
  // Existing legacy and pooled quiet-run preflights recognize active Vitest.
  // Once the last file drains, only an idle coordinator remains, allowing quiet
  // preflight to proceed while browser locks keep subsequent workers waiting.
  process.title = active || preparing ? 'node node_modules/.bin/vitest [Mac CPU files]' : 'mi-local-cpu-yielded';
  if (process.env.MI_LOCAL_STATE) writeFileSync(process.env.MI_LOCAL_STATE, JSON.stringify({
    lane: process.env.MI_LOCAL_LANE, pid: process.pid, phase: active || preparing ? 'running' : 'yielded', files: active,
  }) + '\n');
}
async function gate(alive) {
  preparing = false; title();
  for (;;) {
    if (!alive()) return false;
    // Share concurrent probes, but never cache a clear result across files.
    sample ??= exec('python3', ['-I', probe, 'file-admit'], { env: { ...process.env, E2E_LOCK: process.env.MI_LOCAL_HOST_LOCK ?? process.env.E2E_LOCK } }).then(() => true, () => false)
      .finally(() => { sample = undefined; });
    if (await sample) {
      if (yielded) console.log('[local] resuming file admission');
      yielded = false; return alive();
    }
    if (!yielded) console.log('[local] yielding; current files drain, new files wait for GPU/quiet-run');
    yielded = true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
class AdmittedWorker extends ThreadsPoolWorker {
  counted = false;
  closed = false;
  finish = () => {
    if (this.counted) { this.counted = false; active--; title(); }
  };
  async start() {
    await super.start();
    super.on('message', message => {
      if (message?.type === 'testfileFinished') this.finish();
    });
  }
  send(message) {
    if (message.type === 'run' || message.type === 'collect') {
      // Gate the run message, after Vitest's worker-start handshake. Waiting in
      // start() would trip Vitest's 90-second startup timeout during long GPU jobs.
      void gate(() => !this.closed).then(allowed => {
        if (!allowed) return;
        active++; this.counted = true; title();
        if (firstFile) { firstFile = false; console.log('[local] first file started'); }
        super.send(message);
      });
    } else {
      if (message.type === 'stop') this.closed = true;
      super.send(message);
    }
  }
  async stop() {
    this.closed = true;
    try { await super.stop(); }
    finally { this.finish(); }
  }
}
const pool = { name: 'mi-local-cpu', createPoolWorker: opts => new AdmittedWorker(opts) };
title();
process.env.TEST = 'true';
process.env.VITEST = 'true';
process.env.NODE_ENV ??= 'test';
const maximum = Math.min(Number(options.maxWorkers) || 4, 4);
const ctx = await createVitest({
  ...options, run: true, watch: false, maxWorkers: maximum,
  isolate: true, minWorkers: 1, pool, configLoader: options.configLoader ?? 'runner',
});
try {
  // CLI pool objects apply to the root, but declared projects may retain their
  // own built-in pool. Configure every resolved project before scheduling files.
  for (const project of new Set([ctx.getRootProject(), ...ctx.projects])) {
    project.config.pool = pool.name;
    project.config.poolRunner = pool;
    project.config.isolate = true; // One file per run message, even for serial projects.
    project.config.maxWorkers = Math.min(project.config.maxWorkers || maximum, maximum);
  }
  await ctx.start(filter);
  if (ctx.state.getCountOfFailedTests() || ctx.state.getUnhandledErrors().length) process.exitCode = 1;
} finally {
  await ctx.close();
  preparing = false; title();
}
