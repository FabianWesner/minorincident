import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from './fixtures';
import { stateHash } from '../../src/sim/world/stateHash';
import type { Gore } from '../../src/render/vfx/Vfx';
import type { Page } from '@playwright/test';
const output = 'test-results/epics/E15';
function save(name: string, value: unknown): void { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
async function scenario(page: Page, name: string): Promise<void> {
  await boot(page); await page.evaluate(async name => { const a = window.__SS__!; await a.loadScenario(name, { seed: 1 }); a.pause(); a.camera.preset(name); a.settings.set({ cameraShake: false, aimAssist: 'Off', vfx: true, gore: 'Full' }); }, name);
}

/** Real combat kills, never synthetic kill events or direct health mutations. */
async function kills(page: Page, count: number): Promise<void> {
  await page.evaluate(async count => {
    const a = window.__SS__!; a.setLoadout(['weapon.machete'], ['weapon.grenade']);
    for (let i = 0; i < count; i++) {
      a.spawn('infected.dummy', { x: 1, z: 0 }, { hp: 25 });
      a.input.set({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); await a.step(1);
      a.input.clear(); await a.step(59);
      if (count > 1) a.vfx.stepRender(1);
    }
  }, count);
}

test('T-E15-01b @E15 @E15-AC01 60s browser combat agrees across VFX and gore settings', async ({ page }) => {
  test.setTimeout(300_000); await boot(page); const results = [];
  for (const gore of ['Full', 'Reduced', 'Off'] as Gore[]) for (const vfx of [true, false]) {
    await page.evaluate(async ({ gore, vfx }) => { const a = window.__SS__!; await a.loadScenario('gore-probe', { seed: 1 }); a.pause(); a.settings.set({ gore, vfx, cameraShake: false, aimAssist: 'Off' }); }, { gore, vfx });
    await kills(page, 60);
    const state = await page.evaluate(() => window.__SS__!.getState());
    const count = state.entities.filter(e => e.id !== 1 && e.health.current === 0).length;
    expect(state.tick).toBe(3600); expect(count).toBe(60); results.push({ gore, vfx, hash: stateHash(state), kills: count });
  }
  expect(new Set(results.map(r => r.hash)).size).toBe(1); save('determinism', results);
});

test('T-E15-02 @E15 @E15-AC02 @perf ten minutes stress stays capped with stable GPU resources', async ({ page }) => {
  test.setTimeout(600_000); await scenario(page, 'vfx-stress');
  const samples = await page.evaluate(async () => {
    const a = window.__SS__!, samples = [];
    for (let second = 0; second <= 600; second++) {
      if (second > 0) { await a.step(60); a.vfx.stepRender(1); }
      if (second % 10 === 0) { await a.screenshotReady(); samples.push({ second, ...a.perf(), ...a.getState().render.vfx! }); }
    }
    return samples;
  });
  const warm = samples[1];
  for (const sample of samples.slice(1)) {
    expect(sample.particles).toBeLessThanOrEqual(sample.particleCap); expect(sample.decals).toBeLessThanOrEqual(600); expect(sample.gibs).toBeLessThanOrEqual(80);
    expect(sample.geometries).toBe(warm.geometries); expect(sample.textures).toBe(warm.textures);
    expect(sample.drawCalls).toBeLessThan(600); expect(sample.triangles).toBeLessThan(1_500_000);
  }
  expect(samples.at(-1)!.second).toBe(600); expect(Math.max(...samples.map(s => s.decals))).toBe(600);
  save('stress', samples); await page.screenshot({ path: `${output}/stress.png` });
});

test('T-E15-06 @E15 @E15-AC06 render clock freezes 50ms independent of sim scale; crowds suppress', async ({ page }) => {
  await scenario(page, 'gore-probe'); await kills(page, 1);
  const states = await page.evaluate(() => {
    const a = window.__SS__!, tick = a.tick(), start = a.getState().render.vfx!;
    a.setTimeScale(20); a.vfx.stepRender(0.039); const before = a.getState().render.vfx!;
    a.vfx.stepRender(0.011); const after = a.getState().render.vfx!;
    return { tick, sameTick: a.tick(), start, before, after };
  });
  expect(states.start.hitStop.active).toBe(true); expect(states.before.hitStop.active).toBe(true); expect(states.after.hitStop.active).toBe(false);
  expect(states.start.hitStop.until - states.start.hitStop.started).toBeCloseTo(0.05); expect(states.sameTick).toBe(states.tick);
  const crowd = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('gore-probe'); a.pause(); a.setLoadout(['ability.ground-slam'], ['weapon.grenade']);
    for (let i = 0; i < 8; i++) a.spawn('infected.dummy', { x: 0.7 + i * 0.08, z: 0 }, { hp: 10 });
    a.input.set({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); await a.step(15);
    return a.getState().render.vfx!;
  });
  expect(crowd.kills).toBe(8); expect(crowd.hitStop.active).toBe(false); expect(crowd.hitStop.suppressed).toBeGreaterThan(0); save('hit-stop', { states, crowd });
});

test('T-E15-09b @E15 @E15-AC09 real machete and explosion kills hide limbs, show stump caps, expire gibs; settings preserve hash', async ({ page }) => {
  // 600 real kills render 1,200 combat frames; leave headroom for shared-machine SwiftShader.
  test.setTimeout(600_000); await boot(page); const results = [];
  for (const gore of ['Full', 'Reduced', 'Off'] as Gore[]) {
    await page.evaluate(async gore => { const a = window.__SS__!; await a.loadScenario('gore-probe', { seed: 1 }); a.pause(); a.settings.set({ gore, vfx: true, cameraShake: false, aimAssist: 'Off' }); }, gore);
    await kills(page, 200);
    const result = await page.evaluate(() => { const a = window.__SS__!; a.vfx.stepRender(0); return a.getState(); });
    const fx = result.render.vfx!;
    expect(result.entities.filter(e => e.id !== 1 && e.health.current === 0)).toHaveLength(200);
    if (gore === 'Full') { expect(fx.dismemberedKills).toBeGreaterThanOrEqual(60); expect(fx.dismemberedKills).toBeLessThanOrEqual(80); expect(result.render.infected.filter(e => e.detached.length > 0)).toHaveLength(fx.dismemberedKills); for (const e of result.render.infected) expect(e.caps.length).toBe(e.detached.length); }
    else { expect(fx.detached).toBe(0); expect(result.render.infected.every(e => e.detached.length === 0)).toBe(true); }
    await page.screenshot({ path: `${output}/gore-${gore}.png` });
    const expire = await page.evaluate(() => { const a = window.__SS__!; for (let i = 0; i < 30; i++) a.vfx.stepRender(1); return a.getState().render.vfx!; });
    expect(expire.gibs).toBe(0); results.push({ gore, hash: stateHash(result), fx, expire });
    const explosion = await page.evaluate(async () => {
      const a = window.__SS__!; a.setLoadout(['weapon.machete'], ['weapon.grenade']); a.cheats.god(true);
      const id = a.spawn('infected.dummy', { x: 5, z: 0 }, { hp: 10 });
      a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 5, z: 0 }, right: { down: true, held: true, up: false } }); await a.step(1); a.input.clear(); await a.step(100); a.vfx.stepRender(0);
      return { entity: a.getEntity(id), view: a.getState().render.infected.find(e => e.id === id), fx: a.getState().render.vfx! };
    });
    expect(explosion.entity!.health.current).toBe(0); expect(explosion.view!.detached).toHaveLength(gore === 'Full' ? 5 : 0); expect(explosion.fx.gibs).toBe(gore === 'Full' ? 8 : 0);
  }
  expect(new Set(results.map(r => r.hash)).size).toBe(1); save('gore', results);
});

