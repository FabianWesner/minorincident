import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshLambertNodeMaterial, TorusGeometry, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute } from 'three/tsl';
import type { Materials } from '../Materials';
import type { CivilianProp } from '../../sim/npc/types';

/** Small shared rigid accessories follow the same baked hand matrix as the GPU civilian. */
export class RoutineProps extends Group {
  private readonly meshes = new Map<CivilianProp, InstancedMesh>();
  constructor(shading?: Materials) {
    super(); this.name = 'morning-props';
    const part = (geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
      geometry.translate(x, y, z); const rgb = new Color(color), count = geometry.getAttribute('position').count;
      const values = new Float32Array(count * 3); for (let i = 0; i < count; i++) values.set(rgb.toArray(), i * 3);
      geometry.setAttribute('color', new BufferAttribute(values, 3)); return geometry;
    };
    const ring = (r: number, tube: number, x: number, y: number, z: number, color: string) => part(new TorusGeometry(r, tube, 6, 16), color, x, y, z);
    const shapes: Record<CivilianProp, BufferGeometry[]> = {
      coffee: [part(new CylinderGeometry(.07, .055, .16, 12), '#f5e6c7', 0, .025), part(new CylinderGeometry(.065, .065, .012, 12), '#563c2c', 0, .11), ring(.045, .012, .085, .045, 0, '#f5e6c7')],
      bag: [part(new BoxGeometry(.26, .34, .18), '#ba8c53', 0, -.22), ring(.085, .012, 0, -.04, 0, '#6e5537'), part(new CylinderGeometry(.028, .035, .23, 8), '#76a14e', .07, -.045)],
      phone: [part(new BoxGeometry(.065, .12, .018), '#292537'), part(new BoxGeometry(.05, .085, .004), '#75b8cf', 0, .008, -.011)],
      cane: [part(new CylinderGeometry(.018, .021, .73, 8), '#71513e', .05, -.36), part(new BoxGeometry(.15, .035, .035), '#493d34'), part(new CylinderGeometry(.027, .027, .035, 8), '#292537', .05, -.735)],
      'watering-can': [part(new CylinderGeometry(.13, .13, .22, 12), '#68a093', 0, -.17), ring(.14, .018, 0, -.04, 0, '#426b60'), part(new CylinderGeometry(.033, .045, .3, 8).rotateZ(-.85), '#68a093', .19, -.10), part(new CylinderGeometry(.065, .025, .05, 10).rotateZ(-.85), '#bec9ba', .30, -.01)],
    };
    for (const [name, parts] of Object.entries(shapes)) {
      const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
      const material = shading?.shaded(attribute('color', 'vec3')) ?? new MeshLambertNodeMaterial({ vertexColors: true });
      const mesh = new InstancedMesh(geometry, material, 128); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
      this.meshes.set(name as CivilianProp, mesh); this.add(mesh);
    }
  }
  begin(): void { for (const mesh of this.meshes.values()) mesh.count = 0; }
  place(prop: CivilianProp, matrix: Matrix4): void { const mesh = this.meshes.get(prop)!; mesh.setMatrixAt(mesh.count++, matrix); }
  finish(): void { for (const mesh of this.meshes.values()) if (mesh.count) mesh.instanceMatrix.needsUpdate = true; }
  dispose(): void { for (const mesh of this.meshes.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); } this.clear(); }
}
