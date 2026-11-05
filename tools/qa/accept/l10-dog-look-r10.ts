import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync, copyFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SAVE_KEY, validateSave } from '../../../src/sim/progression/Save';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

// runSession uses launchProfile; the shared-pool wrapper admits one pooled context.

const [tierArg, zoomArg] = process.argv.slice(2);
assert(zoomArg === '0.5' || zoomArg === '1.5');
const saveArg = `docs/reports/fix51-r10c/L10-${tierArg}-dog-save.json.gz`;
const levelArg = 'L10';
assert(tierArg === 'low' || tierArg === 'high');
assert(['L7,L8', 'L8', 'L10'].includes(levelArg));
const levels = levelArg.split(','), identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
assert(saveArg, 'Supply the actual physical L10 production Resume save');
const save = JSON.parse(gunzipSync(readFileSync(saveArg)).toString());
assert(validateSave(save) && save.cureResume?.current);
// Production Resume also restores photo framing. Visible-only mode leaves
// that framing alone; change only this camera field, never actor state.
save.cureResume.cameraZoom = Number(zoomArg);
const cell = `L10-${tierArg}-dog-z${zoomArg}`, out = resolve(`test-results/fix51-r10c/${cell}-${Date.now()}`);
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
  process.env.PLAYTEST_ACCEPTANCE_LEDGER = '1'; process.env.PLAYTEST_ACCEPTANCE_CAPTURES = '0';
  process.env.PLAYTEST_VISIBLE_ONLY = '1';
  const control = join(out, 'control.json'); process.env.PLAYTEST_CONTROL_FILE = control;
  writeFileSync(control, JSON.stringify({ manual: true }));
  process.env.PLAYTEST_HANDOVER_AUDIT = '0'; process.env.PLAYTEST_AUDIO_CUES = '1';
  process.env.PLAYTEST_ACCEPTANCE_CAPTURE_TIERS = 'single';
  let finished = false, released = false, shots = 0, lastLatestMtime = 0;
  const manualDeadline = Date.now() + 40000;
  const live = runSession({ origin, out, levels, quality: tierArg, zoom: Number(zoomArg), heroine: 'female', entry: 'continue', profile, levelMinutes: 1,
    sampleSeconds: 15, stopAfterLevel: false, tag: 'dog-look', noSkip: true }).finally(() => { finished = true; });
  while (!finished) {
    const latestPhoto = join(out, 'latest.jpg');
    if (existsSync(latestPhoto)) {
      const mtime = statSync(latestPhoto).mtimeMs;
      if (mtime !== lastLatestMtime) { lastLatestMtime = mtime; copyFileSync(latestPhoto, join(out, 'captures', `live-${mtime}.jpg`)); }
    }
    const latest = join(out, 'latest.json');
    if (existsSync(latest) && !existsSync(control) && shots < 3) {
      let observation;
      try { observation = JSON.parse(readFileSync(latest, 'utf8')); } catch { await delay(50); continue; }
      if (observation.level === 'L10' && observation.phase === 'playing' && observation.enemies.some((enemy: { archetype: string; drawn: boolean; hp: number; d: number }) => enemy.archetype === 'infected.dog' && enemy.drawn && enemy.hp > 0 && enemy.d < 3)) {
        writeFileSync(control, JSON.stringify({ manual: true, keys: shots === 0 ? ['a'] : [], ms: 150, capture: `living-dog-${shots++}` }));
      }
    }
    if (!released && !existsSync(control) && (shots >= 3 || Date.now() >= manualDeadline)) {
      writeFileSync(control, JSON.stringify({ manual: false })); released = true;
    }
    await delay(100);
  }
  result = await live;
  // Retain the final preview for the same personal review and hash cleanup as captures.
  assert(shots > 0, 'Need actual living dog near the courier in camera');
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
atomicJson(`docs/reports/fix51-r10c/${cell}-input.json`, { ...identity, browserHash: hash,
  zoom: Number(zoomArg), seedSaveSha256: createHash('sha256').update(JSON.stringify(save)).digest('hex'),
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out, levels, tier: tierArg,
  method: 'Shared headless Metal WebGL2, native-generated naturally progressed production Resume; only saved cameraZoom changed to requested photo framing. No objective skips or actor writes. Stand for dog approach then physical A key sidestep and screenshots; courier protection begins when the normal run initializes. Read-only ledger. Living appearance only, native mechanics fixtures remain separate. Every overwritten latest image copied for inspection. No frame timing.', result, error });
console.log(cell, { result, error });
process.exitCode = error || result?.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind)) ? 1 : 0;
