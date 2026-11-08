import { Box3, Group, InstancedMesh, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three/webgpu';
import { staticBatch } from '../../assets/staticBatch';
import type { AssetRegistry } from '../../assets/registry';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import type { Materials } from '../Materials';
import type { CrowdPosePalette } from './CrowdPosePalette';

const clothing = new Set(['navy', 'navySeam', 'blueTrim', 'silver', 'uiDark', 'picketWhite']);
const jointName = /^(root|hip|torso|body|neck|head|jaw|tail|arm[LR]|foreArm[LR]|hand[LR]|leg[BF]?[LR]|shin[LR]|foot[LR]|paw[BF]?[LR])$/;
/** Reuse the authored police vest on the current skinned dog, keeping the
 * retired rigid dog's body out of the production crowd. Source stays borrowed. */
export function k9VestModel(source: Object3D, width: number, materials?: Materials): Group {
  source.updateMatrixWorld(true);
  const body = source.getObjectByName('body');
  if (!body) throw new Error('K9 vest requires the authored body pivot');
  const inverse = body.matrixWorld.clone().invert(), parts = new Group();
  source.traverse(node => {
    if (!(node instanceof Mesh)) return;
    let joint = node.parent;
    while (joint && !jointName.test(joint.name)) joint = joint.parent;
    if (joint?.name !== 'body' && joint?.name !== 'torso') return;
    // Production LODs merge authored pieces by rigid bone and palette. Their
    // navy/trim/patch primitives retain the vest without the shepherd's fur.
    const palette = Array.isArray(node.material) ? node.material : [node.material];
    const index = node.geometry.index, size = index?.count ?? node.geometry.getAttribute('position').count;
    const groups = node.geometry.groups.length ? node.geometry.groups : [{ start: 0, count: size, materialIndex: 0 }];
    for (const group of groups) {
      const material = palette[group.materialIndex ?? 0];
      const token = (material as Material & { token?: string }).token ?? material.name.replace(/^pal_/, '');
      if (!clothing.has(token)) continue;
      const indexed = node.geometry.clone(); indexed.clearGroups();
      indexed.setIndex(Array.from({ length: group.count }, (_, i) => index ? index.getX(group.start + i) : group.start + i));
      const geometry = indexed.toNonIndexed(); indexed.dispose();
      const mesh = new Mesh(geometry, material);
      mesh.applyMatrix4(new Matrix4().multiplyMatrices(inverse, node.matrixWorld)); parts.add(mesh);
    }
  });
  if (!parts.children.length) throw new Error('K9 vest has no authored clothing');
  const size = new Box3().setFromObject(parts).getSize(new Vector3());
  const fit = width / size.z;
  parts.scale.setScalar(fit); parts.updateMatrixWorld(true);
  const model = staticBatch(parts, true, materials);
  parts.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); });
  return model;
}

/** One story K9, with its vest driven by the same displayed body bone and pose
 * as the skinned crowd. Instancing retains the crowd's draw/layout contract. */
export class K9Vest extends Group {
  private readonly meshes: InstancedMesh[] = [];
  private readonly joint = new Matrix4();
  private readonly transform = new Matrix4();
  private owner = 0;
  async init(registry: AssetRegistry, materials?: Materials): Promise<void> {
    const source = await registry.loadAsset('inf.dog-k9', 'lod1');
    const width = registry.definition('inf.dog').dimensions.z * 1.1;
    const model = k9VestModel(source, width, materials);
    model.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const mesh = new InstancedMesh(node.geometry, node.material, 1);
      mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'l8-k9-vest';
      this.meshes.push(mesh); this.add(mesh);
    });
  }
  begin(world: SimWorld): void {
    const e = world.entities.get(this.owner);
    // The settled dog leaves the animated figure list; retain its last vest
    // pose with its corpse, and clear it on a checkpoint or level rebuild.
    const retained = !!e?.corpse && !e.hidden && e.infected?.variant === 'inf.dog-k9';
    for (const mesh of this.meshes) mesh.count = retained ? 1 : 0;
  }
  place(e: EntitySnapshot, poses: CrowdPosePalette, frame: number, blend: readonly [number, number], instance: Matrix4): void {
    if (e.infected?.variant !== 'inf.dog-k9') return;
    const part = poses.clip.parts.indexOf('body');
    if (part < 0) throw new Error('The K9 requires the skinned dog body joint');
    poses.part(frame, blend[0], blend[1], part, this.joint);
    this.transform.multiplyMatrices(instance, this.joint); this.owner = e.id;
    for (const mesh of this.meshes) { mesh.setMatrixAt(0, this.transform); mesh.count = 1; mesh.instanceMatrix.needsUpdate = true; }
  }
  dispose(): void {
    const materials = new Set<Material>();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose(); mesh.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    materials.forEach(material => material.dispose()); this.meshes.length = 0; this.clear();
  }
}
