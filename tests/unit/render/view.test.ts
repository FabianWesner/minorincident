import { expect, test } from 'vitest';
import { Box3, Plane, Ray, Vector3 } from 'three';
import { View, zoomLimits } from '../../../src/render/View';

test('T-E02-12 @E02 @E02-AC12 shake is bounded and respects the setting immediately', () => {
  const view = new View(); view.reset({ x: 0, z: 0 });
  const base = view.camera.position.clone();
  view.shake(100);
  for (let i = 0; i < 120; i++) {
    view.update({ x: 0, z: 0 }, 1 / 60);
    expect(view.camera.position.distanceTo(base)).toBeLessThanOrEqual(0.4 + 1e-10);
  }
  view.cameraShake = false; view.shake(1); view.update({ x: 0, z: 0 }, 1 / 60);
  expect(view.camera.position.distanceTo(base)).toBe(0);
  view.cameraShake = true; view.shake(1); view.cameraShake = false; view.update({ x: 0, z: 0 }, 0);
  expect(view.camera.position.distanceTo(base)).toBe(0);
  expect(() => view.shake(NaN)).toThrow(RangeError);
});

test('T-E02-camera @E02 follow is frame-rate independent and portrait preserves readable framing and seven metres of ground', () => {
  for (const fps of [30, 60, 144]) {
    const view = new View(); view.reset({ x: 0, z: 0 });
    for (let i = 0; i < fps; i++) { view.update({ x: 20, z: 0 }, 1 / fps); expect(view.focus.x).toBeLessThanOrEqual(20); }
    expect(view.focus.x).toBeCloseTo(20, 2);
  }
  const view = new View();
  const height = (width: number, viewportHeight: number) => {
    view.resize(width, viewportHeight); view.reset({ x: 0, z: 0 });
    return Math.abs(new Vector3(0, 1.8, 0).project(view.camera).y - new Vector3().project(view.camera).y) * viewportHeight / 2;
  };
  expect(height(390, 844) / height(844, 390)).toBeGreaterThan(.9);
  view.resize(390, 844);
  expect(2 * view.radius * Math.tan(view.camera.fov * Math.PI / 360) * view.camera.aspect).toBeGreaterThanOrEqual(7 - 1e-8);
  expect(height(1600, 900) / 900).toBeGreaterThanOrEqual(1 / 5.5);
  expect(height(1600, 900) / 900).toBeLessThanOrEqual(1 / 4);
});

test('T-E02-cinematic @E02 cinematic pose blends to the target and follow restores the combat pose', () => {
  const view = new View(); view.reset({ x: 0, z: 0 }); const combat = view.camera.position.clone();
  view.cinematic({ position: [4, 7, 9], target: [2, 0, 3] });
  expect(view.camera.position.equals(combat)).toBe(true);
  view.update({ x: 0, z: 0 }, 0.5); expect(view.camera.position.distanceTo(new Vector3(4, 7, 9))).toBeGreaterThan(0);
  view.update({ x: 0, z: 0 }, 0.5); expect(view.camera.position.toArray()).toEqual([4, 7, 9]); expect(view.cameraTarget.toArray()).toEqual([2, 0, 3]);
  view.follow(); view.update({ x: 0, z: 0 }, 1); expect(view.camera.position.distanceTo(combat)).toBeLessThan(1e-10); expect(view.cameraTarget.toArray()).toEqual([0, 0, 0]);
});

