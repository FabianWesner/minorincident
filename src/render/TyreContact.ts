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
