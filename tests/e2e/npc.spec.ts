import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from './fixtures';
const output = 'test-results/epics/E08';
test('T-E08-08 @E08 @E08-AC08 stand interaction toggles escort follow/wait with visible overhead icons', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('turning-probe'); api.pause(); api.npcs.escort({ x: 1, z: 0 }); await api.step(120); });
  await expect(page.locator('[data-escort-id]')).toHaveAttribute('data-order', 'wait'); await expect(page.locator('[data-escort-id]')).toHaveText('Ⅱ'); await expect(page.locator('[data-escort-id]')).toBeVisible();
  mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/escort-wait.png` });
  await page.evaluate(async () => { const api = window.__SS__!; api.teleport('player', { x: -2, z: 0 }); await api.step(1); api.teleport('player', { x: 0, z: 0 }); await api.step(120); });
  await expect(page.locator('[data-escort-id]')).toHaveAttribute('data-order', 'follow'); await expect(page.locator('[data-escort-id]')).toHaveText('↑'); await page.screenshot({ path: `${output}/escort-follow.png` });
});
test('T-E08-05-browser @E08 @E08-AC05 bark from real camera frustum is directional and reaches HUD', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('civ-street'); api.pause(); api.camera.preset('corgi'); api.spawn('infected.runner', { x: -17, z: 0 }, { state: 'chase' }); await api.step(1); });
  expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'corgi.bark' && e.direction.x < 0))).toBe(true); await expect(page.locator('[data-corgi-warning]')).toBeVisible(); await page.screenshot({ path: `${output}/corgi-warning.png` });
});
test('T-E08-10-browser @E08 @E08-AC10 placeholder corgi turntable and runtime node contract', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('civ-street'); api.pause(); api.camera.preset('corgi'); await api.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.getState().render.npcs!.heroes.find(h => h.id === window.__SS__!.query({ kind: 'companion' })[0].id)!.nodes)).toEqual(expect.arrayContaining(['root', 'body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR', 'packSocket']));
  for (const [name, position] of Object.entries({ front: [6, 2.5, 2], back: [-6, 2.5, 2], left: [0, 2.5, -4], right: [0, 2.5, 8] })) {
    await page.evaluate(async position => { const api = window.__SS__!; api.camera.cinematic({ position: position as [number, number, number], target: [0, .35, 2] }); api.vfx.stepRender(1); await api.screenshotReady(); }, position);
    await page.screenshot({ path: `${output}/corgi-${name}.png` });
  }
});
test('@E08 ambient civilian rendering stays instanced and inside frame geometry budgets', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('civ-street'); api.pause(); await api.screenshotReady(); });
  const result = await page.evaluate(() => ({ crowd: window.__SS__!.getState().render.npcs!.civilians, perf: window.__SS__!.perf() }));
  expect(result.crowd.instances).toBe(30); expect(result.crowd.draws).toBe(1); expect(result.perf.drawCalls).toBeLessThan(600); expect(result.perf.triangles).toBeLessThan(1500000);
  writeFileSync(`${output}/render-perf.json`, JSON.stringify(result, null, 2));
});
test('T-E08-16 @E08 @E08-AC16 five down/veins/eyes/rising frames show civilian turning', async ({ page }) => {
  await boot(page); const setup = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('turning-probe', { seed: 42 }); api.pause(); api.camera.preset('turning-probe'); api.cheats.god(true);
    const id = api.npcs.civilian('cashier', { x: 5, z: 0 }, { waypoints: [{ x: 5, z: 0 }] }), attacker = api.spawn('infected.runner', { x: 5, z: 0 }); api.npcs.grab(id, attacker); await api.step(90); const biteEnd = api.getEntity(id)!.civilian!.until; await api.step(biteEnd - api.tick()); api.teleport(attacker, { x: 40, z: 40 });
    return { id, downStart: api.tick(), downEnd: api.getEntity(id)!.civilian!.until };
  });
  const poses = [{ name: 'down', tick: setup.downStart }, { name: 'veins', tick: setup.downEnd - 121 }, { name: 'eyes', tick: setup.downEnd - 60 }, { name: 'rising', tick: setup.downEnd + 36 }, { name: 'upright', tick: setup.downEnd + 71 }];
  const frames = [];
  for (const pose of poses) {
    const state = await page.evaluate(async ({ tick, id }) => { const api = window.__SS__!; await api.step(tick - api.tick()); await api.screenshotReady(); return { entity: api.getEntity(id), perf: api.perf() }; }, { tick: pose.tick, id: setup.id }); frames.push({ ...pose, ...state });
    expect(state.entity!.civilian!.state).toBe(pose.name === 'rising' || pose.name === 'upright' ? 'rising' : 'down'); expect(state.entity!.civilian!.eyesGlow).toBe(!['down', 'veins'].includes(pose.name));
    await page.screenshot({ path: `${output}/turning-${pose.name}.png` });
  }
  writeFileSync(`${output}/frames.json`, JSON.stringify(frames, null, 2)); expect(frames[2].entity!.civilian!.veins).toBeGreaterThan(frames[1].entity!.civilian!.veins);
  expect(frames[0].perf.drawCalls).toBeLessThan(600);
});
