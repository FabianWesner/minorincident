import { Box3, Frustum, DataTexture, RGBAFormat, type Texture, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Vector3, NoToneMapping, SRGBColorSpace, type PerspectiveCamera } from 'three/webgpu';
import { color as colorNode, vec4, renderOutput, uniform, texture, viewportUV, Fn, Discard } from 'three/tsl';
import { Ray, ShapeType, type Collider } from '@dimforge/rapier3d-compat';
import { infectedDefinitions } from '../data/infected';
import { healthBarColors, healthFraction, nightHealthBarGains } from '../ui/health';
import type { EntitySnapshot } from '../sim/world/types';
import type { SimWorld } from '../sim/world/SimWorld';
import { pickBodies } from './characters/PickBodies';

/** PO #26: all five L5 followers keep a full bar; larger groups keep a compact health pip for every follower. */
export const followerBarsAlwaysMax = 5;
export const followerBarCap = Infinity;
/** L10's close melee can put a dozen infected in one screen column. Keep its bars legible. */
export const l10InfectedBarCap = 5;
/** L4 breach crowds put a wall of red bars over the courier at close zoom. Keep the nearest threats useful and legible.
 * vqa-3 #4: L3's retreat grew a 25-142 bar slab over her; the same cap now applies on every level except L10 (own cap). */
export const l4InfectedBarCap = 6;
export const infectedBarCap = l4InfectedBarCap;
/** Shielded riot infected, Alphas and the pursuing Mega always keep their bar under the cap. */
const mandatoryBar = (e: EntitySnapshot) => !!e.combat?.shield || e.archetype === 'infected.alpha' || !!e.infected?.pursuit;
export const isFollower = (e: EntitySnapshot) => e.civilian?.survivor?.mode === 'follow' && !e.hidden && !e.infection && !['finished', 'infected'].includes(e.civilian?.state ?? '') && e.health.current > 0 && !e.corpse;
/** `fullFollowers`: the group is small enough that healthy followers keep their bar too. */
export function barEligible(e: EntitySnapshot, player: { x: number; z: number }, bar: boolean, fullFollowers = true): boolean {
  if (e.civilian?.survivor?.mode === 'follow') return isFollower(e) && (fullFollowers || e.health.current < e.health.max);
  return bar && e.faction === 'infected' && !!e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden && !e.corpse &&
    (e.health.current < e.health.max || mandatoryBar(e) || Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 15);
}
export function barSize(width: number, height: number, mega = false): { width: number; height: number } {
  const phone = Math.min(width, height) <= 480;
  return mega ? { width: phone ? 72 : 96, height: phone ? 8 : 10 } : { width: phone ? 48 : 64, height: phone ? 6 : 8 };
}
export const followerPipSize = { width: 18, height: 3 } as const;

/** Six pooled billboard meshes, independent of population and quality tier.
 * HP is read every presentation frame; nothing here writes simulation state. */
