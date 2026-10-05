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
    world.setInput(state.input.frame); world.update();
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
    await page.mouse.down({ button: 'right' }); await sample(); await page.mouse.up({ button: 'right' }); await sample(); await move(-0.8, 0);
    state = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(state.selectedSide).toBe('RIGHT'); expect(state.LEFT.aim.z).toBeCloseTo(1); expect(state.RIGHT.aim.x).toBeCloseTo(-1);
    await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await sample();
    state = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(state.RIGHT.index).toBe(1); expect(state.LEFT.index).toBe(0); expect(state.RIGHT.swapUntil).toBe(world.tick + 15);
    for (let i = 0; i < 15; i++) await sample();
    expect(await page.evaluate(() => window.__SS__!.events().some((e) => e.type === 'loadout.switched' && e.side === 'RIGHT'))).toBe(true);
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
