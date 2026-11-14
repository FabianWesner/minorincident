/** Sequential SceneSession children share one serial, ten-minute pool reservation. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const modes = { L9: { level: 'L9', frames: 9000 }, 'l7-bus': { level: 'L7', frames: 1200 }, 'l4-parked': { level: 'L4', frames: 1200 }, 'l4-tank': { level: 'L4', frames: 1320 } };
const requested = process.argv[2] ?? 'all';
if (requested !== 'all' && !Object.hasOwn(modes, requested)) throw new Error('Expected all, L9, l7-bus, l4-parked or l4-tank');
const selected = requested === 'all' ? Object.keys(modes) as (keyof typeof modes)[] : [requested as keyof typeof modes];
if (!process.env.MI_BROWSER_POOL_EXCLUSIVE) throw new Error('Run through E2E_SERIAL=1 tools/e2e-lock.sh');
const out = 'test-results/s83-vehicleslide/campaign';
mkdirSync(out, { recursive: true });
let allPass = true;
for (const mode of selected) {
  const rows = [];
  for (const tier of ['high', 'low']) {
    const file = `${out}/${mode}-${tier}.json`;
    rmSync(file, { force: true });
    const start = Date.now();
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'tools/scenelab/vehicle-campaign-motion.ts'], {
      stdio: 'inherit', env: { ...process.env, REVIEW_LEVEL: modes[mode].level, REVIEW_FIXTURE: mode === 'L9' ? undefined : mode,
        REVIEW_TIER: tier, CAMPAIGN_MOTION_FRAMES: String(modes[mode].frames), CAMPAIGN_CAPTURE_FROM: mode === 'L9' ? '8885' : '120' },
    });
    let receipt: { sourceHash: string; sourceStable: boolean; pass: boolean } | undefined;
    try { receipt = JSON.parse(readFileSync(file, 'utf8')); } catch { /* Missing output cannot pass. */ }
    rows.push({ mode, tier, code: child.status, seconds: (Date.now() - start) / 1000, file,
      sourceHash: receipt?.sourceHash, pass: child.status === 0 && receipt?.sourceStable === true && receipt.pass === true });
  }
  const pass = rows.every(row => row.pass) && new Set(rows.map(row => row.sourceHash)).size === 1;
  writeFileSync(`${out}/${mode}-batch.json`, JSON.stringify({ pass, rows }, null, 2) + '\n');
  allPass &&= pass;
}
process.exitCode = allPass ? 0 : 1;
