import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { l3, l3Anchors } from '../../../src/data/l3';

/** E21 L3 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
const output = 'test-results/epics/E21';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
const at = (name: string) => ({ x: l3Anchors[name][0], z: l3Anchors[name][1] });
type P = { x: number; z: number };

function helpers(page: Page) {
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  const shots = new Set<string>();
  const snap = async (name: string) => {
    await page.evaluate(n => window.__SS__!.camera.preset(`D-CORRIDOR/W2/${n}`), name);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
    await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  };
  /** Shift + click the nearest infected within `range` (the active handgun shoots it, the axe swings at arm's length). */
  const fightNearby = async (range = 2.6): Promise<boolean> => {
    const target = await page.evaluate(range => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < range).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      return near ? a.input.project(near.transform) : null;
    }, range);
    if (!target) return false;
    await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(20); await page.mouse.up(); await page.keyboard.up('Shift');
    return true;
  };
  /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  const go = async (target: P, stop = 1.2, done?: () => Promise<boolean>, range = 2.6) => {
    const click = async () => {
      const start = (await player()).transform;
      await page.evaluate(({ start, target }) => {
        const a = window.__SS__!, x = (start.x + target.x) / 2, z = (start.z + target.z) / 2, r = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
        a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
      }, { start, target });
      const point = await page.evaluate(q => window.__SS__!.input.project(q), target);
      await page.mouse.click(point.x, point.y);
      await page.evaluate(() => window.__SS__!.camera.follow());
    };
    await click();
    let fights = 0;
    for (let i = 0; i < 600; i++) {
      await step(20);
      if (done && await done()) return;
      const p = (await player()).transform;
      if (Math.hypot(target.x - p.x, target.z - p.z) <= stop) return;
      // Fight a few, then break away (PO: fight a few, flee from many; knocked-down infected get up again).
      const crowd = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 10).length; });
      // Many ahead: back off along the street for a moment (they string out), then push on.
      if (crowd >= 4) {
        const p0 = (await player()).transform, back = { x: p0.x - 10, z: p0.z };
        const point = await page.evaluate(q => window.__SS__!.input.project(q), back); await page.mouse.click(point.x, point.y); await step(45); await click(); fights = 0;
      }
      else if (fights < 3 && (await player()).health.current > 0 && await fightNearby(range)) { fights++; await click(); }
      else if (fights >= 3) { if (++fights >= 8) fights = 0; if (fights === 4) await click(); }
      else if (i % 10 === 9) await click();
    }
    const why = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!; return { hp: p.health.current, deaths: a.missions.state()!.stats.deaths, near: a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 10).length }; });
    throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)} ${JSON.stringify(why)}`);
  };
  const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  return { step, mission, player, snap, shots, go, fightNearby, interact };
}
const begin = async (page: Page) => {
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L3', { seed: 1, progression: 'L3-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
};

test.describe('L3 The Police Collapse in the browser', () => {
  test('T-E21-19 @E21 @E21-AC19 @E21-AC04 @E21-AC20 real-input playthrough: armory, station attack, fallback, Commerce Street to the army zone; photo spots for the vision review', async ({ page }) => {
    test.setTimeout(1_800_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    await begin(page);
    const h = helpers(page), { step, mission, player, snap, go, interact, fightNearby } = h;
    await step(150); await snap('l3-station-yard');
    expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
    // The handgun: stand at the armory table and press E; it joins the carried weapons and is selected.
    await go(at('l3-armory'), .7); await interact();
    for (let i = 0; i < 10 && !(await mission()).l3!.handgunAt; i++) { await interact(); await step(10); }
    expect((await mission()).l3!.handgunAt).toBeGreaterThan(0);
    expect((await player()).weapons!.RIGHT.rack[0].id).toBe('weapon.handgun');
    expect((await player()).weapons!.selectedSide).toBe('RIGHT');
    // No ammunition HUD: the handgun card reads "Ready", never "n / m" or a reload ring.
    await expect(page.getByTestId('stats-RIGHT')).toHaveText('Ready');
    // Hold the yard with the police, shooting what comes through the gates.
    await go({ x: -134.5, z: 1.5 }, 1.2);
    for (let i = 0; i < 80 && !(await mission()).l3!.attackAt; i++) await step(20);
    expect((await mission()).l3!.attackAt).toBeGreaterThan(0);
    let attackShot = false;
    for (let i = 0; i < 400 && !(await mission()).l3!.fallbackAt; i++) {
      if (!await fightNearby(14)) await step(15);
      // The photo: once the attack is inside the frame (>= 4 infected within 15 m of the photo spot).
      const inFrame = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 141, e.transform.z + 13) < 15).length);
      if (!attackShot && inFrame >= 4) { await snap('l3-station-attack'); attackShot = true; }
    }
    const inside = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 141, e.transform.z + 13) < 15).length);
    if (!attackShot) await snap('l3-station-attack');
    console.log(JSON.stringify({ attackShotEarly: attackShot, inFrameAtFallback: inside }));
    expect((await mission()).l3!.fallbackAt).toBeGreaterThan(0);
    await expect(page.getByTestId('stats-RIGHT')).not.toHaveText(/\d+\s*\/\s*\d+|↻/);
    // Up Commerce Street to the army checkpoint (the squad follows), fighting the few that come close.
    const route: P[] = [{ x: -126, z: 0 }];
    for (let x = -110; x <= 120; x += 15) route.push({ x, z: 0 });
    route.push({ x: 129, z: 0 }, { x: 143.5, z: 0 });
    // Crossing the zone line ends L3 and the campaign hands over to L4: keep the last L3 state, stop touching the world then.
    const inL3 = () => page.evaluate(() => window.__SS__!.getState().scenario === 'L3' && window.__SS__!.missions.state()?.phase === 'playing');
    let last = await mission();
    for (const wp of route) {
      await go(wp, 2, async () => { if (!await inL3()) return true; last = await mission(); return false; }, 9);
      if (!await inL3()) break;
      const m = await mission(), p = (await player()).transform;
      if (!h.shots.has('l3-squad-strong') && p.x > -100 && p.x < -80) await snap('l3-squad-strong');
      if (!h.shots.has('l3-commerce-street') && p.x > 5) { await snap('l3-commerce-street'); await snap('l3-oak-avenue'); await snap('l3-grove-boulevard'); }
      if (!h.shots.has('l3-alone') && (p.x > 112 || (p.x > 90 && m.l3!.squad.length <= 1))) await snap('l3-alone');
      if (!h.shots.has('l3-army-checkpoint') && p.x > 126) await snap('l3-army-checkpoint');
    }
    for (const name of ['l3-squad-strong', 'l3-alone', 'l3-army-checkpoint']) if (!h.shots.has(name) && await inL3()) await snap(name);
    for (let i = 0; i < 60 && await inL3(); i++) { last = await mission(); await step(15); }
    // A hand-over in flight: wait for L4 to finish loading.
    await page.waitForFunction(() => { const a = window.__SS__!; return a.getState().scenario === 'L4' || !!a.missions.state()?.l3; }, undefined, { timeout: 120_000 });
    const scenario = await page.evaluate(() => window.__SS__!.getState().scenario), now = await mission();
    // Still on L3 with its state (result screen) or already handing over / on L4 (the L3 state is gone: use the last one seen).
    const handedOver = scenario !== 'L3' || !now?.l3;
    const final = !handedOver ? now : { ...last, phase: 'progression' as const, l3: { ...last.l3!, crossedAt: last.l3!.crossedAt || (scenario === 'L4' ? 1 : 0) } };
    writeFileSync(`${output}/browser-real-input.json`, JSON.stringify({ phase: final.phase, stats: final.stats, l3: { fallbackCause: final.l3!.fallbackCause, squadLost: final.l3!.lost, squad: final.l3!.squad.length }, shots: [...h.shots] }, null, 2) + '\n');
    expect(['result', 'progression']).toContain(final.phase);
    expect(final.l3!.crossedAt).toBeGreaterThan(0);
    expect([...h.shots].sort()).toEqual(['l3-alone', 'l3-army-checkpoint', 'l3-commerce-street', 'l3-grove-boulevard', 'l3-oak-avenue', 'l3-squad-strong', 'l3-station-attack', 'l3-station-yard']);
  });

  test('T-E21-17b @E21 @E21-AC17 campaign: crossing the army zone line loads L4 with the carried loadout and no reward screen', async ({ page }) => {
    test.setTimeout(600_000); page.setDefaultTimeout(120_000);
    await begin(page);
    for (let i = 0; i < 8; i++) {
      const m = await page.evaluate(() => window.__SS__!.missions.state());
      if (!m || m.phase !== 'playing' || (await page.evaluate(() => window.__SS__!.getState().scenario)) !== 'L3') break;
      await page.evaluate(() => window.__SS__!.cheats.completeObjective());
      if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L3')) await page.evaluate(() => window.__SS__!.step(2));
    }
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L4');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun']));
    expect(save!.unlockedLevel).toBe(4);
    expect(l3.map.zoneX).toBeGreaterThan(0);
  });
});
