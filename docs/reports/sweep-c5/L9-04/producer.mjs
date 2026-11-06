import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
import { VehicleRecovery } from '../../playtest/driving.ts';

const identity = provenance(), hash = browserHash();
const out = resolve(`test-results/sweep-c5-l9-routes-${Date.now()}`);
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
  for (const tier of ['low', 'high'].filter(tier => !process.argv[2] || process.argv[2] === tier)) for (const mode of ['safe', 'shortcut']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const leaseTimer = setTimeout(() => { void context.close(); }, 8 * 60_000);
    const page = await context.newPage(), errors = [], captures = [], samples = [], commands = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&ui=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const setup = await page.evaluate(async tier => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause();
        a.settings.set({ quality: tier });
        await a.loadLevel('L9', { seed: 1, progression: 'L9-default' }); a.pause();
        a.settings.set({ quality: tier, vfx: true, timeOfDay: 'night', cameraShake: false, cheapDof: false });
        a.missions.begin(); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
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
        return { before, after: car.entity.health.current, carId: car.entity.id, backend: a.perf().backend, quality: a.getState().render.quality };
      }, tier);
      await page.mouse.click(640, 360);
      const routes = JSON.parse(readFileSync('layouts/D-CROSSING/routes.json', 'utf8')).routes;
      const route = routes.find(route => route.id === (mode === 'safe' ? 'road' : 'dry-shortcut'));
      const path = mode === 'safe' ? route.detour : [route.points[0], route.points[1], ...route.risks, route.points.at(-2), route.points.at(-1)];
      let waypoint = 1, held = [], fallShots = 0, lastFallTick = -Infinity, roadShot = false, damageShot = false;
      const recovery = new VehicleRecovery();
      for (let iteration = 0; iteration < 2200; iteration++) {
        const s = await page.evaluate(() => {
          const g = window.__SCENE__.game, w = g.world, m = w.missions, car = w.vehicles.cars.get(m.l9.state.carId);
          return { tick: w.tick, phase: m.l9.state.phase, objective: document.querySelector('[data-testid="objective-text"]')?.textContent,
            hud: document.querySelector('[data-testid="objective-tracker"]')?.textContent ?? document.querySelector('[data-testid="mission-tracker"]')?.textContent,
            hp: car.entity.health.current, position: { ...car.entity.transform }, speed: car.physics.speed, speedCap: car.physics.speedCap,
            damage: car.entity.vehicle.damage, vehiclePresent: !!w.entities.get(car.entity.id), wheels: car.physics.wheels.length };
        });
        samples.push(s);
        const road = s.phase === 'driving' && s.position.x > -240 && s.position.x < -160;
        const fall = s.phase !== 'driving';
        const damage = mode === 'safe' && s.hp <= 970 && !damageShot;
        if (damage || (road && !roadShot) || (fall && fallShots < 1 && s.tick - lastFallTick >= 12)) {
          const label = damage ? 'damage-investigation' : road ? 'road-smoke' : `fall-${fallShots++}`;
          if (damage) damageShot = true;
          if (road) {
            for (const key of held) await page.keyboard.up(key);
            held = [];
          }
          for (const zoom of [0.5, 1.5]) {
            await page.evaluate(async z => { window.__SS__.camera.zoom(z); await window.__SS__.screenshotReady(); }, zoom);
            const file = resolve(out, `${tier}-${mode}-${label}-z${zoom}.jpg`);
            await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
            captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), tick: s.tick, zoom, label });
          }
          if (road) roadShot = true; else lastFallTick = s.tick;
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
      for (const zoom of [0.5, 1.5]) {
        await page.evaluate(async z => { window.__SS__.camera.zoom(z); await window.__SS__.screenshotReady(); }, zoom);
        const file = resolve(out, `${tier}-${mode}-final-z${zoom}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), tick: samples.at(-1).tick, zoom, label: 'final' });
      }
      const result = await page.evaluate(() => ({ ...window.__zeroProof, preCrashDurability: window.__SCENE__.game.world.missions.l9.state.preCrashDurability, phase: window.__SCENE__.game.world.missions.l9.state.phase }));
      rows.push({ tier, mode, path, setup, captures, samples, commands, result, errors });
      console.log(tier, mode, { samples: samples.length, final: samples.at(-1), captures: captures.length });
    } finally { clearTimeout(leaseTimer); await context.close(); }
  }
} finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c5/L9-04/${process.argv[2] ?? 'both'}-physical.json.gz`, gzipSync(JSON.stringify({ ...identity, browserHash: hash,
    toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out,
    method: 'Matched healthy L9-default seed1 drives: authored safe road detour and risky shortcut with all six risk anchors. Shared headless Metal WebGL2, actual physical WASD, normal damage/AI/physics. No cheats, actor writes, teleports, objective skips or performance timing. Read-only input, health, contacts and pre-crash event ledger; per-route screenshots at both PO zooms.', rows })));
}
