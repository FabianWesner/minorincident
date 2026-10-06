import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from folio-2025 Ligthing.js / Fog.js by Bruno Simon (MIT), commit 41046b5.
import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { timeOfDay, type TimeOfDay } from '../data/timeOfDay';
import type { View } from './View';
import { worldLook } from '../data/worldLook';

/** One sun, a hemisphere and shared stylized lighting uniforms. Shadows follow the visible ground region. */
export class Lighting {
  readonly sun = new DirectionalLight(0xffffff, 1);
  readonly hemisphere = new HemisphereLight(worldLook.skyAmbient, worldLook.groundAmbient, 0.5);
  readonly direction = uniform(new Vector3());
  readonly color = uniform(new Color());
  readonly intensity = uniform(1);
  readonly shadow = uniform(new Color());
  readonly skyAmbient = uniform(this.hemisphere.color);
  readonly groundAmbient = uniform(this.hemisphere.groundColor);
  readonly fogColor = uniform(new Color());
  readonly fogNear = uniform(55);
  readonly fogFar = uniform(140);
  readonly bounce = uniform(new Color(worldLook.bounce));
  preset: TimeOfDay = 'golden';
  constructor(private readonly scene: Scene) {
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target, this.hemisphere); this.set('golden');
  }
  setQuality(tier: QualityTier): void {
    const size = qualityBudgets[tier].shadowSize;
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(size, size); this.sun.shadow.needsUpdate = true;
  }
  set(name: TimeOfDay): void {
    if (!(name in timeOfDay)) throw new Error(`Unknown time-of-day preset: ${name}`);
    this.preset = name; const p = timeOfDay[name];
    this.direction.value.setFromSphericalCoords(1, p.polar, p.azimuth);
    this.color.value.set(p.sun); this.intensity.value = p.intensity; this.shadow.value.set(p.shadow);
    this.sun.color.set(p.sun); this.sun.intensity = p.intensity;
    this.fogColor.value.set(p.fog); this.fogNear.value = p.fogNear; this.fogFar.value = p.fogFar;
    if (this.scene.background instanceof Color) this.scene.background.set(p.sky); else this.scene.background = new Color(p.sky);
    if (this.scene.fog instanceof Fog) { this.scene.fog.color.set(p.fog); this.scene.fog.near = p.fogNear; this.scene.fog.far = p.fogFar; }
    else this.scene.fog = new Fog(p.fog, p.fogNear, p.fogFar);
  }
  update(view: View): void {
    // Portrait framing pulls the camera back to retain the playable circle.
    // Fog must follow that offset so it still starts beyond the nearby action.
    const p = timeOfDay[this.preset];
    // Use the follow framing radius: authored cinematic positions must retain distance fog.
    const fogOffset = Math.max(0, view.radius * (view.driving ? 1.15 : 1) - 19);
    this.fogNear.value = p.fogNear + fogOffset; this.fogFar.value = p.fogFar + fogOffset;
    if (this.scene.fog instanceof Fog) { this.scene.fog.near = this.fogNear.value; this.scene.fog.far = this.fogFar.value; }
    // Bound the view's ground-plane corners, then enclose that area in the light's orthographic frustum.
    const tanV = Math.tan(view.camera.fov * Math.PI / 360);
    const radius = Math.max(16, view.radius * tanV * Math.max(view.camera.aspect, 1 / Math.cos(view.polar)) * 1.5);
    this.sun.target.position.copy(view.focus);
    this.sun.position.copy(this.direction.value).multiplyScalar(radius * 2).add(view.focus);
    const camera = this.sun.shadow.camera;
    camera.left = camera.bottom = -radius; camera.right = camera.top = radius;
    camera.near = 0.1; camera.far = radius * 4; camera.updateProjectionMatrix();
  }
  /** Includes live fog ranges so viewport changes can be checked without shader inspection. */
  getState() {
    const p = timeOfDay[this.preset];
    return { shadowSize: this.sun.shadow.mapSize.x, preset: this.preset, sunDirection: this.direction.value.toArray(), sunColor: p.sun, sky: p.sky, fog: p.fog, fogNear: this.fogNear.value, fogFar: this.fogFar.value, intensity: p.intensity };
  }
  dispose(): void { this.scene.remove(this.sun, this.sun.target, this.hemisphere); this.sun.dispose(); }
}
