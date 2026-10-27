#!/bin/sh
# Show active browser context holders and queued waiters from the local pool.
root=$(cd "$(dirname "$0")/.." && pwd)
node --input-type=module - "$root" <<'NODE'
const root = process.argv[2];
const url = process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329';
try {
  const response = await fetch(`${url}/status`, { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const s = await response.json();
  console.log(`Browser pool pid=${s.pid} active=${s.leases.length} waiting=${s.waiting} limit=${s.limit}/${s.configuredLimit}`);
  console.log('HOLDERS');
  if (!s.leases.length) console.log('  (none)');
  for (const h of s.leases) console.log(`  ${h.backend} job=${h.job ?? 'unknown'} lease=${h.id} context=${h.context ?? 'creating'} idle=${Math.round(h.idle / 1000)}s`);
  console.log('WAITERS');
  if (!s.waiters.length) console.log('  (none)');
  for (const w of s.waiters) console.log(`  ${w.backend} job=${w.job ?? 'unknown'} waiting=${Math.round(w.waitMs / 1000)}s`);
} catch (error) { console.error(`Browser pool unavailable (${error.message}); use a browser command to start it.`); process.exit(1); }
NODE
