import { SimPhase } from '../../../src/core/EventBus';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { GameEvent } from '../../../src/sim/world/types';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { cure } from '../../../src/levels/L10/district';
import { cureEncounters } from '../../../src/levels/L10/encounters';
import { finale } from '../../../src/data/l10Finale';
import { cureHangarWeapons } from '../../../src/levels/L10/mission';
import { observeAttackStarts } from '../threat/attackStarts';
import { L5FormationObserver } from './l5-formation';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
type PickupReceipt = { tick: number; id: number; item: string | null; collector: number | null; distance: number | null; shelf: boolean; interact: boolean; speed: number };
type Region = { ticks: number; attacks: number; groupAttacks: number; peak: number; normalPeak: number; regularPeak: number; dogPeak: number; alphaPeak: number; regularGroupPeaks: Record<string, number> };
const cureEncounterRegion = new Map(cureEncounters.map(group => [group.id, group.region]));

/** Read-only per-instance observation. No global prototype, entity, input or RNG writes. */
export class AcceptanceObserver {
  private initial: ReturnType<AcceptanceObserver['capture']> | null = null;
  private final: ReturnType<AcceptanceObserver['capture']> | null = null;
  private eventCounts: Record<string, number> = {};
  private ledger: GameEvent[] = [];
  private pickups: PickupReceipt[] = [];
  private pickupPositions = new Map<number, { x: number; z: number; shelf: boolean; item: string | null }>();
  private collected = new Set<number>();
  private duplicatePickups: number[] = [];
  private peakAlive = 0;
  private peakCharacters = 0;
  private firstMinute = { ticks: 0, regularPeak: 0, dogPeak: 0, alphaPeak: 0 };
  private l10Story = { firstMegaVisibleSeconds: null as number | null, closeSections: [] as number[], seen: 0, idleEntries: [] as number[], fullArsenal: false, outsideAssaultPeak: 0, assaultPeak: 0 };
  private l10Moved = new Set<number>();
  private l10FirstSightings: { id: number; seconds: number; archetype: string; state: string; speed: number; x: number; z: number }[] = [];
  private l10Seen = new Set<number>();
  private markers = new Map<string, { x: number; z: number; samples: number; maxDisplacement: number }>();
  private markerChanges: { tick: number; step: string; marker: string | null; x?: number; z?: number }[] = [];
  private markerSignature = '';
  private corgi = { ids: new Set<number>(), targeted: 0, hit: 0, minimumHealthFraction: 1, samples: 0 };
  private phaseStarts: { phase: string; tick: number; live: number; civilians: number }[] = [];
  private phasePeaks: Record<string, { alive: number; characters: number }> = {};
  private controllerPhase = '';
  private births: Record<string, number> = {};
  private l6RetreatDamage = 0;
  private birthIds = new Map<number, string>();
  private speed = { regularMax: 0, fasterThanPlayer: 0, regularSamples: 0, sprinters: 0 };
  private runOut: { tick: number; until: number; minimumInvulnerableUntil: number } | null = null;
  private regions: Record<string, Region> = {};
  private charge = { eligibleTicks: 0, incrementTicks: 0, invalidIncrements: 0, outsideTicks: 0, deadTicks: 0, maximum: 0, activeTicks: 0 };
  private megaIntroduction: { tick: number; distance: number; route: string[] } | null = null;
  private maxMegaStep = 0;
  private megaPrevious: { id: number; x: number; z: number; tick: number } | null = null;
  private release: { tick: number; charge: number; installed: boolean; dead: boolean; distance: number } | null = null;
  private calm = { ticks: 0, maxAlive: 0, combatEvents: 0, markerTicks: 0 };
  private l2BeforeDoors = { samples: 0, nearest: Infinity };
  private releaseFirstTick: number | null = null;
  private l2Maximum = { ambush: 0, cluster: 0 };
  private l2Route = { metres: 0, ticks: 0, discontinuities: 0, maxEncounterGapM: 0 };
  private l2EncounterIds = new Set<number>();
  private l2RoutePrevious: { x: number; z: number } | null = null;
  private l2EncounterGap = 0;
  private l2Contact = { ticks: 0, playerAttacks: 0, groupAttacks: 0, firstAttackSeconds: null as number | null };
  private maxDetailedChunks = 0;
  private l5SearchRoute = { ticks: 0, metres: 0, discontinuities: 0, encounters: new Map<number, { id: number; tick: number; atMetres: number; distance: number }>() };
  private l5Formation = new L5FormationObserver();
  private l4Scale = {
    turn: null as { tick: number; soldiers: number[]; civilians: number[]; armed: number[] } | null,
    ticks: 0, firstTick: null as number | null, lastTick: null as number | null,
    peakSlots: null as { tick: number; living: number; livingIds: number[]; reserved: number; pendingTurns: number; total: number } | null,
    peakCharacters: null as { tick: number; ids: number[] } | null,
  };

