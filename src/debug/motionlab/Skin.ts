import { Bone, BufferAttribute, Group, Matrix4, Mesh, MeshLambertNodeMaterial, Skeleton, SkinnedMesh, Vector3, type Object3D, type BufferGeometry, type MeshBasicMaterial } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Runtime study of our actual geometry. Two-joint weights soften sleeves/knees;
 * this does not weld disconnected shells or substitute for production topology. */
export function skinFigure(source: Group): Group {
  source.updateMatrixWorld(true);
  const result = new Group(), bones: Bone[] = [], mapping = new Map<Object3D, Bone>();
  function build(node: Object3D, parent: Object3D): void {
    if (node instanceof Mesh) return;
    const bone = new Bone(); bone.name = node.name; bone.position.copy(node.position); bone.quaternion.copy(node.quaternion); bone.scale.copy(node.scale);
    parent.add(bone); bones.push(bone); mapping.set(node, bone);
    for (const child of node.children) build(child, bone);
  }
  build(source, result); result.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [], position = new Vector3(), joint = new Vector3();
  source.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (let p: Object3D | null = node; p; p = p.parent) if (!p.visible || p.name.startsWith('stump_')) return;
    let owner = node.parent!; while (!mapping.has(owner) && owner.parent) owner = owner.parent;
    const bone = mapping.get(owner)!;
    const index = bones.indexOf(bone);
    const candidates = [bone.parent, ...bone.children].filter((n): n is Bone => n instanceof Bone && /^(torso|arm[LR]|foreArm[LR]|leg[LR]|shin[LR])$/.test(n.name));
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    for (const name of ['position', 'normal']) {
      const a = geometry.getAttribute(name), values = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) values[i * 3 + c] = a.getComponent(i, c);
      geometry.setAttribute(name, new BufferAttribute(values, 3));
    }
    geometry.applyMatrix4(node.matrixWorld);
    const vertices = geometry.getAttribute('position'), colors = new Float32Array(vertices.count * 3), indices = new Uint16Array(vertices.count * 4), weights = new Float32Array(vertices.count * 4);
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as MeshBasicMaterial, originalColor = geometry.getAttribute('color');
    const rigid = /^(head|hand[LR]|foot[LR]|weaponSocket[LR]|backpackSocket)$/.test(bone.name);
    for (let i = 0; i < vertices.count; i++) {
      position.fromBufferAttribute(vertices, i); let second = index, weight = 0;
      if (!rigid) for (const candidate of candidates) {
        // Blend only in a 12 cm joint band, at most 40%; equipment remains rigid.
        const w = .4 * Math.max(0, 1 - position.distanceTo(candidate.getWorldPosition(joint)) / .12);
        if (w > weight) { weight = w; second = bones.indexOf(candidate); }
      }
      indices.set([index, second, 0, 0], i * 4); weights.set([1 - weight, weight, 0, 0], i * 4);
      const color = material.color?.toArray() ?? [.5, .4, .3];
      for (let c = 0; c < 3; c++) colors[i * 3 + c] = color[c] * (material.vertexColors && originalColor ? originalColor.getComponent(i, c) : 1);
    }
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
    geometry.clearGroups(); geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('skinIndex', new BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4)); geometries.push(geometry);
  });
  const geometry = mergeGeometries(geometries); if (!geometry) throw new Error('Motion lab skin merge failed');
  for (const g of geometries) g.dispose();
  const mesh = new SkinnedMesh(geometry, new MeshLambertNodeMaterial({ vertexColors: true })); mesh.name = 'lab-skin'; mesh.frustumCulled = false;
  result.add(mesh); mesh.bind(new Skeleton(bones), new Matrix4()); result.userData.bones = bones.length;
  return result;
}
