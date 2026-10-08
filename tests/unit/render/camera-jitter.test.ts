import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { Clock, FIXED_DT } from '../../../src/core/Clock';
import { View } from '../../../src/render/View';
import { MotionPresentation } from '../../../src/render/characters/MotionPresentation';

/** Frame pacings: exact 60/120/144 Hz plus uneven ProMotion-like 120 Hz and a 60 Hz with alternating 14/19 ms frames. */
const pacings: Record<string, (i: number) => number> = {
  '60 Hz': () => 1 / 60,
  '120 Hz': () => 1 / 120,
  '144 Hz': () => 1 / 144,
  'uneven 120 Hz': (i) => (0.6 + 0.8 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1) / 120,
  'uneven 60 Hz': (i) => (i % 2 ? 0.019 : 0.014),
  // Real 60 Hz vsync: timestamps scatter around 16.7 ms, so frames alternate between 0 and 2 sim ticks.
  'vsync 60 Hz': (i) => (16.67 + 1.2 * Math.sin(i * 2.7) * Math.cos(i * 1.3)) / 1000,
  'hitches': (i) => [8.3, 25, 33.3, 16.7, 8.3, 41.7][i % 6] / 1000,
};

/** Squared residuals of a least-squares quadratic fit over one window (absorbs smooth acceleration/perspective). */
const quadraticResiduals = (t: number[], y: number[]): number => {
  const n = t.length, t0 = t[0], s = new Array(5).fill(0), r = [0, 0, 0];
  for (let i = 0; i < n; i++) { const x = t[i] - t0; let p = 1; for (let k = 0; k < 5; k++) { s[k] += p; if (k < 3) r[k] += p * y[i]; p *= x; } }
  const m = [[s[0], s[1], s[2], r[0]], [s[1], s[2], s[3], r[1]], [s[2], s[3], s[4], r[2]]];
  for (let c = 0; c < 3; c++) for (let row = c + 1; row < 3; row++) { const f = m[row][c] / m[c][c]; for (let k = c; k < 4; k++) m[row][k] -= f * m[c][k]; }
  const a = [0, 0, 0]; for (let row = 2; row >= 0; row--) { let v = m[row][3]; for (let k = row + 1; k < 3; k++) v -= m[row][k] * a[k]; a[row] = v / m[row][row]; }
  let sum = 0; for (let i = 0; i < n; i++) { const x = t[i] - t0; const e = y[i] - (a[0] + a[1] * x + a[2] * x * x); sum += e * e; }
  return sum;
};
/** High-pass jitter: RMS deviation from a smooth curve, fitted piecewise over 100 ms windows. */
const jitterRms = (t: number[], y: number[]): number => {
  let sum = 0, count = 0;
  for (let start = 0; start < t.length;) {
    let end = start; while (end < t.length && t[end] - t[start] < 0.1) end++;
    if (end - start >= 5) { sum += quadraticResiduals(t.slice(start, end), y.slice(start, end)); count += end - start; }
    start = end;
  }
  return Math.sqrt(sum / count);
};

/** Game.ts loop shape: fixed 60 Hz sim ticks advance the camera rig; each display frame renders at the clock alpha. */
function measure(pacing: (i: number) => number, direction: { x: number; z: number }, interpolate: boolean) {
  const width = 1600, height = 900, speed = 5.5;
  const view = new View(); view.resize(width, height); view.reset({ x: 0, z: 0 });
  const clock = new Clock(); clock.init();
  const current = { x: 0, z: 0 }, previous = { x: 0, z: 0 };
  const settle = 3, end = 4.5, prop = new Vector3(direction.x * speed * 3.7, 0, direction.z * speed * 3.7);
  const samples = { t: [] as number[], px: [] as number[], py: [] as number[], sx: [] as number[], sy: [] as number[], cx: [] as number[], cy: [] as number[] };
  // The corgi (and every NPC/crowd figure) is presented by MotionPresentation from its tick transforms.
  const presentation = new MotionPresentation(), corgi = { x: -1.2, y: 0.3, z: 0.8, yaw: 0 };
  let tick = 0;
  const projected = new Vector3();
  for (let i = 0, time = 0; time < end; i++) {
    const dt = pacing(i); time += dt;
    clock.advance(dt, () => {
      previous.x = current.x; previous.z = current.z;
      current.x += direction.x * speed * FIXED_DT; current.z += direction.z * speed * FIXED_DT;
      corgi.x = current.x - 1.2; corgi.z = current.z + 0.8; tick++;
      view.update(current, FIXED_DT);
    });
    if (interpolate) view.present(clock.alpha);
    const dog = presentation.sample(7, corgi, tick, clock.alpha), dogAt = new Vector3(dog.x, 0.3, dog.z);
    if (time < settle) continue;
    const a = clock.alpha, player = new Vector3(previous.x + (current.x - previous.x) * a, 0.7, previous.z + (current.z - previous.z) * a);
    samples.t.push(time);
    projected.copy(player).project(view.camera); samples.px.push(projected.x * width / 2); samples.py.push(projected.y * height / 2);
    projected.copy(prop).project(view.camera); samples.sx.push(projected.x * width / 2); samples.sy.push(projected.y * height / 2);
    projected.copy(dogAt).project(view.camera); samples.cx.push(projected.x * width / 2); samples.cy.push(projected.y * height / 2);
  }
  const rms = (x: number[], y: number[]) => Math.hypot(jitterRms(samples.t, x), jitterRms(samples.t, y));
  return { player: rms(samples.px, samples.py), prop: rms(samples.sx, samples.sy), corgi: rms(samples.cx, samples.cy) };
}

