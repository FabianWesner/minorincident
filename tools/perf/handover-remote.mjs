// Build and run the level-handover spec in one remote job (tools/remote/run.sh runs a single command).
// Usage: node tools/perf/handover-remote.mjs  (HANDOVER_* environment as for the spec)
import { execSync } from 'node:child_process';
execSync('npm run build', { stdio: 'inherit' });
// The remote chromium project limits itself to e2e specs (MI_REMOTE=1 in playwright.config.ts); this perf spec is wanted here.
// Several jobs can share a runner: give each preview server its own port.
const port = process.env.E2E_PORT ?? String(3400 + (process.pid % 500));
execSync('npx playwright test tests/perf/level-handover.spec.ts --project=chromium --workers=1', { stdio: 'inherit', env: { ...process.env, MI_REMOTE: '', E2E_PORT: port } });
