// Light-field pass adapted from Bruno Simon folio-2025 Tracks.js (MIT): a moving top-down orthographic
// render target around the focus that world materials sample by world XZ.
import { AdditiveBlending, Color, HalfFloatType, InstancedMesh, LinearFilter, Matrix4, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Quaternion, RenderTarget, RendererUtils, Scene, Vector3, type WebGPURenderer, type Node } from 'three/webgpu';
import { positionWorld, texture, uniform, uv, vec2, vec3 } from 'three/tsl';
import { lightPalette, type LightAnchor, type LightToken } from '../data/lights';

/** World-space light footprint. `aim` is the horizontal pool offset; `stretch` elongates it along the aim (spots). */
export interface FieldLight {
  x: number; z: number;
  /** Linear RGB already multiplied by the footprint strength. */
  r: number; g: number; b: number;
  radius: number;
  aimX: number; aimZ: number; stretch: number;
  flicker: 0 | 1 | 2;
  /** Rotating/strobing light bars: on half of a 0.5 s period, phase-shifted by `seed`. */
  strobe: boolean;
  seed: number;
  /** Gameplay power/broken state; the renderer only reads it. */
  on: boolean;
}
export interface TransientLight { remove(): void }
/** Light field strength per normalized §6 intensity unit (intensity 10 → 3 HDR at the pool centre). */
export const fieldGain = .3;
const tierSettings = { high: { resolution: 1024, size: 80, capacity: 512 }, low: { resolution: 512, size: 60, capacity: 256 } } as const;
const color = new Color();
const linear = (token: LightToken | string): Color => color.set(token in lightPalette ? lightPalette[token as LightToken] : token);

/** The survivor's small night aura (specs/06 §2 readability rule), scaled by the preset's `aura`. */
export const auraLight = (x: number, z: number, aura: number): FieldLight => footprint({ type: 'point', color: 'light_led_white', intensity: aura * 2, range: 2.6, flicker: 'none', position: [x, 1, z], direction: [0, -1, 0] });
/** Convert an authored anchor (already in world space) to its ground footprint. */
export function footprint(anchor: Pick<LightAnchor, 'type' | 'color' | 'intensity' | 'range' | 'angle' | 'flicker' | 'strobe'> & { position: [number, number, number]; direction: [number, number, number] }, ground = 0, seed = 0): FieldLight {
  const [x, y, z] = anchor.position, [dx, dy, dz] = anchor.direction, height = Math.max(.3, y - ground);
  const horizontal = Math.hypot(dx, dz);
  let aimX = 0, aimZ = 0, radius = Math.min(anchor.range, 2 + height * 1.6), stretch = 1;
  if (anchor.type === 'spot') {
    const half = (anchor.angle ?? 45) * Math.PI / 360, down = Math.max(.05, -dy / (Math.hypot(dx, dy, dz) || 1));
    // Distance along the axis to the ground, capped by the range; nearly horizontal spots (headlights) throw ahead.
    const t = Math.min(anchor.range, height / down) * (down < .2 ? .55 : 1), reach = horizontal > 1e-3 ? t * horizontal / Math.hypot(dx, dy, dz) : 0;
    radius = Math.max(.8, Math.min(anchor.range * .6, t * Math.tan(half) * 1.2));
    stretch = Math.min(3, 1 / Math.max(.35, down));
    if (horizontal > 1e-3) { aimX = dx / horizontal * reach; aimZ = dz / horizontal * reach; }
  } else if (horizontal > .3) {
    // Wall-mounted neon/windows face outward: their spill sits in front of the facade.
    aimX = dx / horizontal * radius * .45; aimZ = dz / horizontal * radius * .45;
  }
  const c = linear(anchor.color), strength = anchor.intensity * fieldGain * (anchor.type === 'window' ? .7 : 1);
  return { x, z, r: c.r * strength, g: c.g * strength, b: c.b * strength, radius, aimX, aimZ, stretch, flicker: anchor.flicker === 'fire' || anchor.type === 'fire' ? 1 : anchor.flicker === 'damaged' || anchor.flicker === 'fluorescent' ? 2 : 0, strobe: !!anchor.strobe || anchor.type === 'beacon', seed, on: true };
}

