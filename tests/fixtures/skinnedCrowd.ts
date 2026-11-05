import { Bone, BufferAttribute, BoxGeometry, Group, MeshBasicMaterial, Skeleton, SkinnedMesh } from 'three';
import { characterNodes } from '../../src/data/survivor';

/** Minimal weighted figure for crowd bake and frozen corpse contracts. */
export function createSkinnedCrowdFixture(): Group {
  const root = new Group(); root.name = 'root';
  const bones = characterNodes.filter(name => name !== 'root').map(name => { const bone = new Bone(); bone.name = name; root.add(bone); return bone; });
  const geometry = new BoxGeometry(.7, 1.2, .4), count = geometry.getAttribute('position').count;
  const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinIndex', new BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial({ color: '#92705a', vertexColors: true })); mesh.name = 'skin_body'; mesh.bind(new Skeleton(bones)); root.add(mesh); root.updateMatrixWorld(true);
  return root;
}
