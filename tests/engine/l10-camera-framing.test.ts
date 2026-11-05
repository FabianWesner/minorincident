import { describe, expect, it } from 'vitest';
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
  it('snaps framing on level load, checkpoint/respawn poses and teleports before the first presented frame', () => {
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
  });
});
