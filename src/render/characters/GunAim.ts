import { Euler, Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { LimbIK } from './LimbIK';

/** Stock/tube clearance at the courier's dominant shoulder (world metres). */
export const gunHoldOffset = (assetId: string): number => assetId === 'wpn.rocket-launcher' ? .32 : assetId === 'wpn.machine-gun' ? .14 : assetId === 'wpn.assault-rifle' ? .1 : assetId === 'wpn.pistol' ? 0 : .06;
/** Long barrels need a higher carry to clear the road throughout the stride. */
export const gunCarryElevation = (assetId: string): number => assetId === 'wpn.rocket-launcher' ? -.5 : ['wpn.machine-gun', 'wpn.hunting-rifle'].includes(assetId) ? -.65 : -.75;

/** Last upper-body layer: a nearly straight firing arm, independent of the gait.
 * +X is the asset barrel direction; crowd props use +Z instead. */
export class GunAim {
  private readonly arm: LimbIK;
  private readonly target = new Vector3();
  private readonly direction = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly barrel = new Vector3(1, 0, 0);
  private readonly torsoRotation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private readonly torsoAngles = new Euler(0,0,0,'YXZ');
  private readonly pole = new Vector3(0, -1, 0);
  constructor(private readonly upper: Object3D, middle: Object3D, end: Object3D, private readonly torso?: Object3D) {
    this.arm = new LimbIK(upper, middle, end);
  }
  apply(direction: { x: number; z: number }, barrelAxis = this.barrel, elevation = 0, reach = .995, turnTorso = true, lateral = 0): void {
    if (turnTorso && this.torso?.parent) {
      this.torso.updateWorldMatrix(true,true);
      this.torsoAngles.setFromQuaternion(this.torso.getWorldQuaternion(this.torsoRotation),'YXZ');
      this.torsoAngles.y = -Math.atan2(direction.z,direction.x);
      this.torsoRotation.setFromEuler(this.torsoAngles);
      this.torso.parent.getWorldQuaternion(this.parentRotation).invert().multiply(this.torsoRotation);
      this.torso.quaternion.copy(this.parentRotation); this.torso.updateWorldMatrix(false,true);
    }
    this.upper.updateWorldMatrix(true, true);
    this.direction.set(direction.x * Math.cos(elevation), Math.sin(elevation), direction.z * Math.cos(elevation)).normalize();
    const length = this.arm.middle.position.length() + this.arm.end.position.length();
    const scale = this.upper.getWorldScale(this.scale).y;
    // 99.5% reach leaves a small natural elbow bend (< 10 degrees), below the shoulder.
    this.upper.getWorldPosition(this.target).addScaledVector(this.direction, length * scale * reach);
    this.target.x -= direction.z * lateral; this.target.z += direction.x * lateral;
    this.rotation.setFromUnitVectors(barrelAxis, this.direction);
    this.arm.solve(this.target, this.pole, this.rotation);
  }
}

/** CPU rig mirror for the crowd's mutable pose row. Every child keeps its local
 * transform; the corrected matrices drive both GPU geometry and held props. */
export class CrowdGunAim {
  private readonly root = new Group();
  private readonly nodes: Object3D[];
  private readonly parents: number[];
  private readonly matrix = new Matrix4();
  private readonly parent = new Matrix4();
  private readonly aim: GunAim;
  private readonly forward = new Vector3(1, 0, 0);
  private readonly barrel = new Vector3(0, 0, 1);
  constructor(model: Object3D, private readonly parts: string[]) {
    this.nodes = parts.map(name => { const node = new Object3D(); node.name = name; return node; });
    this.parents = parts.map(name => {
      let parent = model.getObjectByName(name)?.parent;
      while (parent && !parts.includes(parent.name)) parent = parent.parent;
      return parent ? parts.indexOf(parent.name) : -1;
    });
    model.updateWorldMatrix(true, true);
    this.nodes.forEach((node, i) => {
      (this.nodes[this.parents[i]] ?? this.root).add(node);
      const source = model.getObjectByName(parts[i])!;
      this.matrix.copy(source.matrixWorld);
      if (this.parents[i] >= 0) this.matrix.premultiply(this.parent.copy(model.getObjectByName(parts[this.parents[i]])!.matrixWorld).invert());
      this.matrix.decompose(node.position, node.quaternion, node.scale);
    });
    this.aim = new GunAim(this.nodes[parts.indexOf('armR')], this.nodes[parts.indexOf('foreArmR')], this.nodes[parts.indexOf('handR')],this.nodes[parts.indexOf('torso')]);
  }
  apply(pose: Float32Array, direction: { x: number; z: number } = this.forward, elevation = 0, reach = .995): void {
    this.nodes.forEach((node, i) => {
      this.matrix.fromArray(pose, i * 16);
      if (this.parents[i] >= 0) this.matrix.premultiply(this.parent.fromArray(pose, this.parents[i] * 16).invert());
      this.matrix.decompose(node.position, node.quaternion, node.scale);
    });
    this.root.updateMatrixWorld(true);
    this.aim.apply(direction, this.barrel, elevation, reach);
    this.root.updateMatrixWorld(true);
    this.nodes.forEach((node, i) => {
      let ancestor: Object3D | null = node;
      while (ancestor && ancestor.name !== 'torso') ancestor = ancestor.parent;
      if (ancestor) node.matrixWorld.toArray(pose, i * 16);
    });
  }
}