test('T-fix-camera-ramp camera target follows the player height on decks and ramps, damped, on desktop and phone', () => {
  for (const [w, h] of [[1600, 900], [390, 844]]) {
    const view = new View(); view.resize(w, h); view.reset({ x: 0, z: 0, y: .72 });
    expect(view.cameraTarget.y).toBeCloseTo(0, 6);
    // Reset on a 5.7 m deck: framed immediately, and the courier stays inside the viewport with a margin.
    view.reset({ x: 0, z: 0, y: 5.7 + .72 });
    expect(view.cameraTarget.y).toBeCloseTo(5.7, 6);
    for (const dy of [0, 1.8]) {
      const p = new Vector3(0, 5.7 + dy, 0).project(view.camera);
      expect(Math.abs(p.x)).toBeLessThan(.8); expect(Math.abs(p.y)).toBeLessThan(.8);
    }
    // Climbing: the target rises monotonically without overshoot and without per-tick jumps above 0.15 m at walking pace.
    const climb = new View(); climb.resize(w, h); climb.reset({ x: 0, z: 0, y: .72 });
    let last = 0;
    for (let i = 0; i < 600; i++) {
      const y = .72 + Math.min(5, i * 0.02);
      climb.update({ x: i * .03, z: 0, y }, 1 / 60);
      expect(climb.focus.y).toBeGreaterThanOrEqual(last - 1e-9); expect(climb.focus.y - last).toBeLessThan(.15); expect(climb.focus.y).toBeLessThanOrEqual(y - .72 + 1e-9);
      last = climb.focus.y;
    }
    expect(climb.focus.y).toBeGreaterThan(4.5);
  }
});

test('T-E21-spawn-camera @E21 spawn framing retains ramp height and zoom while ignoring pull, shake and roll', () => {
  for (const [width,height] of [[1600,900],[390,844]]) {
    const a=new View(),b=new View();
    for(const v of [a,b]){v.resize(width,height);v.reset({x:195,z:0,y:6.42});v.encounterScale=2;v.zoom(.1);}
    a.pull(201,0,.8);a.shake(1);a.roll(1);
    for(let i=0;i<60;i++){const p={x:195+i*.1,z:0,y:6.42-i*.05};a.update(p,1/60);b.update(p,1/60);expect(a.simCamera.matrixWorld.elements).toEqual(b.simCamera.matrixWorld.elements);expect(a.simCamera.projectionMatrix.elements).toEqual(b.simCamera.projectionMatrix.elements);}
    expect(a.camera.position.distanceTo(b.camera.position)).toBeGreaterThan(.1);
  }
});


test('T-E02-max-zoom @E02-AC03 @E18-AC01 max zoom keeps desktop and portrait ground inside the low-tier cull and light-field bounds', () => {
  expect(zoomLimits[1]).toBe(1.5);
  for (const [width, height] of [[1600, 900], [390, 844]]) {
    const view = new View(); view.resize(width, height); view.reset({ x: 0, z: 0 });
    const base = view.radius; view.zoom(100);
    for (let tick = 0; tick < 120; tick++) view.update({ x: 0, z: 0 }, 1 / 60);
    expect(view.radius).toBeCloseTo(base * 1.5, 6);
    expect(view.simCamera.position.toArray()).toEqual(view.camera.position.toArray());
    const ground = new Plane(new Vector3(0, 1, 0), 0);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const direction = new Vector3(x, y, .5).unproject(view.simCamera).sub(view.simCamera.position).normalize();
      const point = new Ray(view.simCamera.position, direction).intersectPlane(ground, new Vector3())!;
      expect(point.length()).toBeLessThan(45);
      expect(Math.max(Math.abs(point.x), Math.abs(point.z))).toBeLessThan(30);
    }
  }
});

test('T-E32-26-camera-S9 @E32-AC26 epilogue pull widens the follow rig while wheel zoom, player tracking and resize keep working', () => {
  for (const [width, height] of [[1600, 900], [390, 844]]) {
    const view = new View(); view.resize(width, height); view.reset({ x: 0, z: 0 });
    const base = view.radius; view.epilogueScale = 4; view.pull(2, -2, .4);
    view.zoom(Math.log(.5), true); view.update({ x: 4, z: -3 }, 1 / 60);
    expect(view.getState().zoom).toBe(.5); expect(view.radius).toBeCloseTo(base * 2);
    expect(view.focus.x).toBeGreaterThan(0); expect(view.focus.z).toBeLessThan(0);
    view.zoom(Math.log(2), true); view.update({ x: 4, z: -3 }, 1 / 60);
    expect(view.getState().zoom).toBe(1); expect(view.radius).toBeCloseTo(base * 4);
    view.resize(width, height); expect(view.radius).toBeCloseTo(base * 4);
    view.reset({ x: 0, z: 0 }); expect(view.radius).toBeCloseTo(base);
  }
});

