// Adapted from folio-2025 View.js by Bruno Simon (MIT), commit 41046b5.
import { PerspectiveCamera, Vector3 } from 'three';

export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
/** Narrow-FOV follow camera. Presentation seconds are supplied by Game; never read by sim. */
export class View {
  readonly camera = new PerspectiveCamera(25, 16 / 9, 0.1, 600);
  readonly focus = new Vector3();
  readonly cameraTarget = new Vector3();
  readonly azimuth = Math.PI / 4;
  readonly polar = Math.PI * 0.30;
  radius = 19;
  driving = false;
  cameraShake = true;
  spot: string | null = null;
  private readonly target = new Vector3();
  private readonly offset = new Vector3();
  private readonly cinematicCamera = new PerspectiveCamera();
  private blend = 0;
  private blendTarget = 0;
  private shakeStrength = 0;
  private shakeTime = 0;
  /** Close isometric combat framing; portrait retains at least nine metres of ground width. */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.radius = width >= height ? 19 : Math.max(19 * height / width, 9 / (2 * Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect));
    this.camera.updateProjectionMatrix(); this.update({ x: this.focus.x, z: this.focus.z }, 0);
  }
  reset(player: { x: number; z: number }): void {
    this.driving = false; this.focus.set(player.x, 0, player.z); this.spot = null; this.blend = this.blendTarget = 0; this.shakeStrength = this.shakeTime = 0;
    this.update(player, 0);
  }
  /** Named deterministic photo pose (instant); cinematic poses can blend over 1 s. */
  preset(name: string, pose: CameraPose): void {
    this.spot = name; this.cinematic(pose, true);
  }
  cinematic(pose: CameraPose, instant = false): void {
    this.cinematicCamera.position.fromArray(pose.position); this.target.fromArray(pose.target);
    this.cinematicCamera.lookAt(this.target); this.blendTarget = 1;
    if (instant) this.blend = 1;
    this.update({ x: this.focus.x, z: this.focus.z }, 0);
  }
  follow(): void { this.spot = null; this.blendTarget = 0; }
  /** Max displacement 0.4 m; decays over presentation time. Disabled setting clears active kicks. */
  shake(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity < 0) throw new RangeError('Shake intensity must be finite and nonnegative');
    if (this.cameraShake) this.shakeStrength = Math.min(0.4, this.shakeStrength + intensity * 0.4);
  }
  update(player: { x: number; z: number }, seconds: number): void {
    this.focus.x += (player.x - this.focus.x) * (1 - Math.exp(-10 * seconds));
    this.focus.z += (player.z - this.focus.z) * (1 - Math.exp(-10 * seconds));
    this.offset.setFromSphericalCoords(this.radius * (this.driving ? 1.15 : 1), this.polar, this.azimuth);
    this.cameraTarget.copy(this.focus);
    this.camera.position.copy(this.focus).add(this.offset); this.camera.lookAt(this.focus);
    this.blend += Math.sign(this.blendTarget - this.blend) * Math.min(Math.abs(this.blendTarget - this.blend), seconds);
    if (this.blend > 0) {
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      this.cameraTarget.lerp(this.target, t);
      this.camera.position.lerp(this.cinematicCamera.position, t); this.camera.quaternion.slerp(this.cinematicCamera.quaternion, t);
    }
    if (!this.cameraShake) this.shakeStrength = 0;
    this.shakeTime += seconds;
    this.shakeStrength *= Math.exp(-8 * seconds);
    this.offset.set(Math.sin(this.shakeTime * 67), Math.sin(this.shakeTime * 89), 0).multiplyScalar(this.shakeStrength / Math.SQRT2);
    this.camera.position.add(this.offset); this.camera.updateMatrixWorld();
  }
  getState() {
    return { fov: this.camera.fov, azimuth: this.azimuth, polar: this.polar, radius: this.radius * (this.driving ? 1.15 : 1), focus: this.focus.toArray(), target: this.cameraTarget.toArray(), position: this.camera.position.toArray(), spot: this.spot };
  }
}
