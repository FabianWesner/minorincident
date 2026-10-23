import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { poolEndpoint, poolUrl } from './client';
import { delay } from './host';

const exclusive = process.argv[2] === 'exclusive';
const command = process.argv.slice(3);
const migrated = command.some(arg => /(?:^|\/)(?:playwright|cli[.]js)$/.test(arg) || /tools\/(?:playtest|scenelab)\//.test(arg) || arg === 'tools/qa/ab.ts' || arg.endsWith('.ts') && (() => { try { return /(?:SceneSession|launchBrowser)/.test(readFileSync(arg, 'utf8')); } catch { return false; } })());
if (!command.length) throw new Error('Pool wrapper needs a command');
const admissionMs = Number(process.env.E2E_ADMISSION_TIMEOUT_SECONDS ?? 1800) * 1000;
const deadline = Date.now() + admissionMs;
const cooldown = `${process.env.E2E_LOCK ?? '/tmp/minor-incident-e2e.lock'}.quiet-finished`;
let token: string | undefined, started = false, cancelled = false;
let child: ReturnType<typeof spawn> | undefined;
process.on('SIGINT', () => { cancelled = true; child?.kill('SIGINT'); });
process.on('SIGTERM', () => { cancelled = true; child?.kill('SIGTERM'); });
const request = async (path: string, method = 'GET') => {
  const r = await fetch(`${poolUrl()}${path}`, { method, signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`Pool ${path.split('?')[0]} returned ${r.status}`);
  return await r.json();
};
try {
  if (exclusive) {
    while (!cancelled) {
      let last = 0; try { last = Number(readFileSync(cooldown, 'utf8')); } catch { /* first run */ }
      if (Date.now() / 1000 - last >= 60) break;
      if (Date.now() >= deadline) throw new Error('Exclusive cooldown exceeded admission deadline');
      await delay(1000);
    }
    if (cancelled) throw new Error('Exclusive admission cancelled');
    token = (await request('/exclusive', 'POST') as { id: string }).id;
    let heldAt = 0;
    while (!cancelled) {
      const status = await request(`/exclusive/${token}?quiet=1`) as { granted: boolean; conditions: { quiet: boolean; load: number[]; busy: unknown[] } };
      if (status.granted && !heldAt) heldAt = Date.now();
      if (Date.now() >= deadline || heldAt && Date.now() - heldAt > 1_195_000) throw new Error('Exclusive quiet admission exceeded deadline');
      if (status.granted && status.conditions.quiet) {
        if (process.env.PERF_CONDITIONS_LOG) appendFileSync(process.env.PERF_CONDITIONS_LOG, JSON.stringify({ at: new Date().toISOString(), pool: true, ...status.conditions }) + '\n');
        console.log('Quiet-run pool preflight: exclusive context admission; load < 3; no foreign headless Chrome, Blender, build or local Vitest.');
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
    }
  }
  if (migrated || !exclusive) {
    process.env.MI_BROWSER_POOL = '1';
    const endpoint = await poolEndpoint();
    if (!endpoint) throw new Error('Pool disappeared after wrapper admission');
    process.env.MI_BROWSER_POOL_WS = endpoint;
  }
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  if (token) heartbeat = setInterval(() => { void request(`/exclusive/${token}`).catch(() => child?.kill('SIGTERM')); }, 5000);
  started = true;
  try {
    const args = ['tools/browser-job.py', ...(exclusive ? ['--seconds', '1195'] : []), '--', ...command];
    child = spawn('python3', args, { stdio: 'inherit', env: { ...process.env, MI_E2E_JOB_HELD: '1' } });
    process.exitCode = await new Promise<number>((resolve, reject) => { child!.once('error', reject); child!.once('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1))); });
  } finally { if (heartbeat) clearInterval(heartbeat); }
} catch (error) { console.error(String(error)); process.exitCode = 75; }
finally {
  if (token) await request(`/exclusive/${token}/release`, 'POST').catch(error => { console.error(String(error)); process.exitCode ||= 1; });
  if (exclusive && started) writeFileSync(cooldown, String(Math.floor(Date.now() / 1000)) + '\n');
}
