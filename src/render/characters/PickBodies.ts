import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import type { CrowdPosePalette } from './CrowdPosePalette';

/** World points of a drawn body: feet midpoint, hips, head centre (metres). */
export interface PickBody { feet: Vector3; hip: Vector3; head: Vector3 }

interface Entry { frame: number; instance: Matrix4; palette: CrowdPosePalette; pose: number; outgoing: number; weight: number; geometry?: BufferGeometry; worldParts?: Matrix4[]; skinParts?: Matrix4[]; skinPartsReady?: boolean; boundsReady?: boolean; vertices?: Float32Array; fullVertices?: boolean; verticesReady?: boolean; cutMask?: number; revision?: number; worldBounds?: Box3; worldBoundsReady?: boolean; topProjection?: Matrix4; projectedTop?: number }

/** The bodies the crowd renderers drew last frame, for click picking against what the player sees (not the sim
 * capsule): a lunging, hunched or lying infected is clicked where it is drawn. Recording copies one matrix per
 * figure; the rig joints are evaluated only when a click asks for them (the palette rows stay valid until the next
 * render, which runs after input sampling). */
export class PickBodies {
  private readonly entries = new Map<number, Entry>();
  private frame = 0;
  private readonly skinSupports = new WeakMap<BufferGeometry, Map<number, Uint32Array>>();
  private readonly geometryBounds = new WeakMap<BufferGeometry, Box3[]>();
  private readonly localBounds = new Box3();
  private readonly topBounds = new Box3();
  private readonly part = new Matrix4();
  private readonly world = new Matrix4();
  private readonly point = new Vector3();
  private readonly inverseBind = new Matrix4();
  reset(): void { this.entries.clear(); this.frame++; }
  begin(): void { this.frame++; if (this.entries.size > 2048) this.entries.clear(); }
  add(id: number, instance: Matrix4, palette: CrowdPosePalette, pose: number, outgoing: number, weight: number, geometry?: BufferGeometry, cutMask = 0): void {
    let entry = this.entries.get(id);
    if (!entry) { entry = { frame: 0, instance: new Matrix4(), palette, pose, outgoing, weight }; this.entries.set(id, entry); }
    const revision = geometry && palette.clip.binds ? palette.revision(pose, outgoing, weight) : -1;
    // Low presentation may reuse the complete pose and world transform. Its exact
    // vertices/bounds remain valid until a sampled atlas row or input changes.
    const samePose = revision >= 0 && entry.revision === revision && entry.palette === palette && entry.pose === pose && entry.outgoing === outgoing && entry.weight === weight;
    const unchanged = samePose && entry.geometry === geometry && entry.cutMask === cutMask && entry.instance.equals(instance);
    if (!samePose) entry.skinPartsReady = false;
    entry.frame = this.frame; entry.instance.copy(instance); entry.palette = palette; entry.pose = pose; entry.outgoing = outgoing; entry.weight = weight; entry.geometry = geometry; entry.cutMask = cutMask; entry.revision = revision;
    if (!unchanged) { entry.boundsReady = false; entry.fullVertices = false; entry.verticesReady = false; entry.worldBoundsReady = false; entry.projectedTop = undefined; }
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
    if (entry.palette.clip.binds && entry.geometry.hasAttribute('_skin')) return this.skinBounds(entry, out, projection);
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
    if (entry.palette.clip.binds && entry.geometry.hasAttribute('_skin')) return this.skinTop(entry, projection);
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
  /** Single-joint vertices undergo one affine transform: only their convex hull
   * can contribute an extreme. Blended seam vertices remain explicit. This
   * preserves exact bounds while avoiding full body skinning for every bar. */
  private skinSupport(geometry: BufferGeometry, cutMask = 0): Uint32Array {
    let byMask = this.skinSupports.get(geometry); if (!byMask) { byMask = new Map(); this.skinSupports.set(geometry, byMask); }
    const cached = byMask.get(cutMask); if (cached) return cached;
    const positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
    const groups = new Map<number, Vector3[]>(), indices = new Map<Vector3, number>(), selected = new Set<number>(), blended = new Set<string>();
    for (let i = 0; i < positions.count; i++) {
      if (parts.getW(i) >= 1024 || parts.getZ(i) > 1.5 || cutMask && (Math.floor(skin.getW(i)) & cutMask)) continue;
      if (skin.getY(i) || skin.getZ(i) || (skin.getW(i) % 1)) {
        const key = [positions.getX(i), positions.getY(i), positions.getZ(i), parts.getX(i), skin.getX(i), skin.getY(i), skin.getZ(i), (skin.getW(i) % 1)].join('/');
        if (!blended.has(key)) { blended.add(key); selected.add(i); }
        continue;
      }
      const joint = parts.getX(i), points = groups.get(joint) ?? []; groups.set(joint, points);
      const point = new Vector3().fromBufferAttribute(positions, i); points.push(point); indices.set(point, i);
    }
    for (const points of groups.values()) {
      let hull: ConvexHull | undefined;
      if (points.length >= 4) { try { hull = new ConvexHull().setFromPoints(points); } catch { /* Flat/degenerate parts retain all their vertices. */ } }
      let volume = 0;
      for (const face of hull?.faces ?? []) {
        const a = face.edge.head().point, b = face.edge.next.head().point, c = face.edge.next.next.head().point;
        volume += a.x * (b.y * c.z - b.z * c.y) + a.y * (b.z * c.x - b.x * c.z) + a.z * (b.x * c.y - b.y * c.x);
      }
      if (!hull?.faces.length || !Number.isFinite(volume) || Math.abs(volume) < 1e-12) { for (const point of points) selected.add(indices.get(point)!); continue; }
      for (const face of hull.faces) { let edge = face.edge; do { selected.add(indices.get(edge.head().point)!); edge = edge.next; } while (edge !== face.edge); }
    }
    const result = new Uint32Array(selected); byMask.set(cutMask, result); return result;
  }
  private skinTop(entry: Entry, projection: Matrix4): number | null {
    if (entry.projectedTop !== undefined && entry.topProjection?.equals(projection)) return entry.projectedTop;
    if (!entry.verticesReady && !this.skinBounds(entry, this.topBounds)) return null;
    const vertices = entry.vertices!, p = projection.elements;
    let top = -Infinity, lowW = Infinity, highW = -Infinity;
    for (const i of this.skinSupport(entry.geometry!, entry.cutMask)) {
      const x = vertices[i * 3], y = vertices[i * 3 + 1], z = vertices[i * 3 + 2];
      const w = p[3] * x + p[7] * y + p[11] * z + p[15];
      lowW = Math.min(lowW, w); highW = Math.max(highW, w);
      top = Math.max(top, (p[1] * x + p[5] * y + p[9] * z + p[13]) / w);
    }
    const result = lowW <= 0 && highW >= 0 ? this.skinBounds(entry, this.topBounds, projection)?.max.y ?? null : Number.isFinite(top) ? top : null;
    if (result !== null) { (entry.topProjection ??= new Matrix4()).copy(projection); entry.projectedTop = result; }
    return result;
  }
  private skinBounds(entry: Entry, out: Box3, projection?: Matrix4): Box3 | null {
    if (!projection && entry.worldBoundsReady) return entry.worldBounds!.isEmpty() ? null : out.copy(entry.worldBounds!);
    const geometry = entry.geometry!, clip = entry.palette.clip, positions = geometry.getAttribute('position');
    const parts = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
    const support = this.skinSupport(entry.geometry!, entry.cutMask);
    const vertices = entry.vertices?.length === positions.count * 3 ? entry.vertices : entry.vertices = new Float32Array(positions.count * 3);
    const matrices = entry.worldParts ??= [];
    if (!entry.boundsReady) {
      const skinParts = entry.skinParts ??= [];
      for (let p = 0; p < clip.parts.length; p++) {
        const local = skinParts[p] ??= new Matrix4(), matrix = matrices[p] ??= new Matrix4();
        // A held pose can move through the world. Reuse joint × inverse bind;
        // placement still updates exactly for this frame's instance matrix.
        if (!entry.skinPartsReady) {
          entry.palette.part(entry.pose, entry.outgoing, entry.weight, p, local);
          local.multiply(this.inverseBind.fromArray(clip.binds!, p * 16));
        }
        matrix.multiplyMatrices(entry.instance, local);
      }
      entry.skinPartsReady = true;
      entry.boundsReady = true; entry.fullVertices = false; entry.verticesReady = false;
    }
    // Affine skin matrices have W=1. Evaluate their weighted xyz directly:
    // health bars ask this for every visible animal, so avoid a closure and
    // four Vector3 perspective transforms per vertex on every frame.
    const writeVertices = (selection?: Uint32Array) => {
      for (let k = 0; k < (selection?.length ?? positions.count); k++) {
        const i = selection ? selection[k] : k;
        if (!selection && (parts.getW(i) >= 1024 || parts.getZ(i) > 1.5 || entry.cutMask && (Math.floor(skin.getW(i)) & entry.cutMask))) continue;
        const packed = skin.getX(i), w1 = skin.getY(i), w2 = skin.getZ(i), w3 = (skin.getW(i) % 1);
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const m = matrices[parts.getX(i)].elements, w0 = 1 - w1 - w2 - w3;
        let px = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w0;
        let py = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w0;
        let pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w0;
        if (w1 > 0) {
          const n = matrices[packed % 32].elements;
          px += (n[0] * x + n[4] * y + n[8] * z + n[12]) * w1;
          py += (n[1] * x + n[5] * y + n[9] * z + n[13]) * w1;
          pz += (n[2] * x + n[6] * y + n[10] * z + n[14]) * w1;
        }
        if (w2 > 0) {
          const n = matrices[Math.floor(packed / 32) % 32].elements;
          px += (n[0] * x + n[4] * y + n[8] * z + n[12]) * w2;
          py += (n[1] * x + n[5] * y + n[9] * z + n[13]) * w2;
          pz += (n[2] * x + n[6] * y + n[10] * z + n[14]) * w2;
        }
        if (w3 > 0) {
          const n = matrices[Math.floor(packed / 1024)].elements;
          px += (n[0] * x + n[4] * y + n[8] * z + n[12]) * w3;
          py += (n[1] * x + n[5] * y + n[9] * z + n[13]) * w3;
          pz += (n[2] * x + n[6] * y + n[10] * z + n[14]) * w3;
        }
        vertices[i * 3] = px; vertices[i * 3 + 1] = py; vertices[i * 3 + 2] = pz;
      }
    };
    if (!entry.verticesReady) { writeVertices(support); entry.verticesReady = true; }
    // A perspective pole through the figure breaks convex projected extrema.
    // Keep the exact full-vertex path for that rare camera/figure intersection.
    let selected: Uint32Array | undefined = support;
    if (projection) {
      const p = projection.elements; let low = Infinity, high = -Infinity;
      for (const i of support) { const w = p[3] * vertices[i * 3] + p[7] * vertices[i * 3 + 1] + p[11] * vertices[i * 3 + 2] + p[15]; low = Math.min(low, w); high = Math.max(high, w); }
      if (low <= 0 && high >= 0) { if (!entry.fullVertices) writeVertices(); entry.fullVertices = true; selected = undefined; }
    }
    out.makeEmpty();
    for (let k = 0; k < (selected?.length ?? positions.count); k++) {
      const i = selected ? selected[k] : k;
      // Stump caps are hidden until a limb is removed, and never raise a health bar.
      if (!selected && (parts.getW(i) >= 1024 || parts.getZ(i) > 1.5 || entry.cutMask && (Math.floor(skin.getW(i)) & entry.cutMask))) continue;
      if (projection) { this.point.fromArray(vertices, i * 3).applyMatrix4(projection); out.expandByPoint(this.point); }
      else {
        const x = vertices[i * 3], y = vertices[i * 3 + 1], z = vertices[i * 3 + 2];
        out.min.x = Math.min(out.min.x, x); out.min.y = Math.min(out.min.y, y); out.min.z = Math.min(out.min.z, z);
        out.max.x = Math.max(out.max.x, x); out.max.y = Math.max(out.max.y, y); out.max.z = Math.max(out.max.z, z);
      }
    }
    if (!projection) { (entry.worldBounds ??= new Box3()).copy(out); entry.worldBoundsReady = true; }
    return out.isEmpty() ? null : out;
  }
}

/** One game view draws one crowd; the input system reads it on click. */
export const pickBodies = new PickBodies();
