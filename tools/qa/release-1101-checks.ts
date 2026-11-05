/** Release QA 2026-11-01 targeted live checks on the real levels (debug level-list entry, physical keys + mouse):
 *   rocket: L8 rack launcher at night: detonation vs the clicked ground point, visibility in flight, held-LMB cadence.
 *   riot:   L4 riot cop: frontal MP fire at 6 m and point blank, flank fire, and what one riot does to the courier.
 *   lamp:   L6 headlamp while strafing and firing across the walk direction.
 *   node --import tsx tools/qa/release-1101-checks.ts <origin> <label> <rocket|riot|lamp> [low|high]
 * Output: test-results/release-qa/checks/<label>-<mode>-<tier>/ (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';

const [origin, label, mode, tierArg] = process.argv.slice(2);
const tier = tierArg === 'high' ? 'high' : 'low';
const out = `test-results/release-qa/checks/${label}-${mode}-${tier}`; mkdirSync(out, { recursive: true });
const data: Record<string, unknown> = { mode, tier, label };
const save = () => writeFileSync(`${out}/result.json`, JSON.stringify(data, null, 1));
type W = { __SCENE__: { game: Game } };

async function enter(page: Page, level: string): Promise<void> {
  await page.goto(`${origin}/?test=1&scenelab=1&ui=1&debug=1&controls=wasd&quality=${tier}&audio=muted&seed=1&preload=0`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 180_000 });
  await page.evaluate(async () => { await window.__SS__!.ready; });
  await page.getByTestId('start-game').click();
  if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
  await page.getByTestId(`level-${level}`).click({ force: true });
  await page.waitForFunction(l => (window as unknown as W).__SCENE__.game.world.scenario === l && !!window.__SS__!.missions.state(), level, { timeout: 240_000 });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing')) break;
    await page.getByTestId('mission-button').click({ timeout: 1500 }).catch(() => page.mouse.click(640, 360));
    await page.waitForTimeout(400);
  }
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5); await a.step(30); });
  if (await page.evaluate(() => !!(window.__SS__!.getEntity(1) as unknown as { riding?: number }).riding)) { await page.keyboard.press('KeyE'); await page.evaluate(async () => { await window.__SS__!.step(120); }); }
}
const current = (page: Page) => page.evaluate(() => { const p = window.__SS__!.getEntity(1)!, s = p.weapons![p.weapons!.selectedSide]; return (s.index === -1 ? s.unarmed : s.rack[s.index])?.id ?? null; });
async function select(page: Page, weapon: RegExp): Promise<string | null> {
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']) {
    await page.keyboard.press(key); await page.evaluate(async () => { await window.__SS__!.step(20); });
    const id = await current(page); if (id && weapon.test(id)) return id;
  }
  return current(page);
}
const step = (page: Page, n: number) => page.evaluate(async n => { const a = window.__SS__!; for (let i = 0; i < n; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } }, n);
const screen = (page: Page, pos: { x: number; z: number }) => page.evaluate(pos => window.__SS__!.input.project(pos as never, 'destination'), pos);
const shot = async (page: Page, name: string) => { await page.evaluate(async () => { await window.__SS__!.screenshotReady(); }); await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 }); };

const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(240_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); data.errors = errors;
  await page.addInitScript('window.__name = fn => fn');
  if (mode === 'rocket') {
    await enter(page, 'L8');
    await page.evaluate(() => { const a = window.__SS__!; a.cheats.killAll(); a.settings.set({ timeOfDay: 'night', cameraShake: false } as never); });
    data.weapon = await select(page, /rocket/);
    const p0 = await page.evaluate(() => ({ ...window.__SS__!.getEntity(1)!.transform }));
    const shots: unknown[] = [];
    for (const [i, [dx, dz]] of ([[8, 0], [0, 9], [-7, 5], [6, -6], [11, 3]] as const).entries()) {
      const target = { x: p0.x + dx, z: p0.z + dz };
      const pt = await screen(page, target);
      const tick = await page.evaluate(() => window.__SS__!.tick());
      await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await step(page, 1); await page.mouse.up();
      await step(page, 10); await shot(page, `rocket-${i}-flight`);
      const r = await page.evaluate(async tick => {
        const a = window.__SS__!;
        for (let i = 0; i < 240; i++) { const e = a.events(tick).find(e => e.type === 'combat.exploded'); if (e) return { event: e, pick: a.input.lastPick(), attacks: a.events(tick).filter(e => e.type === 'combat.attack').length }; a.vfx.stepRender(1 / 60); await a.step(1); }
        return { event: null, pick: a.input.lastPick(), attacks: a.events(tick).filter(e => e.type === 'combat.attack').length };
      }, tick);
      await step(page, 3); await shot(page, `rocket-${i}-impact`);
      const at = (r.event as { position?: { x: number; z: number } } | null)?.position;
      shots.push({ target, exploded: !!r.event, at, miss: at ? +Math.hypot(at.x - target.x, at.z - target.z).toFixed(2) : null, attacks: r.attacks });
      await step(page, 40);
    }
    data.shots = shots;
    // Cadence: held LMB for 3 s.
    const t0 = await page.evaluate(() => window.__SS__!.tick());
    const far = await screen(page, { x: p0.x + 10, z: p0.z });
    await page.mouse.move(far.x, far.y); await page.mouse.down(); await step(page, 180); await page.mouse.up();
    data.cadence = await page.evaluate(t0 => { const ts = window.__SS__!.events(t0).filter(e => e.type === 'combat.attack' && e.sourceId === 1).map(e => e.tick); return { shots: ts.length, gaps: ts.slice(1).map((t, i) => +((t - ts[i]) / 60).toFixed(3)) }; }, t0);
  }
  if (mode === 'riot') {
    await enter(page, 'L4');
    // Past the convoy ride: the authored 'turn' checkpoint (same campaign save), on foot in the city.
    await page.evaluate(async () => { await window.__SS__!.loadLevel('L4' as never, { seed: 1, checkpoint: 'line-break' } as never); });
    for (let i = 0; i < 20; i++) { if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing')) break; await page.getByTestId('mission-button').click({ timeout: 1500 }).catch(() => page.mouse.click(640, 360)); await page.waitForTimeout(400); }
    await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5); a.cheats.killAll(); await a.step(30); });
    data.weapon = await select(page, /army-mg|smg/);
    if (!/army-mg|smg/.test(String(data.weapon))) data.weapon = await select(page, /handgun/);
    data.position = await page.evaluate(() => ({ ...window.__SS__!.getEntity(1)!.transform, passenger: (window.__SS__!.getEntity(1) as unknown as { passengerOf?: number }).passengerOf ?? null }));
    const setup = await page.evaluate(async () => {
      const a = window.__SS__!;
      // Away from the army (the campaign met a riot cop here on the cellar run).
      a.teleport(1, { x: -75.8, z: -43.7 }); await a.step(10);
      const p = a.getEntity(1)!.transform;
      const id = a.spawn('infected.riot', { x: p.x + 7, z: p.z });
      const states: string[] = [];
      for (let i = 0; i < 12; i++) { await a.step(15); const e = a.getEntity(id); states.push(`${e?.infected?.state}@${e ? Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1) : '-'}`); if (e && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 6.5) break; }
      const e = a.getEntity(id)!;
      return { id, p: { ...p }, states, hp: e.health.current, max: e.health.max, facingPlayer: Math.round(Math.abs(Math.atan2(Math.sin(Math.atan2(p.x - e.transform.x, p.z - e.transform.z) - e.transform.yaw), Math.cos(Math.atan2(p.x - e.transform.x, p.z - e.transform.z) - e.transform.yaw))) * 180 / Math.PI) };
    });
    const hp = () => page.evaluate(id => window.__SS__!.getEntity(id)?.health.current ?? -1, setup.id);
    let face = false;
    const fire = async (ticks: number, tag: string) => {
      const start = await hp(), t0 = await page.evaluate(() => window.__SS__!.tick());
      for (let t = 0; t < ticks; t += 6) {
        const aim = await page.evaluate(id => { const e = window.__SS__!.getEntity(id); return e ? window.__SS__!.input.project({ ...e.transform, y: (e.transform.y ?? 0) + 1.1 } as never, 'player') : null; }, setup.id);
        if (!aim) break;
        await page.mouse.move(aim.x, aim.y); if (t === 0) await page.mouse.down();
        // Keep the shield squarely on the courier (worst case for the shooter).
        if (face) await page.evaluate(id => { const a = window.__SS__!, e = a.getEntity(id) as unknown as { transform: { x: number; z: number; yaw: number } } | null, p = a.getEntity(1)!.transform; const live = (window as unknown as W).__SCENE__.game.world.entities.get(id); if (e && live) live.transform.yaw = Math.atan2(-(p.z - e.transform.z), p.x - e.transform.x); }, setup.id);
        await step(page, 6);
      }
      await page.mouse.up();
      const hits = await page.evaluate(({ t0, id }) => window.__SS__!.events(t0).filter(e => e.type === 'combat.hit' && e.targetId === id) as unknown as { amount: number; blocked?: boolean; shieldGlance?: boolean; shieldBreak?: boolean }[], { t0, id: setup.id });
      const d = await page.evaluate(id => { const e = window.__SS__!.getEntity(id), p = window.__SS__!.getEntity(1)!; return e ? +Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z).toFixed(2) : null; }, setup.id);
      return { tag, start, end: await hp(), distance: d, hits: hits.length, blocked: hits.filter(h => h.blocked).length, glance: hits.filter(h => h.shieldGlance).length, breaks: hits.filter(h => h.shieldBreak).length, dmg: +hits.reduce((s, h) => s + (h.amount ?? 0), 0).toFixed(1) };
    };
    const rows: unknown[] = [];
    await shot(page, 'riot-0-start');
    data.setup = setup;
    face = true;
    rows.push(await fire(90, 'frontal approach, 1.5 s'));
    rows.push(await fire(150, 'frontal continued, 2.5 s'));
    await shot(page, 'riot-1-after-frontal');
    // Let it close in, then point blank.
    await page.evaluate(async id => { const a = window.__SS__!; for (let i = 0; i < 300; i++) { await a.step(1); const e = a.getEntity(id), p = a.getEntity(1)!; if (e && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 1.8) break; } }, setup.id);
    rows.push(await fire(180, 'point blank, 3 s'));
    await shot(page, 'riot-2-point-blank');
    // Flank: step behind it (fixture placement), fire 2 s.
    await page.evaluate(async id => { const a = window.__SS__!, e = a.getEntity(id)!; a.teleport(1, { x: e.transform.x - Math.sin(e.transform.yaw) * 4, z: e.transform.z - Math.cos(e.transform.yaw) * 4 }); await a.step(2); }, setup.id);
    face = false;
    rows.push(await fire(120, 'flank/back, 2 s'));
    await shot(page, 'riot-3-flank');
    data.fire = rows;
    // One riot vs the courier for 8 s without god mode (no input).
    data.melee = await page.evaluate(async id => {
      const a = window.__SS__!, e = a.getEntity(id); if (!e) return null;
      const p = a.getEntity(1)!; a.teleport(id, { x: p.transform.x + 1.2, z: p.transform.z }); a.cheats.god(false);
      const h0 = a.getEntity(1)!.health.current, t0 = a.tick(); await a.step(480); a.cheats.god(true);
      return { before: h0, after: a.getEntity(1)!.health.current, attacks: a.events(t0).filter(x => x.type === 'infected.attack' && x.targetId === 1).length };
    }, setup.id).catch(e => ({ error: String(e) }));
  }
  if (mode === 'lamp') {
    await enter(page, 'L6');
    await page.evaluate(() => window.__SS__!.cheats.killAll());
    // Wear the shelter headlamp by the real prompt (fixture placement next to it).
    await page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 1.5, z: -3.2 }); await a.step(10); });
    await page.keyboard.down('KeyE'); await step(page, 40); await page.keyboard.up('KeyE'); await step(page, 20);
    data.headlamp = await page.evaluate(() => (window as unknown as W).__SCENE__.game.world.missions!.state.items.includes('headlamp'));
    await page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 6, z: -8 }); await a.step(10); });
    data.weapon = await select(page, /army-mg|mg|handgun|shotgun/);
    const rows: unknown[] = [];
    for (const [name, key, aimDir] of [['east-aim-north', 'KeyD', [0, -6]], ['north-aim-east', 'KeyW', [6, 0]], ['back-aim-south', 'KeyS', [0, 6]]] as const) {
      await page.keyboard.down(key);
      for (let t = 0; t < 90; t += 6) {
        const aim = await page.evaluate(d => { const p = window.__SS__!.getEntity(1)!.transform; return window.__SS__!.input.project({ x: p.x + d[0], z: p.z + d[1] } as never, 'destination'); }, aimDir as unknown as number[]);
        await page.mouse.move(aim.x, aim.y); if (t === 0) await page.mouse.down();
        await step(page, 6);
        if (t >= 30 && t % 18 === 0) rows.push({ name, ...await page.evaluate(() => {
          const g = (window as unknown as W).__SCENE__.game, v = g.view as unknown as { lighting: { headlampAim: { value: { x: number; y: number } } }; character: { headYaw(): number } };
          const aim = v.lighting.headlampAim.value, head = v.character.headYaw(), p = g.world.entities.get(1)!.transform;
          const deg = (r: number) => Math.round(r * 180 / Math.PI), beam = Math.atan2(aim.x, aim.y), diff = (x: number, y: number) => Math.round(Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y))) * 180 / Math.PI);
          return { body: deg(p.yaw), head: deg(head), beam: deg(beam), beamVsHead: diff(beam, head) };
        }) });
      }
      await shot(page, `lamp-${name}`);
      await page.mouse.up(); await page.keyboard.up(key); await step(page, 30);
    }
    data.lamp = rows;
  }
} finally { save(); await browser.close(); }
console.log(JSON.stringify(data));
