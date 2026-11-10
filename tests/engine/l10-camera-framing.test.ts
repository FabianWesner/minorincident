import { describe, expect, it } from 'vitest';
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../../tools/sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from '../../tools/qa/fixture-io';
import { l10Closing, l10ClosingPose } from '../../src/render/characters/l10Closing';

import { cameraFraming } from '../../src/data/cameraFraming';
import { l10Framing, l10RoadFraming, l10RoadWeight } from '../../src/levels/L10/cameraFraming';
import { cure } from '../../src/levels/L10/district';
import { View } from '../../src/render/View';
import { l2RescueView, l2RescueZoom } from '../../src/data/l2';

describe('L10 road camera (PO 10-30 "Wider L10 camera")', () => {
  it('is wide on the R1–R5 road, normal in the corridor, complex, finale and at close interactions', () => {
    expect(l10RoadWeight(640, 8, false)).toBe(1);
    expect(l10RoadWeight(2150, -75, false)).toBe(1);
    expect(l10RoadWeight(3300, 95, false)).toBe(0);
    expect(l10RoadWeight(4002, -27, false)).toBe(0);
    expect(l10RoadWeight(640, 8, true)).toBe(0);
    for (const name of ['cure-residential', 'cure-industrial', 'cure-military', 'cure-terminal', 'cure-canister']) {
      const [x, z] = cure.anchors[name];
      expect(l10RoadWeight(x + 2, z, false)).toBe(0);
    }

    // The authored route remains continuous at every seam.
    const route = cure.regions.flatMap(r => r.route);
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .25);
      let last = l10RoadWeight(a[0], a[1], false);
      for (let s = 1; s <= steps; s++) {
        const w = l10RoadWeight(a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps, false);
        expect(Math.abs(w - last)).toBeLessThan(.05); last = w;
      }
    }
  });
  it('scales the follow radius, keeps player zoom on top, eases while walking and applies instantly on reset; the L2 rescue view is capped', () => {
    const view = new View();
    view.framing = (x, z) => l10Framing(x, z, false);
    view.reset({ x: 640, z: 8 });
    expect(view.regionScale).toBeCloseTo(l10RoadFraming.scale, 6);
    expect(view.radius).toBeCloseTo(cameraFraming.radiusM * l10RoadFraming.scale, 6);
    view.zoom(Math.log(1.5), true);
    expect(view.radius).toBeCloseTo(cameraFraming.radiusM * l10RoadFraming.scale * 1.5, 4);
    view.zoom(-Math.log(1.5), true);
    // Step onto the residential checkpoint: the framing eases back rather than snapping.
    const [cx, cz] = cure.anchors['cure-residential'];
    view.reset({ x: cx - 18, z: cz }, true);
    for (let i = 0; i < 18 * 60 / 2; i++) {
      const before = view.regionScale;
      view.update({ x: cx - 18 + i * 2 / 60, z: cz }, 1 / 60);
      expect(Math.abs(view.regionScale - before)).toBeLessThan(.01);
    }
    for (let i = 0; i < 300; i++) view.update({ x: cx, z: cz }, 1 / 60);
    expect(view.regionScale).toBeCloseTo(1, 3);
    expect(view.camera.fov).toBe(cameraFraming.fovDeg);
    // vqa-1 P2 (L2 rescue doors): the scripted widening never exceeds the widest player view and eases back without a jump.
    for (const zoom of [.5, 1.5]) {
      let floor = 0, previous = zoom, maxStep = 0, peak = 0;
      for (let tick = 0; tick < 1200; tick++) {
        const phase = tick < 600 ? 'doors' : 'collapse';
        floor = l2RescueView({ tick, missions: { state: { l2: { phase, doorsOpenAt: phase === 'doors' ? 0 : 540 } } } }, zoom, floor, 1 / 60);
        const effective = Math.max(zoom, floor);
        maxStep = Math.max(maxStep, Math.abs(Math.log(effective / previous))); peak = Math.max(peak, effective); previous = effective;
      }
      expect(peak).toBeCloseTo(Math.max(zoom, l2RescueZoom), 3);
      expect(floor).toBe(0);
      expect(maxStep).toBeLessThanOrEqual(.75 / 60 + 1e-9);
    }
  });
  it('snaps framing on level load, checkpoint/respawn poses and teleports before the first presented frame; the release/closing staging keeps a cured crowd and clears the Mega', async () => {
    const view = new View();
    let finale = false;
    view.framing = (x, z) => l10Framing(x, z, finale);
    const road = { x: 640, z: 8 };
    view.reset(road);
    expect(view.regionScale).toBeCloseTo(1.3, 6);
    // A checkpoint can change framing flags without moving the courier at all.
    finale = true;
    view.snapTo(road);
    expect(view.regionScale).toBe(1);
    expect(view.radius).toBeCloseTo(cameraFraming.radiusM, 6);
    finale = false;
    view.snapTo(road);
    expect(view.regionScale).toBeCloseTo(1.3, 6);
    // A short explicit relocation must snap as well as the automatic >20 m teleport.
    const [cx, cz] = cure.anchors['cure-residential'];
    view.reset({ x: cx - 18, z: cz });
    view.snapTo({ x: cx, z: cz });
    expect(view.regionScale).toBe(1);
    expect(view.focus.x).toBe(cx);
    view.present(.1);
    expect(view.camera.position.distanceTo(view.simCamera.position)).toBeLessThan(1e-6);
    view.update(road, 1 / 60);
    expect(view.regionScale).toBeCloseTo(1.3, 6);
    view.present(.1);
    expect(view.camera.position.distanceTo(view.simCamera.position)).toBeLessThan(1e-6);

    // r31-epilogue (r30-finale-qa: "When the fight ended away from the console, she stands alone with the corgi for 8 s.
    // Cured people only appear when infected are nearby."): the release beat always has a cured crowd around her, clear of
    // bodies; Voss's "Release it. Now." ends with the release; the closing group never stands in the Mega's body.
    await releaseStaging();
  }, 120_000);
});

