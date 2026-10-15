import { Group, type BufferGeometry, type Node } from 'three/webgpu';
import { Rng } from '../../core/Rng';
import { infectedDef } from '../../data/infected';
import type { ActionDef } from '../../data/actions/schema';
import { catalog, mountedActions } from '../../data/actions/catalog';
import type { EffectKind, TelegraphKind, GameEvent } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { FxPool, tracerLaunchS } from './FxPool';
import { GibPool } from './GibPool';
import type { VehicleFeedbackEvent } from './VehicleFeedback';
import { HitStop } from './HitStop';
import { Blasts } from './Blasts';
/** Mounted guns (the L10 rotary minigun) draw the same tracer and muzzle as a carried gun. */
const actions: Readonly<Record<string, ActionDef>> = { ...catalog, ...mountedActions };

export type Gore = 'Full' | 'Reduced' | 'Off';
export type { EffectKind, TelegraphKind } from '../../sim/world/types';
export interface VfxSettings { vfx?: boolean; gore?: Gore; flashReduction?: boolean; colorblind?: boolean; quality?: 'high' | 'low'; slowMotion?: boolean }
export interface VfxTargets {
  camera?(): import('three').Camera;
  /** Resolve and pose the rendered gun synchronously at the shot tick. */
  muzzle?(id: number, direction: { x: number; y?: number; z: number }): { x: number; y: number; z: number } | null;
  /** Drawn spout of a pouring watering can (gardener routine), null when none. */
  spout?(id: number): { x: number; y: number; z: number } | null;
  flash(id: number, strength: number): void;
  detach(id: number, limb: number): { x: number; y: number; z: number } | void;
  blood(coverage: number): void;
  vehicle?(event: VehicleFeedbackEvent, bloodEnabled: boolean): void;
  vehicleBloodEnabled?(enabled: boolean): void;
  clearGore(): void;
  shake(strength: number): void;
  /** E27 camera roll kick (Bruno View.roll.kick) and the follow focus used for distance falloff. */
  roll?(strength: number): void;
  focus?(): { x: number; z: number };
  /** E25 light field transient pools (fires, blast flashes, mega tint). */
  light?: import('./Blasts').BlastLight;
  /** Shared practical-light radiance for smoke, including powered strobes. */
  field?: import('../LightField').LightField;
  ambient?: Node<'float'>;
  sunDirection?(): { x: number; y: number; z: number };
}
const eventTypes = ['ally.attack', 'combat.hit', 'combat.kill', 'combat.attack', 'combat.exploded', 'combat.effect', 'combat.hit-stop', 'telegraph', 'infected.special', 'attack.resolved', 'vfx.effect', 'vehicle.feedback', 'hazard.exploded', 'hazard.electrified', 'prop.ignited', 'vehicle.exploded', 'noise', 'pickup.collected', 'explosion', 'explosion.slowmo', 'outbreak.infection'] as const;
const limbs = 5;
const heavyBlade = /machete|axe|katana|shovel/;
const telegraphShapes = { lunge: 3, charge: 2, splash: 1, bloated: 4 } as const;
const effectColors = { fire: 0xff923a, smoke: 0x665f73, toxic: 0x96d354, objective: 0xffe18e, pickup: 0x84e7ff, ash: 0xbcb0c8, 'vehicle-smoke': 0x535360, 'vehicle-fire': 0xff8c32 } as const;
/** Event-driven view. All randomness, time, masks and bodies belong here, outside simulation.
 * Infrastructure presets deliberately leave E27's seven-beat choreography to E27. */