  private regionRecord(id: string): Region {
    return this.regions[id] ??= { ticks: 0, attacks: 0, groupAttacks: 0, peak: 0, normalPeak: 0, regularPeak: 0, dogPeak: 0, alphaPeak: 0, regularGroupPeaks: {} };
  }

  constructor(private readonly world: SimWorld) {
    observeAttackStarts(world, (_sourceId, targetId) => {
      if (world.scenario !== 'L10' || world.missions?.state.phase !== 'playing' || world.missions.state.states['cure-released']) return;
      const p = world.entities.get(1)!.transform;
      const region = cure.regions.find(r => p.x >= r.envelope[0][0] && p.x <= r.envelope[1][0]);
      if (!region) return;
      const record = this.regionRecord(region.id);
      if (targetId === 1) record.attacks++;
      else if (world.entities.get(targetId)?.civilian?.survivor?.mode === 'follow') record.groupAttacks++;
    });
    const emit = world.events.emit.bind(world.events);
    world.events.emit = event => { this.event(event); emit(event); };
    const spawn = world.infected!.spawn.bind(world.infected);
    world.infected!.spawn = (...args) => {
      const id = spawn(...args);
      if (!args[3]) {
        const entity = world.entities.get(id);
        if (entity?.infected) { this.births[entity.archetype] = (this.births[entity.archetype] ?? 0) + 1; this.birthIds.set(id, entity.archetype); }
      }
      return id;
    };
    // Eligibility belongs to the mission phase, after movement/combat. A courier
    // crossing into the radius during physics can legitimately charge this tick.
    let chargeFrame = { eligible: false, charging: false, outside: false, dead: false };
    if (world.scenario === 'L10') world.events.on('sim.tick', () => {
      const state = world.missions!.state, player = world.entities.get(1)!;
      const console = world.missions!.def.anchors['cure-console'];
      const inside = !!console && distance(player.transform, console) <= finale.holdRadius;
      const charging = !!state.states['charge-active'] && state.steps.hold?.status === 'active';
      chargeFrame = { charging, outside: !!console && !inside, dead: player.health.current <= 0,
        eligible: charging && player.health.current > 0 && inside && (state.counters['charge-ticks'] ?? 0) < 3600 };
    }, SimPhase.missions - .01);
    const update = world.update.bind(world);
    world.update = () => {
      if (!this.initial) { this.initial = this.capture(); this.rememberPickups(); }
      const beforeTick = world.tick, beforeCharge = world.missions!.state.counters['charge-ticks'] ?? 0;
      const state = world.missions!.state, player = world.entities.get(1)!;
      const search = world.scenario === 'L5' && state.phase === 'playing' && state.l5?.phase === 'search';
      const playerX = player.transform.x, playerZ = player.transform.z;
      update();
      if (world.tick === beforeTick) return;
      this.l5Formation.observe(world, { x: playerX, z: playerZ });
      if (search) {
        const route = this.l5SearchRoute, step = Math.hypot(player.transform.x - playerX, player.transform.z - playerZ);
        route.ticks++;
        if (step > 1) route.discontinuities++; else route.metres += step;
        // A visible living body within10m is a conservative route encounter.
        // Each identity counts once; distant census entries never qualify it.
        for (const e of world.infected!.active) {
          if (route.encounters.has(e.id) || e.health.current <= 0 || e.hidden || e.pendingAdmission || e.corpse) continue;
          const d = distance(e.transform, player.transform);
          if (d <= 10 && world.combat!.query.visible(player.transform, e.transform)) route.encounters.set(e.id, { id: e.id, tick: world.tick, atMetres: route.metres, distance: d });
        }
      }
      const afterCharge = world.missions!.state.counters['charge-ticks'] ?? 0;
      const { charging, outside, dead, eligible: chargeEligible } = chargeFrame;
      if (charging) {
        this.charge.activeTicks++;
        if (chargeEligible) this.charge.eligibleTicks++;
        if (outside) this.charge.outsideTicks++;
        if (dead) this.charge.deadTicks++;
        if (afterCharge > beforeCharge) { this.charge.incrementTicks += afterCharge - beforeCharge; if (!chargeEligible || afterCharge !== beforeCharge + 1) this.charge.invalidIncrements++; }
      }
      this.charge.maximum = Math.max(this.charge.maximum, afterCharge);
      this.observe();
    };
  }

