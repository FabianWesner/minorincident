import { BoxGeometry, Color, ConeGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, SphereGeometry } from 'three/webgpu';
import { float, mix, positionGeometry, positionWorld, sin, smoothstep, step, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { cure } from '../../levels/L10/district';
import { cureHangar } from '../../data/l10Story';
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

const mistClouds = 22;
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
    const countryside = materials.look.nodes.grass.mul(1.1).mul(float(.88).add(shade.mul(.3)).sub(verge.mul(.12)));
    // r31-epilogue (PO: "could even zoom higher, so the entire level can be overseen"): the journey's places read as
    // separate regions from the air — farm parcels, the fenced restricted zone, the hangar apron, the burned corridor
    // and the dark complex — instead of one olive plain.
    const region = (id: string) => cure.regions.find(r => r.id === id)!.envelope;
    const within = (from: number, to: number): Node<'float'> => smoothstep(from - 25, from + 25, p.x).mul(float(1).sub(smoothstep(to - 25, to + 25, p.x)));
    const [farmA] = region('crash-outskirts'), [, farmB] = region('industrial-area'), [zoneA, zoneB] = region('military-zone');
    const [, corridorB] = region('destroyed-corridor'), [complexA, complexB] = region('dispersal-complex');
    // Descending ramps as 1 - smoothstep (reversed edges are undefined in GLSL).
    const near = (d: Node<'float'>, a: number, b: number): Node<'float'> => float(1).sub(smoothstep(a, b, d));
    const inside = near(p.y.sub(cz).abs(), 200, 260);
    const cropParcel = p.div(vec2(70, 46)), cropCell = cropParcel.floor(), crop = sin(cropCell.dot(vec2(41.3, 289.1))).mul(24634.6).fract();
    const cropEdge = cropParcel.fract().sub(.5).abs(), cropVerge = cropEdge.x.max(cropEdge.y).smoothstep(.44, .49);
    const farm = mix(mix(vec3(.80, .66, .30), vec3(.46, .34, .22), step(.45, crop)), materials.look.nodes.grass.mul(1.25), step(.78, crop)).mul(float(1).sub(cropVerge.mul(.25)));
    const fence = near(p.x.sub(zoneA[0]).abs(), 2, 6).max(near(p.x.sub(zoneB[0]).abs(), 2, 6)).max(near(p.y.sub(cz).abs().sub(220).abs(), 2, 6));
    const restricted = mix(vec3(.55, .54, .45), vec3(.2, .21, .2), fence.mul(within(zoneA[0], zoneB[0])));
    const apron = near(p.sub(vec2(cureHangar.centre.x, cureHangar.centre.z)).length(), 95, 130);
    const corridor = vec3(.36, .33, .28).mul(noise(p.mul(.05)).mul(.3).add(.8));
    const console = cure.anchors['cure-console'], pad = near(p.sub(vec2(console[0], console[1])).length(), 150, 190);
    let level: Node<'vec3'> = countryside;
    level = mix(level, farm, within(farmA[0], farmB[0]).mul(inside));
    level = mix(level, restricted, within(zoneA[0], zoneB[0]).mul(inside));
    level = mix(level, vec3(.74, .72, .66), apron);
    level = mix(level, corridor, within(region('destroyed-corridor')[0][0], corridorB[0]).mul(inside));
    level = mix(level, vec3(.27, .27, .29), within(complexA[0], complexB[0]).mul(inside).max(pad));
    const ground = materials.shaded(level.mul(noise(p.mul(.025)).mul(.12).add(.94)));
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
    const mistMaterial = new MeshBasicNodeMaterial({ color: '#b6f27a', transparent: true, depthWrite: false });
    mistMaterial.opacityNode = positionGeometry.xz.length().smoothstep(.05, .95).oneMinus().pow(1.5).mul(noise(p.mul(.009)).mul(.12).add(.16));
    this.mist = new InstancedMesh(new SphereGeometry(1, 16, 8), mistMaterial, mistClouds); this.mist.name = 'L10-panorama-green-dust'; this.mist.frustumCulled = false;
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
    // The tide follows the route west from the complex: low banks of green dust spread over the whole level.
    for (let i = 0; i < mistClouds; i++) {
      const u = i / (mistClouds - 1), spread = Math.min(radius, 3800) * (.05 + u * .95), cloud = this.mistTransform;
      cloud.position.set(x - spread, 22 + i % 3 * 12, z + Math.sin(i * 2.4) * (60 + i % 5 * 34));
      cloud.scale.set(170 + i % 3 * 80, 20 + i % 4 * 10, 120 + i % 4 * 45); cloud.updateMatrix(); this.mist.setMatrixAt(i, cloud.matrix);
    }
    this.mist.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    for (const mesh of [this.walls, this.roofs, this.forest, this.mist]) mesh.dispose();
    for (const mesh of [this.landscape, this.forest, this.mist]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); }
    this.geometry.dispose(); this.material.dispose();
  }
}
