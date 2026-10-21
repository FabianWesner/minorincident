import { BufferGeometry, Float32BufferAttribute, Group, Mesh, DoubleSide } from 'three/webgpu';
import type { HeightStep } from '../sim/world/HeightSteps';
import type { Materials } from './Materials';
/** Continuous retaining faces with pale stone caps. Two merged batches, same on both
 * quality tiers; the narrow local moon bounce survives the night grade without extra lights. */
export class HeightStepEdges extends Group {
  private readonly geometries: BufferGeometry[] = [];
  constructor(steps: readonly HeightStep[], materials: Materials) {
    super(); this.name = 'walkable-height-step-edges';
    const { walls, caps } = heightStepVertices(steps);
    for (const [vertices, token, glow] of [[walls, 'sidewalk', .025], [caps, 'picketWhite', .30]] as const) {
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
      this.geometries.push(geometry);
      const mesh = new Mesh(geometry, materials.world(token, glow, false, DoubleSide).seeThrough()); mesh.receiveShadow = true; mesh.castShadow = false; this.add(mesh);
    }
  }
  dispose(): void { for (const geometry of this.geometries) geometry.dispose(); this.clear(); }
}

/** Shared authored geometry lets the QA scanner inspect the same triangles the game draws. */
export function heightStepVertices(steps: readonly HeightStep[]): { walls: number[]; caps: number[] } {
  const walls: number[] = [], caps: number[] = [];
  const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const s of steps) {
    const [ax, az] = s.a, [bx, bz] = s.b, [nx, nz] = s.outward;
    const top = s.upper + .025, bottom = s.lower - .15; // Overlap the backdrop at -0.12 m; no floating seam.
    quad(walls, [ax + nx * .006, bottom, az + nz * .006], [bx + nx * .006, bottom, bz + nz * .006], [bx + nx * .006, top, bz + nz * .006], [ax + nx * .006, top, az + nz * .006]);
    // 32 cm cap is still wider than a pixel at maximum gameplay zoom.
    quad(caps, [ax + nx * .04, top, az + nz * .04], [bx + nx * .04, top, bz + nz * .04], [bx - nx * .28, top, bz - nz * .28], [ax - nx * .28, top, az - nz * .28]);
  }
  return { walls, caps };
}
