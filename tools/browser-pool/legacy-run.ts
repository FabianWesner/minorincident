// The measurement baseline keeps one GPU Chrome total, while retaining the old
// whole-script reservation. It reserves all legacy slots so other lanes cannot race it.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { reserveLegacySlots, gpuAdmission } from './host';
const release = await reserveLegacySlots();
try {
  await gpuAdmission();
  if (process.env.BROWSER_POOL_ADMISSION_FILE) writeFileSync(process.env.BROWSER_POOL_ADMISSION_FILE, JSON.stringify({ at: Date.now() }));
  const env: NodeJS.ProcessEnv = { ...process.env, BROWSER_POOL: 'off', MI_E2E_LOCK_HELD: '1', MI_E2E_UNITS_HELD: '4' };
  delete env.MI_BROWSER_POOL; delete env.MI_BROWSER_POOL_WS;
  const child = spawn('python3', ['tools/browser-job.py', '--', ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.exitCode = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally { await release(); }
