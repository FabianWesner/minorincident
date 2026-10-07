import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { menuStart } from '../ui-helpers';
import { l2Anchors } from '../../../src/data/l2';
import { l2Routes } from '../../../src/debug/bot/LevelTwoBot';

/** E20 L2 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
const output = 'test-results/epics/E20';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
const at = (name: string) => ({ x: l2Anchors[name][0], z: l2Anchors[name][1] });
type P = { x: number; z: number };

function helpers(page: Page) {
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  const shots = new Set<string>();
  const snap = async (name: string) => {
    await page.evaluate(n => window.__SS__!.camera.preset(`D-GROVE/W1/${n}`), name);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
    await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  };
  /** Shift + click: stand and strike the nearest infected under the cursor. */
  const fightNearby = async (): Promise<boolean> => {
    const target = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      return near ? a.input.project(near.transform) : null;
    });
    if (!target) return false;
    await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(20); await page.mouse.up(); await page.keyboard.up('Shift');
    return true;
  };
  /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  const go = async (target: P, stop = 1.2, done?: () => Promise<boolean>) => {
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
    for (let i = 0; i < 600; i++) {
      await step(20);
      const p = (await player()).transform;
      if (Math.hypot(target.x - p.x, target.z - p.z) <= stop || (done && await done())) return;
      if ((await player()).health.current > 0 && await fightNearby()) await click();
      else if (i % 10 === 9) await click();
    }
    throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)}`);
  };
  const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  return { step, mission, player, snap, shots, go, fightNearby, interact };
}

test.describe('L2 The Failed Rescue in the browser', () => {
  test('T-E20-18 @E20 @E20-AC18 @E20-AC16 real-input playthrough from the station to the closing gate, photo spots on the way', async ({ page }) => {
    test.setTimeout(1_500_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    await boot(page, `${testUrl}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.pause());
    const h = helpers(page), { step, mission, player, snap, go, interact } = h;
    await step(150); await snap('l2-station-calm');
    expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
    for (let i = 0; i < 80 && (await mission()).l2!.phase === 'calm'; i++) await step(30);
    await step(30); await snap('l2-alarm');
    // Optional axe: walk to the wall rack and press E.
    await go(at('l2-axe-rack'), .8); await interact();
    for (let i = 0; i < 10 && !(await mission()).l2!.axe; i++) { await interact(); await step(10); }
    expect((await mission()).l2!.axe).toBe(true);
    expect((await player()).weapons!.LEFT.rack.map(r => r.id)).toContain('weapon.fire-axe');
    // Board at the crew door by interaction.
    await go(at('l2-board'), .6); await interact();
    for (let i = 0; i < 20 && !(await mission()).l2!.seated; i++) { await interact(); await step(10); }
    expect((await mission()).l2!.seated).toBe(true);
    for (let i = 0; i < 200; i++) {
      const truck = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state()!.l2!; return a.getState().entities.find(e => e.id === s.truckId)!.transform; });
      if (truck.x > -32 && truck.z < 6) break; await step(10);
    }
    await snap('l2-truck-ride');
    for (let i = 0; i < 100 && !(await mission()).l2!.arrivedAt; i++) await step(15);
    expect((await player()).hidden).toBeFalsy();
    // Main Row before the doors open: the same game camera as the L1 pickup spot, W1 damage without the crowd.
    await snap('l2-streets-w1');
    await go(at('l2-forecourt'), 1.5, async () => (await mission()).l2!.doorsOpenAt > 0);
    for (let i = 0; i < 1200 && !(await mission()).l2!.doorsOpenAt; i++) await step(1);
    await snap('l2-doors-open'); await step(300);
    await page.evaluate(n => window.__SS__!.camera.preset(`D-GROVE/W1/${n}`), 'l2-doors-open'); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/l2-doors-open-5s.png` }); await page.evaluate(() => window.__SS__!.camera.follow());
    // Fight a little at the doors, then break away.
    for (let i = 0; i < 8; i++) { if (!await h.fightNearby()) await step(20); }
    await snap('l2-collapse');
    const route = l2Routes.side;
    for (const wp of route) {
      await go(wp, 1.8, async () => { const m = await mission(); return m.phase !== 'playing' || m.l2!.gateClosedAt > 0; });
      const m = await mission();
      if (m.l2!.clusterReached && !h.shots.has('l2-cluster')) await snap('l2-cluster');
      if (m.phase !== 'playing' || m.l2!.gateClosedAt) break;
    }
    if (!h.shots.has('l2-cluster')) await snap('l2-cluster');
    for (let i = 0; i < 40 && !(await mission()).l2!.gateClosedAt; i++) await step(15);
    expect((await mission()).l2!.gateClosedAt).toBeGreaterThan(0);
    await step(20); await snap('l2-bridge-checkpoint');
    for (let i = 0; i < 40 && (await mission()).phase === 'playing'; i++) await step(15);
    const final = await mission();
    writeFileSync(`${output}/browser-real-input.json`, JSON.stringify({ phase: final.phase, stats: final.stats, l2: { axe: final.l2!.axe, deaths: final.stats.deaths }, shots: [...h.shots] }, null, 2) + '\n');
    expect(['result', 'progression']).toContain(final.phase);
    expect([...h.shots].sort()).toEqual(['l2-alarm', 'l2-bridge-checkpoint', 'l2-cluster', 'l2-collapse', 'l2-doors-open', 'l2-station-calm', 'l2-streets-w1', 'l2-truck-ride']);
  });

  test('T-E20-14b @E20 @E20-AC14 campaign: the gate closes, no reward screen, L3 loads with the carried loadout', async ({ page }) => {
    test.setTimeout(600_000); page.setDefaultTimeout(120_000);
    await menuStart(page);
    await page.evaluate(() => window.__SS__!.pause());
    for (let i = 0; i < 12 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) === 'playing'; i++) await page.evaluate(() => window.__SS__!.cheats.completeObjective());
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) !== 'result'; i++) await page.evaluate(() => window.__SS__!.step(30));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.pause());
    // Walk the L2 graph with the objective cheat, taking the optional axe on the way.
    for (let i = 0; i < 16; i++) {
      const m = await page.evaluate(() => window.__SS__!.missions.state()!);
      if (m.phase !== 'playing') break;
      const active = Object.entries(m.steps).filter(([, s]) => s.status === 'active').map(([id]) => id);
      await page.evaluate(id => window.__SS__!.cheats.completeObjective(id), active.includes('axe') ? 'axe' : undefined);
      // Completing the bridge objective hands over to L3 at once (its load resets the clock), so only step while L2 plays.
      if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L2')) await page.evaluate(() => window.__SS__!.step(2));
    }
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L3');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe']));
    expect(save!.unlockedLevel).toBe(3);
  });
});