  private capture() {
    const w = this.world, mission = w.missions!, entities = [...w.entities.iterate()], weapons = w.entities.get(1)!.weapons;
    return {
      tick: w.tick, mission: structuredClone(mission.state), deadline: mission.def.deadline ?? null,
      arsenal: [...(w.progression?.campaign?.ownedActions ?? [])], racks: weapons ? { LEFT: weapons.LEFT.rack.map(slot => slot.id), RIGHT: weapons.RIGHT.rack.map(slot => slot.id) } : null,
      player: structuredClone(w.entities.get(1)!),
      census: entities.filter(e => e.civilian || e.companion || e.vehicle || e.pickup || e.infected).map(e => ({ id: e.id, archetype: e.archetype, x: e.transform.x, z: e.transform.z,
        hp: e.health.current, maxHp: e.health.max, civilian: !!e.civilian, role: e.civilian?.ally?.role ?? null, animal: e.civilian?.zooAnimal ?? null, companion: !!e.companion,
        infected: !!e.infected, pickup: e.pickup ? structuredClone(e.pickup) : null })),
      l7: structuredClone(w.l7Encounters?.state ?? null), departure: structuredClone(w.l7Departure?.state ?? null),
      l8: structuredClone(mission.l8?.state ?? null), l9: structuredClone(mission.l9?.state ?? null),
      mega: structuredClone(w.megaPursuit?.state ?? null),
      checkpoints: mission.checkpointPositions(),
    };
  }

  private rememberPickups(): void {
    for (const e of this.world.entities.iterate()) {
      if (!e.pickup) continue;
      const p = e.pickup;
      this.pickupPositions.set(e.id, { x: e.transform.x, z: e.transform.z, shelf: 'surfaceY' in p && p.surfaceY !== undefined,
        item: 'actionId' in p ? p.actionId : p.item });
    }
  }

