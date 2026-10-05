import { NavGrid } from './NavGrid';
import type { ScenarioDefinition } from '../../levels/loader';
export interface NavDistrict { id: string; center: { x: number; z: number }; width: number; depth: number; links: { to: string; x: number; z: number }[] }
/** Small coarse district graph followed by each district's collider-baked 0.5 m grid. */
export class DistrictNavigation {
  readonly districts: { definition: NavDistrict; grid: NavGrid }[];
  private readonly parents: Int32Array;
  private readonly queue: Int32Array;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(definition: ScenarioDefinition, readonly fallback: NavGrid) {
    this.districts = (definition.navigation ?? []).map((district) => ({ definition: district, grid: new NavGrid({ width: district.width + 4, depth: district.depth + 4 }, definition.walls ?? [], 0.65, district.center) }));
    this.parents = new Int32Array(this.districts.length); this.queue = new Int32Array(this.districts.length);
    for (const district of this.districts) for (const link of district.definition.links) if (!this.districts.some((target) => target.definition.id === link.to)) throw new Error(`Unknown navigation district ${link.to}`);
  }
  district(position: { x: number; z: number }): number {
    if (!this.districts.length) return -1;
    return this.districts.findIndex(({ definition: d }) => Math.abs(position.x - d.center.x) <= d.width / 2 && Math.abs(position.z - d.center.z) <= d.depth / 2);
  }
  grid(position: { x: number; z: number }): NavGrid { return this.districts[this.district(position)]?.grid ?? this.fallback; }
  target(position: { x: number; z: number }, goal: { x: number; z: number }): { x: number; z: number } {
    const from = this.district(position), to = this.district(goal);
    if (from < 0 || to < 0 || from === to) return goal;
    this.parents.fill(-1); this.parents[from] = from; this.queue[0] = from;
    let head = 0, tail = 1;
    while (head < tail && this.parents[to] < 0) {
      const node = this.queue[head++];
      for (const link of this.districts[node].definition.links) {
        const next = this.districts.findIndex((d) => d.definition.id === link.to);
        if (this.parents[next] < 0) { this.parents[next] = node; this.queue[tail++] = next; }
      }
    }
    if (this.parents[to] < 0) return position;
    let next = to; while (this.parents[next] !== from) next = this.parents[next];
    const link = this.districts[from].definition.links.find((link) => link.to === this.districts[next].definition.id)!;
    this.waypoint.x = link.x; this.waypoint.z = link.z; return this.waypoint;
  }
  flow(goal: { x: number; z: number }, budget: number): void {
    if (!this.districts.length) { this.fallback.flow(goal.x, goal.z, budget); return; }
    const share = Math.max(1, Math.floor(budget / this.districts.length));
    for (const { definition, grid } of this.districts) { const target = this.target(definition.center, goal); grid.flow(target.x, target.z, share); }
  }
}
