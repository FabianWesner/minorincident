import { Mesh, type Material, type Object3D } from 'three/webgpu';
import type { LabAccidentTargets } from './labAccident';
import type { Vec2 } from '../../sim/outbreak/types';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';

/** Facility windows are the emissive assemblies `window_*` of the clinic annex (bld.clinic-annex). Their materials
 * are scaled for the flicker, the nodes bow outward for the pressure wave and are hidden when the glass shatters.
 * With no such node in the scene (building not placed yet) the hooks are silent no-ops. */
const windowName = /^window_(front|side|rear|door_[LR])$/;
interface Emissive { emissiveIntensity: number }
export function labAccidentTargets(scene: Object3D, shake: (strength: number) => void): LabAccidentTargets {
  const nodes: { node: Object3D; scale: number; materials: { material: Material & Emissive; base: number }[] }[] = [];
  scene.traverse(node => {
    if (!windowName.test(node.name)) return;
    const materials = new Map<Material & Emissive, number>();
    node.traverse(child => {
      if (!(child instanceof Mesh)) return;
      for (const m of Array.isArray(child.material) ? child.material : [child.material])
        if ('emissiveIntensity' in m) materials.set(m as Material & Emissive, (m as Emissive).emissiveIntensity);
    });
    nodes.push({ node, scale: node.scale.z, materials: [...materials].map(([material, base]) => ({ material, base })) });
  });
  return {
    shake,
    windowLight(intensity) { for (const w of nodes) for (const m of w.materials) m.material.emissiveIntensity = m.base * intensity; },
    windowGlass(state, amount) {
      for (const w of nodes) {
        if (state === 'bow') w.node.scale.z = w.scale * (1 + 0.12 * amount);
        else { w.node.visible = false; for (const m of w.materials) m.material.emissiveIntensity = 0; }
      }
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