// The relocated Harbor cellar puts the zoom-1 lens inside the opposite apartment.
test('@E22 @E23 the Fairhaven follow lens stays outside the opposite building at the cellar exit', () => {
  const view = new View(), player = { x: -79.3, y: .85, z: -44.2801 };
  const building = new Box3(new Vector3(-73.1002, 0, -34.3001), new Vector3(-62.8, 12.85, -21.6999));
  view.cameraSolids.push(building); view.reset(player);
  expect(building.containsPoint(view.camera.position)).toBe(false);
  expect(view.camera.position.distanceTo(view.focus)).toBeLessThan(view.radius);
  expect(view.playerZoom).toBe(1);
  expect(view.camera.position.toArray()).toEqual(view.simCamera.position.toArray());
  view.zoom(Math.log(.5), true);
  for (let i = 0; i < 120; i++) view.update(player, 1 / 60);
  expect(building.containsPoint(view.camera.position)).toBe(false);
  expect(view.camera.position.distanceTo(view.focus)).toBeCloseTo(view.radius, 3);
  view.cameraSolids.length = 0; view.reset(player);
  expect(view.camera.position.distanceTo(view.focus)).toBeCloseTo(view.radius, 6);
});

test('@E22 vehicle follow framing stays fixed across facade bounds at both zooms', () => {
  for (const zoom of [.5, 1]) {
    const view = new View();
    view.cameraSolids.push(new Box3(new Vector3(-54, 0, -34), new Vector3(-43, 18, -20)));
    view.reset({ x: -56.75, y: .705, z: -18 });
    view.driving = true; view.zoom(Math.log(zoom), true);
    view.update({ x: -56.75, y: .705, z: -18 }, 0);
    const offset = view.camera.position.clone().sub(view.focus);
    for (let tick = 0; tick < 240; tick++) {
      view.update({ x: -56.75, y: .705, z: -18 - tick * .115 }, 1 / 60);
      expect(view.camera.position.clone().sub(view.focus).distanceTo(offset)).toBeLessThan(1e-9);
      expect(view.camera.position.distanceTo(view.focus)).toBeCloseTo(view.getState().radius, 8);
    }
  }
});

test('@E22 camera clearance beside the moved Lakeshore apartment preserves framing throughout the lane', () => {
  const building = new Box3(new Vector3(61.28, 0, 30.2599), new Vector3(73.88, 17.76, 40.2201));
  for (const x of [57, 59.1, 61, 64, 67]) {
    const view = new View(), player = { x, y: .85, z: 27.5 };
    view.cameraSolids.push(building); view.reset(player);
    expect(building.containsPoint(view.camera.position)).toBe(false);
    expect(view.camera.position.distanceTo(view.focus)).toBeGreaterThanOrEqual(19 * zoomLimits[0] - 1e-9);
    const ray = new Ray(view.focus.clone(), view.camera.position.clone().sub(view.focus).normalize());
    const hit = ray.intersectBox(building, new Vector3());
    expect(hit === null || hit.distanceTo(view.focus) > view.camera.position.distanceTo(view.focus)).toBe(true);
    expect(view.camera.position.toArray()).toEqual(view.simCamera.position.toArray());
  }
});

test('@E22 seated convoy keeps a constant lens offset while passing Fairhaven facades', () => {
  const view = new View(); view.resize(1600, 900); view.convoy = true; view.driving = true;
  view.cameraSolids.push(new Box3(new Vector3(-5, 0, 4), new Vector3(20, 18, 18)));
  view.reset({ x: -20, z: 0 });
  const distance = view.camera.position.distanceTo(view.focus);
  for (let tick = 0; tick < 300; tick++) {
    view.update({ x: -20 + tick * .15, z: 0 }, 1 / 60);
    expect(view.camera.position.distanceTo(view.focus)).toBeCloseTo(distance, 8);
  }
});
