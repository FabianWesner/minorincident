import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/**
 * L1 final stretch with real input (PO P0 2026-10-07: "Finishing L1 is almost impossible now"): from the bat in the Henderson
 * garage to Fire Station 3. Setup uses the debug objective skip and one teleport to the bat; from there the courier only gets
 * real mouse/keyboard input (click-to-move, Shift-attack). The open bay must face the game camera, the objective ring must lie on
 * the floor at the completion trigger, nothing may block it, and the level must complete. Browser only via tools/e2e-lock.sh.
 */
const output = 'test-results/epics/E19/l1v2';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
const caption = 'Delivery complete. Outbreak: not contained.';
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E19-finale @E19 @E19-AC22 real input from the bat to the open fire-station bay completes L1 (bay faces the camera, ring on the trigger)', async ({ page }) => {
  test.setTimeout(600_000); page.setDefaultTimeout(60_000); mkdirSync(output, { recursive: true });
  await menuStart(page);
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  // Setup: skip to the weapon objective, then stand at the bat and take it with a real E press.
  for (let i = 0; i < 6 && (await mission()).steps.weapon.status !== 'active'; i++) await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  for (let i = 0; i < 20 && (await mission()).l1!.beat; i++) await step(30);
  await page.evaluate(p => window.__SS__!.teleport('player', p), at('garage-bat'));
  await step(2);
  for (let i = 0; i < 4 && (await mission()).steps.weapon.status !== 'completed'; i++) { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(70); }
  expect((await mission()).steps.weapon.status).toBe('completed');
  for (let i = 0; i < 40 && (await mission()).l1!.beat; i++) await step(30);

  const trigger = at('fire-bay-trigger');
  const fight = async () => {
    const target = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.4).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      return near ? a.input.project(near.transform) : null;
    });
    if (!target) return false;
    await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(24); await page.mouse.up(); await page.keyboard.up('Shift');
    return true;
  };
  /** Real click on the ground at `goal`, framed so the click lands on screen (presentation only; routing is the game's). */
  const click = async (goal: { x: number; z: number }) => {
    const start = (await player()).transform;
    const d = Math.hypot(goal.x - start.x, goal.z - start.z), k = Math.min(1, 26 / Math.max(d, 1)), g = { x: start.x + (goal.x - start.x) * k, z: start.z + (goal.z - start.z) * k };
    await page.evaluate(({ start, g }) => {
      const a = window.__SS__!, x = (start.x + g.x) / 2, z = (start.z + g.z) / 2, r = Math.max(20, Math.hypot(g.x - start.x, g.z - start.z) + 12);
      a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
    }, { start, g });
    const point = await page.evaluate(q => window.__SS__!.input.project(q), g);
    await page.mouse.click(point.x, point.y);
    await page.evaluate(() => window.__SS__!.camera.follow());
  };
  let shot = false;
  for (let i = 0; i < 500 && (await mission()).phase === 'playing'; i++) {
    if (await fight()) continue;
    const p = (await player()).transform;
    if (!shot && Math.hypot(p.x - trigger.x, p.z - trigger.z) < 9 && (await mission()).l1!.say?.text === 'Get in!') {
      // The game follow camera (no override): the open bay, the waving firefighter and the floor ring must be in view.
      shot = true; await step(10);
      const view = await page.evaluate(q => ({ trigger: window.__SS__!.input.project(q), size: { w: innerWidth, h: innerHeight } }), trigger);
      expect(view.trigger.x).toBeGreaterThan(0); expect(view.trigger.x).toBeLessThan(view.size.w); expect(view.trigger.y).toBeGreaterThan(0); expect(view.trigger.y).toBeLessThan(view.size.h);
      // The objective ring lies on the raised bay floor at the completion trigger, not under it.
      const marker = await page.evaluate(() => window.__SS__!.getState().render.missionMarker!);
      expect(marker.visible).toBe(true);
      expect(Math.hypot(marker.position[0] - trigger.x, marker.position[2] - trigger.z)).toBeLessThan(.01);
      expect(marker.position[1]).toBeGreaterThan(.3);
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/firestation-game-camera.png` });
    }
    if (i % 4 === 0) await click(trigger);
    await step(30);
  }
  const m = await mission();
  expect(m.completedObjectives).toContain('firestation');
  expect(shot, 'the invitation was captured from the game camera').toBe(true);
  for (let i = 0; i < 40 && (await mission()).phase !== 'result'; i++) await step(30);
  expect((await mission()).phase).toBe('result');
  await expect(page.getByTestId('mission-heading')).toHaveText(caption);
  writeFileSync(`${output}/finale-result.json`, JSON.stringify({ deaths: m.stats.deaths, time: m.stats.time, result: (await mission()).result }, null, 2) + '\n');
});
