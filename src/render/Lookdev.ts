import { BoxGeometry, CylinderGeometry, Group, Mesh, Object3D, SphereGeometry, ExtrudeGeometry, Shape, type BufferGeometry } from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { infectedPositions } from '../../tests/fixtures/scenarios/lookdev';
import type { PaletteToken } from '../data/palette';
import type { Materials } from './Materials';
import { InstancedGroup } from './InstancedGroup';
import type { Occlusion } from './Occlusion';

/** Code placeholders at palette/gameplay scale. No reference assets or district/AI logic. */
export class Lookdev extends Group {
  readonly player = new Group();
  readonly playerMeshes: Mesh[] = [];
  readonly lampHead = new Object3D();
  readonly shadowProbe = new Object3D();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly instances: InstancedGroup[] = [];
  constructor(private readonly materials: Materials, occlusion: Occlusion, characters = true) {
    super(); this.name = 'lookdev';
    this.box(this, 'grass', [65, 0.2, 65], [0, -0.12, 0]);
    this.box(this, 'asphalt', [7, 0.08, 46], [0, 0, 0]);
    for (const x of [-4.2, 4.2]) this.box(this, 'sidewalk', [1.4, 0.16, 46], [x, 0.02, 0]);
    for (let z = -18; z <= 18; z += 4) this.box(this, 'picketWhite', [0.13, 0.015, 1.2], [0, 0.05, z]);
    this.house(-7, -4, 'schoolBusYellow', occlusion); this.house(8.5, -7, 'brick', occlusion);
    // Fixed sidewalk point beneath the house's cast shadow.
    this.shadowProbe.position.set(-4.5, 0.075, -5.5); this.add(this.shadowProbe);
    if (characters) { this.character(this.player, false); this.player.traverse((c) => { if (c instanceof Mesh) { c.material = materials.unique((c.material as import('./PaletteMaterial').PaletteMaterial).token); this.playerMeshes.push(c); } }); this.add(this.player);
    const infected = new Group(); this.character(infected, true);
    this.batch(infected, infectedPositions.map(([x, z], i) => this.placement(x, 0, z, i * 0.8))); }
    const fence = new Group();
    for (const x of [-0.4, 0.4]) this.box(fence, 'picketWhite', [0.16, 1.0, 0.12], [x, 0.5, 0]);
    for (const y of [0.3, 0.7]) this.box(fence, 'picketWhite', [1, 0.12, 0.14], [0, y, -0.03]);
    this.batch(fence, Array.from({ length: 20 }, (_, i) => this.placement(-5.3, 0, -12 + i * 0.8, Math.PI / 2)));
    const tree = new Group();
    this.cylinder(tree, 'woodWarm', 0.22, 2.2, [0, 1.1, 0]);
    for (const [x, y, z, r] of [[0, 3, 0, 1.4], [-0.9, 2.7, 0.1, 1], [0.8, 3.1, 0.3, 1], [0, 3.6, -0.5, 1]]) this.sphere(tree, 'foliage', r, [x, y, z]);
    this.batch(tree, [[-10, 4], [-12, -9], [7, 4], [12, -1], [-8, 10], [9, 12], [-12, -16], [11, -16]].map(([x, z]) => this.placement(x, 0, z)));
    const bush = new Group(); this.sphere(bush, 'foliage', 0.65, [0, 0.5, 0]);
    this.batch(bush, Array.from({ length: 22 }, (_, i) => this.placement(i < 11 ? -11 : 11.7, 0, -8 + i % 11 * 1.1)));
    const flower = new Group(); this.cylinder(flower, 'foliage', 0.025, 0.2, [0, 0.1, 0]); this.sphere(flower, 'survivorRed', 0.12, [0, 0.22, 0]);
    this.batch(flower, Array.from({ length: 30 }, (_, i) => this.placement(-5.8 - i % 3 * 0.3, 0, 3.5 + Math.floor(i / 3) * 0.22)));
    this.car(4.1, 4.5);
    this.lamp(-4.1, 2.5); this.lamp(4.1, -5.5);
    // A few chunky street props, rather than borrowing authored district assets.
    for (const [x, z] of [[4.6, -1], [-4.8, 5]]) {
      this.box(this, 'backpackTeal', [0.6, 0.85, 0.5], [x, 0.45, z]); this.box(this, 'uiDark', [0.65, 0.1, 0.55], [x, 0.9, z]);
    }
    this.box(this, 'woodWarm', [1.4, 0.15, 0.5], [-4.6, 0.55, 7]);
    for (const x of [-5.1, -4.1]) this.box(this, 'uiDark', [0.12, 0.5, 0.4], [x, 0.25, 7]);
  }
  private placement(x: number, y: number, z: number, yaw = 0): Object3D {
    const p = new Object3D(); p.position.set(x, y, z); p.rotation.y = yaw; return p;
  }
  private batch(prototype: Group, placements: Object3D[]): void { const batch = new InstancedGroup(prototype, placements); this.instances.push(batch); this.add(batch); }
  private mesh(group: Group, token: PaletteToken, geometry: BufferGeometry, position: [number, number, number], emissive = 0, owned = false): Mesh {
    this.geometries.add(geometry);
    const mesh = new Mesh(geometry, owned ? this.materials.unique(token, emissive, true) : this.materials.get(token, emissive));
    mesh.position.fromArray(position); mesh.castShadow = emissive === 0; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  private box(group: Group, token: PaletteToken, size: [number, number, number], position: [number, number, number], owned = false): Mesh {
    return this.mesh(group, token, new RoundedBoxGeometry(...size, 1, Math.min(...size, 0.2) * 0.18), position, 0, owned);
  }
  private sphere(group: Group, token: PaletteToken, radius: number, position: [number, number, number]): Mesh { return this.mesh(group, token, new SphereGeometry(radius, 10, 7), position); }
  private cylinder(group: Group, token: PaletteToken, radius: number, height: number, position: [number, number, number]): Mesh { return this.mesh(group, token, new CylinderGeometry(radius, radius, height, 8), position); }
  private character(group: Group, infected: boolean): void {
    const top = infected ? 'woodWarm' : 'survivorRed';
    for (const z of [-0.16, 0.16]) { this.box(group, 'uiDark', [0.19, 0.38, 0.2], [0, 0.29, z]); this.box(group, top, [0.32, 0.12, 0.22], [0.055, 0.06, z]); }
    this.box(group, top, [0.33, 0.48, 0.57], [0, 0.72, 0]);
    this.sphere(group, 'infectedSkin', 0.22, [0, 1.16, 0]);
    for (const z of [-0.38, 0.38]) { this.box(group, top, [0.2, 0.4, 0.18], [0, 0.7, z]); this.sphere(group, 'infectedSkin', 0.105, [0.06, 0.48, z]); }
    if (!infected) { this.box(group, 'backpackTeal', [0.2, 0.4, 0.38], [-0.26, 0.74, 0]); this.box(group, 'survivorRed', [0.32, 0.06, 0.45], [0, 1.37, 0]); }
    for (const z of [-0.09, 0.09]) this.mesh(group, infected ? 'infectedEye' : 'uiDark', new BoxGeometry(0.05, 0.045, 0.05), [0.207, 1.19, z], infected ? 2 : 0);
  }
  private house(x: number, z: number, token: PaletteToken, occlusion: Occlusion): void {
    const house = new Group(); house.name = `house-${x}`; house.position.set(x, 0, z); this.add(house);
    this.box(house, token, [4.2, 2.8, 4], [0, 1.4, 0], true);
    const profile = new Shape(); profile.moveTo(-2.35, 0); profile.lineTo(0, 1.1); profile.lineTo(2.35, 0); profile.closePath();
    const roof = this.mesh(house, 'brick', new ExtrudeGeometry(profile, { depth: 4.5, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, steps: 1 }), [0, 2.85, -2.25], 0, true);
    roof.userData.roof = true;
    for (const xx of [-1.15, 1.15]) {
      this.box(house, 'picketWhite', [0.9, 1.1, 0.12], [xx, 1.5, 2.05], true);
      this.mesh(house, 'windowGlow', new BoxGeometry(0.7, 0.85, 0.03), [xx, 1.5, 2.13], 1.4, true);
    }
    this.box(house, 'woodWarm', [0.7, 1.65, 0.14], [0, 0.85, 2.1], true);
    this.box(house, 'picketWhite', [1.6, 0.15, 0.9], [0, 0.08, 2.5], true);
    occlusion.register(house);
  }
  private car(x: number, z: number): void {
    const car = new Group(); car.position.set(x, 0, z); this.add(car);
    this.box(car, 'policeBlue', [1.7, 0.6, 3.4], [0, 0.6, 0]); this.box(car, 'policeBlue', [1.45, 0.6, 1.8], [0, 1.13, -0.2]);
    this.box(car, 'backpackTeal', [1.47, 0.38, 1.6], [0, 1.15, -0.2]); this.box(car, 'policeBlue', [1.5, 0.15, 1.8], [0, 1.45, -0.2]);
    for (const xx of [-0.8, 0.8]) for (const zz of [-1.05, 1.05]) { const wheel = this.cylinder(car, 'uiDark', 0.34, 0.22, [xx, 0.34, zz]); wheel.rotation.z = Math.PI / 2; }
  }
  private lamp(x: number, z: number): void {
    this.cylinder(this, 'uiDark', 0.065, 3.2, [x, 1.6, z]); this.box(this, 'uiDark', [0.8, 0.09, 0.1], [x + 0.3, 3.15, z]);
    this.mesh(this, 'windowGlow', new SphereGeometry(0.17, 8, 6), [x + 0.65, 3.1, z], 5);
    this.lampHead.position.set(x + 0.65, 3.1, z); this.add(this.lampHead);
  }
  dispose(): void { for (const batch of this.instances) batch.dispose(); for (const geometry of this.geometries) geometry.dispose(); this.clear(); }
}
