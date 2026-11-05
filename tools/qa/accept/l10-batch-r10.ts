import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SAVE_KEY, validateSave } from '../../../src/sim/progression/Save';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const [tierArg, batchArg, saveArg] = process.argv.slice(2);
assert(batchArg && /^[a-z0-9-]+$/.test(batchArg));
const levelArg = 'L10';
assert(tierArg === 'low' || tierArg === 'high');
assert(['L7,L8', 'L8', 'L10'].includes(levelArg));
const levels = levelArg.split(','), identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
assert(saveArg, 'Supply the actual physical L10 production Resume save');
const save = JSON.parse(gunzipSync(readFileSync(saveArg)).toString());
assert(validateSave(save) && save.cureResume?.current);
const cell = `L10-${tierArg}-batch-${batchArg}`, out = resolve(`test-results/fix51-r10c/${cell}-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise<void>((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const address = socket.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const port = address.port; await new Promise<void>(ready => socket.close(() => ready()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const profile = join(out, 'profile'); mkdirSync(profile, { recursive: true });
writeProfile();
function writeProfile() {
  const storage = { cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] };
  writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify(storage));
}
let result: Awaited<ReturnType<typeof runSession>> | null = null, error: string | null = null;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned preview starts */ }
    await delay(100);
  }
  assert(ready, 'Owned preview must start');
  process.env.PLAYTEST_BACKEND = 'webgl2'; process.env.PLAYTEST_GOD = '1';
  process.env.PLAYTEST_NO_FRAME_TIMING = '1'; process.env.PLAYTEST_FRAME_GATE = '0'; process.env.PLAYTEST_CPU_PROFILE = '0';
  process.env.PLAYTEST_ACCEPTANCE_LEDGER = '1'; process.env.PLAYTEST_ACCEPTANCE_CAPTURES = '1';
  process.env.PLAYTEST_HANDOVER_AUDIT = '0'; process.env.PLAYTEST_AUDIO_CUES = '1';
  process.env.PLAYTEST_ACCEPTANCE_CAPTURE_TIERS = 'single';
  result = await runSession({ origin, out, levels, quality: tierArg, zoom: 1.5, heroine: 'female', entry: 'continue', profile, levelMinutes: 8,
    sampleSeconds: 480, saveOnYield: true, stopAfterLevel: false, tag: 'late-input', noSkip: true });
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
atomicJson(`docs/reports/fix51-r10c/${cell}-input.json`, { ...identity, browserHash: hash,
  seedSaveSha256: createHash('sha256').update(JSON.stringify(save)).digest('hex'),
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out, levels, tier: tierArg,
  method: 'Shared headless Metal WebGL2 physical WASD/mouse/mission UI; actual production Resume save from preceding physical slice. Protected courier, no objective skips or actor relocation. Read-only ledger; no frame timing. At bounded yield pause Settings saves live Resume snapshot. Each photo pauses and restores quality/zoom.', result, error });
console.log(cell, { result, error });
process.exitCode = error || result?.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind)) ? 1 : 0;
