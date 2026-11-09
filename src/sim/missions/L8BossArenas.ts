import { l8BossArenas, l8EncounterGates, l8YardGates, l8YardWalls, type L8BossId } from '../../data/l8Bosses';
import type { InfectedSpecialMove } from '../../data/infected';
import { propFootprint } from '../interact/PropSystem';
import { boxContact, type SolidBox } from '../world/SolidGeometry';
import { Status } from '../combat/Status';
import { resetResponse } from '../locomotion/MotionResponse';
import type { EntitySnapshot } from '../world/types';
import type { Mission } from './Mission';
import { requireClearPoint } from './missionHelpers';

export interface L8ArenaState {
  id: L8BossId; ids: number[]; carrier: number; phase: 0 | 1 | 2 | 3; startedAt: number; endedAt: number;
  nextAt: number; cycle: number; wallHits: number; wallContacts?: string[]; breachAt?: number; carrierRetryAt?: number; grabs: number; counters: number;
  lane?: { x: number; side: 1 | -1; staging: boolean; startedAt?: number };
  track?: { x: number; z: number; vx: number; vz: number; turn: number; at: number };
}
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** Arena state belongs to the L8 checkpoint seam. Turns retain the original healthy animal's entity ID. */
export class L8BossArenas {
  private readonly gateStates = new Map<string, boolean>();
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  get state(): L8ArenaState[] { return this.mission.l8!.state.arenas; }
  prepare(): void {
    const w = this.w, zoo = this.mission.l8!, civilians = w.npcs!.civilians;
    for (const def of l8BossArenas) {
      this.mission.def.anchors[`arena-${def.id}`] = { x: def.entry.x, z: def.entry.z, radius: 2 };
      const ids = zoo.state.animals.filter(id => w.entities.get(id)?.civilian?.zooAnimal === def.id || w.entities.get(id)?.archetype === `infected.${def.id}`);
      const first = w.entities.get(ids[0])?.transform ?? def.centre;
      const originalCount = ids.length;
      for (let i = ids.length; i < def.count; i++) {
        const offset = i - originalCount + 1;
        const at = def.id === 'monkey'
          ? requireClearPoint(w, { x: -17 + (offset % 3) * 2.6, z: 23 + Math.floor(offset / 3) * 2.4 }, .5, 3, `l8.${def.id}.healthy`)
          : requireClearPoint(w, { x: first.x + offset * 1.3, z: first.z }, .5, 10, `l8.${def.id}.healthy`);
        const to = def.id === 'monkey' ? null : requireClearPoint(w, { x: at.x + 1.5, z: at.z }, .5, 4, `l8.${def.id}.routine`);
        const waypoints = def.id === 'monkey'
          ? [0, 1, 2, 3].map(n => ({ x: -18 + ((offset * 3 + n * 5) % 8), z: 22 + ((offset * 5 + n * 3) % 9) }))
          : [at, to!];
        if (def.id === 'monkey') waypoints[2] = { x: -15.35, z: 27 };
        const id = civilians.spawn('cashier', at, { zooAnimal: def.id === 'lion' ? 'lioness' : def.id, waypoints });
        if (def.id === 'monkey') {
          const c = w.entities.get(id)!.civilian!;
          c.pauseUntil = w.tick + 30 + offset * 23; c.waypoint = offset % waypoints.length;
          c.l1!.walkSpeed = .65 + offset * .055;
        }
        ids.push(id); zoo.state.animals.push(id);
      }
      this.state.push({ id: def.id, ids, carrier: 0, phase: 0, startedAt: 0, endedAt: 0, nextAt: 0, cycle: 0, wallHits: 0, grabs: 0, counters: 0 });
    }
    this.updateGates();
  }
  /** Closed keeper gates sit at the far end of each enclosure, leaving the authored entry open for its fight. */
  private updateGates(): void {
    const breached = this.state.some(a => a.id === 'elephant' && !!a.breachAt);
    if (this.gateStates.get('breach') !== breached) {
      this.gateStates.set('breach', breached);
      this.barrier('l8.yard-wall.2', 900812, { ...l8YardWalls[2], y: 1.5, halfY: 1.5 }, !breached);
    }
    const yardClosed = this.state.some(a => a.id !== 'elephant' && a.phase !== 3);
    if (this.gateStates.get('yard') !== yardClosed) {
      this.gateStates.set('yard', yardClosed);
      l8YardWalls.forEach((wall, i) => this.barrier(`l8.yard-wall.${i}`, 900810 + i, { ...wall, y: 1.5, halfY: 1.5 }, !(i === 2 && breached)));
      l8YardGates.forEach((gate, i) => this.barrier(`l8.yard-gate.${i}`, 900820 + i, { ...gate, y: 1.5, halfY: 1.5 }, yardClosed));
    }
    const gates = l8EncounterGates;
    for (const arena of this.state) {
      const gate = gates[arena.id];
      // Keep the tunnel's authored walk-out open while it can still reach a
      // healthy pack member. The yard's keeper locks already block the escape.
      const allTurned = arena.ids.every(id => { const e = this.w.entities.get(id); return !e?.civilian || e.health.current <= 0; });
      const closed = arena.id === 'elephant' ? !!this.mission.state.states.breached && arena.phase !== 3 : arena.phase > 0 && arena.phase < 3 && allTurned;
      if (this.gateStates.get(arena.id) === closed) continue;
      this.gateStates.set(arena.id, closed);
      this.barrier(`l8.arena-gate.${arena.id}`, 900830 + l8BossArenas.findIndex(a => a.id === arena.id), { ...gate, y: 1, halfY: 1 }, closed);
    }
  }
  private barrier(id: string, navId: number, wall: SolidBox, closed: boolean): void {
    this.w.solids.setBarrier(id, closed ? wall : null);
    this.w.events.emit({ type: 'world.blocker.changed', tick: this.w.tick, id: navId, blocked: closed, wall });
  }
  /** Called by the shared same-ID turn event before the ordinary infected brain can leave the enclosure. */
  turned(id: number): void {
    const arena = this.state.find(a => a.ids.includes(id)), e = this.w.entities.get(id);
    if (!arena || !e?.infected) return;
    const def = l8BossArenas.find(a => a.id === arena.id)!;
    e.health.current = e.health.max = def.hp;
    e.infected.arenaBoss = { arena: arena.id, slot: arena.ids.indexOf(id), engaged: arena.phase > 0, exposedUntil: 0, readyAt: 0 };
    e.combat!.allyResist = .1; e.infected.grabUntil = 0; e.infected.state = 'chase';
    if (arena.id === 'monkey' && e.infected.arenaBoss.slot === def.count - 1) { e.health.current = e.health.max = def.hp * 2; e.combat!.radius = .42; }
  }
  update(): void {
    if (!this.mission.state.states.breached) return;
    this.updateGates();
    const w = this.w, player = w.entities.get(1)!;
    for (const arena of this.state) {
      if (arena.phase === 3) continue;
      const def = l8BossArenas.find(a => a.id === arena.id)!;
      const previous = this.state[this.state.indexOf(arena) - 1];
      const routeOpen = !previous || previous.phase === 3;
      // The old elephant stays healthy in his enclosure until the vehicle-yard
      // finale is reachable; an early distant health bar must not be a dormant boss.
      if (arena.id === 'elephant' && !routeOpen) continue;
      this.observeMotion(arena, player);
      const healthy = arena.ids.map(id => w.entities.get(id)).filter(e => e?.civilian && !e.infection && e.health.current > 0);
      // Residents physically walk from real tunnels to animals; a player can interrupt every grab.
      if (arena.carrier && (w.entities.get(arena.carrier)?.health.current ?? 0) <= 0) { arena.carrier = 0; arena.carrierRetryAt = w.tick + 300; }
      if (!arena.carrier && healthy.length && w.tick >= (arena.carrierRetryAt ?? 0)) arena.carrier = arena.id === 'flamingo' && !this.mission.l8!.state.animalBiteStarted ? 0 : arena.id === 'flamingo' && (w.entities.get(this.mission.l8!.state.animalInterceptionId)?.health.current ?? 0) > 0 ? this.mission.l8!.state.animalInterceptionId : this.mission.l8!.arenaCarrier(healthy[0]!.id);
      const carrier = w.entities.get(arena.carrier), victim = healthy[0];
      if (carrier?.infected && carrier.health.current > 0 && !carrier.emerging && victim) {
        if (carrier.infected.arenaCarrier !== victim.id) { w.infected!.pursueTarget(carrier.id, victim.id); carrier.infected.arenaCarrier = victim.id; }
        if (distance(carrier.transform, victim.transform) < 1.8 && victim.civilian!.state !== 'grabbed') w.npcs!.civilians.outbreak!.grab(victim, carrier);
      }
      const live = arena.ids.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.infected && e.health.current > 0);
      if (arena.id === 'elephant' && arena.phase === 1) {
        const elephant = w.entities.get(arena.ids[0]);
        if (elephant?.emerging && w.tick - arena.startedAt >= 60) elephant.emerging = false;
      }
      const provoked = live.some(e => e.infected!.provoked?.id === 1 && (e.infected!.provoked?.until ?? 0) > w.tick);
      const hale = w.entities.get(this.mission.l8!.state.haleId);
      const finaleReady = arena.id !== 'elephant' || !hale || hale.health.current <= 0 || distance(hale.transform, this.mission.l8!.door()) < 2.5;
      if (arena.phase === 0 && arena.ids.every(id => (w.entities.get(id)?.health.current ?? 0) <= 0)) {
        arena.phase = 3; arena.endedAt = w.tick; this.signal(arena, 'cleared'); continue;
      }
      if (arena.phase === 0 && finaleReady && (routeOpen || provoked) && live.length && (distance(player.transform, def.entry) < 12 || arena.id === 'elephant' && distance(player.transform, def.centre) < def.radius || provoked)) {
        arena.phase = 1; arena.startedAt = w.tick; arena.nextAt = w.tick + 90;
        if (arena.id === 'elephant') {
          // The old elephant breaks into the vehicle yard for the final stand;
          // preserve the turned animal's entity and health for the whole fight.
          const elephant = live[0]!;
          const breached = w.solids.relocate(elephant, { x: 89, z: 42, y: .7 }, 'l8.elephant-wall-breach', 2);
          if (breached) {
            elephant.emerging = true; elephant.infected!.path.length = 0; elephant.infected!.goal = -1;
            elephant.transform.yaw = -Math.atan2(player.transform.z - elephant.transform.z, player.transform.x - elephant.transform.x);
            const door = this.mission.l8!.door(), dx = door.x - elephant.transform.x, dz = door.z - elephant.transform.z, d = Math.hypot(dx, dz) || 1;
            this.start(elephant, 'elephant.charge', 60, d, 1.75, { x: dx / d, z: dz / d });
            arena.nextAt = w.tick + 360;
          }
        }
        for (const e of live) e.infected!.arenaBoss!.engaged = !(arena.id === 'lion' && e.infected!.arenaBoss!.slot === 1 || arena.id === 'monkey' && e.infected!.arenaBoss!.slot === 6);
        this.mission.checkpoint(`arena-${arena.id}`, def.entry);
        this.announce(`${def.name}: ${def.counter}`); this.signal(arena, 'engaged');
      }
      if (!arena.phase) continue;
      const unturned = arena.ids.filter(id => !!w.entities.get(id)?.civilian && (w.entities.get(id)?.health.current ?? 0) > 0).length;
      const total = arena.ids.reduce((hp, id) => { const e = w.entities.get(id); return hp + (e?.civilian && e.health.current > 0 ? def.hp : Math.max(0, e?.health.current ?? 0)); }, 0);
      const halfDown = arena.ids.filter(id => { const e = w.entities.get(id); return e?.infected && e.health.current <= 0; }).length >= Math.ceil(def.count / 2);
      const first = w.entities.get(arena.ids[0]);
      const secondPhase = arena.id === 'lion' ? !!first?.infected && first.health.current <= first.health.max / 2 : arena.id === 'elephant' ? arena.wallHits > 0 || total <= def.hp / 2 : ['flamingo', 'zebra', 'monkey'].includes(arena.id) ? halfDown : total <= def.hp * def.count / 2;
      if (arena.phase === 1 && secondPhase) {
        arena.phase = 2; if (arena.id === 'monkey') this.announce('The leader is coming out — stop him to scatter the pack!'); if (arena.id !== 'elephant') arena.nextAt = Math.min(arena.nextAt, w.tick + 60); this.signal(arena, 'phase-2');
      }
      const leader = w.entities.get(arena.ids.at(-1)!);
      if (!unturned && !live.length || arena.id === 'monkey' && arena.phase === 2 && leader?.infected && leader.health.current <= 0) {
        arena.phase = 3; arena.endedAt = w.tick;
        for (const e of live) { w.infected!.cancelSpecial(e.id); e.infected!.arenaBoss!.engaged = false; e.infected!.state = 'scatter'; e.infected!.arenaBoss!.scattered = true; }
        this.signal(arena, 'cleared');
      }
    }
  }
  /** Finite, physical animal-contact leg. Ordinary damage/grab interruption still owns its failure. */
  controlCarrier(e: EntitySnapshot): boolean {
    const b = e.infected!, target = this.w.entities.get(b.arenaCarrier ?? 0);
    if (!target?.civilian || target.health.current <= 0 || target.infection) { delete b.arenaCarrier; return false; }
    if (e.emerging) return false;
    b.state = 'chase'; e.combat!.attacking = false;
    this.w.npcs!.move(e, target.transform, 4.8, b, .8, 48000);
    return true;
  }
  /** Intent runs in the normal infected phase; static sweeps and Damage remain authoritative. */
  control(e: EntitySnapshot): boolean {
    const boss = e.infected?.arenaBoss;
    if (!boss) return false;
    const w = this.w, arena = this.state.find(a => a.id === boss.arena)!;
    const def = l8BossArenas.find(a => a.id === boss.arena)!, p = w.entities.get(1)!, b = e.infected!;
    const roofHarasser = arena.id === 'monkey' && (boss.slot === 2 || boss.slot === 5);
    if (roofHarasser) {
      const inArena = distance(p.transform, def.centre) <= def.radius;
      if (arena.phase > 0 && arena.phase < 3 && inArena && !boss.roof && !boss.traversal && !boss.scattered && w.tick >= boss.readyAt) this.traverse(e, { x: -12, y: 4.8, z: boss.slot === 2 ? 12.5 : 15.5 }, true);
      if ((!inArena || boss.scattered) && (boss.roof || boss.traversal?.roof) && (!boss.traversal || boss.traversal.roof)) {
        w.infected!.cancelSpecial(e.id);
        this.traverse(e, { x: -6, y: .7, z: 14 }, false);
      }
      if (boss.traversal) { this.traverseStep(e); return true; }
      if (boss.roof) {
        if (b.specialAttack) this.advanceMove(e, arena);
        else if (arena.phase > 0 && arena.phase < 3 && w.tick >= boss.readyAt) {
          if (w.infected!.props.nearestObject(e, 3)) { this.start(e, 'monkey.debris', 48, 0, 1.2); boss.readyAt = w.tick + 120; }
          else { this.traverse(e, { x: -6, y: .7, z: 14 }, false); boss.readyAt = w.tick + 360; }
        }
        return true;
      }
    }
    if (boss.scattered) { this.walk(e, { x: def.centre.x + 10, z: def.centre.z - 8 }, 6); return true; }
    if (!arena.phase) {
      const victim = arena.ids.map(id => w.entities.get(id)).find(v => v?.civilian && !v.infection && v.health.current > 0);
      if (victim) {
        this.walk(e, victim.transform, 3);
        if (distance(e.transform, victim.transform) < 1.8 && victim.civilian!.state !== 'grabbed') w.npcs!.civilians.outbreak!.grab(victim, e);
      } else this.orbit(e, arena, def.centre, 2);
      return true;
    }
    boss.engaged = arena.phase !== 3 && !(arena.id === 'lion' && boss.slot === 1 && arena.phase < 2 || arena.id === 'monkey' && boss.slot === 6 && arena.phase < 2);
    if (p.health.current <= 0 || arena.phase === 3) return true;
    if (arena.id === 'zebra' || arena.id === 'elephant') {
      const progress = boss.motionProgress;
      if (!progress || b.specialAttack || distance(e.transform, progress) > .02) boss.motionProgress = { ...e.transform, at: w.tick };
      else if (w.tick - progress.at >= 90) {
        // A blocked fence approach becomes a new, visible charge at the courier.
        // Never leave a large animal waiting indefinitely for its navigation goal.
        this.start(e, arena.id === 'elephant' ? 'elephant.charge' : 'zebra.stampede', 60, arena.id === 'elephant' ? 44 : 36, arena.id === 'elephant' ? 1.75 : .9);
        boss.motionProgress = { ...e.transform, at: w.tick }; return true;
      }
    }

    if (arena.id === 'lion' && boss.slot === 1 && arena.phase < 2) { this.walk(e, { x: -66, z: -42 }, 3); return true; }
    if (arena.id === 'monkey' && boss.slot === def.count - 1 && arena.phase < 2) { this.walk(e, { x: -22, z: 14 }, 3.5); return true; }
    if (arena.id === 'monkey' && boss.slot === 6 && arena.phase === 2 && !boss.leaderEntered) {
      this.walk(e, { x: -6, z: 14 }, 6);
      if (distance(e.transform, { x: -6, z: 14 }) < 1) boss.leaderEntered = true;
      else return true;
    }
    if (b.grabUntil > w.tick) {
      if ((boss.shakeHits ?? 0) > 0 && arena.id === 'monkey' || arena.id === 'lion' && b.grabHits >= 2) { b.grabUntil = 0; arena.counters++; this.recover(e, 120); }
      else {
        if (arena.id === 'monkey' && w.tick >= b.grabNextTick && distance(e.transform, p.transform) < 1.8 && w.combat!.query.visible(e.transform, p.transform)) {
          b.grabNextTick = w.tick + 30;
          const attackId = w.infected!.arenaAttackId();
          const amount = w.combat!.damage.apply({ sourceId: e.id, targetId: 1, attackId, actionId: 'infected.monkey.grab', origin: e.transform, direction: { x: b.dx, z: b.dz }, base: 20, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
          w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: e.id, targetId: 1, attackId, special: 'monkey.grab', amount });
        }
        this.walk(e, p.transform, 2); return true;
      }
    }
    if (b.specialAttack?.move === 'gorilla.roar' && b.specialAttack.stage === 'telegraph' && b.grabHits > 0) { arena.counters++; this.recover(e, 120); return true; }
    if (b.specialAttack) { this.advanceMove(e, arena); return true; }
    if (Status.stunned(e, w.tick)) return true;
    if (w.tick < boss.readyAt) { if (arena.id === 'elephant') this.walk(e, this.predict(e, .8, arena), 5); else this.orbit(e, arena, p.transform, 3); return true; }
    if (boss.followUpThrow) { delete boss.followUpThrow; this.scavenge(e); }
    if (boss.approach) {
      const move = boss.approach, radius = move === 'gorilla.roar' ? 8 : 5;
      if (distance(e.transform, p.transform) > radius - .8) { this.walk(e, this.predict(e, .8, arena), arena.phase === 2 ? 6.5 : 5.5); return true; }
      delete boss.approach; this.start(e, move, 60, 0, radius); return true;
    }
    if (boss.hunt) {
      const hunt = boss.hunt;
      if (distance(e.transform, hunt) > 1.2 && w.tick < hunt.until) { this.walk(e, hunt, hunt.flank ? 7 : 4); return true; }
      if (distance(e.transform, p.transform) > 9) { hunt.until = w.tick; this.walk(e, p.transform, 6.5); return true; }
      delete boss.hunt; this.start(e, hunt.flank ? 'lion.flank' : 'lion.pounce', 36, 10, 1); return true;
    }
    if (arena.id === 'gorilla' && boss.barrage && !boss.scavengeId) this.scavenge(e);
    if (boss.scavengeId) {
      if (arena.id === 'gorilla' || arena.id === 'monkey') {
        const progress = boss.scavengeProgress;
        if (!progress || distance(e.transform, progress) > .25) boss.scavengeProgress = { x: e.transform.x, z: e.transform.z, at: w.tick };
        else if (w.tick - progress.at >= 120) {
          // A displaced prop can leave a locally blocked route. Resume the fight
          // rather than spending the whole phase trying to walk through cover.
          delete boss.scavengeId; delete boss.scavengeProgress; boss.barrage = 0;
          b.path.length = 0; b.goal = -1;
          if (arena.id === 'gorilla') boss.approach = 'gorilla.pound';
          else this.start(e, 'monkey.grab', 48, 10, .8);
          return true;
        }
      }
      const object = w.entities.get(boss.scavengeId), prop = w.props?.items.find(p => p.entityId === boss.scavengeId);
      const pose = prop?.body.translation() ?? object?.transform;
      if (!pose) { delete boss.scavengeId; delete boss.scavengeProgress; }
      else if (distance(e.transform, pose) > 2.4) { this.walk(e, pose, arena.phase === 2 ? 5.5 : 4); return true; }
      else { delete boss.scavengeId; delete boss.scavengeProgress; this.start(e, arena.id === 'monkey' ? 'monkey.debris' : 'gorilla.grab-throw', arena.phase === 2 ? 36 : 48, 0, 1); return true; }
    }
    if (boss.smashId) {
      const object = w.destruction?.objects.find(o => o.id === boss.smashId);
      if (!object || object.state.collapsed) delete boss.smashId;
      else { const pose = w.destruction!.pose(object).p, at = { x: pose[0], z: pose[2] };
        if (distance(e.transform, at) > 1.6) { this.walk(e, at, 5); return true; }
        this.start(e, 'gorilla.pound', 60, 0, 5); return true;
      }
    }
    if (arena.id === 'zebra' && distance(e.transform, p.transform) < 2 && w.tick >= boss.readyAt) { this.start(e, 'zebra.kick', 36, 0, 2); boss.readyAt = w.tick + 360; return true; }
    if (arena.id === 'zebra' && arena.lane?.staging) {
      const lane = arena.lane;
      const aim = this.predict(e, 1 + Math.abs(p.transform.z - (lane.side === 1 ? 16 : 48)) / 15, arena);
      lane.x = Math.max(46, Math.min(74, aim.x));
      const goal = { x: lane.x + (boss.slot - 1.5) * .95, z: lane.side === 1 ? 16 : 48 };
      this.walk(e, goal, 7);
      const members = arena.ids.map(id => w.entities.get(id)).filter((v): v is EntitySnapshot => !!v?.infected && v.health.current > 0);
      const ready = members.every(v => !v.infected!.specialAttack && w.tick >= v.infected!.arenaBoss!.readyAt);
      const aligned = members.every(v => distance(v.transform, { x: lane.x + (v.infected!.arenaBoss!.slot - 1.5) * .95, z: goal.z }) < 1.6);
      // A straggler at a fence must not leave the rest of the herd waiting.
      if (ready && aligned || w.tick - (lane.startedAt ?? w.tick) >= 90) {
        lane.staging = false; arena.nextAt = w.tick + (arena.phase === 2 ? 360 : 480);
        for (const member of members) this.start(member, 'zebra.stampede', 60, 36, .9, { x: 0, z: lane.side });
      }
      return true;
    }
    const lead = arena.ids.find(id => { const member = w.entities.get(id); return member && member.health.current > 0 && !member.infected?.arenaBoss?.roof && !member.infected?.arenaBoss?.traversal; }) === e.id;
    if (lead && w.tick >= arena.nextAt) {
      arena.cycle++; arena.nextAt = w.tick + (arena.id === 'elephant' ? arena.phase === 2 && arena.wallHits === 0 ? 1080 : 1320 : arena.phase === 2 ? 300 : 420); this.beginCycle(e, arena);
    } else if (arena.id === 'lion' && arena.phase === 2 && boss.slot === 1 && w.tick >= boss.readyAt) {
      this.hunt(e, true); boss.readyAt = w.tick + 360;
    } else if (arena.id === 'elephant' && distance(e.transform, p.transform) < 4) {
      this.start(e, 'elephant.swipe', 42, 0, 5.5); boss.readyAt = w.tick + 420;
    } else if (arena.id === 'elephant') this.walk(e, this.predict(e, .8, arena), 5);
    else this.orbit(e, arena, p.transform, arena.id === 'flamingo' ? 6 : 4);
    return true;
  }
  /** Lead uses resolved past movement, including a sustained turn. Changing direction after the cue beats it. */
  private observeMotion(arena: L8ArenaState, p: EntitySnapshot): void {
    const w = this.w;
    const observed = arena.ids.some(id => { const e = w.entities.get(id); return e?.infected && e.health.current > 0 && distance(e.transform, p.transform) <= 32 && (w.combat!.query.visible(e.transform, p.transform) || w.infected!.hearing.hears(e, p.transform, 1)); });
    if (!observed) return;
    const last = arena.track, dt = last ? (w.tick - last.at) / 60 : 0;
    const dx = last ? p.transform.x - last.x : 0, dz = last ? p.transform.z - last.z : 0;
    const valid = dt > 0 && dt < .1 && Math.hypot(dx, dz) < 1;
    const vx = valid ? dx / dt : 0, vz = valid ? dz / dt : 0;
    const turn = last && Math.hypot(vx, vz) > 1 && Math.hypot(last.vx, last.vz) > 1 ? Math.max(-1.2, Math.min(1.2, Math.atan2(last.vx * vz - last.vz * vx, last.vx * vx + last.vz * vz) / dt)) : 0;
    arena.track = { x: p.transform.x, z: p.transform.z, vx, vz, turn: (last?.turn ?? 0) * .8 + turn * .2, at: w.tick };
  }
  private predict(e: EntitySnapshot, seconds: number, arena: L8ArenaState): { x: number; z: number } {
    const p = this.w.entities.get(1)!.transform, t = arena.track;
    if (!t) return this.w.combat!.query.visible(e.transform, p) && distance(e.transform, p) <= 32 ? { x: p.x, z: p.z } : { x: e.transform.x + Math.cos(e.transform.yaw) * 6, z: e.transform.z - Math.sin(e.transform.yaw) * 6 };
    if (this.w.tick - t.at > 2) return { x: t.x, z: t.z };
    if (Math.abs(t.turn) < .05) return { x: p.x + t.vx * seconds, z: p.z + t.vz * seconds };
    const angle = t.turn * seconds, s = Math.sin(angle), c = Math.cos(angle);
    return { x: p.x + (t.vx * s + t.vz * (c - 1)) / t.turn, z: p.z + (t.vx * (1 - c) + t.vz * s) / t.turn };
  }
  private beginCycle(e: EntitySnapshot, arena: L8ArenaState): void {
    const live = arena.ids.map(id => this.w.entities.get(id)).filter((v): v is EntitySnapshot => !!v?.infected && v.health.current > 0);
    if (arena.id === 'flamingo') {
      // A rotating line of three dives while the rest circles; the lane always leaves a sidestep.
      for (let i = 0; i < Math.min(3, live.length); i++) this.start(live[(arena.cycle * 3 + i) % live.length], 'flamingo.dive', 36, 15, 1.1);
    }
    else if (arena.id === 'zebra') {
      const side = arena.cycle % 2 ? 1 : -1, predicted = this.predict(e, 2.2, arena);
      arena.lane = { x: Math.max(46, Math.min(74, predicted.x)), side, staging: true, startedAt: this.w.tick };
    }
    else if (arena.id === 'lion') {
      if (arena.phase === 2 && arena.cycle % 2 === 0) {
        this.start(e, 'lion.roar', 36, 0, 8);
        const lioness = live.find(v => v.infected!.arenaBoss!.slot === 1);
        if (lioness && !lioness.infected!.specialAttack) this.hunt(lioness, true);
      } else this.hunt(e, false);
    }
    else if (arena.id === 'elephant') this.start(e, 'elephant.charge', 54, 44, 1.75);
    else if (arena.id === 'gorilla') {
      const pillar = arena.phase === 2 && arena.cycle % 2 === 0 ? this.w.destruction?.objects.filter(o => o.id.includes('l8-gorilla-pillar') && !o.state.collapsed).sort((a, b) => distance(e.transform, { x: a.home.p[0], z: a.home.p[2] }) - distance(e.transform, { x: b.home.p[0], z: b.home.p[2] }))[0] : undefined;
      if (distance(e.transform, this.w.entities.get(1)!.transform) < 5 && this.w.infected!.props.nearestObject(e, 25, true)) { e.infected!.arenaBoss!.barrage = 3; this.scavenge(e); }
      else if (pillar) e.infected!.arenaBoss!.smashId = pillar.id;
      else if (arena.cycle % 3 === 2) this.scavenge(e);
      else e.infected!.arenaBoss!.approach = arena.cycle % 3 === 1 ? 'gorilla.roar' : 'gorilla.pound';
    } else for (const member of live) {
      if (member.infected!.arenaBoss!.roof || member.infected!.arenaBoss!.traversal || member.infected!.arenaBoss!.slot === 6 && arena.phase < 2) continue;
      if ((arena.cycle + member.id) % 3 === 0) this.scavenge(member);
      else this.start(member, 'monkey.grab', 48 + member.infected!.arenaBoss!.slot * 2, 10, .8);
    }
  }
  private hunt(e: EntitySnapshot, flank: boolean): void {
    const p = this.w.entities.get(1)!.transform, dx = e.transform.x - p.x, dz = e.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
    let at = { x: p.x - dz / d * 7, z: p.z + dx / d * 7 };
    if (!flank) {
      const covers = [[-64, -30], [-55, -36], [-66, -40]].map(([x, z]) => { const cx = x - p.x, cz = z - p.z, cd = Math.hypot(cx, cz) || 1; return { x: x + cx / cd * 2, z: z + cz / cd * 2 }; });
      at = covers.sort((a, b) => distance(e.transform, a) - distance(e.transform, b))[0];
    }
    e.infected!.arenaBoss!.hunt = { ...at, until: this.w.tick + (flank ? 150 : 120), flank };
    if (!flank) this.announce('A low growl behind the rocks — watch for the pounce.');
  }
  /** Existing roof is real cover; the fixed climb/drop arc is body-clear and serialized, with no position jump. */
  private traverse(e: EntitySnapshot, to: { x: number; y: number; z: number }, roof: boolean): void {
    const boss = e.infected!.arenaBoss!;
    boss.traversal = { start: this.w.tick, from: { x: e.transform.x, y: e.transform.y, z: e.transform.z }, to, roof };
    e.infected!.perched = true; e.combat!.attacking = false;
  }
  private traverseStep(e: EntitySnapshot): void {
    const boss = e.infected!.arenaBoss!, t = boss.traversal!, f = Math.min(1, (this.w.tick - t.start) / 90);
    this.w.solids.wrote(e, 'l8.monkey-roof');
    Object.assign(e.transform, { x: t.from.x + (t.to.x - t.from.x) * f, y: t.from.y + (t.to.y - t.from.y) * f + Math.sin(Math.PI * f) * 2, z: t.from.z + (t.to.z - t.from.z) * f });
    this.w.spatial.set(e.id, e.transform.x, e.transform.z);
    if (f === 1) { boss.roof = t.roof; e.infected!.perched = t.roof; delete boss.traversal; }
  }
  private scavenge(e: EntitySnapshot): void {
    const object = this.w.infected!.props.nearestObject(e, 25, (e.infected!.arenaBoss!.barrage ?? 0) > 0);
    if (object) { e.infected!.arenaBoss!.scavengeId = object.id; delete e.infected!.arenaBoss!.scavengeProgress; }
    else { e.infected!.arenaBoss!.barrage = 0; if (e.archetype === 'infected.monkey') this.start(e, 'monkey.grab', 60, 10, .8); else e.infected!.arenaBoss!.approach = 'gorilla.pound'; }
  }
  private start(e: EntitySnapshot, move: InfectedSpecialMove, windup: number, range: number, radius: number, axis?: { x: number; z: number }): void {
    const w = this.w, p = w.entities.get(1)!, arena = this.state.find(a => a.id === e.infected!.arenaBoss!.arena)!;
    const speed = arena.id === 'flamingo' ? 17 : arena.id === 'zebra' ? 15 : (move === 'gorilla.grab-throw' || move === 'monkey.debris') && arena.phase === 2 ? 18 : 12;
    const predicted = this.predict(e, Math.min(2.5, windup / 60 + distance(e.transform, p.transform) / speed), arena);
    const target = { id: 1, ...predicted };
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, d = Math.hypot(dx, dz) || 1;
    const attackId = w.infected!.arenaAttackId();
    const a = e.infected!.specialAttack = { move, attackId, stage: 'telegraph', startTick: w.tick, activeTick: w.tick + windup, cooldownExpiry: w.tick + 420, recoveryUntil: 0, target, area: { x: e.transform.x, z: e.transform.z, radius, dx: axis?.x ?? dx / d, dz: axis?.z ?? dz / d }, hitIds: [], ...(arena.id === 'elephant' ? { bait: { x: p.transform.x, z: p.transform.z } } : {}), destination: { x: e.transform.x + (axis?.x ?? dx / d) * range, z: e.transform.z + (axis?.z ?? dz / d) * range } };
    if (move === 'gorilla.roar') e.infected!.arenaBoss!.exposedUntil = a.activeTick;
    if (move === 'gorilla.grab-throw' || move === 'monkey.debris') w.infected!.props.launchSpecial(e, a, 3, 25, arena.phase === 2 ? 18 : 12, true);
    e.infected!.attackId = attackId; e.infected!.state = 'attack'; e.infected!.until = a.activeTick; e.infected!.grabHits = 0; e.infected!.arenaBoss!.shakeHits = 0; e.combat!.attacking = true;
    e.transform.yaw = -Math.atan2(a.area.dz, a.area.dx) + (move === 'zebra.kick' ? Math.PI : 0); if (e.locomotion) resetResponse(e.locomotion);
    w.events.emit({ type: 'telegraph', tick: w.tick, sourceId: e.id, attackId, move, special: move, duration: windup / 60, startTick: w.tick, activeTick: a.activeTick, cooldownExpiry: a.cooldownExpiry, target, area: a.area });
  }
  private advanceMove(e: EntitySnapshot, arena: L8ArenaState): void {
    const w = this.w, b = e.infected!, a = b.specialAttack!, boss = b.arenaBoss!;
    if (a.stage === 'telegraph') {
      if (a.projectile) w.infected!.props.holdSpecial(e, a);
      if (a.move === 'gorilla.roar') boss.exposedUntil = a.activeTick;
      if (w.tick < a.activeTick) return;
      a.stage = 'active'; if (a.projectile) w.events.emit({ type: 'infected.prop-thrown', tick: w.tick, sourceId: e.id, propId: a.projectile.objectId, attackId: a.attackId }); w.events.emit({ type: 'infected.special', tick: w.tick, sourceId: e.id, attackId: a.attackId, move: a.move, stage: 'active' });
    }
    if (a.stage === 'recovery') { if (w.tick >= a.recoveryUntil) { w.events.emit({ type: 'infected.special', tick: w.tick, sourceId: e.id, attackId: a.attackId, move: a.move, stage: 'expiry' }); delete b.specialAttack; b.state = 'chase'; } return; }
    const p = w.entities.get(1)!;
    if (a.move === 'lion.roar') { this.recover(e, 120); return; }
    if (['gorilla.roar', 'gorilla.pound', 'elephant.swipe', 'zebra.kick'].includes(a.move)) {
      if (a.move === 'gorilla.pound' && boss.smashId) {
        const object = w.destruction?.objects.find(o => o.id === boss.smashId);
        if (object && distance(e.transform, { x: object.home.p[0], z: object.home.p[2] }) <= 1.8 && w.destruction!.impact(object.id, 'boss.gorilla.smash', 300)) { arena.counters++; boss.followUpThrow = true; }
        delete boss.smashId;
      }
      const dx = p.transform.x - e.transform.x, dz = p.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      const dot = (dx * a.area.dx + dz * a.area.dz) / (d || 1);
      if (d <= a.area.radius && (a.move !== 'elephant.swipe' || dot >= 0) && (a.move !== 'zebra.kick' || dot >= Math.SQRT1_2)) this.hit(e, a.move === 'gorilla.roar' ? 8 : a.move === 'zebra.kick' ? 25 : a.move === 'elephant.swipe' ? 55 : 30, a.move === 'gorilla.roar' ? 60 : 30);
      this.recover(e, 120); return;
    }
    if (a.move === 'gorilla.grab-throw' || a.move === 'monkey.debris') {
      if (!a.projectile && !w.infected!.props.launchSpecial(e, a, 3, 25, arena.phase === 2 ? 18 : 12)) { this.recover(e, 120); return; }
      if (w.infected!.props.updateSpecial(e, a)) { if (boss.barrage) boss.barrage--; this.recover(e, boss.barrage ? 48 : 120); } return;
    }
    const range = distance(a.area, a.destination!), travelled = distance(e.transform, a.area);
    const speed = arena.id === 'elephant' ? 14 : arena.id === 'zebra' ? 15 : arena.id === 'flamingo' ? arena.phase === 2 ? 21 : 17 : 12;
    const step = Math.min(speed / 60, Math.max(0, range - travelled));
    if (arena.id === 'elephant' && !arena.breachAt && e.transform.x > 84 && e.transform.x < 92 && e.transform.z < 46 && e.transform.z + e.combat!.radius + step >= 45.35) {
      const wall = w.destruction?.objects.find(o => o.id === 'D-ZOO/l8-yard-north-wall');
      if (wall) {
        // This military wall is protected from incidental player fire until the
        // elephant's telegraphed contact resolves through the destruction owner.
        wall.protected = false;
        w.destruction!.impact(wall.id, 'boss.elephant.charge', 1000);
        arena.breachAt = w.tick; this.updateGates();
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l8.elephant-wall-breach', actorId: e.id });
      }
    }

    const staticClear = w.solids.sweep(e, { x: a.area.dx, z: a.area.dz }, step, e.combat!.radius, false, false);
    let clear = w.solids.sweep(e, { x: a.area.dx, z: a.area.dz }, step, e.combat!.radius, arena.id === 'zebra' || arena.id === 'elephant' ? 'side' : false, true);
    if (arena.id === 'flamingo' && !w.infected!.nav.clear(e.transform.x + a.area.dx * clear, e.transform.z + a.area.dz * clear, e.combat!.radius)) clear = 0;
    w.solids.wrote(e, 'l8.arena-special'); e.transform.x += a.area.dx * clear; e.transform.z += a.area.dz * clear;
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    if (distance(e.transform, p.transform) <= a.area.radius + .35) {
      const firstContact = !a.hitIds.includes(1);
      this.hit(e, arena.id === 'elephant' ? 70 : arena.id === 'monkey' ? 35 : arena.id === 'flamingo' ? 30 : arena.id === 'lion' ? 70 : 35, arena.id === 'elephant' ? 70 : 0);
      if (firstContact && (arena.id === 'lion' || arena.id === 'monkey')) { b.grabUntil = w.tick + 120; b.grabNextTick = w.tick + 30; b.grabHits = 0; b.heardTargetId = 1; arena.grabs++; }
    }
    if (clear + .001 < step || travelled + step >= range || w.tick - a.activeTick > (range / speed + 1) * 60) {
      const side = Math.abs((p.transform.x - a.area.x) * a.area.dz - (p.transform.z - a.area.z) * a.area.dx);
      const barrier = arena.id === 'elephant' && staticClear + .001 < step ? this.elephantBarrier(e) : undefined;
      // A near wall/truck still counts after a real lured run and sidestep; the elephant need not pass the old bait pose.
      if (arena.id === 'elephant' && barrier && distance(e.transform, a.area) >= 1 && side > a.area.radius + .35) {
        (arena.wallContacts ??= []).push(barrier); arena.wallHits++; arena.counters++; this.announce('Elephant staggered — fire now!');
        if (arena.wallHits >= 3) w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: a.attackId, actionId: 'arena.elephant.wall', origin: p.transform, direction: { x: a.area.dx, z: a.area.dz }, base: e.health.max * 10, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
      }
      this.recover(e, 120);
    }
  }
  /** A decorative bush can stop a charge, but only authored walls/fences or the yard truck count toward the tactic. */
  private elephantBarrier(e: EntitySnapshot): string | undefined {
    const out = { depth: 0, nx: 0, nz: 0, inside: false };
    const touches = (b: SolidBox) => b.y + b.halfY > e.transform.y - .6 && b.y - b.halfY < e.transform.y + .65 && boxContact(b, e.transform.x, e.transform.z, e.combat!.radius + .03, out).depth >= 0;
    const elephantArena = this.state.find(arena => arena.id === 'elephant');
    if (elephantArena && elephantArena.phase > 0 && elephantArena.phase < 3 && touches({ x: 116, z: 80, y: 1, halfX: .25, halfZ: 8, halfY: 1 })) return 'l8.arena-gate.elephant';
    for (const d of this.w.districts?.districts ?? []) for (const c of d.decay.colliders) {
      if (!/wall|fence/.test(c.id)) continue;
      const { min, max } = c.aabb;
      if (touches({ x: (min[0]+max[0])/2+d.origin[0], z: (min[2]+max[2])/2+d.origin[1], y: (min[1]+max[1])/2, halfX: (max[0]-min[0])/2, halfZ: (max[2]-min[2])/2, halfY: (max[1]-min[1])/2 })) return c.id;
    }
    for (const p of this.w.props?.items ?? []) {
      if (!/wall|fence/.test(p.assetId) && !p.id.endsWith('/l8-elephant-truck') || !p.body.isEnabled()) continue;
      const b = propFootprint(p);
      if (touches(b.navFootprint ? { ...b, ...b.navFootprint } : b)) return p.id;
    }
    return undefined;
  }
  private hit(e: EntitySnapshot, amount: number, stun: number): void {
    const w = this.w, a = e.infected!.specialAttack!, p = w.entities.get(1)!;
    if (a.hitIds.includes(1) || !w.combat!.query.visible(e.transform, p.transform)) return;
    a.hitIds.push(1);
    const damage = w.combat!.damage.apply({ sourceId: e.id, targetId: 1, attackId: a.attackId, actionId: `infected.${a.move}`, origin: e.transform, direction: { x: a.area.dx, z: a.area.dz }, base: amount, multiplier: 1, type: 'melee', knockback: a.move === 'zebra.kick' || a.move === 'elephant.swipe' ? 3 : 0, stagger: 0, knockdownTicks: stun });
    w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: e.id, targetId: 1, attackId: a.attackId, special: a.move, amount: damage });
  }
  private recover(e: EntitySnapshot, ticks: number): void {
    const w = this.w, b = e.infected!, a = b.specialAttack;
    if (b.arenaBoss?.arena === 'gorilla' && a?.move !== 'gorilla.roar') ticks = Math.min(ticks, 60);
    b.arenaBoss!.exposedUntil = w.tick + ticks; b.arenaBoss!.readyAt = Math.max(b.arenaBoss!.readyAt, w.tick + ticks);
    if (a) { a.stage = 'recovery'; a.recoveryUntil = w.tick + ticks; w.events.emit({ type: 'infected.special', tick: w.tick, sourceId: e.id, attackId: a.attackId, move: a.move, stage: 'recovery' }); }
    b.state = 'chase'; e.combat!.attacking = false; if (e.locomotion) resetResponse(e.locomotion);
  }
  private orbit(e: EntitySnapshot, arena: L8ArenaState, at: { x: number; z: number }, speed: number): void {
    const def = l8BossArenas.find(a => a.id === arena.id)!, angle = this.w.tick / 130 + e.infected!.arenaBoss!.slot * Math.PI * 2 / def.count;
    const r = arena.id === 'flamingo' ? 5 : arena.id === 'gorilla' || arena.id === 'elephant' ? 2 : 7;
    const target = { x: at.x + Math.cos(angle) * r, z: at.z + Math.sin(angle) * r };
    this.walk(e, distance(e.transform, def.centre) > def.radius ? def.centre : target, speed);
  }
  private walk(e: EntitySnapshot, at: { x: number; z: number }, speed: number): void { this.w.npcs!.move(e, at, speed, e.infected!, .2, ['elephant', 'gorilla'].includes(e.infected!.arenaBoss!.arena) && e.infected!.arenaBoss!.engaged ? 48000 : 1600); }
  private announce(text: string): void { this.mission.state.subtitle = { id: 'L8.arena', text, until: this.w.tick + 300 }; }
  private signal(arena: L8ArenaState, name: string): void { this.w.events.emit({ type: 'mission.signal', tick: this.w.tick, name: `l8.arena.${arena.id}.${name}` }); }
  statusText(): string | null {
    const p = this.w.entities.get(1)!.transform;
    const arena = this.state.find(a => a.phase > 0 && a.phase < 3 && distance(p, l8BossArenas.find(d => d.id === a.id)!.centre) < 32);
    return arena ? `${l8BossArenas.find(d => d.id === arena.id)!.name} · Phase ${arena.phase}` : null;
  }
  swapBlocked(): boolean { return this.w.infected!.active.some(e => e.health.current > 0 && e.infected!.arenaBoss?.arena === 'monkey' && e.infected!.grabUntil > this.w.tick); }
  restore(delta: number): void { this.gateStates.clear(); this.updateGates(); for (const a of this.state) { if (a.startedAt) a.startedAt += delta; if (a.endedAt) a.endedAt += delta; if (a.nextAt) a.nextAt += delta; if (a.track) a.track.at += delta; if (a.carrierRetryAt) a.carrierRetryAt += delta; if (a.breachAt) a.breachAt += delta; if (a.lane?.startedAt !== undefined) a.lane.startedAt += delta; } }
}
