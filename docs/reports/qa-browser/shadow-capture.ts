/** Native visual probes need one exclusive pool context, without a performance quiet window.
 * Use the daemon's existing reservation/heartbeat API; Chromium stays owned by the pool. */
import { ensurePool } from '../../../tools/browser-pool/ensure';
import { poolUrl } from '../../../tools/browser-pool/client';

await ensurePool();
async function request(path: string, method = 'GET'): Promise<{ id: string; granted?: boolean }> {
  const response = await fetch(`${poolUrl()}${path}`, { method, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error(`Browser reservation ${response.status}`);
  return response.json();
}
const reservation = await request('/exclusive?job=r12-shadow-b', 'POST');
let heartbeatError: unknown;
const heartbeat = setInterval(() => { void request(`/exclusive/${reservation.id}`).catch(error => { heartbeatError = error; }); }, 5000);
try {
  const deadline = Date.now() + 30 * 60_000;
  while (!(await request(`/exclusive/${reservation.id}`)).granted) {
    if (heartbeatError) throw heartbeatError;
    if (Date.now() > deadline) throw Error('Exclusive browser admission exceeded 30 minutes');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.env.MI_BROWSER_POOL = '1';
  process.env.MI_BROWSER_POOL_EXCLUSIVE = reservation.id;
  process.env.BROWSER_POOL_JOB_ID = 'r12-shadow-b';
  console.log('[r12] one exclusive pool browser admitted (10-minute daemon cap)');
  await import('./shadow-audit');
} finally {
  clearInterval(heartbeat);
  await request(`/exclusive/${reservation.id}/release`, 'POST').catch(() => {});
}
