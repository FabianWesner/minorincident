import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { poolEndpoint, poolUrl } from './client';
import { delay, gpuAdmission } from './host';
import { ensurePool } from './ensure';

const quiet = process.argv[2] === 'exclusive';
const command = process.argv.slice(3);
const migrated = command.some(arg => /(?:^|\/)(?:playwright|cli[.]js)$/.test(arg) || arg.endsWith('.ts') && (() => { try { return /(?:SceneSession|launchBrowser|launchProfile)/.test(readFileSync(arg, 'utf8')); } catch { return false; } })());
const exclusive = quiet || !migrated;
const capSeconds = Number(process.env.E2E_RESERVATION_SECONDS ?? 600);
if (!Number.isInteger(capSeconds) || capSeconds < 1 || capSeconds > 600) {
  console.error('Browser reservations must be 1–600 seconds; split batches longer than 10 minutes.'); process.exit(2);
}
let reservedAt = 0;
if (command.some(arg => arg === 'playwright' || /\/(?:playwright|playwright-core)(?:\/cli[.]js)?$/.test(arg) || /\/@playwright\/test\/cli[.]js$/.test(arg))) {
  for (let i = 0; i < command.length; i++) {
    const workers = command[i] === '--workers' ? command[++i] : command[i].startsWith('--workers=') ? command[i].slice('--workers='.length) : undefined;
    if ((command[i - 1] === '--workers' || workers !== undefined) && workers !== '1' && workers !== '2') {
      console.error('Playwright is limited to 1 or 2 workers on this machine'); process.exit(2);
    }
  }
}
if (!command.length) throw new Error('Pool wrapper needs a command');
const admissionMs = Number(process.env.E2E_ADMISSION_TIMEOUT_SECONDS ?? 1800) * 1000;
const deadline = Date.now() + admissionMs;
const cooldown = `${process.env.E2E_LOCK ?? '/tmp/minor-incident-e2e.lock'}.quiet-finished`;
let token: string | undefined, started = false, cancelled = false;
let child: ReturnType<typeof spawn> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
process.on('SIGINT', () => { cancelled = true; child?.kill('SIGINT'); });
process.on('SIGTERM', () => { cancelled = true; child?.kill('SIGTERM'); });
const request = async (path: string, method = 'GET') => {
  const r = await fetch(`${poolUrl()}${path}`, { method, signal: AbortSignal.timeout(path.endsWith('/external') ? Math.max(1, reservedAt + capSeconds * 1000 - Date.now() - 5000) : 3000) });
  if (!r.ok) throw new Error(`Pool ${path.split('?')[0]} returned ${r.status}`);
  return await r.json();
};
try {
  await ensurePool();
  if (exclusive) {
    while (quiet && !cancelled) {
      let last = 0; try { last = Number(readFileSync(cooldown, 'utf8')); } catch { /* first run */ }
      if (Date.now() / 1000 - last >= 60) break;
      if (Date.now() >= deadline) throw new Error('Exclusive cooldown exceeded admission deadline');
      await delay(1000);
    }
    if (cancelled) throw new Error('Exclusive admission cancelled');
    token = (await request(`/exclusive?job=${encodeURIComponent(process.env.MI_SLUG ?? process.cwd().split('/').at(-1) ?? '')}`, 'POST') as { id: string }).id;
    heartbeat = setInterval(() => { void request(`/exclusive/${token}`).catch(() => { cancelled = true; child?.kill('SIGTERM'); }); }, 5000);
    while (!cancelled) {
      const status = await request(`/exclusive/${token}?quiet=1`) as { granted: boolean; grantedAt?: number; conditions: { quiet: boolean; load: number[]; busy: unknown[] } };
      if (status.granted && !reservedAt) reservedAt = status.grantedAt ?? Date.now();
      if (Date.now() >= deadline || reservedAt && Date.now() - reservedAt >= capSeconds * 1000 - 5000) throw new Error('Exclusive quiet admission exceeded the 10-minute reservation cap');
      if (status.granted && (!quiet || status.conditions.quiet)) {
        if (process.env.PERF_CONDITIONS_LOG) appendFileSync(process.env.PERF_CONDITIONS_LOG, JSON.stringify({ at: new Date().toISOString(), pool: true, ...status.conditions }) + '\n');
        if (quiet) console.log('Quiet-run pool preflight: exclusive context admission; load < 3; no foreign headless Chrome, Blender, build or local Vitest.');
        break;
      }
      await delay(1000);
    }
    if (cancelled) throw new Error('Exclusive admission cancelled');
    process.env.MI_BROWSER_POOL_EXCLUSIVE = token;
    process.env.MI_PERF_LOCK_HELD = '1';
    if (!migrated) {
      await request(`/exclusive/${token}/external`, 'POST');
      process.env.BROWSER_POOL = 'off';
      process.env.MI_E2E_LOCK_HELD = '1';
      process.env.MI_BROWSER_POOL_EXTERNAL = '1';
      await gpuAdmission(Math.max(1, reservedAt + capSeconds * 1000 - Date.now() - 5000));
    }
  }
  if (migrated || !exclusive) {
    process.env.MI_BROWSER_POOL = '1';
    const endpoint = await poolEndpoint();
    if (!endpoint) throw new Error('Pool disappeared after wrapper admission');
    process.env.MI_BROWSER_POOL_WS = endpoint;
  }
  if (cancelled) throw new Error('Browser admission cancelled');
  started = true;
  const remaining = capSeconds - (reservedAt ? Math.ceil((Date.now() - reservedAt) / 1000) : 0);
  const args = ['tools/browser-job.py', '--seconds', String(Math.max(1, remaining - 5)), '--', ...command];
  child = spawn('python3', args, { stdio: 'inherit', env: { ...process.env, MI_E2E_JOB_HELD: '1' } });
  process.exitCode = await new Promise<number>((resolve, reject) => { child!.once('error', reject); child!.once('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1))); });
} catch (error) { console.error(String(error)); process.exitCode = 75; }
finally {
  if (heartbeat) clearInterval(heartbeat);
  if (token) await request(`/exclusive/${token}/release`, 'POST').catch(error => { console.error(String(error)); process.exitCode ||= 1; });
  if (quiet && started) writeFileSync(cooldown, String(Math.floor(Date.now() / 1000)) + '\n');
}
