import { layoutHouseDoors, type HouseEmergence } from '../outbreak/HouseEmergence';
import { finale } from '../../data/l10Finale';
import { updateFarmScares, type FarmScareState } from './FarmScares';
import { cure } from '../../levels/L10/district';
import { cureEncounters, curePaceEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits, cureWeaponPickups, cureConvoyBarrels, cureConvoyCrates, type CureEncounter } from '../../levels/L10/encounters';
import { cureAlphaCap, cureAlphaPopulation, cureRegularAlphaCount, type CureRegion } from '../../levels/L10/alphaContracts';
import { cureCorgiToy, insideCureHangar } from '../../data/l10Story';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/** A slot whose member died on a discarded retry timeline: consumed for the run, never re-spawned. Never a valid entity id. */
const RETIRED_SLOT = -1;
/** Farm set pieces that admit as assault-style waves rather than one whole-cohort dump.
 * A full dump released 120 m ahead disengages at walk pace: the faster members rush the
 * release-time spot, the rest starve the shared path budget behind the farm buildings and
 * stand in `chase` until the courier passes them. Bounded waves keep every member near
 * her current position as one winnable fight that clears. */
const pacedSetPieces = ['corn-field-horde', 'farmhouse-defense', 'shed-field-crossing', 'depot-alpha',
  'setpiece-quarantine-gate', 'setpiece-propaganda-billboard', 'setpiece-scarecrow-field', 'setpiece-burning-convoy',
  'setpiece-dark-underpass', 'setpiece-field-hospital'] as const;
