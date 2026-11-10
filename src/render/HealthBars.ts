import { Box3, Frustum, DataTexture, RGBAFormat, type Texture, Group, InstancedMesh, Mesh, SphereGeometry, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Vector3, NoToneMapping, SRGBColorSpace, type PerspectiveCamera } from 'three/webgpu';
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
/** Shielded riot infected, Alphas and the pursuing Mega always keep their bar. */
const mandatoryBar = (e: EntitySnapshot) => !!e.combat?.shield || e.archetype === 'infected.alpha' || !!e.infected?.pursuit || !!e.infected?.arenaBoss?.engaged;
export const isFollower = (e: EntitySnapshot) => (e.civilian?.survivor?.mode === 'follow' || e.civilian?.ally?.follow?.targetId === 1 || e.escort?.order === 'follow') && !e.hidden && !e.infection && !['finished', 'infected'].includes(e.civilian?.state ?? '') && e.health.current > 0 && !e.corpse;
/** Player interactions persist; proximity or damage from another actor alone reveals nothing. */
export function barEligible(e: EntitySnapshot, player: { x: number; z: number }, bar: boolean): boolean {
  if (e.civilian?.survivor?.mode === 'follow' || e.civilian?.ally?.follow?.targetId === 1 || e.escort?.order === 'follow') return isFollower(e);
  return bar && e.faction === 'infected' && !!e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden && !e.corpse &&
    (mandatoryBar(e) || !!e.infected.hitByPlayer || ((e.infected.targetId === 1 || e.infected.heardTargetId === 1 || e.infected.l1?.targetId === 1 || e.infected.specialAttack?.grabbedId === 1) && Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 6));
}
export function barSize(width: number, height: number, mega = false): { width: number; height: number } {
  const phone = Math.min(width, height) <= 480;
  return mega ? { width: phone ? 72 : 96, height: phone ? 8 : 10 } : { width: phone ? 48 : 64, height: phone ? 6 : 8 };
}
/** r26-l8hitreact: an L8 arena boss takes 0.6x outside its exposed windows, so a chip hit barely moves its bar. The lost slice stays
 * as a white "chip" for 0.3 s (at least 3 px wide) beside the fill; render-only, one extra mesh that is hidden when no chip is live. */
