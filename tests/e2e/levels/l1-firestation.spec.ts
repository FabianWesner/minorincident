import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/**
 * L1 final stretch with real input (PO P0 2026-10-07: "Finishing L1 is almost impossible now"): from the bat in the Henderson
 * garage to Fire Station 3. Setup uses the debug objective skip and one teleport to the bat; from there the courier only gets
 * real mouse/keyboard input (click-to-move, moving bat swings). The open bay must face the game camera, the objective ring must lie on
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
  const fight = async (goal: { x: number; z: number }) => {
    const target = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.4).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      return near ? a.input.project(near.transform, 'player') : null;
    });
    if (!target) return false;
    await page.mouse.move(target.x, target.y);
    const p = (await player()).transform, dx = goal.x - p.x, dz = goal.z - p.z;
    const x = dx - dz, y = dx + dz, threshold = Math.max(Math.abs(x), Math.abs(y)) * .4;
    const keys = [...(Math.abs(x) > threshold ? [x > 0 ? 'd' : 'a'] : []), ...(Math.abs(y) > threshold ? [y > 0 ? 's' : 'w'] : [])];
    for (const key of keys) await page.keyboard.down(key);
    await page.keyboard.down('j'); await step(24); await page.keyboard.up('j');
    for (const key of keys) await page.keyboard.up(key);
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
  // PO 2026-10-08 route: the final leg runs back north across the spread; keep two game-camera frames of it (at 70 % and 35 % of
  // the straight-line distance left) next to the invitation shot.
  const legStart = Math.hypot((await player()).transform.x - trigger.x, (await player()).transform.z - trigger.z), legShots = [.7, .35];
  const junctions = [{ x: 14, z: 30 }, { x: 14, z: -36 }, { x: 40.03, z: -36 }, trigger];
  let leg = 0;
  for (let i = 0; i < 500 && (await mission()).phase === 'playing'; i++) {
    const p = (await player()).transform;
    if (leg < junctions.length - 1 && Math.hypot(p.x - junctions[leg].x, p.z - junctions[leg].z) < 1.2) leg++;
    const goal = junctions[leg];
    if (legShots.length && Math.hypot(p.x - trigger.x, p.z - trigger.z) < legStart * legShots[0]) {
      const n = 3 - legShots.length; legShots.shift();
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/final-leg-${n}.png` });
    }
    // Within 6 m: since 2026-10-08 the courier arrives along Main Row from the west, i.e. toward screen-right, where the half-width
    // of the follow camera's view is ~8 m (approaching from the east along Elm Street the old bay was in view from 9 m).
    if (!shot && Math.hypot(p.x - trigger.x, p.z - trigger.z) < 6 && (await mission()).l1!.say?.text === 'Get in!') {
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
    // Capture the invitation before attacking/moving through its reach volume.
    await fight(goal);
    if (i % 4 === 0) await click(goal);
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
