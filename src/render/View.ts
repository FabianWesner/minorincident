// Adapted from folio-2025 View.js by Bruno Simon (MIT), commit 41046b5.
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { cameraFraming, rocketZoomLimit } from '../data/cameraFraming';

/** Player zoom range as a fraction of the default radius: in until the hero is ~1/3.5 of the viewport height. */
// PO 2026-10-13: "End of L3, I can zoom out whihc I shouldn't" (scripted beats lock the framing).
// PO 2026-10-13 later: "let me generally zoom out a bit more (like +30%)" … "better +50%"
/** Driver camera: 1.4x the view area of the passenger/driving frame (area scales with radius squared). */
export const driveWideScale = 1.15 * Math.sqrt(1.4);
export const zoomLimits = [.5, 1.5] as const;
/** Body-centre height of the courier above the feet (spawn and locomotion keep the player at ground + .72). */
export const feetOffset = .72;
export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
/** Narrow-FOV follow camera. Presentation seconds are supplied by Game; never read by sim. */
export class View {
  readonly camera = new PerspectiveCamera(cameraFraming.fovDeg, 16 / 9, 0.1, 600);
  /** What the simulation may see of the camera (spawn director): the follow rig from tick-driven state only (focus, zoom,
   * driving, cinematic blend). Pull, shake and roll are presentation effects driven by render time (the L1 lab accident
   * pulls the camera on wall-clock seconds); letting them steer spawns made replays of the same inputs diverge. */
  readonly simCamera = new PerspectiveCamera(cameraFraming.fovDeg, 16 / 9, 0.1, 600);
  private readonly simTarget = new Vector3();
  /** CSS pixels for projected-size LOD selection, independent of render DPR. */
  viewportHeight = 900;
  readonly focus = new Vector3();
  readonly cameraTarget = new Vector3();
  readonly azimuth = Math.PI / 4;
  readonly polar = cameraFraming.polar;
  radius: number = cameraFraming.radiusM;
  private defaultRadius: number = cameraFraming.radiusM;
  private zoomRatio = 1;
  private targetZoom = 1;
  private maxZoom: number = zoomLimits[1];
  private zoomReturn = 0;
  /** Only the weapon held in the selected rack slot grants the longer rocket view. */
  setEquippedWeapon(id: string | undefined): void {
    const limit = id === 'weapon.rocket-launcher' ? rocketZoomLimit : zoomLimits[1];
    if (limit === this.maxZoom) return;
    this.maxZoom = limit;
    this.targetZoom = Math.min(this.targetZoom, limit);
    this.zoomReturn = this.zoomRatio > limit ? .4 : 0;
  }
  /** Wheel down zooms out; pinch spread zooms in. Default framing is unchanged. */
  zoom(delta: number, instant = false): void {
    if (Number.isFinite(delta) && !this.blendTarget && !this.scripted) this.targetZoom = Math.max(zoomLimits[0], Math.min(this.maxZoom, this.targetZoom * Math.exp(delta)));
    if (instant) this.zoomRatio = this.targetZoom;
  }
  inspectionPose: CameraPose | null = null;
  inspectionGameLod = false;
  private readonly inspectionLodCamera = new PerspectiveCamera();
  /** A virtual camera at the standard game radius; culling still uses the actual camera. */
  get lodCamera(): PerspectiveCamera {
    if (!this.inspectionPose || !this.inspectionGameLod) return this.camera;
    const camera = this.inspectionLodCamera;
    camera.copy(this.camera); camera.position.copy(this.cameraTarget).add(new Vector3().setFromSphericalCoords(cameraFraming.radiusM, this.polar, this.azimuth));
    camera.lookAt(this.cameraTarget); camera.updateMatrixWorld(); return camera;
  }
  encounterScale = 1;
  /** The player's eased wheel/pinch zoom ratio (0.5 closest .. 1.5 widest, 2 while holding rockets). */
  get playerZoom(): number { return this.zoomRatio; }
  /** Finale widening multiplies player zoom without locking wheel/pinch or follow input. */
  epilogueScale = 1;
  driving = false;
  /** The player is the driver (not a passenger): the follow camera widens a further 1.4x in view area. */
  driverWide = false;
  /** Eased follow-radius multiplier: 1 on foot, 1.15 as a passenger, 1.15 x sqrt(1.4) driving. Eased (~0.7 s), never snapped. */
  driveScale = 1;
  cameraShake = true;
  spot: string | null = null;
  private readonly target = new Vector3();
  private readonly offset = new Vector3();
  private readonly cinematicCamera = new PerspectiveCamera();
  /** Story pull (accident): shifts the framing toward a world point by weight 0..1 without moving the player. */
  private pullX = 0;
  private pullZ = 0;
  private pullWeight = 0;
  private pullY?: number;
  pull(x: number, z: number, weight: number, y?: number): void { this.pullY = y; this.pullX = x; this.pullZ = z; this.pullWeight = Math.max(0, Math.min(1, weight)); }
  private blend = 0;
  private blendTarget = 0;
  private shakeStrength = 0;
  private shakeTime = 0;
  /** E27 roll kick (Bruno View.roll): damped spring around the view axis, radians. */
  private rollAngle = 0;
  private rollSpeed = 0;
  /** Camera poses of the last two sim ticks; `present` renders between them with the clock alpha. */
  private readonly previousPosition = new Vector3();
  private readonly previousQuaternion = new Quaternion();
  private readonly tickPosition = new Vector3();
  private readonly tickTarget = new Vector3();
  private readonly tickQuaternion = new Quaternion();
  /** Close isometric combat framing; portrait retains at least seven metres of ground width. */
  resize(width: number, height: number): void {
    this.viewportHeight = height;
    this.camera.aspect = width / height;
    this.defaultRadius = width >= height ? cameraFraming.radiusM : Math.max(cameraFraming.radiusM, cameraFraming.portraitWidthM / (2 * Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect));
    this.radius = this.defaultRadius * this.zoomRatio * this.encounterScale * this.epilogueScale;
    this.camera.updateProjectionMatrix(); this.simCamera.aspect = this.camera.aspect; this.simCamera.updateProjectionMatrix(); this.update({ x: this.focus.x, z: this.focus.z, y: this.focus.y + feetOffset }, 0);
  }
  reset(player: { x: number; z: number; y?: number }, preserveZoom = false): void {
    this.maxZoom = zoomLimits[1]; this.zoomReturn = 0;
    this.encounterScale = this.epilogueScale = 1;
    this.zoomRatio = this.targetZoom = Math.max(zoomLimits[0], Math.min(zoomLimits[1], preserveZoom ? this.targetZoom : 1));
    this.radius = this.defaultRadius * this.zoomRatio;
    this.driving = false; this.driverWide = false; this.driveScale = 1; this.focus.set(player.x, Math.max(0, (player.y ?? feetOffset) - feetOffset), player.z); this.spot = null; this.blend = this.blendTarget = 0; this.shakeStrength = this.shakeTime = 0; this.rollAngle = this.rollSpeed = 0; this.pullWeight = 0;
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
    this.update({ x: this.focus.x, z: this.focus.z, y: this.focus.y + feetOffset }, 0);
  }
  follow(): void { this.spot = null; this.blendTarget = 0; }
  /** Max displacement 0.4 m; decays over presentation time. Disabled setting clears active kicks. */
  shake(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity < 0) throw new RangeError('Shake intensity must be finite and nonnegative');
    if (this.cameraShake) this.shakeStrength = Math.min(0.4, this.shakeStrength + intensity * 0.4);
  }
  /** Blast roll kick; signed strength ~0..1.4 maps to at most ~3° and settles within a second. Off with camera shake off. */
  roll(strength: number): void {
    if (!Number.isFinite(strength)) throw new RangeError('Roll strength must be finite');
    if (this.cameraShake) this.rollSpeed += Math.max(-1.5, Math.min(1.5, strength)) * .55;
  }
  /** Guidance stays hidden through story framing and its blend back to play. */
  get storyShot(): boolean { return this.blendTarget > 0 || this.blend > 0 || this.scripted || this.epilogueScale > 1; }
  /** Scripted pull-backs temporarily neutralize player zoom and lock wheel/pinch. */
  private get scripted(): boolean { return this.encounterScale > 1.02 || this.pullWeight > 0 && this.epilogueScale === 1; }
  private scriptedAdjusted(zoom: number): number { return this.scripted ? 1 : zoom; }
  private readonly safeProbe = new Vector3();
  private pullAt(weight: number, out: Vector3): Vector3 {
    return out.set(this.focus.x + (this.pullX - this.focus.x) * weight, this.focus.y + ((this.pullY ?? this.focus.y) - this.focus.y) * weight, this.focus.z + (this.pullZ - this.focus.z) * weight);
  }
  /** The player always stays inside the central safe area (|NDC| <= .55, clear of the HUD panels): a story pull is capped to the largest weight that keeps them there. */
  private safePullWeight(weight: number): number {
    const inside = (w: number): boolean => {
      this.pullAt(w, this.safeProbe); this.camera.position.copy(this.safeProbe).add(this.offset); this.camera.lookAt(this.safeProbe);
      this.camera.updateMatrixWorld(); this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
      this.safeProbe.set(this.focus.x, this.focus.y + 1, this.focus.z).project(this.camera);
      return Math.abs(this.safeProbe.x) <= .55 && Math.abs(this.safeProbe.y) <= .55;
    };
    if (inside(weight)) return weight;
    let lo = 0, hi = weight; for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (inside(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  private snapped = false;
  /** True once after a teleport snap: the next render must not reuse a scene pass drawn earlier in this browser frame. */
  consumeSnap(): boolean { const snapped = this.snapped; this.snapped = false; return snapped; }
  /** Advances the rig by `seconds` (one fixed sim tick in play) and leaves the camera at the new tick pose.
   * `seconds === 0` re-poses without motion (reset, resize, presets) and snaps the interpolation history. */
  update(player: { x: number; z: number; y?: number }, seconds: number): void {
    // Mission/checkpoint teleports must be framed before their first presented frame.
    if (!this.blendTarget && !this.spot && Math.hypot(player.x - this.focus.x, player.z - this.focus.z) > 20) {
      this.focus.set(player.x, Math.max(0, (player.y ?? feetOffset) - feetOffset), player.z);
      seconds = 0; this.snapped = true;
    }
    this.previousPosition.copy(this.tickPosition); this.previousQuaternion.copy(this.tickQuaternion);
    this.zoomRatio += (this.targetZoom - this.zoomRatio) * (1 - Math.exp(-12 * seconds));
    if (this.zoomReturn > 0) {
      this.zoomReturn = Math.max(0, this.zoomReturn - seconds);
      if (this.zoomReturn < 1e-8) { this.zoomReturn = 0; this.zoomRatio = Math.min(this.zoomRatio, this.maxZoom); }
    }
    const driveTarget = this.driving ? (this.driverWide ? driveWideScale : 1.15) : 1;
    this.driveScale = seconds > 0 ? driveTarget + (this.driveScale - driveTarget) * Math.exp(-5 * seconds) : this.driveScale;
    if (Math.abs(this.driveScale - driveTarget) < 1e-4) this.driveScale = driveTarget;
    this.radius = this.defaultRadius * this.scriptedAdjusted(this.zoomRatio) * this.encounterScale * this.epilogueScale;
    this.focus.x += (player.x - this.focus.x) * (1 - Math.exp(-10 * seconds));
    this.focus.z += (player.z - this.focus.z) * (1 - Math.exp(-10 * seconds));
    // Elevated decks/ramps: follow the feet height (transform.y is the body centre, .72 m above the feet), damped so stairs do not jitter.
    this.focus.y += (Math.max(0, (player.y ?? feetOffset) - feetOffset) - this.focus.y) * (1 - Math.exp(-6 * seconds));
    this.offset.setFromSphericalCoords(this.radius * this.driveScale, this.polar, this.azimuth);
    // Facades are revealed by the shared see-through/silhouette pass. Preserve
    // the player's distance and polar angle, including when the lens is inside
    // a building: contracting and raising it turned narrow streets top-down.
    const weight = this.pullWeight > 0 ? this.safePullWeight(this.pullWeight) : 0;
    const pulled = weight > 0 ? this.cameraTarget.set(this.focus.x + (this.pullX - this.focus.x) * weight, this.focus.y + ((this.pullY ?? this.focus.y) - this.focus.y) * weight, this.focus.z + (this.pullZ - this.focus.z) * weight) : this.cameraTarget.copy(this.focus);
    this.camera.position.copy(pulled).add(this.offset); this.camera.lookAt(pulled);
    this.blend += Math.sign(this.blendTarget - this.blend) * Math.min(Math.abs(this.blendTarget - this.blend), seconds);
    if (this.blend > 0) {
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      this.cameraTarget.lerp(this.target, t);
      this.camera.position.lerp(this.cinematicCamera.position, t); this.camera.quaternion.slerp(this.cinematicCamera.quaternion, t);
    }
    // Sim pose: the same rig without pull (and, below, without shake and roll).
    const sim = this.simCamera;
    sim.position.copy(this.focus).add(this.offset); sim.lookAt(this.focus); this.simTarget.copy(this.focus);
    if (this.blend > 0) { const t = this.blend * this.blend * (3 - 2 * this.blend); this.simTarget.lerp(this.target, t); sim.position.lerp(this.cinematicCamera.position, t); sim.quaternion.slerp(this.cinematicCamera.quaternion, t); }
    sim.updateMatrixWorld();
    if (!this.cameraShake) this.shakeStrength = 0;
    this.shakeTime += seconds;
    this.shakeStrength *= Math.exp(-8 * seconds);
    this.offset.set(Math.sin(this.shakeTime * 67), Math.sin(this.shakeTime * 89), 0).multiplyScalar(this.shakeStrength / Math.SQRT2);
    this.camera.position.add(this.offset);
    if (!this.cameraShake) this.rollAngle = this.rollSpeed = 0;
    this.rollSpeed = (this.rollSpeed - this.rollAngle * 90 * seconds) * Math.exp(-7 * seconds); this.rollAngle += this.rollSpeed * seconds;
    if (this.rollAngle) this.camera.rotateZ(this.rollAngle);
    this.camera.updateMatrixWorld();
    this.tickTarget.copy(this.cameraTarget);
    this.tickPosition.copy(this.camera.position); this.tickQuaternion.copy(this.camera.quaternion);
    if (seconds === 0) { this.previousPosition.copy(this.tickPosition); this.previousQuaternion.copy(this.tickQuaternion); }
  }
  /** Render pose between the last two tick poses (alpha 0..1), matching the interpolated characters;
   * a tick-rate camera stair-steps on displays faster than 60 Hz or with uneven frame pacing. */
  present(alpha: number, gameCamera = false): void {
    if (this.inspectionPose && !gameCamera) {
      this.camera.position.fromArray(this.inspectionPose.position); this.cameraTarget.fromArray(this.inspectionPose.target);
      this.camera.lookAt(this.cameraTarget); this.camera.updateMatrixWorld(); return;
    }
    this.cameraTarget.copy(this.tickTarget);
    const t = Math.max(0, Math.min(1, alpha));
    this.camera.position.lerpVectors(this.previousPosition, this.tickPosition, t);
    this.camera.quaternion.slerpQuaternions(this.previousQuaternion, this.tickQuaternion, t);
    this.camera.updateMatrixWorld();
  }
  getState() {
    return { zoom: this.zoomRatio, targetZoom: this.targetZoom, zoomLimits: [zoomLimits[0], this.maxZoom], fov: this.camera.fov, azimuth: this.azimuth, polar: this.polar, radius: this.radius * this.driveScale, focus: this.focus.toArray(), target: this.cameraTarget.toArray(), position: this.camera.position.toArray(), spot: this.spot };
  }
}