export const bossChipHoldTicks = 12, bossChipFadeTicks = 6, bossChipMinPx = 3;
export function bossChip(from: number, current: number, age: number, widthPx: number): number {
  if (age >= bossChipHoldTicks + bossChipFadeTicks || from <= current) return 0;
  const fade = age <= bossChipHoldTicks ? 1 : 1 - (age - bossChipHoldTicks) / bossChipFadeTicks;
  return Math.min(Math.max((from - current) * widthPx * fade, bossChipMinPx * fade), (1 - current) * widthPx);
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
  private readonly chips = new Map<number, { last: number; from: number; at: number }>();
  private readonly megaWeakSpot = new Mesh(new SphereGeometry(.42, 12, 8), new MeshBasicNodeMaterial({ color: 0xff5a2a, toneMapped: false, fog: false, depthTest: false, transparent: true, opacity: .9 }));
  private readonly probing = __QA_HOOKS__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  constructor(private readonly world: SimWorld, private readonly courierBounds?: (out: Box3) => boolean) {
    super(); this.name = 'infected-health-bars'; this.unoccluded.needsUpdate = true;
    this.megaWeakSpot.visible = false; this.megaWeakSpot.renderOrder = 95; this.add(this.megaWeakSpot);
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
    this.enemyMeshes = makeMeshes([healthBarColors.outline, healthBarColors.background, healthBarColors.fill, '#ffffff']);
    this.followerMeshes = makeMeshes([healthBarColors.survivorOutline, healthBarColors.survivorBackground, healthBarColors.survivorFill]);
  }
  update(camera: PerspectiveCamera, width: number, height: number, occluded?: (target: Vector3) => boolean, cityNight = false): void {
    const mega = this.world.scenario === 'L10' ? this.world.megaPursuit?.entity() : null;
    this.megaWeakSpot.visible = !!mega && mega.health.current > 0 && !mega.hidden && !mega.infected?.hidden && !!this.world.missions?.state.states['cure-installed'] && (!!mega.infected?.megaArmourBroken || (mega.infected?.megaWeakTicks ?? 0) > 0 || mega.infected?.megaPhase === 3);
    if (mega && this.megaWeakSpot.visible) { const p = mega.transform; this.megaWeakSpot.position.set(p.x - Math.cos(p.yaw) * .55, p.y + 1.05, p.z + Math.sin(p.yaw) * .55); this.megaWeakSpot.scale.setScalar(.9 + .15 * Math.sin(this.world.tick / 6)); }
    this.outlineGain.value = cityNight ? nightHealthBarGains.outline : 1;
    this.fillGain.value = cityNight ? nightHealthBarGains.fill : 1;
    if (__QA_HOOKS__) this.probes.length = 0;
    for (const layer of [...this.enemyMeshes, ...this.followerMeshes]) layer.count = 0;
    if (this.world.l7Departure?.cinematic || this.world.storyLock || this.world.missions?.state.cinematic || this.world.missions?.state.epilogue) return;
    const player = this.world.entities.get(1); if (!player) return;
    // PO 2026-11-09: "show a health bar for 'my' police officers" — the L3 squad uses the follower bars.
    const squad = new Set(this.world.missions?.state.l3?.squadIds ?? []);
    const ally = (e: EntitySnapshot) => isFollower(e) || (squad.has(e.id) && e.health.current > 0 && !e.hidden && !e.corpse && !e.infection);
    let followerCount = 0;
    for (const e of this.world.entities.iterate()) if (ally(e)) followerCount++;
    const compactFollowers = followerCount > followerBarsAlwaysMax;
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
    for (const e of this.world.entities.iterate()) {
      if (!(squad.has(e.id) ? ally(e) : barEligible(e, player.transform, this.definitions.get(e.archetype)?.bar === true))) continue;
      // Riot/Alpha/Mega bars remain mandatory (L4-11/G-24, E32), including healthy threats.
      if (!pickBodies.bounds(e.id, this.bounds)) continue;
      const follower = ally(e), evacuee = follower && this.world.scenario === 'L7';
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
      let chipPx = 0;
      if (e.infected?.arenaBoss && !follower) {
        const chip = this.chips.get(e.id) ?? { last: fraction, from: fraction, at: -Infinity };
        if (fraction < chip.last - 1e-6) { chip.from = this.world.tick - chip.at < bossChipHoldTicks + bossChipFadeTicks ? Math.max(chip.from, chip.last) : chip.last; chip.at = this.world.tick; }
        chip.last = fraction; this.chips.set(e.id, chip);
        chipPx = bossChip(chip.from, fraction, this.world.tick - chip.at, displaySize.width);
      }
      for (const i of indices) {
        const index = layers[i].count;
        const w = i === 0 ? displaySize.width + 2 : i === 1 ? displaySize.width : displaySize.width * fraction;
        const h = i === 0 ? displaySize.height + 2 : displaySize.height;
        this.point.copy(this.center);
        if (i === 2) this.point.addScaledVector(this.direction.setFromMatrixColumn(camera.matrixWorld, 0), (fraction - 1) * displaySize.width / 2 * unit);
        this.barMatrix.compose(this.point, camera.quaternion, this.barScale.set(w * unit, h * unit, 1));
        layers[i].setMatrixAt(index, this.barMatrix); layers[i].count++;
      }
      if (chipPx > 0) {
        const index = this.enemyMeshes[3].count;
        this.point.copy(this.center).addScaledVector(this.direction.setFromMatrixColumn(camera.matrixWorld, 0), (displaySize.width * fraction - displaySize.width / 2 + chipPx / 2) * unit);
        this.barMatrix.compose(this.point, camera.quaternion, this.barScale.set(chipPx * unit, displaySize.height * unit, 1));
        this.enemyMeshes[3].setMatrixAt(index, this.barMatrix); this.enemyMeshes[3].count++;
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
  dispose(): void { for (const layer of [...this.enemyMeshes, ...this.followerMeshes]) { layer.geometry.dispose(); (layer.material as MeshBasicNodeMaterial).dispose(); } this.megaWeakSpot.geometry.dispose(); this.megaWeakSpot.material.dispose(); this.unoccluded.dispose(); this.clear(); }
}