/** Layer 2 of the lighting concept (specs/06 §3): one additive instanced draw into a small HDR target.
 * Hundreds of pools cost one pass; `PaletteMaterial` samples `sample()` for ground, walls and figures. */
export class LightField {
  readonly target: RenderTarget;
  readonly center = uniform(vec2(0, 0));
  readonly extent = uniform(80);
  /** Time-of-day practical-light weight; 0 skips the pass and the material term. */
  readonly strength = uniform(0);
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-40, 40, 40, -40, .1, 200);
  private readonly mesh: InstancedMesh;
  private statics: FieldLight[] = [];
  private readonly transients: { light: FieldLight; born: number; ttl: number; intensity: number }[] = [];
  private readonly dynamics: FieldLight[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly order: number[] = [];
  private time = 0;
  private tier: 'high' | 'low' = 'high';
  private drawn = 0;
  private candidates = 0;
  private rendered = false;
  private readonly rendererState = {} as Parameters<typeof RendererUtils.resetRendererState>[1];
  /** CPU ms of the last pass (instance fill + submission), for perf(). */
  ms = 0;
  constructor() {
    const settings = tierSettings.high;
    this.target = new RenderTarget(settings.resolution, settings.resolution, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    this.target.texture.name = 'light-field';
    const geometry = new PlaneGeometry(1, 1); geometry.rotateX(-Math.PI / 2);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending });
    material.name = 'keep_lightField';
    // Soft quadratic pool; the instance colour carries hue x intensity (three multiplies it into the diffuse colour).
    const d = uv().sub(.5).mul(2).length();
    material.colorNode = vec3(d.mul(d).oneMinus().clamp(0, 1).pow(2));
    this.mesh = new InstancedMesh(geometry, material, settings.capacity);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, color.setRGB(0, 0, 0));
    this.scene.add(this.mesh);
    this.camera.position.set(0, 100, 0); this.camera.lookAt(0, 0, 0);
  }
  /** World-space HDR radiance at the shaded fragment: pools fade at the field edge and with height above the ground. */
  sample(): Node<'vec3'> {
    // Three normalizes render-target sampling to the GL convention on both backends (TextureNode flipY):
    // with the top-down camera's image up = world -Z, texture v grows with world +Z.
    const local = positionWorld.xz.sub(this.center).div(this.extent);
    const fieldUv = local.add(.5);
    const edge = local.abs().max(local.yx.abs()).x.smoothstep(.5, .42);
    const height = positionWorld.y.div(5).oneMinus().clamp(.15, 1);
    return texture(this.target.texture, fieldUv).rgb.mul(edge).mul(height).mul(this.strength);
  }
  setQuality(tier: 'high' | 'low'): void {
    if (tier === this.tier) return;
    this.tier = tier; const s = tierSettings[tier];
    this.target.setSize(s.resolution, s.resolution); this.extent.value = s.size;
  }
  /** Layout lights; the array is retained and its `on` flags may change between frames. */
  setStatic(lights: FieldLight[]): void { this.statics = lights; }
  /** Per-frame lights (vehicles, the player aura); cleared by `update`. */
  push(light: FieldLight): void { this.dynamics.push(light); }
  /** E27 hook (explosions, Molotovs, muzzle flashes): a pool that fades out linearly over `ttl` seconds.
   * `ttl = Infinity` keeps it until `remove()`. `intensity` uses the §6 0..10 scale. */
  addTransient(position: { x: number; z: number }, hex: string, intensity: number, radius: number, ttl: number, flicker = false): TransientLight {
    const c = linear(hex), entry = { light: { x: position.x, z: position.z, r: c.r, g: c.g, b: c.b, radius, aimX: 0, aimZ: 0, stretch: 1, flicker: flicker ? 1 : 0, strobe: false, seed: this.transients.length * 7.13, on: true } as FieldLight, born: this.time, ttl, intensity };
    this.transients.push(entry);
    return { remove: () => { const i = this.transients.indexOf(entry); if (i >= 0) this.transients.splice(i, 1); } };
  }
  get active(): boolean { return this.strength.value > 0; }
  /** Fill the instances for the window around the focus (nearest first when over the tier budget).
   * `time` is sim seconds, so flicker, strobes and transient fades are deterministic and freeze while paused. */
  update(focusX: number, focusZ: number, time: number): void {
    const start = performance.now();
    this.time = time;
    for (let i = this.transients.length - 1; i >= 0; i--) if (this.time - this.transients[i].born >= this.transients[i].ttl) this.transients.splice(i, 1);
    const extent = this.extent.value, texel = extent / this.target.width;
    // Snap the window to whole texels so static pools do not shimmer as the camera follows.
    const cx = Math.round(focusX / texel) * texel, cz = Math.round(focusZ / texel) * texel;
    this.center.value.set(cx, cz);
    this.camera.left = this.camera.bottom = -extent / 2; this.camera.right = this.camera.top = extent / 2;
    this.camera.position.set(cx, 100, cz); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    if (!this.active) { this.dynamics.length = 0; this.drawn = this.candidates = 0; this.ms = 0; return; }
    const capacity = tierSettings[this.tier].capacity, limit = extent / 2;
    const inside = (l: FieldLight) => l.on && Math.abs(l.x + l.aimX - cx) < limit + l.radius * l.stretch && Math.abs(l.z + l.aimZ - cz) < limit + l.radius * l.stretch;
    const pool: FieldLight[] = [];
    for (const l of this.statics) if (inside(l)) pool.push(l);
    for (const l of this.dynamics) if (inside(l)) pool.push(l);
    for (const t of this.transients) {
      const fade = Number.isFinite(t.ttl) ? 1 - (this.time - t.born) / t.ttl : 1, k = t.intensity * fieldGain * Math.max(0, fade);
      if (inside(t.light)) pool.push({ ...t.light, r: t.light.r * k, g: t.light.g * k, b: t.light.b * k });
    }
    this.candidates = pool.length;
    let lights = pool;
    if (pool.length > capacity) {
      this.order.length = 0; for (let i = 0; i < pool.length; i++) this.order.push(i);
      this.order.sort((a, b) => Math.hypot(pool[a].x - cx, pool[a].z - cz) - Math.hypot(pool[b].x - cx, pool[b].z - cz));
      lights = this.order.slice(0, capacity).map(i => pool[i]);
    }
    let count = 0;
    for (const l of lights) {
      let k = 1;
      if (l.flicker === 1) k = .78 + .14 * Math.sin(this.time * 9.1 + l.seed) + .08 * Math.sin(this.time * 23.7 + l.seed * 3.1);
      else if (l.flicker === 2) k = Math.sin(this.time * 2.3 + l.seed) > .93 ? .25 : 1;
      if (l.strobe) k *= Math.floor(this.time * 2 + l.seed) % 2 === 0 ? 1 : .12;
      const angle = l.stretch > 1 ? Math.atan2(l.aimX, l.aimZ) : 0;
      this.position.set(l.x + l.aimX, 0, l.z + l.aimZ); this.rotation.setFromAxisAngle(this.up, angle);
      this.scale.set(l.radius * 2, 1, l.radius * 2 * l.stretch);
      this.mesh.setMatrixAt(count, this.matrix.compose(this.position, this.rotation, this.scale));
      this.mesh.setColorAt(count, color.setRGB(l.r * k, l.g * k, l.b * k));
      count++;
    }
    this.mesh.count = count; this.drawn = count;
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.dynamics.length = 0;
    this.ms = performance.now() - start;
  }
  /** One additive draw into the HDR target; skipped entirely in daylight. */
  render(renderer: WebGPURenderer): void {
    if (!this.active && this.rendered) return;
    const start = performance.now();
    const state = RendererUtils.resetRendererState(renderer, this.rendererState);
    renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    RendererUtils.restoreRendererState(renderer, state);
    this.rendered = true; this.ms += performance.now() - start;
  }
  snapshot() {
    return { strength: this.strength.value, resolution: this.target.width, size: this.extent.value, statics: this.statics.length, litStatics: this.statics.filter(l => l.on).length, candidates: this.candidates, drawn: this.drawn, transients: this.transients.length, capacity: tierSettings[this.tier].capacity, ms: this.ms, center: this.center.value.toArray() };
  }
  dispose(): void { this.target.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as MeshBasicNodeMaterial).dispose(); this.mesh.dispose(); }
}
