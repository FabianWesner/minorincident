import { L8ArenaBot } from './L8ArenaBot';
import { l8BossArenas, l8Route } from '../../data/l8Bosses';
import { strikeAt } from './helpers';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
import { corpseDetour } from '../../sim/missions/missionHelpers';
/** Shared seeded policy: explore, hold the group together, fight only threats on the route, board the APC. */
export class LevelEightBot {
  finished = false;
  private readonly walker = new Walker();
  private breachHoldStarted = 0;
  private escapeLeg = 0;
  private tourReturned = false;
  private readonly arenas: L8ArenaBot;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') { this.arenas = new L8ArenaBot(w); }
  sample(): InputFrame {
    const w = this.w, m = w.missions!, zoo = m.l8!, f = emptyInput(), player = w.entities.get(1)!;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || this.profile === 'idle' || player.health.current <= 0) return f;
    const p = player.transform;
    if (w.vehicles!.active !== null) { f.brake = true; return f; }
    const calm = !zoo.state.breachedAt;
    if (!calm && this.profile === 'threat-passive') {
      this.breachHoldStarted ||= w.tick;
      if (w.tick - this.breachHoldStarted < 60 * 60) return f;
    }
    // r33-l8route: after the opening hold the courier walks the group back into the plaza; the doors shut once everyone is inside.
    const unsealed = !calm && !zoo.protecting() && !zoo.state.sealedAt;
    if (!calm && !zoo.protecting() && !unsealed && this.profile === 'complete') {
      const next = zoo.state.arenas.find(a => a.phase !== 3);
      if (next) return this.arenas.sample(next.id);
    }
    if (!calm && !zoo.protecting()) {
      const arena = zoo.state.arenas.find(a => a.phase !== 3);
      if (arena && this.profile === 'arena-tour') return this.arenas.sample(arena.id);
    }
    const door = zoo.door(), car = w.vehicles!.cars.get(zoo.state.carId)!.entity.vehicle!;
    const passengerDoor = w.vehicles!.passengerDoor(zoo.state.carId);
    const boarded = zoo.passengers().every(id => car.passengers?.some(p => p.id === id && p.phase === 'seated'));
    // Cover the rear passenger queue on foot; the APC has no gun. Using the
    // driver's side door as this origin leaves the rear evacuees >10 m away
    // on the redesigned north-facing APC. Board the driver last.
    let target = zoo.protecting() ? m.def.anchors['central-plaza'] : m.state.steps.sanctuary.status === 'active' ? calm ? w.entities.get(zoo.state.keeperId)!.transform : m.def.anchors['central-plaza'] : boarded ? door : { x: passengerDoor.x - 4, z: passengerDoor.z + 2 };
    if (!calm && !zoo.protecting() && this.profile === 'runner') target = p.x < 85 ? { x: 90, z: 60 } : { x: passengerDoor.x - 4, z: passengerDoor.z + 2 };
    if (zoo.protecting()) this.escapeLeg = 0;
    if (unsealed) target = m.def.anchors['central-plaza'];
    else if (!calm && !zoo.protecting() && !boarded && this.profile !== 'runner') {
      // The east service lane is the only way to the yard: walk its route nodes, then the nav takes over inside the yard.
      const road = l8Route.at(-1)!.nodes;
      if (p.x > 85 && p.z > 46) this.escapeLeg = road.length;
      while (this.escapeLeg < road.length && Math.hypot(p.x - road[this.escapeLeg].x, p.z - road[this.escapeLeg].z) < 2) this.escapeLeg++;
      if (this.escapeLeg < road.length) target = road[this.escapeLeg];
    }
    // The final kill can leave the courier on the far side of the paddock.
    // Rejoin its public entry before waiting for followers held outside the yard.
    const arenaExit = l8BossArenas.at(-1)!.entry;
    if (this.profile === 'arena-tour' && zoo.state.arenas.every(a => a.phase === 3) && Math.hypot(p.x - arenaExit.x, p.z - arenaExit.z) < 2) this.tourReturned = true;
    const returning = this.profile === 'arena-tour' && zoo.state.arenas.every(a => a.phase === 3) && !this.tourReturned;
    if (returning) target = arenaExit;
    if (!calm) {
      const enemies = w.infected!.active.filter(e => e.health.current > 0 && (!e.infected!.arenaBoss || e.infected!.arenaBoss.engaged) && !e.hidden && !e.emerging && !e.infectionRise && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 16 && w.infected!.director.inPlayerView(e.transform, 16, 1, 5) && w.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
      const enemy = enemies[0];
      if (enemy && this.profile !== 'evade-only' && this.profile !== 'runner') {
        const gun = w.combat!.runner.loadout.activeEntries().find(e => e.id === 'weapon.army-mg');
        if (gun) { f.selectedSlot = { side: gun.side, index: gun.index }; strikeAt(f, enemy, gun.side, p, false); }
      }
      const live = zoo.roster().map(id => w.entities.get(id)).filter(e => e && e.health.current > 0 && !e.infected && e.passengerOf === undefined);
      if (this.profile !== 'runner' && !returning && Math.hypot(p.x - target.x, p.z - target.z) > 10 && live.some(e => Math.hypot(e!.transform.x - p.x, e!.transform.z - p.z) > Math.max(12, Math.ceil(live.length / 3) * 1.2 + 5))) return f;
    }
    // A boss corpse beside the APC (seed 3: elephant at 88,70) blocks the straight walk to the door; step around it like the group does.
    if (!calm && boarded) target = corpseDetour(w, player, target)?.[0] ?? target;
    f.move = this.walker.step(w, target, calm ? 1 : .35, calm ? 'explore' : `apc-${this.escapeLeg}`) ?? f.move;
    if (!calm) {
      const cue = w.infected!.active.find(e => e.health.current > 0 && e.infected!.state === 'attack' && (e.infected!.heardTargetId ?? e.infected!.l1?.targetId ?? 1) === 1 && Math.hypot(e.transform.x-p.x,e.transform.z-p.z) < 4);
      if (cue) { const b=cue.infected!, a={x:-b.dz,z:b.dx}, other={x:b.dz,z:-b.dx}; f.move=w.solids.sweep(player,a,2) >= w.solids.sweep(player,other,2) ? a : other; }
    }
    if (!calm && boarded && Math.hypot(p.x - door.x, p.z - door.z) < 1.8) { f.move = { x: 0, z: 0 }; f.interact = true; }
    return f;
  }
}
