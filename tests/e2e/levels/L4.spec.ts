import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { l4, l4Anchors } from '../../../src/data/l4';

/** E22 L4 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
const output = 'test-results/epics/E22';
test.use({ trace: 'off' }); // Use the shared platform backend: Metal on Mac, SwiftShader on Hetzner.
type P = { x: number; z: number };
const fair = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
/** Authored L4 anchors; the door and the brace come from the layout (levelFourLayouts derives them the same way). */
const at = (name: string): P => {
  if (name === 'l4-cellar-door') { const d = fair.anchors['kessler-cellar-door'].position; return { x: d[0], z: d[2] }; }
  if (name === 'l4-brace') { const c = fair.anchors['cellar-interior'].position; return { x: c[0] - .4, z: c[2] + 2.6 }; }
  return { x: l4Anchors[name][0], z: l4Anchors[name][1] };
};

function helpers(page: Page) {
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  const shots = new Set<string>();
  const snap = async (name: string) => {
    await page.evaluate(n => window.__SS__!.camera.preset(`D-FAIR/W0/${n}`), name);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
    await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  };
  /** Shift + click the nearest infected within `range` (the machine gun shoots it, the axe swings at arm's length). */
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
      // Resolve the queued screen click with the same camera used to project it (as in the L5 harness).
      await step(1);
      const point = await page.evaluate(q => window.__SS__!.input.project(q), target);
      await page.mouse.click(point.x, point.y); await step(1);
      await page.evaluate(() => window.__SS__!.camera.follow());
    };
    await click();
    let fights = 0;
    for (let i = 0; i < 600; i++) {
      await step(20);
      if (done && await done()) return;
      const p = (await player()).transform;
      if (Math.hypot(target.x - p.x, target.z - p.z) <= stop) return;
      const crowd = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 10).length; });
      // Many ahead: back off for a moment (they string out), then push on.
      if (crowd >= 5) {
        const p0 = (await player()).transform, back = { x: p0.x - Math.sign(target.x - p0.x) * 8, z: p0.z };
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
const begin = async (page: Page, level = 'L4', progression: string | undefined = 'L4-default') => {
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(({ level, progression }) => window.__SS__!.loadLevel(level, { seed: 1, ...(progression ? { progression: progression as 'L4-default' } : {}) }), { level, progression });
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
};

test.describe('L4 The Safe City Falls in the browser', () => {
  test('T-E22-alarm @E22 @E22-AC07 real-input alarm has living visible infected within 10 seconds', async ({ page }) => {
    test.setTimeout(300_000); mkdirSync(output, { recursive: true });
    await begin(page);
    const h = helpers(page);
    for (let i = 0; i < 80 && (await h.mission()).l4!.phase === 'convoy'; i++) await h.step(30);
    await h.go(at('l4-quartermaster'), .7); await h.interact();
    for (let i = 0; i < 10 && !(await h.mission()).l4!.gunAt; i++) { await h.interact(); await h.step(10); }
    expect((await h.mission()).l4!.gunAt).toBeGreaterThan(0);
    await h.go({ x: -21.5, z: 3 }, 1.4);
    for (let i = 0; i < 1000 && !(await h.mission()).l4!.warAt; i++) await h.step(3);
    const alarm = (await h.mission()).l4!.warAt;
    expect(alarm).toBeGreaterThan(0);
    let visible = 0, alive = 0, elapsed = 0;
    for (let i = 0; i < 100; i++) {
      await h.step(6);
      const r = await page.evaluate(() => { const a = window.__SS__!, live = a.query({kind:'infected'}).filter(e => e.health.current > 0 && !e.hidden); return { tick:a.tick(), alive:live.length, visible:live.filter(e=>{const p=a.camera.project(e.transform.x,e.transform.y,e.transform.z);return Math.abs(p[0])<1&&Math.abs(p[1])<1&&Math.abs(p[2])<1;}).length }; });
      visible = r.visible; alive = r.alive; elapsed = (r.tick - alarm) / 60;
      if (visible && alive) break;
    }
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({path:`${output}/alarm-visible.png`});
    writeFileSync(`${output}/alarm-visible.json`,JSON.stringify({visible,alive,elapsed}));
    expect(alive).toBeGreaterThan(0); expect(visible).toBeGreaterThan(0); expect(elapsed).toBeLessThanOrEqual(10);
  });

  test('T-E22-18 @E22 @E22-AC18 @E22-AC19 real-input playthrough: convoy, quartermaster, the turn, the war, the line break, Kessler Lane, the barred cellar door; photo spots and pair cameras', async ({ page }) => {
    test.setTimeout(2_400_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    await begin(page);
    const h = helpers(page), { step, mission, player, snap, go, interact, fightNearby } = h;
    // The ride: the courier is a seated passenger; the convoy passes the gate and tours the clean city.
    expect((await player()).hidden).toBe(true);
    for (let i = 0; i < 200 && (await mission()).l4!.phase === 'convoy'; i++) {
      await step(15);
      const m = await mission(), bus = await page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id)?.transform, m.l4!.convoyIds[4]);
      if (!h.shots.has('l4-convoy-arrival') && bus && bus.x > 0 && bus.z < 10 && m.l4!.convoyV < 4) await snap('l4-convoy-arrival');
    }
    expect((await mission()).l4!.phase).toBe('plaza');
    if (!h.shots.has('l4-convoy-arrival')) await snap('l4-convoy-arrival');
    expect((await player()).hidden).toBeFalsy();
    // The safe city: nothing has happened yet (zero infected), every photo spot of the calm and the four pair cameras.
    await step(60);
    expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
    for (const name of ['l4-plaza-safe', 'l4-harbor-street-safe', 'l4-metro-entrance-safe', 'pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane']) await snap(name);
    // The machine gun: stand at the quartermaster's table and press E; it joins the carried weapons and is selected, no ammunition HUD.
    await go(at('l4-quartermaster'), .7); await interact();
    for (let i = 0; i < 10 && !(await mission()).l4!.gunAt; i++) { await interact(); await step(10); }
    expect((await mission()).l4!.gunAt).toBeGreaterThan(0);
    expect((await player()).weapons!.RIGHT.rack[0].id).toBe('weapon.army-mg'); expect((await player()).weapons!.selectedSide).toBe('RIGHT');
    await expect(page.getByTestId('weapon-active')).toHaveAttribute('aria-label', /, Ready/);
    // The turn: wait in the plaza (the soldiers hold, the people queue); the first evacuees collapse.
    await go({ x: -21.5, z: 3 }, 1.4);
    let turnShot = false;
    for (let i = 0; i < 300 && !(await mission()).l4!.turnAt; i++) await step(20);
    expect((await mission()).l4!.turnAt).toBeGreaterThan(0);
    await snap('l4-first-turn'); turnShot = true; void turnShot;
    // The war: hold the plaza with the army, shooting what comes within range; photos of the line and the tank.
    let line = false, tank = false;
    for (let i = 0; i < 1200 && !(await mission()).l4!.lineBreakAt; i++) { // l4-collapse: the war lasts ~3 min (three lines, then "Fall back!")
      if (!await fightNearby(16)) await step(15);
      const m = await mission();
      const inFrame = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 22, e.transform.z - 3) < 24).length);
      if (!line && inFrame >= 8) { await snap('l4-war-line'); line = true; }
      if (!tank && m.l4!.tankShots >= 1) { await snap('l4-tank'); tank = true; }
    }
    expect((await mission()).l4!.lineBreakAt).toBeGreaterThan(0);
    if (!line) await snap('l4-war-line'); if (!tank) await snap('l4-tank');
    await step(150); await snap('l4-collapse');
    await expect(page.getByTestId('weapon-active')).not.toHaveAttribute('aria-label', /\d+\s*\/\s*\d+/);
    // The collapse: the escape street (l4-collapse-2: at "Fall back!" the horde leaves a gap on it; pursuers still chase): out of the ring's
    // east side, down to Lakeshore Avenue and east to Kessler's cellar door, through whatever comes.
    const inCellar = async () => (await mission()).l4!.phase === 'cellar';
    const route: P[] = [...l4.director.escape.route.slice(1).map(([x, z]) => ({ x, z })), at('l4-cellar-door')];
    for (const wp of route) { await go(wp, 2.2, inCellar, 9); if (await inCellar()) break; }
    for (let i = 0; i < 40 && !await inCellar(); i++) { await go(at('l4-cellar-door'), .5, inCellar, 9); await interact(); await step(20); }
    expect(await inCellar()).toBe(true);
    // The cellar: alone, one bulb; bar the door; the battle goes on above, muffled, for at least 6 s; the level ends straight into L5.
    await step(60); await snap('l4-basement');
    await go(at('l4-brace'), .4);
    for (let i = 0; i < 12 && !(await mission()).l4!.barredAt; i++) { await interact(); await step(20); }
    expect((await mission()).l4!.barredAt).toBeGreaterThan(0);
    const last = await mission();
    for (let i = 0; i < 60 && !await page.evaluate(() => { const a = window.__SS__!; return a.getState().scenario === 'L5' || a.missions.state()?.phase === 'progression'; }); i++) await step(30);
    writeFileSync(`${output}/browser-real-input.json`, JSON.stringify({ stats: last.stats, l4: { lineCause: last.l4!.lineCause, soldiersAtBreak: last.l4!.soldiersAtBreak, kills: last.l4!.kills, tankShots: last.l4!.tankShots, glass: last.l4!.glass.length, burning: last.l4!.burning.length }, shots: [...h.shots] }, null, 2) + '\n');
    expect([...h.shots].sort()).toEqual(['l4-basement', 'l4-collapse', 'l4-convoy-arrival', 'l4-first-turn', 'l4-harbor-street-safe', 'l4-metro-entrance-safe', 'l4-plaza-safe', 'l4-tank', 'l4-war-line', 'pair-harbor-street', 'pair-kessler-lane', 'pair-metro-entrance', 'pair-plaza']);
  });

  test('T-E22-15b @E22 @E22-AC15 campaign: the barred cellar door loads L5 with the carried loadout and no reward screen', async ({ page }) => {
    test.setTimeout(600_000); page.setDefaultTimeout(120_000);
    await begin(page);
    for (let i = 0; i < 12; i++) {
      const m = await page.evaluate(() => window.__SS__!.missions.state());
      if (!m || m.phase !== 'playing' || (await page.evaluate(() => window.__SS__!.getState().scenario)) !== 'L4') break;
      await page.evaluate(() => window.__SS__!.cheats.completeObjective());
      if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L4')) await page.evaluate(() => window.__SS__!.step(2));
    }
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L5');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg']));
    expect(save!.unlockedLevel).toBe(5);
  });

  for (const renderer of ['webgl', 'webgpu'] as const) test(`T-E22-19 @E22 @E22-AC20 pedestrians, soldiers and infected are drawn on screen in L4 (${renderer}), not only their props`, async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(120_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${renderer}`)}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.debug.figureJoints(true); a.cheats.god(true); a.cheats.completeObjective('ride'); });
    await page.evaluate(() => window.__SS__!.step(120));
    const dir = 'test-results/epics/E22/crowd-drawn'; mkdirSync(dir, { recursive: true });
    // A DOM interaction caption covered a sampled head; clean-shot mode isolates actual submitted body pixels.
    await page.evaluate(() => document.body.classList.add('ui-hidden'));
    /** Heads/torsos of `kind` entities moved around the courier must change the pixels when they are moved off screen. */
    const check = async (kind: 'civilian' | 'infected', name: string) => {
      const before = await page.evaluate(async ({ kind }) => {
        const a = window.__SS__!; a.camera.follow();
        // The open plaza (no building between the camera and the figures).
        a.teleport(a.query({ kind: 'player' })[0].id, { x: -14, z: 6 }); await a.step(5);
        const player = a.query({ kind: 'player' })[0].transform;
        const pick = a.query({ kind }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.health.current > 0 && (kind === 'infected' || e.civilian?.state === 'calm')).slice(0, 6);
        for (const [i, c] of pick.entries()) a.teleport(c.id, { x: player.x - 5 + (i % 3) * 2.6, z: player.z + 3 + Math.floor(i / 3) * 2.6 });
        await a.step(30); await a.screenshotReady();
        // Probe the submitted pose: a lunging head is not above the simulation's upright origin.
        const figures = a.crowdFigures();
        const list = pick.map(c => {
          const joints = figures.find(f => f.id === c.id && f.drawn)?.joints;
          if (!joints?.head || !joints.hip) throw new Error(`Missing drawn body joints for ${c.id}`);
          const hip = joints.hip, neck = joints.head, axis = neck.map((v, i) => v - hip[i]), length = Math.hypot(...axis);
          const head = neck.map((v, i) => v + axis[i] / length * .12), chest = hip.map((v, i) => v + axis[i] * .6);
          return { id: c.id, head: a.camera.project(head[0], head[1], head[2]), chest: a.camera.project(chest[0], chest[1], chest[2]) };
        })
          .filter(c => Math.abs(c.head[0]) < .85 && Math.abs(c.head[1]) < .85 && Math.abs(c.chest[1]) < .7 && c.head[2] < 1);
        return { list, backend: a.perf().backend };
      }, { kind });
      const shown = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${dir}/${name}-${renderer}.png` }));
      await page.evaluate(async (ids) => { const a = window.__SS__!; ids.forEach((id, i) => a.teleport(id, { x: -400 - i * 3, z: -400 })); await a.step(2); await a.screenshotReady(); }, before.list.map(c => c.id));
      const hidden = PNG.sync.read(await page.locator('canvas').screenshot());
      const results = before.list.map(c => {
        const hx = (c.head[0] + 1) / 2 * shown.width, tx = (c.chest[0] + 1) / 2 * shown.width, top = Math.round((1 - c.head[1]) / 2 * shown.height), bottom = Math.round((1 - c.chest[1]) / 2 * shown.height), half = Math.max(3, Math.round((bottom - top) / 4));
        let changed = 0;
        for (let y = Math.max(0, top); y < Math.min(shown.height, bottom); y++) {
          const cx = Math.round(hx + (tx - hx) * (y - top) / (bottom - top));
          for (let x = Math.max(0, cx - half); x < Math.min(shown.width, cx + half); x++) {
            const i = (y * shown.width + x) * 4;
            if (Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 24) changed++;
          }
        }
        return { id: c.id, changed, area: (bottom - top) * half * 2 };
      });
      const drawn = results.filter(r => r.changed >= r.area * (kind === 'infected' ? .15 : .25)).length; // retain the existing pixel coverage thresholds
      writeFileSync(`${dir}/${name}-${renderer}.json`, JSON.stringify({ ...before, results, drawn }, null, 2) + '\n');
      expect(before.backend).toBe(renderer); expect(before.list.length, `${name} in view`).toBeGreaterThanOrEqual(3); expect(drawn, `${name} drawn bodies`).toBe(before.list.length);
    };
    await check('civilian', 'l4-calm-people');
    // The war: let infected exist (the first turn), then check the infected the crowd draws.
    await page.evaluate(() => { window.__SS__!.cheats.completeObjective('quartermaster'); });
    for (let i = 0; i < 400 && !(await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).length)); i++) await page.evaluate(() => window.__SS__!.step(30));
    for (let i = 0; i < 60 && (await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden).length)) < 4; i++) await page.evaluate(() => window.__SS__!.step(30));
    // Population can precede the crowd renderer's first submitted pose; wait for a stable render frame.
    await page.evaluate(async () => { await window.__SS__!.step(30); await window.__SS__!.screenshotReady(); });
    await check('infected', 'l4-war-infected');
  });
});
