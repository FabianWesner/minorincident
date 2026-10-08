/** Scene Lab clipping geometry: plain arrays, no three.js, so it runs in the browser and in Vitest alike.
 * Triangles are packed 9 floats each (world metres). Everything is brute force with box prefilters; scenes are small. */
export type Vec3 = [number, number, number];
export interface Box { min: Vec3; max: Vec3 }
export interface TriangleSet { id: string; assetId: string; tris: Float32Array; box: Box }

export function boxOf(tris: Float32Array): Box {
  const box: Box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < tris.length; i += 3) for (let a = 0; a < 3; a++) { box.min[a] = Math.min(box.min[a], tris[i + a]); box.max[a] = Math.max(box.max[a], tris[i + a]); }
  return box;
}
export const boxesOverlap = (a: Box, b: Box, pad = 0) => a.min[0] - pad <= b.max[0] && a.max[0] + pad >= b.min[0] && a.min[1] - pad <= b.max[1] && a.max[1] + pad >= b.min[1] && a.min[2] - pad <= b.max[2] && a.max[2] + pad >= b.min[2];
function triBox(t: Float32Array, i: number): Box {
  return { min: [Math.min(t[i], t[i + 3], t[i + 6]), Math.min(t[i + 1], t[i + 4], t[i + 7]), Math.min(t[i + 2], t[i + 5], t[i + 8])], max: [Math.max(t[i], t[i + 3], t[i + 6]), Math.max(t[i + 1], t[i + 4], t[i + 7]), Math.max(t[i + 2], t[i + 5], t[i + 8])] };
}

/** Möller-Trumbore on the segment p→q; returns the hit parameter in [0, 1] or -1. */
export function segmentTriangle(px: number, py: number, pz: number, qx: number, qy: number, qz: number, t: Float32Array, i: number): number {
  const dx = qx - px, dy = qy - py, dz = qz - pz;
  const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2];
  const e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-12) return -1;
  const f = 1 / det, sx = px - t[i], sy = py - t[i + 1], sz = pz - t[i + 2];
  const u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) return -1;
  const qx2 = sy * e1z - sz * e1y, qy2 = sz * e1x - sx * e1z, qz2 = sx * e1y - sy * e1x;
  const v = f * (dx * qx2 + dy * qy2 + dz * qz2); if (v < 0 || u + v > 1) return -1;
  const s = f * (e2x * qx2 + e2y * qy2 + e2z * qz2);
  return s >= 0 && s <= 1 ? s : -1;
}
/** Two non-coplanar triangles intersect iff an edge of one pierces the other. */
export function trianglesIntersect(a: Float32Array, i: number, b: Float32Array, j: number): boolean {
  for (let e = 0; e < 3; e++) {
    const p = i + e * 3, q = i + (e + 1) % 3 * 3;
    if (segmentTriangle(a[p], a[p + 1], a[p + 2], a[q], a[q + 1], a[q + 2], b, j) >= 0) return true;
    const r = j + e * 3, s = j + (e + 1) % 3 * 3;
    if (segmentTriangle(b[r], b[r + 1], b[r + 2], b[s], b[s + 1], b[s + 2], a, i) >= 0) return true;
  }
  return false;
}
/** Squared distance from a point to a triangle (Ericson, Real-Time Collision Detection 5.1.5). */
export function pointTriangleDistance2(px: number, py: number, pz: number, t: Float32Array, i: number): number {
  const ax = t[i], ay = t[i + 1], az = t[i + 2], abx = t[i + 3] - ax, aby = t[i + 4] - ay, abz = t[i + 5] - az, acx = t[i + 6] - ax, acy = t[i + 7] - ay, acz = t[i + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const closest = (x: number, y: number, z: number) => (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
  if (d1 <= 0 && d2 <= 0) return closest(ax, ay, az);
  const bpx = px - t[i + 3], bpy = py - t[i + 4], bpz = pz - t[i + 5];
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return closest(t[i + 3], t[i + 4], t[i + 5]);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return closest(ax + abx * v, ay + aby * v, az + abz * v); }
  const cpx = px - t[i + 6], cpy = py - t[i + 7], cpz = pz - t[i + 8];
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return closest(t[i + 6], t[i + 7], t[i + 8]);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return closest(ax + acx * w, ay + acy * w, az + acz * w); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return closest(t[i + 3] + (t[i + 6] - t[i + 3]) * w, t[i + 4] + (t[i + 7] - t[i + 4]) * w, t[i + 5] + (t[i + 8] - t[i + 5]) * w); }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  return closest(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
}

export interface StaticClip { a: string; b: string; assetA: string; assetB: string; intersectingTriangles: number; region: Box; regionCm: Vec3 }
/** Mesh-level static clipping: triangle pairs of two placements that cut through each other. */
export function staticClipping(sets: TriangleSet[], ignore: (a: TriangleSet, b: TriangleSet) => boolean = () => false, limit = 20000): StaticClip[] {
  const out: StaticClip[] = [];
  for (let m = 0; m < sets.length; m++) for (let n = m + 1; n < sets.length; n++) {
    const A = sets[m], B = sets[n];
    if (!boxesOverlap(A.box, B.box) || ignore(A, B)) continue;
    // Only triangles inside the shared box can intersect.
    const shared: Box = { min: [0, 1, 2].map(k => Math.max(A.box.min[k], B.box.min[k])) as Vec3, max: [0, 1, 2].map(k => Math.min(A.box.max[k], B.box.max[k])) as Vec3 };
    const pick = (s: TriangleSet) => { const list: number[] = []; for (let i = 0; i < s.tris.length; i += 9) if (boxesOverlap(triBox(s.tris, i), shared)) list.push(i); return list; };
    const ia = pick(A), ib = pick(B), boxesB = ib.map(j => triBox(B.tris, j));
    let count = 0; const region: Box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const i of ia) {
      const boxA = triBox(A.tris, i);
      for (let k = 0; k < ib.length && count < limit; k++) {
        if (!boxesOverlap(boxA, boxesB[k]) || !trianglesIntersect(A.tris, i, B.tris, ib[k])) continue;
        count++;
        // Grow the contact region by the overlap of the two triangles' boxes (tight around the cut line).
        for (let a = 0; a < 3; a++) { region.min[a] = Math.min(region.min[a], Math.max(boxA.min[a], boxesB[k].min[a])); region.max[a] = Math.max(region.max[a], Math.min(boxA.max[a], boxesB[k].max[a])); }
      }
    }
    if (count) out.push({ a: A.id, b: B.id, assetA: A.assetId, assetB: B.assetId, intersectingTriangles: count, region, regionCm: [0, 1, 2].map(k => Math.round((region.max[k] - region.min[k]) * 100)) as Vec3 });
  }
  return out.sort((x, y) => y.intersectingTriangles - x.intersectingTriangles);
}

