import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import type { CrowdPosePalette } from './CrowdPosePalette';

/** World points of a drawn body: feet midpoint, hips, head centre (metres). */
export interface PickBody { feet: Vector3; hip: Vector3; head: Vector3 }

interface Entry { frame: number; instance: Matrix4; palette: CrowdPosePalette; pose: number; outgoing: number; weight: number; geometry?: BufferGeometry; worldParts?: Matrix4[]; boundsReady?: boolean }

/** The bodies the crowd renderers drew last frame, for click picking against what the player sees (not the sim
 * capsule): a lunging, hunched or lying infected is clicked where it is drawn. Recording copies one matrix per
 * figure; the rig joints are evaluated only when a click asks for them (the palette rows stay valid until the next
 * render, which runs after input sampling). */
export class PickBodies {
  private readonly entries = new Map<number, Entry>();
  private frame = 0;
  private readonly geometryBounds = new WeakMap<BufferGeometry, Box3[]>();
  private readonly localBounds = new Box3();
  private readonly topBounds = new Box3();
  private readonly part = new Matrix4();
  private readonly world = new Matrix4();
  private readonly point = new Vector3();
  reset(): void { this.entries.clear(); this.frame++; }
  begin(): void { this.frame++; if (this.entries.size > 2048) this.entries.clear(); }
  add(id: number, instance: Matrix4, palette: CrowdPosePalette, pose: number, outgoing: number, weight: number, geometry?: BufferGeometry): void {
    let entry = this.entries.get(id);
    if (!entry) { entry = { frame: 0, instance: new Matrix4(), palette, pose, outgoing, weight }; this.entries.set(id, entry); }
    entry.frame = this.frame; entry.instance.copy(instance); entry.palette = palette; entry.pose = pose; entry.outgoing = outgoing; entry.weight = weight; entry.geometry = geometry;
    entry.boundsReady = false;
  }
  /** The drawn body of `id` in the last rendered frame, or null when it was not drawn. */
  body(id: number, out: PickBody): PickBody | null {
    const entry = this.entries.get(id);
    if (!entry || entry.frame !== this.frame) return null;
    const parts = entry.palette.clip.parts, head = parts.indexOf('head'), hip = parts.indexOf('hip'), footL = parts.indexOf('footL'), footR = parts.indexOf('footR');
    if (head < 0 || hip < 0 || footL < 0 || footR < 0) return null;
    this.joint(entry, hip, out.hip); this.joint(entry, head, out.head);
    this.joint(entry, footL, out.feet); this.joint(entry, footR, this.point); out.feet.add(this.point).multiplyScalar(.5);
    // The head pivot is the neck: the visible head centre sits ~0.12 m further along the hip-to-head axis.
    this.point.subVectors(out.head, out.hip); const length = this.point.length();
    if (length > 1e-6) out.head.addScaledVector(this.point, .12 / length);
    return out;
  }
  /** Animated part bounds use the same pose and instance matrices as the GPU. */
  bounds(id: number, out: Box3, projection?: Matrix4): Box3 | null {
    const entry = this.entries.get(id);
    if (!entry || entry.frame !== this.frame || !entry.geometry) return null;
    let boxes = this.geometryBounds.get(entry.geometry);
    if (!boxes) {
      boxes = entry.palette.clip.parts.map(() => new Box3());
      const positions = entry.geometry.getAttribute('position');
      const parts = entry.geometry.getAttribute('_parts') ?? entry.geometry.getAttribute('_part_index');
      for (let i = 0; i < positions.count; i++) boxes[Math.round(parts.getX(i))]?.expandByPoint(this.point.fromBufferAttribute(positions, i));
      this.geometryBounds.set(entry.geometry, boxes);
    }
    out.makeEmpty();
    // Health bars request world bounds and then projected bounds of the same
    // submitted pose. Retain its exact part matrices until add() replaces it;
    // projection still transforms each original part box, in the same order.
    const worldParts = entry.worldParts ??= [];
    for (let i = 0; i < boxes.length; i++) if (!boxes[i].isEmpty()) {
      const world = worldParts[i] ??= new Matrix4();
      if (!entry.boundsReady) {
        entry.palette.part(entry.pose, entry.outgoing, entry.weight, i, this.part);
        world.multiplyMatrices(entry.instance, this.part);
      }
      this.world.copy(world);
      if (projection) this.world.premultiply(projection);
      out.union(this.localBounds.copy(boxes[i]).applyMatrix4(this.world));
    }
    entry.boundsReady = true;
    return out.isEmpty() ? null : out;
  }
  /** Health bars consume only projected max Y. Evaluate the same corner Y/W
   * values as bounds(), without calculating unused screen X/Z extrema. */
  top(id: number, projection: Matrix4): number | null {
    const entry = this.entries.get(id);
    if (!entry || entry.frame !== this.frame || !entry.geometry) return null;
    if (!entry.boundsReady && !this.bounds(id, this.topBounds)) return null;
    const boxes = this.geometryBounds.get(entry.geometry)!;
    let top = -Infinity;
    for (let i = 0; i < boxes.length; i++) if (!boxes[i].isEmpty()) {
      const p = projection.elements, m = entry.worldParts![i].elements, box = boxes[i];
      // The second and fourth product rows, in Matrix4.multiplyMatrices order.
      const y0 = p[1] * m[0] + p[5] * m[1] + p[9] * m[2] + p[13] * m[3];
      const y1 = p[1] * m[4] + p[5] * m[5] + p[9] * m[6] + p[13] * m[7];
      const y2 = p[1] * m[8] + p[5] * m[9] + p[9] * m[10] + p[13] * m[11];
      const y3 = p[1] * m[12] + p[5] * m[13] + p[9] * m[14] + p[13] * m[15];
      const w0 = p[3] * m[0] + p[7] * m[1] + p[11] * m[2] + p[15] * m[3];
      const w1 = p[3] * m[4] + p[7] * m[5] + p[11] * m[6] + p[15] * m[7];
      const w2 = p[3] * m[8] + p[7] * m[9] + p[11] * m[10] + p[15] * m[11];
      const w3 = p[3] * m[12] + p[7] * m[13] + p[11] * m[14] + p[15] * m[15];
      for (let corner = 0; corner < 8; corner++) {
        const x = corner & 4 ? box.max.x : box.min.x, y = corner & 2 ? box.max.y : box.min.y, z = corner & 1 ? box.max.z : box.min.z;
        const w = 1 / (w0 * x + w1 * y + w2 * z + w3);
        top = Math.max(top, (y0 * x + y1 * y + y2 * z + y3) * w);
      }
    }
    return top === -Infinity ? null : top;
  }
  private joint(entry: Entry, part: number, out: Vector3): void {
    entry.palette.part(entry.pose, entry.outgoing, entry.weight, part, this.part);
    out.setFromMatrixPosition(this.world.multiplyMatrices(entry.instance, this.part));
  }
}

/** One game view draws one crowd; the input system reads it on click. */
export const pickBodies = new PickBodies();
