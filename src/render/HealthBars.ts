import { Box3, DataTexture, RGBAFormat, type Texture, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Vector3, NoToneMapping, SRGBColorSpace, type PerspectiveCamera } from 'three/webgpu';
import { color as colorNode, vec4, renderOutput, uniform, texture, viewportUV, Fn, Discard } from 'three/tsl';
import { Ray, ShapeType, type Collider } from '@dimforge/rapier3d-compat';
import { infectedDefinitions } from '../data/infected';
import { healthBarColors, healthFraction, nightHealthBarGains } from '../ui/health';
import type { EntitySnapshot } from '../sim/world/types';
import type { SimWorld } from '../sim/world/SimWorld';
import { pickBodies } from './characters/PickBodies';

export function barEligible(e: EntitySnapshot, player: { x: number; z: number }, bar: boolean): boolean {
  if (e.civilian?.survivor?.mode === 'follow') return !e.hidden && !e.infection && !['finished', 'infected'].includes(e.civilian.state) && e.health.current > 0 && !e.corpse;
  return bar && e.faction === 'infected' && !!e.infected && !e.hidden && !e.infected.hidden && !e.corpse &&
    !(e.infected.state === 'dead' && e.infected.recoverAt < 0) &&
    (e.health.current < e.health.max || Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 15);
}
export function barSize(width: number, height: number, mega = false): { width: number; height: number } {
  const phone = Math.min(width, height) <= 480;
  return mega ? { width: phone ? 72 : 96, height: phone ? 8 : 10 } : { width: phone ? 48 : 64, height: phone ? 6 : 8 };
}

/** Three pooled billboard meshes, independent of population and quality tier.
 * HP is read every presentation frame; nothing here writes simulation state. */
