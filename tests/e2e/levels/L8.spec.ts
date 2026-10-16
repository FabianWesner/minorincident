import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import type { Page } from '@playwright/test';
const out = 'test-results/epics/E30';
/** The campaign handoff resumes the new level; await it instead of stepping the retired zoo. */
const stepZoo = (page: Page, n: number) => page.evaluate(async n => {
  const a = window.__SS__!;
  if (a.getState().scenario !== 'L8' || a.missions.state()?.phase === 'progression') { await a.screenshotReady(); a.pause(); return; }
  a.pause(); await a.step(n);
}, n);

test('T-E30-18 @E30-AC18 real keyboard exploration, tunnel breach and complete APC escape into L9', async ({ page }) => {
  test.setTimeout(900_000); mkdirSync(out, { recursive: true });
  await boot(page, '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&ui=1');
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); });
  await page.getByRole('button', { name: 'Begin mission' }).click(); await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => stepZoo(page, n);
  const shot = async (name: string) => { await page.evaluate(async () => { window.__SS__!.camera.follow(); await window.__SS__!.screenshotReady(); }); await page.screenshot({ path: `${out}/${name}.png` }); };
  await shot('real-calm');
  const initial = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  const initialCorgi = await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.companion));
  expect(initialCorgi, 'the protected campaign corgi arrives at the zoo').toBeDefined();
  await page.keyboard.down('w'); await page.keyboard.down('d'); await step(120); await page.keyboard.up('w'); await page.keyboard.up('d');
  const explored = await page.evaluate(() => window.__SS__!.getState());
  expect(Math.hypot(explored.player!.transform.x - initial.x, explored.player!.transform.z - initial.z)).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.marker)).toBeNull(); await expect(page.locator('.mission-tracker')).toBeHidden();
  // The protected dog now travels through L7/L8; this must describe the real
  // follower rather than the obsolete phantom "awaiting rescue" prompt.
  const corgi = explored.entities.find(e => e.id === initialCorgi!.id)!;
  expect(corgi, 'the same corgi remains present during calm exploration').toBeDefined();
  expect(corgi.companion?.state).toBe('follow'); expect(corgi.hidden).not.toBe(true);
  expect(corgi.health.current).toBe(corgi.health.max);
  expect(corgi.infected).toBeUndefined(); expect(corgi.infection).toBeUndefined();
  await expect(page.locator('.hud-companion')).toBeVisible();
  await expect(page.locator('.hud-companion')).toHaveText('Corgi · following');
  await expect(page.locator('.hud-pin-objective')).toBeHidden(); await expect(page.locator('.hud-pin-home')).toBeHidden();
  // The real Begin click can advance a few frames before pause reaches the page.
  // Measure the exact boundary from the live clock rather than assuming tick 120.
  const calmClock = await page.evaluate(() => { const s = window.__SS__!.getState(); return { tick: s.tick, start: s.l8!.startedAt }; });
  const breachTick = calmClock.start + 3600;
  expect(breachTick).toBe(3600); expect(calmClock.tick).toBeLessThan(breachTick - 1);
  await step(breachTick - 1 - calmClock.tick);
  expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(breachTick - 1);
  expect(await page.evaluate(() => window.__SS__!.getState().l8!.breachedAt)).toBe(0);
  await step(1); const breach = await page.evaluate(() => window.__SS__!.getState().l8!);
  expect(breach.breachedAt).toBe(3600); expect(new Set(breach.arrivals.map(a => a.outlet)).size).toBe(4);
  // Physical key movement is computed from the same isometric axes as other real-input campaign gates.
  for (let i = 0; i < 1500; i++) {
    const obs = await page.evaluate(() => {
      const a = window.__SS__!, state = a.getState(), p = state.player!.transform;
      if (state.scenario !== 'L8') return null;
      const car = a.getEntity(state.l8!.carId)!, yaw = car.transform.yaw, def = { doorX: .71, width: 2.95 };
      const door = { x: car.transform.x + Math.cos(yaw) * def.doorX + Math.sin(yaw) * (def.width / 2 + .55), z: car.transform.z - Math.sin(yaw) * def.doorX + Math.cos(yaw) * (def.width / 2 + .55) };
      const friends = state.l8!.roster.map(id => a.getEntity(id)!).filter(e => e.health.current > 0 && !e.infected && e.passengerOf === undefined);
      const enemy = a.query({}).filter(e => e.infected && !e.hidden && !e.emerging && e.health.current > 0 && a.input.visible(e.transform) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 15).sort((a,b) => Math.hypot(a.transform.x - p.x,a.transform.z - p.z) - Math.hypot(b.transform.x - p.x,b.transform.z - p.z))[0];
      return { p, door, car: car.transform, carHP: car.health.current, hp: state.player!.health.current, phase: a.missions.state()!.phase, weapons: state.player!.weapons, tick: state.tick, active: car.vehicle!.driver === 1, friends: friends.map(e => e.transform), enemy: enemy?.transform };
    });
    if (!obs) break;
    if (i % 100 === 0) writeFileSync(`${out}/real-progress.json`, JSON.stringify(obs, null, 2));
    if (obs.enemy) {
      const ndc = await page.evaluate(at => window.__SS__!.camera.project(at.x, at.y, at.z), obs.enemy), view = page.viewportSize()!;
      await page.mouse.move((ndc[0] + 1) * view.width / 2, (1 - ndc[1]) * view.height / 2);
      await page.keyboard.down('Shift'); await page.keyboard.press('2'); await page.keyboard.up('Shift'); await step(1);
      await page.mouse.down(); await step(20); await page.mouse.up(); continue;
    }
    if (obs.active || (Math.hypot(obs.p.x - obs.door.x, obs.p.z - obs.door.z) > 10 && obs.friends.some(p => Math.hypot(p.x - obs.p.x, p.z - obs.p.z) > 12))) { await step(12); continue; }
    const target = Math.hypot(obs.p.x - obs.door.x, obs.p.z - obs.door.z) < 10 && obs.p.z < obs.door.z - .5 ? { x: obs.p.x, z: obs.door.z + 1 } : obs.door;
    const dx = target.x - obs.p.x, dz = target.z - obs.p.z;
    if (Math.hypot(obs.door.x - obs.p.x, obs.door.z - obs.p.z) < .6) { await shot('real-escape'); await page.keyboard.press('e'); await step(12); continue; }
    const keys = Math.abs(dx) > Math.abs(dz) ? dx > 0 ? ['s','d'] : ['w','a'] : dz > 0 ? ['s','a'] : ['w','d'];
    for (const key of keys) await page.keyboard.down(key);
    await step(Math.min(12, Math.max(2, Math.floor(Math.max(Math.abs(dx), Math.abs(dz)) * 10))));
    for (const key of keys) await page.keyboard.up(key);
  }
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L9', undefined, { timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.pause());
  const destination = await page.evaluate(() => window.__SS__!.getState());
  expect(destination.entities.find(e => e.id === breach.carId)!.vehicle!.driver).toBe(1);
  expect(destination.progression!.campaign!.results!.L8.rescued).toBeGreaterThanOrEqual(8);
  const carriedCorgi = destination.entities.find(e => e.id === initialCorgi!.id)!;
  expect(carriedCorgi, 'the same protected dog arrives aboard the crossing APC').toBeDefined();
  expect(carriedCorgi.companion).toBeDefined(); expect(carriedCorgi.passengerOf).toBe(breach.carId);
  expect(carriedCorgi.health.current).toBe(carriedCorgi.health.max);
  expect(carriedCorgi.infected).toBeUndefined(); expect(carriedCorgi.infection).toBeUndefined();
  writeFileSync(`${out}/real-input.json`, JSON.stringify(destination, null, 2)); await shot('real-l9-arrival');
});

