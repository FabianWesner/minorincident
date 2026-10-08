import { Group, type BufferGeometry } from 'three/webgpu';
import { Rng } from '../../core/Rng';
import { infectedDef } from '../../data/infected';
import { catalog as actions } from '../../data/actions/catalog';
import type { EffectKind, TelegraphKind, GameEvent } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { FxPool } from './FxPool';
import { GibPool } from './GibPool';
import type { VehicleFeedbackEvent } from './VehicleFeedback';
import { HitStop } from './HitStop';
import { Blasts } from './Blasts';

export type Gore = 'Full' | 'Reduced' | 'Off';
export type { EffectKind, TelegraphKind } from '../../sim/world/types';
export interface VfxSettings { vfx?: boolean; gore?: Gore; flashReduction?: boolean; colorblind?: boolean; quality?: 'high' | 'low'; slowMotion?: boolean }
export interface VfxTargets {
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
}
const eventTypes = ['combat.hit', 'combat.kill', 'combat.attack', 'combat.exploded', 'combat.effect', 'combat.hit-stop', 'telegraph', 'attack.resolved', 'vfx.effect', 'vehicle.feedback', 'hazard.exploded', 'hazard.electrified', 'prop.ignited', 'vehicle.exploded', 'noise', 'pickup.collected', 'explosion', 'explosion.slowmo', 'outbreak.infection'] as const;
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
  private readonly pools = [this.particles, this.decals, this.surfaceSplats, this.telegraphs, this.waves];
  private readonly landings = Array.from({ length: 384 }, () => ({ at: Infinity, x: 0, z: 0, size: 0, color: 0 }));
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
  constructor(private readonly world: SimWorld, private readonly targets: VfxTargets, geometries?: { limb: BufferGeometry; head: BufferGeometry }) {
    super(); this.rng = new Rng(world.seed, 'vfx'); this.goreRng = new Rng(world.seed, 'dismemberment');
    this.gibs = new GibPool(geometries);
    this.blasts = new Blasts(world, { particles: this.particles, shake: s => targets.shake(s), roll: s => targets.roll?.(s), focus: () => targets.focus?.() ?? world.entities.get(1)?.transform ?? { x: 0, z: 0 }, light: (...args) => targets.light?.(...args) ?? null });
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
    this.visible = this.enabled;
    if (!this.enabled) {
      this.hitStop.reset(); this.targets.clearGore(); this.targets.blood(0);
      for (let i = 0; i < this.hitCount; i++) this.targets.flash(this.hitIds[i], 0);
      this.resetPools(); for (const landing of this.landings) landing.at = Infinity;
    } else this.targets.blood(this.gore === 'Off' ? 0 : this.coverage);
  }
  private telegraphColor(kind: TelegraphKind): number { return this.colorblind ? kind === 'bloated' ? 0xffb347 : 0xffffff : kind === 'bloated' ? 0xffe45b : 0x59e8ff; }
  private resetPools(): void { this.blasts.reset(); for (const pool of this.pools) pool.reset(this.time); this.gibs.reset(); this.tells.clear(); this.hitCount = this.hitCursor = 0; }
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
    const count = kill ? 48 : event.actionId === 'weapon.fists' ? 12 : heavy ? 40 : event.actionId === 'weapon.bat' ? 32 : event.actionId === 'weapon.crowbar' ? 28 : 24;
    const n = this.gore === 'Off' ? 6 : Math.ceil(count / (this.quality === 'low' ? 4 : this.gore === 'Reduced' ? 2 : 1));
    const color = this.gore === 'Off' ? 0x776c75 : this.colorblind ? 0xffba48 : 0xe3293c;
    let chunks = 0;
    for (let i = 0; i < n; i++) {
      const chunk = this.gore === 'Full' && (heavy || kill) && i < (kill ? 4 : 2); if (chunk) chunks++;
      const spread = (this.rng.next() - .5) * (heavy ? 3 : 2), speed = (heavy ? 4.5 : 3) + this.rng.next() * 3;
      const vx = direction.x * speed - direction.z * spread, vz = direction.z * speed + direction.x * spread;
      const vy = 2.3 + this.rng.next() * (heavy ? 2.3 : 1.7), y = 1.1 + this.rng.next() * .25;
      const landingTime = (vy + Math.sqrt(vy * vy + 2 * 9.81 * y)) / 9.81;
      const dropletSize = event.actionId === 'weapon.fists' ? .055 : heavy ? .13 : event.actionId === 'weapon.machete' ? .085 : .11;
      const size = chunk ? .17 + this.rng.next() * .08 : dropletSize + this.rng.next() * .055;
      this.particles.spawn(this.time, landingTime, x, y, z, vx, vy, vz, size, 0, color, 9.81);
      if (this.gore !== 'Off' && i % (this.quality === 'low' ? 2 : 5) === 0) {
        const landing = this.landings[this.landingCursor++ % this.landings.length];
        landing.at = this.time + landingTime; landing.x = x + vx * landingTime; landing.z = z + vz * landingTime; landing.size = chunk ? .5 : .18 + this.rng.next() * .15; landing.color = color;
      }
    }
    this.lastSpray = { actionId: event.actionId, direction, droplets: n - chunks, chunks, gravity: 9.81 };
    if (this.gore !== 'Off') {
      this.decals.spawn(this.time, 18, x, .016, z, this.rng.next() * Math.PI, 0, 0, kill ? 1.1 : .35, this.colorblind ? 0 : kill ? 6 : 5, color);
      const distance = this.world.combat?.query.clearDistance({ x, z }, direction, 1.8) ?? 1.8;
      if (distance < 1.75) this.surfaceSplats.spawn(this.time, 12, x + direction.x * Math.max(0, distance - .025), .8, z + direction.z * Math.max(0, distance - .025), Math.atan2(direction.z, direction.x) + Math.PI / 2, 0, 0, heavy ? .8 : .45, this.colorblind ? 0 : 5, color);
    }
  }
  readonly receive = (event: GameEvent): void => {
    if (event.type === 'vehicle.feedback') {
      let vehicle = this.vehicles.get(event.id);
      if (!vehicle) { vehicle = { ...event, position: { ...event.position } }; this.vehicles.set(event.id, vehicle); }
      else { vehicle.healthFraction = event.healthFraction; vehicle.blood = event.blood; vehicle.position.x = event.position.x; vehicle.position.z = event.position.z; vehicle.yaw = event.yaw; }
      this.targets.vehicle?.(vehicle, this.enabled && this.gore !== 'Off');
    }
    if (event.type === 'explosion.slowmo') { this.blasts.slowmo(event); return; }
    if (!this.enabled) return;
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
        const p = event.position;
        this.burst(p.x + event.direction.x * 0.7, 0.9, p.z + event.direction.z * 0.7, 0xffe7a0, 6, 0.25, 0.06, 0);
        for (let i = 1; i <= 12; i++) this.particles.spawn(this.time, 0.08, p.x + event.direction.x * i * 0.7, 0.9, p.z + event.direction.z * i * 0.7, 0, 0, 0, 0.06, 0, 0xffe7a0);
        if (this.quality === 'high') this.burst(p.x, 0.9, p.z, 0xd7af65, 1, 0.08, 2);
      }
    } else if (event.type === 'combat.exploded') {
      if (event.radius > 0) this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius);
    } else if (event.type === 'explosion') {
      this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius); this.blasts.play(event);
    } else if (event.type === 'combat.effect') {
      if (event.kind === 'fire' || event.kind === 'smoke') this.effect(event.kind, event.position.x, event.position.z, event.radius);
    } else if (event.type === 'telegraph') {
      if (this.tells.has(event.attackId)) return;
      // A source has one current attack. Retire its previous tell synchronously,
      // including paused sim stepping that can run many attacks between render frames.
      if (event.sourceId !== undefined) for (const [id,tell] of this.tells) if(tell.sourceId===event.sourceId){this.telegraphs.remove(tell.slot);this.tells.delete(id);}

      const source = event.sourceId !== undefined ? this.world.entities.get(event.sourceId) : undefined;
      const kind: TelegraphKind = 'kind' in event ? event.kind : event.special === 'explode' ? 'bloated' : event.special === 'charge' || event.special === 'pin' ? 'charge' : event.special === 'aura' ? 'splash' : 'lunge';
      const position = 'position' in event ? event.position : source?.transform;
      if (!position) return;
      const radius = 'radius' in event ? event.radius : kind === 'bloated' || kind === 'splash' ? 3 : source ? Math.max(this.world.missions?.def.l1 ? 1 : 2, infectedDef(source.archetype).range) : 2;
      const angle = 'angle' in event ? event.angle : -Math.atan2(source?.infected?.dz ?? 0, source?.infected?.dx ?? 1);
      const shape = telegraphShapes[kind];
      const slot = this.telegraphs.spawn(this.time, 1e9, position.x, 0.025, position.z, angle, 0, 0, radius * 2, shape, this.telegraphColor(kind), 0, kind === 'charge' ? 0.3 : 1, true);
      this.tells.set(event.attackId, { slot, kind, spawned: this.time, ...(event.sourceId !== undefined ? { sourceId: event.sourceId } : {}) });
    } else if (event.type === 'attack.resolved') {
      const tell = this.tells.get(event.attackId); if (tell) { this.telegraphs.remove(tell.slot); this.tells.delete(event.attackId); }
    } else if (event.type === 'hazard.exploded') this.explosionOnce(event.tick, event.position.x, event.position.z, event.radius);
    else if (event.type === 'vehicle.exploded') { const p = this.world.entities.get(event.sourceId)?.transform; if (p) this.explosionOnce(event.tick, p.x, p.z, 6); }
    else if (event.type === 'noise' && event.kind === 'scream') this.effect('screamer', event.position.x, event.position.z, event.radius);
    else if (event.type === 'hazard.electrified' || event.type === 'prop.ignited') { const p = this.world.entities.get(event.id)?.transform; if (p) this.effect(event.type === 'hazard.electrified' ? 'electric' : 'fire', p.x, p.z, 1); }
    // E19 section 5.7: the turning reads at the game camera - sickly wisps when the eyes ignite, a puff as the person rises.
    else if (event.type === 'outbreak.infection' && (event.phase === 'eyes' || event.phase === 'rise')) {
      const p = this.world.entities.get(event.entityId)?.transform, rise = event.phase === 'rise';
      if (p) this.sickPuff(p.x, p.z, rise ? 18 : 10, rise ? .2 : .14, rise ? .7 : .3);
    }
    else if (event.type === 'pickup.collected') { const e = this.world.entities.get('id' in event ? event.id : event.sourceId); if (e) this.effect('pickup', e.transform.x, e.transform.z, 1); }
    else if (event.type === 'vfx.effect') this.effect(event.kind, event.position.x, event.position.z, event.radius);
  };
  private updateVehicle(id: number, blood = this.vehicles.get(id)?.blood ?? 0): void {
    const e = this.world.entities.get(id); if (!e?.vehicle) return;
    this.receive({ tick: this.world.tick, type: 'vehicle.feedback', id, position: { x: e.transform.x, z: e.transform.z }, yaw: e.transform.yaw, healthFraction: e.health.current / e.health.max, blood });
  }
  /** One E15 base burst per blast: legacy hazard/combat/vehicle events and the E27 explosion event arrive together. */
  private explosionOnce(tick: number, x: number, z: number, radius: number): void {
    const last = this.e15Blast;
    if (last.tick === tick && Math.hypot(last.x - x, last.z - z) < .75) return;
    last.tick = tick; last.x = x; last.z = z; this.effect('explosion', x, z, radius);
  }
  /** Radius is in metres. Shockwave max diameter is exactly 2 × splash radius. */
  effect(kind: EffectKind, x: number, z: number, radius = 2): void {
    if (!this.enabled) return;
    if (kind === 'explosion') {
      this.lastExplosionRadius = radius; this.flashUntil = this.time + 0.1;
      this.waves.spawn(this.time, 0.8, x, 0.035, z, 0, 0, 0, radius * 2, 1, 0xffe19a, 1);
      this.burst(x, 1, z, 0xff8c32, 64, radius * 0.3, 0.65, 2);
      this.burst(x, 0.8, z, 0x685866, 32, radius * 0.4, 2, -0.5);
      this.burst(x, 0.3, z, 0xb09b85, 16, 0.13, 1.6);
      if (this.gore !== 'Off') this.decals.spawn(this.time, 120, x, 0.012, z, 0, 0, 0, radius, 0, 0x37323c);
      this.targets.shake(this.flashReduction ? 0.08 : Math.min(0.35, radius * 0.05));
    } else if (kind === 'screamer') this.waves.spawn(this.time, 1, x, 0.03, z, 0, 0, 0, radius * 2, 1, 0xef92ff, 1);
    else if (kind === 'electric') {
      this.burst(x, 0.7, z, 0x94ecff, 12, 0.07, 0.25, 0);
      for (let i = 0; i < 16; i++) this.particles.spawn(this.time, 0.25, x + i * 0.08, 0.7 + Math.sin(i * 0.7) * 0.15, z + (i % 2 ? 0.08 : -0.08), 0, 0, 0, 0.14, 0, 0x94ecff);
    }
    else {
      const smoke = kind.includes('smoke') || kind === 'toxic', sparkle = kind === 'objective' || kind === 'pickup';
      this.burst(x, kind === 'ash' ? 3 : smoke ? 1.7 : 0.5, z, effectColors[kind], sparkle ? 8 : 24, sparkle || kind === 'ash' ? 0.1 : radius * 0.6, smoke ? 4 : 1.2, smoke || kind.includes('fire') ? -1 : sparkle ? 0 : 0.5);
    }
  }
  /** Explicit render clock. Paused test stepping uses this without advancing the sim. */
  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1) throw new RangeError('Render step must be 0..1 seconds');
    this.time += seconds;
    for (const landing of this.landings) if (landing.at <= this.time) {
      if (this.enabled && this.gore !== 'Off') this.decals.spawn(this.time, 12, landing.x, .019, landing.z, 0, 0, 0, landing.size, this.colorblind ? 0 : 5, landing.color);
      landing.at = Infinity;
    }
    for (const [attackId, tell] of this.tells) if (tell.sourceId !== undefined) {
      const source = this.world.entities.get(tell.sourceId), brain = source?.infected;
      const pending = brain && brain.attackId === attackId && (brain.state === 'attack' || brain.state === 'dead' && brain.special === 'explode' && this.world.tick < brain.until);
      if (!pending) { if (brain?.attackId === attackId && tell.kind === 'bloated' && this.world.tick >= brain.until) this.effect('explosion', source!.transform.x, source!.transform.z, 3);
        else if (brain?.attackId === attackId && brain.special === 'scream') this.effect('screamer', source!.transform.x, source!.transform.z, 20);
        this.telegraphs.remove(tell.slot); this.tells.delete(attackId); }
    }
    for (const id of this.world.vehicles?.cars.keys() ?? []) this.updateVehicle(id);
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
        if (vehicle.healthFraction < 0.4) this.effect('vehicle-smoke', vehicle.position.x, vehicle.position.z, 0.7);
        if (vehicle.healthFraction < 0.15) this.effect('vehicle-fire', vehicle.position.x, vehicle.position.z, 0.6);
      }
      for (const e of this.world.entities.iterate()) { const h = e.hazard; if (h && this.world.tick < h.activeUntil && ['fire', 'toxic', 'live-wire'].includes(h.kind)) this.effect(h.kind === 'live-wire' ? 'electric' : h.kind as 'fire' | 'toxic', e.transform.x, e.transform.z, h.radius); }
      // Smoke-grenade clouds are E27 puff volumes (Blasts); fire zones keep the E15 ember bursts.
      for (const zone of this.world.combat?.effects.zones ?? []) if (zone.kind === 'fire') this.effect(zone.kind, zone.x, zone.z, zone.radius);
    }
    // Wounded-infected droplets are based on visual time, never extra sim events or damage.
    if (Math.floor(this.time * 2) !== Math.floor((this.time - seconds) * 2) && this.enabled && this.gore !== 'Off') {
      let emitted = 0;
      for (const e of this.world.entities.iterate()) if (e.faction === 'infected' && e.health.current > 0 && e.health.current < e.health.max * 0.5 && emitted++ < 32) this.decals.spawn(this.time, 120, e.transform.x, 0.016, e.transform.z, 0, 0, 0, 0.25, 7, 0xb3121f);
    }
  }
  get flash(): number { return this.enabled ? Math.max(Math.max(0, (this.flashUntil - this.time) / 0.1) * (this.flashReduction ? 0.12 : 0.6), this.blasts.flash) : 0; }
  snapshot() {
    return { enabled: this.enabled, colorblind: this.colorblind, gore: this.gore, quality: this.quality, flashReduction: this.flashReduction, time: this.time,
      lastSpray: this.lastSpray, surfaceSplats: this.surfaceSplats.count, pendingSplats: this.landings.filter(l => l.at < Infinity).length, particles: this.particles.count, particleCap: this.particles.budget, decals: this.decals.count, decalCap: this.decals.cap, gibs: this.gibs.count, gibCap: this.gibs.budget,
      telegraphs: [...this.tells].map(([attackId, tell]) => ({ attackId, ...tell })), hitStop: { active: this.hitStop.active(this.time), until: this.hitStop.until, started: this.hitStop.started, suppressed: this.hitStop.suppressed },
      flash: this.flash, blasts: this.blasts.snapshot(), coverage: this.coverage, detached: this.detached, dismemberedKills: this.dismemberedKills, kills: this.kills, explosionRadius: this.lastExplosionRadius };
  }
  dispose(): void { for (const stop of this.stops) stop(); this.stops.length = 0; for (const pool of this.pools) pool.dispose(); this.gibs.dispose(); this.blasts.dispose(); this.clear(); }
}
