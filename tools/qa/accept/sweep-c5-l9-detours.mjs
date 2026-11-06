import { l9Groups } from '../../../src/data/l9.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
import { VehicleRecovery } from '../../playtest/driving.ts';

const [tierArg, routeArg] = process.argv.slice(2); assert(['low','high'].includes(tierArg) && ['road','countryside','dry-shortcut'].includes(routeArg));
const identity = provenance(), hash = browserHash();
const completionPath = `docs/reports/fix51-r10c/L7-L8-carried-${tierArg}/late-input-completion.json.gz`, completionBytes = readFileSync(completionPath), campaign = JSON.parse(gunzipSync(completionBytes).toString()).campaign;
const inputPath = `docs/reports/fix51-r10c/L7-L8-carried-${tierArg}-input.json`, input = JSON.parse(readFileSync(inputPath,'utf8')); assert.equal(input.sourceHash,identity.sourceHash);assert.equal(input.browserHash,hash);assert(!input.error);
const deadline = Date.now()+540000;
const out = resolve(`test-results/sweep-c5/l9-detours-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise(r => socket.close(r));
assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* owned server starts */ }
    await delay(100);
  }
  for (const tier of [tierArg]) for (const mode of [routeArg]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [], captures = [], samples = [], commands = [];
    page.on('pageerror', e => errors.push(e.stack ?? e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try {
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const setup = await page.evaluate(async ({tier,campaign}) => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause();
        await g.continueCampaign(campaign,9); a.pause();
        g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
        const car = g.world.vehicles.cars.get(g.world.missions.l9.state.carId);
        const before = car.entity.health.current;
        window.__zeroProof = { start: a.tick(), inputs: [], events: [] };
        g.input.tap = frame => window.__zeroProof.inputs.push({ tick: a.tick(), drive: { ...frame.drive }, brake: frame.brake });
        g.world.events.on('vehicle.durability-hit', e => {
          const target = g.world.entities.get(e.targetId);
          const group = Object.entries(g.world.missions.l9.state.encounters.ids).find(([, ids]) => ids.includes(e.targetId))?.[0];
          window.__zeroProof.events.push({ ...e, target: target ? { archetype: target.archetype, hp: target.health.current,
            position: { ...target.transform }, state: target.infected?.state, group } : null });
        });
        g.world.events.on('mission.signal', e => window.__zeroProof.events.push({ ...e }));
        g.world.events.on('objective.started', e => window.__zeroProof.events.push({ ...e }));
        return { requestedQuality: tier, before, after: car.entity.health.current, carId: car.entity.id, backend: a.perf().backend, quality: a.getState().render.quality };
      }, {tier,campaign});

      const routes = JSON.parse(readFileSync('layouts/D-CROSSING/routes.json', 'utf8')).routes;
      const route = routes.find(route => route.id === mode);
      const path = route.detour, groups = l9Groups.filter(group=>group.route===mode&&!group.id.includes('wanderer')), photographed = new Set();
      let waypoint = 1, held = [];
      const recovery = new VehicleRecovery();
      for (let iteration = 0; iteration < 2200 && Date.now()<deadline; iteration++) {
        const s = await page.evaluate(() => {
          const g = window.__SCENE__.game, w = g.world, m = w.missions, car = w.vehicles.cars.get(m.l9.state.carId);
          return { tick: w.tick, phase: m.l9.state.phase, objective: document.querySelector('[data-testid="objective-text"]')?.textContent,
            hud: document.querySelector('[data-testid="objective-tracker"]')?.textContent ?? document.querySelector('[data-testid="mission-tracker"]')?.textContent,
            hp: car.entity.health.current, position: { ...car.entity.transform }, speed: car.physics.speed, speedCap: car.physics.speedCap,
            damage: car.entity.vehicle.damage, vehiclePresent: !!w.entities.get(car.entity.id), wheels: car.physics.wheels.length };
        });
        samples.push(s);
        for (const group of groups) if (!photographed.has(group.id) && Math.abs(s.position.x-group.at[0])<4) {
          await page.evaluate(async()=>{window.__SS__.camera.zoom(1.5);await window.__SS__.screenshotReady();});
          const file=resolve(out,`${tier}-${mode}-${group.id}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:88});
          captures.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),tick:s.tick,zoom:1.5,label:group.id});photographed.add(group.id);
        }
        if (s.phase !== 'driving') break;
        let keys = [];
        if (s.phase === 'driving') {
          while (waypoint < path.length - 1) {
            const a = path[waypoint - 1], b = path[waypoint];
            
            const passed = (s.position.x - b[0]) * (b[0] - a[0]) + (s.position.z - b[1]) * (b[1] - a[1]) > 0 && Math.abs((s.position.x - b[0]) * (b[1] - a[1]) - (s.position.z - b[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]) < 18;
            if (!passed && Math.hypot(b[0] - s.position.x, b[1] - s.position.z) >= 6) break;
            waypoint++;
          }
          // Follow the authored segment with a short lookahead. Aiming only
          // at its distant endpoint allowed a 6-8 m parallel offset into
          // verge props even after the heading error fell below the deadband.
          const a = path[waypoint - 1], b = path[waypoint];
          const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
          const along = Math.max(0, Math.min(length, ((s.position.x - a[0]) * dx + (s.position.z - a[1]) * dz) / length));
          const look = Math.min(length, along + 12);
          const goal = [a[0] + dx * look / length, a[1] + dz * look / length];
          const want = -Math.atan2(goal[1] - s.position.z, goal[0] - s.position.x);
          const delta = Math.atan2(Math.sin(want - s.position.yaw), Math.cos(want - s.position.yaw));
          // Full throttle through the road's sharp exit turn skids off the
          // authored detour into verge props. Brake through the same turns
          // on both routes; all control remains ordinary physical WASD.
          const throttle = Math.abs(delta) > .35 && s.speed > 6 ? ['KeyS'] : ['KeyW'];
          keys = recovery.keys(s.position, s.tick / 60 * 1000) ?? [...throttle, ...(Math.abs(delta) > 0.02 ? [delta > 0 ? 'KeyD' : 'KeyA'] : [])];
        }
        for (const key of held.filter(k => !keys.includes(k))) await page.keyboard.up(key);
        for (const key of keys.filter(k => !held.includes(k))) await page.keyboard.down(key);
        held = keys; commands.push({ tick: s.tick, keys, waypoint });
        await page.evaluate(() => window.__SS__.step(12));
      }
      for (const key of held) await page.keyboard.up(key);
      for (const zoom of [1.5]) {
        await page.evaluate(async z => { window.__SS__.camera.zoom(z); await window.__SS__.screenshotReady(); }, zoom);
        const file = resolve(out, `${tier}-${mode}-final-z${zoom}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), tick: samples.at(-1).tick, zoom, label: 'final' });
      }
      const result = await page.evaluate(() => ({ ...window.__zeroProof, preCrashDurability: window.__SCENE__.game.world.missions.l9.state.preCrashDurability, phase: window.__SCENE__.game.world.missions.l9.state.phase }));
      rows.push({ tier, mode, path, groups, setup, captures, samples, commands, result, errors });
      console.log(tier, mode, { samples: samples.length, final: samples.at(-1), captures: captures.length });
    } finally { await context.close(); }
  }
} finally {
  await browser.close(); server.kill('SIGTERM');
  mkdirSync('docs/reports/sweep-c5/L9-02',{recursive:true});
  writeFileSync(`docs/reports/sweep-c5/L9-02/${tierArg}-${routeArg}-physical.json.gz`, gzipSync(JSON.stringify({ ...identity, browserHash: hash,
    toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out, physicalSeed:{file:completionPath,sha256:createHash('sha256').update(completionBytes).digest('hex')},
    method: 'Exact current qualified physical L8 departure campaign; one actual authored L9 detour per bounded command. Shared headless Metal WebGL2, actual physical WASD, normal damage/AI/physics. No cheats, actor writes, teleports, objective skips or performance timing. Read-only input, health, contacts and pre-crash event ledger; wide1.5 screenshots at each passed group anchor and pre-crash approach. VehicleRecovery uses physical reverse/steer keys only.', rows })));
}
