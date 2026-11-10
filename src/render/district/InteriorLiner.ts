import { BufferGeometry, FrontSide, Float32BufferAttribute, InstancedMesh, Object3D } from 'three/webgpu';
import type { Materials } from '../Materials';

/** r27-visp2 (PO QA batch 60, L10 farm hide gap): a solid-shell house cut by the courier see-through disc showed "a flat black void with
 * loose window frames": the walls and roof are closed boxes, so once their near faces are discarded the far faces are back faces (culled)
 * and nothing is behind them. The liner is a thin room drawn just inside the shell with its faces pointing inward: far walls, floor and
 * the roof underside show through the cut, while the near faces face away from the lens and stay culled (the courier is never covered).
 * Profile and extent follow the authored shell (tools/blender/sslib/cure_kits.py `duplex`: body 8.0 x 13.0, floor 0.35, eaves 5.55, ridge 8.15). */
interface Shell { profile: [number, number][]; halfDepth: number }
const shells: Record<string, Shell> = {
  'bld.cure-duplex': { profile: [[-3.92, .38], [3.92, .38], [3.92, 5.6], [0, 7.85], [-3.92, 5.6]], halfDepth: 6.42 },
};
export const linedBuildings = (id: string): boolean => id in shells;

/** Inward-facing extrusion of a convex CCW profile (x, y) along z: side quads, floor, roof underside and both gable ends, normals pointing into the room. */
export function linerGeometry({ profile, halfDepth: h }: Shell): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    const base = positions.length / 3;
    for (const p of [a, b, c, d]) { positions.push(...p); normals.push(...n); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let i = 0; i < profile.length; i++) {
    const [x0, y0] = profile[i], [x1, y1] = profile[(i + 1) % profile.length];
    const dx = x1 - x0, dy = y1 - y0, length = Math.hypot(dx, dy);
    // Inward = left of the CCW edge direction. Wind (a, d, c, b) so the front face looks into the room.
    quad([x0, y0, -h], [x0, y0, h], [x1, y1, h], [x1, y1, -h], [-dy / length, dx / length, 0]);
  }
  for (const [z, nz] of [[h, -1], [-h, 1]] as const) {
    for (let i = 1; i < profile.length - 1; i++) {
      const base = positions.length / 3;
      for (const k of [0, i, i + 1]) { positions.push(profile[k][0], profile[k][1], z); normals.push(0, 0, nz); }
      if (nz < 0) indices.push(base, base + 2, base + 1); else indices.push(base, base + 1, base + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
}

/** One instanced liner for every placement of a lined building. The caller disposes the returned geometry; the material is the shared cached palette material. */
export function interiorLiner(id: string, refs: readonly Object3D[], materials: Materials): { mesh: InstancedMesh; geometry: BufferGeometry } {
  // Lit plaster with a self-lit share, so the room reads in the night levels too (a lit-only interior is as black as the void it replaces).
  // A courier standing against the far wall sits behind the liner's far face from the lens: that face gets the same disc cut as every
  // occluder (seeThroughKeep). The emissive value is unique, so this cached material is not shared with other world surfaces.
  const material = materials.world('picketWhite', .2237, false, FrontSide).seeThrough(true);
  const geometry = linerGeometry(shells[id]);
  const mesh = new InstancedMesh(geometry, material, refs.length);
  refs.forEach((ref, i) => { ref.updateMatrix(); mesh.setMatrixAt(i, ref.matrix); });
  mesh.instanceMatrix.needsUpdate = true; mesh.name = `liner:${id}`; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
  return { mesh, geometry };
}
