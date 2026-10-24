import { SpatialHash } from '../../sim/spatial/SpatialHash';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';

export const corpsePoses = ['death-back', 'death-side', 'death-crumple'] as const;
export const corpsePose = (id: number) => corpsePoses[Math.abs(Math.imul(id ^ (id >>> 16), 0x45d9f3b)) % corpsePoses.length];
export const corpseYaw = (id: number) => (id * 2.399963229728653) % (Math.PI * 2);
interface RestingPose {
  x: number; z: number; sourceX: number; sourceZ: number; deadAt: number;
  ax: number; az: number; bx: number; bz: number; radius: number; body: EntitySnapshot; fit: boolean;
}
const layouts = new WeakMap<SimWorld, CorpseLayout>();
/** Both crowd renderers share one ground layout; bodies never become movement colliders. */
export function corpseLayout(world: SimWorld): CorpseLayout {
  let layout = layouts.get(world);
  if (!layout) { layout = new CorpseLayout(world); layouts.set(world, layout); }
  return layout;
}
const pointDistance = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
};
function segmentDistance(ax: number, az: number, bx: number, bz: number, p: RestingPose): number {
  const cross = (x: number, z: number, u: number, v: number) => x * v - z * u;
  const d = cross(bx - ax, bz - az, p.bx - p.ax, p.bz - p.az);
  if (Math.abs(d) > 1e-8) {
    const t = cross(p.ax - ax, p.az - az, p.bx - p.ax, p.bz - p.az) / d;
    const u = cross(p.ax - ax, p.az - az, bx - ax, bz - az) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(pointDistance(ax, az, p.ax, p.az, p.bx, p.bz), pointDistance(bx, bz, p.ax, p.az, p.bx, p.bz), pointDistance(p.ax, p.az, ax, az, bx, bz), pointDistance(p.bx, p.bz, ax, az, bx, bz));
}
export class CorpseLayout {
  readonly bodies = new Map<number, RestingPose>();
  private readonly spatial = new SpatialHash();
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 5 };
  private revision = -1;
  private navRevision = -1;
  private regionMask?: Uint8Array;
  private regions = new Int32Array();
  constructor(private readonly world: SimWorld) {}
  private connected(from: number, to: number): boolean {
    const nav = this.world.infected!.nav;
    if (this.navRevision !== nav.revision || this.regionMask !== nav.blocked) {
      const regions = this.regions = new Int32Array(nav.blocked.length), queue = new Int32Array(regions.length);
      let region = 0;
      for (let cell = 0; cell < regions.length; cell++) {
        if (nav.blocked[cell] || regions[cell]) continue;
        let head = 0, tail = 1; queue[0] = cell; regions[cell] = ++region;
        while (head < tail) {
          const at = queue[head++], x = at % nav.width;
          for (const next of [x ? at - 1 : -1, x + 1 < nav.width ? at + 1 : -1, at - nav.width, at + nav.width]) {
            if (next < 0 || next >= regions.length || nav.blocked[next] || regions[next]) continue;
            regions[next] = region; queue[tail++] = next;
          }
        }
      }
      this.navRevision = nav.revision;
      this.regionMask = nav.blocked;
    }
    return from >= 0 && to >= 0 && this.regions[from] !== 0 && this.regions[from] === this.regions[to];
  }
  audit() {
    const bodies = [...this.bodies.values()], player = this.world.entities.get(1)?.transform;
    let overlaps = 0;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (segmentDistance(a.ax, a.az, a.bx, a.bz, b) < a.radius + b.radius - .001) overlaps++;
    }
    return { count: bodies.length, overlaps, maxDisplacementM: Math.max(0, ...bodies.map(p => Math.hypot(p.x - p.sourceX, p.z - p.sourceZ))), courierClear: !player || bodies.every(p => pointDistance(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= 1.099),
      unplaced: bodies.filter(p => !p.fit).map(p => ({ id: p.body.id, x: p.x, z: p.z, y: p.body.transform.y, lane: p.body.doorLane, clear: this.world.infected?.nav.clear(p.x, p.z, p.radius), support: this.world.districts?.supportBelow(p.x, p.z, p.body.transform.y - .7) })).slice(0, 8) };
  }
  place(e: EntitySnapshot, deadAt = e.infected?.deadAt ?? 0, prone?: number): RestingPose | EntitySnapshot['transform'] {
    if (this.revision !== this.world.entities.revision) {
      for (const [id, pose] of this.bodies) if (this.world.entities.get(id) !== pose.body || pose.body.health.current > 0 || pose.body.hidden) { this.bodies.delete(id); this.spatial.delete(id); }
      this.revision = this.world.entities.revision;
    }
    const player = this.world.entities.get(1)?.transform, previous = this.bodies.get(e.id);
    const safePlayer = (p: RestingPose) => !player || pointDistance(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= 1.1;
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z && safePlayer(previous)) return previous;
    const feet = e.transform.y - .7, support = this.world.districts;
    const lane = e.doorLane;
    const from = lane ? { x: lane.x + lane.ox * lane.end, z: lane.z + lane.oz * lane.end } : e.transform;
    const nav = this.world.infected!.nav;
    let sourceCell: number | undefined;
    // A thrown body follows its flight until it returns to its ground support.
    if (e.corpseThrown && feet > (support?.supportBelow(e.transform.x, e.transform.z, feet) ?? 0) + .15) return e.transform;
    const yaw = e.transform.yaw + corpseYaw(e.id), direction = prone === undefined ? 1 : -1;
    const dx = -Math.cos(yaw) * direction, dz = Math.sin(yaw) * direction, length = prone ?? 1.25, radius = prone === undefined ? .6 : .8;
    const pose: RestingPose = { x: e.transform.x, z: e.transform.z, sourceX: e.transform.x, sourceZ: e.transform.z, deadAt, ax: 0, az: 0, bx: 0, bz: 0, radius, body: e, fit: false };
    const clear = (x: number, z: number) => {
      pose.x = x; pose.z = z; pose.ax = x - dx * .15; pose.az = z - dz * .15; pose.bx = x + dx * length; pose.bz = z + dz * length;
      if (!safePlayer(pose)) return false;
      const nav = this.world.infected?.nav;
      for (const t of [0, .5, 1]) {
        const px = pose.ax + (pose.bx - pose.ax) * t, pz = pose.az + (pose.bz - pose.az) * t;
        if (!nav?.clear(px, pz, radius) || support && Math.abs(support.supportBelow(px, pz, feet) - feet) > .3) return false;
      }
      this.query.x = x; this.query.z = z; this.spatial.query(this.query, this.neighbors, false);
      for (const id of this.neighbors) { const other = this.bodies.get(id)!; if (id !== e.id && segmentDistance(pose.ax, pose.az, pose.bx, pose.bz, other) < radius + other.radius) return false; }
      return true;
    };
    let found = clear(e.transform.x, e.transform.z);
    if (!found) search: for (let ring = 1; ring <= 80; ring++) {
      const distance = ring * .3, samples = Math.max(12, ring * 6);
      for (let i = 0; i < samples; i++) {
        const angle = yaw + i * Math.PI * 2 / samples, x = e.transform.x + Math.cos(angle) * distance, z = e.transform.z + Math.sin(angle) * distance;
        if (!clear(x, z)) continue;
        // Crowded bodies can settle around a table or crate corner. A straight
        // visibility ray incorrectly trapped them in the same narrow aisle.
        sourceCell ??= nav.nearestCell?.(from.x, from.z);
        if (nav.visible(from, { x, z }, .35) || sourceCell !== undefined && this.connected(sourceCell, nav.cell(x, z))) { found = true; break search; }
      }
    }
    // A fully enclosed support can have no free footprint. Keep the body on
    // that support rather than passing it through a wall or removing it.
    if (!found) { pose.x = e.transform.x; pose.z = e.transform.z; pose.ax = pose.x - dx * .15; pose.az = pose.z - dz * .15; pose.bx = pose.x + dx * length; pose.bz = pose.z + dz * length; }
    pose.fit = found; this.bodies.set(e.id, pose); this.spatial.set(e.id, pose.x, pose.z); return pose;
  }
}
