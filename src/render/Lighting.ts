import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon folio-2025 Ligthing.js / Fog.js (MIT).
import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector2, Vector3, Plane, Ray, type DepthTexture, type Node } from 'three/webgpu';
import { uniform, mix, vec2, viewportUV, Fn, texture, reference, float } from 'three/tsl';
import { timeOfDay, type TimeOfDay } from '../data/timeOfDay';
import type { View } from './View';
import { worldLook } from '../data/worldLook';
import { LookUniforms } from './LookUniforms';
import { LightField } from './LightField';

// r186's default PCF rotates five taps with per-pixel noise. A fixed weighted
// grid keeps the soft penumbra without stipple, including the WebGL2 fallback.
const stableSunShadow = Fn(({ depthTexture, shadowCoord, shadow, depthLayer }: {
  depthTexture: DepthTexture; shadowCoord: Node<'vec3'>; shadow: DirectionalLight['shadow']; depthLayer: Node<'float'>;
}) => {
  const step = reference('radius', 'float', shadow).div(reference('mapSize', 'vec2', shadow));
  let filtered: Node<'float'> = float(0);
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    let sample = texture(depthTexture, shadowCoord.xy.add(vec2(x, y).mul(step)));
    if (depthTexture.isArrayTexture) sample = sample.depth(depthLayer);
    const visibility = sample.compare(shadowCoord.z) as unknown as Node<'float'>;
    filtered = filtered.add(visibility.mul((x === 0 ? 2 : 1) * (y === 0 ? 2 : 1) / 16));
  }
  return filtered;
});

