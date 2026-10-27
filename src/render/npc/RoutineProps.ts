import { Box3, BoxGeometry, BufferAttribute, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshLambertNodeMaterial, Vector3, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute } from 'three/tsl';
import type { AssetRegistry } from '../../assets/registry';
import { longGunHolds } from '../characters/GunAim';
import type { Materials } from '../Materials';
import { crowdWeaponAssets, crowdWeaponGeometry, isCrowdGun, type CrowdGun } from './crowdWeapons';
import type { CivilianProp } from '../../sim/npc/types';

/** Mug body centre in the upright right-hand frame (+X forward, +Y up, +Z the figure's right): inboard of the hand. */
export const cupSocket: [number, number, number] = [.035, -.11, -.125];
/** Small shared rigid accessories follow the same baked hand matrix as the GPU civilian. */
export class RoutineProps extends Group {
  readonly contacts: { entity: number; prop: CivilianProp; hand: Float32Array; geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  /** Authored barrel endpoints in prop-local metres (+Z). */
  readonly guns: { entity: number; geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  readonly muzzles = new Map<number, Vector3>();
  /** World position of a tilted watering can's spout while its holder pours (kept between frames; removed when the pour ends). */
  readonly spouts = new Map<number, Vector3>();
  readonly aiming = new Map<number, { until: number; direction: { x: number; y?: number; z: number } }>();
  private readonly weaponMuzzles = new Map<CrowdGun, Vector3>();
  private readonly meshes = new Map<CivilianProp | 'hmg', InstancedMesh>();
  private readonly gripMatrix = new Matrix4();
  private readonly droppedMatrix = new Matrix4();
  private readonly droppedTilt = new Matrix4().makeRotationZ(-Math.PI / 2);
  private readonly droppedBounds = new Box3();
  private readonly point = new Vector3();
  private readonly contactPool: RoutineProps['contacts'] = [];
  private readonly gunPool: (RoutineProps['guns'][number] & { muzzle: Vector3 })[] = [];
  private readonly probeHands = __QA_HOOKS__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  constructor(private readonly shading?: Materials) {
    super(); this.name = 'morning-props';
    const part = (geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
      geometry.translate(x, y, z); const rgb = new Color(color), count = geometry.getAttribute('position').count;
      const values = new Float32Array(count * 3); for (let i = 0; i < count; i++) values.set(rgb.toArray(), i * 3);
      geometry.setAttribute('color', new BufferAttribute(values, 3)); return geometry;
    };
    const bar = (length: number, x: number, y: number, z: number, color: string) => part(new CylinderGeometry(.01, .01, length, 8).rotateX(Math.PI / 2), color, x, y, z);
    // PO 10-15 'The way how the person holds the cup is still wrong': the mug body sits inboard of the right hand (-Z, towards the
    // chest) and the handle loop outboard, so the fingers pass through the handle. It was mirrored (body 12.5 cm outboard, loop
    // towards the chest), which forced the chest hold to pull the hand behind the mug: the hand vanished and the handle faced away.
    const handle = (color: string) => [bar(.13, .035, -.045, 0, color), bar(.13, .035, -.17, 0, color), part(new CylinderGeometry(.01, .01, .125, 8), color, .035, -.1075, .065)];
    const shapes: Record<CivilianProp, BufferGeometry[]> = {
      coffee: [part(new CylinderGeometry(.07, .055, .16, 12), '#f5e6c7', ...cupSocket), part(new CylinderGeometry(.065, .065, .012, 12), '#563c2c', cupSocket[0], -.024, cupSocket[2]), ...handle('#f5e6c7')],
      bag: [part(new BoxGeometry(.26, .34, .18), '#ba8c53', .035, -.32), bar(.16, .035, -.045, 0, '#6e5537'), ...[-.08, .08].map(z => part(new CylinderGeometry(.01, .01, .11, 8), '#6e5537', .035, -.1, z)), part(new CylinderGeometry(.028, .035, .23, 8), '#76a14e', .1, -.21)],
      phone: [part(new BoxGeometry(.018, .12, .065), '#292537', .079, -.03), part(new BoxGeometry(.004, .085, .05), '#75b8cf', .09, -.022)],
      cane: [part(new CylinderGeometry(.018, .021, .73, 8), '#71513e', .035, -.415, .105), bar(.16, .035, -.045, .025, '#493d34'), part(new CylinderGeometry(.027, .027, .035, 8), '#292537', .035, -.795, .105)],
      // E19 story beats: the courier parcel (cardboard, teal Sunset Grove tape), held at the hands.
      parcel: [part(new BoxGeometry(.3, .24, .26), '#b98a55', .035, -.32), part(new BoxGeometry(.31, .045, .08), '#2aa198', .035, -.195), part(new BoxGeometry(.12, .006, .09), '#f3efe2', .035, -.198, .08), bar(.16, .035, -.045, 0, '#2aa198'), ...[-.08, .08].map(z => part(new CylinderGeometry(.01, .01, .16, 8), '#2aa198', .035, -.125, z))],
      // E22 weapons (code art, held at the right hand): long guns point along the forearm's forward axis, bats and pipes hang along the hand.
      rifle: [], pistol: [], shotgun: [], 'hunting-rifle': [],
      pipe: [part(new CylinderGeometry(.028, .028, .85, 8), '#79808a', 0, -.3)],
      bat: [part(new CylinderGeometry(.045, .025, .85, 10), '#b98a55', 0, -.32), part(new CylinderGeometry(.03, .03, .08, 8), '#493d34', 0, .12)],
      crowbar: [part(new CylinderGeometry(.022, .022, .7, 8), '#5b5f66', 0, -.25), part(new BoxGeometry(.06, .06, .16), '#5b5f66', 0, -.62, .06)],
      'watering-can': [part(new CylinderGeometry(.13, .13, .22, 12), '#68a093', .035, -.29), bar(.18, .035, -.045, 0, '#426b60'), ...[-.09, .09].map(z => part(new CylinderGeometry(.01, .01, .14, 8), '#426b60', .035, -.11, z)), part(new CylinderGeometry(.033, .045, .3, 8).rotateZ(-.85), '#68a093', .225, -.22), part(new CylinderGeometry(.065, .025, .05, 10).rotateZ(-.85), '#bec9ba', .335, -.13)],
    };
    for (const [name, parts] of Object.entries(shapes)) {
      if (!parts.length) continue;
      const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); geometry.computeBoundingBox();
      const material = shading?.shaded(attribute('color', 'vec3')) ?? new MeshLambertNodeMaterial({ vertexColors: true });
      const mesh = new InstancedMesh(geometry, material, 128); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
      this.meshes.set(name as CivilianProp, mesh); this.add(mesh);
    }
  }
  /** Shared registry and one owned vertex-colour batch per authored weapon. */
  async init(registry: Pick<AssetRegistry, 'loadAsset'>): Promise<void> {
    for (const [prop, id] of Object.entries(crowdWeaponAssets)) {
      const root = await registry.loadAsset(id, 'lod1');
      const { geometry, muzzle } = crowdWeaponGeometry(root, longGunHolds[id]?.scale ?? .8);
      const material = this.shading?.shaded(attribute('color', 'vec3')) ?? new MeshLambertNodeMaterial({ vertexColors: true });
      const mesh = new InstancedMesh(geometry, material, 128); mesh.name = id; mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
      this.meshes.set(prop as CrowdGun, mesh); this.weaponMuzzles.set(prop as CrowdGun, muzzle); this.add(mesh);
    }
  }
  begin(): void { this.contacts.length = 0; this.guns.length = 0; this.muzzles.clear(); for (const mesh of this.meshes.values()) mesh.count = 0; }
  held(prop: CivilianProp, matrix: Matrix4, entity: number, hand?: Float32Array, reach = .07, machineGun = false): void {
    const key = machineGun ? 'hmg' : prop;
    this.gripMatrix.makeTranslation(prop === 'phone' ? reach - .07 : 0, 0, 0).premultiply(matrix);
    this.place(key, this.gripMatrix);
    const muzzle = isCrowdGun(key) ? this.weaponMuzzles.get(key) : undefined;
    if (muzzle) {
      const gun = this.gunPool[this.guns.length] ??= { entity, geometry: this.meshes.get(key)!.geometry, matrix: new Matrix4(), muzzle: new Vector3() };
      gun.entity = entity; gun.geometry = this.meshes.get(key)!.geometry; gun.matrix.copy(this.gripMatrix);
      gun.muzzle.copy(muzzle).applyMatrix4(this.gripMatrix);
      this.muzzles.set(entity, gun.muzzle); this.guns.push(gun);
    }
    if (__QA_HOOKS__ && hand && this.probeHands) {
      const contact = this.contactPool[this.contacts.length] ??= { entity, prop, hand: new Float32Array(hand.length), geometry: this.meshes.get(key)!.geometry, matrix: new Matrix4() };
      if (contact.hand.length !== hand.length) contact.hand = new Float32Array(hand.length);
      for (let i = 0; i < hand.length; i += 3) this.point.fromArray(hand, i).applyMatrix4(matrix).toArray(contact.hand, i);
      contact.entity = entity; contact.prop = prop; contact.geometry = this.meshes.get(key)!.geometry; contact.matrix.copy(this.gripMatrix);
      this.contacts.push(contact);
    }
  }
  place(prop: CivilianProp | 'hmg', matrix: Matrix4): void {
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
    const mesh = this.meshes.get(prop)!, pose = this.droppedMatrix.makeRotationY(at.yaw).multiply(this.droppedTilt);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const floor = this.droppedBounds.copy(mesh.geometry.boundingBox!).applyMatrix4(pose).min.y;
    pose.setPosition(at.x, at.y - floor + .015, at.z); this.place(prop, pose);
  }
  finish(): void { for (const mesh of this.meshes.values()) if (mesh.count) mesh.instanceMatrix.needsUpdate = true; }
  dispose(): void { for (const mesh of this.meshes.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); } this.clear(); }
}