  private event(event: GameEvent): void {
    const w = this.world, m = w.missions?.state;
    this.eventCounts[event.type] = (this.eventCounts[event.type] ?? 0) + 1;
    if (event.type === 'player.damaged' && m?.l6?.phase === 'retreat') this.l6RetreatDamage += event.amount;
    if (event.type === 'checkpoint.restored') { this.collected.clear(); this.megaPrevious = null; }
    if (/^(?:l[2-6]\.|checkpoint\.|objective\.|mission.signal|dialogue.line|player\.(?:died|respawned)|vehicle\.(?:durability-hit|attack-windup)|level.completed)/.test(event.type)) this.ledger.push(structuredClone(event));
    if (event.type.startsWith('combat.') && (m?.l1?.phase === 'morning' || m?.l2?.phase === 'calm' || m?.l4 && !m.l4.gunAt || w.scenario === 'L8' && !w.missions?.l8?.state.breachedAt)) this.calm.combatEvents++;
    if (event.type === 'infected.attack') {
      if (w.entities.get(event.targetId)?.companion) this.corgi.targeted++;
      if (m?.l2?.doorsOpenAt && event.tick - m.l2.doorsOpenAt <= 120 * 60) {
        if (event.targetId === 1) { this.l2Contact.playerAttacks++; this.l2Contact.firstAttackSeconds ??= (event.tick - m.l2.doorsOpenAt) / 60; }
        else if (w.entities.get(event.targetId)?.civilian?.ally?.role === 'firefighter') this.l2Contact.groupAttacks++;
      }
    }
    if (event.type === 'combat.hit' && w.entities.get(event.targetId)?.companion && event.amount > 0) this.corgi.hit++;
    if (event.type === 'pickup.collected') {
      const id = 'pickupId' in event ? event.pickupId : event.id;
      const live = w.entities.get(id), known = this.pickupPositions.get(id);
      const at = live?.transform ?? known, player = w.entities.get(1)!;
      const collector = 'sourceId' in event ? event.sourceId : null;
      if (this.collected.has(id)) this.duplicatePickups.push(id);
      this.collected.add(id);
      this.pickups.push({ tick: event.tick, id, item: 'actionId' in event ? event.actionId : event.item, collector,
        distance: at ? distance(at, w.entities.get(collector ?? 1)?.transform ?? player.transform) : null,
        shelf: known?.shelf ?? false, interact: w.inputFrame.interact, speed: player.motion?.speed ?? 0 });
    }
    if (event.type === 'mission.signal' && event.name === 'cure-released') {
      const console = w.missions!.def.anchors['cure-console'];
      this.release = { tick: event.tick, charge: m!.counters['charge-ticks'], installed: !!m!.states['cure-installed'], dead: !!m!.states['mega-dead'], distance: distance(w.entities.get(1)!.transform, console) };
    }
  }

