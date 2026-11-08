/** Physical L7 PO pass. Each case owns one pooled headless context and starts
 * through the normal menu. Gear variants are saved fixtures, never runtime edits. */
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gearTier, powerScore, preset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession } from '../playtest/session';
import { provenance } from './accept/probe';

const cases = [
  { name: 'fresh-high-gl', quality: 'high', backend: 'webgl2', zoom: 1, character: 'female', gear: null },
  { name: 'preset-low-gpu', quality: 'low', backend: 'webgpu', zoom: 1.5, character: 'male', gear: 4 },
  { name: 'gear0-low-gl', quality: 'low', backend: 'webgl2', zoom: 1, character: 'female', gear: 0 },
  { name: 'gear1-high-gpu', quality: 'high', backend: 'webgpu', zoom: 1.5, character: 'male', gear: 1 },
  { name: 'gear2-high-gl', quality: 'high', backend: 'webgl2', zoom: 1.5, character: 'female', gear: 2 },
  { name: 'gear3-low-gpu', quality: 'low', backend: 'webgpu', zoom: 1, character: 'male', gear: 3 },
] as const;
const selected = process.argv.slice(2);
const runs = cases.filter(c => !selected.length || selected.includes(c.name));
if (!runs.length || selected.some(name => !cases.some(c => c.name === name))) throw new Error('Unknown matrix case');
const root = resolve(process.env.PRE_UAT_L7_OUT ?? 'test-results/pre-uat-l7/physical-final'); mkdirSync(root, { recursive: true });
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string' || address.port === 3300) throw new Error('preview port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const build = { ...provenance(), indexSha256: sha(readFileSync('dist/index.html')) };
try {
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await fetch(origin)).ok; } catch { /* server startup */ }
    if (!ready) await new Promise(done => setTimeout(done, 100));
  }
  if (!ready) throw new Error('preview unavailable');
  for (const cell of runs) {
    const out = resolve(root, cell.name), profile = resolve(out, 'profile'); mkdirSync(profile, { recursive: true });
    const save = cell.gear === null ? null : preset('L7-default');
    if (save) {
      save.character = cell.character; save.settings.quality = cell.quality;
      if (cell.gear === 0) { save.ownedActions = ['weapon.bat']; save.upgrades = []; save.racks = { LEFT: ['weapon.bat'], RIGHT: ['weapon.kick'] }; }
      if (cell.gear === 1) { save.ownedActions = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun']; save.upgrades = []; }
      if (cell.gear === 2) save.upgrades = [];
      if (cell.gear === 3) {
        const choices = [...save.upgrades]; save.upgrades = [];
        while (gearTier(save) < 3 && choices.length) save.upgrades.push(choices.shift()!);
      }
      if (gearTier(save) !== cell.gear) throw new Error(`Wrong fixture gear ${cell.name}`);
      writeFileSync(resolve(out, 'save.json'), JSON.stringify(save));
      writeFileSync(resolve(profile, 'pool-storage.json'), JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
    }
    const identity = { ...build, cell, gear: save && gearTier(save), power: save && powerScore(save), ordinaryDamage: true, input: 'physical WASD/mouse; no skips', headless: true };
    writeFileSync(resolve(out, 'identity.json'), JSON.stringify(identity, null, 2));
    Object.assign(process.env, { PLAYTEST_BACKEND: cell.backend, PLAYTEST_GOD: '0', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single', PLAYTEST_SHOT_SECONDS: '15', PLAYTEST_L7_ROSTER_AUDIT: '1', PLAYTEST_AUDIO_CUES: '1', PLAYTEST_REVEAL_AUDIT: '1', PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_L7_DEPARTURE_CAPTURES: '1' });
    console.log(`[pre-uat-l7] ${cell.name}: begin`);
    try {
      const result = await runSession({ origin, out, levels: ['L7'], quality: cell.quality, zoom: cell.zoom, heroine: cell.character, entry: save ? 'continue' : 'debug', profile, levelMinutes: 9, sampleSeconds: 480, stopAfterLevel: true, tag: cell.name, noSkip: true });
      writeFileSync(resolve(out, 'result.json'), JSON.stringify(result, null, 2));
      console.log(`[pre-uat-l7] ${cell.name}: ${JSON.stringify(result.runs.map(r => ({ finished: r.finished, deaths: r.deaths, maxNoProgressSeconds: r.maxNoProgressSeconds })))}`);
    } catch (error) {
      writeFileSync(resolve(out, 'error.json'), JSON.stringify({ error: String(error) }));
      console.error(`[pre-uat-l7] ${cell.name}: ${String(error)}`);
    }
  }
} finally { server.kill('SIGTERM'); }
