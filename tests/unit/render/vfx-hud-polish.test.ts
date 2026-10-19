import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Frustum, Matrix4, MeshBasicNodeMaterial, Sphere, Vector3 } from 'three/webgpu';
import { View } from '../../../src/render/View';
import { Foliage } from '../../../src/render/Foliage';
import { InteractionView } from '../../../src/render/InteractionView';
import { l6 } from '../../../src/data/l6';
import { seeThrough } from '../../../src/render/SeeThrough';
import type { Materials } from '../../../src/render/Materials';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

test.each([[1280, 720], [1920, 1080], [390, 844]])('L5 checkpoint/entrance teleport frames the courier immediately at %sx%s', (width, height) => {
  const view = new View(); view.resize(width, height); view.reset({ x: 74.88, z: -2.98 });
  const courier = { x: -79.3, y: .72, z: -44.28 };
  view.update(courier, 1 / 60); view.present(.01);
  const projected = new Vector3(courier.x, .9, courier.z).project(view.camera);
  expect(Math.abs(projected.x)).toBeLessThan(.1); expect(Math.abs(projected.y)).toBeLessThan(.2);
});

test.each([.5, 1])('foreground canopy clears six metres of combat space at zoom %s', zoom => {
  const view = new View(); view.reset({ x: 0, z: 0 }); view.zoom(Math.log(zoom), true); view.update({ x: 0, z: 0 }, 0);
  const foliage = Object.assign(Object.create(Foliage.prototype), { player: seeThrough.center, playerDepth: seeThrough.depth,
    target: { value: seeThrough.center.value.clone() }, targetDepth: { value: 0 }, holeRadius: seeThrough.radius,
    point: new Vector3(), frustum: new Frustum(), projection: new Matrix4(), bounds: new Sphere(), batches: [], reveal: true });
  foliage.update(view, { x: 0, y: .72, z: 0 });
  const cameraRight = new Vector3().setFromMatrixColumn(view.camera.matrixWorld, 0);
  const center = new Vector3(0, .72, 0).project(view.camera), edge = cameraRight.multiplyScalar(5).add(new Vector3(0, .72, 0)).project(view.camera);
  expect(seeThrough.radius.value * .85).toBeGreaterThan(Math.abs(edge.x - center.x) * .5 * view.camera.aspect);
});

test('L6 bracing guides use lit floor paint and the service gate asset, without wire cubes or floating arrows', () => {
  const element = () => ({ dataset: {}, style: {}, append() {}, setAttribute() {}, remove() {} });
  vi.stubGlobal('document', { createElement: element, querySelector: element });
  const material = new MeshBasicNodeMaterial();
  try {
    const world = { scenario: 'L6', props: { items: [{ id: 'crate', assetId: 'prop.crates', pose: { p: [l6.gates[0], .6, 15] } }] } } as unknown as SimWorld;
    const view = new InteractionView(world, { get: () => material } as unknown as Materials, new View());
    expect(view.children.some(child => child.type === 'LineSegments')).toBe(false);
    expect(view.children.some(child => child.type === 'Mesh' && 'geometry' in child && (child.geometry as { type: string }).type === 'ConeGeometry')).toBe(false);
    const source = readFileSync('src/render/InteractionView.ts', 'utf8');
    expect(source).toContain("loadAsset('prop.service-gate'");
    expect(source).toContain("materials.get('schoolBusYellow')");
  } finally { material.dispose(); vi.unstubAllGlobals(); }
});

test('solid reveal has a fully clear core rather than retaining an opaque wall blob', () => {
  const source = readFileSync('src/render/SeeThrough.ts', 'utf8');
  expect(source).toContain('const keep = hole.greaterThan(noise)');
  expect(source).not.toContain('hole.mul(.65).add(.35)');
});