  private observe(): void {
    const w = this.world, m = w.missions!, s = m.state, player = w.entities.get(1)!;
    const alive = w.infected!.active.filter(e => e.health.current > 0 && !e.corpse);
    this.peakAlive = Math.max(this.peakAlive, alive.length);
    let civilians = 0;
    for (const e of w.entities.iterate()) {
      if (e.civilian && e.health.current > 0 && !e.infected && !e.corpse) civilians++;
      if (e.companion) { this.corgi.ids.add(e.id); this.corgi.samples++; this.corgi.minimumHealthFraction = Math.min(this.corgi.minimumHealthFraction, e.health.current / e.health.max); }
    }
    this.peakCharacters = Math.max(this.peakCharacters, alive.length + civilians + 1);
    const calm = s.l1?.phase === 'morning' || s.l2?.phase === 'calm' || !!s.l4 && !s.l4.gunAt || w.scenario === 'L8' && !m.l8?.state.breachedAt;
    if (calm) { this.calm.ticks++; this.calm.maxAlive = Math.max(this.calm.maxAlive, alive.length); if (s.marker) this.calm.markerTicks++; }
    const phase = s.l1?.phase ?? s.l2?.phase ?? s.l3?.phase ?? s.l4?.phase ?? s.l5?.phase ?? s.l6?.phase ?? (w.scenario === 'L8' ? m.l8?.state.breachedAt ? 'breached' : 'sanctuary' : s.phase);
    if (phase !== this.controllerPhase) { this.phaseStarts.push({ phase, tick: w.tick, live: alive.length, civilians }); this.controllerPhase = phase; }
    const peak = this.phasePeaks[phase] ??= { alive: 0, characters: 0 };
    peak.alive = Math.max(peak.alive, alive.length); peak.characters = Math.max(peak.characters, alive.length + civilians + 1);
    if (w.scenario === 'L4' && s.l4?.phase === 'war') {
      const scale = this.l4Scale, director = w.infected!.director;
      const humans = [...w.entities.iterate()].filter(e => e.health.current > 0 && !e.corpse && e.civilian && !e.civilian.pet && !e.civilian.zooAnimal && !e.infected && !e.infection);
      if (!scale.turn && w.tick === s.l4.turnAt) {
        const soldiers = humans.filter(e => s.l4!.soldierIds.includes(e.id)).map(e => e.id);
        const people = humans.filter(e => !soldiers.includes(e.id));
        scale.turn = { tick: w.tick, soldiers, civilians: people.map(e => e.id), armed: people.filter(e =>
          s.l4!.armed.some(entry => entry.id === e.id && entry.armedAt > 0 && e.civilian?.ally && e.appearance?.handProp === entry.weapon)).map(e => e.id) };
      }
      scale.ticks++;
      scale.firstTick ??= w.tick; scale.lastTick = w.tick;
      const slots = { tick: w.tick, living: alive.length, livingIds: alive.map(e => e.id), reserved: director.reserved, pendingTurns: director.pendingTurns,
        total: alive.length + director.reserved + director.pendingTurns };
      if (!scale.peakSlots || slots.total > scale.peakSlots.total) scale.peakSlots = slots;
      const ids = [...w.entities.iterate()].filter(e => e.health.current > 0 && !e.corpse &&
        (e.id === 1 || e.infected || e.companion || e.civilian && !e.civilian.pet && !e.civilian.zooAnimal)).map(e => e.id);
      if (!scale.peakCharacters || ids.length > scale.peakCharacters.ids.length) scale.peakCharacters = { tick: w.tick, ids };
    }
    const active = m.def.steps.filter(def => s.steps[def.id].status === 'active').map(def => def.id).join(',');
    const anchor = markerAnchor(m), signature = `${active}|${s.marker}`;
    if (signature !== this.markerSignature) { this.markerChanges.push({ tick: w.tick, step: active, marker: s.marker, ...(anchor ? { x: anchor.x, z: anchor.z } : {}) }); this.markerSignature = signature; }
    if (anchor && s.marker) {
      const record = this.markers.get(s.marker) ?? { x: anchor.x, z: anchor.z, samples: 0, maxDisplacement: 0 };
      record.samples++; record.maxDisplacement = Math.max(record.maxDisplacement, distance(record, anchor)); this.markers.set(s.marker, record);
    }
    if (s.runOutUntil !== undefined) {
      this.runOut ??= { tick: w.tick, until: s.runOutUntil, minimumInvulnerableUntil: player.survivor!.invulnerableUntil };
      if (w.tick < s.runOutUntil) this.runOut.minimumInvulnerableUntil = Math.min(this.runOut.minimumInvulnerableUntil, player.survivor!.invulnerableUntil);
    }
    if (s.l2) {
      if (s.steps.bridge?.status === 'active' && s.phase === 'playing' && player.health.current > 0) {
        const delta = this.l2RoutePrevious ? distance(player.transform, this.l2RoutePrevious) : 0;
        this.l2RoutePrevious = { x: player.transform.x, z: player.transform.z };
        if (delta > 1) this.l2Route.discontinuities++;
        else { this.l2Route.metres += delta; this.l2EncounterGap += delta; }
        this.l2Route.ticks++;
        const nearby = alive.filter(e => !e.hidden && !e.pendingAdmission && !e.emerging && distance(e.transform, player.transform) <= 15 && w.combat!.query.visible(player.transform, e.transform, e.id));
        for (const e of nearby) this.l2EncounterIds.add(e.id);
        this.l2Route.maxEncounterGapM = Math.max(this.l2Route.maxEncounterGapM, this.l2EncounterGap);
        if (nearby.length) this.l2EncounterGap = 0;
      } else this.l2RoutePrevious = null;
      this.l2Maximum.ambush = Math.max(this.l2Maximum.ambush, s.l2.ambushIds.length); this.l2Maximum.cluster = Math.max(this.l2Maximum.cluster, s.l2.clusterIds.length);
      if (s.l2.doorsOpenAt && w.tick - s.l2.doorsOpenAt <= 120 * 60) this.l2Contact.ticks++;
      if (!s.l2.doorsOpenAt) {
        const door = m.def.anchors['l2-market'];
        if (door) { this.l2BeforeDoors.samples++; for (const e of alive) this.l2BeforeDoors.nearest = Math.min(this.l2BeforeDoors.nearest, distance(e.transform, door)); }
      }
      if (s.l2.released && this.releaseFirstTick === null) this.releaseFirstTick = w.tick;
    }
    if (w.scenario === 'L10') {
      const story = this.l10Story;
      const ordinary = alive.filter(e => !e.infected?.pursuit).length;
      if (s.states['charge-active']) story.assaultPeak = Math.max(story.assaultPeak, ordinary);
      else story.outsideAssaultPeak = Math.max(story.outsideAssaultPeak, ordinary);
      for (const e of alive) {
        if ((e.motion?.speed ?? 0) > .1) this.l10Moved.add(e.id);
        if (e.hidden || e.infected?.hidden || !w.infected!.director.inFrame(e.transform, 1, true) || w.infected!.director.occluded(e.transform)) continue;
        if (e.infected?.pursuit) {
          story.firstMegaVisibleSeconds ??= w.tick / 60;
          const section = Math.floor(player.transform.x / 500);
          if (distance(e.transform, player.transform) < 30 && !story.closeSections.includes(section)) story.closeSections.push(section);
        } else if (!this.l10Seen.has(e.id)) {
          this.l10Seen.add(e.id); story.seen++;
          this.l10FirstSightings.push({ id: e.id, seconds: w.tick / 60, archetype: e.archetype, state: e.infected!.state, speed: e.motion?.speed ?? 0, x: e.transform.x, z: e.transform.z });
          // A warned scare's birth frame and an attacking/staggered enemy have
          // zero velocity without being an idle roadside stand-in.
          if (!this.l10Moved.has(e.id) && ['idle','wander'].includes(e.infected!.state)) story.idleEntries.push(e.id);
        }
      }
      if (s.states['cure-carried']) {
        const racks = [...player.weapons!.LEFT.rack, ...player.weapons!.RIGHT.rack].map(slot => slot.id);
        story.fullArsenal ||= cureHangarWeapons.every(id => racks.includes(id));
      }
      const r = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]);
      if (r && !s.states['cure-released']) {
        const record = this.regionRecord(r.id);
        const local = alive.filter(e => e.transform.x >= r.envelope[0][0] && e.transform.x <= r.envelope[1][0] && e.transform.z >= r.envelope[0][1] && e.transform.z <= r.envelope[1][1]);
        const dogs = local.filter(e => e.archetype.includes('dog')).length, alphas = local.filter(e => e.archetype.includes('alpha') && !e.infected?.pursuit).length;
        record.ticks++; record.peak = Math.max(record.peak, local.length); record.normalPeak = Math.max(record.normalPeak, local.filter(e => !e.infected?.pursuit).length); record.dogPeak = Math.max(record.dogPeak, dogs); record.alphaPeak = Math.max(record.alphaPeak, alphas); record.regularPeak = Math.max(record.regularPeak, local.filter(e => !e.archetype.includes('dog') && !e.archetype.includes('alpha')).length);
        const livingById = new Map(alive.map(actor => [actor.id, actor]));
        const groupCounts = new Map<string, number>();
        for (const [slot, id] of Object.entries(w.l10Encounters?.state.spawned ?? {})) {
          const group = slot.slice(0, slot.indexOf(':'));
          if (cureEncounterRegion.get(group) !== r.id) continue;
          const entity = livingById.get(id);
          if (!entity || entity.pendingAdmission || entity.hidden || entity.archetype.includes('dog') || entity.archetype.includes('alpha') || entity.transform.x < r.envelope[0][0] || entity.transform.x > r.envelope[1][0] || entity.transform.z < r.envelope[0][1] || entity.transform.z > r.envelope[1][1]) continue;
          groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
        }
        for (const [group, count] of groupCounts) record.regularGroupPeaks[group] = Math.max(record.regularGroupPeaks[group] ?? 0, count);
      }
      if (w.tick <= 3600) { this.firstMinute.ticks++; this.firstMinute.regularPeak = Math.max(this.firstMinute.regularPeak, alive.filter(e => !e.archetype.includes('dog') && !e.archetype.includes('alpha')).length); this.firstMinute.dogPeak = Math.max(this.firstMinute.dogPeak, alive.filter(e => e.archetype.includes('dog')).length); this.firstMinute.alphaPeak = Math.max(this.firstMinute.alphaPeak, alive.filter(e => e.archetype.includes('alpha') && !e.infected?.pursuit).length); }
      const boss = w.megaPursuit?.state, entity = w.megaPursuit?.entity();
      if (boss?.id && entity && boss.mode !== 'dead') {
        this.megaIntroduction ??= { tick: boss.introducedAt, distance: distance(entity.transform, player.transform), route: [...boss.route] };
        if (this.megaPrevious?.id === boss.id && this.megaPrevious.tick === w.tick - 1) this.maxMegaStep = Math.max(this.maxMegaStep, distance(this.megaPrevious, entity.transform));
        this.megaPrevious = { id: boss.id, ...entity.transform, tick: w.tick };
      }
    }
    if (w.tick % 30 === 0) {
      this.rememberPickups();
      for (const e of alive) {
        if (e.archetype !== 'infected.runner') continue;
        this.speed.regularMax = Math.max(this.speed.regularMax, e.infected!.speed);
        this.speed.regularSamples++; if (e.infected!.speed > 4.5) this.speed.fasterThanPlayer++;
        if (e.infected!.speed > 4) this.speed.sprinters++;
      }
    }
    this.maxDetailedChunks = Math.max(this.maxDetailedChunks, w.chunks?.stats().resident ?? 0);
  }

  finish() {
    this.final = this.capture();
    return { initial: this.initial, final: this.final, eventCounts: this.eventCounts, ledger: this.ledger, pickups: this.pickups, duplicatePickups: this.duplicatePickups,
      peakAlive: this.peakAlive, peakCharacters: this.peakCharacters, firstMinute: this.firstMinute, markers: [...this.markers].map(([id, record]) => ({ id, ...record })), markerChanges: this.markerChanges, l5Formation: this.l5Formation.snapshot(), l4Scale: this.l4Scale,
      corgi: { ...this.corgi, ids: [...this.corgi.ids] }, phaseStarts: this.phaseStarts, phasePeaks: this.phasePeaks, births: this.births, speed: this.speed, runOut: this.runOut, regions: this.regions,
      charge: this.charge, l10Story: this.l10Story, l10FirstSightings: this.l10FirstSightings, megaIntroduction: this.megaIntroduction, maxMegaStep: this.maxMegaStep, release: this.release, calm: this.calm, l6RetreatDamage: this.l6RetreatDamage,
      l2BeforeDoors: { ...this.l2BeforeDoors, nearest: Number.isFinite(this.l2BeforeDoors.nearest) ? this.l2BeforeDoors.nearest : null }, l2Contact: this.l2Contact, l2Maximum: this.l2Maximum, l2Route: { ...this.l2Route, encounterIds: [...this.l2EncounterIds] }, releaseFirstTick: this.releaseFirstTick, maxDetailedChunks: this.maxDetailedChunks,
      l5SearchRoute: { ...this.l5SearchRoute, encounters: [...this.l5SearchRoute.encounters.values()] } };
  }
}
export type AcceptanceObservation = ReturnType<AcceptanceObserver['finish']>;