export class HealthBars extends Group {
  private readonly meshes: InstancedMesh[];
  private readonly unoccluded = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  private readonly courierMask = texture(this.unoccluded);
  private readonly outlineGain = uniform(1);
  private readonly fillGain = uniform(1);
  private readonly bounds = new Box3();
  private readonly screenBounds = new Box3();
  private readonly projection = new Matrix4();
  private readonly point = new Vector3();
  private readonly center = new Vector3();
  private readonly barScale = new Vector3();
  private readonly barMatrix = new Matrix4();
  private readonly direction = new Vector3();
  private readonly ray = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  private readonly solidCollider = (c: Collider) => !c.isSensor() && c.shapeType() === ShapeType.Cuboid;
  private readonly definitions = new Map(infectedDefinitions.map(def => [def.id, { ...def }]));
  private readonly probes: { id: number; fraction: number; x: number; y: number; width: number; height: number; gap: number; anchor: number[] }[] = [];
  private readonly probing = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  constructor(private readonly world: SimWorld) {
    super(); this.name = 'infected-health-bars'; this.unoccluded.needsUpdate = true;
    this.meshes = [healthBarColors.outline, healthBarColors.background, healthBarColors.fill].map((color, i) => {
      const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, toneMapped: false, fog: false });
      // Convert each bar fragment directly; a full-screen output transform would overwrite the game image.
      material.fragmentNode = Fn(() => {
        // The foreground courier also occludes world bars behind her face/body.
        Discard(this.courierMask.sample(viewportUV).a.lessThan(.5));
        return renderOutput(vec4(colorNode(color).mul(i === 0 ? this.outlineGain : i === 2 ? this.fillGain : 1), 1), NoToneMapping, SRGBColorSpace);
      })();
      const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, 350);
      mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 100 + i; this.add(mesh); return mesh;
    });
  }
  update(camera: PerspectiveCamera, width: number, height: number, occluded?: (target: Vector3) => boolean, cityNight = false): void {
    this.outlineGain.value = cityNight ? nightHealthBarGains.outline : 1;
    this.fillGain.value = cityNight ? nightHealthBarGains.fill : 1;
    this.probes.length = 0;
    for (const layer of this.meshes) layer.count = 0;
    const player = this.world.entities.get(1); if (!player) return;
    for (const e of this.world.entities.iterate()) {
      if (!barEligible(e, player.transform, this.definitions.get(e.archetype)?.bar === true) || !pickBodies.bounds(e.id, this.bounds)) continue;
      // E32-AC09: the Mega's bar is larger; regular Alphas retain their E07 size and shared pool.
      const size = barSize(width, height, !!e.infected?.pursuit);
      // Use the actual displayed bounds, including pose blending and interpolated movement.
      this.bounds.getCenter(this.center);
      this.point.copy(this.center).project(camera);
      if (this.point.z < -1 || this.point.z > 1 || Math.abs(this.point.x) > 1 || Math.abs(this.point.y) > 1) continue;
      this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      pickBodies.bounds(e.id, this.screenBounds, this.projection);
      const top = (1 - this.screenBounds.max.y) * height / 2;
      let x = (this.point.x + 1) * width / 2, y = top - 2 - (size.height + 4) / 2;
      // A close Mega can extend above the frame while its body is visible. Keep its shared billboard readable.
      if (e.infected?.pursuit) {
        x = Math.max(size.width / 2 + 2, Math.min(width - size.width / 2 - 2, x));
        y = Math.max(size.height / 2 + 2, Math.min(height - size.height / 2 - 2, y));
      }
      if (x - size.width / 2 - 2 < 0 || x + size.width / 2 + 2 > width || y - size.height / 2 - 2 < 0 || y + size.height / 2 + 2 > height) continue;
      this.direction.subVectors(this.center, camera.position);
      const distance = this.direction.length(); this.direction.normalize();
      Object.assign(this.ray.origin, camera.position); Object.assign(this.ray.dir, this.direction);
      const physics = this.world.physics.world;
      // Cuboids include solid buildings, doors, vehicles and displaced props; ignore actor capsules and sensors.
      if (physics?.castRay(this.ray, Math.max(0, distance - .01), true, undefined, undefined, undefined, undefined, this.solidCollider)) continue;
      if (occluded?.(this.center)) continue;
      this.center.copy(this.point);
      this.center.y = 1 - y / height * 2;
      this.center.unproject(camera);
      const depth = -this.point.copy(this.center).applyMatrix4(camera.matrixWorldInverse).z;
      const unit = 2 * depth / camera.projectionMatrix.elements[5] / height;
      const fraction = healthFraction(e.health.current, e.health.max), index = this.meshes[0].count;
      for (let i = 0; i < this.meshes.length; i++) {
        const w = i === 0 ? size.width + 4 : i === 1 ? size.width : size.width * fraction;
        const h = i === 0 ? size.height + 4 : size.height;
        this.point.copy(this.center);
        if (i === 2) this.point.addScaledVector(this.direction.setFromMatrixColumn(camera.matrixWorld, 0), (fraction - 1) * size.width / 2 * unit);
        this.barMatrix.compose(this.point, camera.quaternion, this.barScale.set(w * unit, h * unit, 1));
        this.meshes[i].setMatrixAt(index, this.barMatrix); this.meshes[i].count++;
      }
      if (this.probing) this.probes.push({ id: e.id, fraction, x, y, width: size.width, height: size.height, gap: 2, anchor: this.center.toArray() });
    }
    for (const layer of this.meshes) { layer.visible = layer.count > 0; if (layer.count) layer.instanceMatrix.needsUpdate = true; }
  }
  setCourierMask(mask?: Texture): void { this.courierMask.value = mask ?? this.unoccluded; }
  get count(): number { return this.meshes[0].count; }
  snapshot() { return { count: this.meshes[0].count, draws: this.meshes[0].count ? 3 : 0, bars: this.probes }; }
  dispose(): void { for (const layer of this.meshes) { layer.geometry.dispose(); (layer.material as MeshBasicNodeMaterial).dispose(); } this.unoccluded.dispose(); this.clear(); }
}
