import { observeAttackStarts } from './attackStarts';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { RunnerLevel } from '../../sim-runner/levels';
import type { NavGrid } from '../../../src/sim/ai/NavGrid';
import { phases, threatSteps, type Phase } from './phases';
import { WaveObserver } from './waves';
import { l3 } from '../../../src/data/l3';
import { infectedDef } from '../../../src/data/infected';

export const median = (values: readonly number[]): number | null => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null;
};
/** Pool reuse is a new spawn; a frozen corpse clone retains the preceding spawn's identity. */
export class SpawnIdentities {
  private readonly records = new WeakMap<EntitySnapshot, string>();
  private readonly ids = new Map<number, string>();
  private serial = 0;
  constructor(private readonly onBirth: () => void = () => {}) {}
  spawn(e: EntitySnapshot): string {
    const token = `${e.id}@${++this.serial}`;
    this.records.set(e, token); this.ids.set(e.id, token); this.onBirth(); return token;
  }
  identity(e: EntitySnapshot): string {
    const saved = this.records.get(e); if (saved) return saved;
    const corpse = e.corpse && this.ids.get(e.id);
    if (corpse) { this.records.set(e, corpse); return corpse; }
    return this.spawn(e);
  }
}
export interface Position { identity: string; id: number; x: number; z: number; playerX: number; playerZ: number }
export interface Snapshot { tick: number; alive: number; reachable: number; playerX: number; playerZ: number; positions: Position[] }
export interface BlockedWindow { streakStart: number | null; maxBlockedSeconds: number; blockedEvidence: Snapshot | null }
export function observeBlocked(window: BlockedWindow, snapshot: Snapshot): void {
  if (snapshot.alive > 0 && (snapshot.alive - snapshot.reachable) / snapshot.alive > .3) {
    window.streakStart ??= snapshot.tick;
    const seconds = (snapshot.tick - window.streakStart) / 60;
    if (seconds > window.maxBlockedSeconds) { window.maxBlockedSeconds = seconds; window.blockedEvidence = snapshot; }
  } else window.streakStart = null;
}
/** Walking excludes a parked formation and physical incapacitation, but keeps a lagger's zero-speed samples. */
export function isWalkingSample(speed: number, leaderSpeed: number, lagging: boolean, incapacitated: boolean): boolean {
  return leaderSpeed > .2 && !incapacitated && (speed > .1 || lagging);
}
interface Row extends BlockedWindow {
  legalPaths?: { firstTick: number; lastTick: number; samples: number; minimumPercent: number; worstTick: number; blockedIds: number[] };
  boundedPaths?: { samples: number; minimumPercent: number; worstTick: number; nearby: number; reachable: number; blockedIds: number[] };
  key: string; label: string; threat: boolean; start: number; ticks: number; lastActive: number;
  spawned: number; initial: number; seen: Set<string>; reachable: Set<string>; near: Set<string>;
  attacks: number; groupAttacks: number; firstAttack: number | null; firstGroupAttack: number | null; followers: Map<number, number[]>;
  last: Snapshot | null;
}
export interface PhaseReceipt {
  legalPaths?: Row['legalPaths'];
  boundedPaths?: Row['boundedPaths'];
  key: string; label: string; threat: boolean; startSeconds: number; seconds: number; spawned: number; initial: number;
  observed: number; reachableEver: number; within2_5m: number; attacks: number; attacksPerMinute: number; firstAttackSeconds: number | null;
  groupAttacks: number; groupAttacksPerMinute: number; firstGroupAttackSeconds: number | null;
  followerSpeeds: { id: number; samples: number; median: number }[]; followerMin: number | null; followerMedian: number | null;
  maxBlockedSeconds: number; blockedEvidence: Snapshot | null; last: Snapshot | null; flags: string[];
}
export interface FollowerWaitReceipt {
  escortTicks: number; stationaryFarTicks: number; upperBoundPercent: number | null;
  followers: { id: number; escortTicks: number; stationaryFarTicks: number }[];
}
/** Standing during combat is included, so this bounds actual babysitting from
 * above. Passing the bound proves the <=10% waiting-share requirement. */
