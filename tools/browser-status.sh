#!/bin/sh
# Show active browser context holders and queued waiters from the local pool.
node --input-type=module - <<'NODE'
const url = process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329';
try {
  const response = await fetch(`${url}/status`, { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const s = await response.json();
  const queued = [...s.waiters, ...(s.starting ?? [])];
  console.log(`Browser pool pid=${s.pid} active=${s.leases.length} waiting=${queued.length} limit=${s.limit}/${s.configuredLimit}`);
  console.log('HOLDERS');
  if (!s.leases.length && !s.exclusive.some(e => e.granted)) console.log('  (none)');
  for (const e of s.exclusive.filter(e => e.granted)) console.log(`  exclusive job=${e.job ?? 'unknown'} lease=${e.id} held=${Math.round(e.heldMs / 1000)}s`);
  for (const h of s.leases) console.log(`  ${h.backend} job=${h.job ?? 'unknown'} lease=${h.id} context=${h.context ?? 'creating'} held=${Math.round((h.heldMs ?? 0) / 1000)}s idle=${Math.round(h.idle / 1000)}s`);
  console.log('WAITERS');
  if (!queued.length && !s.exclusive.some(e => !e.granted)) console.log('  (none)');
  for (const w of queued) console.log(`  ${w.backend} job=${w.job ?? 'unknown'} waiting=${Math.round(w.waitMs / 1000)}s`);
  for (const e of s.exclusive.filter(e => !e.granted)) console.log(`  exclusive job=${e.job ?? 'unknown'} waiting=${Math.round(e.waitMs / 1000)}s`);
} catch (error) { console.error(`Browser pool unavailable (${error.message}); use a browser command to start it.`); process.exit(1); }
NODE