/** One sun, a hemisphere and shared stylized lighting uniforms. Shadows follow the visible ground region. */
export class Lighting {
  readonly sun = new DirectionalLight(0xffffff, 1);
  readonly hemisphere = new HemisphereLight(worldLook.skyAmbient, worldLook.groundAmbient, 0.5);
  readonly direction = uniform(new Vector3());
  readonly color = uniform(new Color());
  readonly intensity = uniform(1);
  readonly worldPaletteEnabled = uniform(0);
  readonly shadow = uniform(new Color());
  readonly skyAmbient = uniform(this.hemisphere.color);
  readonly groundAmbient = uniform(this.hemisphere.groundColor);
  readonly fogColor = uniform(new Color());
  readonly coreShadowEdgeHigh;
  readonly coreShadowEdgeLow;
  readonly fogColorA = uniform(new Color());
  readonly fogCenter = uniform(new Vector2(.5, .35));
  readonly fogRadialStart;
  readonly fogRadialEnd;
  readonly radialFog;
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ray = new Ray();
  private readonly corner = new Vector3();
  readonly fogNear = uniform(55);
  readonly fogFar = uniform(140);
  readonly bounce;
  readonly fogA = this.fogColorA;
  readonly fogB = this.fogColor;
  readonly fogGradient;
  preset: TimeOfDay = 'golden';
  /** E25 layer 2: practical-light pools around the focus (LightField). */
  readonly field = new LightField();
  /** Night readability (specs/06 §2): the player's feet (xyz) for the hero rim, and the preset rim weight. */
  readonly hero = uniform(new Vector3(0, -100, 0));
  readonly rim = uniform(0);
  readonly rimColor = uniform(new Color('#b9c6ff'));
  /** Survivor-only fill at night (preset `aura`), warm lantern white. */
  readonly heroFill = uniform(0);
  readonly heroFillColor = uniform(new Color('#ffe9cf'));
  /** Weight of the sun/moon shadow map on light-field pools (hero shadows at night). */
  readonly fieldShadow = uniform(0);
  /** The preset shadow colour at full brightness: the hue light-field pools keep inside hero shadows. */
  readonly shadowHue = uniform(new Color());
  /** Direction towards the shadow-casting light: the sun/moon, or the promoted hero lamp at night. */
  private readonly shadowDirection = new Vector3(0, 1, 0);
  private readonly heroTarget = new Vector3();
  private heroTime = -1;
  /** Name of the promoted hero light for diagnostics (null: the sun/moon casts). */
  heroLight: string | null = null;
  constructor(private readonly scene: Scene, readonly look = new LookUniforms()) {
    this.bounce = look.nodes.bounce;
    this.coreShadowEdgeHigh = look.nodes.coreLightEdge; this.coreShadowEdgeLow = look.nodes.coreShadowEdge;
    this.fogRadialStart = look.nodes.fogRatioA; this.fogRadialEnd = look.nodes.fogRatioB;
    this.radialFog = mix(this.fogColorA, this.fogColor, vec2(viewportUV.xy).sub(this.fogCenter).length().smoothstep(this.fogRadialStart, this.fogRadialEnd));
    this.fogGradient = this.radialFog;
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.08; this.sun.shadow.radius = 2;
    // LightShadow.filterNode is public at runtime but omitted from @types/three.
    (this.sun.shadow as typeof this.sun.shadow & { filterNode: typeof stableSunShadow }).filterNode = stableSunShadow;
    this.scene.add(this.sun, this.sun.target, this.hemisphere); this.set('golden');
  }
  setQuality(tier: QualityTier): void {
    this.field.setQuality(tier);
    const size = qualityBudgets[tier].shadowSize;
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(size, size); this.sun.shadow.needsUpdate = true;
  }
  set(name: TimeOfDay): void {
    if (!(name in timeOfDay)) throw new Error(`Unknown time-of-day preset: ${name}`);
    this.worldPaletteEnabled.value = Number(name === 'L1');
    this.preset = name; const p = timeOfDay[name];
    this.field.strength.value = p.practical ?? 0; this.rim.value = p.rim ?? 0; this.heroFill.value = (p.aura ?? 0) * 3.2;
    this.direction.value.setFromSphericalCoords(1, p.polar, p.azimuth);
    this.color.value.set(p.sun); this.intensity.value = p.intensity; this.shadow.value.set(p.shadow);
    this.sun.color.set(p.sun); this.sun.intensity = p.intensity;
    this.fogColorA.value.set(p.sky); this.fogColor.value.set(p.fog); this.scene.backgroundNode = this.radialFog; this.fogNear.value = p.fogNear; this.fogFar.value = p.fogFar;
    if (this.scene.background instanceof Color) this.scene.background.set(p.sky); else this.scene.background = new Color(p.sky);
    if (this.scene.fog instanceof Fog) { this.scene.fog.color.set(p.fog); this.scene.fog.near = p.fogNear; this.scene.fog.far = p.fogFar; }
    else this.scene.fog = new Fog(p.fog, p.fogNear, p.fogFar);
    this.applyLook();
  }
  /** Reapply authored presets plus explicit live overrides; gameplay never reads these values. */
  applyLook(): void {
    const p = timeOfDay[this.preset], v = this.look.values;
    this.direction.value.setFromSphericalCoords(1, (this.look.has('sunPolar') || this.preset === 'L1') ? v.sunPolar : p.polar, (this.look.has('sunAzimuth') || this.preset === 'L1') ? v.sunAzimuth : p.azimuth);
    this.color.value.set((this.look.has('sun') || this.preset === 'L1') ? v.sun : p.sun); this.sun.color.copy(this.color.value);
    this.intensity.value = (this.look.has('sunIntensity') || this.preset === 'L1') ? v.sunIntensity : p.intensity; this.sun.intensity = this.intensity.value;
    this.shadow.value.set((this.look.has('shadow') || this.preset === 'L1') ? v.shadow : p.shadow);
    const s = this.shadow.value; this.shadowHue.value.copy(s).multiplyScalar(1 / Math.max(s.r, s.g, s.b, 1e-3));
    this.skyAmbient.value.set(v.skyAmbient); this.groundAmbient.value.set(v.groundAmbient); this.hemisphere.intensity = v.hemisphereIntensity;
    this.fogColor.value.set((this.look.has('fog') || this.preset === 'L1') ? v.fog : p.fog);
    this.fogA.value.set(this.look.has('fog') && !this.look.has('fogA') ? v.fog : this.look.has('sky') && !this.look.has('fogA') ? v.sky : (this.look.has('fogA') || this.preset === 'L1') ? v.fogA : p.sky);
    this.fogB.value.set(this.look.has('fog') && !this.look.has('fogB') ? v.fog : (this.look.has('fogB') || this.preset === 'L1') ? v.fogB : p.fog);
    this.scene.background = new Color((this.look.has('sky') || this.preset === 'L1') ? v.sky : p.sky);
    this.fogCenter.value.set(v.fogCenterX, v.fogCenterY); this.scene.backgroundNode = this.radialFog;
    if (this.scene.fog instanceof Fog) this.scene.fog.color.copy(this.fogColor.value);
    this.sun.shadow.bias = v.shadowBias; this.sun.shadow.normalBias = v.shadowNormalBias; this.sun.shadow.radius = v.shadowRadius;
    this.sun.shadow.needsUpdate = true;
  }
  update(view: View): void {
    // Portrait framing pulls the camera back to retain the playable circle.
    // Fog must follow that offset so it still starts beyond the nearby action.
    const preset = timeOfDay[this.preset], p = { fogNear: (this.look.has('fogNear') || this.preset === 'L1') ? this.look.values.fogNear : preset.fogNear, fogFar: (this.look.has('fogFar') || this.preset === 'L1') ? this.look.values.fogFar : preset.fogFar };
    // Use the follow framing radius: authored cinematic positions must retain distance fog.
    const fogOffset = Math.max(0, view.radius * (view.driving ? 1.15 : 1) - 19);
    this.fogNear.value = p.fogNear + fogOffset; this.fogFar.value = p.fogFar + fogOffset;
    if (this.scene.fog instanceof Fog) { this.scene.fog.near = this.fogNear.value; this.scene.fog.far = this.fogFar.value; }
    // Bound the view's ground-plane corners, then enclose that area in the light's orthographic frustum.
    let visibleRadius = 0;
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      this.corner.set(x, y, .5).unproject(view.camera).sub(view.camera.position).normalize();
      this.ray.set(view.camera.position, this.corner);
      if (this.ray.intersectPlane(this.ground, this.corner)) visibleRadius = Math.max(visibleRadius, this.corner.distanceTo(view.focus));
    }
    const radius = Math.max(8, visibleRadius) * 1.1;
    this.sun.target.position.copy(view.focus);
    this.sun.position.copy(this.heroTime >= 0 ? this.shadowDirection : this.direction.value).multiplyScalar(radius * 2).add(view.focus);
    const camera = this.sun.shadow.camera;
    camera.left = camera.bottom = -radius; camera.right = camera.top = radius;
    camera.near = 0.1; camera.far = radius * 4; camera.updateProjectionMatrix();
  }
  /** Hero shadows within the one-shadow-map budget (specs/06 §4): at night the sun/moon shadow camera turns
   * towards the strongest `shadow: hero` light covering the survivor, and the light-field pools take that
   * shadow. Direction and weight crossfade over ~0.3 s, so promotion never pops. `time` is sim seconds. */
  setHeroLight(light: { x: number; y?: number; z: number } | null, focus: { x: number; y: number; z: number }, time: number): void {
    const seconds = this.heroTime < 0 ? 0 : Math.max(0, Math.min(.1, time - this.heroTime)); this.heroTime = time;
    const night = this.field.strength.value >= .5;
    const goal = light && night ? 1 : 0;
    if (light && night) this.heroTarget.set(light.x - focus.x, Math.max(1.5, (light.y ?? 3) - focus.y), light.z - focus.z).normalize();
    else this.heroTarget.copy(this.direction.value);
    const k = seconds > 0 ? 1 - Math.exp(-seconds / .1) : 1;
    if (this.shadowDirection.lengthSq() < .5 || seconds === 0) this.shadowDirection.copy(this.heroTarget);
    else this.shadowDirection.lerp(this.heroTarget, k).normalize();
    this.fieldShadow.value = seconds === 0 ? goal : this.fieldShadow.value + (goal - this.fieldShadow.value) * k;
  }
  /** Includes live fog ranges so viewport changes can be checked without shader inspection. */
  getState() {
    const p = timeOfDay[this.preset];
    return { shadowSize: this.sun.shadow.mapSize.x, preset: this.preset, sunDirection: this.direction.value.toArray(), sunColor: `#${this.color.value.getHexString()}`, sky: (this.look.has('sky') || this.preset === 'L1') ? this.look.values.sky : p.sky, fog: `#${this.fogColor.value.getHexString()}`, fogNear: this.fogNear.value, fogFar: this.fogFar.value, intensity: this.intensity.value, shadowColor: this.shadow.value.getHexString(), coreShadowEdges: [this.coreShadowEdgeHigh.value, this.coreShadowEdgeLow.value], shadowRadius: this.sun.shadow.radius, normalBias: this.sun.shadow.normalBias, shadowArea: this.sun.shadow.camera.right, fogColors: [`#${this.fogA.value.getHexString()}`, `#${this.fogB.value.getHexString()}`], rim: this.rim.value, fieldShadow: this.fieldShadow.value, shadowDirection: this.shadowDirection.toArray(), lightField: this.field.snapshot() };
  }
  dispose(): void { this.scene.remove(this.sun, this.sun.target, this.hemisphere); this.sun.dispose(); this.field.dispose(); this.scene.backgroundNode = null; }
}
