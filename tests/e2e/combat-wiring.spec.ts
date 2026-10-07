import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from './fixtures';
import { SimWorld } from '../../src/sim/world/SimWorld';
const output = 'test-results/epics/E05';

test('T-E05-13 @E05 @E05-AC13 real cursor LMB RMB wheel matches sim side/rack state', async ({ page }) => {
  await boot(page); mkdirSync(output, { recursive: true });
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('combat-arena', { seed: 1 }); a.pause(); a.setLoadout(['weapon.machine-gun', 'weapon.pistol'], ['weapon.grenade', 'ability.ground-slam']); });
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1); world.combat!.setLoadout(['weapon.machine-gun', 'weapon.pistol'], ['weapon.grenade', 'ability.ground-slam']);
  const states: unknown[] = [];
  // Sample browser logical frames from real devices, then replay them through the headless sim.
  async function sample(): Promise<void> {
    const state = await page.evaluate(async () => { const a = window.__SS__!; await a.step(1); return a.getState(); });
    world.applyInput(state.input.frame, state.input.scheme); world.update();
    const browser = state.player!.weapons!, sim = world.getState().player!.weapons!;
    expect(browser).toEqual(sim); states.push({ tick: state.tick, frame: state.input.frame, browser, sim });
  }
  async function move(x: number, z: number): Promise<void> {
    const point = await page.evaluate(({ x, z }) => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + x, z: p.z + z }); }, { x, z });
    await page.mouse.move(point.x, point.y); await sample();
  }
  try {
    await move(0.8, 0); await page.mouse.down({ button: 'left' }); await sample(); await page.mouse.up({ button: 'left' }); await sample();
    await move(0, 0.8);
    let state = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(state.selectedSide).toBe('LEFT'); expect(state.LEFT.aim.z).toBeCloseTo(1); expect(state.RIGHT.aim).toEqual({ x: 1, z: 0 });
    // 00 §5.3 (PO 2026-10-06): RMB cycles the carried actions instead of firing a RIGHT attack, and the wheel
    // zooms (M1-05) instead of cycling a rack. The browser and the headless replay must still agree every tick.
    const before = JSON.stringify({ side: state.selectedSide, left: state.LEFT.index, right: state.RIGHT.index });
    await page.mouse.down({ button: 'right' }); await sample(); await page.mouse.up({ button: 'right' }); await sample(); await move(-0.8, 0);
    state = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(JSON.stringify({ side: state.selectedSide, left: state.LEFT.index, right: state.RIGHT.index })).not.toBe(before);
    expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack' && e.side === 'RIGHT').length)).toBe(0);
    const racks = JSON.stringify(state), zoom = await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom);
    await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await sample();
    for (let i = 0; i < 15; i++) await sample();
    state = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect({ side: state.selectedSide, left: state.LEFT.index, right: state.RIGHT.index }).toEqual({ side: JSON.parse(racks).selectedSide, left: JSON.parse(racks).LEFT.index, right: JSON.parse(racks).RIGHT.index });
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom)).toBeGreaterThan(zoom);
    writeFileSync(`${output}/wiring.json`, JSON.stringify(states, null, 2));
  } finally { world.dispose(); }
});

test('T-E05-browser @E05 arena placeholder scene, cheats, settings, screenshot and lifecycle', async ({ page }) => {
  await boot(page); mkdirSync(output, { recursive: true });
  const counters = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('combat-arena', { seed: 1 }); a.pause(); a.settings.set({ aimAssist: 'Off' });
    a.setLoadout(['weapon.bat', 'weapon.pistol'], ['weapon.grenade']); a.cheats.god(true); a.cheats.infiniteCharges(true);
    for (let i = 0; i < 8; i++) a.spawn(i === 7 ? 'infected.riot' : 'infected.dummy', { x: 2 + i % 4 * 1.5, z: Math.floor(i / 4) * 2 - 1 }, { yaw: Math.PI });
    a.camera.preset('gameplay'); await a.screenshotReady(); return a.perf();
  });
  await page.screenshot({ path: `${output}/combat-arena.png` });
  expect(counters.drawCalls).toBeLessThan(600); expect(counters.triangles).toBeLessThan(1_500_000);
  writeFileSync(`${output}/render-perf.json`, JSON.stringify(counters, null, 2));
  const resets = await page.evaluate(async () => {
    const a = window.__SS__!; await a.unloadScenario(); await a.screenshotReady(); const baseline = a.perf(); const results = [];
    for (let i = 0; i < 3; i++) { await a.loadScenario('combat-arena'); a.pause(); a.spawn('infected.dummy', { x: 1, z: 0 }); await a.step(1); await a.unloadScenario(); await a.screenshotReady(); results.push(a.perf()); }
    return { baseline, results };
  });
  for (const result of resets.results) { expect(result.entities).toBe(0); expect(result.geometries).toBe(resets.baseline.geometries); expect(result.textures).toBe(resets.baseline.textures); }
});

for (const weapon of ['weapon.fists', 'weapon.bat']) {
  test(`@E05 real released clicks chain ${weapon} and hit a downed target`, async ({ page }) => {
    await boot(page);
    const id = await page.evaluate(async weapon => {
      const a = window.__SS__!; await a.loadScenario('combat-arena', { seed: 1 }); a.pause();
      a.setLoadout([weapon], ['weapon.kick']);
      const id = a.spawn('infected.runner', { x: 1.2, z: 0 }, { hp: 40 });
      a.input.set({ right: { down: true, held: false, up: true }, aim: { x: 1, z: 0 } });
      await a.step(10); a.input.clear();
      // Keep the kicked target within reach while it is down; damage/pose remain real.
      a.teleport(id, { x: 1.2, z: 0 });
      a.setLoadout([weapon], ['weapon.kick']); return id;
    }, weapon);
    for (let click = 0; click < 10; click++) {
      const target = await page.evaluate(id => window.__SS__!.getEntity(id), id);
      if (!target || target.health.current <= 0) break;
      const point = await page.evaluate(id => {
        const a = window.__SS__!, t = a.getEntity(id)!.transform;
        return a.input.project({ x: t.x, z: t.z });
      }, id);
      await page.mouse.click(point.x, point.y); await page.evaluate(() => window.__SS__!.step(12));
      if (click === 0) {
        await page.evaluate(() => window.__SS__!.screenshotReady());
        await page.screenshot({ path: `${output}/ground-hit-${weapon.split('.')[1]}.png` });
      }
    }
    const result = await page.evaluate(id => ({ health: window.__SS__!.getEntity(id)!.health.current,
      hits: window.__SS__!.events().filter(e => e.type === 'combat.hit' && e.targetId === id && e.actionId !== 'weapon.kick') }), id);
    expect(result.health).toBe(0); expect(result.hits.length).toBe(weapon === 'weapon.bat' ? 1 : 3);
    expect(result.hits[0].tick).toBeLessThan(80);
  });
}
