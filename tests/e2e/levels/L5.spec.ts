import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { l5Survivors } from '../../../src/data/l5';

/** E23 L5 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
const output = 'test-results/epics/E23';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
type P = { x: number; z: number };
const fair = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const ring = (key: string): P => { const s = l5Survivors.find(x => x.key === key)!; return { x: s.ringAt[0], z: s.ringAt[1] }; };
const brace = (): P => { const c = fair.anchors['cellar-interior'].position; return { x: c[0] - .4, z: c[2] + 2.6 }; };
const metroFoot = (): P => ({ x: 37.8, z: -43.4 });

function helpers(page: Page) {
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  const shots = new Set<string>();
  const snap = async (name: string) => {
    // Paused sim stepping leaves the presentation clock frozen: let short-lived
    // muzzle/tracer effects expire as they would before a normal photograph.
    await page.evaluate(n => { const a = window.__SS__!; if (n === 'l5-group-of-five' || n === 'l5-metro-shelter') a.vfx.stepRender(.3); a.camera.preset(`D-FAIR/W5/${n}`); }, name);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
    writeFileSync(`${output}/${name}-positions.json`, JSON.stringify(await page.evaluate(() => { const a = window.__SS__!; return { player: a.getState().player!.transform, followers: a.query({ kind: 'civilian' }).filter(e => e.civilian?.survivor).map(e => ({ id: e.id, at: e.transform, health: e.health.current })) }; }), null, 1));
    await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  };
  /** Aim with the cursor and use the physical side keys: walking clicks select LEFT. */
  const fightNearby = async (range = 2.6): Promise<boolean> => {
    const target = await page.evaluate(range => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      const friends = a.query({ kind: 'civilian' }).filter(e => e.civilian?.survivor?.mode === 'follow');
      const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && e.infected?.state !== 'dead' && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < range && (a.input.visible(e.transform) || friends.some(f => f.civilian?.survivor?.cover && Math.hypot(e.transform.x - f.transform.x, e.transform.z - f.transform.z) < 8)))
        .filter(e => e.infected?.l1?.mode === 'chase' || e.infected?.l1?.mode === 'bite' || Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 9 || friends.some(f => Math.hypot(e.transform.x - f.transform.x, e.transform.z - f.transform.z) < 7))
        .sort((a, b) => {
          const danger = (e: typeof a) => Math.min(Infinity, ...friends.map(f => Math.hypot(e.transform.x - f.transform.x, e.transform.z - f.transform.z)));
          return Number(b.infected?.l1?.mode === 'bite') - Number(a.infected?.l1?.mode === 'bite') ||
            Number(danger(b) < 3) - Number(danger(a) < 3) ||
            Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z);
        })[0];
      return near ? { id: near.id, close: Math.hypot(near.transform.x - p.x, near.transform.z - p.z) < 2.4, rescue: near.infected?.l1?.mode === 'bite' || !a.input.visible(near.transform), p, at: near.transform } : null;
    }, range);
    if (!target) return false;
    await page.evaluate(({ p, at }) => window.__SS__!.camera.cinematic({ position: [p.x + 24, 29, p.z + 24], target: [(p.x + at.x) / 2, 0, (p.z + at.z) / 2] }, true), target);
    await step(1);
    if (target.rescue && !target.close) {
      // Sprint beside the grabber before swinging: the victim can shield a distant gunshot.
      await page.keyboard.up('Alt'); // Sprint: the grab lasts only one second.
      const dx = target.p.x - target.at.x, dz = target.p.z - target.at.z, d = Math.hypot(dx, dz);
      const ground = { x: target.at.x + dx / d * 1.7, z: target.at.z + dz / d * 1.7 };
      const point = await page.evaluate(q => window.__SS__!.input.project(q), ground);
      await page.mouse.click(point.x, point.y); await step(1);
      for (let i = 0; i < 30; i++) {
        await step(4);
        const distance = await page.evaluate(id => { const a = window.__SS__!, p = a.getState().player!.transform, e = a.getEntity(id); return e ? Math.hypot(e.transform.x - p.x, e.transform.z - p.z) : 0; }, target.id);
        if (distance < 2.4) { target.close = true; break; }
      }
      await page.keyboard.down('Alt');
    }
    const key = target.close ? 'j' : 'k';
    await page.keyboard.down(key);
    for (let i = 0; i < 10; i++) {
      const point = await page.evaluate(id => { const a = window.__SS__!, e = a.getEntity(id); return e && e.health.current > 0 ? a.input.project(e.transform) : null; }, target.id);
      if (!point) break;
      await page.mouse.move(point.x, point.y); await step(2);
    }
    await page.keyboard.up(key); await page.evaluate(() => window.__SS__!.camera.follow());
    return true;
  };
  /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  const go = async (target: P, stop = 1.2, range = 7) => {
    const enterMetro = Math.hypot(target.x - metroFoot().x, target.z - metroFoot().z) < 3.4;
    const click = async () => {
      const start = (await player()).transform;
      await page.evaluate(({ start, target }) => {
        const a = window.__SS__!, x = target.x, z = target.z, r = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
        a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
      }, { start, target });
      // Ground clicks resolve on the next sim tick using the camera that projected them.
      await step(1);
      const ground = [target, ...Array.from({ length: 16 }, (_, i) => ({
        x: target.x + Math.cos(i * Math.PI / 8) * stop * .8,
        z: target.z + Math.sin(i * Math.PI / 8) * stop * .8,
      }))];
      for (const q of ground) {
        const point = await page.evaluate(q => window.__SS__!.input.project(q), q);
        await page.mouse.click(point.x, point.y); await step(1);
        if (await page.evaluate(() => window.__SS__!.input.lastPick().length === 0)) break;
      }
      await page.evaluate(() => window.__SS__!.camera.follow());
    };
    await click();
    let lagWait = 0;
    for (let i = 0; i < 2400; i++) {
      await step(4);
      // The entrance triggers at 3.4 m: stop immediately so combat cannot consume
      // the three-second shutter-to-L6 window before its required photograph.
      if (enterMetro && (await mission()).l5!.shutterAt) return;
      const p = (await player()).transform;
      if (Math.hypot(target.x - p.x, target.z - p.z) <= stop) return;
      const lag = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'civilian' }).some(e => e.civilian?.survivor && !e.hidden && e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > 6); });
      // Keep guarding the followers; a nine-second fighting hiatus exceeds their grab/turn window.
      if ((await player()).health.current > 0 && await fightNearby(Math.max(18, range))) await click();
      else if (lag && lagWait < 300) { await page.keyboard.down('w'); await step(1); await page.keyboard.up('w'); await step(12); lagWait += 12; await click(); }
      else { if (!lag) lagWait = 0; if (i % 4 === 3) await click(); }
    }
    throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)}`);
  };
  const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  /** Wait (looking after the group) until every living follower is within 8 m, at most `maxS` seconds. */
  const regroup = async (maxS = 9) => {
    for (let i = 0; i < maxS * 3; i++) {
      const far = await page.evaluate(() => {
        const a = window.__SS__!, p = a.getState().player!.transform, m = a.missions.state()!.l5!;
        return m.survivors.filter(r => r.status === 'following').some(r => { const e = a.getState().entities.find(x => x.id === r.id); return !e || Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > 6.5; });
      });
      if (!far) return; await fightNearby(11); await step(20);
    }
  };
  return { step, mission, player, snap, shots, go, fightNearby, interact, regroup };
}
const begin = async (page: Page, level = 'L5', progression: string | undefined = 'L5-default') => {
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(({ level, progression }) => window.__SS__!.loadLevel(level, { seed: 1, ...(progression ? { progression: progression as 'L5-default' } : {}) }), { level, progression });
  await page.evaluate(() => window.__SS__!.pause());
  // Pause in the same event turn as the real button click, before wall-clock scheduling adds sim ticks.
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Begin mission')!;
    button.addEventListener('click', () => queueMicrotask(() => window.__SS__!.pause()), { once: true });
  });
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
};

test.describe('L5 Aftermath in the browser', () => {
  test('T-E23-17 @E23 @E23-AC17 @E23-AC18 real-input playthrough: unbar the door, find the five by their signs of life, lead them to the Metro; photo spots; 0 console errors', async ({ page }) => {
    test.setTimeout(2_400_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    const errors: string[] = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
    await begin(page);
    const h = helpers(page), { step, mission, player, snap, go, interact, fightNearby, regroup } = h;
    // The cellar: the courier starts in the walled yard (the L4 end loadout in hand), the door is barred.
    expect((await player()).weapons!.RIGHT.rack.map(r => r.id)).toEqual(['weapon.army-mg', 'weapon.handgun', 'weapon.kick']);
    await expect(page.getByTestId('survivors-found')).toBeHidden();
    await go(brace(), .4);
    for (let i = 0; i < 14 && (await mission()).l5!.phase === 'cellar'; i++) { await interact(); await step(20); }
    expect((await mission()).l5!.phase).toBe('emerged');
    // Silence, then the objective; every pair camera and the exit.
    await snap('l5-basement-exit'); await step(60 * 11);
    expect((await mission()).l5!.phase).toBe('search');
    await expect(page.getByTestId('survivors-found')).toContainText('0/5');
    await page.keyboard.down('Alt');
    for (const name of ['pair-kessler-lane', 'pair-plaza', 'pair-harbor-street', 'pair-metro-entrance']) await snap(name);
    // The search: the cheapest tour of the five hiding places; each sign of life is heard (cue event) before the survivor is found.
    const heard = new Set<string>(); let signShot = false;
    await page.evaluate(() => { (window as unknown as { __cues: string[] }).__cues = []; });
    for (const key of ['rosa', 'sam', 'mia', 'okafor', 'dale']) {
      const target = ring(key);
      if (!signShot && key === 'sam') {
        // Stay outside the stand-to-interact ring until this bus's sign is captured.
        await go({ x: target.x + 10, z: target.z - 4 }, 1.2, 11);
        const fresh = () => page.evaluate(() => { const a = window.__SS__!; return a.events().some(e => e.type === 'l5.cue' && e.key === 'sam' && e.tick >= a.getState().tick - 60); });
        for (let wait = 0; wait < 24 && !await fresh(); wait++) if (!await fightNearby(18)) await step(20);
        expect(await fresh(), 'Sam sign of life at his bus').toBe(true);
        await snap('l5-sign-of-life'); signShot = true;
      }
      await go({ x: target.x, z: target.z }, 1.6, 11);
      for (let guard = 0; guard < 40 && await fightNearby(18); guard++) { /* clear nearby threats before opening the hiding place */ }
      const cues = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'l5.cue').map(e => (e as { key: string }).key));
      for (const c of cues) heard.add(c);
      for (let i = 0; i < 12 && !(await mission()).l5!.survivors.find(r => r.key === key && r.status !== 'hidden'); i++) { await interact(); await step(20); }
      expect((await mission()).l5!.survivors.find(r => r.key === key)!.status, key).not.toBe('hidden');
      await expect(page.getByTestId('survivors-found')).toContainText(`${(await mission()).l5!.found}/5`);
      for (let guard = 0; guard < 40 && await fightNearby(18); guard++) { /* protect the newly found survivor */ }
      await regroup();
      writeFileSync(`${output}/real-input-after-${key}.json`, JSON.stringify(await mission(), null, 1));
    }
    expect((await mission()).l5!.found).toBe(5); expect([...heard].sort()).toEqual(['dale', 'mia', 'okafor', 'rosa', 'sam']);
    // Protect all five through the group photo, then enter the Metro: the group photo, then the shutter.
    expect((await mission()).steps.metro.status).toBe('active');
    // Approach from the west, keeping the entrance trigger out of the route until after the photo.
    await go({ x: -20, z: -37.6 }, 1.6, 11);
    await go({ x: 10, z: -37.6 }, 1.6, 11);
    await go({ x: 10, z: -42.4 }, 1.6, 11); await regroup(); await step(30); await snap('l5-group-of-five');
    expect((await mission()).l5!.survivors.filter(r => r.status === 'following')).toHaveLength(5);
    await go(metroFoot(), 2.4, 11);
    let last = await mission();
    for (let i = 0; i < 80 && last.phase === 'playing'; i++) {
      if (last.l5!.shutterAt) {
        const remaining = last.l5!.shutterAt + 120 - await page.evaluate(() => window.__SS__!.getState().tick);
        if (remaining > 0) await step(remaining);
        last = await mission(); await snap('l5-metro-shelter'); break;
      }
      if (!await fightNearby(11)) await step(15);
      last = await mission();
    }
    if (!h.shots.has('l5-metro-shelter')) await snap('l5-metro-shelter');
    if (!last.l5!.shutterAt) last = await mission();
    for (let i = 0; i < 60 && !await page.evaluate(() => { const a = window.__SS__!; return a.getState().scenario === 'L6' || a.missions.state()?.phase === 'progression'; }); i++) await step(30);
    await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L6');
    const handover = await page.evaluate(() => ({ level: window.__SS__!.getState().scenario, survivors: window.__SS__!.campaign.state()!.survivors }));
    expect(handover.level).toBe('L6'); expect(handover.survivors!.slice().sort()).toEqual(l5Survivors.map(s => s.key).sort());
    writeFileSync(`${output}/browser-real-input.json`, JSON.stringify({ statsAtShutter: last.stats, handover, l5: { survivors: last.l5!.survivors.map(r => `${r.key}:${r.status}`), gloom: last.l5!.gloom, shutterAt: last.l5!.shutterAt }, shots: [...h.shots].sort(), errors }, null, 1));
    expect([...h.shots].sort()).toEqual(['l5-basement-exit', 'l5-group-of-five', 'l5-metro-shelter', 'l5-sign-of-life', 'pair-harbor-street', 'pair-kessler-lane', 'pair-metro-entrance', 'pair-plaza']);
    expect(last.l5!.survivors.filter(r => r.status === 'sheltered').length).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('T-E23-18 @E23 @E23-AC18 recognition: the four pair cameras in L4 (W0, intact) and L5 (W5, fallen) from the real game, side by side', async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    const names = ['pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane'], anchors: Record<string, P> = { 'pair-plaza': { x: -17, z: 3 }, 'pair-harbor-street': { x: -10, z: -39 }, 'pair-metro-entrance': { x: 37.8, z: -44.2 }, 'pair-kessler-lane': { x: 68, z: 28.6 } };
    const shoot = async (level: 'W0' | 'W5') => {
      const out: Record<string, Buffer> = {};
      for (const name of names) {
        // The courier stands at the anchor: the see-through fade keeps the buildings between her and the camera open, as in play.
        await page.evaluate(({ name, level, at }) => { const a = window.__SS__!; a.teleport(a.query({ kind: 'player' })[0].id, { x: at.x, z: at.z }); a.camera.preset(`D-FAIR/${level}/${name}`); }, { name, level, at: anchors[name] });
        await page.evaluate(() => window.__SS__!.step(8)); await page.evaluate(() => window.__SS__!.screenshotReady());
        out[name] = await page.screenshot();
      }
      return out;
    };
    await begin(page, 'L4', 'L4-default');
    await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(true); a.cheats.completeObjective('ride'); });
    await page.evaluate(() => window.__SS__!.step(90));
    const safe = await shoot('W0');
    await begin(page);
    await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(true); a.cheats.completeObjective('emerge'); });
    await page.evaluate(() => window.__SS__!.step(60 * 12));
    const fallen = await shoot('W5');
    const width = 800;
    const scaled = (png: PNG) => { const h = Math.round(png.height * width / png.width), out = new PNG({ width, height: h }); for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) { const sx = Math.min(png.width - 1, Math.floor(x * png.width / width)), sy = Math.min(png.height - 1, Math.floor(y * png.height / h)), i = (y * width + x) * 4, j = (sy * png.width + sx) * 4; for (let k = 0; k < 4; k++) out.data[i + k] = png.data[j + k]; } return out; };
    const report: Record<string, number> = {};
    for (const name of names) {
      const a = PNG.sync.read(safe[name]), b = PNG.sync.read(fallen[name]), left = scaled(a), right = scaled(b), sheet = new PNG({ width: width * 2 + 4, height: left.height });
      sheet.data.fill(255); PNG.bitblt(left, sheet, 0, 0, width, left.height, 0, 0); PNG.bitblt(right, sheet, 0, 0, width, right.height, width + 4, 0);
      writeFileSync(`${output}/recognition-${name}.png`, PNG.sync.write(sheet));
      let differ = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 60) differ++;
      report[name] = differ / (a.data.length / 4);
      expect(report[name], `${name}: L5 must look clearly different from L4`).toBeGreaterThan(.3);
    }
    writeFileSync(`${output}/recognition.json`, JSON.stringify(report, null, 1));
  });

  test('T-E23-15b @E23 @E23-AC15 handover: the barred L4 cellar door loads L5 (L4 end loadout, no reward screen); the Metro shutter loads L6 with the rescued survivors in the campaign', async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(120_000);
    await begin(page, 'L4', 'L4-default');
    for (let i = 0; i < 12; i++) {
      const m = await page.evaluate(() => window.__SS__!.missions.state());
      if (!m || m.phase !== 'playing' || (await page.evaluate(() => window.__SS__!.getState().scenario)) !== 'L4') break;
      await page.evaluate(() => window.__SS__!.cheats.completeObjective());
      if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L4')) await page.evaluate(() => window.__SS__!.step(2));
    }
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L5');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
    await expect(page.locator('body')).toContainText('Hours later');
    const save = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg'])); expect(save!.unlockedLevel).toBe(5);
    await page.getByRole('button', { name: 'Begin mission' }).click(); await page.evaluate(() => window.__SS__!.pause());
    const weapons = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(weapons.LEFT.rack.map(r => r.id)).toEqual(['weapon.fire-axe', 'weapon.bat']); expect(weapons.RIGHT.rack.map(r => r.id)).toEqual(['weapon.army-mg', 'weapon.handgun', 'weapon.kick']); expect(weapons.selectedSide).toBe('RIGHT');
    // L5 -> L6: every cheat completes exactly one step; the Metro shutter ends the level straight into the campaign (no result or reward screen).
    for (let i = 0; i < 12; i++) {
      const m = await page.evaluate(() => window.__SS__!.missions.state());
      if (!m || m.phase !== 'playing' || (await page.evaluate(() => window.__SS__!.getState().scenario)) !== 'L5') break;
      await page.evaluate(() => window.__SS__!.cheats.completeObjective());
      // The last cheat ends the level and the campaign loads L6 behind the call: stepping is only legal while paused.
      await page.evaluate(async () => { const a = window.__SS__!; try { a.pause(); await a.step(2); } catch { /* the next level is loading */ } });
    }
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L6');
    await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete|Campaign complete/);
    const after = await page.evaluate(() => window.__SS__!.campaign.state());
    expect(after!.unlockedLevel).toBe(6); expect(after!.survivors!.slice().sort()).toEqual(l5Survivors.map(s => s.key).sort());
  });

  for (const renderer of ['webgl', 'webgpu'] as const) test(`T-E23-19b @E23 @E23-AC19 survivors and infected are drawn on screen in L5 (${renderer}), not only their props`, async ({ page }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(120_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${renderer}`)}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L5', { seed: 1, progression: 'L5-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('emerge'); });
    await page.evaluate(() => window.__SS__!.step(11 * 60));
    await page.evaluate(() => { window.__SS__!.cheats.completeObjective('look'); });
    await page.evaluate(() => window.__SS__!.step(30));
    const dir = 'test-results/epics/E23/crowd-drawn'; mkdirSync(dir, { recursive: true });
    /** Heads/torsos of `kind` entities moved around the courier must change the pixels when they are moved off screen. */
    const check = async (kind: 'civilian' | 'infected', name: string) => {
      const before = await page.evaluate(async ({ kind }) => {
        const a = window.__SS__!; a.camera.follow();
        // The open plaza (no building between the camera and the figures).
        a.teleport(a.query({ kind: 'player' })[0].id, { x: -14, z: 8 }); await a.step(5);
        const player = a.query({ kind: 'player' })[0].transform;
        const pick = a.query({ kind }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.health.current > 0 && e.civilian?.state !== 'finished' && (kind === 'infected' || e.civilian?.state === 'calm')).slice(0, 6);
        for (const [i, c] of pick.entries()) a.teleport(c.id, { x: player.x - 5 + (i % 3) * 2.6, z: player.z + 3 + Math.floor(i / 3) * 2.6 });
        await a.step(30); await a.screenshotReady();
        const list = pick.map(c => a.query({ kind }).find(e => e.id === c.id)!).map(e => ({ id: e.id, head: a.camera.project(e.transform.x, e.transform.y + .95, e.transform.z), chest: a.camera.project(e.transform.x, e.transform.y + (kind === 'infected' ? -.55 : .45), e.transform.z) }))
          .filter(c => Math.abs(c.head[0]) < .85 && Math.abs(c.head[1]) < .85 && Math.abs(c.chest[1]) < (kind === 'infected' ? .85 : .7) && c.head[2] < 1);
        return { list, backend: a.perf().backend };
      }, { kind });
      const shown = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${dir}/${name}-${renderer}.png` }));
      await page.evaluate(async (ids) => { const a = window.__SS__!; ids.forEach((id, i) => a.teleport(id, { x: -400 - i * 3, z: -400 })); await a.step(2); await a.screenshotReady(); }, before.list.map(c => c.id));
      const hidden = PNG.sync.read(await page.locator('canvas').screenshot());
      const results = before.list.map(c => {
        const cx = Math.round((c.head[0] + 1) / 2 * shown.width), top = Math.round((1 - c.head[1]) / 2 * shown.height), bottom = Math.round((1 - c.chest[1]) / 2 * shown.height), half = Math.max(3, Math.round((bottom - top) / 4));
        let changed = 0;
        for (let y = Math.max(0, top); y < Math.min(shown.height, bottom); y++) for (let x = Math.max(0, cx - half); x < Math.min(shown.width, cx + half); x++) {
          const i = (y * shown.width + x) * 4;
          if (Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 14) changed++;
        }
        return { id: c.id, changed, area: (bottom - top) * half * 2 };
      });
      // The sunset is dark and wanderers may be lunging or crawling: the infected probe covers the whole body (feet to head) and the pixel threshold is 14 (L4: 24).
      const drawn = results.filter(r => r.changed >= r.area * (kind === 'infected' ? .08 : .25)).length;
      writeFileSync(`${dir}/${name}-${renderer}.json`, JSON.stringify({ ...before, results, drawn }, null, 2) + '\n');
      expect(before.backend).toBe(renderer); expect(before.list.length, `${name} in view`).toBeGreaterThanOrEqual(3); expect(drawn, `${name} drawn bodies`).toBe(before.list.length);
    };
    await check('civilian', 'l5-survivors');
    await check('infected', 'l5-wanderers');
  });
});
