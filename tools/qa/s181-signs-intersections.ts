import { Mesh, Vector3 } from 'three';

export function signIntersections(model: import('three').Object3D, verticesOfSign: number[][]): { intersections: number; points: number[][] } {
  const [a,b,,d] = verticesOfSign.map(v => new Vector3().fromArray(v));
  const u = b.clone().sub(a), v = d.clone().sub(a), normal = u.clone().cross(v).normalize();
  const uv = (p: Vector3) => { const delta = p.clone().sub(a); return [delta.dot(u) / u.lengthSq(), delta.dot(v) / v.lengthSq()]; };
  const crosses = (p: number[], q: number[]) => {
      let lo = 0, hi = 1;
      for (let axis = 0; axis < 2; axis++) {
        const step = q[axis] - p[axis];
        if (Math.abs(step) < 1e-9) { if (p[axis] < 0 || p[axis] > 1) return false; continue; }
        const r = -p[axis] / step, s = (1 - p[axis]) / step;
        lo = Math.max(lo, Math.min(r,s)); hi = Math.min(hi, Math.max(r,s));
      }
      return lo <= hi;
    };
  let intersections = 0; const points: number[][] = [];
  model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position'), index = object.geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const vertices = [0,1,2].map(j => new Vector3().fromBufferAttribute(positions, index ? index.getX(i+j) : i+j).applyMatrix4(object.matrixWorld));
        const distances = vertices.map(point => point.clone().sub(a).dot(normal));
        if (distances.every(value => value > 0) || distances.every(value => value < 0)) continue;
        const hits: Vector3[] = [];
        for (const [j,k] of [[0,1],[1,2],[2,0]]) {
          const x = distances[j], y = distances[k];
          if (x * y <= 0 && Math.abs(x-y) > 1e-9) hits.push(vertices[j].clone().lerp(vertices[k], x / (x-y)));
        }
        if (hits.length >= 2 && crosses(uv(hits[0]), uv(hits[1]))) { intersections++; points.push(uv(hits[0])); }
      }
    });
  return { intersections, points };
}
