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

const tier = process.argv[2]; assert(['low', 'high'].includes(tier));
const identity = provenance(), hash = browserHash(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const nativePath = 'docs/reports/fix51-r10c/L10-cure-proof.json', nativeBytes = readFileSync(nativePath), native = JSON.parse(nativeBytes);
assert.equal(native.sourceHash, identity.sourceHash); assert.equal(native.toolSha256, sha(readFileSync('tools/qa/accept/l10-cure-r10.ts')));
const source = native.rows.find(row => row.tier === tier); assert(source.controlIdentical);
const seed = source.physicalSeed, seedBytes = readFileSync(seed.path); assert.equal(sha(seedBytes), seed.sha256);
const campaign = JSON.parse(gunzipSync(seedBytes).toString());
const out = resolve(`test-results/sweep-c4/L10-09-${tier}-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const captures = [], samples = [], commands = [], errors = []; let setup, result;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* own preview starts */ } await delay(100); }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.addInitScript('window.__name=f=>f');
    await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    setup = await page.evaluate(async ({ campaign, tier }) => {
      const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause(); a.campaign.restore(campaign);
      await a.loadLevel('L10', { seed: 1 }); a.pause(); a.settings.set({ quality: tier });
      a.cheats.god(true); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
      window.__cureWalk = { path: [], goal: -1, pathIndex: 0 }; window.__cureProof = { events: [], inputs: [] };
      g.input.tap = frame => window.__cureProof.inputs.push({ tick: a.tick(), frame: structuredClone(frame) });
      g.world.events.on('dialogue.line', event => window.__cureProof.events.push(structuredClone(event)));
      return { tick: a.tick(), backend: a.perf().backend, quality: a.getState().render.quality, anchors: structuredClone(g.world.missions.def.anchors) };
    }, { campaign, tier });
    const sample = () => page.evaluate(() => {
      const a = window.__SS__, w = window.__SCENE__.game.world, p = w.entities.get(1), m = w.missions, checkpoint = m.saveResume().checkpoint;
      const text = document.querySelector('[data-testid="mission-subtitle"]');
      return { tick: w.tick, position: { ...p.transform }, states: { ...m.state.states }, items: [...m.state.items], checkpoint: m.state.checkpoint,
        racks: { LEFT: p.weapons.LEFT.rack.map(slot => slot.id), RIGHT: p.weapons.RIGHT.rack.map(slot => slot.id) },
        saved: { tick: checkpoint.tick, carried: !!checkpoint.state.states['cure-carried'], items: [...checkpoint.state.items] },
        subtitle: text?.getClientRects().length ? text.textContent : '', quality: a.getState().render.quality, zoom: a.getState().render.camera.zoom };
    });
    const capture = async (stage, zoom) => {
      await page.evaluate(async zoom => { window.__SS__.camera.zoom(zoom); await window.__SS__.screenshotReady(); }, zoom);
      const state = await sample(); samples.push({ stage, ...state });
      const file = resolve(out, `${tier}-${stage}-z${zoom}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 88 }); captures.push({ file, sha256: sha(readFileSync(file)), stage, zoom, tick: state.tick });
    };
    const walk = async anchor => {
      let held = [], reached = false;
      try {
        for (let i = 0; i < 1800; i++) {
          const s = await page.evaluate(goal => {
            const w = window.__SCENE__.game.world, p = w.entities.get(1), next = { x: goal.x, z: goal.z };
            w.infected.nav.steer(p.transform, goal, window.__cureWalk, .45, next, Infinity, true);
            return { tick: w.tick, position: { ...p.transform }, next };
          }, anchor);
          if (Math.hypot(s.position.x - anchor.x, s.position.z - anchor.z) <= Math.max(.5, anchor.radius * .7)) { reached = true; break; }
          const dx = s.next.x - s.position.x, dz = s.next.z - s.position.z, x = dx - dz, y = dx + dz, keys = [];
          if (Math.abs(x) > .05) keys.push(x > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(y) > .05) keys.push(y > 0 ? 'KeyS' : 'KeyW');
          for (const key of held.filter(key => !keys.includes(key))) await page.keyboard.up(key);
          for (const key of keys.filter(key => !held.includes(key))) await page.keyboard.down(key);
          held = keys; commands.push({ tick: s.tick, keys }); await page.evaluate(() => window.__SS__.step(6));
        }
      } finally { for (const key of held) await page.keyboard.up(key); }
      assert(reached, 'Physical approach did not reach authored anchor');
    };
    const interact = async () => { commands.push({ key: 'KeyE', tick: await page.evaluate(() => window.__SS__.tick()) }); await page.keyboard.press('KeyE'); await page.evaluate(() => window.__SS__.step(2)); };
    await capture('initial', 1.5); await walk(setup.anchors['cure-terminal']); await interact();
    assert((await sample()).states['terminal-read']);
    for (const zoom of [.5, 1.5]) await capture('recording', zoom);
    await walk(setup.anchors['cure-canister']); await interact(); assert((await sample()).states['cure-carried']);
    for (const zoom of [.5, 1.5]) await capture('carried', zoom);
    await walk(setup.anchors['cure-research']); await page.evaluate(() => window.__SS__.step(2));
    assert.equal((await sample()).checkpoint, 'cure-research');
    for (const zoom of [.5, 1.5]) await capture('exit', zoom);
    result = await page.evaluate(() => window.__cureProof);
    console.log(tier, { captures: captures.length, samples, commands: commands.length });
  } finally { await context.close(); }
} catch (error) { errors.push(String(error)); }
finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c4/L10-09-${tier}-physical.json`, JSON.stringify({ ...identity, browserHash: hash, toolSha256: sha(readFileSync(new URL(import.meta.url))), native: { file: nativePath, sha256: sha(nativeBytes) }, seed, tier, setup, out, samples, commands, captures, result, errors,
    method: 'Exact naturally reached pre-recording production Resume. Actual WASD and E through terminal, canister and laboratory exit; camera-only PO zoom changes. Courier protected, ordinary NPCs/colliders, no actor/objective writes. Read-only actual rendered subtitle and carried item/racks/checkpoint/input evidence. Native full-route and matched item-only movement/death controls remain independent.', }, null, 2) + '\n');
}
process.exitCode = errors.length ? 1 : 0;
