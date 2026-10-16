import { actorRadius } from '../world/SolidRegistry';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { CoverWall } from '../combat/HitQuery';
import type { MissionResult } from './types';
import { l7Departure as cfg } from '../../data/l7';
import { l7Bus, l7CorridorAnchors } from '../../levels/L7/corridor';
import { spawnSetPiece } from './L4Spectacle';

export interface L7DepartureState {
  phase: 'waiting' | 'boarding' | 'departing' | 'done';
  busId: number;
  /** Followers inside the bus (hidden), in boarding order. */
  boarded: number[];
  /** Followers stepping through the door: id -> tick they started. */
  entering: Record<number, number>;
  lastEnterAt: number;
  startedAt: number;
}
const NAV_BUS = 900_700;
const ease = (t: number) => t * t * (3 - 2 * t);
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * L7-E2: boarding of the living survivors, the departure shot and the L8 handover. The bus is a set piece (kinematic, like
 * the L4 convoy) with a physics and navigation blocker while it waits. Boarding finishes only when every living follower has
 * stepped through the door; stragglers keep walking to the player (LevelSevenEncounters.follower) and the player waits for
 * them - there is no timer and no kill condition. The player boards last, the shot runs `cfg.seconds`, and `level.completed`
 * carries the boarded roster for L8.
 */
