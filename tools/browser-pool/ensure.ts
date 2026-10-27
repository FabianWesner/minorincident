import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { delay } from './host';

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
    const child = spawn(process.execPath, ['--import', 'tsx', resolve(import.meta.dirname, 'daemon.ts')], {
      cwd: resolve(import.meta.dirname, '../..'), detached: true, stdio: ['ignore', fd, fd],
      env: { ...process.env, BROWSER_POOL_PORT: port || '4329', BROWSER_POOL: 'on', MI_E2E_LOCK_HELD: '', MI_BROWSER_POOL_EXCLUSIVE: '' },
    });
    child.unref();
  } finally { closeSync(fd); }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { if (await healthy()) return; await delay(100); }
  throw new Error(`Browser pool failed to start; see ${log}`);
}
