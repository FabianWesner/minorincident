import { cureReached } from '../../sim/missions/CureFront';
import { epiloguePull } from '../../sim/missions/LevelTenEpilogue';
// Fireball: TSL noise-dissolved spheres with a fire gradient, adapted from Bruno Simon folio-2025 World/Fireballs.js (MIT, 41046b5).
// Roll kick by distance and bullet time ramp: adapted from folio-2025 Explosions.js and Time.js bulletTime (MIT, 41046b5).
import { AdditiveBlending, BoxGeometry, DoubleSide, DynamicDrawUsage, Frustum, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MeshLambertNodeMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3, type BufferGeometry, type Camera, type Node } from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, cameraPosition, cameraWorldMatrix, cos, dot, exp, float, Fn, fract, mix, mx_noise_float, normalView, normalWorld, positionGeometry, positionWorld, screenCoordinate, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Rng } from '../../core/Rng';
import { blastFxPresets, type BlastFxPreset } from '../../data/explosions';
import type { GameEvent } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { seeThroughHole } from '../SeeThrough';
import { FxPool, groundShape, particleShape } from './FxPool';
import type { LightField } from '../LightField';

type Blast = Extract<GameEvent, { type: 'explosion' }>;
interface Column { /** Moving source (L9 floor APC): extra puffs per metre driven, short-lived low trail puffs. */ trail?: number; ground?: number; born: number; x: number; z: number; until: number; rate: number; size: number; heat: number; acc: number; shade: number; cloud: number; light?: { remove(): void } | null }
interface Glow { ground?: number; x: number; z: number; radius: number; color: number; intensity: number; born: number; life: number }
/** E25 light-field pool (LightField.addTransient): intensity on the §6 0..10 scale; ttl seconds (Infinity until removed). */
export type BlastLight = (x: number, z: number, hex: string, intensity: number, radius: number, ttl: number, flicker: boolean) => { remove(): void } | null;
export interface BlastHost { camera?(): Camera; particles: FxPool; shake(strength: number): void; roll?(strength: number): void; focus?(): { x: number; z: number }; light?: BlastLight; field?: LightField; ambient?: Node<'float'>; sunDirection?(): { x: number; y: number; z: number } }

/** Spec 07 §8 budgets: smoke puffs 400 high / 120 low; fireball spheres; flame cards; ground light pools. */
const PUFFS = 400, PUFFS_LOW = 120, FIREBALLS = 96, DEBRIS = 64, FLAMES = 128, GLOWS = 40, PARTS = 12;
const wind = { x: .55, z: .25 };
const identity = new Matrix4();
const up = new Vector3(0, 1, 0);

function instanced(geometry: BufferGeometry, material: MeshBasicNodeMaterial | MeshLambertNodeMaterial, cap: number, attributes: Record<string, number>): { mesh: InstancedMesh; attrs: Record<string, InstancedBufferAttribute> } {
  const attrs: Record<string, InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(attributes)) { attrs[name] = new InstancedBufferAttribute(new Float32Array(cap * size), size).setUsage(DynamicDrawUsage); geometry.setAttribute(name, attrs[name]); }
  const mesh = new InstancedMesh(geometry, material, cap); mesh.frustumCulled = false; mesh.visible = false;
  for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, identity);
  return { mesh, attrs };
}

/** E27 view: the seven-beat blast (flash, fireball, shockwave/dust, sparks, smoke column, scorch), persistent
 * fires (flame cards + ground light pools), smoke columns/clouds, detached car parts, camera roll and bullet time.
 * Everything is pooled and fixed-size; only spawn/assignment writes attributes, motion runs in TSL. */
