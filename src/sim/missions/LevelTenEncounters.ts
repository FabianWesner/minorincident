import { emergeResident, walkResidents, layoutHouseDoors, type HouseEmergence } from '../outbreak/HouseEmergence';
import { finale } from '../../data/l10Finale';
import { updateFarmScares, type FarmScareState } from './FarmScares';
import { cure } from '../../levels/L10/district';
import { cureEncounters, curePaceEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits, cureWeaponPickups, type CureEncounter } from '../../levels/L10/encounters';
import { cureAlphaCap, cureAlphaPopulation, cureRegularAlphaCount, type CureRegion } from '../../levels/L10/alphaContracts';
import { cureCorgiToy, insideCureHangar } from '../../data/l10Story';
import type { SimWorld } from '../world/SimWorld';

/** A slot whose member died on a discarded retry timeline: consumed for the run, never re-spawned. Never a valid entity id. */
const RETIRED_SLOT = -1;
interface CarriedMember { archetype: string; x: number; z: number; group: string; region: CureRegion }
export interface CureEncounterState {
  finaleEntry?: HouseEmergence; finaleEntryNext?: number; finaleEntrySlot?: boolean;
  farmScares?: FarmScareState; toy?: number;
  pressureAttackAt?: number; pressureTick?: number;
  spawned: Record<string, number>; medkits: Record<string, number>; weapons?: Record<string, number>;
  released?: string[]; laneOffsets?: Record<string, number>; assaultTicks?: number; assaultWave?: number; nextAssaultAt?: number; lastAssaultAdmission?: number;
}
/** Once-only moving hunters; bounded finale waves leave time to clear stairs and cool the gun. */
export class LevelTenEncounters {
  private assaultReservation = 0;
  /** Living members of released cohorts at the courier's death; re-admitted after the checkpoint restore, never re-spawned. */
  private readonly carried = new Map<string, CarriedMember>();
  /** Slot keys as they stood at the death; only these are consumed by the following restore. */
  private readonly deathLedger = new Set<string>();
  private died = false;
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
    world.events.on('player.died', event => {
      if (event.type !== 'player.died' || !this.world.infected) return;
      // A death freezes every released cohort: members killed on this attempt
      // stay dead across the restore, living ones are carried back into play.
      // The ledger is captured here, before any death-window admission adds
      // keys the checkpoint never held; only these slots are consumed.
      this.died = true;
      this.carried.clear();
      this.deathLedger.clear();
      for (const [key, id] of Object.entries(this.state.spawned)) {
        if (key.startsWith('dispersal-assault:')) continue;
        this.deathLedger.add(key);
        const actor = this.world.entities.get(id);
        if (!actor || actor.corpse || actor.health.current <= 0 && (actor.infected?.recoverAt ?? -1) < 0) continue;
        const group = this.encounterFor(key);
        if (group) this.carried.set(key, { archetype: actor.archetype, x: actor.transform.x, z: actor.transform.z, group: group.id, region: group.region });
      }
    });
    world.events.on('sim.tick', event => { if (event.type === 'sim.tick') this.pressure(event.tick); });
  }
  snapshot(): CureEncounterState { return structuredClone({ ...this.state, pressureTick: this.world.tick }); }
  restore(value: unknown): void {
    const heldEntrySlot = this.state.finaleEntrySlot ? 1 : 0;
    const incoming = structuredClone(value as CureEncounterState);
    // A death retry resumes released encounters rather than replaying them:
    // every slot the checkpoint predates stays consumed (kills made on the
    // failed attempt are kept), so the release loop can never hand the
    // courier a fresh full cohort on every retry. Survivors wait for
    // re-admission where they stood, so nothing stacks either.
    const discarded = this.died ? [...this.deathLedger] : [];
    this.died = false;
    this.state = incoming; this.state.weapons ??= {};
    const slots = this.state.spawned ??= {};
    for (const key of discarded) {
      if (key in slots) { this.carried.delete(key); continue; }
      slots[key] = RETIRED_SLOT;
    }
    if (this.world.infected) this.world.infected.director.reserved += (this.state.finaleEntrySlot ? 1 : 0) - heldEntrySlot;
    const delta = this.world.tick - (this.state.pressureTick ?? this.world.tick);
    if (this.state.pressureAttackAt !== undefined) this.state.pressureAttackAt += delta;
    for (const walker of this.state.finaleEntry?.walking ?? []) {
      walker.until += delta;
      if (walker.startAt !== undefined) walker.startAt += delta;
      if (walker.branchAt !== undefined) walker.branchAt += delta;
    }
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
    if (!ai || !chunks || mission?.state.phase !== 'playing') return;
    const admitted = Object.keys(this.state.spawned).filter(key => key.startsWith('dispersal-assault:')).length;
    const wantedReservation = mission.state.states['cure-installed'] && !mission.state.states['cure-released'] ? Math.max(0, 4 - admitted) : 0;
    ai.director.reserved += wantedReservation - this.assaultReservation;
    this.assaultReservation = wantedReservation;
    if (mission.state.states['cure-released']) {
      if (this.state.finaleEntrySlot) { ai.director.reserved--; this.state.finaleEntrySlot = false; }
      return;
    }
    const assaultActive = !!mission.state.states['charge-active'];
    if (assaultActive) this.state.assaultTicks = (this.state.assaultTicks ?? 0) + 1;
    if (assaultActive) {
      if (!this.state.finaleEntry) {
        const district = w.districts!.districts.find(d => d.id === 'D-CURE')!;
        const door = layoutHouseDoors(district.layout, district.origin).find(d => d.house === 'kit.zoo-tunnel-mouth:l10-service');
        const c = mission.def.anchors['cure-console'];
        const route = [finale.platformStair.at, finale.platformStair.top, finale.gun.at].map(([x,z]) => [c.x+x,c.z+z] as [number,number]);
        if (door) this.state.finaleEntry = { ...door, sx: c.x+finale.serviceEntry.spawn[0], sz: c.z+finale.serviceEntry.spawn[1], route, ox: route[2][0], oz: route[2][1], next: 0, ids: [], finishRoute: true };
      }
      const entry = this.state.finaleEntry, clock = this.state.assaultTicks ?? 0;
      if (entry) {
        for (const id of walkResidents(w, entry, w.tick)) {
          ai.pursueTarget(id, 1);
          const b = w.entities.get(id)!.infected!;
          if (b.l1) { b.l1.mode = 'chase'; b.l1.targetId = 1; b.state = 'chase'; b.heardTargetId = 1; }
        }
        if (clock >= (this.state.finaleEntryNext ?? 300)) {
          if (!this.state.finaleEntrySlot) { ai.director.reserved++; this.state.finaleEntrySlot = true; }
          else if (ai.director.count + ai.director.pendingTurns < ai.director.cap - Math.max(0, ai.director.reserved - 1) && ai.pool.length) {
            ai.director.reserved--; this.state.finaleEntrySlot = false;
            const id = emergeResident(w, entry, w.tick, { archetype: entry.ids.length % 3 === 2 ? 'infected.firefighter' : 'infected.runner' });
            entry.ids.push(id); this.state.finaleEntryNext = clock + 480;
          }
        }
      }
    }
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
    this.admitCarried(Math.max(1, pendingScares));

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
        // A field crossing meets the same once-only hunting group on its own
        // lane. No group relocates after admission. The farm set pieces keep
        // their authored stations though: the pull is capped, so a walking
        // courier meets a speed-sorted stream from the yard/field rather than
        // the whole cohort arriving as one wall on her lane.
        const flank = group.id === 'depot-alpha' ? 8 : 0;
        const pull = Math.abs(player.transform.z - group.at[1]) > 15 ? player.transform.z - group.at[1] : 0;
        const capped = ['farmhouse-defense', 'shed-field-crossing', 'depot-alpha'].includes(group.id);
        lanes[group.id] = (capped ? Math.max(-15, Math.min(15, pull)) : pull) + flank;
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
        if (this.state.spawned[key] || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved + (assault ? this.assaultReservation : 0) - ai.director.pendingTurns - scareReserve) continue;
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
  /** The authored group that owns a spawned slot key (finale assault waves excluded). */
  private encounterFor(key: string): CureEncounter | undefined {
    return [...cureEncounters, ...curePaceEncounters].find(group => !group.assault &&
      cureEncounterSlots(group, this.world.infected!.director.tier).some(slot => `${slot.key}:0` === key));
  }
  /** Re-admit death-retry survivors where they fell, or on their authored slot when that spot is no longer a fair admission. */
  private admitCarried(scareReserve: number): void {
    if (!this.carried.size) return;
    const w = this.world, ai = w.infected!, chunks = w.chunks!;
    // Never admit while the courier lies dying: the checkpoint restore rebuilds
    // the world anyway, and a death-window admission would silently consume the
    // carried member it placed.
    if (w.entities.get(1)!.health.current <= 0) return;
    for (const [key, member] of this.carried) {
      const room = ai.pool.length > 0 && ai.director.count < ai.director.cap - ai.director.reserved - ai.director.pendingTurns - scareReserve;
      const dogs = member.archetype === 'infected.dog' && ai.active.filter(e => e.archetype === member.archetype && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= 2;
      const alphas = member.archetype === 'infected.alpha' && cureRegularAlphaCount(cureAlphaPopulation(w), member.region) >= cureAlphaCap(member.region, ai.director.tier);
      if (!room || dogs || alphas) continue;
      const fair = (x: number, z: number) => !insideCureHangar({ x, z }) && chunks.resident(x, z) && ai.director.safe(member.archetype, { x, z });
      const group = [...cureEncounters, ...curePaceEncounters].find(g => g.id === member.group);
      const slot = group ? cureEncounterSlots(group, ai.director.tier).find(s => `${s.key}:0` === key) : undefined;
      const lane = (this.state.laneOffsets ?? {})[member.group] ?? 0;
      const at = fair(member.x, member.z) ? { x: member.x, z: member.z }
        : slot ? cureEncounterSpot(ai.nav, { ...slot, z: slot.z + lane }, fair, 33) : null;
      if (!at) continue;
      const id = ai.spawn(member.archetype, at, { state: 'chase', cureRegion: member.region });
      this.state.spawned[key] = id;
      this.carried.delete(key);
      ai.pursueTarget(id, 1);
    }
  }
}