/** r31-epilogue release/closing staging on the real L10 console fixture. */
async function releaseStaging(): Promise<void> {
  const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
  const decoded = decodeSave(JSON.stringify(f.campaign));
  if (decoded.status !== 'ok') throw new Error('decode');
  const world = await loadLevel('L10', 1, decoded.save), m = world.missions!;
  if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
  const c = m.def.anchors['cure-console'], player = world.entities.get(1)!;
  // Release-ready at the console with nobody infected near, as when the Mega fell far away.
  m.state.states['charge-active'] = m.state.states['charge-ready'] = m.state.states['mega-dead'] = true;
  m.state.counters['charge-ticks'] = 3600; m.state.steps.hold.status = 'completed'; m.state.steps.release.status = 'active';
  for (const e of [...world.entities.iterate()]) if (e.faction === 'infected' && e.health.current > 0 && Math.hypot(e.transform.x - c.x, e.transform.z - c.z) < 30) e.health.current = 0;
  Object.assign(player.transform, { x: c.x + .5, z: c.z }); world.physics.playerBody!.setTranslation({ x: c.x + .5, y: player.transform.y, z: c.z }, true);
  m.radio('L10.release');
  for (let t = 0; t < 4 && !m.state.states['cure-released']; t++) { const fr = emptyInput(); fr.interact = t % 2 === 0; world.applyInput(fr, 'keyboard'); world.update(); }
  expect(m.state.states['cure-released']).toBe(true);
  expect(m.state.subtitle?.id).not.toBe('L10.release');
  const p = player.transform, cured = m.state.cureFront!.affectedIds.map(id => world.entities.get(id)!).filter(e => e?.civilian && e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 14);
  expect(cured.length).toBeGreaterThanOrEqual(world.infected!.director.tier === 'low' ? 4 : 7);
  const bodies = [...world.entities.iterate()].filter(e => e.corpse || (e.health.current <= 0 && e.id !== 1));
  for (const person of cured) for (const body of bodies) expect(Math.hypot(person.transform.x - body.transform.x, person.transform.z - body.transform.z)).toBeGreaterThan(1.5);
  // Deterministic: a second release is a no-op (no second crowd).
  const count = m.state.cureFront!.affectedIds.length; m.l10!.epilogue.gatherCured(); expect(m.state.cureFront!.affectedIds.length).toBe(count);

  // Closing shot: everyone in the group stands clear of the Mega's body, facing her seat.
  world.applyInput(emptyInput(), 'keyboard'); world.update();
  m.state.counters['epilogue-ticks'] = 46 * 60; expect(m.state.epilogue?.phase).toBe('playable');
  const seat = l10Closing.seat(world)!, mega = l10Closing.megaBody(world);
  for (const person of cured) {
    const pose = l10ClosingPose(world, person);
    if (!pose) continue;
    if (mega) expect(Math.hypot(pose.x - mega.x, pose.z - mega.z)).toBeGreaterThanOrEqual(4.49);
    expect(Math.hypot(pose.x - seat.x, pose.z - seat.z)).toBeGreaterThan(3);
  }
  world.dispose();
}
