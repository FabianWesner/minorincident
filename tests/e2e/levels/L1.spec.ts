import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 90_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal/);
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toContain('weapon.bat'); expect(save!.upgrades).toHaveLength(2);
  });

  for (const assisted of [false, true]) test(assisted
    ? 'T-E19-23 @E19 @E19-AC23 assisted visual capture: 9 photo spots for vision review'
    : 'T-E19-22 @E19 @E19-AC22 @E19-AC15 unassisted real-input bicycle playthrough from title to result', async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(60_000); mkdirSync(output, { recursive: true }); // local headless preview needs ~19 s from Begin mission to the playable L1
    await menuStart(page);
    await page.evaluate(() => window.__SS__!.pause());
    if (assisted) await page.evaluate(() => window.__SS__!.cheats.god(true));
    const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
    const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
    const player = () => page.evaluate(() => window.__SS__!.getState().player!);
    const snap = async (name: string, focus?: { x: number; z: number }, reverse = false) => {
      if (!assisted) return;
      if (name === 'l1-accident') await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__SS__!.vfx.stepRender(1); });
      await page.evaluate(n => window.__SS__!.camera.preset('D-GROVE/W0/' + n), name);
      if (focus) await page.evaluate(({ p, reverse, name }) => {
        const a = window.__SS__!;
        const offset = name === 'l1-spread' ? 12 : 22;
        a.camera.cinematic({ position: [p.x + (reverse ? -offset : offset), 26, p.z + (reverse ? -offset : offset)], target: [p.x, 0, p.z] }, true);
      }, { p: focus, reverse, name });
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/${name}.png` }); await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
    };
    const waitBeat = async () => {
      for (let i = 0; i < 120 && (await mission()).l1!.beat; i++) await step(30);
    };
    /** Click the actual destination; reissue it after combat or respawn clears the movement target. */
    const go = async (target: { x: number; z: number }, stop = 1.2) => {
      await waitBeat();
      const activeBefore = Object.entries((await mission()).steps).find(([, s]) => s.status === 'active')?.[0];
      const start = (await player()).transform;
      if (Math.hypot(target.x - start.x, target.z - start.z) <= stop) return;
      const clickDestination = async () => {
        const start = (await player()).transform;
        // Frame both ends for a real ground click. This changes presentation only; routing remains the game's own.
        await page.evaluate(({ start, target }) => {
          const a = window.__SS__!, x = (start.x + target.x) / 2, z = (start.z + target.z) / 2;
          const radius = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
          a.camera.preset('D-GROVE/W0/l1-morning');
          a.camera.cinematic({ position: [x + radius, radius * 1.2, z + radius], target: [x, 0, z] }, true);
        }, { start, target });
        const point = await page.evaluate(q => window.__SS__!.input.project(q), target);
        const view = page.viewportSize()!;
        expect(point.x).toBeGreaterThan(20); expect(point.x).toBeLessThan(view.width - 20);
        expect(point.y).toBeGreaterThan(20); expect(point.y).toBeLessThan(view.height - 20);
        await page.mouse.click(point.x, point.y);
        await page.evaluate(() => window.__SS__!.camera.follow());
      };
      await clickDestination();
      for (let i = 0; i < 400; i++) {
        await step(30);
        const p = (await player()).transform;
        const m = await mission();
        // An objective trigger can stop movement and start a beat before the requested stop radius.
        if (Math.hypot(target.x - p.x, target.z - p.z) <= stop || m.phase !== 'playing' || (activeBefore && m.steps[activeBefore].status === 'completed')) return;
        if (!assisted && (await player()).weapons && await fightNearby(page)) await clickDestination();
        else if (i % 12 === 11) await clickDestination();
      }
      throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify(await player())}`);
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

    const mount = async () => {
      await waitBeat();
      const bike = await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })[0]);
      await go(bike.transform, 1.4);
      if (!(await player()).riding) await interact();
      expect((await player()).riding, 'Courier mounts using real input').toBe(bike.id);
    };
    if (!assisted) await mount();

    // Beat 2: the depot counter.
    await go(at('parcel-counter'), 1.2); await step(70);
    if (!(await mission()).completedObjectives.includes('pickup')) { await interact(); await step(4); }
    expect((await mission()).completedObjectives).toContain('pickup');
    await snap('l1-pickup');

    // Remount the bike parked at the depot, ride to the forecourt and auto-dismount.
    if (!assisted) await mount();
    await go(at('lab-door'), 1.2);
    expect((await player()).riding).toBeUndefined(); await snap('l1-facility');
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
    await step(assisted ? 300 : 60); await snap('l1-escape', at('lab-door'));

    // Beats 7 to 10: follow the objective, fight what blocks the way, interact at the garage, reach the fire station.
    const shots = new Set<string>(); let guard = 0;
    if (assisted) {
      // Follow a systemic victim for the spread photo: its location depends on the AI, not a scripted photo anchor.
      await go(at('garage-door'), 1.5);
      let victim = await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.infection?.phase === 'collapse' || e.infection?.phase === 'eyes'));
      for (let i = 0; i < 480 && !victim; i++) {
        await step(15);
        victim = await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.infection?.phase === 'collapse' || e.infection?.phase === 'eyes'));
      }
      expect(victim, 'A systemic pedestrian transformation is available for visual review').toBeDefined();
      await snap('l1-spread', victim!.transform); shots.add('l1-spread');
      writeFileSync(`${output}/spread-victim.json`, JSON.stringify(victim, null, 2) + '\n');
    }
    while (guard++ < 400) {
      const m = await mission();
      if (m.phase === 'cinematic' || m.phase === 'result') break;
      const active = Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0];
      if (!active) { await step(30); continue; }
      if (await fightNearby(page)) continue;
      if (assisted && active === 'firestation' && !shots.has('l1-horde')) {
        await waitBeat(); await go(at('photo-l1-horde'), 1.5); await step(1200);
        shots.add('l1-horde'); await snap('l1-horde', (await player()).transform, true);
      }
      if (active === 'firestation') {
        const door = at('fire-bay-door');
        if (!assisted && Math.hypot((await player()).transform.x - at('garage-bat').x, (await player()).transform.z - at('garage-bat').z) < 8) await go(at('garage-door'), 1.2);
        await go({ x: door.x, z: door.z - 5 }, 1);
        await step(20);
        expect((await mission()).phase).toBe('playing');
        expect((await mission()).l1!.beat).toBeFalsy();
        expect((await mission()).gates['fire-shutter']).toBe(true);
        expect((await mission()).l1!.say?.text).toBe('Get in!');
        if (assisted) {
          // Capture a fresh repeated invitation, rather than an expired bubble between calls.
          for (let i = 0; i < 8 && await page.evaluate(() => window.__SS__!.tick() - window.__SS__!.missions.state()!.l1!.say!.at > 30); i++) await step(30);
          await expect(page.getByText('Get in!', { exact: true }).first()).toBeVisible();
          await page.evaluate(p => window.__SS__!.camera.cinematic({ position: [p.x - 18, 20, p.z - 18], target: [p.x, 0, p.z] }, true), door);
          await page.evaluate(() => window.__SS__!.screenshotReady());
          await page.screenshot({ path: `${output}/firestation-invitation.png` });
          await page.evaluate(() => window.__SS__!.camera.follow());
        }
      }
      const goal = at(goals[active]);
      await go(goal, active === 'weapon' ? 1.2 : active === 'firestation' ? .25 : 1.5);
      if (active === 'weapon') {
        await interact(); await step(40);
        if (!shots.has('l1-garage')) { shots.add('l1-garage'); await snap('l1-garage'); }
      }
      if (active === 'escape' && !shots.has('l1-spread')) { shots.add('l1-spread'); await snap('l1-spread'); }
      if (active === 'firestation' && !shots.has('l1-horde')) { shots.add('l1-horde'); await snap('l1-horde'); }
    }
    if (assisted) expect(shots.has('l1-spread') && shots.has('l1-horde')).toBe(true);
    expect((await mission()).completedObjectives).toEqual(['pickup', 'deliver', 'escape', 'weapon', 'firestation']);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
    await step(2);
    await expect(page.getByTestId('mission-subtitle')).toHaveText(caption);
    if (!shots.has('l1-safe')) await snap('l1-safe', at('fire-bay-door'), true);
    for (let i = 0; i < 40 && (await mission()).phase !== 'result'; i++) await step(30);
    expect((await mission()).phase).toBe('result');
    await expect(page.getByTestId('mission-heading')).toHaveText(caption);
    await expect(page.getByTestId('result-delivered')).toHaveText('✓');
    writeFileSync(`${output}/${assisted ? 'assisted' : 'unassisted'}-result.json`, JSON.stringify(await mission(), null, 2) + '\n');
  });
});
