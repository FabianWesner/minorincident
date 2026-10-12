import type { SimWorld } from '../sim/world/SimWorld';

export interface Stall { fromTick: number; toTick: number; seconds: number; x: number; z: number }
export interface ReplaySummary {
  level: string; seed: number; build: string | null; samples: number; ticks: number; endPhase: string | null;
  deaths: { tick: number; x: number; z: number }[];
  objectives: { id: string; startedTick: number | null; completedTick: number; seconds: number | null }[];
  checkpoints: { id: string; tick: number }[]; pickups: { id: string; tick: number }[];
  completed: { tick: number; time: number; deaths: number; kills: number } | null;
  distance: number; stalls: Stall[]; stateHash: string | null;
}

/** Collects the player path (one point per sim tick) and the mission events of a run; used by recording tests and the replay driver. */
export class RunProbe {
  /** x, z of the player at the end of every sim tick: path[2 * (tick - 1)]. */
  path: number[] = [];
  deaths: ReplaySummary['deaths'] = [];
  started = new Map<string, number>(); objectives: ReplaySummary['objectives'] = [];
  checkpoints: ReplaySummary['checkpoints'] = []; pickups: ReplaySummary['pickups'] = [];
  completed: ReplaySummary['completed'] = null;
  private stops: (() => void)[] = [];
  attach(world: SimWorld): void {
    this.detach();
    const events = world.events;
    this.stops.push(events.on('sim.tick', () => { const t = world.entities.get(1)?.transform; this.path.push(t?.x ?? NaN, t?.z ?? NaN); }, 6));
    this.stops.push(events.on('player.died', e => { const t = world.entities.get(1)?.transform; this.deaths.push({ tick: e.tick, x: t?.x ?? NaN, z: t?.z ?? NaN }); }));
    this.stops.push(events.on('objective.started', e => { if (e.type === 'objective.started') this.started.set(e.id, e.tick); }));
    this.stops.push(events.on('objective.completed', e => { if (e.type === 'objective.completed') { const from = this.started.get(e.id) ?? null; this.objectives.push({ id: e.id, startedTick: from, completedTick: e.tick, seconds: from === null ? null : Math.round((e.tick - from) / 60 * 10) / 10 }); } }));
    this.stops.push(events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set') this.checkpoints.push({ id: e.id, tick: e.tick }); }));
    this.stops.push(events.on('pickup.collected', e => { if ('actionId' in e) this.pickups.push({ id: e.actionId, tick: e.tick }); }));
    this.stops.push(events.on('level.completed', e => { if (e.type === 'level.completed') this.completed = { tick: e.tick, time: e.result.time, deaths: e.result.deaths, kills: e.result.kills }; }));
  }
  detach(): void { for (const stop of this.stops) stop(); this.stops = []; }
  get ticks(): number { return this.path.length / 2; }
  distance(): number { let d = 0; for (let i = 2; i < this.path.length; i += 2) { const step = Math.hypot(this.path[i] - this.path[i - 2], this.path[i + 1] - this.path[i - 1]); if (step < 5) d += step; } return Math.round(d * 10) / 10; }
  /** Stretches where the player stayed within `radius` metres for at least `seconds` (waiting for something, stuck, or lost). */
  stalls(seconds = 12, radius = 1.5): Stall[] {
    const out: Stall[] = [], n = this.ticks, window = Math.round(seconds * 60);
    let from = 0;
    for (let i = 1; i <= n; i++) {
      const cx = this.path[2 * from], cz = this.path[2 * from + 1];
      const moved = i === n ? Infinity : Math.hypot(this.path[2 * i] - cx, this.path[2 * i + 1] - cz);
      if (moved > radius) {
        if (i - 1 - from >= window) out.push({ fromTick: from + 1, toTick: i, seconds: Math.round((i - 1 - from) / 6) / 10, x: Math.round(cx * 10) / 10, z: Math.round(cz * 10) / 10 });
        from = i;
      }
    }
    return out.sort((a, b) => b.seconds - a.seconds).slice(0, 12);
  }
}
