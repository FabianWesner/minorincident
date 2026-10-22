import { expect, test } from 'vitest';
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix3, Matrix4, NodeBuilder, PerspectiveCamera, Scene, Vector3, WebGLCoordinateSystem } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { staticInstanceAttributes } from '../../../src/render/StaticInstanceAttributes';

function fixture(corpses = true) {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting), source = materials.get('sidewalk');
  source.userData.batchFeatures = corpses ? 'corpses' : 'static-world';
  const original = new BoxGeometry(), mesh = new InstancedMesh(original, source, 2);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(6).fill(1), 3);
  const dispose = () => { mesh.geometry.dispose(); original.dispose(); mesh.dispose(); materials.dispose(); lighting.dispose(); };
  return { scene, original, mesh, dispose };
}

test('PO #98 rigid corpse normals reuse placement attributes and match inverse-transpose after yaw and translation', () => {
  const f = fixture(), matrices = [new Matrix4().makeRotationY(.7).setPosition(4002, 0, -27), new Matrix4().makeRotationY(-2.4).setPosition(-12, 2, 35)];
  try {
    matrices.forEach((m, i) => f.mesh.setMatrixAt(i, m)); f.mesh.instanceMatrix.needsUpdate = true; f.mesh.count = 1;
    expect(staticInstanceAttributes(f.mesh)).toBe(true);
    const attribute = f.mesh.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute;
    expect(attribute.data.array).toBe(f.mesh.instanceMatrix.array);
    expect(attribute.data.stride).toBe(16); expect(f.mesh.geometry.hasAttribute('_placementNormal0')).toBe(false);
    const render = () => f.mesh.onBeforeRender({} as never, f.scene, new PerspectiveCamera(), f.mesh.geometry, f.mesh.material as never, null as never);
    render(); f.mesh.count = 2; render();
    expect(attribute.data.version).toBe(f.mesh.instanceMatrix.version);
    for (let i = 0; i < 2; i++) {
      const placed = new Matrix4().fromArray(attribute.data.array, i * 16);
      expect(placed.elements).toEqual(new Matrix4().fromArray(f.mesh.instanceMatrix.array, i * 16).elements);
      for (const normal of [new Vector3(1, 0, 0), new Vector3(1, 2, 3).normalize()]) {
        const expected = normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(placed)).normalize();
        expect(normal.clone().transformDirection(placed).distanceTo(expected)).toBeLessThan(1e-6);
      }
    }
    expect(f.mesh.geometry.getAttribute('position').array).toBe(f.original.getAttribute('position').array);
  } finally { f.dispose(); }
});

for (const corpses of [true, false]) test(`PO #98 ${corpses ? 'corpse' : 'ordinary static'} vertex graph ${corpses ? 'omits' : 'retains'} the matrix inverse`, () => {
  const f = fixture(corpses);
  interface Builder { setBuildStage(stage: 'setup'): void; setShaderStage(stage: 'vertex'): void; addStack(): void; removeStack(): void; nodes: Set<{ type: string; method?: string }> }
  const Setup = NodeBuilder as unknown as new (object: InstancedMesh, renderer: object, parser: null) => Builder;
  const builder = new Setup(f.mesh, { coordinateSystem: WebGLCoordinateSystem, hasCompatibility: () => false, debug: { diagnostics: { keywords: false } } }, null);
  try {
    staticInstanceAttributes(f.mesh); builder.setBuildStage('setup'); builder.setShaderStage('vertex'); builder.addStack();
    (f.mesh.material as import('../../../src/render/PaletteMaterial').PaletteMaterial).positionNode!.build(builder as never);
    expect([...builder.nodes].some(n => n.method === 'inverse')).toBe(!corpses);
  } finally { builder.removeStack(); f.dispose(); }
});