export class HealthBars extends Group {
  private readonly enemyMeshes: InstancedMesh[];
  private readonly followerMeshes: InstancedMesh[];
  private readonly unoccluded = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  private readonly courierMask = texture(this.unoccluded);
  private readonly outlineGain = uniform(1);
  private readonly fillGain = uniform(1);
  private readonly bounds = new Box3();
  private readonly projection = new Matrix4();
  private readonly frustum = new Frustum();
  private readonly point = new Vector3();
  private readonly center = new Vector3();
  private readonly barScale = new Vector3();
  private readonly barMatrix = new Matrix4();
  private readonly direction = new Vector3();
  private readonly screenPoint = new Vector3();
  private readonly heroBounds = new Box3();
  private readonly heroScreen = { left: 0, top: 0, right: 0, bottom: 0 };
  private readonly ray = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  private readonly solidCollider = (c: Collider) => !c.isSensor() && c.shapeType() === ShapeType.Cuboid;
  private readonly definitions = new Map(infectedDefinitions.map(def => [def.id, { ...def }]));
  private readonly probes: { id: number; fraction: number; x: number; y: number; width: number; height: number; gap: number; anchor: number[] }[] = [];
  private readonly l10Bars: { id: number; distance: number }[] = [];
  private readonly l10BarIds = new Set<number>();
  private readonly l4BarIds = new Set<number>();
  private readonly probing = __QA_HOOKS__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  constructor(private readonly world: SimWorld, private readonly courierBounds?: (out: Box3) => boolean) {
    super(); this.name = 'infected-health-bars'; this.unoccluded.needsUpdate = true;
    const makeMeshes = (colors: readonly string[]) => colors.map((color, i) => {
      const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, toneMapped: false, fog: false });
      // Convert each bar fragment directly; a full-screen output transform would overwrite the game image.
      material.fragmentNode = Fn(() => {
        // The foreground courier also occludes world bars behind her face/body.
        Discard(this.courierMask.sample(viewportUV).a.lessThan(.5));
        return renderOutput(vec4(colorNode(color).mul(i === 0 ? this.outlineGain : i === 2 ? this.fillGain : 1), 1), NoToneMapping, SRGBColorSpace);
      })();
      const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, 400);
      mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 100 + i; this.add(mesh); return mesh;
    });
    this.enemyMeshes = makeMeshes([healthBarColors.outline, healthBarColors.background, healthBarColors.fill]);
    this.followerMeshes = makeMeshes([healthBarColors.survivorOutline, healthBarColors.survivorBackground, healthBarColors.survivorFill]);
  }
  update(camera: PerspectiveCamera, width: number, height: number, occluded?: (target: Vector3) => boolean, cityNight = false): void {
    this.outlineGain.value = cityNight ? nightHealthBarGains.outline : 1;
    this.fillGain.value = cityNight ? nightHealthBarGains.fill : 1;
    if (__QA_HOOKS__) this.probes.length = 0;
    for (const layer of [...this.enemyMeshes, ...this.followerMeshes]) layer.count = 0;
    const player = this.world.entities.get(1); if (!player) return;
    let followerCount = 0;
    for (const e of this.world.entities.iterate()) if (isFollower(e)) followerCount++;
    const compactFollowers = followerCount > followerBarsAlwaysMax;
    const full = true;
    const l10 = this.world.scenario === 'L10';
    this.l10Bars.length = 0;
    this.l10BarIds.clear();
    if (l10) {
      for (const e of this.world.entities.iterate()) {
        if (e.faction !== 'infected' || !e.infected || !barEligible(e, player.transform, this.definitions.get(e.archetype)?.bar === true, full)) continue;
        this.l10Bars.push({ id: e.id, distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) });
      }
      // Keep the nearest threats. This also bounds bars when several close
      // melee groups overlap on screen.
      this.l10Bars.sort((a, b) => a.distance - b.distance || a.id - b.id);
      this.l10Bars.length = Math.min(this.l10Bars.length, l10InfectedBarCap);
      for (const target of this.l10Bars) this.l10BarIds.add(target.id);
    }
    this.l4BarIds.clear();
    const capped = !l10;
    if (capped) {
      this.l10Bars.length = 0;
      let mandatory = 0;
      for (const e of this.world.entities.iterate()) {
        if (e.faction !== 'infected' || !e.infected || !barEligible(e, player.transform, this.definitions.get(e.archetype)?.bar === true, full)) continue;
        if (mandatoryBar(e)) { mandatory++; continue; }
        this.l10Bars.push({ id: e.id, distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) });
      }
      this.l10Bars.sort((a, b) => a.distance - b.distance || a.id - b.id);
      this.l10Bars.length = Math.min(this.l10Bars.length, Math.max(0, infectedBarCap - mandatory));
      for (const target of this.l10Bars) this.l4BarIds.add(target.id);
    }
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    this.heroScreen.left = Infinity; this.heroScreen.top = Infinity; this.heroScreen.right = -Infinity; this.heroScreen.bottom = -Infinity;
    if (this.courierBounds?.(this.heroBounds) ?? !!pickBodies.bounds(player.id, this.heroBounds)) {
      for (const x of [this.heroBounds.min.x, this.heroBounds.max.x]) for (const y of [this.heroBounds.min.y, this.heroBounds.max.y]) for (const z of [this.heroBounds.min.z, this.heroBounds.max.z]) {
        this.screenPoint.set(x, y, z).project(camera);
        const sx = (this.screenPoint.x + 1) * width / 2, sy = (1 - this.screenPoint.y) * height / 2;
        this.heroScreen.left = Math.min(this.heroScreen.left, sx); this.heroScreen.right = Math.max(this.heroScreen.right, sx);
        this.heroScreen.top = Math.min(this.heroScreen.top, sy); this.heroScreen.bottom = Math.max(this.heroScreen.bottom, sy);
      }
    }
    // l5-finale: behind the closing Metro shutter the group is safe; their bars floated over the kiosk roof into the handover.
    const sheltered = !!this.world.missions?.state.l5?.shutterAt;
    for (const e of this.world.entities.iterate()) {
      if (sheltered && e.civilian?.survivor) continue;
      if (!barEligible(e, player.transform, this.definitions.get(e.archetype)?.bar === true, full)) continue;
      if (l10 && e.faction === 'infected' && !this.l10BarIds.has(e.id)) continue;
      // Riot/Alpha/Mega bars remain mandatory (L4-11/G-24, E32), including healthy threats.
      if (capped && e.faction === 'infected' && !mandatoryBar(e) && !this.l4BarIds.has(e.id)) continue;
      if (!pickBodies.bounds(e.id, this.bounds)) continue;
      const follower = isFollower(e), evacuee = follower && this.world.scenario === 'L7';
      // E32-AC09: the Mega's bar is larger; regular Alphas retain their E07 size and shared pool.
      const size = barSize(width, height, !!e.infected?.pursuit);
      // Use the actual displayed bounds, including pose blending and interpolated movement.
      this.bounds.getCenter(this.center);
      this.point.copy(this.center).project(camera);
      if ((this.point.z < -1 || this.point.z > 1 || Math.abs(this.point.x) > 1 || Math.abs(this.point.y) > 1) &&
          !(evacuee && this.frustum.intersectsBox(this.bounds))) continue;
      const projectedTop = pickBodies.top(e.id, this.projection);
      if (projectedTop === null) continue;
      const top = (1 - projectedTop) * height / 2;
      let x = (this.point.x + 1) * width / 2, y = top - 2 - (size.height + 4) / 2;
      const pip = follower && compactFollowers;
      const displaySize = pip ? followerPipSize : size;
      if (pip) y = top - 2 - displaySize.height / 2;
      // A visible body can extend above the frame at close zoom. Keep its
      // health UI inside the viewport, including the five L5 follower bars.
      if (e.faction === 'infected' || follower) {
        x = Math.max(displaySize.width / 2 + 2, Math.min(width - displaySize.width / 2 - 2, x));
        y = Math.max(displaySize.height / 2 + 2, Math.min(height - displaySize.height / 2 - 2, y));
      }
      // Preserve every enemy bar, but move bars crossing the courier's body
      // above her silhouette. Dense hordes previously painted red bars over it.
      if ((follower || e.faction === 'infected') && x + displaySize.width / 2 >= this.heroScreen.left - 2 && x - displaySize.width / 2 <= this.heroScreen.right + 2 && y + displaySize.height / 2 >= this.heroScreen.top - 2 && y - displaySize.height / 2 <= this.heroScreen.bottom + 2) {
        if (pip && !evacuee) continue;
        y = this.heroScreen.top - 4 - displaySize.height / 2;
      }
      if (x - displaySize.width / 2 - (pip ? 0 : 2) < 0 || x + displaySize.width / 2 + (pip ? 0 : 2) > width || y - displaySize.height / 2 < 0 || y + displaySize.height / 2 > height) continue;
      // A lamp, café table or hydrant can cover the torso while the head is
      // plainly visible. Occlude the head-anchored UI only when its top is hidden.
      this.center.y = Math.max(this.center.y, this.bounds.max.y - .05);
      this.direction.subVectors(this.center, camera.position);
      const distance = this.direction.length(); this.direction.normalize();
      Object.assign(this.ray.origin, camera.position); Object.assign(this.ray.dir, this.direction);
      const physics = this.world.physics.world;
      // Cuboids include solid buildings, doors, vehicles and displaced props; ignore actor capsules and sensors.
      // The known L7 escort keeps its individual health UI through fence/wall
      // reveals. A static head ray otherwise erases bars above visible bodies.
      if (!evacuee && physics?.castRay(this.ray, Math.max(0, distance - .01), true, undefined, undefined, undefined, undefined, this.solidCollider)) continue;
      if (!evacuee && occluded?.(this.center)) continue;
      this.center.copy(this.point);
      this.center.x = x / width * 2 - 1;
      this.center.y = 1 - y / height * 2;
      this.center.unproject(camera);
      const depth = -this.point.copy(this.center).applyMatrix4(camera.matrixWorldInverse).z;
      const unit = 2 * depth / camera.projectionMatrix.elements[5] / height;
      const fraction = healthFraction(e.health.current, e.health.max), layers = follower ? this.followerMeshes : this.enemyMeshes;
      const indices = pip ? [1, 2] : [0, 1, 2];
      for (const i of indices) {
        const index = layers[i].count;
        const w = i === 0 ? displaySize.width + 2 : i === 1 ? displaySize.width : displaySize.width * fraction;
        const h = i === 0 ? displaySize.height + 2 : displaySize.height;
        this.point.copy(this.center);
        if (i === 2) this.point.addScaledVector(this.direction.setFromMatrixColumn(camera.matrixWorld, 0), (fraction - 1) * displaySize.width / 2 * unit);
        this.barMatrix.compose(this.point, camera.quaternion, this.barScale.set(w * unit, h * unit, 1));
        layers[i].setMatrixAt(index, this.barMatrix); layers[i].count++;
      }
      if (__QA_HOOKS__ && this.probing) this.probes.push({ id: e.id, fraction, x, y, width: displaySize.width, height: displaySize.height, gap: pip ? 0 : 2, anchor: this.center.toArray() });
    }
    for (const layer of [...this.enemyMeshes, ...this.followerMeshes]) {
      layer.visible = layer.count > 0;
      if (layer.count) { layer.instanceMatrix.clearUpdateRanges(); layer.instanceMatrix.addUpdateRange(0, layer.count * 16); layer.instanceMatrix.needsUpdate = true; }
    }
  }
  setCourierMask(mask?: Texture): void { this.courierMask.value = mask ?? this.unoccluded; }
  get count(): number { return this.enemyMeshes[0].count + this.followerMeshes[1].count; }
  snapshot() { return { count: this.probes.length || this.count, draws: [...this.enemyMeshes, ...this.followerMeshes].filter(mesh => mesh.count).length, bars: this.probes }; }
  dispose(): void { for (const layer of [...this.enemyMeshes, ...this.followerMeshes]) { layer.geometry.dispose(); (layer.material as MeshBasicNodeMaterial).dispose(); } this.unoccluded.dispose(); this.clear(); }
}
