import { boot, expect, test } from './fixtures';
import { stateHash } from '../../src/sim/world/stateHash';

test('M1 @E16 real E11 destruction and E12 radio share audio with both E07/E15 telegraphs', async ({ page }) => {
  await boot(page); await page.mouse.click(200, 250);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('interact-yard'); a.pause(); await a.audio.unlock(); a.cheats.god(true); a.audio.clearLog();
    const fence = a.spawn('prop.fence', { x: 15, z: 0 }); a.interact.hit(fence, 1000, 'bullet');
    const fenceAudio = a.audio.snapshot();
    const alarm = a.spawn('hazard.car-alarm', { x: 20, z: 0 }); a.interact.hit(alarm, 1, 'bullet');
    const propane = a.spawn('hazard.propane', { x: 25, z: 0 }); a.interact.hit(propane, 1000, 'bullet'); await a.step(18);
    const hazards = a.audio.snapshot();
    a.vfx.emit({ type: 'telegraph', attackId: 9000, kind: 'bloated', position: { x: 15, z: 0 }, radius: 3, angle: 0 });
    const geometric = a.audio.snapshot();
    await a.loadScenario('horde-arena'); a.pause(); await a.audio.unlock(); a.cheats.god(true); a.audio.clearLog();
    const runner = a.spawn('infected.runner', { x: .9, z: 0 }, { state: 'chase' }); await a.step(30);
    const infected = a.audio.snapshot();
    await a.loadScenario('mission-sandbox'); a.pause(); await a.audio.unlock(); a.settings.set({ captions: true }); a.audio.clearLog(); a.missions.begin();
    const mission = a.audio.snapshot();
    return { fence, fenceAudio, alarm, propane, hazards, geometric, runner, infected, mission, events: a.events() };
  });
  expect(proof.fenceAudio.cues).toContainEqual(expect.objectContaining({ cue: 'prop.break', sourceId: proof.fence, position: expect.objectContaining({ x: 15, z: 0 }) }));
  expect(proof.fenceAudio.cues.some(c => c.cue.startsWith('gore.'))).toBe(false);
  expect(proof.hazards.cues).toContainEqual(expect.objectContaining({ cue: 'ambient.alarm', sourceId: proof.alarm }));
  expect(proof.hazards.cues).toContainEqual(expect.objectContaining({ cue: 'explosion.tell', sourceId: proof.propane }));
  expect(proof.hazards.cues).toContainEqual(expect.objectContaining({ cue: 'explosion.boom', sourceId: proof.propane }));
  expect(proof.geometric.cues.some(c => c.cue === 'telegraph.bloated')).toBe(true);
  expect(proof.infected.cues).toContainEqual(expect.objectContaining({ cue: 'telegraph.runner', sourceId: proof.runner }));
  const line = proof.events.find(e => e.type === 'dialogue.line'); expect(line?.type).toBe('dialogue.line');
  if (line?.type !== 'dialogue.line') throw new Error('Missing mission radio line');
  expect(proof.mission.cues.some(c => c.cue === 'dialogue.radio')).toBe(true); expect(proof.mission.captions).toContain(`[${line.text}]`);
  for (const snapshot of [proof.fenceAudio, proof.hazards, proof.geometric, proof.infected, proof.mission]) expect(snapshot.errors).toEqual([]);
});

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
