import { BoxGeometry, Color, Group, InstancedMesh, MeshBasicNodeMaterial, Object3D } from 'three/webgpu';
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
  constructor(world: DistrictWorld) {
    super(); this.name = 'L10-panorama-buildings'; this.visible = false;
    const placements = world.districts.flatMap(d => d.decay.placements.filter(p => worldAssets[p.assetId]?.category === 'building' && !overviewLandmarks.has(p.assetId)).map(p => ({ p, origin: d.origin })));
    this.walls = new InstancedMesh(this.geometry, this.material, placements.length);
    this.roofs = new InstancedMesh(this.geometry, this.material, placements.length);
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
    this.add(this.walls, this.roofs);
  }
  dispose(): void { this.walls.dispose(); this.roofs.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
