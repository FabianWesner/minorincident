import { actionResolver } from '../progression/apply';
import type { ActionDef } from '../../data/actions/schema';
import { ActionEffects } from './ActionEffects';
import { Pickups } from './Pickups';
import { Rng } from '../../core/Rng';
import { ActionRunner, type Attack } from './ActionRunner';
import { Loadout } from './Loadout';
import { Damage } from './Damage';
import { HitQuery } from './HitQuery';
import { AimAssist } from './AimAssist';
import { Status } from './Status';
import { ticks } from '../../data/actions/schema';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
import type { ScenarioDefinition } from '../../levels/loader';
interface Projectile { attack: Attack; x: number; y: number; z: number; from: Vec2; landing: Vec2 | null; flightTicks: number; travelled: number; landed: boolean }
/** Small combat composition for E05; AI/catalog/VFX consume the same components and events. */
export class Combat {
  private readonly rng: Rng;
  readonly query: HitQuery;
  readonly damage: Damage;
  readonly status: Status;
  readonly effects: ActionEffects;
  readonly pickups: Pickups;
  private readonly pelletHits = new Map<EntitySnapshot, number>();
  private readonly pelletDirection = { x: 1, z: 0 };
  readonly assist: AimAssist;
  actionDefinitions: Record<string,ActionDef> | null = null;
  runner: ActionRunner;
  readonly projectiles: Projectile[] = [];
  private readonly direction = { x: 1, z: 0 };
  private readonly origin = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld, readonly definition: ScenarioDefinition) {
    this.rng = new Rng(world.seed, 'combat');
    this.query = new HitQuery(world.entities, world.spatial, definition.walls ?? [], world.interactables?.walls);
    this.effects = new ActionEffects(world); this.pickups = new Pickups(world);
    this.damage = new Damage(world); this.status = new Status(world); this.assist = new AimAssist(world.entities, this.query);
    this.runner = new ActionRunner(1, new Loadout(['weapon.bat', 'weapon.pistol'], ['weapon.grenade', 'ability.ground-slam']));
    this.attach();
  }
  private attach(): void {
    const player = this.world.entities.get(1)!;
    player.weapons = this.runner.loadout.state;
    player.combat ??= { radius: 0.3, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] };
  }
  setLoadout(left: string[], right: string[]): void {
    const loadout = new Loadout(left, right, actionResolver(this.actionDefinitions)), infinite = this.runner.infiniteCharges;
    this.runner = new ActionRunner(1, loadout, this.runner.lastAttackId); this.runner.infiniteCharges = infinite; this.attach();
  }
  intent(frame: InputFrame): void {
    this.runner.loadout.update(this.world.tick, this.switched);
    this.runner.loadout.input(frame, this.world.tick);
    this.status.update();
  }
  update(frame: InputFrame): void {
    const player = this.world.entities.get(1)!;
    this.runner.update(frame, this.world.tick, player.health.current > 0 && !Status.stunned(player, this.world.tick), this.started, this.resolve);
    this.updateProjectiles();
    this.effects.update(); this.pickups.update();
  }
  private readonly switched = (side: 'LEFT' | 'RIGHT', actionId: string): void => { this.world.events.emit({ type: 'loadout.switched', tick: this.world.tick, sourceId: 1, side, actionId }); };
  private readonly started = (attack: Attack): void => {
    const source = this.world.entities.get(attack.sourceId)!;
    if (attack.def.category === 'ranged') {
      this.assist.apply(source.id, source.transform, attack.aim, attack.def.range);
      if (attack.def.spread && (attack.def.pellets ?? 1) === 1) {
        const angle = Math.atan2(attack.aim.z, attack.aim.x) + (this.rng.next() - 0.5) * attack.def.spread * Math.PI / 180;
        attack.aim.x = Math.cos(angle); attack.aim.z = Math.sin(angle);
      }
    }
    this.world.events.emit({ type: 'combat.attack', tick: this.world.tick, attackId: attack.id, actionId: attack.def.id, sourceId: source.id, side: attack.side, position: { ...source.transform }, direction: { ...attack.aim } });
    if (attack.def.category === 'ranged') this.effects.noise(source.transform, attack.def.noiseRadius, attack.def.id);
    this.world.player?.act(attack.def.id === 'weapon.kick' ? 'kick' : attack.def.category === 'melee' || attack.def.category === 'ability' ? 'swing' : attack.def.category === 'throwable' ? 'throw' : 'shoot', this.world.tick);
  };
  private hit(attack: Attack, target: EntitySnapshot, origin: Vec2, type: 'melee' | 'bullet' | 'explosive', falloff = 1): void {
    if (attack.hit.has(target.id)) return;
    attack.hit.add(target.id);
    const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
    this.direction.x = distance ? dx / distance : attack.aim.x; this.direction.z = distance ? dz / distance : attack.aim.z;
    const def = attack.def, distanceFalloff = def.distanceFalloff;
    if (distanceFalloff) falloff *= 1 - (1 - distanceFalloff.minimum) * Math.max(0, Math.min(1, (distance - distanceFalloff.start) / (distanceFalloff.end - distanceFalloff.start)));
    const alive = target.health.current > 0;
    const amount = this.damage.apply({ attackId: attack.id, actionId: def.id, sourceId: attack.sourceId, targetId: target.id, origin, direction: this.direction, base: def.damage * falloff, multiplier: this.world.entities.get(attack.sourceId)?.combat?.damageMultiplier ?? 1, type, radius: def.splash?.radius ?? def.range, spread: def.spread, knockback: def.knockback * falloff, stagger: def.stagger });
    if (alive && target.health.current === 0 && def.category === 'melee') this.effects.noise(origin, def.noiseRadius, def.id);
    if (alive && target.faction === 'infected' && (amount || def.damage === 0) && def.status) this.status.apply(target, def.status, attack.sourceId, def.id, attack.id);
  }
  private splash(attack: Attack, position: Vec2): void {
    const def = attack.def, splash = def.splash!;
    for (const target of this.query.splash(position, splash.radius)) {
      const distance = Math.hypot(target.transform.x - position.x, target.transform.z - position.z, target.transform.y - 0.7);
      const falloff = Math.max(0, 1 - splash.falloff * distance / splash.radius);
      if (def.category === 'ability' && target.faction !== 'infected') continue;
      this.hit(attack, target, position, def.category === 'ability' ? 'melee' : 'explosive', falloff);
    }
  }
  private readonly resolve = (attack: Attack): void => {
    const source = this.world.entities.get(attack.sourceId)!, def = attack.def;
    if (def.effect && def.category === 'ability') { this.effects.create(attack, source.transform); return; }
    if (def.category === 'throwable' || def.projectile) {
      let landing: Vec2 | null = null;
      if (def.category === 'throwable') {
        const dx = attack.aimPoint ? attack.aimPoint.x - source.transform.x : attack.aim.x * def.range;
        const dz = attack.aimPoint ? attack.aimPoint.z - source.transform.z : attack.aim.z * def.range;
        const distance = Math.hypot(dx, dz), scale = distance > def.range ? def.range / distance : 1;
        landing = { x: source.transform.x + dx * scale, z: source.transform.z + dz * scale };
      }
      this.projectiles.push({ attack, x: source.transform.x, y: 0.7, z: source.transform.z, from: { x: source.transform.x, z: source.transform.z }, landing, flightTicks: landing ? Math.max(1, ticks(Math.hypot(landing.x - source.transform.x, landing.z - source.transform.z) / (def.projectile?.speed ?? 12))) : 0, travelled: 0, landed: false });
    } else if (def.splash) this.splash(attack, source.transform);
    else if (def.category === 'melee' || def.category === 'ability') {
      for (const target of this.query.melee(source.id, source.transform, attack.aim, def.range, def.arc, def.maxTargets)) this.hit(attack, target, source.transform, 'melee');
    } else if ((def.pellets ?? 1) > 1) {
      this.pelletHits.clear();
      const count = def.pellets!, angle = Math.atan2(attack.aim.z, attack.aim.x);
      for (let i = 0; i < count; i++) {
        const direction = angle + (i / (count - 1) - 0.5) * def.spread * Math.PI / 180;
        this.pelletDirection.x = Math.cos(direction); this.pelletDirection.z = Math.sin(direction);
        const target = this.query.ray(source.id, source.transform, this.pelletDirection, def.range);
        if (target) this.pelletHits.set(target, (this.pelletHits.get(target) ?? 0) + 1);
      }
      for (const [target, hits] of this.pelletHits) this.hit(attack, target, source.transform, 'bullet', hits / count);
    } else {
      const target = this.query.ray(source.id, source.transform, attack.aim, def.range);
      if (target) this.hit(attack, target, source.transform, 'bullet');
    }
  };
  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i], def = p.attack.def, age = this.world.tick - p.attack.activeAt;
      if (p.landing) {
        const progress = Math.min(1, age / p.flightTicks), time = p.flightTicks / 60;
        p.x = p.from.x + (p.landing.x - p.from.x) * progress; p.z = p.from.z + (p.landing.z - p.from.z) * progress;
        p.y = 0.7 * (1 - progress) + 0.5 * (def.projectile?.gravity ?? 9.81) * time * time * progress * (1 - progress);
        if (progress === 1 && !p.landed) { p.landed = true; this.world.events.emit({ type: 'combat.landed', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, position: { x: p.x, y: p.y, z: p.z } }); }
        if (p.landed && age >= ticks(def.fuse)) {
          if (def.splash) this.splash(p.attack, p);
          this.effects.create(p.attack, p);
          if (def.category === 'throwable' && def.damage) this.effects.noise(p, def.noiseRadius, def.id);
          this.world.events.emit({ type: 'combat.exploded', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, radius: def.splash?.radius ?? 0, position: { x: p.x, y: p.y, z: p.z } });
          this.projectiles.splice(i, 1);
        }
      } else if (age > 0) {
        const step = Math.min(def.range - p.travelled, def.projectile!.speed / 60);
        this.origin.x = p.x; this.origin.z = p.z;
        let target = this.query.ray(p.attack.sourceId, this.origin, p.attack.aim, step, p.attack.hit);
        const wall = this.query.clearDistance(this.origin, p.attack.aim, step);
        if (def.splash && (target || wall < step || p.travelled + wall >= def.range)) {
          if (target) { p.x = target.transform.x; p.z = target.transform.z; }
          else { p.x += p.attack.aim.x * wall; p.z += p.attack.aim.z * wall; }
          this.splash(p.attack, p); this.effects.noise(p, def.noiseRadius, def.id);
          this.world.events.emit({ type: 'combat.exploded', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, radius: def.splash?.radius ?? 0, position: { x: p.x, y: p.y, z: p.z } });
          this.projectiles.splice(i, 1); continue;
        }
        while (target && p.attack.hit.size < def.maxTargets) {
          this.hit(p.attack, target, this.origin, 'bullet');
          if (p.attack.hit.size > def.projectile!.pierce) break;
          target = this.query.ray(p.attack.sourceId, this.origin, p.attack.aim, step, p.attack.hit);
        }
        p.x += p.attack.aim.x * wall; p.z += p.attack.aim.z * wall; p.travelled += wall;
        p.y -= def.projectile!.gravity * (age - 0.5) / 3600;
        if (wall < step || p.travelled >= def.range || p.y < 0 || p.attack.hit.size > def.projectile!.pierce || p.attack.hit.size >= def.maxTargets) this.projectiles.splice(i, 1);
      }
    }
  }
  snapshot() {
    const attack = (a: Attack) => ({ id: a.id, sourceId: a.sourceId, side: a.side, actionId: a.def.id, aim: a.aim, aimPoint: a.aimPoint, started: a.started, activeAt: a.activeAt, recoveryAt: a.recoveryAt, endsAt: a.endsAt, resolved: a.resolved, hit: [...a.hit] });
    return { ...(this.effects.zones.length ? { zones: this.effects.snapshot() } : {}), sequence: this.runner.lastAttackId, rng: this.rng.snapshot(), god: this.damage.god, infiniteCharges: this.runner.infiniteCharges, aimAssist: this.assist.setting, water: this.status.water, running: Object.values(this.runner.running).map(attack), projectiles: this.projectiles.map((p) => ({ ...p, attack: attack(p.attack) })) };
  }
}