test('T-E30-19 @E30-AC19 game camera calm, internal breach and same-id animal turn captures', async ({ page }) => {
  test.setTimeout(600_000); mkdirSync(out, { recursive: true }); await boot(page);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.cheats.god(true); a.missions.begin(); });
  const capture = async (name: string, pos: { x: number; z: number }) => {
    await page.evaluate(async pos => { const a = window.__SS__!; a.teleport(1, pos); await a.step(1); a.camera.cinematic({ position: [pos.x + 19, 23, pos.z + 19], target: [pos.x, .5, pos.z] }, true); await a.screenshotReady(); }, pos);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  await capture('calm', { x: -60, z: -20 });
  const animals = await page.evaluate(() => window.__SS__!.getState().l8!.animals);
  await page.evaluate(() => window.__SS__!.step(3635)); await capture('breach', { x: -99, z: 32 }); await page.evaluate(() => window.__SS__!.teleport(1, { x: 0, z: 70 }));
  let converting = 0;
  for (let i = 0; i < 300; i++) {
    const state = await page.evaluate(ids => ids.map(id => window.__SS__!.getEntity(id)!), animals);
    const animal = state.find(e => e.infection);
    if (animal) { converting = animal.id; await capture('animal-turning', animal.transform); writeFileSync(`${out}/animal-turning.json`, JSON.stringify(animal, null, 2)); break; }
    await page.evaluate(() => window.__SS__!.step(30));
  }
  expect(converting).toBeGreaterThan(0);
  await page.evaluate(() => window.__SS__!.step(240));
  const infected = await page.evaluate(id => window.__SS__!.getEntity(id)!, converting);
  expect(infected.infected).toBeTruthy(); await capture('animal-infected', infected.transform);
  writeFileSync(`${out}/animal-infected.json`, JSON.stringify(infected, null, 2));
});

