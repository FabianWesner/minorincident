import { Group, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/**
 * E32 §5.7 L10-S6: draws the manned rotary minigun (`wpn.minigun-mounted`) where `world.mountedGun` stands. The base stays put, the
 * `yawNode` node turns to the aim, the `barrels` node spins with the sim's barrel angle, and the `heatGlow` sleeves show while the gun
 * is hot or locked. A level that installs a mounted gun must not also place `wpn.minigun-mounted` as a static prop.
 */
export class MountedGunView extends Group {
  private readonly registry: AssetRegistry;
  private model: Object3D | null = null;
  private yawNode: Object3D | null = null;
  private barrels: Object3D | null = null;
  private glow: Object3D | null = null;
  private muzzleNode: Object3D | null = null;
  private loading: Promise<void> | null = null;
  private disposed = false;
  private readonly scratch = new Vector3();
  constructor(private readonly world: SimWorld, private readonly low: boolean, materials: Materials, renderer: WebGPURenderer) {
    super();
    this.registry = new AssetRegistry(() => undefined, { renderer, materials });
    this.visible = false;
  }
  /** Starts the model load once; resolves when the gun is drawable. */
  ready(): Promise<void> {
    return this.loading ??= this.registry.loadAsset('wpn.minigun-mounted', this.low ? 'low' : 'high').then(model => {
      if (this.disposed) return;
      this.model = model; this.add(model);
      this.yawNode = model.getObjectByName('pivot') ?? null; this.barrels = model.getObjectByName('barrels') ?? null;
      this.glow = model.getObjectByName('heatGlow') ?? null; this.muzzleNode = model.getObjectByName('muzzle') ?? null;
    });
  }
  /** Pose from the sim: call once per rendered frame. */
  update(): void {
    const gun = this.world.mountedGun;
    this.visible = !!gun && !!this.model;
    if (!gun || !this.model) return;
    const { placement } = gun;
    this.position.set(placement.x, placement.y, placement.z);
    // Layout convention: a positive placement yaw (degrees) turns the asset's +x front towards -z, like three's rotation.y.
    this.rotation.y = placement.yaw * Math.PI / 180;
    if (this.yawNode) this.yawNode.rotation.y = -Math.atan2(gun.aim.z, gun.aim.x) - this.rotation.y;
    if (this.barrels) this.barrels.rotation.x = gun.gun.angle;
    if (this.glow) this.glow.visible = gun.gun.heat >= .6 || gun.gun.locked;
  }
  /** Muzzle at the shot tick for an aim direction (the event precedes the render frame). */
  muzzle(direction: { x: number; z: number }): Vector3 | null {
    const gun = this.world.mountedGun;
    if (!gun || !this.model || !this.yawNode || !this.muzzleNode) return null;
    this.update();
    this.yawNode.rotation.y = -Math.atan2(direction.z, direction.x) - this.rotation.y;
    this.updateWorldMatrix(true, true);
    return this.muzzleNode.getWorldPosition(this.scratch);
  }
  dispose(): void { this.disposed = true; this.removeFromParent(); void this.registry.dispose(); }
}
