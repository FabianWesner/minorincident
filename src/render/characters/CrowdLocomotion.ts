import { Group, Matrix4, Object3D, Vector3 } from 'three';
import type { CrowdClip } from '../../assets/crowd';
import { GroundContacts } from './GroundContacts';
import type { CharacterRig } from './rig';
import { cadenceStride, gaitShape } from './clips';
import { PawContacts } from './PawContacts';

/** One small off-scene skeleton per batch; figures retain only their two contact
 * targets. The scene still contains instanced meshes, never per-person actors. */
export class CrowdLocomotion {
  private readonly frame = new Group();
  private readonly nodes: Object3D[];
  private readonly parents: number[];
  private readonly restParents: Matrix4[];
  private readonly world: Matrix4[];
  private readonly inverse = new Matrix4();
  private readonly scale = new Vector3();
  private readonly rig: CharacterRig;
  private readonly contacts = new Map<number, GroundContacts>();
  private readonly paws = new Map<number, PawContacts>();
  private readonly animal: boolean;
  private readonly rest: { position: Vector3; quaternion: import('three').Quaternion; scale: Vector3 }[];
  readonly reach: number;
  constructor(private readonly model: Object3D, private readonly clip: CrowdClip) {
    this.animal = !!model.getObjectByName('legFL');
    model.updateMatrixWorld(true);
    const originals = clip.parts.map(name => model.getObjectByName(name)!);
    this.nodes = originals.map(node => { const copy = new Object3D(); copy.name = node.name; return copy; });
    this.parents = originals.map(node => originals.indexOf(node.parent!));
    this.restParents = originals.map(node => node.parent?.matrixWorld.clone() ?? new Matrix4());
    this.world = originals.map(node => node.matrixWorld.clone());
    this.rest = originals.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i]; (parent < 0 ? this.frame : this.nodes[parent]).add(node);
      if (parent < 0) this.world[i].decompose(node.position, node.quaternion, node.scale);
      else { node.position.copy(this.rest[i].position); node.quaternion.copy(this.rest[i].quaternion); node.scale.copy(this.rest[i].scale); }
    });
    this.rig = Object.fromEntries(this.nodes.map(node => [node.name, node])) as CharacterRig;
    // The instance frame supplies heading and world scale; internal GLB scale remains on the skeleton.
    this.rig.root = this.frame;
    this.frame.updateMatrixWorld(true);
    this.reach = this.rig.legL && this.rig.shinL && this.rig.footL
      ? this.rig.legL.getWorldPosition(new Vector3()).distanceTo(this.rig.shinL.getWorldPosition(new Vector3())) + this.rig.shinL.getWorldPosition(new Vector3()).distanceTo(this.rig.footL.getWorldPosition(new Vector3())) : 0;
  }
  stance(name: string, stride: number, rootScale = 1): number { return Math.min(gaitShape[name]?.stance ?? .5, this.reach * rootScale * .75 / Math.max(.001, stride)); }
  correct(id: number, pose: Float32Array, instance: Matrix4, phase: number, name: string, scale: number, speed: number): void {
    if (!this.animal && (!this.reach || !gaitShape[name])) return;
    let contacts = this.contacts.get(id);
    if (!contacts && !this.animal) {
      // Contact geometry is measured from rest, never from another figure's pose.
      this.frame.matrixAutoUpdate = true; this.frame.position.set(0, 0, 0); this.frame.quaternion.identity(); this.frame.scale.setScalar(1);
      this.nodes.forEach((node, i) => {
        node.position.copy(this.rest[i].position); node.quaternion.copy(this.rest[i].quaternion); node.scale.copy(this.rest[i].scale);
        if (this.parents[i] < 0) { node.updateMatrix(); this.inverse.copy(this.restParents[i]).multiply(node.matrix).decompose(node.position, node.quaternion, node.scale); }
      });
      contacts = new GroundContacts(this.rig); this.contacts.set(id, contacts);
    }
    this.nodes.forEach((_, i) => this.world[i].fromArray(pose, i * 16));
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i];
      if (parent < 0) this.inverse.identity(); else this.inverse.copy(this.world[parent]).invert();
      this.inverse.multiply(this.world[i]).decompose(node.position, node.quaternion, node.scale);
    });
    this.frame.matrixAutoUpdate = false; this.frame.matrix.copy(instance); this.frame.updateMatrixWorld(true);
    const stride = cadenceStride(name, scale, speed), run = /run|sprint|flee/.test(name) ? 1 : 0;
    if (this.animal) {
      let paws = this.paws.get(id);
      if (!paws) { paws = new PawContacts(this.frame, this.model); this.paws.set(id, paws); }
      paws.update(phase, stride, 'corgi-trot');
    } else contacts!.update(phase, stride, run, 1, this.stance(name, stride, this.frame.getWorldScale(this.scale).y));
    this.inverse.copy(instance).invert();
    this.nodes.forEach((node, i) => this.world[i].multiplyMatrices(this.inverse, node.matrixWorld).toArray(pose, i * 16));
  }
  reset(id: number): void { this.contacts.get(id)?.reset(); this.paws.get(id)?.reset(); }
}
