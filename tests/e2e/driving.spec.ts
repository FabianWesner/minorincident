import { boot, expect, test } from './fixtures';
test('T-E09-08 @E09-AC08 held LMB drives ahead-left and release brakes with distant cursor', async ({ page }) => {
  await boot(page);
  const baseRadius = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('drive-course'); api.pause(); const radius = api.getState().render.camera.radius; await api.step(36);
    // The close gameplay camera cannot show a cursor ten metres ahead; widen this input fixture.
    api.camera.cinematic({ position: [25, 32, 25], target: [0, .7, 0] }); api.vfx.stepRender(1); return radius;
  });
  await page.waitForTimeout(1100); // allow the cinematic camera blend to finish before projecting
  const start = await page.evaluate(() => window.__SS__!.getEntity(2)!);
  const cursor = await page.evaluate(p => window.__SS__!.input.project({ x: p.x + 10, z: p.z + 4 }), start.transform);
  await page.mouse.move(cursor.x, cursor.y); await page.mouse.down();
  await page.evaluate(async () => { await window.__SS__!.step(60); });
  const state = await page.evaluate(() => window.__SS__!.getState());
  expect(state.input.scheme).toBe('mouse-only'); expect(state.entities.find(e => e.id === 2)!.vehicle!.speed, JSON.stringify({ input: state.input, cursor, car: state.entities.find(e => e.id === 2) })).toBeGreaterThan(2);
  expect(state.entities.find(e => e.id === 2)!.transform.yaw).toBeLessThan(-.05);
  expect(state.player!.hidden).toBe(true); expect(state.render.camera.radius).toBeCloseTo(baseRadius * 1.15);
  await page.mouse.up(); await page.evaluate(() => window.__SS__!.step(120));
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.speed)).toBeLessThan(.1);
});
test('S-07 @smoke @E09 vehicle enter, driver travels 50m, real middle-click exit', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); a.bot.start('driver'); await a.step(480); a.bot.stop(); });
  const before = await page.evaluate(() => window.__SS__!.getState()); expect(before.player!.hidden).toBe(true); expect(before.player!.transform.x).toBeGreaterThan(50);
  await page.mouse.click(800, 450, { button: 'middle' }); await page.evaluate(async () => { await window.__SS__!.step(1); });
  const after = await page.evaluate(() => window.__SS__!.getState()); expect(after.player!.hidden).toBe(false); expect(after.entities.find(e => e.id === 2)!.vehicle!.driver).toBeNull();
  const car = after.entities.find(e => e.id === 2)!; expect(Math.hypot(car.transform.x - after.player!.transform.x, car.transform.z - after.player!.transform.z)).toBeLessThanOrEqual(2.5);
});
test('T-E09-controls @E09 keyboard WASD uses local driving axes', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); await a.step(36); });
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.evaluate(async () => { await window.__SS__!.step(90); });
  const car = await page.evaluate(() => window.__SS__!.getEntity(2)!); expect(car.vehicle!.speed).toBeGreaterThan(4); expect(car.transform.yaw).toBeLessThan(-.1);
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
});
test('T-E09-arrow-drift @E09 arrows drive locally and RIGHT holds the rear handbrake', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); await a.step(36); });
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowLeft'); await page.evaluate(() => window.__SS__!.step(90));
  const car = await page.evaluate(() => window.__SS__!.getEntity(2)!);
  expect(car.vehicle!.speed).toBeGreaterThan(4); expect(car.transform.yaw).toBeLessThan(-.1);
  await page.keyboard.down('KeyK'); await page.evaluate(() => window.__SS__!.step(1));
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.braking)).toBe(true);
  await page.keyboard.up('KeyK'); await page.evaluate(() => window.__SS__!.step(1));
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.braking)).toBe(false);
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft');
});

test('T-E09-touch @E09 touch stick accelerates, LEFT holds boost, releasing stick brakes, ACTION exits', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); await a.step(36); });
  const cdp = await context.newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { id: number; x: number; y: number }[]) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await touch('touchStart', [{ id: 1, x: 80, y: 400 }]); await touch('touchMove', [{ id: 1, x: 140, y: 400 }]);
  await page.evaluate(async () => { await window.__SS__!.step(120); });
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.speed)).toBeGreaterThan(3);
  const drift = await page.locator('[data-touch-action=right]').boundingBox(); expect(drift).not.toBeNull();
  await touch('touchStart', [{ id: 1, x: 140, y: 400 }, { id: 4, x: drift!.x + drift!.width / 2, y: drift!.y + drift!.height / 2 }]);
  await page.evaluate(() => window.__SS__!.step(1));
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.braking)).toBe(true);
  await touch('touchEnd', [{ id: 1, x: 140, y: 400 }]);
  await page.evaluate(() => window.__SS__!.step(1));
  const released = await page.evaluate(() => window.__SS__!.getState());
  expect(released.input.frame.right.held, JSON.stringify(released.input)).toBe(false);
  const horn = await page.locator('[data-touch-action=left]').boundingBox(); expect(horn).not.toBeNull();
  await touch('touchStart', [{ id: 1, x: 140, y: 400 }, { id: 3, x: horn!.x + horn!.width / 2, y: horn!.y + horn!.height / 2 }]);
  await page.evaluate(async () => { await window.__SS__!.step(6); });
  expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.boosting)).toBe(true);
  await touch('touchEnd', []);
  await page.evaluate(() => window.__SS__!.step(120));
  const car = await page.evaluate(() => window.__SS__!.getEntity(2)!); expect(car.vehicle!.speed).toBeLessThan(.1); expect(car.vehicle!.driver).toBe(1); expect(car.vehicle!.boosting).toBe(false);
  const box = await page.locator('[data-touch-action=interact]').boundingBox(); expect(box).not.toBeNull();
  await touch('touchStart', [{ id: 2, x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }]); await touch('touchEnd', []);
  await page.evaluate(() => window.__SS__!.step(1)); expect(await page.evaluate(() => window.__SS__!.getEntity(2)!.vehicle!.driver)).toBeNull();
});
test('T-E09-asset @E09-AC01 dynamically spawned integrated fire engine renders and unloads its native resources', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('survivor'); a.pause(); const id = a.spawn('vehicle.fire-engine', { x: 0, z: 12 }); a.camera.preset('vehicle'); await a.screenshotReady();
    return { vehicle: a.getState().render.vehicles.find(v => v.id === id), perf: a.perf() };
  });
  expect(result.vehicle).toBeDefined(); expect(result.vehicle!.placeholder).toBe(false); expect(result.vehicle!.wheels).toHaveLength(4);
  expect(result.perf.drawCalls).toBeLessThanOrEqual(600); expect(result.perf.triangles).toBeLessThanOrEqual(1_500_000);
  await page.screenshot({ path: 'test-results/epics/E09/fire-engine.png' });
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('empty'); a.pause(); await a.screenshotReady(); });
  const state = await page.evaluate(() => window.__SS__!.getState()); expect(state.perf.bodies).toBe(2); expect(state.render.vehicles).toEqual([]);
});