test.describe('phone escape input', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('T-E30-18-mobile @E30-AC18 touch stick reaches the APC ACTION with no HUD overflow', async ({ page, context }) => {
    test.setTimeout(600_000); await boot(page, '/?test=1&renderer=webgl&dpr=1&quality=low&audio=muted&ui=1');
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.missions.begin(); await a.step(3600); });
    const cdp = await context.newCDPSession(page);
    for (let i = 0; i < 300; i++) {
      const obs = await page.evaluate(() => {
        const a = window.__SS__!, state = a.getState(); if (state.scenario !== 'L8') return null;
        const p = state.player!.transform, car = a.getEntity(state.l8!.carId)!, yaw = car.transform.yaw;
        const door = { x: car.transform.x + Math.cos(yaw) * .71 + Math.sin(yaw) * 2.025, z: car.transform.z - Math.sin(yaw) * .71 + Math.cos(yaw) * 2.025 };
        const dx = door.x - p.x, dz = door.z - p.z, distance = Math.hypot(dx, dz), next = distance > 1 ? { x: p.x + dx / distance * 3, z: p.z + dz / distance * 3 } : door;
        const origin = a.input.project(p), target = a.input.project(next);
        return { distance, screen: { x: target.x - origin.x, y: target.y - origin.y }, active: car.vehicle!.driver === 1 };
      });
      if (!obs) break;
      if (obs.active) { await stepZoo(page, 60); continue; }
      if (obs.distance < .6) {
        await page.touchscreen.tap(100, 350); await stepZoo(page, 1);
        await expect(page.getByTestId('touch-interact')).toBeEnabled(); await page.getByTestId('touch-interact').tap();
        await stepZoo(page, 60); continue;
      }
      const length = Math.hypot(obs.screen.x, obs.screen.y) || 1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 450, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80 + obs.screen.x / length * 60, y: 450 + obs.screen.y / length * 60, id: 1 }] });
      await stepZoo(page, Math.min(30, Math.max(2, Math.floor(obs.distance * 8))));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L9', undefined, { timeout: 120_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    mkdirSync(out, { recursive: true }); await page.screenshot({ path: `${out}/touch-l9-arrival.png` });
  });
});
