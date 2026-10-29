import { SpatialHash } from '../../sim/spatial/SpatialHash';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';

export const corpsePoses = ['death-back', 'death-side', 'death-crumple'] as const;
export const corpsePose = (id: number) => corpsePoses[Math.abs(Math.imul(id ^ (id >>> 16), 0x45d9f3b)) % corpsePoses.length];
export const corpseYaw = (id: number) => (id * 2.399963229728653) % (Math.PI * 2);
interface RestingPose {
  x: number; y: number; z: number; yaw: number; sourceX: number; sourceZ: number; deadAt: number;
  ax: number; az: number; bx: number; bz: number; radius: number; height: number; body: EntitySnapshot;
}
const layouts = new WeakMap<SimWorld, CorpseLayout>();
/** Native and pedestrian-look bodies share one layout, without movement colliders. */
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
const yawDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export class CorpseLayout {
  readonly bodies = new Map<number, RestingPose>();
  private readonly spatial = new SpatialHash();
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 5 };
  private revision = -1;
  private epilogue = false;
  constructor(private readonly world: SimWorld) {}
  audit() {
    const bodies = [...this.bodies.values()], player = this.world.entities.get(1)?.transform;
    let sunkPairs = 0, heapPairs = 0, repeatedPairs = 0;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (segmentDistance(a.ax, a.az, a.bx, a.bz, b) >= a.radius + b.radius - .001) continue;
      heapPairs++;
      const lower = a.y <= b.y ? a : b, upper = lower === a ? b : a;
      if (upper.y < lower.y + lower.height - .001) sunkPairs++;
      if (corpsePose(a.body.id) === corpsePose(b.body.id) && yawDistance(a.yaw, b.yaw) < .2) repeatedPairs++;
    }
    return { count: bodies.length, sunkPairs, heapPairs, repeatedPairs,
      maxDisplacementM: Math.max(0, ...bodies.map(p => Math.hypot(p.x - p.sourceX, p.z - p.sourceZ))),
      maxLiftM: Math.max(0, ...bodies.map(p => p.y - (p.body.transform.y - .7))),
      courierClear: !player || bodies.every(p => pointDistance(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= .949) };
  }
  place(e: EntitySnapshot, deadAt = e.infected?.deadAt ?? 0, prone?: number): RestingPose | EntitySnapshot['transform'] {
    const epilogue = this.world.missions?.def.id === 'L10' && !!this.world.missions.state.cureFront;
    if (epilogue !== this.epilogue) {
      this.epilogue = epilogue; this.bodies.clear(); this.spatial.reset();
    }
    if (this.revision !== this.world.entities.revision) {
      for (const [id, pose] of this.bodies) if (this.world.entities.get(id) !== pose.body || pose.body.health.current > 0 || pose.body.hidden) { this.bodies.delete(id); this.spatial.delete(id); }
      this.revision = this.world.entities.revision;
    }
    const player = this.world.entities.get(1)?.transform, previous = this.bodies.get(e.id);
    const safePlayer = (p: RestingPose) => !player || pointDistance(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= .95;
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z && safePlayer(previous)) return previous;
    const feet = e.transform.y - .7, support = this.world.districts, nav = this.world.infected?.nav;
    if (e.corpseThrown && feet > (support?.supportBelow(e.transform.x, e.transform.z, feet) ?? 0) + .15) return { ...e.transform, y: feet };
    const initialYaw = e.transform.yaw + corpseYaw(e.id), direction = prone === undefined ? 1 : -1;
    const length = prone ?? 1.25, radius = prone === undefined ? .6 : .8, height = prone === undefined ? .22 : .32;
    const pose: RestingPose = { x: e.transform.x, y: feet, z: e.transform.z, yaw: initialYaw, sourceX: e.transform.x, sourceZ: e.transform.z, deadAt,
      ax: 0, az: 0, bx: 0, bz: 0, radius, height, body: e };
    const evaluate = (x: number, z: number, yaw: number, supported = true): RestingPose | undefined => {
      const dx = -Math.cos(yaw) * direction, dz = Math.sin(yaw) * direction;
      Object.assign(pose, { x, z, yaw, ax: x - dx * .15, az: z - dz * .15, bx: x + dx * length, bz: z + dz * length });
      if (!safePlayer(pose)) return;
      pose.y = support?.supportBelow(x, z, feet) ?? feet;
      if (supported) for (const t of [0, .5, 1]) {
        const px = pose.ax + (pose.bx - pose.ax) * t, pz = pose.az + (pose.bz - pose.az) * t;
        if (!nav?.clear(px, pz, radius) || support && Math.abs(support.supportBelow(px, pz, feet) - feet) > .3) return;
      }
      this.query.x = x; this.query.z = z; this.spatial.query(this.query, this.neighbors, false);
      const layers: RestingPose[] = [];
      for (const id of this.neighbors) {
        const other = this.bodies.get(id)!;
        if (id === e.id || segmentDistance(pose.ax, pose.az, pose.bx, pose.bz, other) >= radius + other.radius) continue;
        if (corpsePose(id) === corpsePose(e.id) && yawDistance(yaw, other.yaw) < .2) return;
        layers.push(other);
      }
      // Fill the lowest free layer. Always going above the highest neighbour
      // made a chain of touching feet climb into an artificial body tower.
      for (const other of layers.sort((a, b) => a.y - b.y)) {
        if (pose.y + height > other.y + .001 && pose.y < other.y + other.height - .001) pose.y = other.y + other.height;
      }
      return { ...pose };
    };
    let best: RestingPose | undefined;
    // First prefer an unoccupied footprint, nearest to the death position.
    // Combat bodies stay within 1 m. Once the L10 fight ends, use the surrounding
    // floor (up to 4 m) so the final collapsed crowd reads as individual people.
    for (let ring = 0; ring <= (epilogue ? 10 : 5); ring++) {
      const distance = ring * (epilogue ? .4 : .2), samples = ring ? Math.max(16, Math.min(48, ring * 8)) : 1;
      for (let i = 0; i < samples; i++) {
        const angle = initialYaw + i * Math.PI * 2 / samples, x = e.transform.x + Math.cos(angle) * distance, z = e.transform.z + Math.sin(angle) * distance;
        for (let turn = 0; turn < 4; turn++) {
          const candidate = evaluate(x, z, initialYaw + turn * 2.399963229728653);
          if (!candidate) continue;
          if (candidate.y <= feet + .05) { best = candidate; break; }
          if (!best || candidate.y < best.y - .001) best = candidate;
        }
        if (best && best.y <= feet + .05) break;
      }
      if (best && best.y <= feet + .05) break;
    }
    // A narrow doorway can fit the actor but reject a conservative full-body
    // strip. Keep the bounded root and heap layer, never teleport it elsewhere.
    if (!best) for (let i = 0; i < 80 && !best; i++) {
      const angle = initialYaw + i * Math.PI * 2 / 80;
      best = evaluate(e.transform.x + Math.cos(angle), e.transform.z + Math.sin(angle), angle + Math.PI / 2, false);
    }
    if (!best) best = evaluate(e.transform.x, e.transform.z, initialYaw + .7, false) ?? { ...pose };
    this.bodies.set(e.id, best); this.spatial.set(e.id, best.x, best.z); return best;
  }
}
