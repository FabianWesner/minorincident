import { expect, test } from './fixtures';
import { menuStart } from './ui-helpers';
type Page = import('@playwright/test').Page;
const step = (page: Page, n: number) => page.evaluate(async k => { const a = window.__SS__!; for (let i = 0; i < k; i++) { await a.step(1); a.vfx.stepRender(1 / 60); } }, n);

test('E19 @E19 PO respawn: after dying, a left click on the ground moves (no stale attack, props never targeted)', async ({ page }) => {
  test.setTimeout(240_000); await menuStart(page);
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.loadLevel('L1', { checkpoint: 'accident' }); a.pause(); a.setLoadout(['weapon.fists'], ['weapon.fists']); });
  await step(page, 180);
  // Fight with a held LMB at the cursor, then die mid-swing (button still down).
  const p0 = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  const near = await page.evaluate(q => window.__SS__!.input.project({ x: q.x + 1.2, z: q.z }), p0);
  await page.mouse.move(near.x, near.y); await page.keyboard.down('Shift'); await page.mouse.down(); await step(page, 20);
  await page.evaluate(() => window.__SS__!.survivor.damage(1000)); await step(page, 5);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBe(0);
  await page.keyboard.up('Shift'); await step(page, 200);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBeGreaterThan(0);
  await page.mouse.up();
  // This checkpoint respawns beside the bat and starts its scripted rack grab.
  // Measure controls after that intentional input lock has finished.
  await page.evaluate(() => window.__SS__!.cheats.god(true)); await step(page, 360);
  expect(await page.evaluate(() => window.__SS__!.missions.state()?.l1?.beat)).toBeNull();
  // A Shift keyup lost during death/retry (dispatched keydown only): stale key state must not turn clicks into swings.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' })));
  const attacks = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack').length);
  const p1 = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  // Click the nearest prop (car/bin/toy) if one is on screen, else open ground: both must be click-to-move.
  const prop = await page.evaluate(q => window.__SS__!.query({}).filter(e => e.faction === 'environment' && e.combat && e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - q.x, a.transform.z - q.z) - Math.hypot(b.transform.x - q.x, b.transform.z - q.z))[0]?.transform ?? null, p1);
  const goal = prop && Math.hypot(prop.x - p1.x, prop.z - p1.z) < 6 ? prop : { x: p1.x + 3, z: p1.z - 3 };
  const pt = await page.evaluate(q => window.__SS__!.input.project(q), goal);
  await page.mouse.click(pt.x, pt.y); const frame = await page.evaluate(async () => { await window.__SS__!.step(1); return window.__SS__!.getState().input.frame; });
  expect(frame.attackTarget).toBeUndefined(); expect(frame.moveTarget).toBeDefined();
  // A nearby solid prop can already be inside the stopping clearance. Keep the
  // prop classification check, then measure travel toward unobstructed ground.
  const ground = await page.evaluate(p => {
    const a = window.__SS__!;
    return [[3, -3], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3]]
      .map(([x, z]) => ({ x: p.x + x, z: p.z + z })).find(at => a.input.visible(at));
  }, p1);
  expect(ground, 'respawn fixture has unobstructed ground to test movement').toBeDefined();
  const walk = await page.evaluate(q => window.__SS__!.input.project(q), ground!);
  await page.mouse.click(walk.x, walk.y);
  await step(page, 60);
  const p2 = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  expect(Math.hypot(p2.x - p1.x, p2.z - p1.z), JSON.stringify({ p1, prop, ground, p2 })).toBeGreaterThan(.5);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack').length)).toBe(attacks);
});
