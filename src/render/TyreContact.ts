import { Matrix4, Mesh, Vector3, type BufferAttribute, type Object3D } from 'three/webgpu';

/** Tyre cross-section of a wheel at runtime scale: [radial, |axial|] points that can be lowest at some lean (16 axial bins). */
export type Profile = [number, number][];
export function tyreProfile(wheel: Object3D | undefined, scale: number): Profile {
  if (!wheel) return [];
  wheel.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(wheel.matrixWorld).invert(), m = new Matrix4(), p = new Vector3(), bins = new Map<number, [number, number]>();
  wheel.traverse(n => {
    if (!(n instanceof Mesh)) return;
    m.multiplyMatrices(inverse, n.matrixWorld);
    const position = n.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(m);
      const radial = Math.hypot(p.x, p.y) * scale, axial = Math.abs(p.z) * scale, bin = Math.round(axial * 400);
      const old = bins.get(bin); if (!old || radial > old[0]) bins.set(bin, [radial, axial]);
    }
  });
  return [...bins.values()];
}
/** Half width of the tyre itself (outer 15 % of the radius; hub and axle stubs are wider but never touch the road). */
export const tyreHalfWidth = (profile: Profile) => { const outer = Math.max(0, ...profile.map(([radial]) => radial)) * .85; return Math.max(0, ...profile.filter(([radial]) => radial > outer).map(([, axial]) => axial)); };
/** Tread ring of a wheel in its local (model) units: the profile's outer points at 9 axial stations, every 3 degrees over the lower half. */
export function tyreRing(profile: Profile, scale: number): Vector3[] {
  const half = tyreHalfWidth(profile), tread = profile.filter(([radial]) => radial > Math.max(0, ...profile.map(([r]) => r)) * .85), out: Vector3[] = [];
  if (!tread.length) return out;
  for (const station of [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1]) {
    const [radial, axial] = tread.reduce((best, p) => Math.abs(p[1] - Math.abs(station) * half) < Math.abs(best[1] - Math.abs(station) * half) ? p : best);
    for (let k = -30; k <= 30; k++) { const a = k * Math.PI / 60; out.push(new Vector3(Math.sin(a) * radial / scale, -Math.cos(a) * radial / scale, Math.sign(station) * axial / scale)); }
  }
  return out;
}

/** Drawn tyre face contacts in wheel-local space, including edges and face centres at paving boundaries. */
export function tyreSurface(wheel: Object3D): Vector3[] {
  wheel.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(wheel.matrixWorld).invert(), m = new Matrix4(), points = new Map<string, Vector3>();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), p = new Vector3();
  wheel.traverse(n => {
    if (!(n instanceof Mesh) || !n.visible) return;
    m.multiplyMatrices(inverse, n.matrixWorld);
    const position = n.geometry.getAttribute('position') as BufferAttribute, index = n.geometry.index, count = index ? index.count : position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(m);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(m);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(m);
      for (const [u, v] of [[1, 0], [0, 1], [0, 0], [.5, .5], [.5, 0], [0, .5], [1 / 3, 1 / 3]]) {
        p.set(0, 0, 0).addScaledVector(a, u).addScaledVector(b, v).addScaledVector(c, 1 - u - v);
        points.set(`${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`, p.clone());
      }
    }
  });
  return [...points.values()];
}
