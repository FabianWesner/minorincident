import { Rng } from '../../core/Rng';
import { civilianRoles, npcs } from '../../data/npcs';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { updateRoutine } from './MorningRoutines';
import type { Civilian, CivilianActivity, CivilianState, Point } from './types';
const mobileStates = new Set<CivilianState>(['calm', 'alarmed', 'flee', 'hide']);
const grabStates = new Set<CivilianState>(['calm', 'alarmed', 'flee']);
const immobileStates = new Set<CivilianState>(['grabbed', 'down', 'rising']);
/** Adult/pet outbreak lifecycle. Children never enter the targeting or infection loop. */
export class Civilians {
  readonly rng: Rng;
  level = 1;
  turns = 0;
  private readonly held = new Set<number>();
  private readonly nearby: number[] = [];
  private readonly query = { x: 0, z: 0, r: npcs.panicRadius };
  constructor(readonly world: SimWorld) {
    this.rng = new Rng(world.seed, 'npc');
    world.events.on('infected.attack', event => {
      if (event.type !== 'infected.attack') return;
      const source = world.entities.get(event.sourceId); if (source) this.alarm(source.transform);
    });
    world.events.on('noise', event => { if (event.type === 'noise' && event.radius >= 6) this.alarm(event.position); });
  }
  private duration(range: readonly [number, number]): number { return range[0] + Math.floor(this.rng.next() * (range[1] - range[0] + 1)); }
  spawn(role: string, position: Point, options: { ambient?: boolean; child?: boolean; pet?: 'dog' | 'cat'; owner?: number; waypoints?: Point[]; model?: string; schedule?: CivilianActivity[]; panicReaction?: 'flee' | 'freeze' } = {}): number {
    const def = civilianRoles.find(d => d.role === role) ?? civilianRoles[0];
    const nav = this.world.infected!.nav;
    if (!nav.clear(position.x, position.z, .35)) throw new RangeError('Civilian spawn outside navigation');
    const waypoints = options.waypoints ?? [position, { x: position.x + 3, z: position.z }, { x: position.x + 3, z: position.z + 3 }, { x: position.x, z: position.z + 3 }];
    if (!waypoints.length || !waypoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && nav.clear(p.x, p.z, .35))) throw new RangeError('Invalid civilian routine');
    const civilian: Civilian = { state: 'calm', ambient: options.ambient ?? false, adult: !options.child, pet: options.pet ?? null, owner: options.owner ?? null, model: options.model ?? ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'][this.world.entities.size % 5], variant: options.pet ? `inf.${options.pet === 'dog' ? 'dog-retriever' : 'cat-tabby'}` : def.variant,
      panicReaction: options.panicReaction, schedule: options.schedule ? structuredClone(options.schedule) : undefined, scheduleStep: 0, activityUntil: 0, activityStarted: 0, travelStarted: this.world.tick,
      routine: options.pet ? 'pet' : options.child ? 'protected' : def.routine, waypoints: structuredClone(waypoints), waypoint: 1 % waypoints.length, pauseUntil: 0,
      entered: this.world.tick, until: 0, downTicks: 0, eyesGlow: false, veins: 0, attacker: 0, threat: { ...position }, path: [], goal: -1, pathIndex: 0, gore: false, knockedUntil: 0 };
    const e = this.world.entities.create({ kind: options.pet ? 'pet' : 'civilian', archetype: options.child ? 'npc.child' : `npc.${role}`, faction: 'civilian', transform: { ...position, y: .7, yaw: 0 }, health: { current: 100, max: 100 }, civilian,
      combat: { radius: .35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } });
    this.world.spatial.set(e.id, position.x, position.z); return e.id;
  }
  private state(e: EntitySnapshot, state: CivilianState, duration = 0): void {
    const c = e.civilian!; if (c.state === 'grabbed' && state !== 'grabbed') this.held.delete(c.attacker); c.state = state; c.entered = this.world.tick; c.until = this.world.tick + duration;
    this.world.events.emit({ type: 'civilian.state', tick: this.world.tick, id: e.id, state, until: c.until });
  }
  alarm(position: Point): void {
    this.query.x = position.x; this.query.z = position.z;
    for (const id of this.world.spatial.query(this.query, this.nearby)) {
      const e = this.world.entities.get(id), c = e?.civilian;
      if (!e || e.hidden || !c?.adult || !mobileStates.has(c.state)) continue;
      Object.assign(c.threat, position); if (c.state === 'calm' || c.state === 'hide') { this.state(e, 'alarmed', c.schedule ? 30 : 12); }
    }
  }
  /** Story beats use the same deterministic cycle as systemic grabs, bypassing only the chance roll. */
  grab(id: number, attackerId: number, scripted = false): boolean {
    const e = this.world.entities.get(id), source = this.world.entities.get(attackerId), c = e?.civilian;
    if (!e || !c?.adult || !source?.infected || source.health.current <= 0 || !mobileStates.has(c.state) || this.turns >= npcs.turnChainLimit[this.level - 1]) return false;
    if (this.holds(attackerId)) return false;
    if (!scripted && !this.world.infected!.tryGrabCivilian(attackerId, { id, adult: c.adult, variant: c.variant, position: e.transform })) return false;
    if (scripted) this.world.events.emit({ type: 'civilian.grabbed', tick: this.world.tick, sourceId: attackerId, targetId: id, variant: c.variant, rescueUntil: this.world.tick + npcs.grabTicks });
    c.attacker = attackerId; this.held.add(attackerId); Object.assign(c.threat, source.transform); this.state(e, 'grabbed', npcs.grabTicks); this.alarm(e.transform);
    if (c.pet) { this.down(e); this.held.delete(attackerId); return true; }
    for (const pet of this.world.entities.iterate()) if (pet.civilian?.owner === id && grabStates.has(pet.civilian.state) && this.rng.next() < npcs.petInfectionChance) this.down(pet);
    return true;
  }
  holds(id: number): boolean { return this.held.has(id); }
  restore(): void { this.held.clear(); this.turns = 0; for (const e of this.world.entities.iterate()) { if (e.civilian?.state === 'grabbed') this.held.add(e.civilian.attacker); if (e.civilian?.state === 'infected') this.turns++; } }
  private down(e: EntitySnapshot): void { const c = e.civilian!; c.downTicks = this.duration(c.pet ? npcs.petDownTicks : npcs.downTicks); this.state(e, 'down', c.downTicks); }
  /** Called before generic damage. Living civilians have no health damage or hit events. */
  hit(e: EntitySnapshot, type: string): void {
    const c = e.civilian!;
    if (c.adult && c.eyesGlow && (c.state === 'down' || c.state === 'rising') && (type === 'melee' || type === 'bullet')) {
      this.state(e, 'finished'); c.eyesGlow = false; this.world.events.emit({ type: 'civilian.finished', tick: this.world.tick, id: e.id });
    } else if (type === 'explosive' && mobileStates.has(c.state)) c.knockedUntil = this.world.tick + 90;
  }
  update(): void {
    const ai = this.world.infected!, tick = this.world.tick;
    for (const e of this.world.entities.iterate()) {
      const c = e.civilian; if (!c || c.state === 'infected' || c.state === 'finished') continue;
      if (!c.adult) continue;
      if (c.state === 'grabbed') {
        const attacker = this.world.entities.get(c.attacker);
        if (!attacker || attacker.health.current <= 0 || attacker.combat!.staggerUntil > tick || Math.hypot(attacker.transform.x - e.transform.x, attacker.transform.z - e.transform.z) > 1.8) {
          this.state(e, 'flee'); this.world.events.emit({ type: 'civilian.saved', tick, id: e.id }); this.world.missions?.civilianSaved(e.id);
        } else if (tick >= c.until) this.state(e, 'bitten', this.duration(npcs.staggerTicks));
      } else if (c.state === 'bitten') { if (tick >= c.until) this.down(e); }
      else if (c.state === 'down') {
        const glowing = tick >= c.until - Math.min(npcs.eyesTicks, c.downTicks); if (glowing && !c.eyesGlow) this.world.events.emit({ type: 'civilian.eyes', tick, id: e.id }); c.eyesGlow = glowing; c.veins = Math.min(1, (tick - c.entered) / c.downTicks);
        if (tick >= c.until && ai.pool.length > 0 && ai.director.count + this.risingCount() < ai.director.cap && this.turns + this.risingCount() < npcs.turnChainLimit[this.level - 1]) this.state(e, 'rising', npcs.risingTicks);
      } else if (c.state === 'rising' && tick >= c.until) {
        if (ai.pool.length > 0 && ai.director.count < ai.director.cap) {
          const infectedId = ai.spawn(c.pet ? `infected.${c.pet}` : 'infected.runner', e.transform, { variant: c.variant, state: 'chase', perched: false });
          this.turns++; this.state(e, 'infected'); e.hidden = true; this.world.spatial.delete(e.id);
          this.world.events.emit({ type: 'civilian.turned', tick, id: e.id, infectedId, variant: c.variant, position: { x: e.transform.x, z: e.transform.z } });
        } else { this.state(e, 'down', 1); }
      }
      if (c.state === 'alarmed') {
        const yaw = -Math.atan2(c.threat.z - e.transform.z, c.threat.x - e.transform.x);
        const delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
        e.transform.yaw += Math.max(-.08, Math.min(.08, delta));
      }
      if (c.state === 'alarmed' && tick >= c.until) {
        if (c.panicReaction === 'freeze') {
          if (ai.active.some(a => a.health.current > 0 && Math.hypot(a.transform.x - e.transform.x, a.transform.z - e.transform.z) < npcs.panicRadius)) c.until = tick + 30;
          else this.state(e, 'calm');
        } else this.state(e, 'flee');
      }
      if (tick < c.knockedUntil || immobileStates.has(c.state)) continue;
      if (c.state === 'flee' || c.state === 'bitten') {
        let dx = e.transform.x - c.threat.x, dz = e.transform.z - c.threat.z, distance = Math.hypot(dx, dz);
        if (!distance) { dx = e.id % 2 ? 1 : -1; dz = .3; distance = Math.hypot(dx, dz); }
        const speed = c.state === 'bitten' ? .6 : npcs.fleeSpeed;
        const targetCell = ai.nav.nearestCell(e.transform.x + dx / distance * 5, e.transform.z + dz / distance * 5);
        if (targetCell >= 0) this.world.npcs!.move(e, { x: ai.nav.x(targetCell), z: ai.nav.z(targetCell) }, speed, c, .2);
        if (c.state === 'flee' && distance > 25) this.state(e, 'hide');
      } else if (c.state === 'calm' && c.schedule) {
        updateRoutine(this.world, e);
      } else if (c.state === 'calm' && tick >= c.pauseUntil) {
        const target = c.owner ? this.world.entities.get(c.owner)?.transform : c.waypoints[c.waypoint];
        if (target) this.world.npcs!.move(e, target, c.routine === 'jog' ? 2.5 : npcs.routineSpeed, c, c.owner ? 1 : .15);
        if (!c.owner && target && Math.hypot(e.transform.x - target.x, e.transform.z - target.z) < .2) {
          c.waypoint = (c.waypoint + 1) % c.waypoints.length;
          c.pauseUntil = tick + this.duration(c.routine === 'chat' || c.routine === 'bus-stop' ? [120, 240] : [45, 120]);
        }
      }
      if (!e.hidden) this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      // Systemic grabs share E07's archetype chance; retry at 2 Hz, not every tick.
      if (!e.hidden && (!c.pet || !c.owner) && tick % 30 === e.id % 30 && grabStates.has(c.state)) {
        for (const infected of ai.active) if (infected.health.current > 0 && Math.hypot(infected.transform.x - e.transform.x, infected.transform.z - e.transform.z) <= 1.2 && this.grab(e.id, infected.id)) break;
      }
    }
  }
  private risingCount(): number { let count = 0; for (const e of this.world.entities.iterate()) if (e.civilian?.state === 'rising') count++; return count; }
}