export function followerWaitFlags(wait: Pick<FollowerWaitReceipt, 'escortTicks' | 'stationaryFarTicks'> | undefined): string[] {
  if (!wait || !wait.escortTicks) return ['FOLLOWER_WAIT_UNOBSERVED'];
  return wait.stationaryFarTicks > .1 * wait.escortTicks ? ['FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT'] : [];
}
// Five seconds of walking at the observer's 2 Hz cadence. Retain shorter raw
// samples, but do not compare a one-step arrival correction with a whole route.
export const followerSampleMinimum = 10;
export const followerPaceChecks: Partial<Record<RunnerLevel, { phase: string; ids: readonly number[] }>> = {
  L5: { phase: 'phase/search', ids: [28, 31] },
  L7: { phase: 'phase/encounters', ids: [60, 63] },
  L8: { phase: 'phase/breached', ids: [354, 359, 362, 363, 364, 365, 366] },
};
/** The moving native route must cover every reported follower, even when the
 * passive combat route keeps the courier still or loses the escort cohort. */
export function followerCoverageFlags(level: RunnerLevel, phases: readonly Pick<PhaseReceipt, 'key' | 'followerSpeeds' | 'followerMedian'>[]): string[] {
  const check = followerPaceChecks[level]; if (!check) return [];
  const row = phases.find(p => p.key === check.phase), flags: string[] = [];
  for (const id of check.ids) {
    const follower = row?.followerSpeeds.find(f => f.id === id);
    if (!follower || follower.samples < followerSampleMinimum || !row?.followerMedian) flags.push(`${check.phase}:FOLLOWER_PACE_UNOBSERVED:${id}`);
    else if (follower.median < .95 * row.followerMedian) flags.push(`${check.phase}:SLOW_FOLLOWER:${id}`);
  }
  return flags;
}
export function phaseFlags(p: Pick<PhaseReceipt, 'threat' | 'attacks' | 'maxBlockedSeconds' | 'followerSpeeds' | 'followerMedian'> & Partial<Pick<PhaseReceipt, 'groupAttacks'>>): string[] {
  const flags: string[] = [];
  if (p.threat && p.attacks + (p.groupAttacks ?? 0) === 0) flags.push('ZERO_ATTACKS');
  if (p.threat && p.maxBlockedSeconds > 20) flags.push('UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS');
  if (p.followerMedian !== null && p.followerMedian > 0) for (const follower of p.followerSpeeds) {
    if (follower.samples >= followerSampleMinimum && follower.median < .95 * p.followerMedian) flags.push(`SLOW_FOLLOWER:${follower.id}`);
  }
  return flags;
}

/** Read-only queries run on a separate native NavGrid, retaining the exact baked mask/walls/live blockers.
 * Calling path() on the live grid changes resumable A* work and can change the completion policy's outcome. */
