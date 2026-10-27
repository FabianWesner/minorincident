import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, mkdirSync, writeFileSync, symlinkSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { delay } from './host';

/** The daemon must survive deletion of the worktree that first started it. */
function daemonRoot() {
  const source = resolve(import.meta.dirname, '../..');
  const common = dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: source, encoding: 'utf8' }).trim());
  const store = process.env.MI_WORKTREE_CACHE ?? resolve(common, '.mi-worktree-cache');
  const lock = readFileSync(resolve(source, 'package-lock.json'));
  const lockKey = createHash('sha256').update(lock).digest('hex');
  let deps = resolve(store, `node_modules-${lockKey}`, 'node_modules');
  if (!existsSync(deps)) {
    const mainLock = readFileSync(resolve(common, 'package-lock.json'));
    if (!lock.equals(mainLock)) throw new Error('Prepare shared dependencies first: sh tools/worktree-setup.sh');
    deps = resolve(common, 'node_modules');
  }
  const files = ['tools/browser-pool/daemon.ts', 'tools/browser-pool/host.ts', 'tools/mac-gpu-guard.py'];
  const hash = createHash('sha256').update(lock).update(process.versions.node);
  const contents = files.map(file => { const data = readFileSync(resolve(source, file)); hash.update(data); return data; });
  const target = resolve(store, 'browser-pool', hash.digest('hex').slice(0, 24));
  if (!existsSync(target)) {
    const temp = `${target}.${process.pid}.tmp`;
    mkdirSync(resolve(temp, 'tools/browser-pool'), { recursive: true });
    files.forEach((file, i) => writeFileSync(resolve(temp, file), contents[i]));
    writeFileSync(resolve(temp, 'package.json'), '{"type":"module"}\n');
    symlinkSync(deps, resolve(temp, 'node_modules'), 'dir');
    try { renameSync(temp, target); }
    catch (error) { rmSync(temp, { recursive: true, force: true }); if (!existsSync(target)) throw error; }
  }
  return target;
}

/** Concurrent starters race only for the HTTP port; Chrome is launched after bind. */
export async function ensurePool() {
  const url = process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329';
  const healthy = async () => {
    try { const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(700) }); return r.ok && (await r.json() as { protocol: number }).protocol === 1; }
    catch { return false; }
  };
  if (await healthy()) return;
  const port = new URL(url).port;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Remote pool unavailable; automatic startup is local only');
  const log = resolve(tmpdir(), 'mi-browser-pool.log'), fd = openSync(log, 'a');
  try {
    const cwd = daemonRoot();
    const child = spawn(process.execPath, ['--import', 'tsx', resolve(cwd, 'tools/browser-pool/daemon.ts')], {
      cwd, detached: true, stdio: ['ignore', fd, fd],
      env: { ...process.env, BROWSER_POOL_PORT: port || '4329', BROWSER_POOL: 'on', MI_E2E_LOCK_HELD: '', MI_BROWSER_POOL_EXCLUSIVE: '' },
    });
    child.unref();
  } finally { closeSync(fd); }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { if (await healthy()) return; await delay(100); }
  throw new Error(`Browser pool failed to start; see ${log}`);
}
