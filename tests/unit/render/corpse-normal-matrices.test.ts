import { expect, test, vi } from 'vitest';
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

test('PO #98 corpse placement precomputes the same inverse-transpose for scale and shear only when matrices change', () => {
  const f = fixture(), matrices = [new Matrix4().makeRotationY(.7).scale(new Vector3(2, 3, .5)), new Matrix4().makeShear(.2, .1, .3, .1, -.1, .2), new Matrix4().makeScale(.5, 2, 4)];
  const expected = matrices.map(m => new Matrix3().getNormalMatrix(m).elements.slice());
  const inverse = vi.spyOn(Matrix3.prototype, 'getNormalMatrix');
  try {
    matrices.slice(0, 2).forEach((m, i) => f.mesh.setMatrixAt(i, m)); f.mesh.instanceMatrix.needsUpdate = true;
    expect(staticInstanceAttributes(f.mesh)).toBe(true);
    const attribute = f.mesh.geometry.getAttribute('_placementNormal0') as import('three').InterleavedBufferAttribute;
    expect(attribute.data).toBe((f.mesh.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute).data);
    expect(attribute.data.stride).toBe(25); expect(Object.keys(f.mesh.geometry.attributes).length).toBeLessThanOrEqual(16);
    const render = () => f.mesh.onBeforeRender({} as never, f.scene, new PerspectiveCamera(), f.mesh.geometry, f.mesh.material as never, null as never);
    const check = (index: number, normal: number[]) => normal.forEach((n, i) => expect(attribute.data.array[index * 25 + 16 + i]).toBeCloseTo(n, 6));
    render(); check(0, expected[0]); check(1, expected[1]); expect(inverse).toHaveBeenCalledTimes(2);
    const version = attribute.data.version; render(); expect(inverse).toHaveBeenCalledTimes(2); expect(attribute.data.version).toBe(version);
    f.mesh.setMatrixAt(0, matrices[2]); f.mesh.instanceMatrix.needsUpdate = true; render(); check(0, expected[2]); expect(inverse).toHaveBeenCalledTimes(4);
    expect(attribute.data.version).toBe(f.mesh.instanceMatrix.version);
    expect(f.original.hasAttribute('_placementNormal0')).toBe(false);
    expect(f.mesh.geometry.getAttribute('position').array).toBe(f.original.getAttribute('position').array);
  } finally { inverse.mockRestore(); f.dispose(); }
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