test('T-E15-10 @E15 @E15-AC10 player and held weapon masks reach 50%, reset on load, and disable with Off', async ({ page }) => {
  await scenario(page, 'gore-probe'); await kills(page, 30);
  const covered = await page.evaluate(() => { const render = window.__SS__!.getState().render; return { ...render.character!, weaponBloodCoverage: render.actions!.bloodCoverage }; });
  expect(covered.bloodCoverage).toBeGreaterThanOrEqual(0.5); expect(covered.weaponBloodCoverage).toBeGreaterThanOrEqual(0.5);
  await page.screenshot({ path: `${output}/blood-accumulation.png` });
  const reset = await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('gore-probe'); a.pause(); const render = a.getState().render; return { ...render.character!, weaponBloodCoverage: render.actions!.bloodCoverage }; });
  expect(reset.bloodCoverage).toBe(0); expect(reset.weaponBloodCoverage).toBe(0);
  await page.evaluate(() => window.__SS__!.settings.set({ gore: 'Off' })); await kills(page, 30);
  const off = await page.evaluate(() => { const render = window.__SS__!.getState().render; return { ...render.character!, weaponBloodCoverage: render.actions!.bloodCoverage }; });
  expect(off.bloodCoverage).toBe(0); expect(off.weaponBloodCoverage).toBe(0); save('accumulation', { covered, reset, off });
});

