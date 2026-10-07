import { Mesh, MeshBasicNodeMaterial, type Object3D } from 'three/webgpu';
import type { LabAccidentTargets } from './labAccident';
import type { Vec2 } from '../../sim/outbreak/types';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';

/** The clinic annex ships static-batched: all its glowing windows are one `window-light` mesh inside the instanced group
 * `inst:bld.clinic-annex` (one group per LOD). Individual `window_*` nodes do not survive batching, so the whole facade
 * flickers: that mesh gets a private basic material (vertex colours x intensity) the first time the flicker starts, and
 * the blast turns it dark (blown windows). Other buildings keep their shared window material. */
const GLOW = 3.5;
export function labAccidentTargets(scene: Object3D, shake: (strength: number) => void, camera?: (x: number, z: number, weight: number) => void): LabAccidentTargets {
  const meshes = new Set<Mesh>();
  const material = new MeshBasicNodeMaterial({ vertexColors: true });
  let bound = 0, last = 1;
  const bind = (): void => {
    scene.traverse(node => {
      if (!node.name.startsWith('inst:bld.clinic-annex')) return;
      node.traverse(child => { if (child instanceof Mesh && child.name === 'window-light' && !meshes.has(child)) { meshes.add(child); child.material = material; } });
    });
    bound++;
  };
  const apply = (intensity: number): void => { last = intensity; material.color.setScalar(GLOW * intensity); };
  return {
    shake,
    camera,
    windowLight(intensity) {
      // LOD swaps create new batches: rebind about twice a second while the accident drives the light.
      if (!meshes.size || bound % 30 === 0) bind();
      bound++;
      apply(intensity);
    },
    windowGlass(state, amount) {
      if (!meshes.size) bind();
      if (state === 'bow') apply(Math.max(last, 1 + amount));
      else apply(0.06);
    },
  };
}
/** Anchor lookup in world metres over all loaded districts. */
export function anchorLookup(world: { districts: DistrictWorld | null }): (name: string) => Vec2 | undefined {
  return name => {
    for (const d of world.districts?.districts ?? []) {
      const a = d.layout.anchors[name];
      if (a) return { x: a.position[0] + d.origin[0], z: a.position[2] + d.origin[1] };
    }
    return undefined;
  };
}