export class LevelSevenDeparture {
  state: L7DepartureState = { phase: 'waiting', busId: 0, boarded: [], entering: {}, lastEnterAt: -1e9, startedAt: 0 };
  /** Set by Game once the handover has been started, so it happens once. */
  handedOver = false;
  private blocker: number | undefined;
  private readonly from = new Map<number, { x: number; z: number }>();
  private readonly approaches = new Map<number, { x: number; z: number; at: number; around?: { x: number; z: number } }>();
  private readonly boarding = l7CorridorAnchors['l7-bus-boarding'].position;
  private readonly wall: CoverWall = { x: l7Bus.x, y: 1.5, z: l7Bus.z, halfX: 4.68, halfY: 1.5, halfZ: 1.48 };
  constructor(private readonly world: SimWorld) {}
  install(): void {
    const w = this.world;
    const bus = spawnSetPiece(w, l7Bus.asset, { x: l7Bus.x, z: cfg.lane.z, y: w.districts!.groundHeight(l7Bus.x, cfg.lane.z) + .7, yaw: l7Bus.yaw });
    this.state.busId = bus.id;
    w.solids.aliasBlocker(NAV_BUS, bus.id);
    this.blocker = w.physics.addBlocker(this.wall);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: NAV_BUS, blocked: true, wall: this.wall });
  }
  private get bus(): EntitySnapshot { return this.world.entities.get(this.state.busId)!; }
  private get door() { return { x: cfg.door.x, z: cfg.door.z }; }
  /** The shot is playing (HUD hidden, camera taken over). */
  get cinematic(): boolean { return this.state.phase === 'departing' || this.state.phase === 'done'; }
  get fading(): boolean { return this.state.phase === 'done' || this.state.phase === 'departing' && this.world.tick - this.state.startedAt >= cfg.fadeAtSeconds * 60; }
  /** Camera for the shot: ahead of the bus, high, looking back at the city that falls behind it. */
  cameraPose(): { position: [number, number, number]; target: [number, number, number] } | null {
    if (!this.cinematic) return null;
    const b = this.bus.transform;
    return {
      position: [b.x + cfg.camera.position[0], cfg.camera.position[1], b.z + cfg.camera.position[2]],
      target: [b.x + cfg.camera.target[0], cfg.camera.target[1], b.z + cfg.camera.target[2]],
    };
  }
  /** Called by the follower AI: true when this survivor is handled here (boarding, aboard or entering) this tick. */
  claims(e: EntitySnapshot): boolean {
    const s = this.state, w = this.world;
    if (s.phase === 'waiting') return false;
    if (s.boarded.includes(e.id) || e.id in s.entering) return true;
    if (s.phase !== 'boarding') return false;
    const r = w.l7Encounters!.state.roster.find(r => r.id === e.id);
    if (!r || r.status !== 'following') return false;
    // Far stragglers keep following the player (who stands at the bus), so the cross-city routing stays in one place.
    if (distance(e.transform, this.door) > cfg.claimRadius) return false;
    const c = e.civilian!, slot = c.survivor!.slot;
    c.state = 'calm'; c.story = null; c.survivor!.cover = false;
    const queue = { x: cfg.queue.x + Math.floor(slot / 3) % 3 * .9, z: cfg.queue.z + (slot % 3 - 1) * .8 };
    // Admit when the full footprint reaches the queue, including when the
    // courier is standing between its centre and the last waiting survivor.
    const near = distance(e.transform, queue) <= 1.6 + (e.combat?.radius ?? .35);
    if (near && w.tick - s.lastEnterAt >= cfg.gapTicks) {
      e.passengerOf = s.busId; this.approaches.delete(e.id);
      s.lastEnterAt = w.tick; s.entering[e.id] = w.tick; this.from.set(e.id, { x: e.transform.x, z: e.transform.z });
      return true;
    }
    if (!near) {
      let approach = this.approaches.get(e.id);
      if (!approach) { approach = { x: e.transform.x, z: e.transform.z, at: w.tick }; this.approaches.set(e.id, approach); }
      if (distance(e.transform, approach) > .05) { approach.x = e.transform.x; approach.z = e.transform.z; approach.at = w.tick; }
      if (approach.around && distance(e.transform, approach.around) < .15) delete approach.around;
      let goal = approach.around ?? queue;
      const courier = w.entities.get(1)!, p = courier.transform, dx = queue.x - e.transform.x, dz = queue.z - e.transform.z, length2 = dx * dx + dz * dz;
      const t = length2 ? ((p.x - e.transform.x) * dx + (p.z - e.transform.z) * dz) / length2 : 0;
      const clearance = actorRadius(e) + actorRadius(courier) + .05;
      // Only a stalled close approach needs a detour. Keep ordinary queue
      // travel and its existing boarding cadence, then walk around the courier.
      if (!approach.around && w.tick - approach.at >= 30 && Math.abs(p.y - e.transform.y) < 1.2 && distance(p, e.transform) < clearance + .75 && t > 0 && t < 1 && Math.hypot(e.transform.x + t * dx - p.x, e.transform.z + t * dz - p.z) < clearance) {
        const length = Math.sqrt(length2), side = dx * (p.z - e.transform.z) - dz * (p.x - e.transform.x) >= 0 ? 1 : -1;
        for (const sign of [side, -side]) {
          const around = { x: e.transform.x + sign * dz / length, z: e.transform.z - sign * dx / length };
          if (w.solids.clear({ ...around, y: e.transform.y }, actorRadius(e), e.id)) { goal = approach.around = around; break; }
        }
      }
      w.npcs!.move(e, goal, r.injured ? 1.4 : 3.8, c, goal === queue ? .5 : .05, 1600);
    }
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  update(): void {
    const w = this.world, s = this.state;
    if (s.phase === 'done' || !s.busId) return;
    if (s.phase === 'departing') { this.drive(); return; }
    const player = w.entities.get(1)!;
    if (player.health.current <= 0) return;
    const d = Math.hypot(player.transform.x - this.boarding[0], player.transform.z - this.boarding[2]);
    if (s.phase === 'waiting' && d <= cfg.boardRadius) s.phase = 'boarding';
    else if (s.phase === 'boarding' && d > cfg.leaveRadius) s.phase = 'waiting';
    // Survivors already stepping through the door finish even if the player steps back.
    for (const id of Object.keys(s.entering).map(Number)) {
      const e = w.entities.get(id), t = (w.tick - s.entering[id]) / cfg.enterTicks;
      if (!e || e.health.current <= 0 || e.civilian?.state === 'finished' || e.infected || e.infection) { delete s.entering[id]; this.from.delete(id); continue; }
      const from = this.from.get(id) ?? e.transform, k = ease(Math.min(1, t));
      e.transform.x = from.x + (this.door.x - from.x) * k; e.transform.z = from.z + (this.door.z - from.z) * k;
      e.transform.yaw = Math.PI;
      w.spatial.set(id, e.transform.x, e.transform.z);
      if (t >= 1) {
        // Aboard: hidden, and parked like a Vehicles passenger so no routine or follower logic moves or unhides the figure.
        e.hidden = true; w.spatial.delete(id); e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; e.civilian!.path.length = 0; s.boarded.push(id); delete s.entering[id]; this.from.delete(id);
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l7.survivor-boarded', actorId: id });
      }
    }
    if (s.phase !== 'boarding') return;
    const living = w.l7Encounters!.state.roster.filter(r => r.status === 'following');
    if (living.every(r => s.boarded.includes(r.id)) && !Object.keys(s.entering).length) this.depart();
  }
  private depart(): void {
    const w = this.world, s = this.state, player = w.entities.get(1)!;
    s.phase = 'departing'; s.startedAt = w.tick;
    // The courier climbs aboard last: out of the world (no target for the horde, no collider), input locked for the shot.
    player.passengerOf = s.busId; player.hidden = true; w.spatial.delete(1); w.physics.playerCollider?.setEnabled(false);
    for (const e of w.entities.iterate()) if (e.companion) { e.hidden = true; e.passengerOf = s.busId; w.spatial.delete(e.id); }
    w.storyLock = { scripted: null, skip: false }; w.clearInput();
    if (this.blocker !== undefined) { w.physics.removeBlocker(this.blocker); this.blocker = undefined; }
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: NAV_BUS, blocked: false, wall: this.wall });
    w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l7.departing' });
  }
  private drive(): void {
    const w = this.world, s = this.state, t = Math.min(1, (w.tick - s.startedAt) / (cfg.seconds * 60));
    const x = cfg.lane.fromX + (cfg.lane.toX - cfg.lane.fromX) * ease(t), tr = this.bus.transform;
    tr.x = x; tr.z = cfg.lane.z; tr.yaw = 0; tr.y = w.districts!.groundHeight(x, cfg.lane.z) + .7;
    const player = w.entities.get(1)!.transform;
    Object.assign(player, { x, z: cfg.lane.z });
    // Keep the hidden passenger's physics pose with its bus: cleanup publishes
    // the player body after missions and would otherwise restore the boarding spot.
    w.physics.playerBody!.setTranslation(player, true);
    w.physics.playerBody!.setNextKinematicTranslation(player);
    for (const e of w.entities.iterate()) if (e.companion && e.passengerOf === s.busId) Object.assign(e.transform, tr);
    if (t >= 1) this.finish();
  }
  private finish(): void {
    const w = this.world, s = this.state;
    s.phase = 'done';
    const escaped = s.boarded.map(id => structuredClone(w.entities.get(id)!)).filter(e => e.health.current > 0 && e.civilian?.state !== 'finished' && !e.infected && !e.infection);
    for (const e of escaped) { e.hidden = false; delete e.passengerOf; if (e.civilian) e.civilian.pauseUntil = 0; }
    const result: MissionResult = {
      time: w.tick / 60, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: escaped.length, optionalObjectives: [],
      companion: structuredClone([...w.entities.iterate()].find(e => e.companion)),
      survivors: escaped.map(e => e.civilian?.survivor?.key ?? `survivor-${e.id}`), escapedSurvivors: escaped,
    };
    w.events.emit({ type: 'level.completed', tick: w.tick, id: 'L7', result });
  }
}
