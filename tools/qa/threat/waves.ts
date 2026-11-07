import { observeAttackStarts } from './attackStarts';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { RunnerLevel } from '../../sim-runner/levels';
import { l4BreachApproaches, l4Emergence } from '../../../src/data/l4';
import { l4BreachSite } from '../../../src/data/l4Perimeter';

export interface WaveReceipt {
  key: string; source: string; startSeconds: number; observedSeconds: number; expected: number | null;
  spawned: number; firstAttackSeconds: number | null; members: string[]; flags: string[];
  visibleWithinTwoSeconds: number; spawnedWithinEighteenSeconds: number; scheduledStreamSeconds: number;
  outletCohorts?: { outlet: number; spawned: number }[];
}
interface Wave { key: string; source: string; start: number; expected: number | null; members: Map<string, number>; firstAttack: number | null; births: Map<string, number>; visible: Set<string>; scheduledUntil: number }
export function waveFlags(wave: Pick<WaveReceipt, 'firstAttackSeconds' | 'observedSeconds' | 'spawned'>): string[] {
  if (wave.spawned < 3) return ['WAVE_FEWER_THAN_THREE_COHORT_MEMBERS'];
  if (wave.firstAttackSeconds !== null) return wave.firstAttackSeconds > 20 ? ['WAVE_FIRST_ATTACK_OVER_20_SECONDS'] : [];
  return [wave.observedSeconds > 20 ? 'WAVE_NO_ATTACK_WITHIN_20_SECONDS' : 'WAVE_OBSERVATION_ENDED_BEFORE_ATTACK'];
}

/** L6-06 authors exactly two infected at each of six side entries; these are
 * route admissions, not three-member attack cohorts. */
export function l6EntryFlags(wave: Pick<WaveReceipt, 'expected' | 'spawned'>): string[] {
  return wave.expected === 2 && wave.spawned === 2 ? [] : ['L6_ENTRY_COUNT_MISMATCH'];
}

/** Starts come from native controller clocks/events, never the first successfully spawned/nearby identity.
 * Resident street populations in L5/L7/L9 are not announced waves. */
