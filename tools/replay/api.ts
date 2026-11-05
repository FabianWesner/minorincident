import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Read access to the telemetry API (GET /api/stats, /api/replays). The token never gets printed. */
export const defaultBase = process.env.MI_BASE_URL ?? 'https://minor-incident.com';

function envFiles(): string[] {
  const files = [resolve('.env')];
  try { files.push(resolve(dirname(resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim())), '.env')); } catch { /* not a git checkout */ }
  return files;
}
export function readToken(): string {
  if (process.env.TELEMETRY_READ_TOKEN) return process.env.TELEMETRY_READ_TOKEN;
  for (const file of envFiles()) {
    if (!existsSync(file)) continue;
    const match = /^TELEMETRY_READ_TOKEN=(.+)$/m.exec(readFileSync(file, 'utf8'));
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
  }
  throw new Error('TELEMETRY_READ_TOKEN not found (set it in the environment or in the repo .env)');
}

export async function api(path: string, base = defaultBase): Promise<Response> {
  const response = await fetch(`${base}/api/${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(readToken())}`);
  if (!response.ok) throw new Error(`GET /api/${path.split('?')[0]} failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response;
}

/** A replay bundle: the gzip chunks exactly as stored, base64, so it can be saved and replayed offline. */
export interface ReplayBundle { version: 1; id: string; base: string; chunks: string[] }
export async function downloadBundle(id: string, base = defaultBase): Promise<ReplayBundle> {
  const detail = await (await api(`replays?id=${id}`, base)).json() as { chunks: { n: number }[] };
  const chunks: string[] = [];
  for (const { n } of detail.chunks) chunks.push(Buffer.from(await (await api(`replays?id=${id}&chunk=${n}`, base)).arrayBuffer()).toString('base64'));
  if (!chunks.length) throw new Error(`Replay ${id} has no chunks`);
  return { version: 1, id, base, chunks };
}
