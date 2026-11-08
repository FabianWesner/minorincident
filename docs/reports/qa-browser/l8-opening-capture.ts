import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser } from 'playwright';
import { launchBrowser, poolUrl } from '../../../tools/browser-pool/client';
import { ensurePool } from '../../../tools/browser-pool/ensure';
import { vehicleDef } from '../../../src/data/vehicles';
import { consoleAllowlist } from '../../../tests/e2e/console-allowlist';
import { provenance } from '../../../tools/qa/accept/probe';

// Invoke directly: this runner owns one exclusive pool context, one page at a time.
// This is visual/input QA, without performance timing or a CPU-quiet reservation.
// Vite dev uses the shared optimizer cache; no disposable dist build is created.
const out = resolve('docs/reports/qa-browser/l8-opening');
mkdirSync(out, { recursive: true });
const probe = createServer();
await new Promise<void>((ready, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', ready); });
const address = probe.address(); assert(address && typeof address !== 'string');
const port = address.port;
await new Promise<void>(ready => probe.close(() => ready()));
let server: ChildProcess | undefined;
let lease: string | undefined, heartbeat: ReturnType<typeof setInterval> | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
const request = async (path: string, method = 'GET') => {
  const response = await fetch(`${poolUrl()}${path}`, { method, signal: AbortSignal.timeout(10_000) });
  assert(response.ok, `Browser admission ${path} failed (${response.status})`);
  return response.json() as Promise<{ id: string; granted: boolean }>;
};
let browser: Browser | undefined;
const manifest: Record<string, unknown>[] = [], errors: string[] = [];
let earlyAttempt: Record<string, unknown> | undefined;
try {
  assert(!process.env.MI_BROWSER_POOL_EXCLUSIVE, 'Invoke this runner directly; it owns its exclusive browser lease');
  await ensurePool();
  lease = (await request('/exclusive?job=r12-l8-opening', 'POST')).id;
  const admissionDeadline = Date.now() + 1_800_000;
  while (!(await request(`/exclusive/${lease}`)).granted) {
    assert(Date.now() < admissionDeadline, 'Browser admission exceeded 30 minutes');
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
  }
  process.env.MI_BROWSER_POOL_EXCLUSIVE = lease; process.env.MI_BROWSER_POOL = '1';
  heartbeat = setInterval(() => { void request(`/exclusive/${lease}`).catch(() => {}); }, 5000);
  timeout = setTimeout(() => {
    if (heartbeat) clearInterval(heartbeat);
    void request(`/exclusive/${lease}/release`, 'POST').catch(() => {});
    void browser?.close().catch(() => {}); server?.kill('SIGTERM');
  }, 590_000);
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned server is starting */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  assert(ready, 'QA server did not start');
  browser = await launchBrowser({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const quality of ['low', 'high'] as const) for (const progressed of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !consoleAllowlist.some(pattern => pattern.test(message.text()))) errors.push(message.text()); });
    const url = `${origin}/?test=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&ui=1`;
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async ({ progressed, quality }) => {
      const game = window.__SS__!; await game.ready;
      await game.loadLevel('L8', { seed: 1, ...(progressed ? { progression: 'L8-default' as const } : {}) });
      game.settings.set({ quality });
      if (progressed && !game.campaign.save()) throw new Error('Progressed campaign did not save');
    }, { progressed, quality });
    if (progressed) {
      // Reload the production SaveStore payload, then use the ordinary level menu.
      await page.reload();
      await page.getByTestId('start-game').click();
      await page.getByTestId('level-L8').click();
    }
    await page.getByTestId('mission-button').click({ timeout: 120_000 });
    await page.waitForFunction(() => window.__SS__!.missions.state()?.steps.sanctuary.status === 'active');
    const first = await page.evaluate(() => {
      const game = window.__SS__!; game.pause();
      return { tick: game.tick(), marker: game.missions.state()!.marker, text: document.querySelector('[data-testid=objective-text]')?.textContent };
    });
    assert(first.tick <= 60 && first.marker === 'zoo-gate' && first.text?.includes('zoo gate'), `Missing first-second guidance: ${JSON.stringify(first)}`);
    const before = await page.evaluate(() => { const game = window.__SS__!; game.camera.follow(); game.camera.zoom(1); game.resume(); return game.getEntity(1)!.transform; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    await page.evaluate(() => window.__SS__!.pause());
    for (const zoom of [1, 1.5]) {
      await page.evaluate(async zoom => { const game = window.__SS__!; game.camera.zoom(zoom); await game.screenshotReady(); }, zoom);
      const state = await page.evaluate(() => {
        const game = window.__SS__!, mission = game.missions.state()!, render = game.getState().render;
        return { tick: game.tick(), objective: document.querySelector('[data-testid=objective-text]')?.textContent?.trim() ?? '', marker: mission.marker, tracker: !!document.querySelector<HTMLElement>('[data-testid=objective-tracker]')?.checkVisibility(), minimap: !!document.querySelector<HTMLElement>('[data-testid=minimap-objective]')?.checkVisibility(), direction: !!document.querySelector<HTMLElement>('[data-testid=mission-marker]')?.checkVisibility(), worldMarker: render.missionMarker, camera: render.camera, quality: render.quality, backend: render.backend, active: Object.entries(mission.steps).filter(([, step]) => step.status === 'active').map(([id]) => id), player: game.getEntity(1)!.transform, campaign: !!game.campaign.state() };
      });
      const name = `${progressed ? 'progressed' : 'fresh'}-${quality}-zoom-${String(zoom).replace('.', '-')}.jpg`;
      assert(state.objective.includes('zoo gate') && /\d+\s*m/.test(state.objective), `${name}: missing gate objective/distance`);
      assert.equal(state.marker, 'zoo-gate'); assert(state.active.includes('sanctuary'));
      assert(state.tracker && state.minimap && state.direction && state.worldMarker?.visible, `${name}: missing visible guidance`);
      assert.equal(state.campaign, progressed); assert.equal(state.quality, quality); assert(Math.abs(state.camera.zoom - zoom) < 1e-6);
      const moved = Math.hypot(state.player.x - before.x, state.player.z - before.z);
      assert(moved > 0.1, `${name}: physical keyboard input did not move the courier`);
      await page.screenshot({ path: `${out}/${name}`, type: 'jpeg', quality: 70 });
      manifest.push({ file: name, progressed, zoom, first, movedMetres: moved, ...state });
    }
    if (quality === 'high' && progressed) {
      const car = await page.evaluate(() => { const game = window.__SS__!; return game.getEntity(game.getState().l8!.carId)!.transform; });
      const def = vehicleDef('vehicle.military-apc'), side = def.width / 2 + .55;
      const door = { x: car.x + Math.cos(car.yaw) * def.doorX + Math.sin(car.yaw) * side, z: car.z - Math.sin(car.yaw) * def.doorX + Math.cos(car.yaw) * side };
      const route = [{ x: 24, z: 78 }, { x: 66, z: 78 }, { x: 90, z: 78 }, door];
      await page.evaluate(() => window.__SS__!.resume());
      const routeStarted = Date.now();
      for (const goal of route) {
        while (true) {
          const at = await page.evaluate(() => window.__SS__!.getEntity(1)!.transform);
          const dx = goal.x - at.x, dz = goal.z - at.z;
          if (Math.hypot(dx, dz) < .55) break;
          assert(Date.now() - routeStarted < 65_000, 'Physical early-APC route stalled');
          const sx = dx - dz, sy = dx + dz, longest = Math.max(Math.abs(sx), Math.abs(sy)), keys: string[] = [];
          if (Math.abs(sx) > longest * .35) keys.push(sx > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(sy) > longest * .35) keys.push(sy > 0 ? 'KeyS' : 'KeyW');
          for (const key of keys) await page.keyboard.down(key);
          await page.waitForTimeout(Math.min(180, Math.max(45, Math.hypot(dx, dz) * 100)));
          for (const key of keys) await page.keyboard.up(key);
        }
      }
      await page.keyboard.down('KeyE');
      const sample = async () => page.evaluate(() => {
        const game = window.__SS__!, mission = game.missions.state()!, car = game.getEntity(game.getState().l8!.carId)!;
        const view = game.getState().render.vehicles.find(vehicle => vehicle.id === car.id);
        return { entryRing: view && 'entryRingVisible' in view ? view.entryRingVisible : null, tick: game.tick(), checkpoint: mission.checkpoint, breached: mission.states.breached, steps: Object.fromEntries(Object.entries(mission.steps).map(([id, step]) => [id, step.status])), marker: mission.marker, driver: car.vehicle!.driver, passengers: car.vehicle!.passengers?.length ?? 0, player: game.getEntity(1)!.transform, infected: game.query({ kind: 'infected' }).filter(actor => actor.health.current > 0).length };
      });
      const arrived = await sample(); assert(arrived.tick < 3125, 'APC approach must reach the PO time window');
      await page.waitForFunction(() => window.__SS__!.tick() >= 3125, undefined, { timeout: 120_000 });
      await page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.screenshotReady(); });
      const calm = await sample();
      await page.screenshot({ path: `${out}/early-apc-52s.jpg`, type: 'jpeg', quality: 70 });
      await page.evaluate(() => window.__SS__!.resume());
      await page.waitForFunction(() => window.__SS__!.tick() >= 3660, undefined, { timeout: 60_000 });
      await page.keyboard.up('KeyE'); await page.evaluate(() => window.__SS__!.pause());
      const breached = await sample();
      for (const state of [calm, breached]) assert(state.steps.sanctuary === 'active' && state.steps.escape === 'pending' && state.steps.depart === 'pending' && state.marker === 'zoo-gate' && state.driver === null && state.passengers === 0 && state.entryRing === false, `Early APC sequence break: ${JSON.stringify(state)}`);
      assert(calm.checkpoint === 'sanctuary' && breached.checkpoint === 'breach' && !calm.breached && calm.infected === 0 && breached.breached && breached.infected > 0, 'The real breach must occur while APC camping remains blocked');
      earlyAttempt = { input: 'physical WASD along the south road, then hold E at the driver door; no teleport, bot, invulnerability, objective skip or time scale change', arrived, calm, breached, image: 'early-apc-52s.jpg' };
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  writeFileSync(`${out}/manifest.json`, JSON.stringify({ ...provenance(), input: 'native mission button; physical W for 500 ms; progressed case reloads the persisted L8-default campaign through Start game → L8', errors, earlyAttempt, captures: manifest }, null, 2));
  console.log(JSON.stringify({ captures: manifest.length, directory: out }));
} finally {
  writeFileSync(`${out}/manifest.json`, JSON.stringify({ ...provenance(), errors, earlyAttempt, captures: manifest }, null, 2));
  if (heartbeat) clearInterval(heartbeat); if (timeout) clearTimeout(timeout);
  await browser?.close().catch(() => {}); server?.kill('SIGTERM');
  if (lease) await request(`/exclusive/${lease}/release`, 'POST').catch(() => {});
}
