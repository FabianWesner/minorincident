import { Box3, BoxGeometry, BufferAttribute, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshLambertNodeMaterial, Vector3, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute } from 'three/tsl';
import type { Materials } from '../Materials';
import type { CivilianProp } from '../../sim/npc/types';

/** Small shared rigid accessories follow the same baked hand matrix as the GPU civilian. */
export class RoutineProps extends Group {
  readonly contacts: { entity: number; prop: CivilianProp; hand: Float32Array; geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  private readonly meshes = new Map<CivilianProp, InstancedMesh>();
  constructor(shading?: Materials) {
    super(); this.name = 'morning-props';
    const part = (geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
      geometry.translate(x, y, z); const rgb = new Color(color), count = geometry.getAttribute('position').count;
      const values = new Float32Array(count * 3); for (let i = 0; i < count; i++) values.set(rgb.toArray(), i * 3);
      geometry.setAttribute('color', new BufferAttribute(values, 3)); return geometry;
    };
    const bar = (length: number, x: number, y: number, z: number, color: string) => part(new CylinderGeometry(.01, .01, length, 8).rotateX(Math.PI / 2), color, x, y, z);
    const handle = (color: string) => [bar(.15, .035, -.045, .015, color), bar(.15, .035, -.17, .015, color), part(new CylinderGeometry(.01, .01, .125, 8), color, .035, -.1075, -.06)];
    const shapes: Record<CivilianProp, BufferGeometry[]> = {
      coffee: [part(new CylinderGeometry(.07, .055, .16, 12), '#f5e6c7', .035, -.11, .155), part(new CylinderGeometry(.065, .065, .012, 12), '#563c2c', .035, -.024, .155), ...handle('#f5e6c7')],
      bag: [part(new BoxGeometry(.26, .34, .18), '#ba8c53', .035, -.32), bar(.16, .035, -.045, 0, '#6e5537'), ...[-.08, .08].map(z => part(new CylinderGeometry(.01, .01, .11, 8), '#6e5537', .035, -.1, z)), part(new CylinderGeometry(.028, .035, .23, 8), '#76a14e', .1, -.21)],
      phone: [part(new BoxGeometry(.018, .12, .065), '#292537', .105, -.03), part(new BoxGeometry(.004, .085, .05), '#75b8cf', .116, -.022)],
      cane: [part(new CylinderGeometry(.018, .021, .73, 8), '#71513e', .035, -.415, .105), bar(.16, .035, -.045, .025, '#493d34'), part(new CylinderGeometry(.027, .027, .035, 8), '#292537', .035, -.795, .105)],
      // E19 story beats: the courier parcel (cardboard, teal Sunset Grove tape), held at the hands.
      parcel: [part(new BoxGeometry(.3, .24, .26), '#b98a55', .245, -.04), part(new BoxGeometry(.31, .045, .08), '#2aa198', .245, .085), part(new BoxGeometry(.12, .006, .09), '#f3efe2', .245, .082, .08)],
      // E22 weapons (code art, held at the right hand): long guns point along the forearm's forward axis, bats and pipes hang along the hand.
      rifle: [part(new BoxGeometry(.07, .09, .95), '#3b3f33', 0, -.02, .38), part(new BoxGeometry(.06, .14, .26), '#2b2d27', 0, -.06, -.1), part(new BoxGeometry(.045, .045, .3), '#1f2120', 0, .02, .75)],
      pistol: [part(new BoxGeometry(.045, .1, .06), '#2d2f33', 0, -.04, 0), part(new BoxGeometry(.05, .06, .2), '#3a3d42', 0, .02, .1)],
      'hunting-rifle': [part(new BoxGeometry(.06, .08, .8), '#7a5535', 0, -.02, .3), part(new BoxGeometry(.04, .045, .5), '#2d2f33', 0, .01, .72), part(new BoxGeometry(.05, .05, .24), '#5f4328', 0, -.05, -.12)],
      pipe: [part(new CylinderGeometry(.028, .028, .85, 8), '#79808a', 0, -.3)],
      bat: [part(new CylinderGeometry(.045, .025, .85, 10), '#b98a55', 0, -.32), part(new CylinderGeometry(.03, .03, .08, 8), '#493d34', 0, .12)],
      crowbar: [part(new CylinderGeometry(.022, .022, .7, 8), '#5b5f66', 0, -.25), part(new BoxGeometry(.06, .06, .16), '#5b5f66', 0, -.62, .06)],
      'watering-can': [part(new CylinderGeometry(.13, .13, .22, 12), '#68a093', .035, -.29), bar(.18, .035, -.045, 0, '#426b60'), ...[-.09, .09].map(z => part(new CylinderGeometry(.01, .01, .14, 8), '#426b60', .035, -.11, z)), part(new CylinderGeometry(.033, .045, .3, 8).rotateZ(-.85), '#68a093', .225, -.22), part(new CylinderGeometry(.065, .025, .05, 10).rotateZ(-.85), '#bec9ba', .335, -.13)],
    };
    for (const [name, parts] of Object.entries(shapes)) {
      const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
      const material = shading?.shaded(attribute('color', 'vec3')) ?? new MeshLambertNodeMaterial({ vertexColors: true });
      const mesh = new InstancedMesh(geometry, material, 128); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
      this.meshes.set(name as CivilianProp, mesh); this.add(mesh);
    }
  }
  begin(): void { this.contacts.length = 0; for (const mesh of this.meshes.values()) mesh.count = 0; }
  held(prop: CivilianProp, matrix: Matrix4, entity: number, hand?: Float32Array): void {
    this.place(prop, matrix);
    if (hand && typeof location !== 'undefined' && new URLSearchParams(location.search).has('test')) {
      const world = new Float32Array(hand.length), point = new Vector3();
      for (let i = 0; i < hand.length; i += 3) point.fromArray(hand, i).applyMatrix4(matrix).toArray(world, i);
      this.contacts.push({ entity, prop, hand: world, geometry: this.meshes.get(prop)!.geometry, matrix: matrix.clone() });
    }
  }
  place(prop: CivilianProp, matrix: Matrix4): void {
    let mesh = this.meshes.get(prop)!;
    if (mesh.count === mesh.instanceMatrix.count) {
      const grown = new InstancedMesh(mesh.geometry, mesh.material, mesh.count * 2);
      grown.instanceMatrix.array.set(mesh.instanceMatrix.array); grown.count = mesh.count;
      grown.frustumCulled = false; grown.castShadow = true;
      this.remove(mesh); mesh.dispose(); this.add(grown); this.meshes.set(prop, grown); mesh = grown;
    }
    mesh.setMatrixAt(mesh.count++, matrix);
  }
  dropped(prop: CivilianProp, at: { x: number; y: number; z: number; yaw: number }): void {
    const mesh = this.meshes.get(prop)!, pose = new Matrix4().makeRotationY(at.yaw).multiply(new Matrix4().makeRotationZ(-Math.PI / 2));
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const floor = new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(pose).min.y;
    pose.setPosition(at.x, at.y - floor + .015, at.z); this.place(prop, pose);
  }
  finish(): void { for (const mesh of this.meshes.values()) if (mesh.count) mesh.instanceMatrix.needsUpdate = true; }
  dispose(): void { for (const mesh of this.meshes.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); } this.clear(); }
}