/** Shortest distance between segments p0-p1 and q0-q1 (metres). */
export function segmentDistance(p0: Vec3, p1: Vec3, q0: Vec3, q1: Vec3): number {
  const d1 = [0, 1, 2].map(k => p1[k] - p0[k]), d2 = [0, 1, 2].map(k => q1[k] - q0[k]), r = [0, 1, 2].map(k => p0[k] - q0[k]);
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), clamp = (v: number) => Math.max(0, Math.min(1, v));
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) return Math.sqrt(dot(r, r));
  if (a <= 1e-9) t = clamp(f / e);
  else {
    const c = dot(d1, r);
    if (e <= 1e-9) s = clamp(-c / a);
    else { const b = dot(d1, d2), den = a * e - b * b; s = den > 1e-9 ? clamp((b * f - c * e) / den) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); } }
  }
  return Math.hypot(...[0, 1, 2].map(k => p0[k] + d1[k] * s - q0[k] - d2[k] * t));
}
/** Torso-on-torso interpenetration of two actors: deepest overlap (m) of their spine, neck and head capsules, 0 if apart. */
export function bodyOverlap(a: Bone[], b: Bone[]): number {
  let depth = 0;
  for (const x of a) for (const y of b) depth = Math.max(depth, x.radius + y.radius - segmentDistance(x.a, x.b, y.a, y.b));
  return depth;
}
/** A rig bone as a capsule centre line; `radius` approximates the limb's flesh thickness. */
export interface Bone { name: string; a: Vec3; b: Vec3; radius: number }
export interface BoneHit { bone: string; prop: string; asset: string; crossing: boolean; clearanceCm: number; /** World point where the bone centre line pierces the surface, in metres. */ at?: Vec3 }
/** Bone centre lines that pierce a prop surface, or pass closer than the bone radius minus `slack` (skin inside the prop). */
export function boneClipping(bones: Bone[], sets: TriangleSet[], slack = .02): BoneHit[] {
  const hits: BoneHit[] = [];
  for (const set of sets) for (const bone of bones) {
    const box: Box = { min: [0, 1, 2].map(k => Math.min(bone.a[k], bone.b[k]) - bone.radius) as Vec3, max: [0, 1, 2].map(k => Math.max(bone.a[k], bone.b[k]) + bone.radius) as Vec3 };
    if (!boxesOverlap(box, set.box)) continue;
    let crossing = false, best = Infinity, at: Vec3 | undefined;
    for (let i = 0; i < set.tris.length; i += 9) {
      if (!boxesOverlap(triBox(set.tris, i), box)) continue;
      if (!crossing) { const t = segmentTriangle(bone.a[0], bone.a[1], bone.a[2], bone.b[0], bone.b[1], bone.b[2], set.tris, i); if (t >= 0) { crossing = true; at = [0, 1, 2].map(k => Math.round((bone.a[k] + (bone.b[k] - bone.a[k]) * t) * 1000) / 1000) as Vec3; } }
      for (let s = 0; s <= 4; s++) {
        const u = s / 4, d = pointTriangleDistance2(bone.a[0] + (bone.b[0] - bone.a[0]) * u, bone.a[1] + (bone.b[1] - bone.a[1]) * u, bone.a[2] + (bone.b[2] - bone.a[2]) * u, set.tris, i);
        if (d < best) best = d;
      }
    }
    const clearance = Math.sqrt(best);
    if (crossing || clearance < bone.radius - slack) hits.push({ bone: bone.name, prop: set.id, asset: set.assetId, crossing, clearanceCm: Math.round(clearance * 1000) / 10, at });
  }
  return hits;
}
