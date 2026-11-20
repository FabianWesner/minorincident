import { deterministicAtan2, deterministicSin, deterministicCos } from '../../core/deterministicMath';
import { actionResolver } from '../progression/apply';
import type { ActionDef } from '../../data/actions/schema';
import { ActionEffects } from './ActionEffects';
import { Pickups } from './Pickups';
import { Rng } from '../../core/Rng';
import { ActionRunner, type Attack } from './ActionRunner';
import { Loadout } from './Loadout';
import { Damage } from './Damage';
import { HitQuery } from './HitQuery';
import { fireTarget } from './friendlyFire';
import { AimAssist } from './AimAssist';
import { Status } from './Status';
import { ticks } from '../../data/actions/schema';
import { actionExplosions, blastDamage, explosionDef } from '../../data/explosions';
import { action } from '../../data/actions/catalog';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
import type { ScenarioDefinition } from '../../levels/loader';
interface Projectile { attack: Attack; x: number; y: number; z: number; from: Vec2; landing: Vec2 | null; destination?: { x: number; y: number; z: number }; flightTicks: number; travelled: number; landed: boolean }
/** Small combat composition for E05; AI/catalog/VFX consume the same components and events. */
export class Combat {
  private readonly rng: Rng;
  readonly query: HitQuery;
  readonly damage: Damage;
  readonly status: Status;
  readonly effects: ActionEffects;
  readonly pickups: Pickups;
  private readonly pelletHits = new Map<EntitySnapshot, number>();
  private readonly pelletDirection = { x: 1, y: 0, z: 0 };
  readonly assist: AimAssist;
  rackCapacity = 3;
  actionDefinitions: Record<string,ActionDef> | null = null;
  runner: ActionRunner;
  readonly projectiles: Projectile[] = [];
  private readonly direction = { x: 1, z: 0 };
  private readonly origin = { x: 0, y: 0, z: 0 };
  constructor(private readonly world: SimWorld, readonly definition: ScenarioDefinition) {
    this.rng = new Rng(world.seed, 'combat');
    this.query = new HitQuery(world.entities, world.spatial, definition.walls ?? [], world.interactables?.walls, () => world.difficulty === 'hard');
    this.effects = new ActionEffects(world); this.pickups = new Pickups(world);
    this.damage = new Damage(world); this.status = new Status(world); this.assist = new AimAssist(world.entities, this.query, point => world.infected?.director.inPlayerView(point, Infinity, 1) ?? true);
    this.runner = new ActionRunner(1, new Loadout(['weapon.bat', 'weapon.pistol'], ['weapon.grenade', 'ability.ground-slam']));
    this.attach();
  }
  private attach(): void {
    const player = this.world.entities.get(1)!;
    player.weapons = this.runner.loadout.state;
    player.combat ??= { radius: 0.3, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] };
  }
  setLoadout(left: string[], right: string[], sequence = this.runner.lastAttackId): void {
    const loadout = new Loadout(left, right, actionResolver(this.actionDefinitions), this.rackCapacity), infinite = this.runner.infiniteCharges;
    if (this.runner.loadout.state.corgiReady !== undefined) loadout.state.corgiReady = this.runner.loadout.state.corgiReady;
    this.runner = new ActionRunner(1, loadout, Math.max(this.runner.lastAttackId, sequence)); this.runner.infiniteCharges = infinite; this.attach();
  }
  /**
   * A level's own pickup is never owned at the level start (a replayed level or a saved rack may still carry it): remove the
   * given actions from both racks, keep the rest, and fall back to fists/kick when a side would be empty.
   */
  /** Actions a level grants later (no pickup entity at load); the view loads and warms them up front. */
  readonly withheld = new Set<string>();
  withholdPickups(...ids: string[]): void {
    for (const id of ids) this.withheld.add(id);
    const st = this.runner.loadout.state, drop = new Set(ids);
    const left = st.LEFT.rack.map(s => s.id).filter(id => !drop.has(id)), right = st.RIGHT.rack.map(s => s.id).filter(id => !drop.has(id));
    if (left.length === st.LEFT.rack.length && right.length === st.RIGHT.rack.length) return;
    this.setLoadout(left.length ? left : ['weapon.fists'], right.length ? right : ['weapon.kick']);
  }
  /** Empty starting loadout: no visible/effective actions until the display pickup. */
  clearLoadout(): void { delete this.world.entities.get(1)!.weapons; this.projectiles.length = 0; }
  intent(frame: InputFrame): void {
    if (!this.world.entities.get(1)!.weapons) return;
    this.runner.loadout.update(this.world.tick, this.switched);
    if (this.world.missions?.l8?.bosses.swapBlocked()) frame = { ...frame, selector: 0, selectedSlot: undefined, selectedActiveSlot: undefined, selectedWeaponKey: undefined, selectedLegacyWeaponKey: undefined, selectedPositionWeaponKey: undefined };
    this.runner.loadout.input(frame, this.world.tick);
    this.status.update();
  }
  update(frame: InputFrame): void {
    const player = this.world.entities.get(1)!;
    if (!player.weapons) return;
    const loadout = this.runner.loadout;
    const emptySide = (['LEFT', 'RIGHT'] as const).find(side => frame[side === 'LEFT' ? 'left' : 'right'].down && !loadout.hasAmmo(loadout.current(side)));
    const canUseCarriedWeapon = (this.world.vehicles?.active == null || !!this.world.missions?.l9?.driving.hatch) && this.world.missions?.l9?.state.phase !== 'crawl';
    if (emptySide && player.health.current > 0 && canUseCarriedWeapon && !this.world.mountedGun?.mounted && !Status.stunned(player, this.world.tick)) {
      this.world.events.emit({ type: 'combat.empty', tick: this.world.tick, sourceId: 1, actionId: loadout.current(emptySide).id, position: { ...player.transform } });
      loadout.fallback(this.world.tick);
      this.world.controls.reset();
      frame = { ...frame, left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false } };
    }
    const hasLure = this.world.progression?.campaign?.ownedActions.includes('ability.corgi-lure') || (['LEFT', 'RIGHT'] as const).some(side => loadout.state[side].rack.some(slot => slot.id === 'ability.corgi-lure'));
    if (frame.corgiLure && hasLure && player.health.current > 0 && canUseCarriedWeapon && !this.world.mountedGun?.mounted && !Status.stunned(player, this.world.tick) && this.world.tick >= (loadout.state.corgiReady ?? 0)) {
      const def = loadout.definition('ability.corgi-lure') ?? action('ability.corgi-lure'), tick = this.world.tick;
      loadout.state.corgiReady = tick + ticks(def.cooldown);
      this.effects.create({ id: -tick - 1, sourceId: 1, side: loadout.state.selectedSide, def, combo: 0, inPlace: false, aim: { x: 1, z: 0 }, aimPoint: null, started: tick, activeAt: tick, recoveryAt: tick, endsAt: tick, resolved: true, hit: new Set() }, player.transform);
    }
    this.runner.update(frame, this.world.tick, player.health.current > 0 && !this.world.missions?.state.states['cure-released'] && canUseCarriedWeapon && !this.world.mountedGun?.mounted && !Status.stunned(player, this.world.tick), this.started, this.resolve, this.crowd, this.canFire);
    this.updateProjectiles();
    this.effects.update(); this.pickups.update();
  }
  /** Check at discharge, after aim assist and the raise: a close enemy may move into the shot. */
  private readonly canFire = (attack: Attack): boolean => {
    if (attack.def.id !== 'weapon.rocket-launcher') return true;
    const source = this.world.entities.get(attack.sourceId)!, point = attack.aimPoint;
    const closePoint = !!point && Math.hypot(point.x - source.transform.x, point.z - source.transform.z) < 5;
    const closeEnemy = this.query.melee(source.id, source.transform, attack.aim, 5, 30, 1000).some(target => target.faction === 'infected'
      && !target.hidden && !target.infected?.hidden && Math.hypot(target.transform.x - source.transform.x, target.transform.z - source.transform.z) < 5);
    if (!closePoint && !closeEnemy) {
      return true;
    }
    this.world.events.emit({ type: 'combat.empty', tick: this.world.tick, sourceId: source.id, actionId: attack.def.id, position: { ...source.transform }, reason: 'too-close' });
    return false;
  };
  /** Living infected a sweep of `radius` reaches from the player now (cover blocks; civilians never count). */
  private readonly crowd = (radius: number): number => {
    const player = this.world.entities.get(1)!;
    let count = 0;
    for (const target of this.query.melee(1, player.transform, this.direction, radius, 360, 1000)) if (target.faction === 'infected' && !target.hidden && !target.infected?.hidden) count++;
    return count;
  };
  private readonly switched = (side: 'LEFT' | 'RIGHT', actionId: string): void => { this.world.events.emit({ type: 'loadout.switched', tick: this.world.tick, sourceId: 1, side, actionId }); };
  private readonly started = (attack: Attack): void => {
    const source = this.world.entities.get(attack.sourceId)!;
    if (attack.def.category === 'ranged') {
      if (!attack.autoAim && !(['weapon.rocket-launcher', 'weapon.flamethrower'].includes(attack.def.id) && attack.aimPoint)) this.assist.apply(source.id, source.transform, attack.aim, attack.def.range, attack.target === undefined ? attack.def.projectile?.speed : undefined);
      if (attack.def.spread && (attack.def.pellets ?? 1) === 1) {
        const angle = deterministicAtan2(attack.aim.z, attack.aim.x) + (this.rng.next() - 0.5) * attack.def.spread * Math.PI / 180;
        attack.aim.x = deterministicCos(angle); attack.aim.z = deterministicSin(angle);
      }
    }
    if (attack.def.category !== 'ranged') this.attackEvent(attack);
    if (source.survivor) source.survivor.attack = { actionId: attack.def.id, combo: attack.combo, started: attack.started, activeAt: attack.activeAt, recoveryAt: attack.recoveryAt, endsAt: attack.endsAt, ...(attack.style ? { style: attack.style } : {}) };
    this.world.player?.act(attack.def.id === 'weapon.kick' ? 'kick' : attack.def.category === 'melee' || attack.def.category === 'ability' ? 'swing' : attack.def.category === 'throwable' ? 'throw' : 'shoot', this.world.tick, attack.endsAt - attack.started);
  };
  /** The ranged event is the discharge: muzzle, sound, noise and damage share one tick. */
  private attackEvent(attack: Attack): void {
    const source = this.world.entities.get(attack.sourceId)!;
    this.world.events.emit({ type: 'combat.attack', tick: this.world.tick, attackId: attack.id, actionId: attack.def.id, combo: attack.combo, sourceId: source.id, side: attack.side, position: { ...source.transform }, direction: { ...attack.aim }, ...(attack.style ? { style: attack.style } : {}) });
    if (attack.def.category === 'ranged') this.effects.noise(source.transform, attack.def.noiseRadius, attack.def.id);
  }
  private hit(attack: Attack, target: EntitySnapshot, origin: Vec2, type: 'melee' | 'bullet' | 'explosive', falloff = 1, shotOrigin?: Vec2, centreShot = false): void {
    if (attack.hit.has(target.id)) return;
    attack.hit.add(target.id);
    // s178 Hard: an in-place swing on a civilian deals friendly-fire damage instead of the harmless "Hey!" annoy.
    if (attack.inPlace && type === 'melee' && target.faction === 'civilian' && target.civilian && this.world.difficulty !== 'hard') {
      this.world.npcs?.civilians.annoy(target, attack.aim); return;
    }
    if (attack.def.id === 'weapon.kick' && this.world.props?.kick(target.id, attack.aim)) return;
    const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
    this.direction.x = distance ? dx / distance : attack.aim.x; this.direction.z = distance ? dz / distance : attack.aim.z;
    const def = attack.def, distanceFalloff = def.distanceFalloff;
    if (distanceFalloff) falloff *= 1 - (1 - distanceFalloff.minimum) * Math.max(0, Math.min(1, (distance - distanceFalloff.start) / (distanceFalloff.end - distanceFalloff.start)));
    const alive = target.health.current > 0;
    const amount = this.damage.apply({ attackId: attack.id, actionId: def.id, sourceId: attack.sourceId, targetId: target.id, origin, ...(shotOrigin ? { shotOrigin } : {}), direction: this.direction, base: def.damage * falloff, multiplier: this.world.entities.get(attack.sourceId)?.combat?.damageMultiplier ?? 1, type, radius: def.splash?.radius ?? def.range, spread: def.spread, knockback: def.knockback * falloff, stagger: def.stagger, knockdown: def.id === 'weapon.shotgun' ? centreShot && distance <= 3 : def.knockdown, ...(def.id === 'weapon.shotgun' && centreShot && distance <= 3 ? { knockdownTicks: 90 } : {}), ...(def.id === 'weapon.flamethrower' ? { permanent: true } : {}), ...(attack.style ? { sweep: true } : {}), ...(def.hitStopMs === undefined ? {} : { hitStopMs: def.hitStopMs }) });
    if (alive && target.health.current === 0 && def.category === 'melee') this.effects.noise(origin, def.noiseRadius, def.id);
    if (alive && target.faction === 'infected' && (amount || def.damage === 0) && def.status) this.status.apply(target, def.status, attack.sourceId, def.id, attack.id);
    // Orchestrator 2026-11-20: no MG slow. Every suppression variant either raised L6 threat flags or broke the L4 contact routing test; the MG's job is pierce + volume of fire.
    if (alive && amount > 0 && target.faction === 'infected' && def.id === 'weapon.nail-gun' && !target.infected?.pursuit && !target.infected?.arenaBoss) {
      const heavy = ['infected.brute', 'infected.armored', 'infected.riot', 'infected.bloated', 'infected.firefighter', 'infected.hazmat'].includes(target.archetype ?? '');
      const duration = heavy ? 1 : target.archetype === 'infected.alpha' ? .5 : 2;
      this.status.apply(target, { kind: 'pinned', duration, maxStacks: 1, dps: 0, slow: 1 }, attack.sourceId, def.id, attack.id);
    }
  }
  private splash(attack: Attack, position: Vec2 & { y?: number }, directTargetId?: number): void {
    const def = attack.def, splash = def.splash!;
    if (def.id === 'weapon.rocket-launcher' && this.world.explosions) {
      this.world.explosions.blast(actionExplosions[def.id], position, { sourceId: attack.sourceId, height: position.y ?? 0, radius: splash.radius, directTargetId, attackId: attack.id, actionId: def.id, multiplier: this.world.entities.get(attack.sourceId)?.combat?.damageMultiplier ?? 1 });
      return;
    }
    for (const target of this.query.splash(position, splash.radius)) {
      const distance = def.id === 'weapon.molotov' ? Math.hypot(target.transform.x - position.x, target.transform.z - position.z) : Math.hypot(target.transform.x - position.x, target.transform.z - position.z, target.transform.y - 0.7);
      const molotov = def.id === 'weapon.molotov' ? explosionDef('explosion.molotov') : null;
      const falloff = molotov ? blastDamage(molotov, distance, splash.radius) / molotov.damage : Math.max(0, 1 - splash.falloff * distance / splash.radius);
      if (def.category === 'ability' && target.faction !== 'infected') continue;
      this.hit(attack, target, position, def.category === 'ability' ? 'melee' : 'explosive', falloff);
    }
  }
  /** E27: physics impulses, props/barricades/vehicles, fx and chains for an already-resolved splash (damage stays here). */
  private blast(attack: Attack, at: Vec2): void {
    const id = actionExplosions[attack.def.id];
    if (id && attack.def.id !== 'weapon.rocket-launcher') this.world.explosions?.blast(id, at, { sourceId: attack.sourceId, actionId: attack.def.id, radius: attack.def.splash!.radius, damage: false });
  }
  private environment(attack: Attack, origin: Vec2 & { y: number }, direction: Vec2 & { y?: number }, range: number, target: EntitySnapshot | null = null, scale = 1): boolean {
    if (target) {
      const dx = target.transform.x-origin.x, dz = target.transform.z-origin.z, along = dx*direction.x+dz*direction.z;
      range = Math.min(range, Math.max(0, along-Math.sqrt(Math.max(0,(target.combat?.radius??.4)**2-(dx*dx+dz*dz-along*along)))));
    }
    return this.world.destruction?.strike(attack.def.id, attack.def.damage*scale*(this.world.entities.get(attack.sourceId)?.combat?.damageMultiplier??1), origin, { ...direction, y: direction.y ?? 0 }, range) ?? false;
  }
  private readonly resolve = (attack: Attack): void => {
    const source = this.world.entities.get(attack.sourceId)!, def = attack.def;
    if (def.category === 'ranged' && source.id === 1 && this.world.missions?.l9?.driving.hatch) {
      // Like the deck gun, an elevated hatch aims down at the first visible
      // body on its bearing. A horizontal round passes over ground enemies.
      const muzzle = { ...source.transform, y: source.transform.y + .45 };
      let nearest = def.range + 1; attack.aim.y = 0;
      for (const id of this.query.nearby(muzzle, def.range)) {
        const candidate = this.world.entities.get(id);
        if (!candidate?.infected || candidate.health.current <= 0 || candidate.hidden || candidate.infected.hidden) continue;
        const dx = candidate.transform.x - muzzle.x, dz = candidate.transform.z - muzzle.z;
        const along = dx * attack.aim.x + dz * attack.aim.z, cross = Math.abs(dx * attack.aim.z - dz * attack.aim.x);
        if (along <= 0 || along >= nearest || cross > (candidate.combat?.radius ?? .4) + .15) continue;
        const centre = { ...candidate.transform, y: candidate.transform.y + .45 };
        if (!this.query.visible(muzzle, centre, id)) continue;
        nearest = along; attack.aim.y = (centre.y - muzzle.y) / Math.max(.1, along);
      }
    }
    if (def.category === 'ranged') this.attackEvent(attack);
    if (def.effect && def.category === 'ability') { this.effects.create(attack, source.transform); return; }
    if (def.category === 'throwable' || def.projectile) {
      if (def.id === 'weapon.rocket-launcher') {
        // Pointer aim supplies a world point; direction-only devices keep the
        // catalog range. Never turn a ground click into a flat max-range ray.
        const target = attack.target === undefined ? undefined : this.world.entities.get(attack.target);
        const point = target?.health.current ? target.transform : attack.aimPoint;
        const dx = point ? point.x - source.transform.x : attack.aim.x * def.range;
        const dz = point ? point.z - source.transform.z : attack.aim.z * def.range;
        const x = source.transform.x + dx, z = source.transform.z + dz;
        const y = target?.health.current ? target.transform.y : this.world.districts?.pavingHeight(x, z) ?? 0;
        this.projectiles.push({ attack, x: source.transform.x, y: source.transform.y + .45, z: source.transform.z, from: { x: source.transform.x, z: source.transform.z }, destination: { x, y, z }, landing: null, flightTicks: 0, travelled: 0, landed: false });
        return;
      }
      let landing: Vec2 | null = null;
      if (def.category === 'throwable') {
        const dx = attack.aimPoint ? attack.aimPoint.x - source.transform.x : attack.aim.x * def.range;
        const dz = attack.aimPoint ? attack.aimPoint.z - source.transform.z : attack.aim.z * def.range;
        const distance = Math.hypot(dx, dz), scale = distance > def.range ? def.range / distance : 1;
        landing = { x: source.transform.x + dx * scale, z: source.transform.z + dz * scale };
      }
      this.projectiles.push({ attack, x: source.transform.x, y: def.category === 'ranged' ? source.transform.y + .45 : 0.7, z: source.transform.z, from: { x: source.transform.x, z: source.transform.z }, landing, flightTicks: landing ? Math.max(1, ticks(Math.hypot(landing.x - source.transform.x, landing.z - source.transform.z) / (def.projectile?.speed ?? 12))) : 0, travelled: 0, landed: false });
    } else if (def.splash) this.splash(attack, source.transform);
    else if (attack.style === 'roundhouse') this.sweep(attack, source);
    else if (def.category === 'melee' || def.category === 'ability') {
      this.environment(attack, { ...source.transform, y: source.transform.y+.3 }, attack.aim, def.range);
      for (const target of this.query.melee(source.id, source.transform, attack.aim, def.range, def.arc, def.maxTargets, attack.inPlace, attack.target)) this.hit(attack, target, source.transform, 'melee');
    } else if (def.id === 'weapon.flamethrower') {
      const origin = { ...source.transform, y: source.transform.y + .45 };
      const streamRange = attack.aimPoint ? Math.max(2, Math.min(def.range, Math.hypot(attack.aimPoint.x - source.transform.x, attack.aimPoint.z - source.transform.z))) : def.range;
      const halfCone = Math.cos(def.spread * Math.PI / 360);
      // Heat fills the cone: each exposed infected receives the full stream tick,
      // independently of other bodies. Walls and destructibles still stop it.
      for (const id of [...this.query.nearby(origin, streamRange)]) {
        const target = this.world.entities.get(id);
        if (!target || target.faction !== 'infected' || target.health.current <= 0 || target.hidden) continue;
        const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
        if (!distance || distance > streamRange || (dx * attack.aim.x + dz * attack.aim.z) / distance < halfCone) continue;
        const direction = { x: dx / distance, y: 0, z: dz / distance };
        if (!this.query.visible(origin, target.transform, target.id) || (this.world.destruction?.trace(origin, direction, distance)?.distance ?? distance) < distance - .05) continue;
        this.hit(attack, target, source.transform, 'bullet');
      }
      const cover = this.world.destruction?.trace(origin, { ...attack.aim, y: 0 }, streamRange)?.distance ?? streamRange;
      const distance = Math.max(0, Math.min(cover, this.query.clearDistance(origin, attack.aim, streamRange)) - .08);
      // Heat touches ground along the clipped stream, not just its endpoint.
      this.world.hazards?.ignitePatch({ x: origin.x + attack.aim.x * distance, z: origin.z + attack.aim.z * distance }, .65, 5);
      for (let along = 1; along < distance; along += 2) this.world.hazards?.ignitePatch({ x: origin.x + attack.aim.x * along, z: origin.z + attack.aim.z * along }, .65, 5);
    } else if ((def.pellets ?? 1) > 1) {
      this.pelletHits.clear();
      const count = def.pellets!, angle = deterministicAtan2(attack.aim.z, attack.aim.x);
      for (let i = 0; i < count; i++) {
        const direction = angle + (i / (count - 1) - 0.5) * def.spread * Math.PI / 180;
        this.pelletDirection.x = deterministicCos(direction); this.pelletDirection.y = attack.aim.y ?? 0; this.pelletDirection.z = deterministicSin(direction);
        const target = this.query.ray(source.id, { ...source.transform, y: source.transform.y + .45 }, this.pelletDirection, def.range);
        const blocked = this.environment(attack, { ...source.transform, y: source.transform.y+.45 }, this.pelletDirection, def.range, target, 1/count);
        if (target && !blocked) this.pelletHits.set(target, (this.pelletHits.get(target) ?? 0) + 1);
      }
      const centreTarget = def.id === 'weapon.shotgun' ? this.query.ray(source.id, { ...source.transform, y: source.transform.y + .45 }, attack.aim, def.range) : undefined;
      for (const [target, hits] of this.pelletHits) this.hit(attack, target, source.transform, 'bullet', hits / count, undefined, target === centreTarget);
    } else {
      const target = this.query.ray(source.id, { ...source.transform, y: source.transform.y + .45 }, attack.aim, def.range);
      const blocked = this.environment(attack, { ...source.transform, y: source.transform.y+.45 }, attack.aim, def.range, target);
      if (target && !blocked) this.hit(attack, target, source.transform, 'bullet');
    }
  };
  /** Roundhouse: the bat turns a full circle over the active window (the facing yaw grows from the aim, so the
   * sim angle atan2(z, x) falls); each infected in the radius is struck on the tick the sweep passes it. */
  private sweep(attack: Attack, source: EntitySnapshot): void {
    const def = attack.def, window = Math.max(1, attack.recoveryAt - attack.activeAt);
    const swept = Math.PI * 2 * Math.min(1, (this.world.tick - attack.activeAt + 1) / window), start = deterministicAtan2(attack.aim.z, attack.aim.x);
    // The sweep connects with the nearest few only (PO: fight a few, never the whole crowd at once).
    // s178 Hard: living humans are swept too (friendly fire both ways; corgi/pets/zoo animals stay out).
    if (!attack.sweep) {
      const d = (e: EntitySnapshot) => Math.hypot(e.transform.x - source.transform.x, e.transform.z - source.transform.z);
      attack.sweep = this.query.melee(source.id, source.transform, attack.aim, def.range, 360, 1000)
        .filter(e => e.faction === 'infected' || this.world.difficulty === 'hard' && fireTarget(e))
        .sort((a, b) => d(a) - d(b) || a.id - b.id).slice(0, def.maxTargets).map(e => e.id);
    }
    for (const id of attack.sweep) {
      const target = this.world.entities.get(id);
      if (!target || attack.hit.has(id) || target.health.current <= 0) continue;
      const angle = deterministicAtan2(target.transform.z - source.transform.z, target.transform.x - source.transform.x);
      if ((((start - angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) <= swept + 1e-9) this.hit(attack, target, source.transform, 'melee');
    }
  }
  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i], def = p.attack.def, age = this.world.tick - p.attack.activeAt;
      if (p.destination && age > 0) {
        const dx = p.destination.x - p.x, dy = p.destination.y - p.y, dz = p.destination.z - p.z;
        const horizontal = Math.hypot(dx, dz), distance = Math.hypot(horizontal, dy);
        const arrived = distance <= def.projectile!.speed / 60;
        const step = arrived ? horizontal : def.projectile!.speed / 60 * horizontal / distance;
        const direction = { x: horizontal ? dx / horizontal : 0, y: horizontal ? dy / horizontal : 0, z: horizontal ? dz / horizontal : 0 };
        const wall = Math.min(this.query.clearDistance(p, direction, step), this.world.destruction?.trace(p, direction, step)?.distance ?? step);
        const target = this.query.ray(p.attack.sourceId, p, direction, wall, p.attack.hit);
        let travel = wall;
        if (target) {
          const tx = target.transform.x - p.x, tz = target.transform.z - p.z;
          const along = tx * direction.x + tz * direction.z, radius = target.combat?.radius ?? .4;
          travel = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - (tx * tx + tz * tz - along * along))));
        }
        const impact = !!target || wall < step || arrived;
        // An impact before arming is a harmless dud, including cover impacts.
        if (impact && p.travelled + travel < 5) { this.projectiles.splice(i, 1); continue; }
        p.x += direction.x * travel; p.y += direction.y * travel; p.z += direction.z * travel; p.travelled += travel;
        if (impact) {
          if (!target && wall === step) Object.assign(p, p.destination);
          this.splash(p.attack, p, target?.id); this.blast(p.attack, p);
          // Impact alerts use an explosion cue, rather than replaying the launch
          // sprite and competing with the next rocket's discharge voice.
          this.effects.noise(p, def.noiseRadius, 'explosion.rocket', p.attack.sourceId, 'explosionLarge');
          this.world.events.emit({ type: 'combat.exploded', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, ...(def.id === 'weapon.flashbang' ? { actionId: def.id } : {}), radius: def.splash?.radius ?? 0, position: { x: p.x, y: p.y, z: p.z } });
          this.projectiles.splice(i, 1);
        }
      } else if (p.landing) {
        const progress = Math.min(1, age / p.flightTicks), time = p.flightTicks / 60;
        p.x = p.from.x + (p.landing.x - p.from.x) * progress; p.z = p.from.z + (p.landing.z - p.from.z) * progress;
        p.y = 0.7 * (1 - progress) + 0.5 * (def.projectile?.gravity ?? 9.81) * time * time * progress * (1 - progress);
        if (progress === 1 && !p.landed) { p.landed = true; this.world.events.emit({ type: 'combat.landed', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, position: { x: p.x, y: p.y, z: p.z } }); }
        if (p.landed && age >= ticks(def.fuse)) {
          if (def.splash) { this.splash(p.attack, p); this.blast(p.attack, p); }
          this.effects.create(p.attack, p);
          if (def.category === 'throwable' && def.damage) this.effects.noise(p, def.noiseRadius, def.id);
          this.world.events.emit({ type: 'combat.exploded', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, ...(def.id === 'weapon.flashbang' ? { actionId: def.id } : {}), radius: def.splash?.radius ?? 0, position: { x: p.x, y: p.y, z: p.z } });
          this.projectiles.splice(i, 1);
        }
      } else if (age > 0) {
        const step = Math.min(def.range - p.travelled, def.projectile!.speed / 60);
        this.origin.x = p.x; this.origin.y = p.y; this.origin.z = p.z;
        let target = this.query.ray(p.attack.sourceId, this.origin, p.attack.aim, step, p.attack.hit);
        const wall = this.query.clearDistance(this.origin, p.attack.aim, step);
        if (!def.splash && this.environment(p.attack, this.origin, p.attack.aim, step, target)) { this.projectiles.splice(i, 1); continue; }
        if (def.splash && (target || wall < step || p.travelled + wall >= def.range)) {
          if (target) { p.x = target.transform.x; p.z = target.transform.z; }
          else { p.x += p.attack.aim.x * wall; p.z += p.attack.aim.z * wall; }
          this.splash(p.attack, p, target?.id); this.blast(p.attack, p); this.effects.noise(p, def.noiseRadius, def.id);
          this.world.events.emit({ type: 'combat.exploded', tick: this.world.tick, sourceId: p.attack.sourceId, attackId: p.attack.id, ...(def.id === 'weapon.flashbang' ? { actionId: def.id } : {}), radius: def.splash?.radius ?? 0, position: { x: p.x, y: p.y, z: p.z } });
          this.projectiles.splice(i, 1); continue;
        }
        while (target && p.attack.hit.size < def.maxTargets) {
          this.hit(p.attack, target, this.origin, 'bullet', 1, p.from);
          if (p.attack.hit.size > def.projectile!.pierce) break;
          target = this.query.ray(p.attack.sourceId, this.origin, p.attack.aim, step, p.attack.hit);
        }
        p.x += p.attack.aim.x * wall; p.z += p.attack.aim.z * wall; p.travelled += wall;
        p.y += (p.attack.aim.y ?? 0) * wall - def.projectile!.gravity * (age - 0.5) / 3600;
        if (wall < step || p.travelled >= def.range || p.y < 0 || p.attack.hit.size > def.projectile!.pierce || p.attack.hit.size >= def.maxTargets) this.projectiles.splice(i, 1);
      }
    }
  }
  snapshot() {
    const attack = (a: Attack) => ({ id: a.id, sourceId: a.sourceId, side: a.side, actionId: a.def.id, autoAim: a.autoAim, combo: a.combo, inPlace: a.inPlace, aim: a.aim, aimPoint: a.aimPoint, started: a.started, activeAt: a.activeAt, recoveryAt: a.recoveryAt, endsAt: a.endsAt, resolved: a.resolved, hit: [...a.hit] });
    const buffered = this.runner.snapshotBuffer();
    return { ...(this.effects.zones.length ? { zones: this.effects.snapshot() } : {}), ...(Object.keys(buffered).length ? { buffered } : {}), sequence: this.runner.lastAttackId, gunReady: { ...this.runner.gunReady }, chains: this.runner.snapshotChains(), rng: this.rng.snapshot(), god: this.damage.god, infiniteCharges: this.runner.infiniteCharges, aimAssist: this.assist.setting, water: this.status.water, running: Object.values(this.runner.running).map(attack), projectiles: this.projectiles.map((p) => ({ ...p, attack: attack(p.attack) })) };
  }
}