export class WaveObserver {
  private readonly waves = new Map<string, Wave>();
  private readonly assigned = new Set<string>();
  private readonly attacks = new Map<string, number>();
  private l6Cursor = 0;
  private l4Cursor = 0;
  private l8Cursor = 0;
  private readonly edgeQueues = new Map<number, { wave: Wave; remaining: number }[]>();
  constructor(private readonly world: SimWorld, private readonly level: RunnerLevel, private readonly identity: (e: EntitySnapshot) => string, private readonly enabled = true) {
    if (!enabled) return;
    observeAttackStarts(world, (sourceId, targetId, tick) => {
      if (targetId !== 1) return;
      const e = world.entities.get(sourceId);
      if (e) this.attacks.set(identity(e), tick);
    });
    world.events.on('l2.doorsOpen', e => { if (e.type === 'l2.doorsOpen') this.wave('market-ambush', e.tick, 'l2.doorsOpen'); });
    for (const type of ['l6.breach1', 'l6.breach2'] as const) world.events.on(type, e => {
      if (e.type === type) this.wave(type, e.tick, type, type === 'l6.breach1' ? 8 : 10);
    });
    world.events.on('l4.wave', event => {
      if (event.type !== 'l4.wave') return;
      const s = world.missions!.state.l4!, key = `${s.phase}-${event.wave}@${event.tick}`;
      const wave = this.wave(key, event.tick, 'l4.wave', event.count);
      // Native pending counters merge successive waves. Attribute actual admissions FIFO per street edge.
      for (const edge of event.edges) {
        const queue = this.edgeQueues.get(edge) ?? [], quota = Math.ceil(event.count / event.edges.length);
        const existing = queue.reduce((n, q) => n + q.remaining, 0), opening = Math.max(0, s.pend[edge] - existing - quota);
        if (opening) queue.push({ wave: this.wave('opening-alarm', s.turnAt, 'L4 opening pending street cohorts'), remaining: opening });
        queue.push({ wave, remaining: quota }); this.edgeQueues.set(edge, queue);
      }
    });
  }
  private wave(key: string, start: number, source: string, expected: number | null = null): Wave {
    let wave = this.waves.get(key);
    if (!wave) { wave = { key, start, source, expected, members: new Map(), firstAttack: null, births: new Map(), visible: new Set(), scheduledUntil: start }; this.waves.set(key, wave); }
    else if (wave.expected === null && expected !== null) wave.expected = expected;
    return wave;
  }
  private add(wave: Wave, id: number, ledger: string): boolean {
    const key = `${wave.key}/${ledger}`;
    if (this.assigned.has(key) || id <= 0) return false;
    const e = this.world.entities.get(id);
    if (!e?.infected) return false;
    const token = this.identity(e);
    wave.members.set(token, id); wave.births.set(token, this.world.tick); this.assigned.add(key); return true;
  }
  beforeTick(): void {
    if (!this.enabled) return;
    if (this.world.missions!.state.phase !== 'playing') return;
    const zoo = this.world.missions!.l8?.state;
    if (zoo?.breachedAt && this.world.tick + 1 >= zoo.nextWave) this.wave(`tunnel-reinforcement@${zoo.nextWave}`, zoo.nextWave, 'L8 nextWave clock', zoo.outlets.length * 4);
  }
  afterTick(): void {
    if (!this.enabled) return;
    const w = this.world, state = w.missions!.state, t = w.tick;
    const rescue = state.l2;
    if (rescue?.doorsOpenAt) {
      const wave = this.wave('market-ambush', rescue.doorsOpenAt, 'l2.doorsOpen', rescue.ambush.length);
      for (const [i, q] of rescue.ambush.entries()) this.add(wave, q.id, String(i));
    }
    const station = state.l3;
    if (station) for (const group of new Set(station.waves.map(q => q.wave))) {
      const entries = station.waves.filter(q => q.wave === group), start = Math.min(...entries.map(q => q.at));
      if (t < start || station.phase !== 'attack' && !entries.some(q => q.id)) continue;
      const wave = this.wave(`station-${group}`, start, 'L3 scheduled wave.at (before admission)', entries.length);
      wave.scheduledUntil = Math.max(...entries.map(q => q.at));
      for (const [i, q] of entries.entries()) this.add(wave, q.id, String(i));
    }
    const war = state.l4;
    if (war) {
      // announcedAt warns about an Alpha's approach, not a released horde.
      // The breach radio and its cohort start when that Alpha opens the wall.
      for (const side of ['west', 'north', 'south'] as const) {
        const breach = war.breaches?.[side]; if (!breach?.openAt) continue;
        const wave = this.wave(`breach-${side}`, breach.openAt, 'L4 breach.openAt');
        // The physical opening releases the existing street pile too. Observe
        // the native funnel's outside waypoint; don't invent a spawn quota.
        const sites = (['west', 'north', 'south'] as const).filter(s => war.breaches?.[s]?.openAt).map(s => ({ side: s, centre: l4BreachSite(s).centre }));
        for (const e of w.infected!.active) {
          const b = e.infected!;
          if (e.health.current <= 0 || e.hidden || b.breachApproach !== 'outside' || !b.scripted) continue;
          const routed = sites.slice().sort((a, q) => Math.hypot(b.scripted!.x - a.centre.x, b.scripted!.z - a.centre.z) - Math.hypot(b.scripted!.x - q.centre.x, b.scripted!.z - q.centre.z))[0];
          if (routed?.side === side) this.add(wave, e.id, `routed/${this.identity(e)}`);
        }
      }
      for (const id of war.emergedIds.slice(this.l4Cursor)) {
        const origin = war.origin[id], edge = l4Emergence[origin]?.edge;
        const queue = this.edgeQueues.get(edge);
        while (queue?.length && queue[0].remaining <= 0) queue.shift();
        if (queue?.length) { this.add(queue[0].wave, id, `${this.l4Cursor}/${id}/${t}`); queue[0].remaining--; }
        else if (origin >= l4Emergence.length) {
          const side = l4BreachApproaches[origin - l4Emergence.length]?.side;
          const wave = side && this.waves.get(`breach-${side}`); if (wave) this.add(wave, id, `${this.l4Cursor}/${id}/${t}`);
        }
        this.l4Cursor++;
      }
    }
    const subway = state.l6;
    if (subway) {
      for (const entry of subway.entries ?? []) if (entry.warnedAt) this.wave(`entry-${entry.door}@${entry.warnedAt}`, entry.warnedAt, 'L6 maintenance entry.warnedAt', entry.remaining);
      for (const q of subway.spawnLog.slice(this.l6Cursor)) {
        let wave: Wave | undefined;
        if (q.wave <= 2) wave = this.waves.get(`l6.breach${q.wave}`);
        if (q.wave === 4) {
          const entry = subway.entries?.find(entry => entry.door === q.door && entry.warnedAt);
          if (entry) wave = this.waves.get(`entry-${q.door}@${entry.warnedAt}`);
        }
        if (wave) this.add(wave, q.id, `${this.l6Cursor}/${q.tick}`);
        this.l6Cursor++;
      }
    }
    const zoo = w.missions!.l8?.state;
    if (zoo?.breachedAt) {
      this.wave('tunnel-breach', zoo.breachedAt, 'L8 breachedAt/story.say', zoo.outlets.length * (w.infected!.director.tier === 'low' ? 3 : 6));
      for (const q of zoo.arrivals.slice(this.l8Cursor)) {
        const wave = q.tick === zoo.breachedAt ? this.waves.get('tunnel-breach')! : this.waves.get(`tunnel-reinforcement@${q.tick}`)
          ?? this.wave(`tunnel-reinforcement@${q.tick}`, q.tick, 'L8 reinforcement clock', zoo.outlets.length * 4);
        this.add(wave, q.id, String(this.l8Cursor++));
      }
    }
    if (this.level === 'L10' && state.states['charge-active']) {
      const wave = this.wave('dispersal-assault', t, 'L10 charge-active (not first spawn)');
      for (const [key, id] of Object.entries(w.l10Encounters!.state.spawned)) if (key.startsWith('dispersal-assault:')) this.add(wave, id, key);
    }
    for (const wave of this.waves.values()) for (const [token, id] of wave.members) {
      const contact = this.attacks.get(token);
      if (wave.firstAttack === null && contact !== undefined && contact >= wave.start) wave.firstAttack = (contact - wave.start) / 60;
      const e = w.entities.get(id);
      if (t <= wave.start + 120 && e?.infected && this.identity(e) === token && e.health.current > 0 && !e.hidden && !e.pendingAdmission && w.infected!.director.inFrame(e.transform)) wave.visible.add(token);
    }
  }
  finish(): WaveReceipt[] {
    return [...this.waves.values()].map(wave => {
      const acceptanceWave = wave.key === 'market-ambush' || wave.key.startsWith('station-') || wave.key.startsWith('breach-') || wave.key.startsWith('l6.breach') || wave.key.startsWith('tunnel-breach') || wave.key === 'dispersal-assault' || wave.key.startsWith('war-0@');
      const zoo = this.world.missions!.l8?.state;
      const outletCohorts = wave.key === 'tunnel-breach' && zoo ? zoo.outlets.map((_, outlet) => ({
        outlet, spawned: zoo.arrivals.filter(q => q.tick === zoo.breachedAt && q.outlet === outlet).length,
      })) : undefined;
      const receipt: WaveReceipt = { key: wave.key, source: wave.source, startSeconds: wave.start / 60, observedSeconds: Math.max(0, this.world.tick - wave.start) / 60,
        expected: wave.expected, spawned: wave.members.size, firstAttackSeconds: wave.firstAttack, members: [...wave.members.keys()], flags: [], outletCohorts,
        scheduledStreamSeconds: (wave.scheduledUntil - wave.start) / 60, visibleWithinTwoSeconds: wave.visible.size, spawnedWithinEighteenSeconds: [...wave.births.values()].filter(tick => tick <= wave.start + 18 * 60).length };
      const breachFlags: string[] = [];
      if (wave.key === 'tunnel-breach' && outletCohorts) {
        const minimum = this.world.infected!.director.tier === 'low' ? 3 : 6;
        if (outletCohorts.filter(q => q.spawned >= minimum).length < 3) breachFlags.push(`BREACH_FEWER_THAN_THREE_OUTLETS_WITH_${minimum}`);
        const outlets = zoo!.outlets;
        for (let i = 0; i < outlets.length; i++) for (let j = i + 1; j < outlets.length; j++)
          if (Math.hypot(outlets[i].x - outlets[j].x, outlets[i].z - outlets[j].z) < 20) breachFlags.push('BREACH_OUTLETS_LESS_THAN_20M_APART');
      }
      receipt.flags = wave.key.startsWith('entry-') ? l6EntryFlags(receipt) : acceptanceWave ? [...waveFlags(receipt), ...breachFlags] : []; return receipt;
    });
  }
}
