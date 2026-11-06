import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { frameInterval, installFrameProbe } from '../../playtest/frames.ts';
import { markerWalkKeys } from '../../playtest/input.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

async function runTier(tier) {
assert(['low', 'high'].includes(tier));
const identity = provenance(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = 'docs/reports/fix72-c/L7-01/warm-diagnostic', out = resolve(`test-results/fix72-c/L7-01/${tier}-${Date.now()}`);
mkdirSync(root, { recursive: true }); mkdirSync(out, { recursive: true });
const seedFile = `docs/reports/fix51-r10c/L7-${tier}-carried-save.json.gz`, seed = readFileSync(seedFile), campaign = JSON.parse(gunzipSync(seed));
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], captures = []; let setup, result, gate;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch {} await delay(100); }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const timer = setTimeout(() => void context.close(), 120_000);
  try {
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(`window.__name=f=>f;(${installFrameProbe.toString()})(${frameInterval.toString()},0);`);
    await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    setup = await page.evaluate(async ({ campaign, tier }) => {
      const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause();
      a.campaign.restore(campaign); await a.loadLevel('L7', { seed: 1 }); a.pause();
      a.settings.set({ quality: tier, cameraShake: false, aimAssist: 'Off' });
      a.missions.begin(); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput(); a.camera.zoom(1.5);
      const w = g.world, p = w.entities.get(1), pickup = [...w.entities.iterate()].find(e => e.pickup?.actionId === 'weapon.rocket-launcher');
      window.__pickupProof = { events: [], inputs: [], beginAt: null, endAt: null, pickupId: pickup.id, builds: [], initialPerf: a.perf() };
      const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
      g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => { onBuild?.(builder, object); const path = []; for (let n = object.object; n; n = n.parent) path.push(n.name || n.type); window.__pickupProof.builds.push({ at: performance.now(), tick: w.tick, material: object.material.name || object.material.type, path, corpsePage: [...(object.object.parent?.chunks ?? [])].find(([, pages]) => pages.some(page => page.mesh === object.object))?.[0], source: { sun: g.view.lighting?.sun.visible, spot: g.view.lighting?.spot.visible, sunWeight: g.view.lighting?.sun.shadow.intensity, spotWeight: g.view.lighting?.spot.shadow.intensity }, actionMesh: g.view.actions?.projectiles.includes(object.object) ? 'projectile' : g.view.actions?.projectileExhausts.includes(object.object) ? 'exhaust' : null }); };
      const update = g.view.update.bind(g.view);
      g.view.update = (...args) => { const at = performance.now(); const value = update(...args); const ms = performance.now() - at; if (ms > 20) window.__pickupProof.builds.push({ kind: 'update', at, tick: w.tick, ms, updateCpuMs: g.view.updateCpuMs, renderCpuMs: g.view.renderCpuMs, simMs: g.simMs }); return value; };
      g.input.tap = f => window.__pickupProof.inputs.push({ tick: w.tick, move: { ...f.move }, interact: !!f.interact, mouseAttack: !!f.mouseAttack, driver: !!g.driver });
      for (const type of ['pickup.collected', 'combat.attack']) w.events.on(type, e => window.__pickupProof.events.push({ ...e, at: performance.now(), player: { ...p.transform }, moving: Math.hypot(w.inputFrame.move.x, w.inputFrame.move.z) > 0 }));
      return { tick: w.tick, player: { ...p.transform }, pickup: { id: pickup.id, position: { ...pickup.transform } }, initialRack: structuredClone(p.weapons.RIGHT.rack), backend: a.perf().backend, quality: a.getState().render.quality, god: !!w.combat.damage.god, driverDetached: !g.driver };
    }, { campaign, tier });
    await page.locator('canvas').first().focus();
    const dx = setup.pickup.position.x - setup.player.x, dz = setup.pickup.position.z - setup.player.z;
    const keys = markerWalkKeys((dx - dz) * 100, (dx + dz) * 100, 0);
    for (const key of keys) await page.keyboard.down(key);
    await page.evaluate(() => { window.__pickupProof.beginAt = performance.now(); window.__SS__.resume(); });
    await page.waitForFunction(() => window.__pickupProof.events.some(e => e.type === 'pickup.collected' && e.actionId === 'weapon.rocket-launcher'), undefined, { timeout: 10_000 });
    for (const key of keys) await page.keyboard.up(key);
    await page.keyboard.press('Digit7');
    const cursor = await page.evaluate(() => { const p = window.__SCENE__.game.world.entities.get(1).transform; return window.__SS__.input.project({ x: p.x - 8, z: p.z }, 'destination'); });
    assert(cursor && cursor.x > 0 && cursor.x < 1280 && cursor.y > 0 && cursor.y < 720);
    await page.mouse.move(cursor.x, cursor.y); await page.keyboard.down('ShiftLeft'); await page.mouse.down();
    await page.waitForFunction(() => window.__pickupProof.events.some(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher'));
    await page.mouse.up(); await page.keyboard.up('ShiftLeft');
    await page.waitForFunction(() => { const shot = window.__pickupProof.events.find(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher'); return performance.now() - shot.at >= 600; });
    result = await page.evaluate(() => { window.__pickupProof.endAt = performance.now(); window.__SS__.pause(); const w = window.__SCENE__.game.world; return { ...window.__pickupProof, frames: window.__playtestFrames, final: { pickupRemaining: !!w.entities.get(window.__pickupProof.pickupId), rack: structuredClone(w.entities.get(1).weapons.RIGHT.rack) } }; });
    const pickups = result.events.filter(e => e.type === 'pickup.collected' && e.actionId === 'weapon.rocket-launcher');
    const shots = result.events.filter(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher');
    assert.equal(pickups.length, 1); assert.equal(shots.length, 1); assert(pickups[0].moving && shots[0].tick > pickups[0].tick);
    assert(result.inputs.every(f => !f.driver && !f.interact));
    const eventFrames = event => result.frames.filter(f => f.playMs > 0 && f.at >= event.at - 100 && f.at - f.ms <= event.at + 250);
    const windows = [pickups[0], shots[0]].map(event => { const frames = eventFrames(event); assert(frames.length >= 3); return { event: event.type, tick: event.tick, samples: frames.length, maxMs: Math.max(...frames.map(f => f.playMs)) }; });
    gate = { distance: Math.hypot(dx, dz), windows, pass: Math.hypot(dx, dz) <= 5 && windows.every(w => w.maxMs <= 50) };
    assert(gate.pass, `L7-01 frame gate ${JSON.stringify(gate)}`);
  } finally { clearTimeout(timer); await context.close(); }
} catch (error) { errors.push(String(error)); }
finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`${root}/${tier}.json`, JSON.stringify({ ...identity, browserHash: browserHash(), toolSha256: sha(readFileSync(new URL(import.meta.url))), probeSha256: sha(readFileSync('tools/playtest/frames.ts')), seed: { file: seedFile, sha256: sha(seed) }, tier, setup, result, gate, captures, errors,
    method: 'Headless Metal WebGL2, sole quiet context. Authentic carried campaign; actual moving WASD auto-pickup without E, then physical Digit7/ShiftLMB first rocket. Unpaused production clock throughout measurement; no manual stepping, forced render, photos or weapon use before either event. Existing playtest frame probe records every RAF interval. Gate windows cover100ms before through250ms after each actual event; screenshots follow measurement. No actors, damage, timers or caps edited.' }, null, 2) + '\n');
}
console.log(tier, gate, errors); return errors.length > 0;
}
let failed = false;
for (const tier of process.argv[2] === 'both' ? ['low', 'high'] : [process.argv[2]]) failed = await runTier(tier) || failed;
process.exitCode = failed ? 1 : 0;
