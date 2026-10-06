import { boot, expect, test } from './fixtures';
import { stateHash } from '../../src/sim/world/stateHash';

test('M1 E07/E15 @E07 @E15 real crowd explosion detaches instanced limbs and settings preserve the sim', async ({ page }) => {
  await boot(page);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena', { seed: 7 }); a.pause(); a.cheats.god(true);
    const id = a.spawn('infected.runner', { x: 5, z: 0 }, { state: 'idle' });
    a.setLoadout(['weapon.machete'], ['weapon.grenade']); a.settings.set({ gore: 'Full', vfx: true, cameraShake: false, aimAssist: 'Off' });
    a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 5, z: 0 }, right: { down: true, held: true, up: false } }); await a.step(1); a.input.clear(); await a.step(100); a.vfx.stepRender(0); await a.screenshotReady();
    const full = a.getState(); a.settings.set({ gore: 'Off' }); const off = a.getState();
    return { id, full, off };
  });
  expect(proof.full.entities.find(e => e.id === proof.id)!.health.current).toBe(0);
  expect(proof.full.render.infected.find(e => e.id === proof.id)!.detached).toHaveLength(5);
  expect(proof.full.render.crowd!.caps).toBeGreaterThanOrEqual(5); expect(proof.full.render.crowd!.nonInstancedMeshes).toBe(0);
  expect(proof.off.render.crowd!.caps).toBe(0); expect(proof.off.render.infected.every(e => e.detached.length === 0)).toBe(true);
  expect(stateHash(proof.full)).toBe(stateHash(proof.off));
});

test('M1 E09/E15 @E09 @E15 real integrated vehicle takes feedback on its existing model and obeys Off', async ({ page }) => {
  await boot(page);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause();
    const id = a.spawn('vehicle.fire-engine', { x: 0, z: 12 }); await a.screenshotReady();
    const before = a.getState(); a.vfx.emit({ type: 'vehicle.feedback', id, position: { x: 0, z: 12 }, yaw: 0, healthFraction: .1, blood: .75 });
    const covered = a.getState(); a.settings.set({ gore: 'Off' }); const off = a.getState(); return { id, before, covered, off };
  });
  expect(proof.covered.render.vehicles).toHaveLength(1); const car = proof.covered.render.vehicles[0];
  expect(car.placeholder).toBe(false); expect(car.wheels).toHaveLength(4); expect(car.bloodCoverage).toBe(.75); expect(car.windshieldBloodCoverage).toBe(.75);
  expect(proof.off.render.vehicles[0].bloodCoverage).toBe(0); expect(stateHash(proof.covered)).toBe(stateHash(proof.before));
});
