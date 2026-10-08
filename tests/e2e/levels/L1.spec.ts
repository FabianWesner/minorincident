import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/** L1 v2 real-input playthrough (AC22). Browser runs only through tools/e2e-lock.sh. */
const output = 'test-results/epics/E19/l1v2';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }>; colliders: { aabb: { min: number[]; max: number[] } }[]; placements: { assetId: string; position: number[] }[] };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
/** Game follow camera offset at zoom 1 (View: radius 19, polar 0.3 pi, azimuth pi/4); the player may zoom 0.5 to 1.45. */
const gameOffset = [10.87, 11.17, 10.87];
const screens = layout.placements.filter(q => /fence|hedge|bush|tree|lamp|sign/.test(q.assetId));
/** Only things between the body and the game camera (which looks from +x +z) can screen it. */
const cameraSide = (p: { x: number; z: number }, x: number, z: number) => (x - p.x + z - p.z) / Math.SQRT2 > -.3;
const closest = (p: { x: number; z: number }, c: { aabb: { min: number[]; max: number[] } }) => ({ x: Math.min(Math.max(p.x, c.aabb.min[0]), c.aabb.max[0]), z: Math.min(Math.max(p.z, c.aabb.min[2]), c.aabb.max[2]) });
/** AC23 framing: no fence, hedge, bush, tree, lamp, sign or wall on the camera side of the body, so it is not screened. */
const openGround = (p: { x: number; z: number }) => !screens.some(q => cameraSide(p, q.position[0], q.position[2]) && Math.hypot(q.position[0] - p.x, q.position[2] - p.z) < (/tree/.test(q.assetId) ? 3 : /lamp|sign/.test(q.assetId) ? 1.8 : 2.6))
  && !layout.colliders.some(c => { const q = closest(p, c); return cameraSide(p, q.x, q.z) && Math.hypot(q.x - p.x, q.z - p.z) < 2.2; });
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
    /** `zoom` frames the focus with the game follow camera itself (its angle, at a zoom the player can pick). */
    const snap = async (name: string, focus?: { x: number; z: number }, reverse = false, zoom?: number) => {
      if (!assisted) return;
      if (name === 'l1-accident') await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__SS__!.vfx.stepRender(1); });
      await page.evaluate(n => window.__SS__!.camera.preset('D-GROVE/W0/' + n), name);
      if (focus && zoom) await page.evaluate(({ p, o }) => window.__SS__!.camera.cinematic({ position: [p.x + o[0], o[1], p.z + o[2]], target: [p.x, 0, p.z] }, true), { p: focus, o: gameOffset.map(v => v * zoom) });
      else if (focus) await page.evaluate(({ p, reverse }) => {
        const a = window.__SS__!, offset = 22;
        a.camera.cinematic({ position: [p.x + (reverse ? -offset : offset), 26, p.z + (reverse ? -offset : offset)], target: [p.x, 0, p.z] }, true);
      }, { p: focus, reverse });
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
      const around = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 4).map(e => ({ id: e.id, x: +e.transform.x.toFixed(2), z: +e.transform.z.toFixed(2), hp: e.health.current, state: e.infected?.state, mode: e.infected?.l1?.mode })); });
      throw new Error(`Could not travel to ${JSON.stringify(target)}; infected within 4 m ${JSON.stringify(around)} from ${JSON.stringify((await player()).transform)}; bicycle=${JSON.stringify(await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })))} `);
    };
    const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(1); };
    /** Like a player, give up on an infected the strikes do not reach (e.g. across the lab fence): no HP lost in 3 tries. */
    const futile = new Map<number, { hp: number; tries: number }>();
    const fightNearby = async (page: Page) => {
      const skip = [...futile].filter(([, f]) => f.tries >= 3).map(([id]) => id);
      const target = await page.evaluate(skip => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !skip.includes(e.id) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
        return near ? { id: near.id, hp: near.health.current, ...a.input.project(near.transform) } : null;
      }, skip);
      if (!target) return false;
      const seen = futile.get(target.id);
      futile.set(target.id, { hp: target.hp, tries: seen && seen.hp <= target.hp ? seen.tries + 1 : 0 });
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
      // Follow a systemic victim for the spread photo: its location depends on the AI, not a scripted photo anchor. Prefer the
      // first bite on open ground (a body behind a fence or hedge is screened from the game camera); else the first one seen.
      await go(at('garage-door'), 1.5);
      const turning = () => page.evaluate(() => window.__SS__!.getState().entities.filter(e => e.infection && e.infection.phase !== 'rise').map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z })));
      let victimId: number | undefined;
      for (let i = 0; i < 900 && victimId === undefined; i++) {
        const now = await turning();
        victimId = (now.find(openGround) ?? (i >= 720 ? now[0] : undefined))?.id;
        if (victimId === undefined) await step(10);
      }
      expect(victimId, 'A systemic pedestrian transformation is available for visual review').toBeDefined();
      // Observe the same victim (without moving it) until it is rising: glowing eyes, ash skin, its own clothes and hair.
      const observe = () => page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id), victimId!);
      let victim = await observe();
      for (let i = 0; i < 120 && victim?.infection && victim.infection.phase !== 'rise'; i++) { await step(2); victim = await observe(); }
      expect(victim!.infection?.phase, 'the victim was already risen when observed; widen the search').toBe('rise');
      await step(18); victim = await observe();
      expect(victim!.civilian, 'still mid-transformation (rising)').toBeDefined();
      await snap('l1-spread', victim!.transform, false, .75); shots.add('l1-spread');
      writeFileSync(`${output}/spread-victim.json`, JSON.stringify({ openGround: openGround(victim!.transform), ...victim }, null, 2) + '\n');
    }
    while (guard++ < 400) {
      const m = await mission();
      if (m.phase === 'cinematic' || m.phase === 'result') break;
      const active = Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0];
      if (!active) { await step(30); continue; }
      if (!assisted && await fightNearby(page)) continue;
      if (assisted && active === 'firestation' && !shots.has('l1-horde')) {
        await waitBeat(); await go(at('photo-l1-horde'), 1.5);
        // The residents of one house near the garage come out one by one (1.5-4 s apart, ~25 s for all ten) and bite their way up: photograph it arriving on the street (>= 12 within 16 m), not after it
        // has piled onto the immortal courier. Game camera at the widest zoom the player can choose.
        const crowd = () => page.evaluate(() => {
          const a = window.__SS__!, p = a.getState().player!.transform, live = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden);
          const d = (e: { transform: { x: number; z: number } }) => Math.hypot(e.transform.x - p.x, e.transform.z - p.z);
          return { within2m: live.filter(e => d(e) < 2).length, within8m: live.filter(e => d(e) < 8).length, within16m: live.filter(e => d(e) < 16).length, within25m: live.filter(e => d(e) < 25).length, live: live.length,
            bearingsDeg: live.filter(e => d(e) < 25).map(e => Math.round(Math.atan2(e.transform.z - p.z, e.transform.x - p.x) * 180 / Math.PI)) };
        });
        // PO rule 2026-10-07: the ten residents come out of one house 1.5-4 s apart (~25 s for all), so give the snowball up to 40 s.
        // Snap as the crowd closes in around the courier (>= 8 within 8 m, >= 12 within 16 m), framed on the courier at the north kerb.
        for (let i = 0; i < 160; i++) { const c = await crowd(); if (c.within16m >= 12 && c.within8m >= 8) break; await step(15); }
        shots.add('l1-horde'); const scene = await crowd(); await snap('l1-horde', (await player()).transform, false, 1.45);
        writeFileSync(`${output}/horde-scene.json`, JSON.stringify(scene, null, 2) + '\n');
      }
      if (active === 'firestation') {
        // The bay opens east toward the game camera (PO 2026-10-07): approach 5 m outside along the door -> trigger axis.
        const door = at('fire-bay-door'), inside = at('fire-bay-trigger'), len = Math.hypot(inside.x - door.x, inside.z - door.z);
        const outside = { x: door.x - (inside.x - door.x) / len * 5, z: door.z - (inside.z - door.z) / len * 5 };
        if (!assisted && Math.hypot((await player()).transform.x - at('garage-bat').x, (await player()).transform.z - at('garage-bat').z) < 8) await go(at('garage-door'), 1.2);
        await go(outside, 1);
        await step(20);
        expect((await mission()).phase).toBe('playing');
        expect((await mission()).l1!.beat).toBeFalsy();
        expect((await mission()).gates['fire-shutter']).toBe(true);
        expect((await mission()).l1!.say?.text).toBe('Get in!');
        if (assisted) {
          // Capture a fresh repeated invitation, rather than an expired bubble between calls.
          for (let i = 0; i < 8 && await page.evaluate(() => window.__SS__!.tick() - window.__SS__!.missions.state()!.l1!.say!.at > 30); i++) await step(30);
          await step(10); // Let the normal ten-tick speech fade-in finish.
          await expect(page.getByText('Get in!', { exact: true }).first()).toBeVisible();
          await page.evaluate(p => window.__SS__!.camera.cinematic({ position: [p.x + 18, 20, p.z + 18], target: [p.x, 0, p.z] }, true), door);
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
    if (!shots.has('l1-safe')) await snap('l1-safe', at('fire-bay-door'));
    for (let i = 0; i < 40 && (await mission()).phase !== 'result'; i++) await step(30);
    expect((await mission()).phase).toBe('result');
    await expect(page.getByTestId('mission-heading')).toHaveText(caption);
    await expect(page.getByTestId('result-delivered')).toHaveText('✓');
    writeFileSync(`${output}/${assisted ? 'assisted' : 'unassisted'}-result.json`, JSON.stringify(await mission(), null, 2) + '\n');
  });
});
