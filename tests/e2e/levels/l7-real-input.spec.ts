import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../../src/Game';
import { test, expect, boot } from '../fixtures';

/** Full production route: setup loads the level; every subsequent action is a
 * DOM mouse/key event. No injected frame, teleport or mission completion. */
test('T-E29-17 @E29-AC17 real mouse/keyboard completes Northgate, horde, bus and L8 handover', async ({ page }) => {
  test.setTimeout(1_200_000);
  const out = 'test-results/epics/E29/real-input'; mkdirSync(out, { recursive: true });
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&ui=1&quality=high&audio=muted&dpr=1');
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.pause(); a.camera.follow(); });
  const step = (n: number) => page.evaluate(async n => { const a = window.__SS__!; if (a.getState().scenario === 'L7') { a.pause(); await a.step(n); } }, n);
  const shot = async (name: string) => { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${name}.png` }); };
  await shot('night-exit');
  const route = [{ x: 233, z: 15 }, { x: 173, z: 15 }, { x: 113, z: 15 }, { x: 88, z: 15 }, { x: 88, z: 46 }, { x: 30, z: 46 }, { x: -30, z: 46 }, { x: -70.5, z: 47.5 }];
  let index = 0, armed = false, corridor = false, fired = false;
  for (let i = 0; i < 4000; i++) {
    const s = await page.evaluate(() => {
      const a = window.__SS__!, s = a.getState(), p = s.player!.transform;
      const distance = (at: { x: number; z: number }) => Math.hypot(at.x - p.x, at.z - p.z);
      const pickup = a.query({}).find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher');
      const enemy = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform) < 24 && a.input.visible(e.transform)).sort((a, b) => distance(a.transform) - distance(b.transform))[0];
      return { scenario: s.scenario, p, pickup: pickup?.transform, enemy: enemy?.transform, checkpoint: a.missions.state()?.checkpoint, l7: s.l7, bus: s.l7Departure, hp: s.player!.health.current };
    });
    if (s.scenario === 'L8') break;
    expect(s.hp).toBeGreaterThan(0);
    if (!s.pickup && !armed) { armed = true; await shot('rocket-pickup'); }
    if (s.checkpoint === 'corridor' && !corridor) { corridor = true; await shot('final-horde-before'); }
    if (s.bus?.phase === 'departing') { await shot('burning-skyline-start'); await step(420); await shot('burning-skyline-end'); await step(120); continue; }
    if (!s.pickup && index < route.length - 1 && Math.hypot(s.p.x - route[index].x, s.p.z - route[index].z) < 3) index++;
    const goal = s.pickup ?? route[index], dx = goal.x - s.p.x, dz = goal.z - s.p.z, d = Math.hypot(dx, dz);
    const followers = s.l7!.roster.filter(r => r.status === 'following' && !s.bus!.boarded.includes(r.id));
    const wait = !s.pickup && d > 10 && await page.evaluate(({ ids, limit }) => { const a = window.__SS__!, p = a.getEntity(1)!.transform; return ids.some(id => { const e = a.getEntity(id)!; return Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > limit; }); }, { ids: followers.map(r => r.id), limit: Math.max(12, Math.ceil(followers.length / 3) * 1.2 + 5) });
    const move = await page.evaluate(({ goal, wait, stop }) => {
      if (wait) return { x: 0, z: 0 };
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world, p = w.entities.get(1)!.transform;
      if (Math.hypot(goal.x - p.x, goal.z - p.z) < stop) return { x: 0, z: 0 };
      const at = { x: 0, z: 0 }, path = { path: [] as number[], goal: -1, pathIndex: 0 };
      if (!w.infected!.nav.steer(p, goal, path, .45, at, Infinity, true)) return { x: 0, z: 0 };
      return { x: at.x - p.x, z: at.z - p.z };
    }, { goal, wait, stop: s.pickup ? 1.3 : 1 });
    const sx = (move.x - move.z) / Math.SQRT2, sy = (move.x + move.z) / Math.SQRT2, scale = Math.max(Math.abs(sx), Math.abs(sy));
    const keys: string[] = [];
    if (scale > .05) { if (sx > scale * .4) keys.push('d'); if (sx < -scale * .4) keys.push('a'); if (sy > scale * .4) keys.push('s'); if (sy < -scale * .4) keys.push('w'); }
    if (s.pickup && d < 1.45) { await page.keyboard.down('e'); await step(40); await page.keyboard.up('e'); continue; }
    if (armed && s.enemy) {
      const aim = await page.evaluate(at => window.__SS__!.input.project(at, 'player'), s.enemy);
      await page.mouse.move(aim.x, aim.y); await page.keyboard.down('k'); fired = true;
    }
    for (const key of keys) await page.keyboard.down(key);
    await step(6);
    for (const key of keys) await page.keyboard.up(key);
    await page.keyboard.up('k');
    if (i % 100 === 0) writeFileSync(`${out}/progress.json`, JSON.stringify({ i, index, state: s }, null, 2));
  }
  expect(armed).toBe(true); expect(corridor).toBe(true); expect(fired).toBe(true);
  expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L8');
  await shot('zoo-arrival');
});

test.describe('L7 phone controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('T-E29-17-touch @E29-AC17 touch pickup and corridor checkpoint retain a bounded HUD', async ({ page, context }) => {
    test.setTimeout(180_000);
    await boot(page, '/?test=1&renderer=webgl&ui=1&quality=low&audio=muted&dpr=1');
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.settings.set({ quality: 'low' }); a.pause(); a.camera.follow(); });
    const cdp = await context.newCDPSession(page), origin = { x: 80, y: 600 };
    const move = async (target: { x: number; z: number }, stop: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...origin }] });
      for (let i = 0; i < 100; i++) {
        const p = await page.evaluate(() => window.__SS__!.getEntity(1)!.transform), dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d <= stop) break;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: origin.x + (dx - dz) / Math.SQRT2 / d * 60, y: origin.y + (dx + dz) / Math.SQRT2 / d * 60 }] });
        await page.evaluate(() => window.__SS__!.step(6));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.evaluate(() => window.__SS__!.step(1));
      const p = await page.evaluate(() => window.__SS__!.getEntity(1)!.transform);
      expect(Math.hypot(target.x - p.x, target.z - p.z)).toBeLessThanOrEqual(stop + .2);
    };
    const rocket = await page.evaluate(() => window.__SS__!.query({}).find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')!.transform);
    await move(rocket, 1.3); await page.getByTestId('touch-interact').tap(); await page.evaluate(() => window.__SS__!.step(40));
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('rocket');
    const out = 'test-results/epics/E29/real-input'; mkdirSync(out, { recursive: true }); await page.screenshot({ path: `${out}/phone-rocket.png` });
    // The desktop test owns the continuous cross-city route. This checkpoint
    // fixture isolates the same touch movement adapter at the corridor entrance.
    await page.evaluate(async () => {
      const a = window.__SS__!, origin = a.getEntity(1)!.transform, target = { x: -23, z: 47 };
      // Move the escort with this isolated touch fixture; the production reach
      // objective still requires every living follower within eighteen metres.
      for (const r of a.getState().l7!.roster.filter(r => r.status === 'following')) {
        const p = a.getEntity(r.id)!.transform;
        a.teleport(r.id, { x: p.x + target.x - origin.x, z: p.z + target.z - origin.z });
      }
      a.teleport('player', target); a.camera.follow(); await a.step(1);
    });
    await move({ x: -31, z: 47 }, 1);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('corridor');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const id of ['objective-tracker', 'vitals', 'touch-controls']) {
      const b = await page.getByTestId(id).boundingBox(); expect(b).not.toBeNull();
      expect(b!.x).toBeGreaterThanOrEqual(0); expect(b!.x + b!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: `${out}/phone-corridor.png` }); await cdp.detach();
  });
});
