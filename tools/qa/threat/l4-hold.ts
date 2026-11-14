import { l4, l4BreachApproaches, l4Emergence } from '../../../src/data/l4';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** Native, unmodified hold: successful arrival groups and the living horde, not queued counts. */
export class L4HoldCensus {
  private cursor = 0;
  private readonly edges = new Set<number>();
  private readonly angles = new Map<number, number>();
  private firstBreach: number | null = null;
  private aliveAtBreach: number | null = null;
  private peakAlive = 0;
  private peakPlaza = 0;
  private minimumPlaza: number | null = null;
  private minimumRing: number | null = null;
  private aliveAtMinimumPlaza: number | null = null;
  private playerAtMinimumPlaza: { x: number; z: number } | null = null;
  private stranded: unknown[] = [];
  private samples = 0;
  private stationarySecond = -1;
  private stationary = new Map<number, { x: number; z: number }[]>();
  private stationaryOutsidePeak = 0;
  private stationaryOutsideAtPeak: unknown[] = [];
  private groupMax = 0;
  private firstAttack: number | null = null;
  constructor(private readonly world: SimWorld) {
    const update = world.update.bind(world);
    world.update = () => { update(); this.sample(); };
    world.events.on('infected.attack', e => {
      const s = world.missions!.state.l4;
      if (e.type === 'infected.attack' && e.targetId === 1 && s?.phase === 'war') this.firstAttack ??= (e.tick - s.warAt) / 60;
    });
  }
  private sample(): void {
    const w = this.world, s = w.missions!.state.l4!;
    if (!s?.warAt || s.phase !== 'war') return;
    const groups = new Map<number, number>();
    for (const id of s.emergedIds.slice(this.cursor)) {
      const origin = s.origin[id], source = l4Emergence[origin], breach = l4BreachApproaches[origin - l4Emergence.length];
      if (!source && !breach) continue;
      const at = source?.at ?? breach.at;
      this.edges.add(source?.edge ?? (breach.side === 'west' ? 0 : breach.side === 'north' ? 2 : 5));
      this.angles.set(origin, Math.atan2(at[1] - l4.map.centre.z, at[0] - l4.map.centre.x));
      groups.set(origin, (groups.get(origin) ?? 0) + 1);
    }
    this.cursor = s.emergedIds.length;
    this.groupMax = Math.max(this.groupMax, 0, ...groups.values());
    const alive = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission);
    const p = l4.map.plaza, plaza = alive.filter(e => e.transform.x > p.x0 && e.transform.x < p.x1 && e.transform.z > p.z0 && e.transform.z < p.z1).length;
    const r = l4.perimeter, ring = alive.filter(e => e.transform.x > r.x0 && e.transform.x < r.x1 && e.transform.z > r.z0 && e.transform.z < r.z1).length;
    this.peakAlive = Math.max(this.peakAlive, alive.length); this.peakPlaza = Math.max(this.peakPlaza, plaza);
    const opened = Object.values(s.breaches ?? {}).flatMap(b => b?.openAt ? [b.openAt] : []);
    if (this.firstBreach === null && opened.length) { this.firstBreach = Math.min(...opened); this.aliveAtBreach = alive.length; }
    if (w.tick >= s.warAt) {
      const second = Math.floor((w.tick - s.warAt) / 60);
      if (second !== this.stationarySecond) {
        this.stationarySecond = second;
        const liveIds = new Set<number>(); let outsideStill = 0; const still: unknown[] = [];
        for (const e of alive) {
          const inPlaza = e.transform.x > p.x0 && e.transform.x < p.x1 && e.transform.z > p.z0 && e.transform.z < p.z1;
          if (inPlaza) continue;
          liveIds.add(e.id);
          const window = this.stationary.get(e.id) ?? [];
          window.push({ x: e.transform.x, z: e.transform.z });
          if (window.length > 30) window.shift();
          this.stationary.set(e.id, window);
          const origin = window[0];
          if (window.length === 30 && window.every(at => Math.hypot(at.x - origin.x, at.z - origin.z) <= .5)) {
            outsideStill++;
            still.push({ id: e.id, x: e.transform.x, z: e.transform.z, samples: 30, state: e.infected?.state,
              scripted: e.infected?.scripted, approach: e.infected?.breachApproach });
          }
        }
        for (const id of this.stationary.keys()) if (!liveIds.has(id)) this.stationary.delete(id);
        if (outsideStill > this.stationaryOutsidePeak) {
          this.stationaryOutsidePeak = outsideStill;
          this.stationaryOutsideAtPeak = still;
        }
      }
    }
    if (w.tick >= s.warAt + 45 * 60) {
      if (this.minimumPlaza === null || plaza < this.minimumPlaza) {
        this.stranded = alive.filter(e => !(e.transform.x > p.x0 && e.transform.x < p.x1 && e.transform.z > p.z0 && e.transform.z < p.z1)).map(e => ({ x: e.transform.x, z: e.transform.z, state: e.infected?.state, scripted: e.infected?.scripted, approach: e.infected?.breachApproach }));
        this.minimumPlaza = plaza; this.minimumRing = ring; this.aliveAtMinimumPlaza = alive.length;
        const player = w.entities.get(1)!.transform; this.playerAtMinimumPlaza = { x: player.x, z: player.z };
      }
      this.samples++;
    }
  }
  finish() {
    const s = this.world.missions!.state.l4!, angles = [...this.angles.values()];
    const separated = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) >= Math.PI / 3;
    const threeDirections = angles.some((a, i) => angles.some((b, j) => j > i && separated(a, b) && angles.some((c, k) => k > j && separated(a, c) && separated(b, c))));
    return { tier: this.world.infected!.director.tier, holdComplete: !!s.lineBreakAt,
      firstBreachLevelSeconds: this.firstBreach === null ? null : this.firstBreach / 60,
      firstBreachAfterTurnSeconds: this.firstBreach === null ? null : (this.firstBreach - s.warAt) / 60,
      aliveAtFirstBreach: this.aliveAtBreach, peakAlive: this.peakAlive, peakPlazaAlive: this.peakPlaza,
      stranded: this.stranded,
      directorCountAtEnd: this.world.infected!.director.count,
      recoverableDownedAtEnd: this.world.infected!.active.filter(e => e.health.current <= 0 && (e.infected?.recoverAt ?? -1) >= 0).length,
      alarmPendingAtEnd: s.alarmPending, alarmCursorAtEnd: s.alarmCursor,
      aliveAtMinimumPlaza: this.aliveAtMinimumPlaza, minimumInsideRing: this.minimumRing, playerAtMinimumPlaza: this.playerAtMinimumPlaza,
      minPlazaAliveAfter45Seconds: this.minimumPlaza, samplesAfter45Seconds: this.samples,
      peakStationaryOutsidePlazaAfter30Seconds: this.stationaryOutsidePeak,
      stationaryOutsidePlazaAtPeak: this.stationaryOutsideAtPeak,
      arrivalEdges: [...this.edges].sort(), threeDirectionsAtLeast60Degrees: threeDirections, maxGroupAtOneSourcePerTick: this.groupMax,
      firstAttackSeconds: this.firstAttack, lineBreakAfterTurnSeconds: s.lineBreakAt ? (s.lineBreakAt - s.warAt) / 60 : null };
  }
}
