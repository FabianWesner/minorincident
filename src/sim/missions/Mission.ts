import { LevelTenFinale } from './LevelTenFinale';
import { transactArsenal } from '../progression/arsenal';
import { LevelNineCrash } from './LevelNineCrash';
import { LevelEightZoo } from './LevelEightZoo';
import { LevelSixSubway } from './LevelSixSubway';
// Zones enter/leave latching and named respawns adapted from Bruno Simon folio-2025
// Zones.js / Respawns.js (MIT, 41046b5). State belongs to the fixed-step sim.
import { LevelOneOutbreak } from './LevelOneOutbreak';
import { LevelTwoRescue } from './LevelTwoRescue';
import { LevelThreeCollapse } from './LevelThreeCollapse';
import { LevelFourWar } from './LevelFourWar';
import { LevelFiveAftermath } from './LevelFiveAftermath';
import { captureSeams, restoreSeams } from './l1Seams';
import { respawnAtCheckpoint, runOutRule } from './Respawn';
import { dialogue } from '../../data/dialogue';
import { SimPhase } from '../../core/EventBus';
import { WorldHumans } from '../ai/Perception';
import type { InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot, GameEvent } from '../world/types';
import { validateMission } from './schema';
import type { FailReason, MissionCheckpoint, MissionDef, MissionState, ObjectiveDef, ScriptAction, StepState, Trigger } from './types';

