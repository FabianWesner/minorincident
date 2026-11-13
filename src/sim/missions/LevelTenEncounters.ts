import { updateFarmScares, type FarmScareState } from './FarmScares';
import { cure } from '../../levels/L10/district';
import { cureEncounters, curePaceEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits, cureWeaponPickups } from '../../levels/L10/encounters';
import { cureAlphaCap } from '../../levels/L10/alphaContracts';
import { cureCorgiToy, insideCureHangar } from '../../data/l10Story';
import type { SimWorld } from '../world/SimWorld';

export interface CureEncounterState {
  farmScares?: FarmScareState; toy?: number;
  pressureAttackAt?: number; pressureTick?: number;
  spawned: Record<string, number>; medkits: Record<string, number>; weapons?: Record<string, number>;
  released?: string[]; laneOffsets?: Record<string, number>; assaultTicks?: number; assaultWave?: number; nextAssaultAt?: number; lastAssaultAdmission?: number;
}
/** Once-only moving hunters; bounded finale waves leave time to clear stairs and cool the gun. */
export class LevelTenEncounters {
  state: CureEncounterState = { spawned: {}, medkits: {}, weapons: {}, assaultTicks: 0 };
  constructor(private readonly world: SimWorld) {
    world.events.on('telegraph', event => {
      if (event.type === 'telegraph' && event.sourceId && event.target?.id === 1 && !['alpha.roar', 'scream', 'revive'].includes(event.special)) this.state.pressureAttackAt = event.tick;
    });
    world.events.on('civilian.grabbed', event => {
      if (event.type === 'civilian.grabbed' && event.targetId === 1) this.state.pressureAttackAt = event.tick;
    });
    world.events.on('infected.attack', event => {
      if (event.type === 'infected.attack' && event.special === 'escort-hit' && event.targetId === 1) this.state.pressureAttackAt = event.tick;
    });
    world.events.on('sim.tick', event => { if (event.type === 'sim.tick') this.pressure(event.tick); });
  }
  snapshot(): CureEncounterState { return structuredClone({ ...this.state, pressureTick: this.world.tick }); }
  restore(value: unknown): void {
    this.state = structuredClone(value as CureEncounterState); this.state.weapons ??= {};
    if (this.state.pressureTick !== undefined && this.state.pressureAttackAt !== undefined) this.state.pressureAttackAt += this.world.tick - this.state.pressureTick;
    for (const [id, scare] of Object.entries(this.state.farmScares ?? {})) if (scare.actor === undefined) delete this.state.farmScares![id];
  }
  /** Ordinary off-camera arrivals replace pressure lost to outpaced hunters; installed-cure retries belong to the finale. */
  private pressure(tick: number): void {
    const w = this.world, ai = w.infected, chunks = w.chunks, mission = w.missions;
    if (tick % 300 !== 0 || tick - (this.state.pressureAttackAt ?? 0) < 900 || !ai || !chunks ||
        mission?.state.phase !== 'playing' || mission.state.states['cure-installed'] || w.storyLock) return;
    const player = w.entities.get(1)!;
    if (player.health.current <= 0) return;
    const at = { x: player.transform.x + 40, z: player.transform.z };
    const room = () => ai.pool.length > 0 && ai.director.count < ai.director.cap - ai.director.reserved - ai.director.pendingTurns - 1;
    if (!room() || !chunks.resident(at.x, at.z)) return;
    for (const offset of ai.director.tier === 'low' ? [-7, -5, -3, -1, 1, 3, 5, 7] : [-11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9, 11]) {
      if (!room()) break;
      const point = cureEncounterSpot(ai.nav, { x: at.x, z: at.z + offset, archetype: 'infected.sprinter' },
        (x, z) => !insideCureHangar({ x, z }) && chunks.resident(x, z) && ai.director.safe('infected.sprinter', { x, z }), 33);
      if (!point) continue;
      const id = ai.spawn('infected.sprinter', point, { state: 'chase' });
      ai.pursueTarget(id, 1);
    }
  }
  update(): void {
    const w = this.world, ai = w.infected, chunks = w.chunks, mission = w.missions;
    if (!ai || !chunks || mission?.state.phase !== 'playing' || mission.state.states['cure-released']) return;
    const assaultActive = !!mission.state.states['charge-active'];
    if (assaultActive) this.state.assaultTicks = (this.state.assaultTicks ?? 0) + 1;
    if (w.tick % 10 !== 0) return;
    const player = w.entities.get(1)!;
    const current = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]) ?? cure.regions.at(-1)!;
    const low = ai.director.tier === 'low', depth = cure.threatDepth.find(r => r.region === current.id)!;
    const cap = assaultActive ? low ? 14 : 22 : Math.min(low || current.id === 'destroyed-corridor' || current.id === 'dispersal-complex' ? 70 : 60, depth.resident[low ? 'low' : 'high'][1] * (low ? 6 : current.id === 'destroyed-corridor' || current.id === 'dispersal-complex' ? 5 : 4));
    ai.director.levelCap = low ? cap * 2 : cap;
    if (!this.state.toy && !mission.state.items.includes('corgi-toy') && chunks.resident(cureCorgiToy.x, cureCorgiToy.z)) this.state.toy = w.pickups!.spawn('item', cureCorgiToy, 'corgi-toy');
    const weapons = this.state.weapons ??= {};
    for (const pickup of cureWeaponPickups) {
      const at = cure.anchors[pickup.anchor];
      if (weapons[pickup.id] || !at || !chunks.resident(...at)) continue;
      // Roadline story finds must survive ordinary walking past the prop; the
      // old 0.6 m trigger was narrower than the bot's 2 m waypoint tolerance.
      weapons[pickup.id] = w.combat!.pickups.spawn(pickup.action, { x: at[0], z: at[1] }, false, { retain: true, reachM: 4.5 });
    }
    updateFarmScares(w, this.state.farmScares ??= {});
    const pendingScares = Object.values(this.state.farmScares).filter(s=>s.actor===undefined).length;

    for (const kit of cureMedkits) {
      if (this.state.medkits[kit.id] || !chunks.resident(...kit.at)) continue;
      this.state.medkits[kit.id] = w.pickups!.spawn('medkit', { x: kit.at[0], z: kit.at[1] });
    }
    // Authored groups retain ordinary attacks, but never lapse into an idle line ahead of an approaching courier.
    for (const e of ai.active) if (e.health.current > 0 && e.infected?.cureRegion && !e.infected.pursuit &&
      e.transform.x >= player.transform.x - ai.hearing.rangeM &&
      ['idle', 'wander'].includes(e.infected.state) && (e.infected.pressureTarget?.until ?? 0) <= w.tick &&
      Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 160) ai.pursueTarget(e.id, 1);
    const released = this.state.released ??= [], lanes = this.state.laneOffsets ??= {};
    for (const group of [...cureEncounters, ...curePaceEncounters]) {
      const assault = !!group.assault;
      if (assaultActive && !assault) continue;
      if (assault && !assaultActive) continue;
      if (!assault && !released.includes(group.id)) {
        if (Math.abs(player.transform.x - group.at[0]) > 120) continue;
        released.push(group.id);
        // A field crossing meets the same once-only hunting group on its own lane. No group relocates after admission.
        lanes[group.id] = Math.abs(player.transform.z - group.at[1]) > 15 ? player.transform.z - group.at[1] : 0;
      }
      // A 30 s wave period, at most 5 s of admission, then 25 s with no new arrivals.
      // If a wave is still alive, postpone the next one until it has been cleared plus an 8 s breather.
      const clock = this.state.assaultTicks ?? 0;
      if (assault && clock >= (this.state.nextAssaultAt ?? 0)) {
        const living = Object.entries(this.state.spawned).filter(([key, id]) => key.startsWith('dispersal-assault:') && (w.entities.get(id)?.health.current ?? 0) > 0);
        if (living.length) this.state.nextAssaultAt = clock + 480;
        else { this.state.assaultWave = (this.state.assaultWave ?? -1) + 1; this.state.nextAssaultAt = clock + 1800; }
      }
      if (assault && clock < (this.state.nextAssaultAt ?? 1800) - 1800) continue;
      if (assault && clock - ((this.state.nextAssaultAt ?? 1800) - 1800) >= 300) continue;
      const wave = assault ? this.state.assaultWave ?? 0 : 0;
      const slots = cureEncounterSlots(group, ai.director.tier);
      for (const slot of slots) {
        const key = `${slot.key}:${wave}`;
        slot.z += lanes[group.id] ?? 0;
        // Keep one journey slot available before the next warning, otherwise
        // old hunters fill the cap and every later authored ambush is starved.
        const scareReserve = assault ? pendingScares : Math.max(1, pendingScares);
        if (this.state.spawned[key] || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns - scareReserve) continue;
        if (slot.archetype === 'infected.dog' && ai.active.filter(e => e.archetype === slot.archetype && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= (assault ? 4 : 2)) continue;
        if (slot.archetype === 'infected.alpha' && ai.active.filter(e => e.archetype === slot.archetype && !e.infected?.pursuit && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= cureAlphaCap(group.region, ai.director.tier)) continue;
        const at = cureEncounterSpot(ai.nav, slot, (x, z) => !insideCureHangar({ x, z }) && chunks.resident(x, z) && ai.director.safe(slot.archetype, { x, z }), assault ? 129 : 33);
        if (!at) continue;
        const id = ai.spawn(slot.archetype, at, { state: 'chase', yaw: Math.PI, cureRegion: group.region });
        this.state.spawned[key] = id;
        if (assault) this.state.lastAssaultAdmission = clock;
        ai.pursueTarget(id, 1);
        if (assault) break; // Bounded actor setup per director tick.
      }
    }
  }
  /** A rage roar requests the next escort wave through the same cap/breather gate. */
  callWave(): void {
    const clock = this.state.assaultTicks ?? 0;
    const earliest = Math.max(clock, (this.state.lastAssaultAdmission ?? -1500) + 1500);
    this.state.nextAssaultAt = Math.min(this.state.nextAssaultAt ?? earliest, earliest);
    this.world.events.emit({ type: 'mission.signal', tick: this.world.tick, name: 'mega-escort-called' });
  }
}