test('T-E15-lifecycle @E15 pools, visual physics and event listeners unload without leaks; low tier reduces particles', async ({ page }) => {
  await boot(page);
  const data = await page.evaluate(async () => {
    const a = window.__SS__!; await a.unloadScenario(); await a.screenshotReady(); const baseline = a.perf(), cycles = [];
    for (let i = 0; i < 3; i++) { await a.loadScenario('vfx-stress'); a.pause(); a.settings.set({ quality: 'low' }); await a.step(120); const low = a.getState().render.vfx!; await a.unloadScenario(); await a.screenshotReady(); cycles.push({ low, perf: a.perf(), sim: a.getState().perf }); }
    return { baseline, cycles };
  });
  save('lifecycle', data);
  for (const cycle of data.cycles) { expect(cycle.low.particleCap).toBe(512); expect(cycle.low.particles).toBeLessThanOrEqual(512); expect(cycle.perf.geometries).toBe(data.baseline.geometries); expect(cycle.perf.textures).toBe(data.baseline.textures); expect(cycle.sim.listeners).toBe(0); expect(cycle.sim.bodies).toBe(0); }
  save('lifecycle', data);
});

test('T-E15-vehicle @E15 vehicle surfaces accumulate blood, obey Off and reset; smoke/fire are presentation only', async ({ page }) => {
  await scenario(page, 'gore-probe');
  const data = await page.evaluate(async () => {
    const a = window.__SS__!, before = a.getState();
    a.vfx.emit({ type: 'vehicle.feedback', id: 101, position: { x: -4, z: 0 }, yaw: 0, healthFraction: 0.1, blood: 0.75 }); a.vfx.stepRender(0.3);
    const covered = a.getState(); a.settings.set({ gore: 'Off' }); const off = a.getState();
    await a.loadScenario('gore-probe'); a.pause(); const reset = a.getState(); return { before, covered, off, reset };
  });
  expect(data.covered.render.vehicles[0].bloodCoverage).toBe(0.75); expect(data.covered.render.vehicles[0].windshieldBloodCoverage).toBe(0.75);
  expect(data.covered.render.vfx!.particles).toBeGreaterThan(0); expect(stateHash(data.covered)).toBe(stateHash(data.before));
  expect(data.off.render.vehicles[0].bloodCoverage).toBe(0); expect(data.reset.render.vehicles).toHaveLength(0);
  save('vehicle-feedback', { covered: data.covered.render.vehicles, off: data.off.render.vehicles });
});