type Unticked<E> = E extends { tick: number } ? Omit<E, 'tick'> : never;
/** Level-owned objective graph, script actions, checkpoints and result counters. */
/** Hold timers survive stepping this far outside an interact ring; a click this close to a ring walks to its centre. */
const INTERACT_SLACK_M = 0.5, CLICK_SNAP_M = 1.5;
export class Mission {
  readonly state: MissionState;
  private readonly stops: (() => void)[] = [];
  private readonly checkpoints = new Map<string, MissionCheckpoint>();
  private readonly deadBosses = new Set<string>();
  private readonly rescued = new Set<number>();
  private readonly zones = new Map<Trigger, { actor?: string; anchor: string; index: number; inside: boolean; entered: boolean; exited: boolean }>();
  private readonly gateHandles = new Map<string, number>();
  private markerObjective: string | null = null;
  private pendingMarker: string | null = null;
  private readonly pendingCheckpoints: { id: string; anchor?: { x: number; z: number } }[] = [];
  private finishApplied = false;
  /** Last tick with a swing, shot or explosion (run-out rule). */
  private lastActionTick = -Infinity;
  private prepared = false;
  private readonly l1: LevelOneOutbreak | null;
  /** E20 set-piece controller (def.l2). */
  readonly l2: LevelTwoRescue | null;
  /** E21 controller (def.l3). */
  readonly l3: LevelThreeCollapse | null;
  /** E22 controller (def.l4). */
  readonly l4: LevelFourWar | null;
  /** E23 controller (def.l5). */
  readonly l5: LevelFiveAftermath | null;
  readonly l6: LevelSixSubway | null;
  /** E30 sanctuary, internal outbreak and armored escape. */
  readonly l8: LevelEightZoo | null;
  readonly l9: LevelNineCrash | null;
  readonly l10: LevelTenFinale | null;
  private startTick: number;
  constructor(readonly world: SimWorld, readonly def: MissionDef) {
    const errors = validateMission(def); if (errors.length) throw new Error(errors.join('\n'));
    this.l10 = def.id === 'L10' ? new LevelTenFinale(this) : null;
    this.l9 = def.l9 ? new LevelNineCrash(this) : null;
    this.l8 = def.l8 ? new LevelEightZoo(this) : null;
    this.l1 = def.l1 ? new LevelOneOutbreak(this) : null;
    this.l2 = def.l2 ? new LevelTwoRescue(this) : null;
    this.l3 = def.l3 ? new LevelThreeCollapse(this) : null;
    this.l4 = def.l4 ? new LevelFourWar(this) : null;
    this.l6 = def.l6 ? new LevelSixSubway(this) : null;
    this.l5 = def.l5 ? new LevelFiveAftermath(this) : null;
    this.startTick = world.tick;
    this.state = {
      id: def.id, phase: 'briefing', completedObjectives: [], volumes: [], killedBosses: [], deadlineTicks: def.deadline ? Math.ceil(def.deadline.seconds * 60) : null,
      steps: Object.fromEntries(def.steps.map(s => [s.id, { status: 'pending', started: 0, kills: [], events: {}, interaction: 0 }])),
      actors: {}, items: [], states: Object.fromEntries(def.states.map(id => [id, false])), counters: Object.fromEntries(def.counters.map(id => [id, 0])),
      gates: Object.fromEntries(Object.entries(def.gates).map(([id, gate]) => [id, gate.open])), marker: null, checkpoint: null, tier: world.districts?.composition.tier ?? null, timeOfDay: null,
      subtitle: null, cinematic: null, failure: null,
      stats: { time: 0, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] }, result: null,
    };
    world.mission = this.state; this.rebuildGates();
    for (const step of def.steps) {this.registerZones(step.complete); for(const fail of step.fail)this.registerZones(fail.trigger);}
    this.stops.push(world.events.on('sim.tick', () => this.update(), SimPhase.missions));
    // Result counters: every pedestrian turned or escaped, whichever lane's event reports it (ids dedupe).
    for (const type of ['civilian.turned', 'outbreak.infection', 'outbreak.bite', 'outbreak.civilian-escaped'] as const) this.stops.push(world.events.on(type, event => {
      if (event.type === 'civilian.turned') this.l1?.noteTurned(event.id);
      else if (event.type === 'outbreak.infection' && event.phase === 'infected') this.l1?.noteTurned(event.entityId);
      else if (event.type === 'outbreak.bite' && event.turns) this.l1?.noteTurned(event.targetId);
      else if (event.type === 'outbreak.civilian-escaped') this.l1?.noteEscaped(event.id);
    }, SimPhase.missions));
    for (const type of ['combat.attack', 'combat.exploded', 'explosion'] as const) this.stops.push(world.events.on(type, () => { this.lastActionTick = world.tick; }, SimPhase.missions));
    for (const type of ['combat.kill', 'player.damaged', 'player.died', 'player.respawned', 'mission.signal', 'mission.failed', 'pickup.collected', 'vehicle.entered', 'vehicle.exited', 'interact.completed', 'prop.broken', 'barricade.built', 'barricade.broken', 'barricade.repaired'] as const) this.stops.push(world.events.on(type, event => this.event(event), SimPhase.missions));
    this.emit({ type: 'mission.briefing', id: def.id, text: def.briefing });
  }
  private emit(event: Unticked<import('./events').MissionEvent>): void {
    this.world.events.emit({ ...event, tick: this.world.tick } as GameEvent);
  }
  /** Install the initial cast while loading so its assets and shaders are ready at Begin. */
  prepare(): void {
    if (this.prepared || this.state.phase !== 'briefing') return;
    this.l1?.prepare(); this.l2?.prepare(); this.l3?.prepare(); this.l4?.prepare(); this.l5?.prepare(); this.l6?.prepare(); this.l8?.prepare(); this.l9?.prepare();
    this.prepared = true;
  }
  /** A briefing is explicit; callers may accept it immediately for deterministic fixtures. */
  begin(): void {
    if (this.state.phase !== 'briefing') return;
    this.prepare();
    if (this.state.phase !== 'briefing') return;
    this.state.phase = 'playing'; this.run(this.def.onStart); this.activate(); this.flushCheckpoint();
    this.l8?.begin(); this.l9?.begin();
    this.checkpoints.set('start', this.capture());
    this.world.events.emit({ type: 'level.started', tick: this.world.tick, id: this.def.id });
  }
  private registerZones(t: Trigger): void {
    if (t.kind === 'volume' && !this.zones.has(t)) {this.zones.set(t,{actor:t.actor,anchor:t.anchor,index:this.state.volumes.length,inside:false,entered:false,exited:false});this.state.volumes.push(false);}
    if (t.kind === 'all' || t.kind === 'any') t.triggers.forEach(child => this.registerZones(child));
  }
  private entity(actor: string): EntitySnapshot | undefined { return this.world.entities.get(this.state.actors[actor]); }
  private inside(anchor: string, entity: EntitySnapshot | null | undefined = this.world.entities.get(1), slack = 0): boolean {
    const a = this.def.anchors[anchor]; return !!entity && (entity.transform.x - a.x) ** 2 + (entity.transform.z - a.z) ** 2 <= (a.radius + slack) ** 2;
  }
  /** A click near an active stand-to-interact ring (its rack, its truck door) walks to the ring centre instead of stopping against the prop. */
  interactSnap(p: { x: number; z: number }): { x: number; z: number } {
    if (this.state.phase !== 'playing') return p;
    for (const def of this.def.steps) {
      const trigger = this.interactTrigger(def.complete);
      if (this.state.steps[def.id].status !== 'active' || !trigger || trigger.actor) continue;
      const a = this.def.anchors[trigger.anchor];
      if (Math.hypot(p.x - a.x, p.z - a.z) <= a.radius + CLICK_SNAP_M) return { x: a.x, z: a.z };
    }
    return p;
  }
  /** True while the player stands in an active step's interact ring: an `E` press belongs to the objective
   * (E19 QA1-01: pick up the parcel without also leaving the bicycle). */
  /** The active interact step whose ring the player stands in (HUD prompt), or null. */
  private interactTrigger(t: Trigger): Extract<Trigger, { kind: 'interact' }> | undefined {
    if (t.kind === 'interact') return t;
    if (t.kind === 'all') for (const child of t.triggers) { const found = this.interactTrigger(child); if (found) return found; }
    return undefined;
  }
  interactStepInRange(): ObjectiveDef | null {
    if (this.state.phase !== 'playing') return null;
    if (this.l10 && this.state.steps.hold.status === 'active' && !this.state.states['charge-active'] && this.def.anchors['cure-console'] && this.inside('cure-console')) {
      const hold = this.def.steps.find(s => s.id === 'hold')!;
      return { ...hold, text: 'Activate the dispersal console', type: 'interact', complete: { kind: 'interact', anchor: 'cure-console', seconds: .6 } };
    }
    const step = this.def.steps.find(def => this.state.steps[def.id].status === 'active' && this.interactTrigger(def.complete) && this.inside(this.interactTrigger(def.complete)!.anchor));
    return step ? { ...step, complete: this.interactTrigger(step.complete)! } : null;
  }
  interactionAvailable(): boolean {
    return this.interactStepInRange() !== null;
  }
  private satisfied(t: Trigger, step?: StepState): boolean {
    switch (t.kind) {
      case 'start': return true;
      case 'objectives': return t.mode === 'all' ? t.ids.every(id => this.state.steps[id].status === 'completed') : t.ids.some(id => this.state.steps[id].status === 'completed');
      case 'volume': { const zone = this.zones.get(t); return t.edge === 'inside' ? this.inside(t.anchor, t.actor ? this.entity(t.actor) ?? null : undefined) : !!zone?.[t.edge === 'enter' ? 'entered' : 'exited']; }
      case 'interact': if (t.actor) return this.world.vehicles?.active == null && this.inside(t.anchor) && this.entity(t.actor)?.interactable?.completed === true; return !!step && this.inside(t.anchor) && (this.world.inputFrame.interact || step.interaction >= Math.ceil(t.seconds * 60));
      case 'kills': return t.actors.filter(id => this.deadBosses.has(id) || step?.kills.includes(this.state.actors[id])).length >= (t.count ?? t.actors.length);
      case 'timer': return !!step && this.world.tick - step.started >= Math.ceil(t.seconds * 60);
      case 'dead': { const e = this.entity(t.actor); return e?.escort ? e.escort.state === 'dead' : e?.health.current === 0; }
      case 'escort': return !!this.entity(t.actor) && this.entity(t.actor)!.health.current > 0 && this.inside(t.anchor, this.entity(t.actor) ?? null);
      case 'drive': {
        const e = this.entity(t.actor), driven = !!e?.vehicle && e.vehicle.driver === 1 && this.world.vehicles?.active === e.id;
        if (driven && e!.health.current > 0 && this.inside(t.anchor, e)) { if (step) step.driveArrived = true; if (!t.exit) return true; }
        return !!t.exit && !!step?.driveArrived && !!e?.vehicle && e.health.current > 0 && e.vehicle.driver === null && this.world.vehicles?.active == null && this.inside(t.anchor);
      }
      case 'hold': return !!step && (step.holds?.[t.anchor] ?? 0) >= Math.ceil(t.seconds * 60);
      case 'destroy': { const e = this.entity(t.actor); return !!e && e.health.current <= 0; }
      case 'items': return t.ids.every(id => this.state.items.includes(id));
      case 'state': return this.state.states[t.key] === t.equals;
      case 'count': return this.state.counters[t.key] >= t.atLeast;
      case 'event': return (step?.events[`${t.type}:${t.actor ?? '*'}`] ?? 0) >= t.count;
      case 'all': return t.triggers.every(child => this.satisfied(child, step));
      case 'any': return t.triggers.some(child => this.satisfied(child, step));
    }
  }
  private update(): void {
    if (this.state.phase !== 'playing') return;
    this.l10?.update(); this.l1?.update(); this.l2?.update(); this.l3?.update(); this.l4?.update(); this.l5?.update(); this.l6?.update(); this.l8?.update(); this.l9?.update();
    const alive=this.world.entities.get(1)!.health.current>0;
    this.state.stats.time = (this.world.tick - this.startTick) / 60;
    if (this.state.deadlineTicks !== null && --this.state.deadlineTicks <= 0) { this.state.deadlineTicks = 0; this.fail('timeout'); return; }
    if (this.state.subtitle && this.world.tick >= this.state.subtitle.until) this.state.subtitle = null;
    for (const zone of this.zones.values()) {
      const inside = this.inside(zone.anchor, zone.actor ? this.entity(zone.actor) ?? null : undefined);
      zone.entered = inside && !zone.inside; zone.exited = !inside && zone.inside; zone.inside = inside; this.state.volumes[zone.index]=inside;
    }
    // Only steps active at tick start can complete: no accidental cascading through a graph.
    for (const def of this.def.steps) {
      const step = this.state.steps[def.id]; if (step.status !== 'active') continue;
      const holds = new Set<string>();
      const visit = (t: Trigger): void => { if (t.kind === 'hold') holds.add(t.anchor); else if (t.kind === 'all' || t.kind === 'any') t.triggers.forEach(visit); };
      visit(def.complete);
      for (const anchor of holds) { step.holds ??= {}; step.holds[anchor] = alive && this.inside(anchor) ? (step.holds[anchor] ?? 0) + 1 : 0; }
      // Stand-to-interact tolerates a small drift past the ring edge (a shove, the corgi, a turn): the hold only resets when she really leaves.
      step.interaction = !alive ? 0 : this.inside(def.anchor) ? step.interaction + 1 : def.complete.kind === 'interact' && this.inside(def.anchor, undefined, INTERACT_SLACK_M) ? step.interaction : 0;
      const failure = def.fail.find(f => this.satisfied(f.trigger, step));
      if (failure) { this.fail(failure.reason, def); break; }
      if (def.timer !== undefined && this.world.tick - step.started >= Math.ceil(def.timer * 60)) { this.fail('timeout', def); break; }
      if (alive && this.satisfied(def.complete, step)) this.complete(def);
      if (this.state.phase !== 'playing') break;
    }
    this.activate(); this.finish(); this.flushCheckpoint();
  }
  private activate(): void {
    if (this.state.phase !== 'playing') return;
    for (const def of this.def.steps) {
      const step = this.state.steps[def.id];
      if (step.status !== 'pending' || !this.satisfied(def.start)) continue;
      step.status = 'active'; step.started = this.world.tick;
      this.emit({ type: 'objective.started', id: def.id }); this.run(def.onStart ?? []);
    }
    const current = this.def.steps.find(s => this.state.steps[s.id].status === 'active');
    if(this.markerObjective!==(current?.id??null)){this.markerObjective=current?.id??null;this.state.marker=current?.waypoint===false?null:current?.anchor??null;}
    if(this.pendingMarker){this.state.marker=this.pendingMarker;this.pendingMarker=null;}
  }
  private complete(def: ObjectiveDef): void {
    this.state.steps[def.id].status = 'completed'; this.state.completedObjectives.push(def.id);
    this.l1?.completed(def.id); this.l2?.completed(def.id); this.l3?.completed(def.id); this.l4?.completed(def.id); this.l5?.completed(def.id); this.l6?.completed(def.id);
    if (def.optional && !this.state.stats.optionalObjectives.includes(def.id)) this.state.stats.optionalObjectives.push(def.id);
    if (def.choice) for (const sibling of this.def.steps) if (sibling.id !== def.id && sibling.choice === def.choice) this.state.steps[sibling.id].status = 'cancelled';
    if (def.type === 'escort' && def.complete.kind === 'escort') this.rescue(this.state.actors[def.complete.actor]);
    this.emit({ type: 'objective.completed', id: def.id }); this.run(def.onComplete ?? []);
  }
  /** A cheat completes precisely one active objective, including in a parallel graph. */
  completeObjective(id?: string): void {
    if (this.state.phase !== 'playing') throw new Error('Mission is not playing');
    let def = this.def.steps.find(s => this.state.steps[s.id].status === 'active' && (id === undefined || s.id === id));
    if (!def && (this.l1?.advance() || this.l2?.advance() || this.l3?.advance() || this.l4?.advance() || this.l5?.advance() || this.l6?.advance() || this.l8?.advance())) { this.activate(); def = this.def.steps.find(s => this.state.steps[s.id].status === 'active' && (id === undefined || s.id === id)); }
    if (!def) throw new Error(`No active objective: ${id ?? ''}`);
    this.complete(def); this.activate(); this.finish(); this.flushCheckpoint();
  }
  private finish(): void {
    if (this.finishApplied || this.state.phase !== 'playing' || !this.def.finish.every(id => this.state.steps[id].status === 'completed')) return;
    if (!this.def.l9 && this.runOut()) return;
    this.finishApplied = true; this.run(this.def.onComplete);
    if (!this.state.cinematic) this.result();
  }
  /**
   * PO 2026-10-13: "After I reached the final checkpoint, if there is still action, then let it go for another 5s, so it doesn't feel cutted."
   * One path for every level: after the last objective, engaged infected within 25 m or a swing, shot or explosion in the last 2 s keep the world
   * running for 5 s (player invulnerable, input live) before the result, cinematic or level transition. No action: no delay.
   */
  private runOut(): boolean {
    const { world, state } = this, tick = world.tick;
    if (state.runOutUntil === undefined) {
      const p = world.entities.get(1)!.transform, ai = world.infected;
      const engaged = !!ai && ai.active.some(e => e.health.current > 0 && !e.corpse && !e.hidden && e.infected && (['chase', 'attack', 'bite'] as string[]).includes(e.infected.l1?.mode === 'chase' ? 'chase' : e.infected.state) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= runOutRule.engagedM);
      if (!engaged && tick - this.lastActionTick > runOutRule.actionS * 60) return false;
      state.runOutUntil = tick + runOutRule.seconds * 60;
    }
    if (tick >= state.runOutUntil) return false;
    const survivor = world.entities.get(1)?.survivor; if (survivor) survivor.invulnerableUntil = Math.max(survivor.invulnerableUntil, state.runOutUntil);
    return true;
  }
  private result(): void {
    this.state.phase = 'result'; this.state.stats.time = (this.world.tick - this.startTick) / 60;
    // The L10 route timing includes its playable epilogue; title and credits have their own presentation clock.
    if (this.state.epilogue && this.state.cureFront) this.state.stats.time -= Math.max(0, this.state.cureFront.elapsed - this.state.counters['epilogue-ticks']) / 60;
    const l5 = this.l5?.result();
    this.state.result = { ...structuredClone(this.state.stats), ...this.l1?.result(), ...l5, ...this.l6?.result(), ...this.l8?.result() };
    this.l9?.end();
    this.emit({ type: 'level.completed', id: this.def.id, result: this.state.result });
    // E20/E21: no caption card or reward screen after L2 and L3; the campaign continues straight into the next level.
    if (this.def.l2 || this.def.l3 || this.def.l4 || this.def.l5 || this.def.l8 || this.def.l9 || this.state.epilogue) this.continue();
  }
  continue(): void { if (this.state.phase === 'result') { this.state.phase = 'progression'; this.emit({ type: 'progression.requested', id: this.def.id }); } }
  private fail(reason: FailReason, def?: ObjectiveDef): void {
    this.state.failure = reason; this.state.phase = 'retry'; this.emit({ type: 'mission.failed', reason }); this.run(def?.onFail ?? []);
  }
  private event(event: GameEvent): void {
    if (event.type === 'player.respawned') {
      // L1 and L4 war/escape retries keep the live world and its progressing director.
      // Shared Respawn always places the courier at the last anchor and clears its threats (PO 2026-10-13).
      if (this.state.phase === 'playing') {
        const cp = this.world.entities.get(1)!.survivor!.checkpoint, anchor = { x: cp.x, z: cp.z };
        const l4Kept = this.state.l4?.phase === 'war' || this.state.l4?.phase === 'collapse';
        if (this.l1) this.l1.respawn();
        else if (l4Kept) { this.world.controls.reset(); this.world.player!.restoreVitals(this.world.tick); this.l4!.respawn(); }
        else this.restore(this.state.checkpoint ?? 'start');
        respawnAtCheckpoint(this.world, anchor, !!this.l1 || l4Kept);
      }
      return;
    }
    if (this.state.phase !== 'playing') return;
    if (event.type === 'mission.failed') { this.state.failure = event.reason; this.state.phase = 'retry'; return; }
    if (event.type === 'pickup.collected' && 'kind' in event && event.kind === 'item' && event.item && this.def.items.includes(event.item)) this.collect(event.item);
    if (event.type === 'player.damaged') this.state.stats.damage += event.amount;
    if (event.type === 'player.died') { this.state.stats.deaths++; }
    if (event.type === 'combat.kill') {
      const entity = this.world.entities.get(event.targetId);
      // PO "Infected recover": a knockdown is not a kill; only explosives and fire kill for good.
      if (entity?.faction === 'infected' && event.sourceId === 1) { if (event.downed !== undefined) this.state.stats.knockdowns++; else this.state.stats.kills++; }
      for (const [id, actor] of Object.entries(this.state.actors)) if (actor === event.targetId && this.def.actors[id]?.boss && !this.deadBosses.has(id)) {this.deadBosses.add(id);this.state.killedBosses.push(id);}
      for (const step of Object.values(this.state.steps)) if (step.status === 'active' && !step.kills.includes(event.targetId)) step.kills.push(event.targetId);
    }
    const type = event.type === 'mission.signal' ? event.name : event.type;
    const actor = event.type === 'combat.kill' ? event.targetId : event.type === 'mission.signal' ? event.actorId : event.type === 'vehicle.entered' || event.type === 'vehicle.exited' ? event.sourceId : event.type === 'interact.completed' || event.type === 'prop.broken' || event.type === 'barricade.built' || event.type === 'barricade.broken' || event.type === 'barricade.repaired' ? event.id : undefined;
    for (const step of Object.values(this.state.steps)) if (step.status === 'active') {
      step.events[`${type}:*`] = (step.events[`${type}:*`] ?? 0) + 1;
      if (actor) for (const [id, entity] of Object.entries(this.state.actors)) if (entity === actor) step.events[`${type}:${id}`] = (step.events[`${type}:${id}`] ?? 0) + 1;
    }
  }
  /** Adult rescues count in the result and can drive an optional event objective. */
  civilianSaved(id: number): void { if (!this.rescued.has(id)) { this.rescued.add(id); this.state.stats.rescued++; this.signal('civilian.saved'); } }
  private rescue(id: number): void {
    if (this.rescued.has(id)) return; this.rescued.add(id); this.state.stats.rescued++;
    this.emit({ type: 'escort.rescued', id });
  }
  /** Integration signal from vehicles/interactables; event triggers retain actor filtering. */
  signal(name: string, actor?: string): void { this.emit({ type: 'mission.signal', name, actorId: actor ? this.state.actors[actor] : undefined }); }
  setState(key: string, value: boolean): void { if (!this.def.states.includes(key)) throw new Error(`Unknown state: ${key}`); this.state.states[key] = value; }
  count(key: string, amount = 1): void { if (!this.def.counters.includes(key) || !Number.isFinite(amount)) throw new Error(`Invalid counter: ${key}`); this.state.counters[key] += amount; }
  collect(item: string): void { if (!this.def.items.includes(item)) throw new Error(`Unknown item: ${item}`); if (!this.state.items.includes(item)) { this.state.items.push(item); this.emit({ type: 'item.granted', id: item }); } }
  spawn(group: string): void {
    const actors = this.def.groups[group]; if (!actors) throw new Error(`Unknown group: ${group}`);
    for (const id of actors) {
      if (this.state.actors[id] || this.deadBosses.has(id)) continue;
      const def = this.def.actors[id], anchor = this.def.anchors[def.anchor];
      const convoy = def.archetype === 'defend.convoy' && this.world.npcs ? this.world.npcs.traffic.convoy(['res', 'fuel', 'checkpoint', 'bridge'].map(key => this.def.anchors[key])) : null;
      const entity = convoy ? this.world.entities.get(convoy[0])! : this.world.spawnMissionActor(def, anchor);
      this.state.actors[id] = entity.id; this.world.spatial.set(entity.id, anchor.x, anchor.z);
    }
    this.emit({ type: 'mission.spawned', id: group });
  }
  /** Gate collision changes immediately; visual consumers react to gate.changed. */
  rebuildGates(): void {
    this.gateHandles.clear();
    for(const [id,gate]of Object.entries(this.def.gates)) {
      const a=this.def.anchors[gate.anchor],handle=this.world.physics.addStatic({min:[a.x-a.radius,0,a.z-.2],max:[a.x+a.radius,2.4,a.z+.2]},[0,0]);
      this.gateHandles.set(id,handle);this.world.physics.world!.getCollider(handle).setEnabled(!this.state.gates[id]);
    }
  }
  /** Keep gate state, collision and checkpoint restoration on the existing mission gate path. */
  setGate(id: string, open: boolean): void {
    this.state.gates[id] = open;
    this.world.physics.world!.getCollider(this.gateHandles.get(id)!).setEnabled(!open);
    this.emit({ type: 'gate.changed', id, open });
  }
  private run(actions: ScriptAction[]): void {
    for (const action of actions) switch (action.kind) {
      case 'spawn': this.spawn(action.group); break;
      case 'migration': this.spawn(action.group); this.emit({ type: 'migration.started', id: action.group, to: this.def.anchors[action.to] }); break;
      case 'tier': this.state.tier = action.tier; this.world.setTier(action.tier); this.emit({ type: 'world.tier-requested', tier: action.tier }); break;
      case 'gate': this.setGate(action.id, action.open); break;
      case 'radio': this.state.subtitle = { id: action.id, text: dialogue[action.id], until: this.world.tick + (action.id === 'L10.research' ? 840 : this.def.id === 'L1' ? 240 : 300) }; this.emit({ type: 'dialogue.line', id: action.id, text: dialogue[action.id] }); break;
      case 'cinematic': if (this.state.cinematic) throw new Error('Overlapping cinematics'); this.state.cinematic = { id: action.id, elapsed: 0, resume:this.state.phase==='retry'?'retry':'playing' }; this.state.phase = 'cinematic'; this.emit({ type: 'cinematic.started', id: action.id }); break;
      case 'timeOfDay': this.state.timeOfDay = action.value; break;
      case 'arsenal': transactArsenal(this.world, action.add, action.remove); break;
      case 'grant': this.collect(action.item); break;
      case 'checkpoint': this.requestCheckpoint(action.id); break;
      case 'marker': this.pendingMarker = action.anchor; break;
      case 'state': this.setState(action.key, action.value); break;
    }
  }
  /** Gameplay is suspended during cinematics, so skip/watch produce identical sim state. */
  advanceCinematic(input: InputFrame): void {
    const current = this.state.cinematic; if (!current) return;
    current.elapsed++;
    const action = input.left.down || input.left.held || input.left.up || input.right.down || input.right.held || input.right.up || input.interact || input.selector !== 0 || input.pause || input.move.x !== 0 || input.move.z !== 0;
    if (current.elapsed < Math.ceil(this.def.cinematics[current.id].seconds * 60) && !(current.elapsed >= 30 && action)) return;
    this.state.cinematic = null; this.state.phase = current.resume; this.run(this.def.cinematics[current.id].actions);
    this.emit({ type: 'cinematic.completed', id: current.id });
    this.activate(); this.flushCheckpoint(); if (this.finishApplied && !this.state.cinematic) this.result();
  }
  /** Story-triggered checkpoint: captured at tick end after spawns; an explicit anchor sets the respawn position without teleporting. */
  requestCheckpoint(id: string, anchor?: { x: number; z: number }): void { this.pendingCheckpoints.push({ id, anchor }); }
  /** Story-controller camera beat (a defined cinematic): only while playing and when no other cinematic runs; returns whether it started. */
  cinematic(id: string): boolean { if (this.state.phase !== 'playing' || this.state.cinematic || !this.def.cinematics[id]) return false; this.run([{ kind: 'cinematic', id }]); return true; }
  /** Dispatcher/toast line through the same path as scripted radio actions. */
  radio(id: string): void { this.run([{ kind: 'radio', id }]); }
  /** Read-only locations of captured checkpoints, including checkpoints created by story controllers. */
  checkpointPositions(): { id: string; position: [number, number, number] }[] {
    return [...this.checkpoints].flatMap(([id, checkpoint]) => {
      const player = checkpoint.entities.find(entity => entity.id === 1);
      return player ? [{ id, position: [player.survivor!.checkpoint.x, player.transform.y, player.survivor!.checkpoint.z] as [number, number, number] }] : [];
    });
  }
  checkpoint(id: string, anchor: { x: number; z: number } = this.world.entities.get(1)!.transform): void { if (!this.def.checkpoints.includes(id)) throw new Error(`Unknown checkpoint: ${id}`); this.state.checkpoint = id; this.world.player!.setCheckpoint({ ...this.world.entities.get(1)!.transform, ...anchor }); this.checkpoints.set(id, this.capture()); this.emit({ type: 'checkpoint.set', id }); }
  private capture(): MissionCheckpoint { return { tick: this.world.tick, state: structuredClone(this.state), entities: this.world.query({}), ...(this.def.id === 'L10' && this.world.progression?.campaign ? { combatSequence: this.world.combat?.runner.lastAttackId ?? 0, arsenal: structuredClone({ ownedActions: this.world.progression.campaign.ownedActions, racks: this.world.progression.campaign.racks }) } : {}), seams: captureSeams(this.world) }; }
  /** Serializable live progress plus the last reached retry checkpoint, for the existing SaveStore. */
  saveResume(): { current: MissionCheckpoint; checkpoint: MissionCheckpoint } {
    const checkpoint = this.checkpoints.get(this.state.checkpoint ?? 'start');
    if (!checkpoint) throw new Error('Mission has no reached checkpoint');
    return { current: this.capture(), checkpoint: structuredClone(checkpoint) };
  }
  /** Called after region/AI services are installed; restores their normal snapshot seams. */
  loadResume(saved: { current: MissionCheckpoint; checkpoint: MissionCheckpoint }): void {
    this.checkpoints.set(saved.checkpoint.state.checkpoint ?? 'start', structuredClone(saved.checkpoint));
    this.checkpoints.set('resume', structuredClone(saved.current));
    this.state.stats = structuredClone(saved.current.state.stats);
    this.startTick = this.world.tick - Math.round(saved.current.state.stats.time * 60);
    this.state.killedBosses = [...saved.current.state.killedBosses];
    this.restore('resume', true);
    if (saved.current.entities.find(e => e.id === 1)!.health.current <= 0) {
      this.restore(saved.checkpoint.state.checkpoint ?? 'start');
      respawnAtCheckpoint(this.world, this.world.entities.get(1)!.survivor!.checkpoint);
    } else {
      this.state.phase = saved.current.state.phase;
      this.state.result = structuredClone(saved.current.state.result);
    }
    this.finishApplied = this.state.phase === 'result' || this.state.phase === 'progression';
    this.checkpoints.delete('resume');
  }
  private flushCheckpoint(): void { for(const { id, anchor } of this.pendingCheckpoints)this.checkpoint(id, anchor);this.pendingCheckpoints.length=0; }
  /** Test loading can reconstruct an authored checkpoint by walking its graph prefix.
   * Existing reached snapshots are always preferred; this is not a gameplay playthrough. */
  loadCheckpoint(id: string): void {
    if(this.checkpoints.has(id)){this.restore(id);return;}
    if(id==='start'){this.begin();this.restore(id);return;}
    if(!this.def.checkpoints.includes(id))throw new Error(`Unknown checkpoint: ${id}`);
    this.begin();
    for(let i=0;i<this.def.steps.length&&!this.checkpoints.has(id);i++){
      if(this.state.phase==='cinematic')for(let frame=0;frame<30;frame++)this.advanceCinematic({...this.world.inputFrame,interact:true});
      if(this.state.phase!=='playing')break;
      // L1 v2: the scripted gap before the infected exit has no objective; fast-forward it to reach the accident checkpoint.
      if(this.l1&&!this.def.steps.some(s=>this.state.steps[s.id].status==='active')&&this.l1.advance()){this.activate();this.flushCheckpoint();continue;}
      this.completeObjective();
    }
    this.restore(id);
  }
  /** Restore mission/actors/racks, retain run totals and permanently killed scripted bosses. */
  restore(id = this.state.checkpoint ?? 'start', resume = false): void {
    if (!resume && this.state.cureFront) { this.l10?.cure.apply(); return; }
    this.world.controls.reset();
    const checkpoint = this.checkpoints.get(id); if (!checkpoint) throw new Error(`Unknown checkpoint: ${id}`);
    const timeout = this.state.failure === 'timeout';
    const stats = this.state.stats, bosses=this.state.killedBosses, delta = this.world.tick - checkpoint.tick;
    // Optional fields absent from the snapshot belong to the discarded timeline
    // too (notably run-out, which otherwise prevents a fresh graph walk).
    const previous = this.state as unknown as Record<string, unknown>;
    for (const key of Object.keys(previous)) if (!(key in checkpoint.state)) delete previous[key];
    Object.assign(this.state, structuredClone(checkpoint.state)); this.state.stats = stats; this.state.killedBosses=bosses; this.state.failure = null; this.state.phase = 'playing'; this.state.cinematic = null; this.state.result = null;
    if (timeout && this.state.deadlineTicks !== null) this.state.deadlineTicks += Math.ceil((this.def.deadline?.retryGraceSeconds ?? 0) * 60);
    this.finishApplied = false; this.pendingCheckpoints.length=0; this.markerObjective=this.def.steps.find(s=>this.state.steps[s.id].status==='active')?.id??null; this.pendingMarker=null;
    for (const step of Object.values(this.state.steps)) if (step.status === 'active') step.started += delta;
    if (checkpoint.arsenal && this.world.progression?.campaign) Object.assign(this.world.progression.campaign, structuredClone(checkpoint.arsenal));
    const entities = structuredClone(checkpoint.entities);
    // Mid-front saves may contain a fall still in flight; preserve its age on a fresh tick-zero clock.
    if (this.state.cureFront) for (const e of entities) if (e.infected?.state === 'dead' && e.infected.recoverAt < 0 && !e.corpse) e.infected.deadAt += delta;
    // Consumed health pickups stay consumed (00 §6.2: a respawn keeps the level's pickups; PO 2026-10-07 med packs never respawn).
    const consumed = new Set<number>(this.world.chunks?.consumedPickups());
    for (const e of this.world.entities.iterate()) if (e.pickup && 'kind' in e.pickup && e.pickup.collected && e.pickup.kind !== 'item' && e.pickup.kind !== 'throwable') consumed.add(e.id);
    for (const e of entities) if (e.pickup && 'kind' in e.pickup && consumed.has(e.id)) e.pickup.collected = true;
    for (const [actor, entityId] of Object.entries(this.state.actors)) if (this.deadBosses.has(actor)) { const entity = entities.find(e => e.id === entityId); if (entity) entity.health.current = 0; }
    // Keep Player's live object because its controller holds that reference.
    const player = this.world.entities.get(1)!;
    const pendingCollider = player.pendingAdmission?.colliderEnabled;
    delete player.pendingAdmission; delete player.hidden; delete player.passengerOf; delete player.attachedTo;
    delete player.weapons; delete player.inventory;
    Object.assign(player, entities[0]); player.health.current = player.health.max; player.survivor!.diedAt = null;
    if (player.pendingAdmission) this.world.physics.playerCollider!.setEnabled(false);
    else if (pendingCollider !== undefined) this.world.physics.playerCollider!.setEnabled(pendingCollider);
    for (const entity of entities) if (entity.light && entity.light.startedAt >= 0) entity.light.startedAt += delta;
    for (const entity of entities) if (entity.vehicle) { if (entity.vehicle.explodeAt !== null) entity.vehicle.explodeAt += delta; if (entity.vehicle.recoveringUntil) entity.vehicle.recoveringUntil += delta; }
    if (!this.world.npcs && this.world.infected) { this.world.infected.pool.push(...this.world.infected.active); this.world.infected.active.length=0; }
    for (const entity of entities) if (entity.interactable) entity.interactable.interruptedAt = -1;
    this.world.entities.restore(entities, player);
    // Healthy checkpoint victims can be bitten again; the old bite exclusion belongs to the discarded timeline.
    if (this.world.infected?.hearing.humans instanceof WorldHumans) this.world.infected.hearing.humans.bitten.clear();
    if (!this.world.npcs && this.world.infected) {
      const ai=this.world.infected;
      ai.active.length=0; ai.director.queue.length=0;
      for (const entity of this.world.entities.iterate()) if (entity.infected) { ai.restoreSpecialTimers(entity.infected, delta); if(entity.infected.until)entity.infected.until+=delta;if(entity.infected.cooldown)entity.infected.cooldown+=delta;if(entity.infected.recoverAt>=0){entity.infected.recoverAt+=delta;entity.infected.deadAt+=delta;}entity.infected.path.length=0;if (!entity.corpse) ai.active.push(entity); }
      this.world.player!.locomotion.crowd=[];
    } this.world.spatial.reset();
    for (const entity of this.world.entities.iterate()) this.world.spatial.set(entity.id, entity.transform.x, entity.transform.z);
    this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.player!.restoreVitals(this.world.tick); this.world.previousPlayer = { ...player.transform };
    const live: EntitySnapshot = player;
    if (live.weapons && this.world.combat) {
      const saved = live.weapons;
      const sequence = Math.max(checkpoint.combatSequence ?? 0, ...(entities.find(e => e.infected?.pursuit)?.infected?.megaRocketIds ?? []));
      this.world.combat.setLoadout(saved.LEFT.rack.map(s => s.id), saved.RIGHT.rack.map(s => s.id), sequence);
      Object.assign(this.world.combat.runner.loadout.state, saved);
      for (const side of [saved.LEFT, saved.RIGHT]) { if (side.swapUntil) side.swapUntil += delta; for (const slot of side.rack) for (const key of ['nextCharge', 'reloadUntil', 'readyAt'] as const) if (slot[key]) slot[key] = slot[key] + delta; }
      this.world.combat.projectiles.length = 0; this.world.combat.effects.zones.length = 0;
    }
    if (!live.weapons) this.world.combat?.clearLoadout();
    this.world.npcs?.restore(delta);
    this.l1?.restore(delta);
    restoreSeams(this.world, checkpoint.seams, !resume);
    this.l10?.cure.apply();
    for (const [actor, entityId] of Object.entries(this.state.actors)) if (this.deadBosses.has(actor)) for (const step of Object.values(this.state.steps)) if (step.status === 'active' && !step.kills.includes(entityId)) step.kills.push(entityId);
    if (this.state.tier !== null) this.world.setTier(this.state.tier);
    this.world.vehicles?.rebuild(false, delta);
    this.world.hazards?.debris.reset(); this.world.interactables?.rebuildBlockers(); this.world.barricades?.rebuild();
    for(const [gate,handle]of this.gateHandles)this.world.physics.world!.getCollider(handle).setEnabled(!this.state.gates[gate]);
    this.zones.forEach(zone => { zone.inside=this.state.volumes[zone.index];zone.entered=zone.exited=false; });
    this.l2?.restore(delta); this.l3?.restore(delta); this.l4?.restore(delta); this.l5?.restore(delta); this.l6?.restore(delta); this.l9?.rebuild();
    if (resume) {
      player.health.current = checkpoint.entities.find(e => e.id === 1)!.health.current;
      this.state.failure = checkpoint.state.failure;
    } else this.emit({ type: 'checkpoint.restored', id });
    this.world.solids.restore();
  }
  dispose(): void { this.stops.forEach(stop => stop()); for(const handle of this.gateHandles.values()) {const collider=this.world.physics.world?.getCollider(handle);if(collider)this.world.physics.world!.removeCollider(collider,true);} this.gateHandles.clear(); }
}
