#!/bin/sh
# Exit 0 while a GPU browser reservation is active; intended as a tiny runner probe.
url="${BROWSER_POOL_URL:-http://127.0.0.1:4329}"
if node --input-type=module - "$url" <<'NODE'
const url = process.argv[2];
try {
  const r = await fetch(`${url}/status`, { signal: AbortSignal.timeout(700) });
  if (!r.ok) process.exit(2);
  const s = await r.json();
  process.exit(s.browsers?.some(b => b.backend === 'gpu') || s.leases?.some(l => l.backend === 'gpu') || s.exclusive?.some(e => e.granted) ? 0 : 1);
} catch { process.exit(2); }
NODE
then exit 0; fi
# Pool down: legacy reservations hold one or more of the same machine-wide locks.
command -v lockf >/dev/null 2>&1 || exit 1
base="${E2E_LOCK:-/tmp/minor-incident-e2e.lock}"
for slot in 0 1 2 3; do
  lockf -k -t 0 "$base.$slot" true >/dev/null 2>&1
  rc=$?
  [ "$rc" -eq 75 ] && exit 0
  [ "$rc" -eq 0 ] || exit 1
done
exit 1
