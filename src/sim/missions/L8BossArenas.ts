import { l8BossArenas, type L8BossId } from '../../data/l8Bosses';
import type { InfectedSpecialMove } from '../../data/infected';
import { Status } from '../combat/Status';
import { resetResponse } from '../locomotion/MotionResponse';
import type { EntitySnapshot } from '../world/types';
import type { Mission } from './Mission';
import { requireClearPoint } from './missionHelpers';

export interface L8ArenaState {
  id: L8BossId; ids: number[]; carrier: number; phase: 0 | 1 | 2 | 3; startedAt: number; endedAt: number;
  nextAt: number; cycle: number; wallHits: number; rocket: number; grabs: number; counters: number;
  lane?: { x: number; side: 1 | -1; staging: boolean };
  track?: { x: number; z: number; vx: number; vz: number; turn: number; at: number };
}
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** Arena state belongs to the L8 checkpoint seam. Turns retain the original healthy animal's entity ID. */
export class L8BossArenas {
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  get state(): L8ArenaState[] { return this.mission.l8!.state.arenas; }
  prepare(): void {
    const w = this.w, zoo = this.mission.l8!, civilians = w.npcs!.civilians;
    for (const def of l8BossArenas) {
      const ids = zoo.state.animals.filter(id => w.entities.get(id)?.civilian?.zooAnimal === def.id || w.entities.get(id)?.archetype === `infected.${def.id}`);
      const first = w.entities.get(ids[0])?.transform ?? def.centre;
      const originalCount = ids.length;
      for (let i = ids.length; i < def.count; i++) {
        const at = requireClearPoint(w, { x: first.x + (i - originalCount + 1) * 1.3, z: first.z }, .5, 10, `l8.${def.id}.healthy`);
        const to = requireClearPoint(w, { x: at.x + 1.5, z: at.z }, .5, 4, `l8.${def.id}.routine`);
        const id = civilians.spawn('cashier', at, { zooAnimal: def.id === 'lion' ? 'lioness' : def.id, waypoints: [at, to] });
        ids.push(id); zoo.state.animals.push(id);
      }
      this.state.push({ id: def.id, ids, carrier: 0, phase: 0, startedAt: 0, endedAt: 0, nextAt: 0, cycle: 0, wallHits: 0, rocket: 0, grabs: 0, counters: 0 });
    }
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
    const w = this.w, player = w.entities.get(1)!;
    for (const arena of this.state) {
      if (arena.phase === 3) continue;
      const def = l8BossArenas.find(a => a.id === arena.id)!;
      this.observeMotion(arena, player);
      const healthy = arena.ids.map(id => w.entities.get(id)).filter(e => e?.civilian && !e.infection && e.health.current > 0);
      // Residents physically walk from real tunnels to animals; a player can interrupt every grab.
      if (!arena.carrier && healthy.length) arena.carrier = arena.id === 'flamingo' ? this.mission.l8!.state.animalBiteStarted ? this.mission.l8!.state.animalInterceptionId : 0 : this.mission.l8!.arenaCarrier(healthy[0]!.id);
      const carrier = w.entities.get(arena.carrier), victim = healthy[0];
      if (carrier?.infected && carrier.health.current > 0 && !carrier.emerging && victim) {
        if (carrier.infected.arenaCarrier !== victim.id) { w.infected!.pursueTarget(carrier.id, victim.id); carrier.infected.arenaCarrier = victim.id; }
        if (distance(carrier.transform, victim.transform) < 1.8 && victim.civilian!.state !== 'grabbed') w.npcs!.civilians.outbreak!.grab(victim, carrier);
      }
      const live = arena.ids.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.infected && e.health.current > 0);
      if (arena.phase === 0 && live.length && distance(player.transform, def.entry) < 12 && distance(player.transform, def.centre) < def.radius) {
        arena.phase = 1; arena.startedAt = w.tick; arena.nextAt = w.tick + 90; arena.rocket = 0;
        w.combat!.pickups.spawn('weapon.rocket-launcher', def.entry, false, { arenaAmmo: arena.id, retain: true });
        for (const e of live) e.infected!.arenaBoss!.engaged = true;
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
  /** Intent runs in the normal infected phase; static sweeps and Damage remain authoritative. */
  control(e: EntitySnapshot): boolean {
    const boss = e.infected?.arenaBoss;
    if (!boss) return false;
    const w = this.w, arena = this.state.find(a => a.id === boss.arena)!;
    const def = l8BossArenas.find(a => a.id === boss.arena)!, p = w.entities.get(1)!, b = e.infected!;
    const roofHarasser = arena.id === 'monkey' && (boss.slot === 2 || boss.slot === 5);
    if (roofHarasser) {
      if (!boss.roof && !boss.traversal && !boss.scattered) this.traverse(e, { x: -12, y: 4.8, z: boss.slot === 2 ? 12.5 : 15.5 }, true);
      if (boss.roof && boss.scattered && !boss.traversal) this.traverse(e, { x: -6, y: .7, z: 14 }, false);
      if (boss.traversal) { this.traverseStep(e); return true; }
      if (boss.roof) {
        if (b.specialAttack) this.advanceMove(e, arena);
        else if (arena.phase > 0 && arena.phase < 3 && w.tick >= boss.readyAt) {
          if (w.infected!.props.nearestObject(e, 3)) this.start(e, 'monkey.debris', 48, 0, 1.2);
          boss.readyAt = w.tick + (arena.phase === 2 ? 240 : 360);
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
    boss.engaged = arena.phase !== 3;
    if (p.health.current <= 0 || arena.phase === 3) return true;
    if (arena.id === 'lion' && boss.slot === 1 && arena.phase < 2) { this.walk(e, { x: -66, z: -42 }, 3); return true; }
    if (arena.id === 'monkey' && boss.slot === def.count - 1 && arena.phase < 2) { this.walk(e, { x: -22, z: 14 }, 3.5); return true; }
    if (arena.id === 'monkey' && boss.slot === 6 && arena.phase === 2 && !boss.leaderEntered) {
      this.walk(e, { x: -6, z: 14 }, 6);
      if (distance(e.transform, { x: -6, z: 14 }) < 1) boss.leaderEntered = true;
      else return true;
    }
    if (b.grabUntil > w.tick) {
      if ((boss.shakeHits ?? 0) > 0 && arena.id === 'monkey' || arena.id === 'lion' && b.grabHits >= 2) { b.grabUntil = 0; arena.counters++; this.recover(e, 120); }
      else { this.walk(e, p.transform, 2); return true; }
    }
    if (b.specialAttack?.move === 'gorilla.roar' && b.specialAttack.stage === 'telegraph' && b.grabHits > 0) { arena.counters++; this.recover(e, 120); return true; }
    if (b.specialAttack) { this.advanceMove(e, arena); return true; }
    if (w.tick < boss.readyAt || Status.stunned(e, w.tick)) return true;
    if (boss.hunt) {
      const hunt = boss.hunt;
      if (distance(e.transform, hunt) > 1.2 && w.tick < hunt.until) { this.walk(e, hunt, hunt.flank ? 7 : 4); return true; }
      if (distance(e.transform, p.transform) > 9) { hunt.until = w.tick; this.walk(e, p.transform, 6.5); return true; }
      delete boss.hunt; this.start(e, hunt.flank ? 'lion.flank' : 'lion.pounce', 36, 10, 1); return true;
    }
    if (arena.id === 'gorilla' && boss.barrage && !boss.scavengeId) this.scavenge(e);
    if (boss.scavengeId) {
      const object = w.entities.get(boss.scavengeId), prop = w.props?.items.find(p => p.entityId === boss.scavengeId);
      const pose = prop?.body.translation() ?? object?.transform;
      if (!pose) delete boss.scavengeId;
      else if (distance(e.transform, pose) > 2.4) { this.walk(e, pose, arena.phase === 2 ? 5.5 : 4); return true; }
      else { delete boss.scavengeId; this.start(e, arena.id === 'monkey' ? 'monkey.debris' : 'gorilla.grab-throw', arena.phase === 2 ? 36 : 48, 0, 1); return true; }
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
      if (members.every(v => !v.infected!.specialAttack && w.tick >= v.infected!.arenaBoss!.readyAt && distance(v.transform, { x: lane.x + (v.infected!.arenaBoss!.slot - 1.5) * .95, z: goal.z }) < 1.6)) {
        lane.staging = false; arena.nextAt = w.tick + (arena.phase === 2 ? 360 : 480);
        for (const member of members) this.start(member, 'zebra.stampede', 60, 36, .9, { x: 0, z: lane.side });
      }
      return true;
    }
    const lead = arena.ids.find(id => { const member = w.entities.get(id); return member && member.health.current > 0 && !member.infected?.arenaBoss?.roof && !member.infected?.arenaBoss?.traversal; }) === e.id;
    if (lead && w.tick >= arena.nextAt) {
      arena.cycle++; arena.nextAt = w.tick + (arena.id === 'elephant' ? 1320 : arena.phase === 2 ? 300 : 420); this.beginCycle(e, arena);
    } else if (arena.id === 'lion' && arena.phase === 2 && boss.slot === 1 && w.tick >= boss.readyAt) {
      this.hunt(e, true); boss.readyAt = w.tick + 360;
    } else if (arena.id === 'elephant' && distance(e.transform, p.transform) < 3) {
      this.start(e, 'elephant.swipe', 42, 0, 3); boss.readyAt = w.tick + 420;
    } else this.orbit(e, arena, p.transform, arena.id === 'flamingo' ? 6 : 4);
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
      arena.lane = { x: Math.max(46, Math.min(74, predicted.x)), side, staging: true };
    }
    else if (arena.id === 'lion') {
      if (arena.phase === 2 && arena.cycle % 2 === 0) {
        this.start(e, 'lion.roar', 36, 0, 8);
        const lioness = live.find(v => v.infected!.arenaBoss!.slot === 1);
        if (lioness && !lioness.infected!.specialAttack) this.hunt(lioness, true);
      } else this.hunt(e, false);
    }
    else if (arena.id === 'elephant') this.start(e, distance(e.transform, this.w.entities.get(1)!.transform) < 3 ? 'elephant.swipe' : 'elephant.charge', 54, 44, 1.75);
    else if (arena.id === 'gorilla') {
      const pillar = arena.phase === 2 && arena.cycle % 2 === 0 ? this.w.destruction?.objects.filter(o => o.id.includes('l8-gorilla-pillar') && !o.state.collapsed).sort((a, b) => distance(e.transform, { x: a.home.p[0], z: a.home.p[2] }) - distance(e.transform, { x: b.home.p[0], z: b.home.p[2] }))[0] : undefined;
      if (distance(e.transform, this.w.entities.get(1)!.transform) < 5 && this.w.infected!.props.nearestObject(e, 25, true)) { e.infected!.arenaBoss!.barrage = 3; this.scavenge(e); }
      else if (pillar) e.infected!.arenaBoss!.smashId = pillar.id;
      else if (arena.cycle % 3 === 2) this.scavenge(e);
      else this.start(e, arena.cycle % 3 === 1 ? 'gorilla.roar' : 'gorilla.pound', 60, 0, arena.cycle % 3 === 0 ? 5 : 8);
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
    if (object) e.infected!.arenaBoss!.scavengeId = object.id;
    else { e.infected!.arenaBoss!.barrage = 0; this.start(e, e.archetype === 'infected.monkey' ? 'monkey.grab' : 'gorilla.pound', 60, 10, e.archetype === 'infected.monkey' ? .8 : 5); }
  }
  private start(e: EntitySnapshot, move: InfectedSpecialMove, windup: number, range: number, radius: number, axis?: { x: number; z: number }): void {
    const w = this.w, p = w.entities.get(1)!, arena = this.state.find(a => a.id === e.infected!.arenaBoss!.arena)!;
    const speed = arena.id === 'flamingo' ? 17 : arena.id === 'zebra' ? 15 : 12;
    const predicted = this.predict(e, Math.min(2.5, windup / 60 + distance(e.transform, p.transform) / speed), arena);
    const target = { id: 1, ...predicted };
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, d = Math.hypot(dx, dz) || 1;
    const attackId = w.infected!.arenaAttackId();
    const a = e.infected!.specialAttack = { move, attackId, stage: 'telegraph', startTick: w.tick, activeTick: w.tick + windup, cooldownExpiry: w.tick + 420, recoveryUntil: 0, target, area: { x: e.transform.x, z: e.transform.z, radius, dx: axis?.x ?? dx / d, dz: axis?.z ?? dz / d }, hitIds: [], destination: { x: e.transform.x + (axis?.x ?? dx / d) * range, z: e.transform.z + (axis?.z ?? dz / d) * range } };
    if (move === 'gorilla.grab-throw' || move === 'monkey.debris') w.infected!.props.launchSpecial(e, a, 3, 25, arena.phase === 2 ? 18 : 12, true);
    e.infected!.attackId = attackId; e.infected!.state = 'attack'; e.infected!.until = a.activeTick; e.infected!.grabHits = 0; e.infected!.arenaBoss!.shakeHits = 0; e.combat!.attacking = true;
    e.transform.yaw = -Math.atan2(a.area.dz, a.area.dx) + (move === 'zebra.kick' ? Math.PI : 0); if (e.locomotion) resetResponse(e.locomotion);
    w.events.emit({ type: 'telegraph', tick: w.tick, sourceId: e.id, attackId, move, special: move, duration: windup / 60, startTick: w.tick, activeTick: a.activeTick, cooldownExpiry: a.cooldownExpiry, target, area: a.area });
  }
  private advanceMove(e: EntitySnapshot, arena: L8ArenaState): void {
    const w = this.w, b = e.infected!, a = b.specialAttack!, boss = b.arenaBoss!;
    if (a.stage === 'telegraph') {
      if (a.projectile) w.infected!.props.holdSpecial(a);
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
        if (object && distance(e.transform, { x: object.home.p[0], z: object.home.p[2] }) <= 1.8 && w.destruction!.impact(object.id, 'boss.gorilla.smash', 300)) arena.counters++;
        delete boss.smashId;
      }
      const dx = p.transform.x - e.transform.x, dz = p.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      const dot = (dx * a.area.dx + dz * a.area.dz) / (d || 1);
      if (d <= a.area.radius && (a.move !== 'elephant.swipe' || dot >= 0) && (a.move !== 'zebra.kick' || dot >= Math.SQRT1_2)) this.hit(e, a.move === 'gorilla.roar' ? 8 : a.move === 'zebra.kick' ? 25 : a.move === 'elephant.swipe' ? 45 : 30, a.move === 'gorilla.roar' ? 60 : 30);
      this.recover(e, 120); return;
    }
    if (a.move === 'gorilla.grab-throw' || a.move === 'monkey.debris') {
      if (!a.projectile && !w.infected!.props.launchSpecial(e, a, 3, 25, arena.phase === 2 ? 18 : 12)) { this.recover(e, 120); return; }
      if (w.infected!.props.updateSpecial(e, a)) { if (boss.barrage) boss.barrage--; this.recover(e, boss.barrage ? 48 : 120); } return;
    }
    const range = distance(a.area, a.destination!), travelled = distance(e.transform, a.area);
    const speed = arena.id === 'elephant' ? 14 : arena.id === 'zebra' ? 15 : arena.id === 'flamingo' ? arena.phase === 2 ? 21 : 17 : 12;
    const step = Math.min(speed / 60, Math.max(0, range - travelled));
    const staticClear = w.solids.sweep(e, { x: a.area.dx, z: a.area.dz }, step, e.combat!.radius, false, false);
    let clear = w.solids.sweep(e, { x: a.area.dx, z: a.area.dz }, step, e.combat!.radius, arena.id === 'zebra' ? 'side' : arena.id === 'elephant', true);
    if (arena.id === 'flamingo' && !w.infected!.nav.clear(e.transform.x + a.area.dx * clear, e.transform.z + a.area.dz * clear, e.combat!.radius)) clear = 0;
    w.solids.wrote(e, 'l8.arena-special'); e.transform.x += a.area.dx * clear; e.transform.z += a.area.dz * clear;
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    if (distance(e.transform, p.transform) <= a.area.radius + .35) {
      const firstContact = !a.hitIds.includes(1);
      this.hit(e, arena.id === 'elephant' ? 60 : arena.id === 'monkey' ? 12 : arena.id === 'flamingo' ? 30 : arena.id === 'lion' ? 45 : 35, arena.id === 'elephant' ? 60 : 0);
      if (firstContact && (arena.id === 'lion' || arena.id === 'monkey')) { b.grabUntil = w.tick + 120; b.grabHits = 0; b.heardTargetId = 1; arena.grabs++; }
    }
    if (clear + .001 < step || travelled + step >= range || w.tick - a.activeTick > (range / speed + 1) * 60) {
      const lockedDistance = distance(a.area, a.target), side = Math.abs((p.transform.x - a.area.x) * a.area.dz - (p.transform.z - a.area.z) * a.area.dx);
      if (arena.id === 'elephant' && staticClear + .001 < step && travelled >= Math.max(3, lockedDistance - 1) && side > a.area.radius + .35) {
        arena.wallHits++; arena.counters++; this.announce('Elephant staggered — fire now!');
        if (arena.wallHits >= 3) w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: a.attackId, actionId: 'arena.elephant.wall', origin: p.transform, direction: { x: a.area.dx, z: a.area.dz }, base: e.health.max * 10, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
      }
      this.recover(e, 120);
    }
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
  private walk(e: EntitySnapshot, at: { x: number; z: number }, speed: number): void { this.w.npcs!.move(e, at, speed, e.infected!, .2); }
  private announce(text: string): void { this.mission.state.subtitle = { id: 'L8.arena', text, until: this.w.tick + 300 }; }
  private signal(arena: L8ArenaState, name: string): void { this.w.events.emit({ type: 'mission.signal', tick: this.w.tick, name: `l8.arena.${arena.id}.${name}` }); }
  statusText(): string | null {
    const p = this.w.entities.get(1)!.transform;
    const arena = this.state.find(a => a.phase > 0 && a.phase < 3 && distance(p, l8BossArenas.find(d => d.id === a.id)!.centre) < 32);
    return arena ? `${l8BossArenas.find(d => d.id === arena.id)!.name} · Phase ${arena.phase} · Rockets ${arena.rocket}` : null;
  }
  /** Local rocket stock is checkpointed; the campaign rack stays intact for L9. */
  spendRocket(): boolean {
    const p = this.w.entities.get(1)!, arena = this.state.find(a => a.phase > 0 && a.phase < 3 && distance(p.transform, l8BossArenas.find(d => d.id === a.id)!.centre) < 35);
    if (!arena?.rocket) return false;
    arena.rocket--; return true;
  }
  swapBlocked(): boolean { return this.w.infected!.active.some(e => e.health.current > 0 && e.infected!.arenaBoss?.arena === 'monkey' && e.infected!.grabUntil > this.w.tick); }
  restore(delta: number): void { for (const a of this.state) { if (a.startedAt) a.startedAt += delta; if (a.endedAt) a.endedAt += delta; if (a.nextAt) a.nextAt += delta; if (a.track) a.track.at += delta; } }
}
