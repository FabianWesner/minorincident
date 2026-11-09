import { BoxGeometry, Color, ConeGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, SphereGeometry } from 'three/webgpu';
import { float, positionGeometry, positionWorld, sin, vec2 } from 'three/tsl';
import { Rng } from '../../core/Rng';
import { noise } from '../SurfaceDetail';
import type { Materials } from '../Materials';
import { worldAssets } from '../../assets/worldDefinitions';
import { palette, type PaletteToken } from '../../data/palette';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';

/** Keep the distinctive finale/campus/farm silhouettes; other buildings use the two-draw map LOD. */
export const overviewLandmarks = new Set([
  'bld.farm-barn-ruin', 'bld.farm-house-ruin', 'bld.cure-motor-shelter', 'bld.cure-lab-main', 'bld.cure-lab-annex',
  'kit.dispersal-turbine-hall', 'kit.dispersal-filtration-tower', 'kit.dispersal-tank-bullet', 'kit.dispersal-tank-sphere', 'kit.dispersal-platform',
]);

/** Whole-level building footprints at subpixel detail, prepared once with the district. */
export class LevelTenOverview extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly material = new MeshBasicNodeMaterial({ color: 0xffffff });
  private readonly walls: InstancedMesh;
  private readonly roofs: InstancedMesh;
  private readonly landscape: Mesh;
  private readonly forest: InstancedMesh;
  private readonly mist: InstancedMesh;
  private readonly mistTransform = new Object3D();
  constructor(world: DistrictWorld, materials: Materials) {
    super(); this.name = 'L10-panorama'; this.visible = false;
    const placements = world.districts.flatMap(d => d.decay.placements.filter(p => worldAssets[p.assetId]?.category === 'building' && !overviewLandmarks.has(p.assetId)).map(p => ({ p, origin: d.origin })));
    this.walls = new InstancedMesh(this.geometry, this.material, placements.length);
    this.roofs = new InstancedMesh(this.geometry, this.material, placements.length);
    const bounds = world.nav, cx = (bounds.min[0] + bounds.max[0]) / 2, cz = (bounds.min[1] + bounds.max[1]) / 2;
    // Two scenery draws: continuous soil with dry field parcels, and clustered woodland.
    // The plane extends past the camera far range, so no slab edge can meet the sky.
    const p = positionWorld.xz, parcel = p.div(vec2(180, 120)), cell = parcel.floor();
    const shade = sin(cell.dot(vec2(127.1, 311.7))).mul(43758.5453).fract();
    const parcelEdge = parcel.fract().sub(.5).abs(), verge = parcelEdge.x.max(parcelEdge.y).smoothstep(.46, .49);
    const ground = materials.shaded(materials.look.nodes.grass.mul(1.1).mul(float(.88).add(shade.mul(.3)).sub(verge.mul(.12))).mul(noise(p.mul(.025)).mul(.12).add(.94)));
    this.landscape = new Mesh(new PlaneGeometry(100000, 100000), ground);
    this.landscape.rotation.x = -Math.PI / 2; this.landscape.position.set(cx, -.04, cz);
    this.landscape.name = 'L10-panorama-dry-landscape';
    const trees: Object3D[] = [], colors: Color[] = [], rng = new Rng(18, 'L10-panorama-woods');
    for (let x = bounds.min[0] - 2600; x <= bounds.max[0] + 2600; x += 45) for (let z = bounds.min[1] - 2600; z <= bounds.max[1] + 2600; z += 45) {
      if (x > bounds.min[0] - 55 && x < bounds.max[0] + 55 && z > bounds.min[1] - 55 && z < bounds.max[1] + 55) continue;
      const cluster = Math.sin(x * .002 + Math.sin(z * .003) * 2) + Math.cos(z * .004 + x * .001);
      if (cluster < .2 || rng.next() < .12) continue;
      const tree = new Object3D(), height = 35 + rng.next() * 35;
      tree.position.set(x + rng.next() * 30, height / 2, z + rng.next() * 30);
      tree.scale.set(20 + rng.next() * 14, height, 20 + rng.next() * 14); tree.rotation.y = rng.next() * Math.PI; tree.updateMatrix();
      trees.push(tree); colors.push(new Color('#403c32').lerp(new Color('#746b50'), rng.next() * .55));
    }
    const canopy = new MeshBasicNodeMaterial({ color: '#8c9578' });
    this.forest = new InstancedMesh(new ConeGeometry(1, 1, 6), canopy, trees.length); this.forest.name = 'L10-panorama-woodland';
    trees.forEach((tree, i) => { this.forest.setMatrixAt(i, tree.matrix); this.forest.setColorAt(i, colors[i]); });
    // Soft ellipsoids retain a readable cloud silhouette at kilometre heights.
    const mistMaterial = new MeshBasicNodeMaterial({ color: '#a9da72', transparent: true, depthWrite: false });
    mistMaterial.opacityNode = positionGeometry.xz.length().smoothstep(.05, .95).oneMinus().pow(1.5).mul(noise(p.mul(.009)).mul(.09).add(.08));
    this.mist = new InstancedMesh(new SphereGeometry(1, 16, 8), mistMaterial, 8); this.mist.name = 'L10-panorama-green-dust'; this.mist.frustumCulled = false;
    const transform = new Object3D(), color = new Color();
    for (const [i, { p, origin }] of placements.entries()) {
      const asset = worldAssets[p.assetId], size = asset.dimensions;
      const width = size.x * p.scale[0], height = size.y * p.scale[1], depth = size.z * p.scale[2];
      transform.position.set(p.position[0] + origin[0], p.position[1] + height * .4, p.position[2] + origin[1]);
      transform.rotation.y = p.yaw; transform.scale.set(width, height * .8, depth); transform.updateMatrix();
      this.walls.setMatrixAt(i, transform.matrix);
      color.set(palette[(asset.world?.token ?? 'sidewalk') as PaletteToken]); this.walls.setColorAt(i, color);
      transform.position.y = p.position[1] + height * .9; transform.scale.set(width, height * .2, depth); transform.updateMatrix();
      this.roofs.setMatrixAt(i, transform.matrix); this.roofs.setColorAt(i, color.multiplyScalar(.72));
    }
    this.add(this.landscape, this.forest, this.walls, this.roofs, this.mist);
  }
  setCureTide(x: number, z: number, radius: number): void {
    for (let i = 0; i < 8; i++) {
      const spread = Math.min(radius, 4200) * (.15 + i / 9 * .8), cloud = this.mistTransform;
      cloud.position.set(x - spread, 35 + i % 3 * 18, z + Math.sin(i * 2.4) * (100 + i * 14));
      cloud.scale.set(180 + i % 3 * 90, 28 + i % 4 * 14, 130 + i % 4 * 40); cloud.updateMatrix(); this.mist.setMatrixAt(i, cloud.matrix);
    }
    this.mist.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    for (const mesh of [this.walls, this.roofs, this.forest, this.mist]) mesh.dispose();
    for (const mesh of [this.landscape, this.forest, this.mist]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); }
    this.geometry.dispose(); this.material.dispose();
  }
}
