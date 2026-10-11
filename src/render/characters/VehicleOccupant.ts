import { Group, Mesh, Quaternion, Vector3, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { courierBones, driveHelpers, type CourierBones } from './CourierRig';
import { alignSkeleton } from './skin';
import { disposeCharacter, type CharacterRig } from './rig';
import { characterNodes } from '../../data/survivor';
import type { Materials } from '../Materials';
import { sampleClip } from './clips';
import { LimbIK } from './LimbIK';
import type { AssetRegistry } from '../../assets/registry';

/** A seated render copy; its hidden simulation actor continues to own boarding and exits. */
export class VehicleOccupant extends Group {
  private readonly hip: Object3D;
  private readonly bones?: CourierBones;
  private readonly rig: CharacterRig;
  private readonly arms: LimbIK[];
  private readonly point = new Vector3();
  private readonly pole = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly grip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  private readonly torso: Object3D;
  private readonly torsoRest = new Quaternion();
  readonly handGapM = [0, 0];
  private readonly hand = new Vector3();
  private readonly hipOffset = new Vector3();
  private constructor(readonly actorId: number, readonly asset: string, readonly model: Object3D, private readonly ownsModel = false) {
    super(); this.add(model);
    sampleClip(model, 'npc-sit', 0); this.bones = courierBones(model);
    this.rig = Object.fromEntries(characterNodes.map(name => [name, model.getObjectByName(name)!])) as CharacterRig;
    this.hip = model.getObjectByName('hip')!;
    this.torso = model.getObjectByName('torso')!; this.torsoRest.copy(this.torso.quaternion);
    this.arms = (['L', 'R'] as const).map(side => new LimbIK(model.getObjectByName(`arm${side}`)!, model.getObjectByName(`foreArm${side}`)!, model.getObjectByName(`hand${side}`)!));
    model.updateMatrixWorld(true);
    this.hipOffset.copy(this.hip.getWorldPosition(this.point)); model.worldToLocal(this.hipOffset);
    model.position.sub(this.hipOffset);
  }
  static async load(registry: AssetRegistry, actorId: number, asset: string, materials: Materials): Promise<VehicleOccupant> {
    if (asset.startsWith('char.courier-')) {
      const url = registry.definition(asset).glb.replace(/\.glb$/, '.skin.glb').replace(/^public\//, '/');
      const model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url)).scene;
      alignSkeleton(model);
      const material = materials.fromVertexColors(`vehicle:${asset}`); material.movingFigure.value = 1; material.userData.sharedPalette = true;
      const old = new Set<import('three').Material>();
      model.traverse(node => { if (node instanceof Mesh) { for (const m of Array.isArray(node.material) ? node.material : [node.material]) old.add(m); node.material = material; node.castShadow = node.receiveShadow = true; } });
      for (const m of old) m.dispose();
      return new VehicleOccupant(actorId, asset, model, true);
    }
    return new VehicleOccupant(actorId, asset, await registry.loadAsset(asset, 'lod0'));
  }
  dispose(): void { if (this.ownsModel) disposeCharacter(this.model as Group); this.removeFromParent(); }
  /** Hip at the seat node, both shoes forward in the footwell; drivers grip the authored wheel. */
  pose(seat: Object3D, wheel?: Vector3, fit = 1, driverLean = -.5): void {
    // Compact car cushions/roofs are authored for smaller seated figures than the standing hero.
    this.scale.setScalar(fit);
    seat.updateWorldMatrix(true, false);
    this.parent!.worldToLocal(this.position.copy(seat.getWorldPosition(this.point)));
    this.quaternion.copy(this.parent!.getWorldQuaternion(this.orientation).invert()).multiply(seat.getWorldQuaternion(new Quaternion()));
    if (wheel) this.position.x += Math.max(0, Math.min(.2, wheel.x - this.position.x - .35 * fit)); // stay within the cushion
    this.torso.quaternion.copy(this.torsoRest);
    this.torso.rotateZ(wheel ? driverLean : -.25);
    this.updateWorldMatrix(true, true);
    for (let i = 0; i < 2; i++) {
      if (wheel) { this.point.copy(wheel).add(new Vector3(-.04, .025, i === 0 ? -.12 : .12)); this.parent!.localToWorld(this.point); }
      else this.localToWorld(this.point.set(.2, .1, i === 0 ? -.11 : .11));
      this.pole.set(.15, -.8, i === 0 ? -.3 : .3).transformDirection(this.parent!.matrixWorld);
      this.orientation.copy(this.parent!.getWorldQuaternion(new Quaternion())).multiply(this.grip);
      this.arms[i].solve(this.point, this.pole, this.orientation);
      this.handGapM[i] = this.arms[i].end.getWorldPosition(this.hand).distanceTo(this.point);
    }
    if (this.bones) driveHelpers(this.rig, this.bones);
  }
}