/** Members per paced wave; the remainder admits as its own final small wave. */
const pacedWaveSize = 5;
/** A wave also opens once at most this many living members remain anywhere in the cohort. */
const pacedWaveLiving = 2;
/** The charge gets a fresh escalation beat every four seconds. */
const assaultWavePeriod = 240;
/** The staged opening cohort gets one full half-minute to meet the courier before charging. */
const prechargeAssaultDelay = 1800;
interface CarriedMember { archetype: string; x: number; z: number; group: string; region: CureRegion }
export interface CureEncounterState {
  finaleEntry?: HouseEmergence; finaleEntryNext?: number; finaleEntrySlot?: boolean;
  farmScares?: FarmScareState; toy?: number; convoyBarrels?: number[]; convoyCrates?: number[]; convoySupplies?: Record<string, number>;
  pressureAttackAt?: number; pressureTick?: number;
  spawned: Record<string, number>; medkits: Record<string, number>; weapons?: Record<string, number>;
  /** The four ride/fight gates that hold the motorbike until their roadblock encounter is cleared. */
  roadblockGates?: Record<string, number>;
  released?: string[]; laneOffsets?: Record<string, number>; assaultTicks?: number; assaultWave?: number; nextAssaultAt?: number; lastAssaultAdmission?: number;
  /** Paced set pieces: the wave currently admitting, and the next re-target pass. */
  pacedWave?: Record<string, number>; pacedPress?: number;
  /** Tick at which the billboard fell; checkpointed with the encounter ledger. */
  billboardFallAt?: number;
  /** The hospital flaps open when the courier reaches the triage tents. */
  hospitalOpenAt?: number;
  /** Once-only halfway breach cue, retained with the encounter snapshot. */
  assaultBreach?: boolean;
  assaultAnnouncedWave?: number;
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
    world.events.on('prop.broken', event => {
      if (event.type !== 'prop.broken' || !this.state.convoyCrates?.includes(event.id)) return;
      const supplies = this.state.convoySupplies ??= {}, key = String(event.id), crate = world.entities.get(event.id);
      if (supplies[key] || !crate || !world.pickups) return;
      supplies[key] = world.pickups.spawn('throwable', crate.transform, 'weapon.molotov');
    });
    world.events.on('sim.tick', event => { if (event.type === 'sim.tick') this.pressure(event.tick); });
  }
  snapshot(): CureEncounterState { return structuredClone({ ...this.state, pressureTick: this.world.tick }); }
  restore(value: unknown): void {
    const heldEntrySlot = this.state.finaleEntrySlot ? 1 : 0;
    const retainedAssault = this.died && this.world.missions?.state.states['cure-installed'] ? {
      assaultTicks: this.state.assaultTicks, assaultWave: this.state.assaultWave,
      nextAssaultAt: this.state.nextAssaultAt, assaultBreach: this.state.assaultBreach,
      assaultAnnouncedWave: this.state.assaultAnnouncedWave,
    } : undefined;
    const incoming = structuredClone(value as CureEncounterState);
    // A death retry resumes released encounters rather than replaying them:
    // every slot the checkpoint predates stays consumed (kills made on the
    // failed attempt are kept), so the release loop can never hand the
    // courier a fresh full cohort on every retry. Survivors wait for
    // re-admission where they stood, so nothing stacks either.
    const discarded = this.died ? [...this.deathLedger] : [];
    this.died = false;
    this.state = incoming; this.state.weapons ??= {};
    if (retainedAssault) {
      this.state.assaultTicks = Math.max(this.state.assaultTicks ?? 0, retainedAssault.assaultTicks ?? 0);
      this.state.assaultWave = Math.max(this.state.assaultWave ?? 0, retainedAssault.assaultWave ?? 0);
      this.state.nextAssaultAt = Math.max(this.state.nextAssaultAt ?? 0, retainedAssault.nextAssaultAt ?? 0);
      this.state.assaultBreach ||= retainedAssault.assaultBreach;
      this.state.assaultAnnouncedWave = Math.max(this.state.assaultAnnouncedWave ?? 0, retainedAssault.assaultAnnouncedWave ?? 0);
    }
    const slots = this.state.spawned ??= {};
    for (const key of discarded) {
      if (key in slots) { this.carried.delete(key); continue; }
      slots[key] = RETIRED_SLOT;
    }
    if (this.world.infected) this.world.infected.director.reserved += (this.state.finaleEntrySlot ? 1 : 0) - heldEntrySlot;
    const delta = this.world.tick - (this.state.pressureTick ?? this.world.tick);
    if (this.state.pressureAttackAt !== undefined) this.state.pressureAttackAt += delta;
    if (this.state.billboardFallAt !== undefined) this.state.billboardFallAt += delta;
    if (this.state.hospitalOpenAt !== undefined) this.state.hospitalOpenAt += delta;
    if (this.state.finaleEntryNext !== undefined) this.state.finaleEntryNext += delta;
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
    // The crash opening has its own authored encounters; replacement rows
    // begin after its first minute, when the normal population pacing resumes.
    if (tick <= 3600 || tick % 300 !== 0 || tick - (this.state.pressureAttackAt ?? 0) < 900 || !ai || !chunks ||
        mission?.state.phase !== 'playing' || mission.state.states['cure-installed'] || w.storyLock) return;
    const player = w.entities.get(1)!;
    if (player.health.current <= 0) return;
    const at = { x: player.transform.x + 40, z: player.transform.z };
    // Assault-style admission pacing: hold the next off-camera row while the
    // previous one still hunts her. Stacked rows (a fresh 8–12 sprinters every
    // 15 s while the last row is still closing) grind a walking courier down
    // where a running one simply outpaces them; admitting replacement
    // pressure keeps the lane alive without machine-gunning it.
    let hunting = 0;
    for (const e of ai.active) if (e.health.current > 0 && e.infected && !e.infected.cureRegion && !e.infected.pursuit &&
        Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 60) hunting++;
    if (hunting >= 3) return;
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
    // The console's authored cohort owns its slots: ambient pressure — the resident director and the
    // chunk stream's farthest-first excess trim — must not eat the wave the console announced. The s165
    // pressure gate left the hold's ambient count at cap when the assault opened, so wave 0 admitted 5
    // of its 7 slots and the late arrivals were trimmed before they could fight. Reserve every living
    // assault member plus the slots the current wave still owes; the count cap then trims only ambient
    // hunters around them, and the assault's own admission gate keeps cancelling its own reservation.
    const assaultGroup = cureEncounters.find(group => group.assault);
    const waveIndex = this.state.assaultWave ?? 0;
    const livingAssault = Object.entries(this.state.spawned).filter(([key, id]) =>
      key.startsWith('dispersal-assault:') && !key.startsWith('dispersal-assault:service:') &&
      (w.entities.get(id)?.health.current ?? 0) > 0).length;
    // Service arrivals consume their director occupant slot, but do not reserve
    // a second slot as though they were members of the authored station cohort.
    const owedAssault = assaultGroup ? cureEncounterSlots(assaultGroup, ai.director.tier).filter(slot =>
      this.state.spawned[`${slot.key}:${waveIndex}`] === undefined).length : 0;
    const wantedReservation = mission.state.states['cure-installed'] && !mission.state.states['cure-released'] ? livingAssault + owedAssault : 0;
    ai.director.reserved += wantedReservation - this.assaultReservation;
    this.assaultReservation = wantedReservation;
    if (mission.state.states['cure-released']) {
      if (this.state.finaleEntrySlot) { ai.director.reserved--; this.state.finaleEntrySlot = false; }
      return;
    }
    // Keep the finale assault clock alive from cure installation. The courier
    // can kill the Mega or fight at the gun before she activates the console;
    // that early route must not create a quiet pre-charge seam.
    const assaultActive = !!mission.state.states['cure-installed'];
    const chargeComplete = (mission.state.counters['charge-ticks'] ?? 0) >= 3600;
    if (assaultActive && !chargeComplete) this.state.assaultTicks = (this.state.assaultTicks ?? 0) + 1;
    const consoleAt = mission.def.anchors['cure-console'];
    const courier = w.entities.get(1)!;
    const assaultApproach = !!mission.state.states['cure-installed'] && !!consoleAt &&
      Math.hypot(courier.transform.x - consoleAt.x, courier.transform.z - consoleAt.z) <= finale.holdRadius - 20;
    if (assaultActive || assaultApproach) {
      // Once the hold begins, wave escalation follows the charge clock even
      // when an earlier cohort is still alive. Admission remains cap-bound.
      const timedWave = Math.floor((this.state.assaultTicks ?? 0) / assaultWavePeriod);
      this.state.assaultWave = Math.max(this.state.assaultWave ?? 0, timedWave);
      this.state.nextAssaultAt = ((this.state.assaultWave ?? 0) + 1) * assaultWavePeriod;
      const activeWave = this.state.assaultWave ?? 0;
      if (this.state.assaultAnnouncedWave !== activeWave) {
        this.state.assaultAnnouncedWave = activeWave;
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: `cure-assault-wave-${activeWave}` });
      }
      if (!this.state.finaleEntry) {
        const district = w.districts!.districts.find(d => d.id === 'D-CURE')!;
        const door = layoutHouseDoors(district.layout, district.origin).find(d => d.house === 'kit.zoo-tunnel-mouth:l10-service');
        const c = mission.def.anchors['cure-console'];
        const route = ['dispersal-stair-foot', 'dispersal-stair-top', 'dispersal-gun'].map(name => cure.anchors[name] as [number, number]);
        if (door) this.state.finaleEntry = { ...door, sx: c.x+finale.serviceEntry.spawn[0], sz: c.z+finale.serviceEntry.spawn[1], route, ox: route[2][0], oz: route[2][1], next: 0, ids: [], finishRoute: true, speedMs: 1.7 };
      }
      const entry = this.state.finaleEntry;
      if (entry) {
        if (!this.state.assaultBreach && (mission.state.counters['charge-ticks'] ?? 0) >= 1800) {
          this.state.assaultBreach = true;
          w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'cure-assault-breach' });
          w.events.emit({ type: 'vfx.effect', tick: w.tick, kind: 'smoke', position: { x: entry.x, y: 0, z: entry.z }, radius: 5 });
        }
        // The service breach admits one fighter every 1.5 s out of the courier's sight (see below).
        // Admission
        // uses the same reserved director slot and population cap as other arrivals.
        if (w.tick >= (this.state.finaleEntryNext ?? 0)) {
          if (!this.state.finaleEntrySlot) { ai.director.reserved++; this.state.finaleEntrySlot = true; }
          else if (ai.director.count + ai.director.pendingTurns < ai.director.cap - Math.max(0, ai.director.reserved - 1) && ai.pool.length) {
            const livingButchers = ai.active.filter(e => e.archetype === 'infected.butcher' && e.health.current > 0).length;
            const heavyBreach = this.state.assaultBreach && livingButchers === 0;
            const archetype = heavyBreach ? 'infected.butcher'
              : entry.ids.length % 2 === 1 ? 'infected.sprinter'
                : entry.ids.length % 3 === 2 ? 'infected.firefighter' : 'infected.runner';
            // PO 2026-11-20 ("Zombies popping out of nowhere and directly attack me ... Aweful"): s189 admitted these
            // 3 m from the courier in plain view. Arrivals now enter out of sight (director.safe: >= 18 m, offscreen or
            // occluded, nav-clear) — the service tunnel mouth first, else a ring 22–30 m around her — and run in.
            const ring = [0, 1, 2, 3, 4, 5, 6, 7].map(k => {
              const angle = ((entry.ids.length * 3 + k) % 8) * Math.PI / 4, distance = 22 + (k % 3) * 4;
              return { x: courier.transform.x + Math.cos(angle) * distance, z: courier.transform.z + Math.sin(angle) * distance };
            });
            // Spawn at the service threshold first, then its staged spawn point
            // and nearby offscreen/occluded ring spots. The threshold is close
            // enough to join the mounted-platform fight without appearing in
            // the courier's sight.
            const candidates = [{ x: entry.x, z: entry.z }, { x: entry.sx, z: entry.sz }, ...ring];
            const spot = candidates.map(c => cureEncounterSpot(ai.nav, { ...c, archetype },
              (x, z) => !insideCureHangar({ x, z }) && chunks.resident(x, z) && ai.director.safe(archetype, { x, z }), 9)).find(Boolean);
            if (!spot) { this.state.finaleEntryNext = w.tick + 30; }
            else {
            const { x, z } = spot;
            const support = w.districts?.groundHeight(x, z) ?? 0;
            const id = ai.spawn(archetype, { x, y: support + .7, z }, { state: 'chase' });
            const actor = w.entities.get(id)!;
            actor.transform.y = support + .7;
            ai.pursueTarget(id, 1);
            if (actor.infected?.l1) { actor.infected.l1.mode = 'chase'; actor.infected.l1.targetId = 1; actor.infected.heardTargetId = 1; }
            actor.infected!.state = 'chase';
            entry.ids.push(id);
            this.state.finaleEntryNext = w.tick + 90;
            this.state.spawned[`dispersal-assault:service:${entry.ids.length}:${this.state.assaultWave ?? 0}`] = id;
            }
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
      weapons[pickup.id] = w.combat!.pickups.spawn(pickup.action, { x: at[0], z: at[1] }, false, { retain: true, reachM: pickup.anchor === 'crash-machete' ? 1.5 : 4.5 });
    }
    if (!this.state.convoyBarrels && cureConvoyBarrels.every(([x, z]) => chunks.resident(x, z)))
      this.state.convoyBarrels = cureConvoyBarrels.map(([x, z]) => w.hazards!.spawn('barrel', { x, z }));
    if (!this.state.convoyCrates && cureConvoyCrates.every(([x, z]) => chunks.resident(x, z)))
      this.state.convoyCrates = cureConvoyCrates.map(([x, z]) => w.hazards!.spawn('crate', { x, z }));
    updateFarmScares(w, this.state.farmScares ??= {});
    const pendingScares = Object.values(this.state.farmScares).filter(s=>s.actor===undefined).length;
    this.admitCarried(Math.max(1, pendingScares));

    for (const kit of cureMedkits) {
      if (this.state.medkits[kit.id] || !chunks.resident(...kit.at)) continue;
      this.state.medkits[kit.id] = w.pickups!.spawn('medkit', { x: kit.at[0], z: kit.at[1] });
    }
    // Authored groups retain ordinary attacks, but never lapse into an idle line ahead of an approaching courier.
    for (const e of ai.active) if (e.health.current > 0 && e.infected?.cureRegion && !e.infected.pursuit &&
      ['idle', 'wander'].includes(e.infected.state) && (e.infected.pressureTarget?.until ?? 0) <= w.tick &&
      Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 160) ai.pursueTarget(e.id, 1);
    const released = this.state.released ??= [], lanes = this.state.laneOffsets ??= {};
    const pacedWaves = this.state.pacedWave ??= {};
    for (const group of [...cureEncounters, ...curePaceEncounters]) {
      const assault = !!group.assault;
      if (assaultActive && !assault) continue;
      // The dispersal assault's opening wave paces itself on her arrival at the arena — the depot
      // ambush's own rule. The wave admits once she reaches the cure installation's apron (within
      // holdRadius - 20 of the console), so the cohort the console announces is already closing on her
      // live position when the assault clock opens: the announcement's ≤20 s first-attack window then
      // measures the fight she actually faces at any pace, instead of an approach race against the
      // mounted platform gun that the s165 ambient gate no longer pads out. The apron release keeps
      // the pre-announcement exposure short enough that the cohort meets her at the press itself —
      // a longer lead time just feeds the roster to her approach fire one member at a time. Only the
      // opening wave pre-stages; later waves keep the charge clock. The arrivals stay fair through
      // the same director.safe spot search as every other admission (≥18 m from her, off-screen or
      // occluded).
      const assaultApproach = assault && !assaultActive && waveIndex === 0 && !!consoleAt &&
        Math.hypot(player.transform.x - consoleAt.x, player.transform.z - consoleAt.z) <= finale.holdRadius - 20;
      if (assault && !assaultActive && !assaultApproach) continue;
      const paced = !assault && (pacedSetPieces as readonly string[]).includes(group.id);
      if (!assault && !released.includes(group.id)) {
        const releaseRadius = group.setPiece === 'propaganda-billboard' ? 25 : 35;
        if (group.setPiece ? Math.hypot(player.transform.x - group.at[0], player.transform.z - group.at[1]) > releaseRadius : Math.abs(player.transform.x - group.at[0]) > 120) continue;
        released.push(group.id);
        // A field crossing meets the same once-only hunting group on its own
        // lane. No group relocates after admission; a paced wave restages on
        // the courier's current lane at its own gate below.
        lanes[group.id] = this.lanePull(group, player, paced);
      }
      if (['setpiece-quarantine-gate', 'setpiece-burning-convoy', 'setpiece-dark-underpass', 'setpiece-field-hospital'].includes(group.id) && released.includes(group.id)) {
        const gates = this.state.roadblockGates ??= {};
        let gateId = gates[group.id];
        if (gateId === undefined && chunks.resident(group.at[0], group.at[1])) {
          // The physical gate blocks the riding lane. It can be opened on
          // foot, or the authored encounter opens it after its full cohort is
          // admitted and cleared.
          gateId = w.interactables!.spawn('gate', { x: group.at[0], z: 95 }, {
            halfX: .2, halfZ: 40, radius: 2, label: 'Open roadblock',
          });
          w.interactables!.block(gateId, { x: group.at[0], y: .7, z: 95, halfX: .2, halfY: 1.2, halfZ: 40 });
          gates[group.id] = gateId;
        }
        const gate = gateId === undefined ? undefined : w.entities.get(gateId);
        if (gate?.interactable?.open) gate.interactable.enabled = false;
        if (gate?.interactable && !gate.interactable.open) {
          const slots = cureEncounterSlots(group, ai.director.tier);
          const admitted = slots.every(slot => this.state.spawned[`${slot.key}:0`] !== undefined);
          const cleared = admitted && slots.every(slot => (w.entities.get(this.state.spawned[`${slot.key}:0`])?.health.current ?? 0) <= 0);
          if (cleared) {
            gate.interactable.open = true; gate.interactable.completed = true;
            gate.interactable.enabled = false;
            w.interactables!.unblock(gate.id);
          }
        }
      }
      // Let the cohort begin its safe offscreen approach first. The visible
      // board falls only when the courier is near the actual sign, which sits
      // offset from the encounter station.
      if (group.setPiece === 'propaganda-billboard' && released.includes(group.id) && this.state.billboardFallAt === undefined &&
          Math.hypot(player.transform.x - 3066, player.transform.z - 92) <= 15) this.state.billboardFallAt = w.tick;
      if (group.setPiece === 'field-hospital' && released.includes(group.id) && this.state.hospitalOpenAt === undefined &&
          Math.hypot(player.transform.x - 3508, player.transform.z - 83) <= 16) this.state.hospitalOpenAt = w.tick;
      // The pre-staged opening wave can be spent on the approach. Before the
      // charge clock starts, hand off to the next cohort only when that wave
      // is empty; once charging, timed windows continue independently of it.
      const clock = this.state.assaultTicks ?? 0;
      if (assault && !assaultActive && (this.state.assaultWave ?? 0) === 0 && this.state.nextAssaultAt === prechargeAssaultDelay &&
        cureEncounterSlots(group, ai.director.tier).every(slot => this.state.spawned[`${slot.key}:0`] !== undefined) &&
        !Object.entries(this.state.spawned).some(([key, id]) => key.startsWith('dispersal-assault:') && (w.entities.get(id)?.health.current ?? 0) > 0)) {
        this.state.assaultWave = 1;
        this.state.nextAssaultAt = prechargeAssaultDelay;
      }
      if (assault && !assaultActive && clock >= (this.state.nextAssaultAt ?? 0)) {
        const living = Object.entries(this.state.spawned).filter(([key, id]) => key.startsWith('dispersal-assault:') && (w.entities.get(id)?.health.current ?? 0) > 0);
        if (living.length) this.state.nextAssaultAt = clock + 480;
        else { this.state.assaultWave = (this.state.assaultWave ?? -1) + 1; this.state.nextAssaultAt = clock + assaultWavePeriod; }
      }
      if (assault && clock < (this.state.nextAssaultAt ?? prechargeAssaultDelay) - assaultWavePeriod) continue;
      if (assault && clock - ((this.state.nextAssaultAt ?? prechargeAssaultDelay) - assaultWavePeriod) >= 300) continue;
      const wave = assault ? this.state.assaultWave ?? 0 : 0;
      let slots = cureEncounterSlots(group, ai.director.tier);
      if (assault && wave > 0) {
        const dogSlots = Math.min(3, wave);
        const extraDogs = Array.from({ length: dogSlots }, (_, i) => {
          const [dx, dz] = [[-20, 0], [0, -20], [0, 20]][i];
          return { key: `dispersal-assault:charge-dog:${i}`, archetype: 'infected.dog',
            x: consoleAt!.x + dx, z: consoleAt!.z + dz };
        });
        const breachBrute = this.state.assaultBreach ? [{ key: 'dispersal-assault:breach-brute', archetype: 'infected.brute',
          x: consoleAt!.x - 20, z: consoleAt!.z }] : [];
        slots = [...breachBrute, ...slots.filter(slot => slot.archetype === 'infected.dog'), ...extraDogs,
          ...slots.filter(slot => slot.archetype !== 'infected.dog')];
        // Cleared charge waves return faster infected in a larger share of
        // the authored cap, and dogs lead the admission for a fast contact beat.
        let ordinary = 0;
        slots = slots.map(slot => {
          if (slot.archetype === 'infected.dog' || slot.archetype === 'infected.alpha') return slot;
          const rank = ordinary++;
          const promoteEvery = wave >= 2 ? 2 : 3;
          if (rank % promoteEvery !== 0) return slot;
          return { ...slot, archetype: wave >= 2 ? 'infected.firefighter' : 'infected.sprinter' };
        });
      }
      if (paced && group.id === 'depot-alpha') {
        // The ambush's Alpha leads the yard: first across the gap while the
        // courier still approaches, instead of trailing the last wave into
        // whatever else the road has reached by then.
        slots = [...slots.filter(slot => slot.archetype === 'infected.alpha'), ...slots.filter(slot => slot.archetype !== 'infected.alpha')];
      }
      let admission = slots;
      if (paced) {
        // The wave gate: the courier's own progress through the release band
        // is the wave clock — each wave opens as she advances another equal
        // share of it (or once the cohort is nearly cleared), so a running
        // courier meets overlapping waves and a walking one meets them one
        // bounded fight at a time. Every open wave restages on her current
        // lane, so it arrives head-on in view rather than roaming back to the
        // release-time spot. A courier who leaves the band dumps the remainder.
        const index = pacedWaves[group.id] ?? 0;
        const slice = slots.slice(index * pacedWaveSize, (index + 1) * pacedWaveSize);
        admission = slice;
        const admitted = (slot: { key: string }) => this.state.spawned[`${slot.key}:0`] !== undefined;
        const living = slots.filter(slot => {
          const id = this.state.spawned[`${slot.key}:0`];
          return id !== undefined && id !== RETIRED_SLOT && (w.entities.get(id)?.health.current ?? 0) > 0;
        }).length;
        // The depot ambush runs on a tighter clock: its yard sits 60–120 m off
        // her road, so the crossing itself paces the arrivals (as the s161
        // full dump proved); holding its second wave for the far end of the
        // band lets it spawn behind her and wander instead of fighting, which
        // on seed 3 left the last fight two members short at the cap.
        const band = group.setPiece ? 35 : 120;
        const share = (group.id === 'depot-alpha' ? 120 : band * 2) / Math.ceil(slots.length / pacedWaveSize);
        const reached = index === 0 || player.transform.x - (group.at[0] - band) >= index * share;
        const outpaced = player.transform.x - group.at[0] > band;
        if (!slice.length || !outpaced && !(reached || living <= pacedWaveLiving)) admission = [];
        else if (slice.every(admitted)) {
          pacedWaves[group.id] = index + 1;
          admission = [];
        } else lanes[group.id] = this.lanePull(group, player, true);
      }
      for (const slot of admission) {
        const key = `${slot.key}:${wave}`;
        // Keep recoverable downs in the first-minute allowance: they can
        // stand back up, and do not free a slot for a second opening actor.
        if (w.tick <= 3600 && (slot.archetype === 'infected.dog' || slot.archetype === 'infected.alpha' ||
          ai.active.filter(e => !e.infected?.pursuit && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= 8)) continue;
        slot.z += lanes[group.id] ?? 0;
        // Keep one journey slot available before the next warning, otherwise
        // old hunters fill the cap and every later authored ambush is starved.
        const scareReserve = assault ? pendingScares : Math.max(1, pendingScares);
        if (this.state.spawned[key] || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved + (assault ? this.assaultReservation : 0) - ai.director.pendingTurns - scareReserve) continue;
        if (slot.archetype === 'infected.dog' && ai.active.filter(e => e.archetype === slot.archetype && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= (assault ? 4 : 2)) continue;
        if (assault && slot.archetype === 'infected.brute' && ai.active.filter(e => e.archetype === slot.archetype && e.health.current > 0).length >= 2) continue;
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
    // Paced waves keep tracking the courier's current position instead of the
    // release-time spot they were pressed at: while she is still at the set
    // piece's ground, every living member is re-sent at her live position, so
    // a walking courier meets them as a fight and they never roam off to their
    // search origins. Once she has moved on, the ordinary disengage rule owns
    // the survivors again (the finale assault keeps its own authored pressure,
    // and a member far behind her is left to that rule rather than re-sent).
    if (!assaultActive && w.tick >= (this.state.pacedPress ?? 0)) {
      this.state.pacedPress = w.tick + 300;
      for (const group of [...cureEncounters, ...curePaceEncounters]) {
        if (!(pacedSetPieces as readonly string[]).includes(group.id) || !released.includes(group.id) ||
            player.transform.x - group.at[0] > 60) continue;
        for (const slot of cureEncounterSlots(group, ai.director.tier)) {
          const id = this.state.spawned[`${slot.key}:0`];
          const e = id === undefined || id === RETIRED_SLOT ? undefined : w.entities.get(id);
          if (!e || e.health.current <= 0 || e.infected!.pursuit || e.transform.x < player.transform.x - 24) continue;
          if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 140) ai.press(e.id, 1, w.tick + 600);
        }
      }
    }
  }
  /** The lane a group's members stage on: the courier's current lane, pulled whole for paced waves and capped for one-shot pace groups. */
  private lanePull(group: CureEncounter, player: EntitySnapshot, paced: boolean): number {
    if (group.setPiece === 'quarantine-gate') return 0;
    const flank = group.id === 'depot-alpha' ? 8 : 0;
    const pull = Math.abs(player.transform.z - group.at[1]) > 15 ? player.transform.z - group.at[1] : 0;
    // Paced waves stage uncapped on the courier's current lane: each wave of
    // five meets her head-on in view rather than as the one-wall arrival the
    // s161 cap held back (the wave gate now bounds the arrivals instead). The
    // depot ambush is the exception: its yard sits 60–90 m off her road, so
    // its cohort crosses that gap as a chase instead of teleporting onto her
    // lane together with its Alpha.
    const capped = paced ? group.id === 'depot-alpha' : group.id === 'farmhouse-defense' || group.id === 'shed-field-crossing' || group.id === 'depot-alpha';
    return (capped ? Math.max(-15, Math.min(15, pull)) : pull) + flank;
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
