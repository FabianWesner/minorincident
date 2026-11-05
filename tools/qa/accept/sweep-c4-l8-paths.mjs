import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

assert(['low', 'high'].includes(process.argv[2]), 'Supply one tier per pooled command');
const identity = provenance(), hash = browserHash(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryPath = 'docs/reports/fix55-c/L8-enclosure-paths.json', geometryBytes = readFileSync(geometryPath), geometry = JSON.parse(geometryBytes);
assert.equal(geometry.sourceHash, identity.sourceHash);
const out = resolve(`test-results/sweep-c4-l8-paths-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [], deadline = Date.now() + 540000;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* owned server */ } await delay(100); }
  for (const tier of [process.argv[2]]) {
    const seedPath = `docs/reports/sweep-c4/L8-07-actual-${tier}-campaign.json.gz`, seedBytes = readFileSync(seedPath), campaign = JSON.parse(gunzipSync(seedBytes).toString());
    const gates = geometry.rows.find(r => r.tier === tier).enclosures;
    const goals = gates.flatMap(enclosure => {
      const n = enclosure.gates.find(g => g.direction === 'north'), s = enclosure.gates.find(g => g.direction === 'south');
      return [n.outside, n.inside, n.start, n.inside, { ...n.outside, capture: `${enclosure.species}-north-exit` }, n.inside, n.start, s.inside, { ...s.outside, capture: `${enclosure.species}-south-exit` }];
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [], samples = [], commands = [], reached = [], captures = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const setup = await page.evaluate(async ({ campaign, tier }) => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause(); a.campaign.restore(campaign);
        await a.loadLevel('L8', { seed: 1 }); a.pause(); a.settings.set({ quality: tier }); a.missions.begin();
        a.cheats.god(true); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
        window.__pathWalk = { path: [], goal: -1, pathIndex: 0 };
        return { tick: a.tick(), backend: a.perf().backend, quality: a.getState().render.quality,
          roster: [...g.world.missions.l8.state.roster], apc: { ...g.world.missions.def.anchors.exit } };
      }, { campaign, tier });
      goals.push({ ...setup.apc, capture: 'fixed-apc' });
      await page.mouse.click(640, 360);
      let at = 0, held = [];
      for (let iteration = 0; iteration < 6000 && at < goals.length && Date.now() < deadline; iteration++) {
        const goal = goals[at];
        const sample = await page.evaluate(goal => {
          const w = window.__SCENE__.game.world, p = w.entities.get(1), m = w.missions;
          const next = { x: goal.x, z: goal.z };
          w.infected.nav.steer(p.transform, goal, window.__pathWalk, .45, next, Infinity, true);
          return { tick: w.tick, phase: m.state.phase, position: { ...p.transform }, hp: p.health.current, next,
            marker: m.state.marker, anchor: { ...m.def.anchors.exit }, camera: window.__SS__.getState().render.camera };
        }, goal);
        samples.push({ ...sample, goalIndex: at });
        if (Math.hypot(sample.position.x - goal.x, sample.position.z - goal.z) < .65) {
          reached.push({ index: at, goal, tick: sample.tick, position: sample.position });
          if (goal.capture) for (const zoom of [.5, 1.5]) {
            await page.evaluate(async z => { window.__SS__.camera.zoom(z); await window.__SS__.screenshotReady(); }, zoom);
            const file = resolve(out, `${tier}-${goal.capture}-z${zoom}.jpg`);
            await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
            captures.push({ file, sha256: sha(readFileSync(file)), tick: sample.tick, goalIndex: at, zoom, label: goal.capture });
          }
          at++; continue;
        }
        const dx = sample.next.x - sample.position.x, dz = sample.next.z - sample.position.z;
        const x = dx - dz, y = dx + dz, keys = [];
        if (Math.abs(x) > .15) keys.push(x > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(y) > .15) keys.push(y > 0 ? 'KeyS' : 'KeyW');
        for (const key of held.filter(k => !keys.includes(k))) await page.keyboard.up(key);
        for (const key of keys.filter(k => !held.includes(k))) await page.keyboard.down(key);
        held = keys; commands.push({ tick: sample.tick, keys, goalIndex: at });
        await page.evaluate(() => window.__SS__.step(6));
      }
      for (const key of held) await page.keyboard.up(key);
      if (at < goals.length) {
        const file = resolve(out, `${tier}-incomplete-goal-${at}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        captures.push({ file, sha256: sha(readFileSync(file)), tick: samples.at(-1)?.tick, goalIndex: at, label: 'incomplete' });
      }
      rows.push({ tier, setup, seed: { file: seedPath, sha256: sha(seedBytes) }, goals, reached, completed: at === goals.length, samples, commands, captures, errors });
      console.log(tier, { completed: at === goals.length, reached: at, goals: goals.length, last: samples.at(-1), captures: captures.length });
    } finally { await context.close(); }
  }
} finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c4/L8-07-${process.argv[2]}-physical.json`, JSON.stringify({ ...identity, browserHash: hash, toolSha256: sha(readFileSync(new URL(import.meta.url))),
    geometry: { file: geometryPath, sha256: sha(geometryBytes) }, out,
    method: 'Actual current physical L7 result campaign restored through production save API, then ordinary L8 constructor/Begin. Real physical WASD keys through each enclosure north and south exit, read-only production navigation selects steering waypoints. Normal NPC/outbreak AI and colliders; courier only protected. No actor writes, teleports, skips, count/timer/cap changes or performance timing. Separate1.25m-radius native clearance proof qualifies2.5m width.', rows }, null, 2) + '\n');
}
