import { Box3, Group, InstancedMesh, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three/webgpu';
import { staticBatch } from '../../assets/staticBatch';
import type { AssetRegistry } from '../../assets/registry';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import type { Materials } from '../Materials';
import type { CrowdPosePalette } from './CrowdPosePalette';

const clothing = /^(vest_shell|bound_vest_edge|side_patch|POLICE_|girth_strap|strap_buckle|buckle_inner|webbing_stitch|shoulder_strap|shoulder_buckle|chest_bib|chest_patch|carry_handle|top_webbing|top_loop)/i;
/** Reuse the authored police vest on the current skinned dog, keeping the
 * retired rigid dog's body out of the production crowd. Source stays borrowed. */
export function k9VestModel(source: Object3D, width: number, materials?: Materials): Group {
  source.updateMatrixWorld(true);
  const body = source.getObjectByName('body');
  if (!body) throw new Error('K9 vest requires the authored body pivot');
  const inverse = body.matrixWorld.clone().invert(), parts = new Group();
  source.traverse(node => {
    if (!(node instanceof Mesh) || !clothing.test(node.name)) return;
    const geometry = node.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    parts.add(new Mesh(geometry, node.material));
  });
  if (!parts.children.length) throw new Error('K9 vest has no authored clothing');
  const size = new Box3().setFromObject(parts).getSize(new Vector3());
  const fit = width / size.z;
  parts.traverse(node => { if (node instanceof Mesh) node.geometry.scale(fit, fit, fit); });
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
