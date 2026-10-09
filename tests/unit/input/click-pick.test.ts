import { expect, test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ClickPick } from '../../../src/input/ClickPick';
import type { EntitySnapshot } from '../../../src/sim/world/types';

// The game camera: 25 deg lens, radius 19, polar 0.30 pi, azimuth pi/4, 1600x900 canvas (the e2e viewport).
const camera = new PerspectiveCamera(25, 16 / 9, .1, 600);
camera.position.setFromSphericalCoords(19, Math.PI * .3, Math.PI / 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } as unknown as HTMLElement;
const picker = new ClickPick(camera, canvas);
const screen = (x: number, y: number, z: number) => { const p = new Vector3(x, y, z).project(camera); return [(p.x + 1) * 800, (1 - p.y) * 450] as const; };
const infected = (id: number, x: number, z: number, hp = 40, extra: Partial<EntitySnapshot> = {}) => ({ id, faction: 'infected', archetype: 'infected.runner', transform: { x, y: .7, z, yaw: 0 }, health: { current: hp, max: 40 }, infected: { hidden: false, recoverAt: hp > 0 ? -1 : 900 }, ...extra }) as unknown as EntitySnapshot;

test('@E05 @E03 P1 a click on the head, chest, hips or feet of an infected picks it (screen-space body capsule, not the sim origin)', () => {
  const target = infected(2, 1.2, 0);
  for (const y of [0, .9, 1.25, 1.65, 1.75]) {
    const [sx, sy] = screen(1.2, y, 0);
    expect(picker.pick(sx, sy, [target])?.id, `height ${y}`).toBe(2);
  }
  // Beside the body (0.6 m to the side at chest height) is ground, not the infected.
  const [sx, sy] = screen(1.2, 1.2, .9);
  expect(picker.pick(sx, sy, [target])).toBeNull();
});

test('@E05 P1 downed infected stay clickable (PO 10-08 ground hits); corpses, hidden infected, civilians and props are not', () => {
  const lying = infected(3, 1, 1, 0);
  const [sx, sy] = screen(1, .15, 1);
  expect(picker.pick(sx, sy, [lying])?.id).toBe(3);
  expect(picker.pick(sx, sy, [{ ...lying, infected: { hidden: false, recoverAt: -1 } } as unknown as EntitySnapshot])).toBeNull();
  expect(picker.pick(sx, sy, [{ ...lying, corpse: true } as unknown as EntitySnapshot])).toBeNull();
  const [hx, hy] = screen(1.2, 1.25, 0);
  expect(picker.pick(hx, hy, [infected(4, 1.2, 0, 40, { hidden: true })])).toBeNull();
  expect(picker.pick(hx, hy, [{ ...infected(5, 1.2, 0), faction: 'civilian' } as unknown as EntitySnapshot])).toBeNull();
});

test('@E05 P1 overlapping bodies: the one under the cursor wins; near-ties go to the body in front', () => {
  // Camera ground forward is (-1, -1)/sqrt2: `rear` stands 0.8 m behind `front`, offset 0.45 m sideways.
  const front = infected(6, 1, 1), rear = infected(7, 1 - .8 / Math.SQRT2 + .45 / Math.SQRT2, 1 - .8 / Math.SQRT2 - .45 / Math.SQRT2);
  const [rx, ry] = screen(rear.transform.x, 1.6, rear.transform.z);
  expect(picker.pick(rx, ry, [front, rear])?.id).toBe(7);
  const [fx, fy] = screen(1, .5, 1);
  expect(picker.pick(fx, fy, [front, rear])?.id).toBe(6);
});
