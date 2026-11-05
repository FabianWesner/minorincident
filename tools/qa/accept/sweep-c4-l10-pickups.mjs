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
const nativePath = 'docs/reports/fix51-r10c/L10-pickups-proof.json', nativeBytes = readFileSync(nativePath), native = JSON.parse(nativeBytes);
assert.equal(native.sourceHash, identity.sourceHash);
assert.equal(native.toolSha256, sha(readFileSync('tools/qa/accept/l10-pickups-r10.ts')));
const source = native.rows.find(row => row.tier === tier); assert(source.controlIdentical);
const out = resolve(`test-results/sweep-c4/L10-05-${tier}-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* own preview starts */ } await delay(100); }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript('window.__name=f=>f');
    await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    for (const seed of source.physicalSeeds) {
      const bytes = readFileSync(seed.path); assert.equal(sha(bytes), seed.sha256);
      const campaign = JSON.parse(gunzipSync(bytes).toString());
      const setup = await page.evaluate(async ({ campaign, tier, checkpoint }) => {
        const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause(); a.campaign.restore(campaign);
        await a.loadLevel('L10', { seed: 1 }); a.pause(); a.settings.set({ quality: tier });
        a.cheats.god(true); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput(); a.camera.zoom(1);
        const w = g.world; window.__pickupProof = { events: [], births: [], inputs: [] };
        w.events.on('pickup.collected', event => window.__pickupProof.events.push(structuredClone(event)));
        const spawn = w.infected.spawn.bind(w.infected);
        w.infected.spawn = (...args) => { const id = spawn(...args); window.__pickupProof.births.push({ tick: w.tick, id, archetype: args[0] }); return id; };
        g.input.tap = frame => window.__pickupProof.inputs.push({ tick: w.tick, frame: structuredClone(frame) });
        return { tick: w.tick, backend: a.perf().backend, quality: a.getState().render.quality, anchor: { ...w.missions.def.anchors[checkpoint] } };
      }, { campaign, tier, checkpoint: seed.checkpoint });
      const sample = () => page.evaluate(() => {
        const w = window.__SCENE__.game.world, p = w.entities.get(1), snapshot = w.missions.saveResume().checkpoint;
        const racks = weapons => [...weapons.LEFT.rack, ...weapons.RIGHT.rack].map(slot => slot.id);
        return { tick: w.tick, position: { ...p.transform }, weapons: racks(p.weapons), checkpoint: w.missions.state.checkpoint,
          snapshot: { tick: snapshot.tick, checkpoint: snapshot.state.checkpoint, weapons: racks(snapshot.entities.find(actor => actor.id === 1).weapons) } };
      });
      const before = await sample(); assert(!before.weapons.includes(seed.weapon), 'Resume must precede pickup');
      const captures = [], commands = [];
      const capture = async label => { await page.evaluate(() => window.__SS__.screenshotReady()); const file = resolve(out, `${tier}-${seed.checkpoint}-${label}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 88 }); captures.push({ file, sha256: sha(readFileSync(file)), label }); };
      await capture('before'); let held = [], after = before;
      for (let i = 0; i < 120 && !after.weapons.includes(seed.weapon); i++) {
        const dx = setup.anchor.x - after.position.x, dz = setup.anchor.z - after.position.z, x = dx - dz, y = dx + dz, keys = [];
        if (Math.abs(x) > .05) keys.push(x > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(y) > .05) keys.push(y > 0 ? 'KeyS' : 'KeyW');
        for (const key of held.filter(key => !keys.includes(key))) await page.keyboard.up(key);
        for (const key of keys.filter(key => !held.includes(key))) await page.keyboard.down(key);
        held = keys; commands.push({ tick: after.tick, keys }); await page.evaluate(() => window.__SS__.step(6)); after = await sample();
      }
      for (const key of held) await page.keyboard.up(key);
      await capture('after'); const result = await page.evaluate(() => window.__pickupProof);
      rows.push({ tier, seed, setup, before, after, captures, commands, result, errors: [...errors] });
      console.log(tier, seed.checkpoint, { collected: after.weapons.includes(seed.weapon), checkpoint: after.checkpoint, snapshot: after.snapshot, births: result.births });
    }
  } finally { await context.close(); }
} finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c4/L10-05-${tier}-physical.json`, JSON.stringify({ ...identity, browserHash: hash, toolSha256: sha(readFileSync(new URL(import.meta.url))), native: { file: nativePath, sha256: sha(nativeBytes) }, out,
    method: 'Exact naturally reached native pre-pickup Resume snapshots through production campaign restore/load. Actual WASD approach, no interaction key or actor/objective writes. Courier protected only; ordinary actors and spawners. Read-only pickup/input/spawn event and same-tick checkpoint records. Focused regional approach capability, not a continuous physical finale.', rows }, null, 2) + '\n');
}
