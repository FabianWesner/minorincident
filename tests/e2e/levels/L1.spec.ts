import { mkdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/** L1 v2 real-input playthrough (AC22). Browser runs only through tools/e2e-lock.sh. */
const output = 'test-results/epics/E19/l1v2';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
const goals: Record<string, string> = { pickup: 'parcel-counter', deliver: 'lab-door', escape: 'garage-door', weapon: 'garage-bat', firestation: 'fire-bay-trigger' };
const caption = 'Delivery complete. Outbreak: not contained.';
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('L1 v2 real-input playthrough', () => {
  test.fixme('T-E19-13 @E19 @E19-AC13 walk modifier: run by default, hold Walk at 2.0 m/s on keyboard and mouse', async () => {});

  test('T-E19-unlock @E19 result screen, real click on Continue: straight to the next level, no upgrade/rack screens (PO decision 2026-10-07)', async ({ page }) => {
    test.setTimeout(300_000); page.setDefaultTimeout(90_000);
    await menuStart(page);
    await page.evaluate(() => window.__SS__!.pause());
    for (let i = 0; i < 12; i++) {
      const phase = await page.evaluate(() => window.__SS__!.missions.state()!.phase);
      if (phase === 'cinematic' || phase === 'result') break;
      await page.evaluate(() => window.__SS__!.cheats.completeObjective());
    }
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) !== 'result'; i++) await page.evaluate(() => window.__SS__!.step(30));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible();
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal/);
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toContain('weapon.bat'); expect(save!.upgrades).toHaveLength(2);
  });

  test('T-E19-22 @E19 @E19-AC22 headless real-input playthrough from title to result, 9 photo spots, end caption', async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(60_000); mkdirSync(output, { recursive: true }); // local headless preview needs ~19 s from Begin mission to the playable L1
    await menuStart(page);
    await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); }); // survival aid only: all movement, interaction and combat input stays real
    const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
    const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
    const player = () => page.evaluate(() => window.__SS__!.getState().player!);
    const snap = async (name: string) => {
      await page.evaluate(n => window.__SS__!.camera.preset('D-GROVE/W0/' + n), name); await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/${name}.png` }); await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
    };
    /** Click-to-move toward a world point: real mouse clicks on the ground, the game paths around obstacles. */
    const go = async (target: { x: number; z: number }, stop = 1.2) => {
      for (let i = 0; i < 400; i++) {
        const p = (await player()).transform, d = Math.hypot(target.x - p.x, target.z - p.z);
        if (d <= stop || (await mission()).phase !== 'playing') return;
        // Click on screen only: 6 m toward the goal can project below the viewport at the follow camera (it then
        // never reaches the canvas, which read as "click-to-move stalls"). Shorten the step until it is visible.
        let k = Math.min(6, d) / d, point = await page.evaluate(q => window.__SS__!.input.project(q), { x: p.x + (target.x - p.x) * k, z: p.z + (target.z - p.z) * k });
        const view = page.viewportSize()!;
        for (let shrink = 0; shrink < 6 && (point.x < 20 || point.y < 20 || point.x > view.width - 20 || point.y > view.height - 20); shrink++) {
          k *= .7; point = await page.evaluate(q => window.__SS__!.input.project(q), { x: p.x + (target.x - p.x) * k, z: p.z + (target.z - p.z) * k });
        }
        await page.mouse.click(point.x, point.y); await step(30);
      }
      throw new Error(`Could not walk to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)}`);
    };
    const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(1); };
    const fightNearby = async (page: Page) => {
      const target = await page.evaluate(() => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
        return near ? a.input.project(near.transform) : null;
      });
      if (!target) return false;
      // Shift attack-in-place: stand and strike the infected under the cursor.
      await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(24); await page.mouse.up(); await page.keyboard.up('Shift');
      return true;
    };

    expect((await mission()).l1).toBeDefined();
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons)).toBeUndefined();
    await snap('l1-morning');

    // Beat 2: the depot counter.
    await go(at('parcel-counter'), 1.2); await step(70);
    if (!(await mission()).completedObjectives.includes('pickup')) { await interact(); await step(4); }
    expect((await mission()).completedObjectives).toContain('pickup');
    await snap('l1-pickup');

    // Beats 3 and 4: to the facility, then hand over; the bicycle is optional (F), the walk is the contract.
    await go(at('lab-door'), 1.2); await snap('l1-facility');
    await interact();
    for (let i = 0; i < 60 && !(await mission()).l1!.delivered; i++) await step(30);
    expect((await mission()).l1!.delivered).toBe(true);
    await expect(page.getByTestId('mission-subtitle')).toHaveText('Delivered ✓');

    // Beat 5: 4 to 6 s of calm, then the accident.
    expect((await mission()).l1!.exitIds).toHaveLength(0);
    for (let i = 0; i < 20 && !(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'l1.smoke'))); i++) await step(30);
    await step(45); await snap('l1-accident');
    const order = await page.evaluate(() => window.__SS__!.events().filter(e => e.type.startsWith('l1.')).map(e => e.type));
    expect(order.slice(0, 5)).toEqual(['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams']);

    // Beat 6: five infected exit; get away.
    for (let i = 0; i < 40 && (await mission()).l1!.exitIds.length === 0; i++) await step(30);
    expect((await mission()).l1!.exitIds).toHaveLength(5);
    await step(60); await snap('l1-escape');

    // Beats 7 to 10: follow the objective, fight what blocks the way, interact at the garage, reach the fire station.
    const shots = new Set<string>(); let guard = 0;
    while (guard++ < 400) {
      const m = await mission();
      if (m.phase === 'cinematic' || m.phase === 'result') break;
      const active = Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0];
      if (!active) { await step(30); continue; }
      if (await fightNearby(page)) continue;
      const goal = at(goals[active]);
      await go(goal, active === 'weapon' ? 1.2 : active === 'firestation' ? 2.5 : 1.5);
      if (active === 'weapon') {
        await interact(); await step(40);
        if (!shots.has('l1-garage')) { shots.add('l1-garage'); await snap('l1-garage'); }
      }
      if (active === 'escape' && !shots.has('l1-spread')) { shots.add('l1-spread'); await snap('l1-spread'); }
      if (active === 'firestation' && !shots.has('l1-horde')) { shots.add('l1-horde'); await snap('l1-horde'); }
    }
    expect((await mission()).completedObjectives).toEqual(['pickup', 'deliver', 'escape', 'weapon', 'firestation']);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
    await step(2);
    await expect(page.getByTestId('mission-subtitle')).toHaveText(caption);
    await snap('l1-safe');
    for (let i = 0; i < 40 && (await mission()).phase !== 'result'; i++) await step(30);
    expect((await mission()).phase).toBe('result');
    await expect(page.getByTestId('mission-heading')).toHaveText(caption);
    await expect(page.getByTestId('result-delivered')).toHaveText('✓');
  });
});