export class PathProbe {
  private readonly grids = new WeakMap<NavGrid, Map<number, { revision: number; x: number; z: number; grid: NavGrid }>>();
  private readonly route: number[] = [];
  private lastLength = Infinity;
  distance(source: NavGrid, entity: EntitySnapshot, goal: { x: number; z: number }): number {
    return this.query(source, entity, goal, 1e9) ? this.lastLength : Infinity;
  }
  query(source: NavGrid, entity: EntitySnapshot, goal: { x: number; z: number }, maxStretch = Infinity, authoredPath: readonly { x: number; z: number }[] = []): boolean {
    this.lastLength = Infinity;
    const radius = entity.combat?.radius ?? .35;
    const start = authoredPath.at(-1) ?? entity.transform;
    let prefix = 0, previous = entity.transform;
    for (const point of authoredPath) { prefix += Math.hypot(point.x - previous.x, point.z - previous.z); previous = { ...previous, ...point }; }
    const limit = Number.isFinite(maxStretch) ? maxStretch * Math.hypot(goal.x - entity.transform.x, goal.z - entity.transform.z) + 1e-8 : Infinity;
    if (prefix > limit) return false;
    // A narrow runner grid can select a gap an Alpha's body cannot traverse.
    // Bounded physical paths use at least that actor's actual clearance.
    const clearance = Number.isFinite(maxStretch) ? Math.max(source.clearance, radius) : source.clearance;
    let variants = this.grids.get(source);
    if (!variants) this.grids.set(source, variants = new Map());
    let saved = variants.get(clearance);
    if (!saved || saved.revision !== source.revision || saved.x !== source.center.x || saved.z !== source.center.z) {
      saved = { revision: source.revision, x: source.center.x, z: source.center.z, grid: source.withClearance(clearance) };
      variants.set(clearance, saved);
    }
    const nav = saved.grid;
    if (nav.visible(start, goal, radius)) {
      this.lastLength = prefix + Math.hypot(goal.x - start.x, goal.z - start.z);
      return this.lastLength <= limit;
    }
    // L1's pursuit uses startCell, other archetypes use nearestCell with body visibility.
    const from = entity.infected?.l1 ? nav.startCell(start, radius * .6) : nav.nearestCell(start.x, start.z, radius);
    const to = nav.nearestCell(goal.x, goal.z, entity.infected?.l4ArmyApproach ? radius : undefined);
    if (from < 0 || to < 0) return false;
    // Exhaustive on the independent grid: an exhausted per-tick AI work budget is not proof of no path.
    if (!nav.path(from, to, this.route, Infinity)) return false;
    if (!Number.isFinite(maxStretch)) return true;
    // path() omits its starting cell. An actor offset inside that cell can
    // need its centre before rounding the first corner; skipping it can
    // reject a continuous body-clear route within the unchanged bound.
    this.route.unshift(from);
    // A* uses four-neighbour grid cells. Production steer() cuts visible
    // corners; summing every cell overstates the length of a valid walk.
    // Prove a continuous body-clear polyline with the same40-cell look-ahead.
    const position = { x: start.x, z: start.z }, point = { x: 0, z: 0 };
    let cursor = -1, length = prefix;
    while (cursor < this.route.length - 1) {
      let next = Math.min(this.route.length - 1, cursor + 40);
      for (; next > cursor; next--) {
        point.x = nav.x(this.route[next]);
        point.z = nav.z(this.route[next]);
        if (nav.visible(position, point, radius)) break;
      }
      if (next <= cursor) return false;
      length += Math.hypot(point.x - position.x, point.z - position.z);
      if (length > limit) return false;
      position.x = point.x; position.z = point.z; cursor = next;
    }
    // Keep the native nearest-cell goal convention: a melee attacker need
    // not occupy the courier's centre (which may have narrower clearance).
    this.lastLength = length + Math.hypot(goal.x - position.x, goal.z - position.z);
    return this.lastLength <= limit;
  }
}

