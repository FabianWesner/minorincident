// Fireball: TSL noise-dissolved spheres with a fire gradient, adapted from Bruno Simon folio-2025 World/Fireballs.js (MIT, 41046b5).
// Roll kick by distance and bullet time ramp: adapted from folio-2025 Explosions.js and Time.js bulletTime (MIT, 41046b5).
import { AdditiveBlending, BoxGeometry, DoubleSide, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MeshLambertNodeMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three/webgpu';
import { attribute, cameraWorldMatrix, float, Fn, mix, mx_noise_float, normalView, normalWorld, positionGeometry, positionWorld, smoothstep, uniform, uv, vec3, vec4 } from 'three/tsl';
import { Rng } from '../../core/Rng';
import { blastFxPresets, type BlastFxPreset } from '../../data/explosions';
import type { GameEvent } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { seeThroughHole } from '../SeeThrough';
import { FxPool } from './FxPool';

type Blast = Extract<GameEvent, { type: 'explosion' }>;
interface Column { x: number; z: number; until: number; rate: number; size: number; heat: number; acc: number; shade: number; cloud: number }
interface Glow { x: number; z: number; radius: number; color: number; intensity: number; born: number; life: number }
export interface BlastHost { particles: FxPool; shake(strength: number): void; roll?(strength: number): void; focus?(): { x: number; z: number } }

/** Spec 07 §8 budgets: smoke puffs 400 high / 120 low; fireball spheres; flame cards; ground light pools. */
const PUFFS = 400, PUFFS_LOW = 120, FIREBALLS = 48, FLAMES = 128, GLOWS = 40, PARTS = 12;
const wind = { x: .55, z: .25 };
const identity = new Matrix4();

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
  private readonly fireballs; private readonly fb;
  private readonly puffs; private readonly pf;
  private readonly flames; private readonly fl;
  private readonly glows; private readonly gl;
  private readonly parts: InstancedMesh;
  readonly scorch = new FxPool(64, 'ground');
  private readonly rng: Rng;
  private fbCursor = 0; private puffCursor = 0;
  private puffExpiry = new Float64Array(PUFFS); private fbExpiry = new Float64Array(FIREBALLS);
  private readonly columns: Column[] = [];
  private readonly fireColumns = new Map<number, Column>();
  private readonly cloudColumns = new Map<number, Column>();
  private readonly glowList: Glow[] = [];
  private readonly partMatrix = new Matrix4(); private readonly quat = new Quaternion(); private readonly pos = new Vector3(); private readonly scl = new Vector3();
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
    // Fireballs: origin(x,y,z,birth), params(size, life, delay, rise).
    const fbMaterial = new MeshBasicNodeMaterial();
    ({ mesh: this.fireballs, attrs: this.fb } = instanced(new SphereGeometry(1, 20, 14), fbMaterial, FIREBALLS, { fbOrigin: 4, fbParams: 4 }));
    {
      const o = attribute('fbOrigin', 'vec4'), prm = attribute('fbParams', 'vec4');
      const age = clock.sub(o.w).sub(prm.z), progress = age.div(prm.y.max(.001)).clamp(0, 1);
      const alive = age.greaterThanEqual(0).and(age.lessThan(prm.y)).select(1, 0);
      const seed = vec3(o.x.mul(1.7), o.z.mul(1.3), o.w.mul(5.1).fract().mul(10));
      fbMaterial.positionNode = Fn(() => {
        const grow = float(1).sub(float(1).sub(progress).pow(3)).mul(.85).add(.15);
        const bump = mx_noise_float(positionGeometry.mul(1.8).add(seed).add(vec3(0, clock.mul(-1.2), 0))).mul(.28).add(1);
        return o.xyz.add(vec3(0, prm.w.mul(progress), 0)).add(positionGeometry.mul(prm.x.mul(grow).mul(bump).mul(alive)));
      })();
      fbMaterial.outputNode = Fn(() => {
        const n = mx_noise_float(positionGeometry.mul(2.3).add(seed).add(vec3(0, clock.mul(-2), 0))).mul(.5).add(.5);
        n.lessThan(progress.mul(.95).sub(.05)).or(alive.lessThan(.5)).discard();
        const h = n.mul(float(1).sub(progress)).mul(1.4);
        const soot = vec3(.07, .055, .05), red = vec3(.85, .16, .04), orange = vec3(1, .45, .08), yellow = vec3(1, .82, .32), white = vec3(1, .97, .85);
        let c = mix(soot, red, smoothstep(.05, .2, h));
        c = mix(c, orange, smoothstep(.2, .42, h)); c = mix(c, yellow, smoothstep(.42, .7, h)); c = mix(c, white, smoothstep(.7, 1, h));
        // Self-occlusion: darker at the silhouette, glowing core facing the camera.
        const facing = normalView.z.abs().smoothstep(0, .8).mul(.5).add(.5);
        return vec4(c.mul(facing).mul(mix(1, 2.6, smoothstep(.25, .8, h))).mul(heat), 1);
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
        const sun = normalWorld.dot(vec3(.45, .78, .43)).mul(.5).add(.5);
        const base = vec3(st.w).mul(mix(.62, 1.12, sun));
        // Lit from below by the fire: low, young puffs glow orange on their undersides (spec 07 §6).
        const ember = st.z.mul(float(1).sub(progress).pow(2.5)).mul(smoothstep(4.5, .6, positionWorld.y)).mul(normalWorld.y.negate().mul(.35).add(.75));
        const color = mix(base, vec3(1, .42, .12).mul(1.2), ember.clamp(0, .6));
        const edge = normalView.z.abs().smoothstep(.05, .7);
        const grain = mx_noise_float(positionWorld.mul(.9).add(seed)).mul(.25).add(.85);
        const fade = age.div(.45).min(1).mul(float(1).sub(progress).pow(1.3));
        // Readability: smoke on the camera-to-player ray dims to ≤ 40 % (shared see-through hole).
        return vec4(color, edge.mul(grain).mul(fade).mul(.97).mul(alive).mul(mix(.38, 1, seeThroughHole(1.15))));
      })();
      this.puffs.renderOrder = 3;
    }
    // Flame cards: Y-billboards. origin(x,y,z,seed), style(width,height,intensity,unused).
    const flameMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const flameGeometry = new PlaneGeometry(1, 1); flameGeometry.translate(0, .5, 0);
    ({ mesh: this.flames, attrs: this.fl } = instanced(flameGeometry, flameMaterial, FLAMES, { fOrigin: 4, fStyle: 4 }));
    {
      const o = attribute('fOrigin', 'vec4'), st = attribute('fStyle', 'vec4');
      flameMaterial.positionNode = Fn(() => {
        const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz.mul(vec3(1, 0, 1)).normalize();
        const flicker = clock.mul(9).add(o.w.mul(6.3)).sin().mul(.12).add(1);
        return o.xyz.add(right.mul(positionGeometry.x.mul(st.x))).add(vec3(0, positionGeometry.y.mul(st.y).mul(flicker), 0));
      })();
      flameMaterial.outputNode = Fn(() => {
        const p = uv(), x = p.x.sub(.5).mul(2), y = p.y;
        const n = mx_noise_float(vec3(x.mul(2.2), y.mul(3).sub(clock.mul(3.2)), o.w.mul(7))).mul(.5).add(.5);
        const width = float(1).sub(y).pow(.75).mul(.85).add(n.mul(.22)).sub(.08);
        const mask = smoothstep(width, width.mul(.55), x.abs()).mul(smoothstep(1, .55, y.add(n.mul(.25)))).mul(smoothstep(0, .08, y));
        const core = mask.pow(2);
        const color = mix(vec3(.9, .2, .03), vec3(1, .7, .25), core).mul(mix(.85, 1.5, core)).mul(st.z).mul(heat);
        return vec4(color, mask.mul(st.w));
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
    // Detached doors/hood: charred panels following the sim bodies.
    this.parts = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshLambertNodeMaterial({ color: 0x2b2624 }), PARTS);
    this.parts.count = 0; this.parts.frustumCulled = false; this.parts.castShadow = true;
    this.add(this.scorch.mesh, this.glows, this.fireballs, this.puffs, this.flames, this.parts);
  }
  get flash(): number { return this.flashAt < 0 ? 0 : this.flashPeak * Math.max(0, 1 - (this.time - this.flashAt) / .16); }
  set(patch: { quality?: 'high' | 'low'; flashReduction?: boolean; slowMotion?: boolean }): void {
    if (patch.quality) { this.quality = patch.quality; this.puffs.count = patch.quality === 'low' ? PUFFS_LOW : PUFFS; }
    if (patch.flashReduction !== undefined) { this.flashReduction = patch.flashReduction; this.heat.value = patch.flashReduction ? .6 : 1; }
    if (patch.slowMotion !== undefined) { this.slowMotion = patch.slowMotion; if (!this.slowMotion) this.bullet.remaining = 0; }
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
    const { x, z } = event.position, r = event.radius, now = this.time, low = this.quality === 'low';
    // Beat 2 flash: screen flash (capped by flash reduction) + a strong, short ground light pool.
    this.flashPeak = Math.max(this.flash, this.flashReduction ? Math.min(.12, fx.flash) : fx.flash); this.flashAt = now;
    this.glow(x, z, r * 2.2, fx.light.color, (this.flashReduction ? .45 : 1) * Math.min(2.2, fx.light.intensity / 100), fx.light.seconds);
    // Beat 3 fireball: overlapping noise spheres around the centre, staggered by up to 0.12 s.
    const count = low ? Math.ceil(fx.fireball.count / 2) : fx.fireball.count;
    for (let i = 0; i < count; i++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.next() * fx.fireball.size * .55, size = fx.fireball.size * (.5 + this.rng.next() * .5);
      this.fireball(x + Math.cos(a) * d, .4 + this.rng.next() * fx.fireball.size * .5, z + Math.sin(a) * d, size, fx.fireball.seconds * (.75 + this.rng.next() * .5), i ? this.rng.next() * .12 : 0, fx.fireball.rise * (.6 + this.rng.next() * .6));
    }
    // Beat 4 shockwave: a ground dust ring pushing outward (the E15 ring wave draws the 2r ring).
    const dust = low ? Math.ceil(fx.dust / 3) : fx.dust;
    for (let i = 0; i < dust; i++) {
      const a = i / dust * Math.PI * 2 + this.rng.next() * .2, speed = r * (1.2 + this.rng.next() * .6);
      this.host.particles.spawn(now, .9 + this.rng.next() * .5, x + Math.cos(a) * .6, .25, z + Math.sin(a) * .6, Math.cos(a) * speed, .3 + this.rng.next() * .5, Math.sin(a) * speed, .5 + this.rng.next() * .5, 0, 0x8d7b68, .4);
    }
    // Beat 5 debris: bright spark streaks plus slower burning fragments.
    const sparks = low ? Math.ceil(fx.sparks / 4) : fx.sparks;
    for (let i = 0; i < sparks; i++) {
      const a = this.rng.next() * Math.PI * 2, out = 3 + this.rng.next() * r * 1.3, burning = i % 5 === 0;
      this.host.particles.spawn(now, burning ? 1.6 + this.rng.next() : .5 + this.rng.next() * .6, x, .8, z, Math.cos(a) * out, 4 + this.rng.next() * (burning ? 6 : 9), Math.sin(a) * out, burning ? .16 : .07, 0, burning ? 0xff7a26 : 0xffe9a8, 9.81);
    }
    // Beat 6 smoke column, beat 7 scorch decal (persists to the end of the level; independent of the gore setting).
    if (fx.smoke.seconds > 0) this.columns.push({ x, z, until: now + fx.smoke.seconds, rate: fx.smoke.rate * (low ? .5 : 1), size: fx.smoke.size, heat: fx.smoke.heat, acc: 2, shade: .17, cloud: 0 });
    if (fx.scorch > 0) this.scorch.spawn(now, 900, x, .014, z, this.rng.next() * Math.PI, 0, 0, r * fx.scorch * 2, 0, 0x16110f);
    // Camera: shake by size, Bruno's roll kick by distance from the focus.
    const focus = this.host.focus?.(), distance = focus ? Math.hypot(focus.x - x, focus.z - z) : 0;
    const near = Math.max(0, Math.min(1, 1 - (distance - 2) / (13 + r)));
    this.host.shake((this.flashReduction ? .3 : 1) * fx.shake * near);
    if (fx.roll) this.host.roll?.(fx.roll * near * (this.rng.next() < .5 ? -1 : 1));
  }
  private fireball(x: number, y: number, z: number, size: number, life: number, delay: number, rise: number): void {
    let slot = this.fbCursor++ % FIREBALLS;
    for (let n = 0; n < FIREBALLS && this.fbExpiry[slot] > this.time; n++) slot = this.fbCursor++ % FIREBALLS;
    this.fb.fbOrigin.setXYZW(slot, x, y, z, this.time); this.fb.fbParams.setXYZW(slot, size, life, delay, rise);
    this.fbExpiry[slot] = this.time + life + delay;
    this.fb.fbOrigin.needsUpdate = this.fb.fbParams.needsUpdate = true; this.fireballs.visible = true;
  }
  private puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size0: number, size1: number, heat: number, shade: number): void {
    const cap = this.puffs.count, slot = this.puffCursor++ % cap;
    this.pf.pOrigin.setXYZW(slot, x, y, z, this.time); this.pf.pMotion.setXYZW(slot, vx, vy, vz, life); this.pf.pStyle.setXYZW(slot, size0, size1, heat, shade);
    this.puffExpiry[slot] = this.time + life;
    this.pf.pOrigin.needsUpdate = this.pf.pMotion.needsUpdate = this.pf.pStyle.needsUpdate = true; this.puffs.visible = true;
  }
  private glow(x: number, z: number, radius: number, color: number, intensity: number, life: number): void {
    if (this.glowList.length >= 12) this.glowList.shift();
    this.glowList.push({ x, z, radius, color, intensity, born: this.time, life });
  }
  /** Explicit render clock (Vfx time). Columns emit puffs; fires refresh at 4 Hz from the sim. */
  advance(now: number, seconds: number): void {
    this.time = now; this.clock.value = now; this.scorch.advance(now);
    const tick = Math.floor(now * 4);
    if (tick !== this.flames4Hz) { this.flames4Hz = tick; this.syncSources(now); }
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i];
      if (now >= c.until) { this.columns.splice(i, 1); continue; }
      this.emit(c, seconds);
    }
    for (const c of this.fireColumns.values()) this.emit(c, seconds);
    for (const c of this.cloudColumns.values()) this.emit(c, seconds);
    this.writeFlamesAndGlows(now);
    this.syncParts();
    let fb = false, pf = false;
    for (let i = 0; i < FIREBALLS && !fb; i++) fb = this.fbExpiry[i] > now;
    for (let i = 0; i < this.puffs.count && !pf; i++) pf = this.puffExpiry[i] > now;
    this.fireballs.visible = fb; this.puffs.visible = pf;
  }
  private emit(c: Column, seconds: number): void {
    c.acc += c.rate * seconds;
    for (; c.acc >= 1; c.acc--) {
      const j = () => this.rng.next() - .5;
      if (c.cloud) {
        // Smoke grenade cloud: low, thick, slow, filling the authored radius.
        const a = this.rng.next() * Math.PI * 2, d = Math.sqrt(this.rng.next()) * c.cloud * .8;
        this.puff(c.x + Math.cos(a) * d, .4 + this.rng.next() * .8, c.z + Math.sin(a) * d, j() * .3, .18 + this.rng.next() * .2, j() * .3, 4 + this.rng.next() * 1.5, c.size * .45, c.size * (.9 + this.rng.next() * .35), 0, c.shade + j() * .08);
      } else this.puff(c.x + j() * .5 * c.size, .5 + this.rng.next() * .4, c.z + j() * .5 * c.size, j() * .3, 1.5 + this.rng.next() * .9, j() * .3, 7 + this.rng.next() * 2.5, c.size * .3, c.size * (.85 + this.rng.next() * .45), c.heat, c.shade + j() * .08);
    }
  }
  /** Fires, burning props/cars and smoke-grenade zones drive persistent emitters. */
  private syncSources(now: number): void {
    const seen = new Set<number>(), clouds = new Set<number>(), low = this.quality === 'low';
    for (const e of this.world.entities.iterate()) {
      const burningFire = e.hazard?.kind === 'fire' && this.world.tick < e.hazard.activeUntil;
      const burningProp = !!e.destructible && !e.destructible.broken && e.destructible.burningUntil > this.world.tick;
      const car = e.vehicle && (e.vehicle.damage === 'burning' || e.vehicle.damage === 'exploded');
      if (!burningFire && !burningProp && !car) continue;
      seen.add(e.id);
      let c = this.fireColumns.get(e.id);
      if (!c) { c = { x: e.transform.x, z: e.transform.z, until: Infinity, rate: (car ? 3 : 1.6) * (low ? .5 : 1), size: car ? 1.8 : 1.1, heat: 1, acc: this.rng.next(), shade: car ? .14 : .2, cloud: 0 }; this.fireColumns.set(e.id, c); }
      c.x = e.transform.x; c.z = e.transform.z;
    }
    for (const id of this.fireColumns.keys()) if (!seen.has(id)) this.fireColumns.delete(id);
    for (const zone of this.world.combat?.effects.zones ?? []) {
      if (zone.kind !== 'smoke' || zone.expires <= this.world.tick) continue;
      clouds.add(zone.created);
      if (!this.cloudColumns.has(zone.created)) this.cloudColumns.set(zone.created, { x: zone.x, z: zone.z, until: Infinity, rate: low ? 6 : 12, size: 2.2, heat: 0, acc: low ? 8 : 18, shade: .72, cloud: zone.radius });
    }
    for (const id of this.cloudColumns.keys()) if (!clouds.has(id)) this.cloudColumns.delete(id);
    void now;
  }
  /** Flame cards and light pools are rewritten every frame from the live sources (≤ 128 + 40 instances). */
  private writeFlamesAndGlows(now: number): void {
    let flames = 0, glows = 0;
    const flame = (x: number, y: number, z: number, seed: number, width: number, height: number, intensity: number) => {
      if (flames >= FLAMES) return;
      this.fl.fOrigin.setXYZW(flames, x, y, z, seed); this.fl.fStyle.setXYZW(flames, width, height, intensity, 1); flames++;
    };
    const pool = (x: number, z: number, radius: number, color: number, intensity: number) => {
      if (glows >= GLOWS) return;
      this.gl.gOrigin.setXYZW(glows, x, .03, z, radius);
      this.gl.gColor.setXYZW(glows, (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, intensity); glows++;
    };
    for (const [id, c] of this.fireColumns) {
      const e = this.world.entities.get(id); if (!e) continue;
      const big = !!e.vehicle, radius = e.hazard?.radius ?? (big ? 1.6 : .8), n = big ? 6 : Math.max(3, Math.round(radius * 3));
      const life = e.hazard ? Math.max(0, Math.min(1, (e.hazard.activeUntil - this.world.tick) / 120)) : 1;
      for (let i = 0; i < n; i++) {
        const a = id * 1.7 + i * 2.39996, d = (i === 0 ? 0 : radius * .55) * Math.sqrt((i + 1) / n);
        flame(c.x + Math.cos(a) * d, big ? .55 : .02, c.z + Math.sin(a) * d, id * .13 + i * .37, (big ? 1.1 : .75) * (.7 + .3 * ((i * 7) % 3)), (big ? 2.4 : 1.5) * (i === 0 ? 1.25 : .8) * (.4 + .6 * life), .8 + .4 * life);
      }
      pool(c.x, c.z, radius * 3.2, 0xff7a2a, (.55 + .1 * Math.sin(now * 13 + id)) * (.3 + .7 * life));
    }
    for (let i = this.glowList.length - 1; i >= 0; i--) {
      const g = this.glowList[i], k = (now - g.born) / g.life;
      if (k >= 1) { this.glowList.splice(i, 1); continue; }
      pool(g.x, g.z, g.radius, g.color, g.intensity * (1 - k) ** 2);
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
      this.partMatrix.compose(this.pos.set(t.x, t.y, t.z), this.quat.set(q.x, q.y, q.z, q.w), this.scl.set(part.half[0] * 2, part.half[1] * 2, part.half[2] * 2));
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
    this.fireball(x, 1, z, 1, .5, 0, 0); this.puff(x, 1, z, 0, 0, 0, 1, 1, 1, .5, .3);
    this.fl.fOrigin.setXYZW(0, x, 0, z, 0); this.fl.fStyle.setXYZW(0, 1, 1, 1, 1); this.flames.count = 1; this.flames.visible = true;
    this.gl.gOrigin.setXYZW(0, x, .03, z, 1); this.gl.gColor.setXYZW(0, 1, .5, .2, 1); this.glows.count = 1; this.glows.visible = true;
    this.fl.fOrigin.needsUpdate = this.fl.fStyle.needsUpdate = this.gl.gOrigin.needsUpdate = this.gl.gColor.needsUpdate = true;
    this.scorch.spawn(this.time, 1, x, .014, z, 0, 0, 0, 1, 0, 0x16110f);
    this.partMatrix.makeTranslation(x, 1, z); this.parts.setMatrixAt(0, this.partMatrix); this.parts.count = 1;
  }
  reset(): void {
    this.fbExpiry.fill(0); this.puffExpiry.fill(0); this.columns.length = 0; this.fireColumns.clear(); this.cloudColumns.clear(); this.glowList.length = 0;
    for (const attr of [this.fb.fbParams, this.pf.pMotion]) { attr.array.fill(0); attr.needsUpdate = true; }
    this.scorch.reset(this.time); this.fireballs.visible = this.puffs.visible = this.flames.visible = this.glows.visible = false; this.parts.count = 0;
    this.glowCount = 0; this.flashAt = -1; this.bullet = { scale: 1, remaining: 0, progress: 0 }; this.fl.fStyle.array.fill(0); this.gl.gOrigin.array.fill(0);
  }
  snapshot() {
    let puffs = 0, fireballs = 0;
    for (let i = 0; i < this.puffs.count; i++) if (this.puffExpiry[i] > this.time) puffs++;
    for (let i = 0; i < FIREBALLS; i++) if (this.fbExpiry[i] > this.time) fireballs++;
    return { blasts: this.blasts, puffs, puffCap: this.puffs.count, fireballs, fireballCap: FIREBALLS, flames: this.flames.visible ? this.flames.count : 0, glows: this.glows.visible ? this.glows.count : 0,
      columns: this.columns.length + this.fireColumns.size, clouds: this.cloudColumns.size, scorch: this.scorch.count, parts: this.parts.count, flash: this.flash, bulletTime: { ...this.bullet }, slowMotion: this.slowMotion };
  }
  dispose(): void {
    this.reset(); this.scorch.dispose();
    for (const mesh of [this.fireballs, this.puffs, this.flames, this.glows, this.parts]) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); }
    this.clear();
  }
}
export type { BlastFxPreset };