export class Blasts extends Group {
  readonly clock = uniform(0);
  /** Fireball/glow emissive scale; flash reduction lowers it. */
  private readonly heat = uniform(1);
  private readonly windNode = uniform(new Vector3(wind.x, 0, wind.z));
  private readonly playerNode = uniform(new Vector3(-1000, 1, -1000));
  private readonly sunNode = uniform(new Vector3(.45, .78, .43).normalize());
  private readonly fireballs; private readonly fb;
  private readonly puffs; private readonly pf;
  private readonly flames; private readonly fl;
  private readonly glows; private readonly gl;
  private readonly debris; private readonly db;
  private readonly parts: InstancedMesh;
  private readonly columnShadows: InstancedMesh;
  readonly scorch = new FxPool(64, 'ground');
  private readonly rng: Rng;
  private fbCursor = 0; private puffCursor = 0; private debrisCursor = 0;
  private readonly debrisExpiry = new Float64Array(DEBRIS);
  private puffExpiry = new Float64Array(PUFFS); private fbExpiry = new Float64Array(FIREBALLS);
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly sourcePoint = new Vector3();
  private readonly columns: Column[] = [];
  private readonly fireColumns = new Map<number, Column>();
  private readonly vehicleColumns = new Map<number, Column>();
  private readonly cloudColumns = new Map<number, Column>();
  private readonly glowList: Glow[] = [];
  private readonly partMatrix = new Matrix4(); private readonly quat = new Quaternion(); private readonly pos = new Vector3(); private readonly scl = new Vector3();
  private readonly hoodTurn = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  private time = 0;
  private flashPeak = 0; private flashAt = -1;
  private bullet = { scale: 1, remaining: 0, progress: 0 };
  private flames4Hz = -1;
  private glowCount = 0;
  quality: 'high' | 'low' = 'high';
  flashReduction = false;
  slowMotion = true;
  blasts = 0;
  constructor(private readonly world: SimWorld, private readonly host: BlastHost) {
    super(); this.name = 'e27-blasts'; this.rng = new Rng(world.seed, 'blasts');
    const clock = this.clock, heat = this.heat;
    // Fireballs: origin(x,y,z,birth), params(size, life, delay, rise), style(drift x, drift z, kind, unused).
    // Kind 0 fire: hot noise-eroded lobes that spread outward, cool to red and break apart.
    // Kind 1 soot: dark, sun/ember-lit billows that overtake the fire and erode late (the contrast that sells the blast).
    // Kind 2 flash: the white-hot core of the first frames, shattering as it fades.
    const fbMaterial = new MeshBasicNodeMaterial();
    ({ mesh: this.fireballs, attrs: this.fb } = instanced(new SphereGeometry(1, 20, 14), fbMaterial, FIREBALLS, { fbOrigin: 4, fbParams: 4, fbStyle: 4 }));
    {
      const o = attribute('fbOrigin', 'vec4'), prm = attribute('fbParams', 'vec4'), st = attribute('fbStyle', 'vec4');
      const kind = st.z.add(.5).floor(), soot = kind.equal(1).select(1, 0), flashKind = kind.equal(2).select(1, 0);
      const age = clock.sub(o.w).sub(prm.z), progress = age.div(prm.y.max(.001)).clamp(0, 1);
      const alive = age.greaterThanEqual(0).and(age.lessThan(prm.y)).select(1, 0);
      const seed = vec3(o.x.mul(1.7), o.z.mul(1.3), o.w.mul(5.1).fract().mul(10));
      fbMaterial.positionNode = Fn(() => {
        const out = float(1).sub(float(1).sub(progress).pow(2.2));
        const fireGrow = float(1).sub(float(1).sub(progress).pow(3)).mul(.85).add(.15);
        const sootGrow = float(1).sub(float(1).sub(progress).pow(2)).mul(.7).add(.3).mul(float(1).sub(smoothstep(.65, 1, progress).mul(.45)));
        const flashGrow = float(1).sub(float(1).sub(progress).pow(5)).mul(.6).add(.4);
        const grow = mix(mix(fireGrow, sootGrow, soot), flashGrow, flashKind);
        const bump = mx_noise_float(positionGeometry.mul(1.8).add(seed).add(vec3(0, clock.mul(-1.2), 0))).mul(mix(.3, .45, soot)).add(1);
        const rise = mix(progress, progress.pow(.6), soot);
        return o.xyz.add(vec3(st.x, 0, st.y).mul(out)).add(vec3(0, prm.w.mul(rise), 0)).add(positionGeometry.mul(prm.x.mul(grow).mul(bump).mul(alive)));
      })();
      fbMaterial.outputNode = Fn(() => {
        const n = mx_noise_float(positionGeometry.mul(2.3).add(seed).add(vec3(0, clock.mul(-2), 0))).mul(.5).add(.5);
        const erode = mix(mix(progress.mul(.95).sub(.05), progress.pow(1.6).mul(.85).add(float(1).sub(normalView.z.abs()).mul(.4).mul(progress)), soot), progress.mul(1.2).sub(.15), flashKind);
        n.lessThan(erode).or(alive.lessThan(.5)).discard();
        // Readability: soot billows dither away in the player's see-through hole like every other occluder.
        const dither = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
        soot.greaterThan(.5).and(dither.greaterThan(seeThroughHole(1.15).mul(.7).add(.3))).discard();
        const h = n.mul(float(1).sub(progress).pow(1.25)).mul(1.45);
        const sootTone = vec3(.07, .055, .05), red = vec3(.85, .16, .04), orange = vec3(1, .45, .08), yellow = vec3(1, .82, .32), white = vec3(1, .97, .85);
        let c = mix(sootTone, red, smoothstep(.05, .2, h));
        c = mix(c, orange, smoothstep(.2, .42, h)); c = mix(c, yellow, smoothstep(.42, .7, h)); c = mix(c, white, smoothstep(.7, 1, h));
        // Self-occlusion: darker at the silhouette, glowing core facing the camera.
        const facing = normalView.z.abs().smoothstep(0, .8).mul(.5).add(.5);
        const fire = c.mul(facing).mul(mix(1, 2.6, smoothstep(.25, .8, h))).mul(heat);
        // Soot: sun-shaded dark volume, lit orange from below while the fire is young, with hot pockets in the first moments.
        const sun = normalWorld.dot(this.sunNode).mul(.5).add(.5);
        const ambient = host.ambient ? host.ambient.clamp(.18, 1) : float(1);
        const under = float(1).sub(progress).pow(2).mul(normalWorld.y.negate().mul(.5).add(.5));
        const pocket = smoothstep(.74, .96, n).mul(float(1).sub(progress.mul(3.2)).clamp(0, 1));
        // Dark albedo reflects sun and practical light alike: field radiance multiplies it instead of adding a bright veil.
        const albedo = vec3(.046, .04, .037), lit = host.field ? host.field.sample().mul(.8) : vec3(0);
        const sootColor = mix(albedo.mul(mix(.42, 1.55, sun).mul(ambient).add(lit)).add(vec3(.95, .34, .08).mul(under.mul(.4).mul(heat))), orange.mul(2.2).mul(heat), pocket);
        const flashColor = mix(vec3(1, .78, .4), white, n).mul(float(1).sub(progress).mul(1.6).add(1.2)).mul(heat);
        return vec4(mix(mix(fire, sootColor, soot), flashColor, flashKind), 1);
      })();
    }
    // Smoke puffs: origin(x,y,z,birth), motion(vx,vy,vz,life), style(size0,size1,heat,shade).
    const puffMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    ({ mesh: this.puffs, attrs: this.pf } = instanced(new IcosahedronGeometry(1, 2), puffMaterial, PUFFS, { pOrigin: 4, pMotion: 4, pStyle: 4 }));
    {
      const o = attribute('pOrigin', 'vec4'), m = attribute('pMotion', 'vec4'), st = attribute('pStyle', 'vec4');
      const age = clock.sub(o.w).max(0), progress = age.div(m.w.max(.001)).clamp(0, 1), alive = age.lessThan(m.w).select(1, 0);
      const seed = vec3(o.x.mul(.37), o.w.mul(3.7).fract().mul(9), o.z.mul(.41));
      puffMaterial.positionNode = Fn(() => {
        const size = mix(st.x, st.y, progress.pow(.6)).mul(alive);
        const bump = mx_noise_float(positionGeometry.mul(1.4).add(seed)).mul(.3).add(1);
        // Rise decelerates; wind bends the column more the higher (older) a puff is.
        const drift = m.xyz.mul(age.mul(float(1).sub(progress.mul(.35)))).add(this.windNode.mul(age.mul(progress.add(.25))));
        return o.xyz.add(drift).add(positionGeometry.mul(size).mul(bump));
      })();
      puffMaterial.outputNode = Fn(() => {
        const ray = cameraPosition.sub(this.playerNode), length = ray.length().max(.001), direction = ray.div(length);
        const along = dot(positionWorld.sub(this.playerNode), direction).clamp(0, length);
        const nearRay = positionWorld.sub(this.playerNode.add(direction.mul(along))).length().lessThanEqual(6);
        const sun = normalWorld.dot(vec3(.45, .78, .43)).mul(.5).add(.5);
        const ambient = host.ambient ? host.ambient.clamp(.12, 1) : float(1);
        const base = vec3(st.w).mul(mix(.62, 1.12, sun)).mul(ambient);
        // Lit from below by the fire: low, young puffs glow orange on their undersides (spec 07 §6).
        const ember = st.z.mul(float(1).sub(progress).pow(2.5)).mul(smoothstep(4.5, .6, positionWorld.y)).mul(normalWorld.y.negate().mul(.35).add(.75));
        const smokeColor = st.z.lessThan(-1.5).select(vec3(.55, .82, .8).mul(mix(.75, 1.12, sun)).mul(ambient.max(.6)), st.z.lessThan(0).select(vec3(.2, .48, .09).mul(mix(.62, 1.12, sun)).mul(ambient), base));
        // Practical radiance lights the cloud; damp the player-ray contribution so
        // the readability aura does not turn the foreground smoke into a bright veil.
        const color = mix(smokeColor, vec3(1, .42, .12).mul(1.2), ember.clamp(0, .6)).add(host.field ? host.field.sample().mul(positionWorld.y.smoothstep(3.5, 1.5)).mul(nearRay.select(.25, 3)).mul(st.w.mul(2.5).min(1)) : vec3(0));
        const edge = normalView.z.abs().smoothstep(.05, .7);
        const grain = mx_noise_float(positionWorld.mul(.9).add(seed)).mul(.25).add(.85);
        const fade = age.div(.45).min(1).mul(float(1).sub(progress).pow(1.3));
        // Retain 30% in the 6 m player-ray tube, leaving headroom for antialiasing
        // and bloom while keeping the final measured coverage below the 40% cap.
        const dither = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
        nearRay.and(dither.greaterThanEqual(.3)).discard();
        return vec4(color, edge.mul(grain).mul(fade).mul(st.z.lessThan(-1.5).select(.32, .97)).mul(alive).mul(mix(.38, 1, seeThroughHole(1.15))));
      })();
      this.puffs.renderOrder = 3;
    }
    // Flame cards: Y-billboards. origin(x,y,z,seed), style(width,height,intensity,unused).
    const flameMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const flameGeometry = new PlaneGeometry(1, 1); flameGeometry.translate(0, .5, 0);
    ({ mesh: this.flames, attrs: this.fl } = instanced(flameGeometry, flameMaterial, FLAMES, { fOrigin: 4, fStyle: 4 }));
    {
      const o = attribute('fOrigin', 'vec4'), st = attribute('fStyle', 'vec4');
      // Per-card hash from the seed: every flame gets its own width exponent, lean, flicker rate and wisp phase.
      const hash = (k: number) => fract(o.w.mul(12.9898).add(k * 78.233).sin().mul(43758.5453));
      const SPREAD = 1.7; // the card is wider than the flame body so the tongue can sway and lick sideways
      flameMaterial.positionNode = Fn(() => {
        const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz.mul(vec3(1, 0, 1)).normalize();
        const flicker = clock.mul(hash(1).mul(5).add(6)).add(o.w.mul(6.3)).sin().mul(.13).add(clock.mul(hash(2).mul(2).add(2.4)).add(hash(3).mul(9)).sin().mul(.09)).add(1);
        return o.xyz.add(right.mul(positionGeometry.x.mul(st.x).mul(SPREAD))).add(vec3(0, positionGeometry.y.mul(st.y).mul(flicker), 0));
      })();
      flameMaterial.outputNode = Fn(() => {
        const p = uv(), y = p.y, x = p.x.sub(.5).mul(2).mul(SPREAD);
        const h1 = hash(4), h2 = hash(5), h3 = hash(6);
        // Moving silhouette: the tongue sways with height, leans per card, and its edge wobbles with two noise octaves.
        const sway = mx_noise_float(vec3(y.mul(1.7), clock.mul(h1.mul(.8).add(.9)).add(h2.mul(10)), h3.mul(9))).mul(.95).add(h2.sub(.5).mul(.6)).mul(y);
        const lx = x.sub(sway);
        const n = mx_noise_float(vec3(lx.mul(2.1), y.mul(2.8).sub(clock.mul(h3.mul(1.6).add(2.2))), o.w.mul(7))).mul(.5).add(.5);
        const wisp = mx_noise_float(vec3(lx.mul(5), y.mul(6).sub(clock.mul(5.5)), o.w.mul(3).add(4))).mul(.5).add(.5);
        const body = float(1).sub(y).max(0).pow(h3.mul(.5).add(.55)).mul(h1.mul(.4).add(.85)).add(n.sub(.5).mul(y.mul(.8).add(.25)).mul(.5));
        const across = float(1).sub(smoothstep(body.mul(.3), body.add(.14), lx.abs()));
        const along = float(1).sub(smoothstep(n.mul(.35).add(.4), 1, y.add(wisp.sub(.5).mul(.3)))).mul(smoothstep(0, .2, y.sub(lx.mul(lx).mul(.16))));
        const mask = across.mul(along);
        // Core stays small and low: hot yellow, never the old flat white.
        const core = smoothstep(.55, 1, mask).mul(smoothstep(.55, 0, y)).mul(.75);
        const color = mix(mix(vec3(.8, .1, .02), vec3(1, .45, .08), smoothstep(.1, .65, mask)), vec3(1, .8, .38), core).mul(mix(.65, 1.05, core)).mul(st.z).mul(heat);
        return vec4(color, mask.mul(st.w).mul(.9));
      })();
      this.flames.renderOrder = 4;
    }
    // Ground light pools (fake fire/flash light on the stylised, custom-lit town): origin(x,y,z,radius), color(r,g,b,intensity).
    const glowMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const glowGeometry = new PlaneGeometry(2, 2); glowGeometry.rotateX(-Math.PI / 2);
    ({ mesh: this.glows, attrs: this.gl } = instanced(glowGeometry, glowMaterial, GLOWS, { gOrigin: 4, gColor: 4 }));
    {
      const o = attribute('gOrigin', 'vec4'), c = attribute('gColor', 'vec4');
      glowMaterial.positionNode = o.xyz.add(positionGeometry.mul(o.w));
      glowMaterial.outputNode = Fn(() => {
        const r = uv().sub(.5).mul(2).length(), falloff = float(1).sub(r).max(0).pow(2);
        return vec4(c.rgb.mul(c.w).mul(falloff).mul(heat), falloff);
      })();
      this.glows.renderOrder = 1;
    }
    // Debris chunks: flat-shaded rocks/scrap on analytic ballistic arcs (no physics bodies), tumbling until they land,
    // glowing hot for the first second. origin(x,y,z,birth), velocity(vx,vy,vz,life), spin(axis xyz, rad/s), params(size, landing s, unused, heat), color.
    const debrisMaterial = new MeshLambertNodeMaterial({ flatShading: true });
    ({ mesh: this.debris, attrs: this.db } = instanced(new IcosahedronGeometry(1, 0), debrisMaterial, DEBRIS, { dOrigin: 4, dVelocity: 4, dSpin: 4, dParams: 4, dColor: 3 }));
    {
      const o = attribute('dOrigin', 'vec4'), v = attribute('dVelocity', 'vec4'), sp = attribute('dSpin', 'vec4'), prm = attribute('dParams', 'vec4');
      const age = clock.sub(o.w), alive = age.greaterThanEqual(0).and(age.lessThan(v.w)).select(1, 0);
      const flight = age.max(0).min(prm.y), after = age.sub(prm.y).max(0);
      debrisMaterial.positionNode = Fn(() => {
        const h = o.w.mul(7.31).add(o.x.mul(.37)).fract();
        const scale = vec3(h.mul(.8).add(.6), h.mul(.5).add(.38), float(1.3).sub(h.mul(.6))).mul(prm.x).mul(alive).mul(float(1).sub(smoothstep(v.w.sub(.6), v.w, age)));
        const local = positionGeometry.mul(scale), theta = sp.w.mul(flight.add(after.min(.25).mul(.4))), c = cos(theta), s = sin(theta), axis = sp.xyz;
        const turned = local.mul(c).add(axis.cross(local).mul(s)).add(axis.mul(axis.dot(local)).mul(float(1).sub(c)));
        const slide = float(1).sub(exp(after.mul(-5))).mul(.05);
        return o.xyz.add(v.xyz.mul(flight)).add(vec3(0, flight.mul(flight).mul(-4.905), 0)).add(vec3(v.x, 0, v.z).mul(slide)).add(turned);
      })();
      debrisMaterial.colorNode = attribute('dColor', 'vec3');
      (debrisMaterial as unknown as { emissiveNode: Node }).emissiveNode = vec3(1, .38, .07).mul(prm.w).mul(float(1).sub(age.div(1.3)).clamp(0, 1).pow(2)).mul(2.4).mul(heat);
    }
    // Detached sheet metal has rolled edges and raised reinforcement, readable
    // while tumbling. The normalized volume still follows each sim body's bounds.
    const panel = new RoundedBoxGeometry(.96, .96, .86, 1, .065);
    const ribs = [-.30, .30].map(y => new BoxGeometry(.78, .055, .10).translate(0, y, .45).toNonIndexed());
    const panelGeometry = mergeGeometries([panel, ...ribs], true)!;
    panel.dispose(); for (const rib of ribs) rib.dispose();
    this.parts = new InstancedMesh(panelGeometry, [
      new MeshLambertNodeMaterial({ color: 0x9a8074 }),
      new MeshLambertNodeMaterial({ color: 0xb6bcc2 }),
      new MeshLambertNodeMaterial({ color: 0xb6bcc2 }),
    ], PARTS);
    this.parts.count = 0; this.parts.frustumCulled = false; this.parts.castShadow = true;
    const shadowGeometry = new PlaneGeometry(1, 1); shadowGeometry.rotateX(-Math.PI / 2);
    const shadowMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const q = uv().sub(.5).mul(2);
    shadowMaterial.outputNode = vec4(vec3(.16, .12, .25), q.x.abs().smoothstep(1, .3).mul(q.y.abs().smoothstep(1, .5)).mul(.24));
    this.columnShadows = new InstancedMesh(shadowGeometry, shadowMaterial, 64);
    this.columnShadows.count = 0; this.columnShadows.frustumCulled = false; this.columnShadows.renderOrder = 1;
    this.add(this.scorch.mesh, this.glows, this.fireballs, this.debris, this.puffs, this.flames, this.parts, this.columnShadows);
  }
  get flash(): number { return this.flashAt < 0 ? 0 : this.flashPeak * Math.max(0, 1 - (this.time - this.flashAt) / .16); }
  set(patch: { quality?: 'high' | 'low'; flashReduction?: boolean; slowMotion?: boolean }): void {
    if (patch.quality) { this.quality = patch.quality; this.puffs.count = patch.quality === 'low' ? PUFFS_LOW : PUFFS; }
    if (patch.flashReduction !== undefined) { this.flashReduction = patch.flashReduction; this.heat.value = patch.flashReduction ? .6 : 1; }
    if (patch.slowMotion !== undefined) { this.slowMotion = patch.slowMotion; if (!this.slowMotion) this.bullet = { scale: 1, remaining: 0, progress: 0 }; }
  }
  /** Bullet time ramp consuming real seconds: returns the presentation/sim clock scale (1 = normal). */
  timeScale(realSeconds: number): number {
    const b = this.bullet;
    b.remaining = Math.max(0, b.remaining - realSeconds);
    b.progress = Math.max(0, Math.min(1, b.progress + (b.remaining > 0 ? 10 : -3) * realSeconds));
    return 1 + (b.scale - 1) * b.progress;
  }
  slowmo(event: Extract<GameEvent, { type: 'explosion.slowmo' }>): void {
    if (!this.slowMotion) return;
    this.bullet.scale = Math.min(this.bullet.remaining > 0 ? this.bullet.scale : 1, event.scale); this.bullet.remaining = Math.max(this.bullet.remaining, event.seconds);
  }
  play(event: Blast): void {
    const fx = blastFxPresets[event.fx]; if (!fx) return;
    this.blasts++;
    const { x, z } = event.position, ground = event.position.y < 0 ? event.position.y - .7 : 0, r = event.radius, now = this.time, low = this.quality === 'low';
    // Beat 2 flash: screen flash (capped by flash reduction) + a strong, short ground light pool.
    // The white-out belongs to blasts close to the player; a distant tank round or fuel chain only gets a weak flash.
    const focus0 = this.host.focus?.(), flashNear = focus0 ? Math.max(.15, Math.min(1, 1.4 - Math.hypot(focus0.x - x, focus0.z - z) / 18)) : 1;
    this.flashPeak = Math.max(this.flash, (this.flashReduction ? Math.min(.12, fx.flash) : fx.flash) * flashNear); this.flashAt = now;
    this.glow(x, z, r * 2.2, fx.light.color, (this.flashReduction ? .45 : 1) * Math.min(2.2, fx.light.intensity / 100), fx.light.seconds, ground || undefined);
    const hex = `#${fx.light.color.toString(16).padStart(6, '0')}`;
    this.host.light?.(x, z, hex, Math.min(10, fx.light.intensity / 20) * (this.flashReduction ? .5 : 1), fx.light.range, fx.light.seconds, true);
    // White-hot onset: a shattering core sphere plus a short, wide light pulse on the ground and nearby walls (light field).
    // Flash reduction keeps only a weak warm pool.
    // Scaled by the preset flash: a barrel/propane gets a hot white core, a Molotov only a small one.
    const punch = Math.min(1, fx.flash * 1.6);
    if (!this.flashReduction && fx.fireball.count > 0) {
      this.fireball(x, ground + .5 + fx.fireball.size * .3, z, fx.fireball.size * (.2 + .3 * punch), .12, 0, 0, 0, 0, 2);
      this.host.light?.(x, z, '#fff0d2', 7 * punch, fx.light.range * 1.2, .2, false);
    }
    this.glow(x, z, Math.min(r * 1.8, 9), 0xffe6b8, (this.flashReduction ? .3 : 1.3) * punch, .22, ground || undefined);
    // Mega blasts tint the whole town's light field orange for 5 s (spec 07 §5).
    if (event.cls === 'mega') this.host.light?.(x, z, '#ff7a30', 4, 90, 5, false);
    // Beat 3 fireball: overlapping noise spheres around the centre, staggered by up to 0.12 s.
    const count = low ? Math.ceil(fx.fireball.count / 2) : fx.fireball.count;
    // Lobes start near the centre and spread outward, so the fireball breaks into separate tongues instead of one blob.
    for (let i = 0; i < count; i++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.next() * fx.fireball.size * .3, size = fx.fireball.size * (.45 + this.rng.next() * .5), out = fx.fireball.size * (.25 + this.rng.next() * .65);
      this.fireball(x + Math.cos(a) * d, ground + .4 + this.rng.next() * fx.fireball.size * .5, z + Math.sin(a) * d, size, fx.fireball.seconds * (.7 + this.rng.next() * .5), i ? this.rng.next() * .12 : 0, fx.fireball.rise * (.6 + this.rng.next() * .6), Math.cos(a) * out, Math.sin(a) * out);
    }
    // Dark soot billows roll out of the fire just behind it and keep rising: the dark/hot contrast and the column's first seconds.
    const sootCount = low ? Math.ceil(fx.fireball.count * .4) : Math.ceil(fx.fireball.count * 1.2), stretch = Math.sqrt(fx.fireball.seconds / .9);
    for (let i = 0; i < sootCount; i++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.next() * fx.fireball.size * .35, out = fx.fireball.size * (.4 + this.rng.next() * .9), k = i / Math.max(1, sootCount - 1);
      this.fireball(x + Math.cos(a) * d, ground + .6 + this.rng.next() * fx.fireball.size * .5, z + Math.sin(a) * d, fx.fireball.size * (.3 + this.rng.next() * .32), (1.5 + this.rng.next() * 1.3) * stretch, .05 + k * .22, fx.fireball.rise * (1.2 + k * 1.6 + this.rng.next() * .5), Math.cos(a) * out, Math.sin(a) * out, 1);
    }
    // Debris chunks: scrap/rubble on ballistic arcs, a third of them glowing hot.
    const chunks = fx.fireball.count && fx.dust ? Math.min(24, Math.round((6 + r * 1.6) * (low ? .34 : 1))) : 0;
    for (let i = 0; i < chunks; i++) this.chunk(x, ground, z, r, i);
    // Beat 4 shockwave: a ground dust ring pushing outward (the E15 ring wave draws the 2r ring).
    const dust = low ? Math.ceil(fx.dust / 3) : fx.dust;
    for (let i = 0; i < dust; i++) {
      const a = i / dust * Math.PI * 2 + this.rng.next() * .2, speed = r * (1.2 + this.rng.next() * .6);
      this.host.particles.spawn(now, .9 + this.rng.next() * .5, x + Math.cos(a) * .6, ground + .25, z + Math.sin(a) * .6, Math.cos(a) * speed, .3 + this.rng.next() * .5, Math.sin(a) * speed, .5 + this.rng.next() * .5, particleShape.smoke, 0x8d7b68, .4);
    }
    // Beat 5 debris: bright spark streaks plus slower burning fragments.
    const sparks = low ? Math.ceil(fx.sparks / 4) : fx.sparks;
    for (let i = 0; i < sparks; i++) {
      const a = this.rng.next() * Math.PI * 2, out = 3 + this.rng.next() * r * 1.3, burning = i % 5 === 0;
      this.host.particles.spawn(now, burning ? 1.6 + this.rng.next() : .5 + this.rng.next() * .6, x, ground + .8, z, Math.cos(a) * out, 4 + this.rng.next() * (burning ? 6 : 9), Math.sin(a) * out, burning ? .09 : .045, particleShape.spark, burning ? 0xff7a26 : 0xffe9a8, 9.81, burning ? .3 : .65);
    }
    // Beat 6 smoke column, beat 7 scorch decal (persists to the end of the level; independent of the gore setting).
    if (fx.smoke.seconds > 0) this.columns.push({ ground: ground || undefined, born: now, x, z, until: now + fx.smoke.seconds, rate: fx.smoke.rate * (low ? .5 : 1), size: fx.smoke.size, heat: fx.smoke.heat, acc: 2, shade: .085, cloud: 0 });
    if (fx.scorch > 0) this.scorch.spawn(now, 900, x, ground + .014, z, this.rng.next() * Math.PI, 0, 0, r * fx.scorch * 2, groundShape.scorch, 0x16110f);
    // Camera: shake by size, Bruno's roll kick by distance from the focus.
    const focus = this.host.focus?.(), distance = focus ? Math.hypot(focus.x - x, focus.z - z) : 0;
    const near = Math.max(0, Math.min(1, 1 - (distance - 2) / (13 + r)));
    this.host.shake((this.flashReduction ? .3 : 1) * fx.shake * near);
    if (fx.roll) this.host.roll?.(fx.roll * near * (this.rng.next() < .5 ? -1 : 1));
  }
  /** Base (E15) blast core for every explosion, including those without an E27 preset (bloated infected): two to four lobes and soot. */
  core(x: number, ground: number, z: number, radius: number): void {
    const low = this.quality === 'low', size = Math.min(2.2, .5 + radius * .25);
    for (let i = 0; i < (low ? 2 : 4); i++) {
      const a = this.rng.next() * Math.PI * 2, out = size * (.3 + this.rng.next() * .5);
      this.fireball(x, ground + .5 + this.rng.next() * size * .4, z, size * (.45 + this.rng.next() * .35), .5 + this.rng.next() * .25, i ? this.rng.next() * .08 : 0, size * .8, Math.cos(a) * out, Math.sin(a) * out);
    }
    for (let i = 0; i < (low ? 1 : 3); i++) {
      const a = this.rng.next() * Math.PI * 2, out = size * (.5 + this.rng.next() * .6);
      this.fireball(x, ground + .6, z, size * (.45 + this.rng.next() * .3), 1.3 + this.rng.next() * .7, .08 + this.rng.next() * .1, size * 1.6, Math.cos(a) * out, Math.sin(a) * out, 1);
    }
  }
  private fireball(x: number, y: number, z: number, size: number, life: number, delay: number, rise: number, driftX = 0, driftZ = 0, kind = 0): void {
    let slot = this.fbCursor++ % FIREBALLS;
    for (let n = 0; n < FIREBALLS && this.fbExpiry[slot] > this.time; n++) slot = this.fbCursor++ % FIREBALLS;
    this.fb.fbOrigin.setXYZW(slot, x, y, z, this.time); this.fb.fbParams.setXYZW(slot, size, life, delay, rise); this.fb.fbStyle.setXYZW(slot, driftX, driftZ, kind, 0);
    this.fbExpiry[slot] = this.time + life + delay;
    this.fb.fbOrigin.needsUpdate = this.fb.fbParams.needsUpdate = this.fb.fbStyle.needsUpdate = true; this.fireballs.visible = true;
  }
  private static readonly debrisColors = [0x2a2422, 0x4b4038, 0x6e6a64, 0x7c3a22, 0x3b3a3d];
  private chunk(x: number, ground: number, z: number, r: number, i: number): void {
    const slot = this.debrisCursor++ % DEBRIS, rng = this.rng;
    const a = rng.next() * Math.PI * 2, out = 2.5 + rng.next() * r * 1.1, vy = 3.5 + rng.next() * 7.5, size = .07 + rng.next() * (i % 4 === 0 ? .22 : .12);
    const y = ground + .5 + rng.next() * .5, floor = ground + size * .35, land = (vy + Math.sqrt(vy * vy + 2 * 9.81 * Math.max(0, y - floor))) / 9.81;
    const ax = rng.next() - .5, ay = rng.next() - .5, az = rng.next() - .5, al = Math.hypot(ax, ay, az) || 1, life = land + 2.5 + rng.next() * 2;
    const color = Blasts.debrisColors[Math.floor(rng.next() * Blasts.debrisColors.length)];
    this.db.dOrigin.setXYZW(slot, x + Math.cos(a) * .3, y, z + Math.sin(a) * .3, this.time); this.db.dVelocity.setXYZW(slot, Math.cos(a) * out, vy, Math.sin(a) * out, life);
    this.db.dSpin.setXYZW(slot, ax / al, ay / al, az / al, 6 + rng.next() * 14); this.db.dParams.setXYZW(slot, size, land, 0, i % 3 === 0 ? 1 : 0);
    this.db.dColor.setXYZ(slot, (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255);
    this.debrisExpiry[slot] = this.time + life;
    for (const attr of Object.values(this.db)) attr.needsUpdate = true;
    this.debris.visible = true;
  }
  private puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size0: number, size1: number, heat: number, shade: number, born = this.time): void {
    const cap = this.puffs.count, slot = this.puffCursor++ % cap;
    this.pf.pOrigin.setXYZW(slot, x, y, z, born); this.pf.pMotion.setXYZW(slot, vx, vy, vz, life); this.pf.pStyle.setXYZW(slot, size0, size1, heat, shade);
    this.puffExpiry[slot] = born + life;
    this.pf.pOrigin.needsUpdate = this.pf.pMotion.needsUpdate = this.pf.pStyle.needsUpdate = true; this.puffs.visible = true;
  }
  /** Short transient ground pool (muzzle flashes, impact glints): shares the 12-entry glow list. */
  flashPool(x: number, z: number, radius: number, color: number, intensity: number, life: number, ground?: number): void { this.glow(x, z, radius, color, intensity, life, ground); }
  private glow(x: number, z: number, radius: number, color: number, intensity: number, life: number, ground?: number): void {
    if (this.glowList.length >= 12) this.glowList.shift();
    this.glowList.push({ ground, x, z, radius, color, intensity, born: this.time, life });
  }
  /** Explicit render clock (Vfx time). Columns emit puffs; fires refresh at 4 Hz from the sim. */
  advance(now: number, seconds: number): void {
    const camera = this.host.camera?.();
    if (camera) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const weather = this.world.weather;
    if (weather && (weather.kind === 'wind' || weather.kind === 'haze' || weather.kind === 'thunderstorm')) this.windNode.value.set(weather.wind.x, 0, weather.wind.z);
    this.time = now; this.clock.value = now; this.scorch.advance(now);
    const sunDirection = this.host.sunDirection?.(); if (sunDirection) this.sunNode.value.set(sunDirection.x, sunDirection.y, sunDirection.z).normalize();
    const tick = Math.floor(now * 4);
    if (tick !== this.flames4Hz) { this.flames4Hz = tick; this.syncSources(now); }
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i];
      if (now >= c.until) { this.columns.splice(i, 1); continue; }
      this.emit(c, seconds);
    }
    for (const c of this.fireColumns.values()) this.emit(c, seconds);
    for (const c of this.cloudColumns.values()) this.emit(c, seconds);
    for (const [id, c] of this.vehicleColumns) {
      const e = this.world.entities.get(id); if (!e) continue;
      // Exhaust at the rear: keep the cab and forward route clear, track movement each frame.
      c.x = e.transform.x - Math.cos(e.transform.yaw) * 2; c.z = e.transform.z + Math.sin(e.transform.yaw) * 2; c.ground = e.transform.y + .1;
      // A driving hull spaced its puffs 2 m apart (scattered round dots, QA L9-Q1): emit per metre so the trail stays continuous.
      const rate = c.rate; c.rate += Math.abs(e.vehicle?.speed ?? 0) * (c.trail ?? 0);
      this.emit(c, seconds); c.rate = rate;
    }
    this.writeFlamesAndGlows(now);
    this.syncParts();
    let fb = false, pf = false;
    for (let i = 0; i < FIREBALLS && !fb; i++) fb = this.fbExpiry[i] > now;
    for (let i = 0; i < this.puffs.count && !pf; i++) pf = this.puffExpiry[i] > now;
    let db = false;
    for (let i = 0; i < DEBRIS && !db; i++) db = this.debrisExpiry[i] > now;
    this.fireballs.visible = fb; this.puffs.visible = pf; this.debris.visible = db;
  }
  private emit(c: Column, seconds: number): void {
    // Keep the emitter alive in the sim; distant columns must not consume the
    // shared puff pool. Include their full rise and wind drift at screen edges.
    if (!this.sourceVisible(c.x, c.z, c.size + 32)) { c.acc = 0; return; }
    c.acc += c.rate * seconds;
    for (; c.acc >= 1; c.acc--) {
      // Keep a cohort spread over the elapsed render interval when QA advances
      // many fixed ticks at once; newborns must not all overlap at the final tick.
      const born = Math.max(c.born, this.time - (c.acc - 1) / Math.max(c.rate, 1e-9));
      const j = () => this.rng.next() - .5, ground = c.ground ?? this.world.districts?.groundHeight(c.x, c.z) ?? 0;
      if (c.cloud) {
        // Smoke grenade cloud: low, thick, slow, filling the authored radius.
        const a = this.rng.next() * Math.PI * 2, d = Math.sqrt(this.rng.next()) * c.cloud * .8;
        this.puff(c.x + Math.cos(a) * d, ground + .4 + this.rng.next() * .8, c.z + Math.sin(a) * d, j() * .3, .18 + this.rng.next() * .2, j() * .3, 4 + this.rng.next() * 1.5, c.size * .45, c.size * (.9 + this.rng.next() * .35), c.heat, c.shade + j() * .08, born);
      } else if (c.trail) {
        // Exhaust trail: overlapping soft puffs that start large, rise slowly and thin out within ~3 s behind the hull.
        this.puff(c.x + j() * .4 * c.size, ground + 1 + this.rng.next() * .5, c.z + j() * .4 * c.size, j() * .25, .7 + this.rng.next() * .5, j() * .25, 2.6 + this.rng.next(), c.size * .6, c.size * (1.15 + this.rng.next() * .35), c.heat, c.shade + j() * .06, born);
      } else this.puff(c.x + j() * .5 * c.size, ground + .5 + this.rng.next() * .4, c.z + j() * .5 * c.size, j() * .3, (c.size >= 2 ? 3 : 1.5) + this.rng.next() * .9, j() * .3, 7 + this.rng.next() * 2.5, c.size * .3, c.size * (.85 + this.rng.next() * .45), c.heat, c.shade + j() * .08, born);
    }
  }
  /** Mist uses the smoke puff pool (400/120); only the local camera neighborhood is sampled. */
  private cureMist(now: number): void {
    const front = this.world.missions?.state.cureFront;
    if (!front) return;
    const focus = this.host.focus?.() ?? this.world.entities.get(1)!.transform, count = this.quality === 'low' ? 8 : 24;
    const pull = epiloguePull(this.world.missions!.state.counters['epilogue-ticks'] ?? 0);
    for (let i = 0; i < count; i++) {
      const angle = this.rng.next() * Math.PI * 2, distance = Math.sqrt(this.rng.next()) * Math.max(1, Math.min(48 + 96 * pull, front.radius));
      const x = focus.x + Math.cos(angle) * distance, z = focus.z + Math.sin(angle) * distance;
      if (!cureReached(front, { x, z }) || !this.sourceVisible(x, z, 6)) continue;
      const ground = this.world.districts?.groundHeight(x, z) ?? 0;
      this.puff(x, ground + .3, z, .3, .08, .15, 3, 2.2 + 6 * pull, 4 + 12 * pull, -2, .75, now);
    }
  }
  /** Fires, burning props/cars and smoke-grenade zones drive persistent emitters. */
  private syncSources(now: number): void {
    this.cureMist(now);
    const vehicles = new Set<number>();
    const seen = new Set<number>(), clouds = new Set<number>(), low = this.quality === 'low';
    const player = this.world.entities.get(1);
    if (player) this.playerNode.value.set(player.transform.x, player.transform.y + .3, player.transform.z);
    for (const e of this.world.entities.iterate()) {
      if (e.vehicle?.floor && (e.vehicle.stage ?? 0) >= 3) {
        vehicles.add(e.id);
        let c = this.vehicleColumns.get(e.id);
        if (!c) { c = { born: now, x: e.transform.x, z: e.transform.z, until: Infinity, rate: 0, size: 0, heat: 0, acc: 1, shade: .3, cloud: 0 }; this.vehicleColumns.set(e.id, c); }
        const heavy = e.vehicle.stage === 4; c.rate = (heavy ? 5 : 2) * (low ? .5 : 1); c.size = heavy ? 1.25 : .65; c.shade = heavy ? .22 : .5; c.trail = (heavy ? 1.4 : .7) * (low ? .5 : 1);
      }
      const burningFire = e.hazard?.kind === 'fire' && this.world.tick < e.hazard.activeUntil;
      const burningProp = !!e.destructible && !e.destructible.broken && e.destructible.burningUntil > this.world.tick;
      const car = e.vehicle && (e.vehicle.damage === 'burning' || e.vehicle.damage === 'exploded');
      if ((e.hazard?.kind === 'toxic' || e.hazard?.kind === 'tear-gas') && this.world.tick < e.hazard.activeUntil) {
        const key = -e.id; clouds.add(key);
        if (!this.cloudColumns.has(key)) this.cloudColumns.set(key, { born: now, x: e.transform.x, z: e.transform.z, until: Infinity, rate: low ? 6 : 12, size: 1.5, heat: e.hazard.kind === 'toxic' ? -1 : 0, acc: low ? 8 : 18, shade: e.hazard.kind === 'toxic' ? .35 : .65, cloud: e.hazard.radius });
      }
      if (!burningFire && !burningProp && !car) continue;
      seen.add(e.id);
      let c = this.fireColumns.get(e.id);
      if (!c) { const landmark = (e.hazard?.radius ?? 0) >= 1.6; c = { born: now, x: e.transform.x, z: e.transform.z, until: Infinity, rate: (car || landmark ? 3 : 1.6) * (low ? .5 : 1), size: landmark ? 2.4 : car ? 1.8 : 1.1, heat: 1, acc: this.rng.next(), shade: car ? .14 : .2, cloud: 0 }; c.light = this.host.light?.(c.x, c.z, '#ff8a3a', car ? 5 : 3, (e.hazard?.radius ?? 1.4) * 4, Infinity, true) ?? null; this.fireColumns.set(e.id, c); }
      if (c.ground === undefined || c.x !== e.transform.x || c.z !== e.transform.z) c.ground = this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0;
      c.x = e.transform.x; c.z = e.transform.z;
      // Persistent fire needs embers even without a preceding blast. Reuse the
      // existing particle pool at 4 Hz (2 Hz on low), under its unchanged cap.
      // High: two buoyant embers per tick spread over the fire, drifting with the wind; low keeps one at 2 Hz.
      if (this.sourceVisible(c.x, c.z, c.size + 4) && (!low || Math.floor(now * 4) % 2 === 0)) for (let k = low ? 1 : 2; k > 0; k--) {
        const spread = Math.max(.6, (e.hazard?.radius ?? .8) * 1.2);
        this.host.particles.spawn(now, 1.2 + this.rng.next() * .8, c.x + (this.rng.next() - .5) * spread, (c.ground ?? 0) + .5 + this.rng.next() * .4, c.z + (this.rng.next() - .5) * spread, this.windNode.value.x * .5 + (this.rng.next() - .5) * .6, 1.5 + this.rng.next() * 1.2, this.windNode.value.z * .5 + (this.rng.next() - .5) * .6, .035 + this.rng.next() * .025, particleShape.spark, this.rng.next() < .3 ? 0xffe08a : 0xffa040, k === 1 ? .3 : -.15, .24);
      }
    }
    for (const id of this.vehicleColumns.keys()) if (!vehicles.has(id)) this.vehicleColumns.delete(id);
    for (const [id, c] of this.fireColumns) if (!seen.has(id)) { c.light?.remove(); this.fireColumns.delete(id); }
    for (const zone of this.world.combat?.effects.zones ?? []) {
      if (zone.kind !== 'smoke' || zone.expires <= this.world.tick) continue;
      clouds.add(zone.created);
      if (!this.cloudColumns.has(zone.created)) this.cloudColumns.set(zone.created, { born: now, x: zone.x, z: zone.z, until: Infinity, rate: low ? 6 : 12, size: 2.2, heat: 0, acc: low ? 8 : 18, shade: .72, cloud: zone.radius });
    }
    for (const id of this.cloudColumns.keys()) if (!clouds.has(id)) this.cloudColumns.delete(id);
    void now;
  }
  /** Conservative render culling; source lifetime, damage and fire light stay authoritative. */
  sourceVisible(x: number, z: number, radius: number): boolean {
    if (!this.host.camera) return true;
    this.sourcePoint.set(x, (this.world.districts?.groundHeight(x, z) ?? 0) + 9, z);
    // Plane distances avoid allocating bounds for each of the 22 persistent fires.
    return this.frustum.planes.every(plane => plane.distanceToPoint(this.sourcePoint) >= -radius);
  }
  /** Flame cards and light pools are rewritten every frame from the live sources (≤ 128 + 40 instances). */
  private writeFlamesAndGlows(now: number): void {
    let flames = 0, glows = 0;
    const sun = this.host.sunDirection?.() ?? { x: .45, y: .78, z: .43 }, horizontal = Math.hypot(sun.x, sun.z);
    let shadows = 0;
    for (const c of [...this.columns, ...this.fireColumns.values()]) {
      if (shadows >= 64 || c.cloud || horizontal < .01 || !this.sourceVisible(c.x, c.z, 32)) continue;
      const length = Math.min(30, (c.size >= 2 ? 18 : 10) * horizontal / Math.max(.15, Math.abs(sun.y)));
      this.pos.set(c.x - sun.x / horizontal * length / 2, (c.ground ?? 0) + .025, c.z - sun.z / horizontal * length / 2);
      this.quat.setFromAxisAngle(up, Math.atan2(sun.x, sun.z));
      this.scl.set(c.size * 1.6, 1, length);
      this.columnShadows.setMatrixAt(shadows++, this.partMatrix.compose(this.pos, this.quat, this.scl));
    }
    this.columnShadows.count = shadows; this.columnShadows.instanceMatrix.needsUpdate = true;
    const flame = (x: number, y: number, z: number, seed: number, width: number, height: number, intensity: number) => {
      if (flames >= FLAMES) return;
      this.fl.fOrigin.setXYZW(flames, x, y, z, seed); this.fl.fStyle.setXYZW(flames, width, height, intensity, 1); flames++;
    };
    const pool = (x: number, z: number, radius: number, color: number, intensity: number, ground?: number) => {
      if (glows >= GLOWS) return;
      this.gl.gOrigin.setXYZW(glows, x, (ground ?? this.world.districts?.groundHeight(x,z) ?? 0)+.03, z, radius);
      this.gl.gColor.setXYZW(glows, (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, intensity); glows++;
    };
    for (const [id, c] of this.fireColumns) {
      const e = this.world.entities.get(id); if (!e) continue;
      if (!this.sourceVisible(c.x, c.z, (e.hazard?.radius ?? 1.6) * 3.2 + 3)) continue;
      const big = !!e.vehicle, radius = e.hazard?.radius ?? (big ? 1.6 : .8), n = big ? 6 : Math.max(3, Math.round(radius * 3));
      const life = e.hazard ? Math.max(0, Math.min(1, (e.hazard.activeUntil - this.world.tick) / 120)) : 1;
      for (let i = 0; i < n; i++) {
        const a = id * 1.7 + i * 2.39996, d = (i === 0 ? 0 : radius * .55) * Math.sqrt((i + 1) / n);
        flame(c.x + Math.cos(a) * d, (c.ground ?? 0)+(big ? .55 : .02), c.z + Math.sin(a) * d, id * .13 + i * .37, (big ? 1.1 : .75) * (.7 + .3 * ((i * 7) % 3)), (big ? 2.4 : 1.5) * (i === 0 ? 1.25 : .8) * (.4 + .6 * life), .8 + .4 * life);
      }
      pool(c.x, c.z, radius * 3.2, 0xff7a2a, (.55 + .1 * Math.sin(now * 13 + id)) * (.3 + .7 * life));
    }
    for (let i = this.glowList.length - 1; i >= 0; i--) {
      const g = this.glowList[i], k = (now - g.born) / g.life;
      if (k >= 1) { this.glowList.splice(i, 1); continue; }
      pool(g.x, g.z, g.radius, g.color, g.intensity * (1 - k) ** 2, g.ground);
    }
    this.glowCount = glows;
    this.fl.fOrigin.needsUpdate = this.fl.fStyle.needsUpdate = this.gl.gOrigin.needsUpdate = this.gl.gColor.needsUpdate = true;
    this.flames.count = Math.max(1, flames); this.flames.visible = flames > 0;
    this.glows.count = Math.max(1, glows); this.glows.visible = glows > 0;
  }
  private syncParts(): void {
    let n = 0;
    for (const part of this.world.explosions?.parts ?? []) {
      if (!part.until || n >= PARTS || !part.body.isValid()) continue;
      const t = part.body.translation(), q = part.body.rotation();
      this.quat.set(q.x, q.y, q.z, q.w);
      if (part.kind === 'hood') {
        this.quat.multiply(this.hoodTurn);
        this.scl.set(part.half[0] * 2, part.half[2] * 2, part.half[1] * 2);
      } else this.scl.set(part.half[0] * 2, part.half[1] * 2, part.half[2] * 2);
      this.partMatrix.compose(this.pos.set(t.x, t.y, t.z), this.quat, this.scl);
      this.parts.setMatrixAt(n++, this.partMatrix);
    }
    this.parts.count = n; if (n) this.parts.instanceMatrix.needsUpdate = true;
  }
  /** Light sources for the E25 light field (fire pools and blast flashes): x, z, radius, color, intensity. */
  lights(): { x: number; z: number; radius: number; color: number; intensity: number }[] {
    const out = [];
    for (let i = 0; i < this.glowCount; i++) out.push({ x: this.gl.gOrigin.getX(i), z: this.gl.gOrigin.getZ(i), radius: this.gl.gOrigin.getW(i), color: Math.round(this.gl.gColor.getX(i) * 255) << 16 | Math.round(this.gl.gColor.getY(i) * 255) << 8 | Math.round(this.gl.gColor.getZ(i) * 255), intensity: this.gl.gColor.getW(i) });
    return out;
  }
  /** Compile every pipeline during loading: one live instance of each, then clear. */
  prewarm(x: number, z: number): void {
    this.fireball(x, 1, z, 1, .5, 0, 0); this.puff(x, 1, z, 0, 0, 0, 1, 1, 1, .5, .3); this.chunk(x, 0, z, 1, 0);
    this.fl.fOrigin.setXYZW(0, x, 0, z, 0); this.fl.fStyle.setXYZW(0, 1, 1, 1, 1); this.flames.count = 1; this.flames.visible = true;
    this.gl.gOrigin.setXYZW(0, x, .03, z, 1); this.gl.gColor.setXYZW(0, 1, .5, .2, 1); this.glows.count = 1; this.glows.visible = true;
    this.fl.fOrigin.needsUpdate = this.fl.fStyle.needsUpdate = this.gl.gOrigin.needsUpdate = this.gl.gColor.needsUpdate = true;
    this.scorch.spawn(this.time, 1, x, .014, z, 0, 0, 0, 1, 0, 0x16110f);
    this.partMatrix.makeTranslation(x, 1, z); this.parts.setMatrixAt(0, this.partMatrix); this.parts.count = 1;
    this.partMatrix.makeTranslation(x, .025, z); this.columnShadows.setMatrixAt(0, this.partMatrix); this.columnShadows.count = 1;
  }
  reset(): void {
    for (const c of this.fireColumns.values()) c.light?.remove();
    this.fbExpiry.fill(0); this.puffExpiry.fill(0); this.debrisExpiry.fill(0); this.db.dVelocity.array.fill(0); this.db.dVelocity.needsUpdate = true; this.debris.visible = false; this.columns.length = 0; this.fireColumns.clear(); this.cloudColumns.clear(); this.vehicleColumns.clear(); this.glowList.length = 0;
    for (const attr of [this.fb.fbParams, this.pf.pMotion]) { attr.array.fill(0); attr.needsUpdate = true; }
    this.scorch.reset(this.time); this.fireballs.visible = this.puffs.visible = this.flames.visible = this.glows.visible = false; this.parts.count = 0;
    this.columnShadows.count = 0;
    this.glowCount = 0; this.flashAt = -1; this.bullet = { scale: 1, remaining: 0, progress: 0 }; this.fl.fStyle.array.fill(0); this.gl.gOrigin.array.fill(0);
  }
  snapshot() {
    let puffs = 0, fireballs = 0;
    for (let i = 0; i < this.puffs.count; i++) if (this.puffExpiry[i] > this.time) puffs++;
    for (let i = 0; i < FIREBALLS; i++) if (this.fbExpiry[i] > this.time) fireballs++;
    let chunks = 0; for (let i = 0; i < DEBRIS; i++) if (this.debrisExpiry[i] > this.time) chunks++;
    return { wind: { x: this.windNode.value.x, z: this.windNode.value.z }, blasts: this.blasts, puffs, puffCap: this.puffs.count, fireballs, fireballCap: FIREBALLS, chunks, chunkCap: DEBRIS, flames: this.flames.visible ? this.flames.count : 0, glows: this.glows.visible ? this.glows.count : 0,
      vehicleSmokeColumns: this.vehicleColumns.size, columns: this.columns.length + this.fireColumns.size + this.vehicleColumns.size, transientColumns: this.columns.length, fireColumns: this.fireColumns.size, columnShadows: this.columnShadows.count, clouds: this.cloudColumns.size, scorch: this.scorch.count, parts: this.parts.count, flash: this.flash, bulletTime: { ...this.bullet }, slowMotion: this.slowMotion };
  }
  dispose(): void {
    this.reset(); this.scorch.dispose();
    for (const mesh of [this.fireballs, this.debris, this.puffs, this.flames, this.glows, this.parts, this.columnShadows]) { mesh.dispose(); mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); }
    this.clear();
  }
}
export type { BlastFxPreset };