export class ThreatObserver {
  private readonly followerWait = { escortTicks: 0, stationaryFarTicks: 0, followers: new Map<number, { escortTicks: number; stationaryFarTicks: number }>() };
  private readonly rows = new Map<string, Row>();
  private active: Row[] = [];
  private readonly births = new SpawnIdentities(() => { for (const row of this.active) row.spawned++; });
  private readonly paths = new PathProbe();
  private readonly barrierGrids = new WeakMap<NavGrid, { revision: number; x: number; z: number; grids: Map<number, NavGrid> }>();
  /** Prove approach + destructible-rail crossing + remaining ground walk.
   * Only the crossed, damageable rail is removed from an independent grid;
   * sheds, other rails, baked masks and all body-clearance tests remain. */
  private barrierDistance(source: NavGrid, entity: EntitySnapshot, goal: { x: number; z: number }, limit: number): number {
    const radius = entity.combat?.radius ?? .35, pad = Math.max(source.clearance, radius) + .1;
    if (pad > 1.5 || infectedDef(entity.archetype).damage <= 0) return Infinity;
    let cache = this.barrierGrids.get(source);
    if (!cache || cache.revision !== source.revision || cache.x !== source.center.x || cache.z !== source.center.z) {
      cache = { revision: source.revision, x: source.center.x, z: source.center.z, grids: new Map() };
      this.barrierGrids.set(source, cache);
    }
    const barriers = [...this.world.entities.iterate()].filter(e => e.barricade?.intact && e.health.current > 0
      && e.barricade.slot.groupId === 'l4-wall' && (entity.archetype === 'infected.alpha' || (e.barricade.slot.hordeShare ?? 1) > 0));
    barriers.sort((a, b) => Math.hypot(a.transform.x - entity.transform.x, a.transform.z - entity.transform.z)
      - Math.hypot(b.transform.x - entity.transform.x, b.transform.z - entity.transform.z));
    for (const barrier of barriers) {
      const slot = barrier.barricade!.slot, depth = slot.depth ?? .7;
      const wall = { x: barrier.transform.x, z: barrier.transform.z, y: slot.height / 2, halfY: slot.height / 2,
        halfX: Math.max(.15, Math.abs(slot.b.x - slot.a.x) / 2 + depth / 2),
        halfZ: Math.max(.15, Math.abs(slot.b.z - slot.a.z) / 2 + depth / 2) };
      const alongX = wall.halfZ > wall.halfX;
      const sign = Math.sign(alongX ? entity.transform.x - wall.x : entity.transform.z - wall.z) || 1;
      const parallel = alongX ? Math.max(Math.min(entity.transform.z, Math.max(slot.a.z, slot.b.z)), Math.min(slot.a.z, slot.b.z))
        : Math.max(Math.min(entity.transform.x, Math.max(slot.a.x, slot.b.x)), Math.min(slot.a.x, slot.b.x));
      // At a rail seam the projected crossing still touches the adjacent
      // intact segment. A real attacker can approach this segment's centre
      // before crossing it; prove that complete body-clear detour as well.
      for (const crossingAt of [parallel, alongX ? wall.z : wall.x]) {
        const near = alongX ? { x: wall.x + sign * (wall.halfX + pad), z: crossingAt } : { x: crossingAt, z: wall.z + sign * (wall.halfZ + pad) };
        const far = alongX ? { x: wall.x - sign * (wall.halfX + pad), z: crossingAt } : { x: crossingAt, z: wall.z - sign * (wall.halfZ + pad) };
        const crossing = Math.hypot(far.x - near.x, far.z - near.z);
        if (Math.hypot(near.x - entity.transform.x, near.z - entity.transform.z) + crossing + Math.hypot(far.x - goal.x, far.z - goal.z) > limit) continue;
        let grid = cache.grids.get(barrier.id);
        if (!grid) { grid = source.withClearance(source.clearance); grid.setBlocker(barrier.id, wall, false); cache.grids.set(barrier.id, grid); }
        if (!grid.visible(near, far, radius)) continue;
        const approach = this.paths.distance(source, entity, near);
        if (approach + crossing > limit) continue;
        const landed = { ...entity, transform: { ...entity.transform, ...far } };
        const distance = approach + crossing + this.paths.distance(source, landed, goal);
        if (distance <= limit) return distance;
      }
    }
    return Infinity;
  }
  private initialSquad: number | null = null;
  private armySquad: number | null = null;
  private lastTick = 0;
  private nextPathAt = 0;
  readonly waves: WaveObserver;
  readonly definitions: { id: string; text: string; type: string }[];
  readonly quality: string;
  constructor(readonly world: SimWorld, readonly level: RunnerLevel) {
    this.definitions = world.missions!.def.steps.map(s => ({ id: s.id, text: s.text, type: s.type }));
    this.quality = world.infected!.director.tier;
    this.waves = new WaveObserver(world, level, e => this.identity(e));
    world.events.on('l3.fallback', e => { if (e.type === 'l3.fallback') this.initialSquad = e.squad.length; });
    const update = world.update.bind(world), ai = world.infected!, spawn = ai.spawn.bind(ai);
    // Per-instance observation; no game data, health, inputs, movement or AI budgets are changed.
    ai.spawn = (...args) => {
      const id = spawn(...args);
      if (!args[3]) { const e = ai.active.find(e => e.id === id); if (e) this.born(e); }
      return id;
    };
    observeAttackStarts(world, (sourceId, targetId, tick) => {
      const target = world.entities.get(targetId);
      const groupTarget = !!target && (target.civilian?.survivor?.mode === 'follow' || target.escort?.state === 'follow' || target.civilian?.ally?.follow?.targetId === 1 || target.companion?.state === 'follow');
      if (targetId !== 1 && !groupTarget) return;
      const source = world.entities.get(sourceId), player = world.entities.get(1)!;
      for (const row of this.active) {
        if (targetId === 1) { row.attacks++; row.firstAttack ??= (tick - row.start) / 60; }
        else { row.groupAttacks++; row.firstGroupAttack ??= (tick - row.start) / 60; }
        if (source) {
          const token = this.identity(source); row.seen.add(token);
          if (Math.hypot(source.transform.x - player.transform.x, source.transform.z - player.transform.z) <= 2.5) row.near.add(token);
        }
      }
    });
    for (const e of ai.active) this.identity(e); // Composition-owned actors already exist before mission Begin.
    world.events.on('objective.started', event => {
      if (event.type !== 'objective.started') return;
      const def = world.missions!.def.steps.find(step => step.id === event.id);
      if (def) this.row({ key: `step/${def.id}`, label: `${def.id}: ${def.text}`, threat: !!threatSteps[level][def.id] });
    });
    world.update = () => {
      const before = world.tick;
      const playing = world.missions!.state.phase === 'playing';
      const descriptors = playing ? phases(world, level) : [];
      this.active = descriptors.map(phase => this.row(phase));
      for (const row of this.active) {
        if (row.lastActive < before - 1) row.streakStart = null;
        row.lastActive = before;
      }
      this.waves.beforeTick();
      const leaderBefore = world.entities.get(1)!.transform, leaderX = leaderBefore.x, leaderZ = leaderBefore.z;
      update();
      if (world.tick === before) return;
      for (const row of this.active) row.ticks += world.tick - before;
      const leaderAfter = world.entities.get(1)!.transform;
      this.observe(Math.hypot(leaderAfter.x - leaderX, leaderAfter.z - leaderZ) * 60 / (world.tick - before));
      this.waves.afterTick();
      const changed = phases(world, level).map(p => p.key).join('|') !== descriptors.map(p => p.key).join('|');
      if (world.tick >= this.nextPathAt || changed) { this.observePaths(); this.nextPathAt = world.tick + 120; }
      this.lastTick = world.tick;
    };
  }
  private row(phase: Phase): Row {
    let row = this.rows.get(phase.key);
    if (!row) {
      row = { ...phase, start: this.world.tick, ticks: 0, lastActive: this.world.tick, spawned: 0, initial: 0, seen: new Set(), reachable: new Set(), near: new Set(), attacks: 0, groupAttacks: 0, firstAttack: null, firstGroupAttack: null, followers: new Map(), streakStart: null, maxBlockedSeconds: 0, blockedEvidence: null, last: null };
      this.rows.set(phase.key, row);
    }
    row.threat ||= phase.threat;
    return row;
  }
  private born(e: EntitySnapshot): string {
    return this.births.spawn(e);
  }
  identity(e: EntitySnapshot): string { return this.births.identity(e); }
  private living(): EntitySnapshot[] {
    return this.world.infected!.active.filter(e => e.health.current > 0 && !e.corpse);
  }
  private observe(leaderSpeed: number): void {
    const w = this.world, player = w.entities.get(1)!;
    if (this.level === 'L3' && this.armySquad === null && player.transform.x >= l3.map.zoneX) this.armySquad = w.missions!.state.l3!.squad.length;
    for (const e of w.infected!.active) this.identity(e); // Includes hidden/deferred admissions and same-ID conversions.
    for (const e of this.living()) {
      const token = this.identity(e);
      for (const row of this.active) {
        if (!row.ticks || row.ticks === 1) row.initial++;
        row.seen.add(token);
        if (!e.hidden && !e.infected!.hidden && !e.pendingAdmission && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 2.5) row.near.add(token);
      }
    }
    let escorting = false, stationaryFar = false;
    // Use resolved displacement: requested velocity can remain nonzero while
    // the courier is blocked or a cinematic owns movement.
    for (const e of w.entities.iterate()) {
      if (e.id === 1 || e.health.current <= 0 || e.infected || e.hidden || e.corpse || e.passengerOf !== undefined) continue;
      const group = e.civilian?.survivor;
      const follower = group?.mode === 'follow' || e.escort?.state === 'follow' || e.civilian?.ally?.follow?.targetId === 1 || e.companion?.state === 'follow';
      if (!follower || !e.motion || w.storyLock) continue;
      if (e.civilian && (['grabbed', 'bitten', 'down', 'rising', 'flee'].includes(e.civilian.state)
        || e.civilian.survivor?.cover || e.civilian.story?.clip === 'npc-cower')) continue;
      const shelterResident = w.missions!.state.l6?.survivors.find(r => r.id === e.id);
      if (shelterResident && shelterResident.status !== 'following') continue;
      // The L8 escape-escort acceptance window begins at the breach; the
      // deliberate sanctuary minute is outside its pace/wait denominator.
      if (this.level === 'L8' && !w.missions!.l8?.state.breachedAt) continue;
      if (w.missions!.state.phase === 'playing') {
        escorting = true;
        const wait = this.followerWait.followers.get(e.id) ?? { escortTicks: 0, stationaryFarTicks: 0 };
        wait.escortTicks++;
        if (leaderSpeed <= .2 && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) > 10) {
          wait.stationaryFarTicks++; stationaryFar = true;
        }
        this.followerWait.followers.set(e.id, wait);
      }
      if (w.tick % 30) continue;
      const speed = e.motion.speed;
      if (leaderSpeed <= .2) continue; // Compare escort travel, not corrections around a resting leader.
      const lagging = leaderSpeed > .2 && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) > 6;
      if (!Number.isFinite(speed) || speed < 0) throw new Error(`Invalid follower speed for ${this.level}/${e.id}`);
      // Formation shuffling around a parked courier is not group walking.
      // Incapacitated followers cannot walk; their bites/losses remain recorded separately.
      const incapacitated = e.civilian?.state === 'grabbed' || e.civilian?.state === 'bitten' || (e.civilian?.knockedUntil ?? 0) > w.tick;
      if (!isWalkingSample(speed, leaderSpeed, lagging, incapacitated)) continue;
      for (const row of this.active) {
        const values = row.followers.get(e.id) ?? []; values.push(speed); row.followers.set(e.id, values);
      }
    }
    if (escorting) this.followerWait.escortTicks++;
    if (stationaryFar) this.followerWait.stationaryFarTicks++;
  }
  private observePaths(): void {
    const w = this.world, player = w.entities.get(1)!, alive = this.living(), positions: Position[] = [];
    // L4-07: the intact camp perimeter is intentional. Its scheduling clock
    // is not an opening; wait for a recorded physical breach or removed gate.
    const camp = w.missions!.state.l4;
    if (this.level === 'L4' && !Object.values(camp?.breaches ?? {}).some(b => b?.openAt)
      && !camp?.gateIds.some(id => w.entities.get(id)?.hidden)) return;
    const reachable = new Set<string>();
    let nearby = 0, boundedReachable = 0;
    const boundedBlockedIds: number[] = [];
    for (const e of alive) {
      const token = this.identity(e), native = w.infected!.navigation;
      // Annex/house actors own a real indoor/porch walk before ordinary nav
      // takes over. Include that whole remaining leg in the same 2.5x bound.
      const l1 = w.missions!.state.l1, authored: { x: number; z: number }[] = [];
      const house = [l1?.labExit, l1?.house].find(h => h?.walking?.some(q => q.id === e.id));
      const walk = house?.walking?.find(q => q.id === e.id);
      if (house && walk) {
        if (walk.leg < 0) {
          const inside = (e.transform.x - house.x) * house.nx + (e.transform.z - house.z) * house.nz;
          if (inside < 0) authored.push({ x: e.transform.x - house.nx * inside, z: e.transform.z - house.nz * inside });
          authored.push(walk.branchAt === undefined ? { x: house.sx, z: house.sz }
            : { x: house.x + house.nx * walk.branchAt, z: house.z + house.nz * walk.branchAt });
        }
        authored.push(...(walk.route ?? house.route).slice(Math.max(0, walk.leg)).map(([x, z]) => ({ x, z })));
      } else {
        const via = l1?.runs.find(q => q.id === e.id)?.via;
        if (via) authored.push(via);
      }
      const entrance = e.emerging && w.missions!.l8?.state.outlets.find(outlet => outlet.walking?.some(q => q.id === e.id));
      // Keep entrance actors in the denominator. Their native path is the
      // authored tunnel walk followed by ordinary navigation from its exit.
      const routed = entrance ? { ...e, transform: { ...e.transform, x: entrance.ox, z: entrance.oz } } : e;
      // An in-flight native vault already proves its legal barrier crossing.
      // Include the remaining crossing distance, then independently check the
      // full body-clear ground route from its actual landing, without moving it.
      const vault = e.infected?.vault;
      if (this.level === 'L4' && vault) authored.push(vault.to);
      const at = authored.at(-1) ?? routed.transform;
      const goal = e.infected?.pursuit ? player.transform : native.target(at, player.transform);
      const source = e.infected?.pursuit && w.megaPursuit ? w.megaPursuit.grid : native.grid(at);
      const disconnected = goal === at && Math.hypot(at.x - player.transform.x, at.z - player.transform.z) > 2.5;
      const legalBarrierPath = (stretch: number) => this.level === 'L4' && !e.pendingAdmission
        && Number.isFinite(this.barrierDistance(source, e, player.transform, stretch * Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)));
      if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 30) {
        nearby++;
        if ((!e.pendingAdmission || entrance || authored.length) && !disconnected && this.paths.query(source, routed, player.transform, 2.5, authored) || legalBarrierPath(2.5)) boundedReachable++;
        else boundedBlockedIds.push(e.id);
      }
      // L4's every-infected clause needs a continuous path at the actual body
      // radius too, rather than only A* connectivity on the narrower AI bake.
      const legalStretch = this.level === 'L4' ? 1e9 : Infinity;
      if ((!e.pendingAdmission || entrance || authored.length) && !disconnected && this.paths.query(source, routed, goal, legalStretch, authored) || legalBarrierPath(Infinity)) reachable.add(token);
      else positions.push({ identity: token, id: e.id, x: e.transform.x, z: e.transform.z, playerX: player.transform.x, playerZ: player.transform.z });
    }
    // Geometry is sampled after the sim tick. Charge it to the phases now
    // active, not a combat phase that ended when that tick closed a safe gate.
    for (const row of phases(w, this.level).map(phase => this.row(phase))) {
      if (this.level === 'L4' && alive.length) {
        const legal = row.legalPaths ??= { firstTick: w.tick, lastTick: w.tick, samples: 0, minimumPercent: 100, worstTick: w.tick, blockedIds: [] };
        legal.samples++; legal.lastTick = w.tick;
        const percent = reachable.size / alive.length * 100;
        if (percent <= legal.minimumPercent) Object.assign(legal, { minimumPercent: percent, worstTick: w.tick, blockedIds: positions.map(p => p.id) });
      }
      if (nearby) {
        const bounded = row.boundedPaths ??= { samples: 0, minimumPercent: 100, worstTick: w.tick, nearby, reachable: boundedReachable, blockedIds: [] };
        bounded.samples++;
        const percent = boundedReachable / nearby * 100;
        if (percent <= bounded.minimumPercent) Object.assign(bounded, { minimumPercent: percent, worstTick: w.tick, nearby, reachable: boundedReachable, blockedIds: boundedBlockedIds });
      }
      for (const token of reachable) row.reachable.add(token);
      const snapshot = { tick: w.tick, alive: alive.length, reachable: reachable.size, playerX: player.transform.x, playerZ: player.transform.z, positions };
      row.last = snapshot;
      observeBlocked(row, snapshot);
    }
  }
  finish(): { phases: PhaseReceipt[]; waves: ReturnType<WaveObserver['finish']>; ticks: number; followerWait: FollowerWaitReceipt; l3Squad?: { initial: number | null; army: number | null; losses: { id: number; cause: string; tick: number }[] } } {
    return {
      ticks: this.lastTick,
      ...(this.level === 'L3' ? { l3Squad: { initial: this.initialSquad, army: this.armySquad, losses: this.world.missions!.state.l3!.lost.map(q => ({ ...q })) } } : {}),
      followerWait: {
        escortTicks: this.followerWait.escortTicks, stationaryFarTicks: this.followerWait.stationaryFarTicks,
        upperBoundPercent: this.followerWait.escortTicks ? 100 * this.followerWait.stationaryFarTicks / this.followerWait.escortTicks : null,
        followers: [...this.followerWait.followers].map(([id, value]) => ({ id, ...value })),
      },
      phases: [...this.rows.values()].map(row => {
        const followerSpeeds = [...row.followers].map(([id, values]) => ({ id, samples: values.length, median: median(values)! }));
        const speeds = followerSpeeds.filter(f => f.samples >= followerSampleMinimum).map(f => f.median), followerMedian = median(speeds);
        const receipt: PhaseReceipt = { key: row.key, label: row.label, threat: row.threat, startSeconds: row.start / 60, seconds: row.ticks / 60,
          spawned: row.spawned, initial: row.initial, observed: row.seen.size, reachableEver: row.reachable.size, within2_5m: row.near.size,
          attacks: row.attacks, attacksPerMinute: row.ticks ? row.attacks * 3600 / row.ticks : 0, firstAttackSeconds: row.firstAttack,
          groupAttacks: row.groupAttacks, groupAttacksPerMinute: row.ticks ? row.groupAttacks * 3600 / row.ticks : 0, firstGroupAttackSeconds: row.firstGroupAttack,
          followerSpeeds, followerMin: speeds.length ? Math.min(...speeds) : null, followerMedian, boundedPaths: row.boundedPaths, legalPaths: row.legalPaths,
          maxBlockedSeconds: row.maxBlockedSeconds, blockedEvidence: row.blockedEvidence, last: row.last, flags: [] };
        receipt.flags = phaseFlags(receipt); return receipt;
      }), waves: this.waves.finish(),
    };
  }
}
