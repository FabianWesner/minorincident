import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';

test.use({ trace: 'off', video: { mode: 'on', size: { width: 960, height: 540 } } });
test.afterEach(async ({ page }, info) => {
  const video = page.video(); await page.close();
  if (video) await video.saveAs(`test-results/vehicle-feel/${info.title.includes('curb-video') ? 'curb' : 'town'}.raw.webm`);
});
test('T-E09-driving-video @E09 town acceleration, right-angle corner, handbrake and cone', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync('test-results/vehicle-feel', { recursive: true });
  await boot(page);
  await page.evaluate(() => window.__SS__!.loadLevel('L1', { seed: 1 }));
  await page.getByRole('button', { name: 'Begin mission' }).click();
  const setup = await page.evaluate(async () => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true);
    const car = a.spawn('vehicle.sedan', { x: -50, z: -31 });
    const cone = a.spawn('prop.cone', { x: -44, z: -31 });
    a.teleport('player', { x: -49.8, z: -29.55 }); await a.step(60); a.camera.follow(); a.vfx.stepRender(1); await a.screenshotReady();
    if (a.getEntity(car)!.vehicle!.driver !== 1) throw new Error('Town recording driver failed to enter');
    return { car, cone };
  });
  await page.keyboard.press('KeyW'); // select the same local driving scheme used by the bot
  const started = Date.now(), samples: { seconds: number; x: number; z: number; y: number; yaw: number; speed: number; stage: number }[] = [];
  let stage = 0, driftAt = 0, cornerYaw = 0;
  await page.evaluate(() => window.__SS__!.resume());
  while (Date.now() - started < 6500) {
    const car = await page.evaluate(id => window.__SS__!.getEntity(id)!, setup.car);
    const p = car.transform, speed = car.vehicle!.speed, seconds = (Date.now() - started) / 1000;
    if (stage === 0 && p.x > -39) stage = 1;
    if (stage === 1 && p.yaw > 1.45) { cornerYaw = p.yaw; stage = 2; driftAt = seconds; }
    if (stage === 2 && seconds - driftAt > .85) stage = 3;
    const drive = { throttle: stage === 3 ? 0 : stage === 2 ? 1 : Math.max(0, Math.min(.75, .15 + (7 - speed) * .5)), steer: stage === 0 || stage === 3 ? 0 : stage === 1 ? 1 : -1 };
    await page.evaluate(frame => window.__SS__!.input.set(frame), { drive, handbrake: stage === 2, brake: stage === 3 });
    samples.push({ seconds, ...p, speed, stage });
    await page.waitForTimeout(75);
  }
  const result = await page.evaluate(({ car, cone }) => {
    const a = window.__SS__!; a.pause(); return { car: a.getEntity(car), cone: a.getEntity(cone), camera: a.getState().render.camera, events: a.events() };
  }, setup);
  writeFileSync('test-results/vehicle-feel/town-drive.json', JSON.stringify({ setup, samples, result, cornerYaw }, null, 2));
  await page.screenshot({ path: 'test-results/vehicle-feel/driving.png' });
  expect(result.camera.spot).toBeNull(); expect(result.cone!.health.current).toBe(0);
  expect(Math.max(...samples.map(s => s.speed))).toBeGreaterThan(5);
  expect(cornerYaw).toBeGreaterThan(1.4); expect(samples.some(s => s.stage === 2)).toBe(true);
});

test('T-E09-curb-video @E09 town raycast wheels ride over a raised planter curb', async ({ page }) => {
  test.setTimeout(180_000); mkdirSync('test-results/vehicle-feel', { recursive: true });
  await boot(page); await page.evaluate(() => window.__SS__!.loadLevel('L1', { seed: 1 }));
  await page.getByRole('button', { name: 'Begin mission' }).click();
  const id = await page.evaluate(async () => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true);
    // The existing 0.35 m dressing:planter:548 edge is accessible from Row Street.
    const id = a.spawn('vehicle.sedan', { x: -65, z: -37 });
    a.teleport('player', { x: -64.8, z: -35.55 }); await a.step(60); a.camera.follow(); await a.screenshotReady();
    if (a.getEntity(id)!.vehicle!.driver !== 1) throw new Error('Curb recording driver failed to enter');
    return id;
  });
  await page.keyboard.press('KeyW'); await page.evaluate(() => window.__SS__!.resume());
  const started = Date.now(), samples: { seconds: number; x: number; y: number; z: number; speed: number }[] = [];
  while (Date.now() - started < 4500) {
    const car = await page.evaluate(id => window.__SS__!.getEntity(id)!, id);
    samples.push({ seconds: (Date.now() - started) / 1000, ...car.transform, speed: car.vehicle!.speed });
    await page.evaluate(x => window.__SS__!.input.set({ drive: { throttle: x < -57 ? .7 : 0, steer: 0 }, brake: x >= -57 }), car.transform.x);
    await page.waitForTimeout(75);
  }
  await page.evaluate(() => window.__SS__!.pause());
  writeFileSync('test-results/vehicle-feel/curb-drive.json', JSON.stringify({ id, samples }, null, 2));
  await page.screenshot({ path: 'test-results/vehicle-feel/curb.png' });
  expect(Math.max(...samples.map(s => s.y)), JSON.stringify(samples)).toBeGreaterThan(.85);
  expect(samples.some(s => s.x > -58)).toBe(true);
});