const directions = { straight: { x: 1, z: 0 }, diagonal: { x: Math.SQRT1_2, z: Math.SQRT1_2 } };

test('T-E02-camera-jitter @E02 @E04 running at constant speed scrolls without screen-space jitter at any frame pacing', () => {
  const rows: string[] = [];
  for (const [pace, pacing] of Object.entries(pacings)) for (const [name, direction] of Object.entries(directions)) {
    const before = measure(pacing, direction, false), after = measure(pacing, direction, true);
    rows.push(`${pace.padEnd(14)} ${name.padEnd(8)} tick-camera player ${before.player.toFixed(3)} px prop ${before.prop.toFixed(3)} px | interpolated player ${after.player.toFixed(3)} px prop ${after.prop.toFixed(3)} px corgi ${after.corgi.toFixed(3)} px`);
    // Static props (the scrolling world) and the courier both move on a smooth curve on screen.
    expect(after.prop, `${pace} ${name} prop`).toBeLessThanOrEqual(0.25);
    expect(after.player, `${pace} ${name} player`).toBeLessThanOrEqual(0.25);
    expect(after.corgi, `${pace} ${name} corgi`).toBeLessThanOrEqual(0.25);
  }
  // The harness detects the old bug: a tick-rate camera stair-steps on a 120 Hz display.
  expect(measure(pacings['120 Hz'], directions.straight, false).prop).toBeGreaterThan(1);
  if (process.env.JITTER_REPORT) console.log(rows.join('\n'));
});

test('T-E04-presentation-ticks @E04 a frame that runs several sim ticks interpolates from the previous tick, not the last sampled one', () => {
  const presentation = new MotionPresentation();
  presentation.sample(3, { x: 0, y: 0, z: 0, yaw: 0 }, 10, 1);
  // Two ticks in one frame (10 -> 12) at 0.1 m/tick: alpha 0 shows tick 11, alpha .5 halfway to tick 12.
  expect(presentation.sample(3, { x: 0.2, y: 0, z: 0, yaw: 0 }, 12, 0).x).toBeCloseTo(0.1, 9);
  expect(presentation.sample(3, { x: 0.2, y: 0, z: 0, yaw: 0 }, 12, 0.5).x).toBeCloseTo(0.15, 9);
  expect(presentation.sample(3, { x: 0.3, y: 0, z: 0, yaw: 0 }, 13, 0).x).toBeCloseTo(0.2, 9);
});

test('T-E02-camera-present @E02 presenting the camera never extrapolates and snaps on resets', () => {
  const view = new View(); view.resize(1600, 900); view.reset({ x: 0, z: 0 });
  const start = view.camera.position.clone();
  view.update({ x: 1, z: 0 }, FIXED_DT); const tick = view.camera.position.clone();
  view.present(0); expect(view.camera.position.distanceTo(start)).toBeLessThan(1e-9);
  view.present(0.5); expect(view.camera.position.distanceTo(start.clone().lerp(tick, 0.5))).toBeLessThan(1e-9);
  view.present(1); expect(view.camera.position.distanceTo(tick)).toBeLessThan(1e-9);
  view.reset({ x: 30, z: 0 }); const teleported = view.camera.position.clone();
  view.present(0); expect(view.camera.position.distanceTo(teleported)).toBeLessThan(1e-9);
});

test('T-E02-shadow-stable @E02 the sun shadow map moves in whole texels while the camera scrolls (no swimming edges)', () => {
  const lighting = new Lighting(new Scene()), view = new View(); view.resize(1600, 900); view.reset({ x: 0, z: 0 });
  lighting.set('L1'); lighting.setQuality('high');
  const shadow = lighting.sun.shadow, probe = new Vector3(3.3, 0, -1.7), local = new Vector3();
  let first: [number, number] | null = null;
  for (let i = 0; i < 240; i++) {
    view.update({ x: i * 0.0917, z: i * 0.0411 }, FIXED_DT); view.present(0.37);
    lighting.update(view);
    lighting.sun.updateMatrixWorld(); lighting.sun.target.updateMatrixWorld(); shadow.updateMatrices(lighting.sun);
    const texel = 2 * shadow.camera.right / shadow.mapSize.x;
    local.copy(probe).applyMatrix4(shadow.camera.matrixWorldInverse);
    const fraction = [((local.x / texel) % 1 + 1) % 1, ((local.y / texel) % 1 + 1) % 1] as [number, number];
    first ??= fraction;
    for (const k of [0, 1]) expect(Math.min(Math.abs(fraction[k] - first[k]), 1 - Math.abs(fraction[k] - first[k])), `frame ${i}`).toBeLessThan(1e-3);
  }
});