export class Vfx extends Group {
  readonly particles = new FxPool(2048, 'particle');
  readonly decals = new FxPool(600, 'ground', undefined, true);
  readonly surfaceSplats = new FxPool(64, 'wall', undefined, true);
  readonly telegraphs = new FxPool(256, 'ground');
  readonly waves = new FxPool(16, 'ground');
  readonly gibs: GibPool;
  readonly hitStop = new HitStop();
  /** E27 seven-beat blasts, fires, smoke columns/clouds, car parts and bullet time. */
  readonly blasts: Blasts;
  private readonly e15Blast = { tick: -1, x: 0, z: 0 };
  private readonly rng: Rng;
  private readonly goreRng: Rng;
  private flashUntil = 0;
  private flashNear = 1;
  /** One reusable edge feather veil: no stacking, central player and HUD stay clear. */
  private readonly featherVeil = typeof document === 'undefined' ? null : document.createElement('div');
  private obstruction = { remainingTicks: 0, opacity: 0 };
  private readonly pools = [this.particles, this.decals, this.surfaceSplats, this.telegraphs, this.waves];
  private readonly landings = Array.from({ length: 384 }, () => ({ at: Infinity, x: 0, y: 0, z: 0, size: 0, color: 0 }));
  private landingCursor = 0;
  private lastSpray = { actionId: '', direction: { x: 1, z: 0 }, droplets: 0, chunks: 0, gravity: 9.81 };
  private readonly stops: (() => void)[] = [];
  private readonly tells = new Map<number, { slot: number; kind: TelegraphKind; spawned: number; sourceId?: number }>();
  private readonly hitIds = new Uint32Array(512);
  private readonly hitUntil = new Float64Array(512);
  private hitCount = 0;
  private hitCursor = 0;
  private readonly vehicles = new Map<number, VehicleFeedbackEvent>();
  private enabled = true;
  private colorblind = false;
  private gore: Gore = 'Full';
  private flashReduction = false;
  private quality: 'high' | 'low' = 'high';
  time = 0;
  coverage = 0;
  detached = 0;
  dismemberedKills = 0;
  kills = 0;
  lastExplosionRadius = 0;
  private readonly tracerRounds = new WeakMap<object, number>();
  readonly shots: { sourceId: number; tick: number; muzzle: number[]; tracerStart: number[]; end: number[] }[] = [];
  private gunshot(sourceId: number, direction: { x: number; z: number }, range: number, fallback: { x: number; z: number }, targetId?: number, dust?: 'hit' | 'miss'): void {
    const source = this.world.entities.get(sourceId), target = targetId === undefined ? undefined : this.world.entities.get(targetId);
    const muzzle = this.targets.muzzle?.(sourceId, { ...direction, y: target && source ? (target.transform.y - source.transform.y) / range : 0 }) ?? { x: fallback.x, y: (source?.transform.y ?? .7) + .45, z: fallback.z };
    // Descend from the actual rifle tip to the victim's torso, using the same 3D cover slabs as damage.
    if (target) {
      const dx = target.transform.x - muzzle.x, dz = target.transform.z - muzzle.z;
      range = Math.hypot(dx, dz) || 1; direction = { x: dx / range, z: dz / range };
    }
    const slope = target ? (target.transform.y + .45 - muzzle.y) / range : 0;
    const ray = { ...direction, y: slope };
    if (!this.enabled) return; // The firing pose is independent of the user's particle preference.
    let distance = this.world.combat?.query.clearDistance(muzzle, ray, range) ?? range;
    // Player shots carry a ray rather than a victim id. Stop the visual at the
    // first body on that ray as well as cover, without changing projectile damage.
    const hit = target ?? (sourceId === 1 ? this.world.combat?.query.ray(sourceId, muzzle, ray, distance) : null);
    if (hit) distance = Math.min(distance, Math.max(0, (hit.transform.x - muzzle.x) * direction.x + (hit.transform.z - muzzle.z) * direction.z));
    const start = [muzzle.x, muzzle.y, muzzle.z];
    this.shots.push({ sourceId, tick: this.world.tick, muzzle: start, tracerStart: [...start], end: [muzzle.x + direction.x * distance, muzzle.y + slope * distance, muzzle.z + direction.z * distance] });
    if (this.shots.length > 64) this.shots.shift();
    this.burst(muzzle.x, muzzle.y, muzzle.z, 0xfff1b8, 8, .3, .12, 0);
    this.particles.spawn(this.time, .1, muzzle.x, muzzle.y, muzzle.z, 0, 0, 0, .75, 0, 0xffffff);
    // Presentation-only cadence per shooter; entity keys disappear on level unload.
    const round = source ? this.tracerRounds.get(source) ?? 0 : 0;
    if (source) this.tracerRounds.set(source, round + 1);
    if ((sourceId === 1 || round % 3 === 0) && distance > .01) {
      const rayLength = Math.hypot(1, slope), speed = 320 / rayLength;
      this.particles.spawn(this.time, distance / speed + tracerLaunchS, muzzle.x, muzzle.y, muzzle.z,
        direction.x * speed, slope * speed, direction.z * speed, 1, 11, 0xffce78, distance * rayLength, .065);
    }
    if (!dust) return;
    // ally-combat-feel: an ejected brass glint beside the shooter, and a dust puff where a miss (or cover) stops the round.
    this.particles.spawn(this.time, .35, muzzle.x - direction.z * .25, muzzle.y - .1, muzzle.z + direction.x * .25, -direction.z * 1.2, 1.4, direction.x * 1.2, .07, 0, 0xd8b45a, 9.81);
    if (dust === 'miss' || distance < range - .3) this.burst(muzzle.x + direction.x * distance, Math.max(.08, muzzle.y + slope * distance - .5), muzzle.z + direction.z * distance, 0xb9ab8e, 6, .22, .55, 1.5);
  }
  constructor(private readonly world: SimWorld, private readonly targets: VfxTargets, geometries?: { limb: BufferGeometry; head: BufferGeometry }) {
    super();
    if (this.featherVeil) {
      this.featherVeil.dataset.testid = 'flamingo-feathers';
      this.featherVeil.setAttribute('aria-hidden', 'true');
      this.featherVeil.style.cssText = 'position:fixed;inset:8% 0 18%;pointer-events:none;z-index:2;opacity:0;background:repeating-conic-gradient(from 15deg at 0% 50%,#ef9fc1 0deg 8deg,transparent 8deg 25deg);mask-image:radial-gradient(ellipse at center,transparent 0 38%,black 78%);';
      document.querySelector('#game')?.append(this.featherVeil);
    }
    this.rng = new Rng(world.seed, 'vfx'); this.goreRng = new Rng(world.seed, 'dismemberment');
    this.gibs = new GibPool(geometries);
    this.blasts = new Blasts(world, { camera: targets.camera, particles: this.particles, shake: s => targets.shake(s), roll: s => targets.roll?.(s), focus: () => targets.focus?.() ?? world.entities.get(1)?.transform ?? { x: 0, z: 0 }, light: (...args) => targets.light?.(...args) ?? null, field: targets.field, ambient: targets.ambient, sunDirection: targets.sunDirection });
    this.add(this.blasts, this.gibs.heads, this.particles.mesh, this.decals.mesh, this.surfaceSplats.mesh, this.telegraphs.mesh, this.waves.mesh, this.gibs.mesh);
    for (const type of eventTypes) this.stops.push(world.events.on(type, this.receive));
  }
  /** Exercise visible pooled geometry during loading; restore empty slots without sim events. */
  prewarm(x: number, z: number): () => void {
    for (const pool of this.pools) pool.spawn(this.time, 1, x, pool.mode === 'particle' ? 1 : .03, z, 0, 0, 0, 2, 0, 0xffffff);
    this.blasts.prewarm(x, z);
    return () => this.resetPools();
  }
  set(patch: VfxSettings): void {
    if (patch.gore !== undefined && !['Full', 'Reduced', 'Off'].includes(patch.gore)) throw new RangeError('Invalid gore setting');
    if (patch.quality !== undefined && !['high', 'low'].includes(patch.quality)) throw new RangeError('Invalid VFX quality');
    if (patch.colorblind !== undefined) {
      this.colorblind = patch.colorblind;
      for (const tell of this.tells.values()) this.telegraphs.recolor(tell.slot, this.telegraphColor(tell.kind));
    }
    if (patch.vfx !== undefined) this.enabled = patch.vfx;
    if (patch.flashReduction !== undefined) this.flashReduction = patch.flashReduction;
    this.blasts.set(patch);
    if (patch.quality !== undefined && patch.quality !== this.quality) { this.quality = patch.quality; this.gibs.setQuality(this.quality); this.particles.reset(this.time); this.particles.budget = this.quality === 'low' ? 512 : 2048; this.particles.mesh.count = this.particles.budget; }
    if (patch.gore !== undefined && patch.gore !== this.gore) {
      this.gore = patch.gore; this.particles.reset(this.time); this.decals.reset(this.time); this.surfaceSplats.reset(this.time); for (const landing of this.landings) landing.at = Infinity; this.gibs.reset(); this.targets.clearGore();
      if (this.gore === 'Off') { this.coverage = 0; this.targets.blood(0); }
    }
    this.targets.vehicleBloodEnabled?.(this.enabled && this.gore !== 'Off');
    this.visible = this.enabled || this.tells.size > 0;
    if (!this.enabled) {
      this.hitStop.reset(); this.targets.clearGore(); this.targets.blood(0);
      for (let i = 0; i < this.hitCount; i++) this.targets.flash(this.hitIds[i], 0);
      this.resetPools(true); for (const landing of this.landings) landing.at = Infinity;
    } else this.targets.blood(this.gore === 'Off' ? 0 : this.coverage);
  }
  private telegraphColor(kind: TelegraphKind): number { return this.colorblind ? kind === 'bloated' ? 0xffb347 : 0xffffff : kind === 'bloated' ? 0xffe45b : 0x59e8ff; }
  private resetPools(preserveTelegraphs = false): void { this.blasts.reset(); for (const pool of this.pools) if (!preserveTelegraphs || pool !== this.telegraphs) pool.reset(this.time); this.gibs.reset(); if (!preserveTelegraphs) this.tells.clear(); this.hitCount = this.hitCursor = 0; }
  private pulse(id: number): void {
    let slot = 0;
    while (slot < this.hitCount && this.hitIds[slot] !== id) slot++;
    if (slot === this.hitCount) {
      if (this.hitCount < this.hitIds.length) this.hitCount++;
      else { slot = this.hitCursor++ % this.hitIds.length; this.targets.flash(this.hitIds[slot], 0); }
    }
    this.hitIds[slot] = id; this.hitUntil[slot] = this.time + 0.1; this.targets.flash(id, 0.45);
  }
  private burst(x: number, y: number, z: number, color: number, count: number, size = 0.18, life = 0.7, gravity = 9.81): void {
    const n = this.quality === 'low' ? Math.ceil(count / 4) : count;
    for (let i = 0; i < n; i++) this.particles.spawn(this.time, life, x, y, z, (this.rng.next() - 0.5) * 4, this.rng.next() * 3, (this.rng.next() - 0.5) * 4, size, 0, color, gravity);
  }
  /** Slow, rising ash-green wisps around a body (render RNG only). */
  private sickPuff(x: number, z: number, count: number, size: number, y: number): void {
    const n = this.quality === 'low' ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const a = this.rng.next() * Math.PI * 2, r = .25 + this.rng.next() * .35;
      this.particles.spawn(this.time, .9 + this.rng.next() * .5, x + Math.cos(a) * r, y + this.rng.next() * .6, z + Math.sin(a) * r, Math.cos(a) * .5, .5 + this.rng.next() * .7, Math.sin(a) * .5, size * (.7 + this.rng.next() * .6), 0, 0x9fc46a, -.4);
    }
  }
  private blood(event: Extract<GameEvent, { type: 'combat.hit' | 'combat.kill' }>, kill: boolean): void {
    const { x, z } = event.position, source = this.world.entities.get(event.sourceId);
    const dx = event.direction?.x ?? x - (source?.transform.x ?? x - 1), dz = event.direction?.z ?? z - (source?.transform.z ?? z);
    const length = Math.hypot(dx, dz) || 1, direction = { x: dx / length, z: dz / length };
    const heavy = event.actionId === 'weapon.kick' || (event.knockback ?? 0) >= .9 || event.amount >= 30;
    // A hull ram downs a whole group in a few frames: 48 droplets each made a speckle cloud of hundreds of dots at night
    // (QA L9-Q1, l9-enc-shortcut-ram f240-f300). Rams keep a short heavy splash; the ground decals carry the impact.
    const count = event.damageType === 'vehicle' ? 10 : kill ? 48 : event.actionId === 'weapon.fists' ? 12 : heavy ? 40 : event.actionId === 'weapon.bat' ? 32 : event.actionId === 'weapon.crowbar' ? 28 : 24;
    const n = this.gore === 'Off' ? 6 : Math.ceil(count / (this.quality === 'low' ? 4 : this.gore === 'Reduced' ? 2 : 1));
    const color = this.gore === 'Off' ? 0x776c75 : this.colorblind ? 0xffba48 : 0xe3293c;
    // Blood leaves the body where it stands: on the L3 ramp or deck that is the support height, not the street (y 0).
    const victim = this.world.entities.get(event.targetId), base = this.world.districts?.supportBelow(x, z, (victim?.transform.y ?? .7) - .7) ?? 0;
    let chunks = 0;
    for (let i = 0; i < n; i++) {
      const chunk = this.gore === 'Full' && (heavy || kill) && i < (kill ? 4 : 2); if (chunk) chunks++;
      const spread = (this.rng.next() - .5) * (heavy ? 3 : 2), speed = (heavy ? 4.5 : 3) + this.rng.next() * 3;
      const vx = direction.x * speed - direction.z * spread, vz = direction.z * speed + direction.x * spread;
      const vy = 2.3 + this.rng.next() * (heavy ? 2.3 : 1.7), y = 1.1 + this.rng.next() * .25; // height above the support
      const landingTime = (vy + Math.sqrt(vy * vy + 2 * 9.81 * y)) / 9.81;
      const dropletSize = event.actionId === 'weapon.fists' ? .055 : heavy ? .13 : event.actionId === 'weapon.machete' ? .085 : .11;
      const size = chunk ? .17 + this.rng.next() * .08 : dropletSize + this.rng.next() * .055;
      this.particles.spawn(this.time, landingTime, x, base + y, z, vx, vy, vz, size, 0, color, 9.81);
      if (this.gore !== 'Off' && i % (this.quality === 'low' ? 2 : 5) === 0) {
        const landing = this.landings[this.landingCursor++ % this.landings.length];
        landing.at = this.time + landingTime; landing.x = x + vx * landingTime; landing.z = z + vz * landingTime; landing.y = this.world.districts?.supportBelow(landing.x, landing.z, base) ?? 0; landing.size = chunk ? .5 : .18 + this.rng.next() * .15; landing.color = color;
      }
    }
    this.lastSpray = { actionId: event.actionId, direction, droplets: n - chunks, chunks, gravity: 9.81 };
    if (this.gore !== 'Off') {
      this.decals.spawn(this.time, 18, x, base + .016, z, this.rng.next() * Math.PI, 0, 0, kill ? 1.1 : .35, this.colorblind ? 0 : kill ? 6 : 5, color);
      const distance = this.world.combat?.query.clearDistance({ x, z }, direction, 1.8) ?? 1.8;
      if (distance < 1.75) this.surfaceSplats.spawn(this.time, 12, x + direction.x * Math.max(0, distance - .025), base + .8, z + direction.z * Math.max(0, distance - .025), Math.atan2(direction.z, direction.x) + Math.PI / 2, 0, 0, heavy ? .8 : .45, this.colorblind ? 0 : 5, color);
    }
  }
  readonly receive = (event: GameEvent): void => {
    if (event.type === 'vehicle.feedback') {
      let vehicle = this.vehicles.get(event.id);
      if (!vehicle) { vehicle = { ...event, position: { ...event.position } }; this.vehicles.set(event.id, vehicle); }
      else { vehicle.floor = event.floor; vehicle.healthFraction = event.healthFraction; vehicle.blood = event.blood; vehicle.position.x = event.position.x; vehicle.position.z = event.position.z; vehicle.yaw = event.yaw; }
      this.targets.vehicle?.(vehicle, this.enabled && this.gore !== 'Off');
    }
    if (event.type === 'explosion.slowmo') { this.blasts.slowmo(event); return; }
    if (!this.enabled && !(event.type === 'telegraph' && 'move' in event && event.move) && event.type !== 'infected.special' && event.type !== 'attack.resolved') {
      if (event.type === 'combat.attack' && actions[event.actionId]?.category === 'ranged') this.gunshot(event.sourceId, event.direction, actions[event.actionId].range, event.position);
      else if (event.type === 'ally.attack' && event.from && event.to) {
        const dx = event.to.x - event.from.x, dz = event.to.z - event.from.z, distance = Math.hypot(dx, dz) || 1;
        this.gunshot(event.sourceId, { x: dx / distance, z: dz / distance }, distance, event.from, event.targetId);
      }
      return;
    }
    if ((event.type === 'combat.hit' || event.type === 'combat.kill') && event.actionId === 'cure') return;
    if (event.type === 'combat.hit' || event.type === 'combat.kill') { const target = this.world.entities.get(event.targetId); if (target?.faction === 'environment' || target?.vehicle) return; }
    if (event.type === 'combat.hit' && event.amount > 0) {
      this.blood(event, false);
      if (event.damageType === 'melee' && event.sourceId === 1) this.targets.shake(this.flashReduction ? .012 : event.actionId === 'weapon.kick' || event.amount >= 30 ? .055 : .028);
      this.pulse(event.targetId);
    } else if (event.type === 'combat.kill') {
      // A knocked-down infected (PO "Infected recover") bleeds like a hard hit, without the kill pool or lost limbs: it gets up again.
      const down = event.downed !== undefined;
      this.kills++; this.blood(event, !down);
      const def = actions[event.actionId], melee = def?.category === 'melee';
      if (melee && this.gore !== 'Off' && event.sourceId === 1) { this.coverage = Math.min(1, this.coverage + 0.025); this.targets.blood(this.coverage); }
      const explosive = Boolean(def?.splash) && def?.effect?.kind !== 'fire' || event.actionId.includes('explos') || event.actionId.includes('rocket');
      const heavy = heavyBlade.test(event.actionId);
      const shotgun = event.actionId.includes('shotgun') && Math.hypot(event.position.x - (this.world.entities.get(event.sourceId)?.transform.x ?? 0), event.position.z - (this.world.entities.get(event.sourceId)?.transform.z ?? 0)) <= 3;
      const vehicle = event.cause === 'vehicle' || event.actionId === 'vehicle.high-speed';
      if (vehicle) { const car = this.world.vehicles?.cars.get(event.sourceId); if (car) this.updateVehicle(car.entity.id, Math.min(1, (this.vehicles.get(car.entity.id)?.blood ?? 0) + .08)); }
      // Draw on every eligible kill, independent of the gore toggle; never consume the sim RNG.
      const detach = !down && (explosive || shotgun || vehicle || heavy && this.goreRng.next() < 0.35);
      if (this.gore === 'Full' && detach) {
        this.dismemberedKills++;
        const n = explosive ? limbs : 1, first = Math.floor(this.rng.next() * limbs);
        for (let i = 0; i < n; i++) {
          const limb = explosive ? i : first, position = this.targets.detach(event.targetId, limb); this.detached++;
          this.gibs.spawn(this.time, position?.x ?? event.position.x, position?.y ?? 1, position?.z ?? event.position.z, this.rng, limb === 4);
        }
        if (explosive) for (let i = 0; i < 3; i++) this.gibs.spawn(this.time, event.position.x, 0.7, event.position.z, this.rng);
        this.burst(event.position.x, 1, event.position.z, 0xb3121f, 24, 0.18, 1.2);
      }
    } else if (event.type === 'combat.hit-stop') this.hitStop.hit(this.time, event.durationMs / 1000);
    else if (event.type === 'combat.attack') {
      const def = actions[event.actionId];
      // Bat/axe roundhouse: a quick ground swoosh at the sweep radius under the spinning trail.
      if (event.style === 'roundhouse') this.waves.spawn(this.time, .32, event.position.x, .03, event.position.z, 0, 0, 0, (def?.roundhouse?.radius ?? 2.2) * 2, 1, 0xfff0ba, 1);
      if (def?.category === 'ranged') {
        this.gunshot(event.sourceId, event.direction, def.range, event.position);
        if (event.sourceId === 1 && event.actionId === 'weapon.shotgun') this.targets.shake(this.flashReduction ? .025 : .1);
      }
    } else if (event.type === 'ally.attack' && event.from && event.to) {
      const dx = event.to.x - event.from.x, dz = event.to.z - event.from.z, distance = Math.hypot(dx, dz) || 1;
      this.gunshot(event.sourceId, { x: dx / distance, z: dz / distance }, distance, event.from, event.targetId, event.role === 'tank' || event.role === 'heli' ? undefined : event.hit === false ? 'miss' : 'hit');
    } else if (event.type === 'combat.exploded') {
      if (event.radius > 0) this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius);
    } else if (event.type === 'explosion') {
      this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius); this.blasts.play(event);
    } else if (event.type === 'combat.effect') {
      if (event.kind === 'fire' || event.kind === 'smoke') this.effect(event.kind, event.position.x, event.position.z, event.radius);
    } else if (event.type === 'infected.special') {
      // Sim stepping can activate a move before the next render update.
      const tell = this.tells.get(event.attackId);
      if (tell) { this.telegraphs.remove(tell.slot); this.tells.delete(event.attackId); }
    } else if (event.type === 'telegraph') {
      if (this.tells.has(event.attackId)) return;
      // A source has one current attack. Retire its previous tell synchronously,
      // including paused sim stepping that can run many attacks between render frames.
      if (event.sourceId !== undefined) for (const [id,tell] of this.tells) if(tell.sourceId===event.sourceId){this.telegraphs.remove(tell.slot);this.tells.delete(id);}

      const source = event.sourceId !== undefined ? this.world.entities.get(event.sourceId) : undefined;
      const kind: TelegraphKind = source?.infected?.pursuit && 'move' in event && event.move === 'alpha.grab-throw' ? 'splash' : 'kind' in event ? event.kind : event.special === 'explode' ? 'bloated' : event.special === 'charge' || event.special === 'pin' || event.special === 'alpha.grab-throw' || event.special === 'gorilla.grab-throw' || event.special === 'elephant.charge' || event.special === 'zebra.stampede' ? 'charge' : event.special === 'aura' || event.special === 'alpha.roar' || event.special === 'gorilla.roar' || event.special === 'gorilla.pound' || event.special === 'flamingo.dive' ? 'splash' : 'lunge';
      const throwing = !source?.infected?.pursuit && 'move' in event && (event.move === 'alpha.grab-throw' || event.move === 'gorilla.grab-throw') && event.area && event.target;
      const length = throwing ? Math.min(15, Math.hypot(event.target!.x - event.area!.x, event.target!.z - event.area!.z)) : 0;
      const position = throwing ? { x: event.area!.x + event.area!.dx * length / 2, z: event.area!.z + event.area!.dz * length / 2 } : 'position' in event ? event.position : event.area ?? source?.transform;
      if (!position) return;
      const radius = throwing ? Math.max(1, length / 2) : 'radius' in event ? event.radius : event.area?.radius ?? (kind === 'bloated' || kind === 'splash' ? 3 : source ? Math.max(this.world.missions?.def.l1 ? 1 : 2, infectedDef(source.archetype).range) : 2);
      const angle = 'move' in event && (event.move === 'elephant.swipe' || event.move === 'elephant.charge' || event.move === 'gorilla.grab-throw' || event.move === 'zebra.kick' || event.move === 'zebra.stampede') ? Math.atan2(event.area?.dz ?? 0, event.area?.dx ?? 1) : 'angle' in event ? event.angle : -Math.atan2(event.area?.dz ?? source?.infected?.dz ?? 0, event.area?.dx ?? source?.infected?.dx ?? 1);
      const shape = 'move' in event && event.move === 'zebra.kick' ? 10 : 'move' in event && event.move === 'elephant.swipe' ? 9 : 'move' in event && (event.move === 'alpha.roar' || event.move === 'gorilla.roar') ? 8 : telegraphShapes[kind];
      const slot = this.telegraphs.spawn(this.time, 1e9, position.x, 0.025, position.z, angle, 0, 0, radius * 2, shape, this.telegraphColor(kind), 0, throwing ? 1 / radius : kind === 'charge' ? 0.3 : 1, true);
      if (slot < 0) return;
      this.visible = true;
      this.tells.set(event.attackId, { slot, kind, spawned: this.time, ...(event.sourceId !== undefined ? { sourceId: event.sourceId } : {}) });
    } else if (event.type === 'attack.resolved') {
      const tell = this.tells.get(event.attackId); if (tell) { this.telegraphs.remove(tell.slot); this.tells.delete(event.attackId); }
    } else if (event.type === 'hazard.exploded') this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius);
    else if (event.type === 'vehicle.exploded') {
      const car = this.world.vehicles?.cars.get(event.sourceId), p = this.world.entities.get(event.sourceId)?.transform, def = car?.physics.def;
      const height = car?.entity.vehicle?.scripted && def && p ? p.y - (def.suspension + def.wheelRadius + .15) + .7 : undefined;
      if (p) this.explosionOnce(event.tick, p.x, p.z, 6, height);
    }
    else if (event.type === 'noise' && event.kind === 'scream') this.effect('screamer', event.position.x, event.position.z, event.radius);
    else if (event.type === 'hazard.electrified' || event.type === 'prop.ignited') { const p = this.world.entities.get(event.id)?.transform; if (p) this.effect(event.type === 'hazard.electrified' ? 'electric' : 'fire', p.x, p.z, 1); }
    // E19 section 5.7: the turning reads at the game camera - sickly wisps when the eyes ignite, a puff as the person rises.
    else if (event.type === 'outbreak.infection' && (event.phase === 'eyes' || event.phase === 'rise')) {
      const p = this.world.entities.get(event.entityId)?.transform, rise = event.phase === 'rise';
      if (p) this.sickPuff(p.x, p.z, rise ? 18 : 10, rise ? .2 : .14, rise ? .7 : .3);
    }
    else if (event.type === 'pickup.collected') { const e = this.world.entities.get('id' in event ? event.id : event.sourceId); if (e) this.effect('pickup', e.transform.x, e.transform.z, 1); }
    else if (event.type === 'vfx.effect') this.effect(event.kind, event.position.x, event.position.z, event.radius, event.position.y);
  };
  private updateVehicle(id: number, blood = this.vehicles.get(id)?.blood ?? 0): void {
    const e = this.world.entities.get(id); if (!e?.vehicle) return;
    this.receive({ tick: this.world.tick, type: 'vehicle.feedback', id, position: { x: e.transform.x, z: e.transform.z }, yaw: e.transform.yaw, healthFraction: e.health.current / e.health.max, blood, ...(e.vehicle.floor ? { floor: true } : {}) });
  }
  /** One E15 base burst per blast: legacy hazard/combat/vehicle events and the E27 explosion event arrive together. */
  private explosionOnce(tick: number, x: number, z: number, radius: number, height = .7): void {
    const last = this.e15Blast;
    if (last.tick === tick && Math.hypot(last.x - x, last.z - z) < .75) return;
    last.tick = tick; last.x = x; last.z = z; this.effect('explosion', x, z, radius, height);
  }
  /** Radius is in metres. Shockwave max diameter is exactly 2 × splash radius. */
  effect(kind: EffectKind, x: number, z: number, radius = 2, height = .7): void {
    if (!this.enabled) return;
    if (kind === 'explosion') {
      const ground = height < 0 ? height - .7 : 0;
      // The white-out belongs to a blast near the player (as in Blasts.play): a distant fuel chain or tank round flashed the whole
      // screen white for 0.1 s at any distance (gate 10-13: the L4 line break washed out the walk on Kessler Lane, 60 m away).
      const focus = this.targets.focus?.() ?? this.world.entities.get(1)?.transform, near = focus ? Math.max(0, Math.min(1, 1.4 - Math.hypot(focus.x - x, focus.z - z) / 18)) : 1;
      this.lastExplosionRadius = radius; if (near > 0) { this.flashUntil = this.time + 0.1; this.flashNear = near; }
      this.waves.spawn(this.time, 0.8, x, ground + 0.035, z, 0, 0, 0, radius * 2, 1, 0xffe19a, 1);
      this.burst(x, ground + 1, z, 0xff8c32, 64, radius * 0.3, 0.65, 2);
      this.burst(x, ground + 0.8, z, 0x685866, 32, radius * 0.4, 2, -0.5);
      this.burst(x, ground + 0.3, z, 0xb09b85, 16, 0.13, 1.6);
      if (this.gore !== 'Off') this.decals.spawn(this.time, 120, x, ground + 0.012, z, 0, 0, 0, radius, 0, 0x37323c);
      this.targets.shake(this.flashReduction ? 0.08 : Math.min(0.35, radius * 0.05));
    } else if (kind === 'screamer') this.waves.spawn(this.time, 1, x, 0.03, z, 0, 0, 0, radius * 2, 1, 0xef92ff, 1);
    else if (kind === 'electric') {
      this.burst(x, height, z, 0x94ecff, 12, 0.07, 0.25, 0);
      for (let i = 0; i < 16; i++) this.particles.spawn(this.time, 0.25, x + i * 0.08, height + Math.sin(i * 0.7) * 0.15, z + (i % 2 ? 0.08 : -0.08), 0, 0, 0, 0.14, 0, 0x94ecff);
    }
    else {
      const smoke = kind.includes('smoke') || kind === 'toxic', sparkle = kind === 'objective' || kind === 'pickup';
      this.burst(x, kind === 'ash' ? 3 : smoke ? 1.7 : 0.5, z, effectColors[kind], sparkle ? 8 : 24, sparkle || kind === 'ash' ? 0.1 : radius * 0.6, smoke ? 4 : 1.2, smoke || kind.includes('fire') ? -1 : sparkle ? 0 : 0.5);
    }
  }
  /** Read fixed-tick veil state on every rendered frame, including paused test stepping. */
  updateObstruction(): void {
    let remaining = 0;
    for (const e of this.world.infected?.active ?? []) {
      const a = e.infected?.specialAttack;
      if (a?.move === 'flamingo.dive' && a.hitIds.includes(1)) remaining = Math.max(remaining, (a.obstructionUntil ?? 0) - this.world.tick);
    }
    this.obstruction.remainingTicks = Math.max(0, Math.min(48, remaining));
    this.obstruction.opacity = remaining > 0 && this.enabled ? (this.flashReduction ? .18 : .35) * Math.min(1, remaining / 12) : 0;
    if (this.featherVeil) this.featherVeil.style.opacity = String(this.obstruction.opacity);
  }
  /** Explicit render clock. Paused test stepping uses this without advancing the sim. */
  private waterClock = 0;
  /** A calm civilian performing a 'water' routine pours a small arc of droplets from the can onto the flower it faces (~15 Hz). */
  private waterStreams(seconds: number): void {
    this.waterClock += seconds; if (this.waterClock < 1 / 15) return;
    this.waterClock = 0;
    for (const e of this.world.entities.iterate()) {
      const c = e.civilian; if (!c?.activityUntil || c.state !== 'calm' || e.hidden) continue;
      const a = c.schedule?.[c.scheduleStep ?? 0]; if (a?.activity !== 'water' || !a.facing || this.world.tick - (c.activityStarted ?? 0) < 40) continue;
      const spout = this.targets.spout?.(e.id), t = .4, base = this.world.districts?.supportBelow(e.transform.x, e.transform.z, e.transform.y - .7) ?? 0;
      if (spout) {
        // The stream leaves the tilted spout and arcs onto the flowers (target a little above the soil).
        const vx = (a.facing.x - spout.x) / t, vz = (a.facing.z - spout.z) / t, vy = (base + .3 - spout.y + 4.905 * t * t) / t;
        for (let i = 0; i < (this.quality === 'low' ? 4 : 6); i++) this.particles.spawn(this.time, t + .05, spout.x, spout.y, spout.z, vx + (this.rng.next() - .5) * .2, vy + (this.rng.next() - .5) * .2, vz + (this.rng.next() - .5) * .2, .26, 0, 0x7cc4ff, 9.81);
        continue;
      }
      const dx = a.facing.x - e.transform.x, dz = a.facing.z - e.transform.z, d = Math.max(.2, Math.hypot(dx, dz)), ox = dx / d * .4 - dz / d * .12, oz = dz / d * .4 + dx / d * .12;
      for (let i = 0; i < (this.quality === 'low' ? 2 : 4); i++) this.particles.spawn(this.time, t + .05, e.transform.x + ox, base + .6, e.transform.z + oz,
        (dx - ox) / t + (this.rng.next() - .5) * .3, .6 + this.rng.next() * .3, (dz - oz) / t + (this.rng.next() - .5) * .3, .16, 0, 0xe6f6ff, 9.81);
    }
  }
  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1) throw new RangeError('Render step must be 0..1 seconds');
    this.time += seconds;
    this.updateObstruction();
    for (const landing of this.landings) if (landing.at <= this.time) {
      if (this.enabled && this.gore !== 'Off') this.decals.spawn(this.time, 12, landing.x, landing.y + .019, landing.z, 0, 0, 0, landing.size, this.colorblind ? 0 : 5, landing.color);
      landing.at = Infinity;
    }
    for (const [attackId, tell] of this.tells) if (tell.sourceId !== undefined) {
      const source = this.world.entities.get(tell.sourceId), brain = source?.infected;
      const pending = brain && brain.attackId === attackId && (brain.specialAttack?.stage === 'telegraph' || brain.state === 'attack' || brain.state === 'dead' && brain.special === 'explode' && this.world.tick < brain.until);
      if (!pending) { if (brain?.attackId === attackId && tell.kind === 'bloated' && this.world.tick >= brain.until) this.effect('explosion', source!.transform.x, source!.transform.z, 3);
        else if (brain?.attackId === attackId && brain.special === 'scream') this.effect('screamer', source!.transform.x, source!.transform.z, 20);
        this.telegraphs.remove(tell.slot); this.tells.delete(attackId); }
    }
    this.visible = this.enabled || this.tells.size > 0;
    for (const id of this.world.vehicles?.cars.keys() ?? []) this.updateVehicle(id);
    if (this.enabled) this.waterStreams(seconds);
    for (const pool of this.pools) pool.advance(this.time);
    if (this.enabled) this.blasts.advance(this.time, seconds);
    this.gibs.advance(this.time, seconds);
    for (let i = 0; i < this.hitCount;) {
      this.targets.flash(this.hitIds[i], Math.max(0, (this.hitUntil[i] - this.time) * 4.5));
      if (this.hitUntil[i] <= this.time) {
        this.hitCount--; this.hitIds[i] = this.hitIds[this.hitCount]; this.hitUntil[i] = this.hitUntil[this.hitCount];
      } else i++;
    }
    if (Math.floor(this.time * 4) !== Math.floor((this.time - seconds) * 4) && this.enabled) {
      for (const vehicle of this.vehicles.values()) {
        if (this.world.entities.get(vehicle.id)?.vehicle?.scripted) continue;
        // L9 floor vehicle: heavy smoke from the 25% stage on, never fire (it stays driveable until the scripted crash).
        // The L9 floor hull's smoke is the Blasts exhaust trail (stage 3+); a second particle burst read as scattered dots.
        if (!vehicle.floor && vehicle.healthFraction < 0.4) this.effect('vehicle-smoke', vehicle.position.x, vehicle.position.z, 0.7);
        if (vehicle.healthFraction < 0.15 && !vehicle.floor) this.effect('vehicle-fire', vehicle.position.x, vehicle.position.z, 0.6);
      }
      for (const e of this.world.entities.iterate()) { const h = e.hazard; if (h && this.world.tick < h.activeUntil && ['fire', 'toxic', 'live-wire'].includes(h.kind) && this.blasts.sourceVisible(e.transform.x, e.transform.z, h.radius + 5)) this.effect(h.kind === 'live-wire' ? 'electric' : h.kind as 'fire' | 'toxic', e.transform.x, e.transform.z, h.radius); }
      // Smoke-grenade clouds are E27 puff volumes (Blasts); fire zones keep the E15 ember bursts.
      for (const zone of this.world.combat?.effects.zones ?? []) if (zone.kind === 'fire') this.effect(zone.kind, zone.x, zone.z, zone.radius);
    }
    // Wounded-infected droplets are based on visual time, never extra sim events or damage.
    if (Math.floor(this.time * 2) !== Math.floor((this.time - seconds) * 2) && this.enabled && this.gore !== 'Off') {
      let emitted = 0;
      for (const e of this.world.entities.iterate()) if (e.faction === 'infected' && e.health.current > 0 && e.health.current < e.health.max * 0.5 && emitted++ < 32) this.decals.spawn(this.time, 120, e.transform.x, (this.world.districts?.supportBelow(e.transform.x, e.transform.z, e.transform.y - .7) ?? 0) + 0.016, e.transform.z, 0, 0, 0, 0.25, 7, 0xb3121f);
    }
  }
  get flash(): number { return this.enabled ? Math.max(Math.max(0, (this.flashUntil - this.time) / 0.1) * (this.flashReduction ? 0.12 : 0.6) * this.flashNear, this.blasts.flash) : 0; }
  snapshot() {
    return { obstruction: { ...this.obstruction }, shots: this.shots, enabled: this.enabled, colorblind: this.colorblind, gore: this.gore, quality: this.quality, flashReduction: this.flashReduction, time: this.time,
      lastSpray: this.lastSpray, surfaceSplats: this.surfaceSplats.count, pendingSplats: this.landings.filter(l => l.at < Infinity).length, particles: this.particles.count, particleCap: this.particles.budget, decals: this.decals.count, decalCap: this.decals.cap, gibs: this.gibs.count, gibCap: this.gibs.budget,
      telegraphs: [...this.tells].map(([attackId, tell]) => ({ attackId, ...tell })), hitStop: { active: this.hitStop.active(this.time), until: this.hitStop.until, started: this.hitStop.started, suppressed: this.hitStop.suppressed },
      flash: this.flash, blasts: this.blasts.snapshot(), coverage: this.coverage, detached: this.detached, dismemberedKills: this.dismemberedKills, kills: this.kills, explosionRadius: this.lastExplosionRadius };
  }
  dispose(): void { this.featherVeil?.remove(); for (const stop of this.stops) stop(); this.stops.length = 0; for (const pool of this.pools) pool.dispose(); this.gibs.dispose(); this.blasts.dispose(); this.clear(); }
}
