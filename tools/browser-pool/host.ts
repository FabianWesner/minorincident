import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { loadavg } from 'node:os';

const exec = promisify(execFile);
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Hold every legacy slot while the daemon owns any Chrome process. */
export async function reserveLegacySlots(): Promise<() => Promise<void>> {
  if (process.platform !== 'darwin') return async () => {};
  const base = process.env.E2E_LOCK ?? '/tmp/minor-incident-e2e.lock';
  const deadline = Date.now() + Number(process.env.BROWSER_POOL_WAIT_MS ?? 1_800_000);
  while (Date.now() < deadline) {
    const command = ['-k', '-t', '0', `${base}.0`, 'lockf', '-k', '-t', '0', `${base}.1`, 'lockf', '-k', '-t', '0', `${base}.2`, 'lockf', '-k', '-t', '0', `${base}.3`, process.execPath, '-e', 'process.stdout.write("locked\\n");process.stdin.resume()'];
    const child: ChildProcess = spawn('lockf', command, { stdio: ['pipe', 'pipe', 'inherit'] });
    const locked = await new Promise<boolean>((resolve, reject) => {
      child.once('error', reject); child.stdout!.once('data', () => resolve(true)); child.once('exit', () => resolve(false));
    });
    if (locked) return async () => {
      if (child.exitCode !== null) return;
      const ended = new Promise<void>(resolve => child.once('exit', () => resolve()));
      child.stdin!.end(); await ended;
    };
    await delay(500);
  }
  throw new Error('Pool could not reserve the legacy browser slots before admission deadline');
}

export async function gpuAdmission(): Promise<void> {
  if (process.platform !== 'darwin') return;
  const deadline = Date.now() + Number(process.env.BROWSER_POOL_WAIT_MS ?? 1_800_000);
  while (true) {
    try { await exec('python3', ['tools/mac-gpu-guard.py', '1'], { env: { ...process.env, MI_GPU_BROWSER_LIMIT: '1' } }); return; }
    catch (error) {
      if ((error as { code?: number }).code !== 75 || Date.now() >= deadline) throw error;
      await delay(1000);
    }
  }
}

export async function quietConditions(owned: Set<number>) {
  const { stdout } = await exec('ps', ['-axo', 'pid=,ppid=,command=']);
  const processes = stdout.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line); return m ? [{ pid: Number(m[1]), parent: Number(m[2]), command: m[3] }] : [];
  });
  // Include descendants of the pool's own browser roots, never foreign processes.
  const ours = new Set(owned);
  let count = -1;
  while (ours.size !== count) { count = ours.size; for (const p of processes) if (ours.has(p.parent)) ours.add(p.pid); }
  const busy = processes.filter(p => !ours.has(p.pid) && (
    (/^\/.*(?:chrome-headless-shell|headless_shell|Google Chrome|Chromium)/.test(p.command) && !p.command.includes('--type=') && /headless/.test(p.command)) ||
    /^(?:\/[^ ]*\/)?(?:node|Blender|blender)(?: |$)/.test(p.command) && /(?:vitest|vite (?:build)|blender|Blender)/.test(p.command)
  ));
  return { quiet: loadavg()[0] < 3 && busy.length === 0, load: loadavg(), busy: busy.map(p => ({ pid: p.pid, command: p.command.slice(0, 180) })) };
}

export async function windowServerSnapshot(): Promise<{ pid: number; seconds: number } | undefined> {
  if (process.platform !== 'darwin') return undefined;
  const { stdout } = await exec('ps', ['-axo', 'pid=,time=,command=']);
  for (const line of stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\S+)\s+(.*\/WindowServer(?:\s.*)?)$/.exec(line);
    if (!m) continue;
    const [days, time] = m[2].includes('-') ? m[2].split('-') : ['0', m[2]];
    return { pid: Number(m[1]), seconds: Number(days) * 86400 + time.split(':').reduce((n, part) => n * 60 + Number(part), 0) };
  }
  return undefined;
}

export function backoffAdmission(state: { limit: number; coolSamples: number }, maximum: number, cpu: number) {
  if (!Number.isFinite(cpu) || cpu < 0) return { limit: 1, coolSamples: 0 };
  if (cpu > 60) return { limit: Math.max(1, state.limit - 1), coolSamples: 0 };
  if (cpu >= 30) return { limit: state.limit, coolSamples: 0 };
  if (state.coolSamples + 1 >= 3) return { limit: Math.min(maximum, state.limit + 1), coolSamples: 0 };
  return { limit: state.limit, coolSamples: state.coolSamples + 1 };
}
