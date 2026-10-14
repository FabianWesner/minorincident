import { dogCoat } from '../../data/dogAppearance';
import type { CrowdAccessories } from '../characters/CrowdAccessories';
// World-anchored badges and transient bark messages adapt Bruno InteractivePoints.js/Bubble.js (MIT).
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, Vector3, type Camera, type Object3D, type Material } from 'three/webgpu';
import { batchRigidParts } from '../characters/batchRigidParts';
import { AssetRegistry } from '../../assets/registry';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { Materials } from '../Materials';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder, createCorgiPlaceholder } from './placeholders';
import { restoreStanding } from './prepareCivilianGeometry';
import { CivilianCrowd } from './CivilianCrowd';
import { QuadrupedAnimator } from '../characters/QuadrupedAnimator';
import { MotionPresentation } from '../characters/MotionPresentation';
import { MotionPhase } from '../characters/MotionPhase';
import { NpcAnimator } from '../characters/NpcAnimator';
import { civilianHeight, fitCivilianHeight } from './figureHeight';
import { attribute, style, text } from '../../ui/dom';
interface Hero { model: string; humanAnimator?: NpcAnimator; animator: QuadrupedAnimator | null; root: Group; legs: Object3D[]; head: Object3D | undefined; tail: Object3D | undefined; badge: HTMLElement | null; source: string; moving: boolean; tick: number; x: number; z: number }
/** NPC presentation owns its resources and HUD; sim state is consumed but never modified. */
export class NpcView extends Group {
  private readonly civilians: CivilianCrowd;
  private readonly heroes = new Map<number, Hero>();
  private readonly registry: AssetRegistry;
  private dog!: Group;
  private readonly pets = new Map<string, Group>();
  private readonly petLoads = new Map<string, Promise<void>>();
  private readonly humans = new Map<string, Group>();
  private readonly humanLoads = new Map<string, Promise<void>>();
  private child!: Group;
  private dogSource = 'placeholder';
  private readonly placeholders: Group[] = [];
  private readonly cars: InstancedMesh;
  private readonly transform = new Matrix4();
  private readonly presentation = new MotionPresentation();
  private readonly motion = new MotionPhase();
  private readonly point = new Vector3();
  private readonly bark = document.createElement('div');
  private barkUntil = -1;
  private threatId = -1;
  private readonly off: () => void;
  constructor(readonly world: SimWorld, readonly materials: Materials, accessories?: CrowdAccessories) {
    super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.name = 'npcs'; this.civilians = new CivilianCrowd(world, materials, accessories); this.add(this.civilians);
    this.cars = new InstancedMesh(new BoxGeometry(4, 1.2, 1.6), materials.unique('survivorRed'), 32); this.cars.count = 0; this.cars.castShadow = this.cars.receiveShadow = true; this.cars.frustumCulled = false; this.add(this.cars);
    this.bark.setAttribute('role', 'status'); this.bark.setAttribute('data-corgi-warning', ''); this.bark.style.cssText = 'position:fixed;display:none;pointer-events:none;color:#ffcd63;background:#292537;border:2px solid #ffcd63;border-radius:14px;padding:8px;font:700 16px system-ui;z-index:7'; document.querySelector('#game')!.appendChild(this.bark);
    this.off = world.events.on('corgi.bark', event => { if (event.type === 'corgi.bark') { this.barkUntil = event.tick + 180; this.threatId = event.threatId; this.bark.dataset.direction = `${event.direction.x},${event.direction.z}`; } });
  }
  setQuality(tier: 'high' | 'low'): void { this.civilians.setQuality(tier); }
  /** Wait for civilian batches and attached escort skins to finish streaming. */
  ready(): Promise<void> { return Promise.all([this.civilians.ready(), ...this.humanLoads.values(), ...this.petLoads.values()]).then(() => {}); }
  /** A hiding/late-arriving corgi still needs its rigid material programs warmed
   * before it first becomes visible. Clones share the actual hero geometry and
   * materials, without adding a simulated companion or changing its state. */
  prewarmCorgi(at: Vector3): () => void {
    const root = this.dog.clone(true);
    root.position.copy(at);
    this.add(root);
    return () => root.removeFromParent();
  }
  async init(): Promise<void> {
    await this.civilians.init(); const loaded = await this.registry.loadAsset('char.corgi', 'lod1');
    this.dog = loaded.userData.placeholder ? createCorgiPlaceholder() : loaded as Group; this.dogSource = loaded.userData.placeholder ? 'placeholder' : 'glb'; if (loaded.userData.placeholder) this.placeholders.push(this.dog);
    await Promise.all([...new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.pet === 'dog' ? [e.civilian.model ?? 'amb.dog'] : []))].map(model => this.loadPet(model)));
    await this.loadHuman('npc.civilian-man-a');
    this.child = await this.registry.loadAsset('npc.brother', 'lod1') as Group;
    fitCivilianHeight(this.child, 'npc.brother');
    this.child.traverse(node => { if (node instanceof Mesh) node.castShadow = node.receiveShadow = true; });
    this.dog.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const remap = (old: Material) => {
        const color = (old as import('three').MeshBasicMaterial).color ?? new Color('#e5d9b9');
        const material = this.materials.fromColor(`npc:${old.name}:${old.side}`, old.name === 'emi_eyes' ? new Color('#302539') : color); material.movingFigure.value = 1; material.side = old.side; material.userData.sharedPalette = true; return material;
      };
      const old = node.material; node.material = Array.isArray(old) ? old.map(remap) : remap(old); if (this.dogSource === 'placeholder') for (const m of Array.isArray(old) ? old : [old]) m.dispose(); node.castShadow = node.receiveShadow = true;
    });
    if (this.world.scenario === 'L7') {
      const material = this.materials.fromVertexColors('npc:l7-corgi'); material.movingFigure.value = 1; material.userData.sharedPalette = true;
      const def = this.registry.definition('char.corgi');
      batchRigidParts(this.dog, [...def.requiredNodes, ...def.animatedNodes, ...def.sockets], material, source => (source as import('three').MeshBasicMaterial).color);
    }
  }
  private loadPet(model: string): Promise<void> {
    let pending = this.petLoads.get(model);
    if (!pending) {
      pending = this.registry.loadAsset('amb.dog', 'lod1', dogCoat(model)).then(root => {
        root.traverse(node => { if (node instanceof Mesh) node.castShadow = node.receiveShadow = true; });
        this.pets.set(model, root as Group);
      });
      this.petLoads.set(model, pending);
    }
    return pending;
  }
  private loadHuman(model: string): Promise<void> {
    let pending = this.humanLoads.get(model);
    if (!pending) {
      pending = this.registry.loadAsset(model, 'lod1').then(loaded => {
        const root = loaded.userData.placeholder ? createCivilianPlaceholder() : loaded as Group;
        if (loaded.userData.placeholder) { root.userData.placeholder = true; this.placeholders.push(root); }
        else restoreStanding(root);
        fitCivilianHeight(root, model);
        root.traverse(node => {
          if (!(node instanceof Mesh)) return;
          if (!Array.isArray(node.material) && node.material.name === 'keep_veins') node.visible = false;
          if (loaded.userData.placeholder) {
            const remap = (old: Material) => {
              const color = (old as import('three').MeshBasicMaterial).color ?? new Color('#e5d9b9');
              const material = this.materials.fromColor(`npc:${old.name}:${old.side}`, old.name === 'emi_eyes' ? new Color('#302539') : color);
              material.movingFigure.value = 1; material.side = old.side; material.userData.sharedPalette = true; old.dispose(); return material;
            };
            node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material);
          }
          node.castShadow = node.receiveShadow = true;
        });
        this.humans.set(model, root);
      });
      this.humanLoads.set(model, pending);
    }
    return pending;
  }
  update(camera: Camera, alpha = 1, lodCamera = camera): void {
    this.civilians.update(alpha, camera, lodCamera); let cars = 0;
    for (const [id, hero] of this.heroes) if (!this.world.entities.get(id)) { this.remove(hero.root); hero.humanAnimator?.dispose(); hero.badge?.remove(); this.heroes.delete(id); }
    for (const e of this.world.entities.iterate()) {
      if (e.traffic || e.convoy) { this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(e.transform.x, .6, e.transform.z); this.cars.setMatrixAt(cars++, this.transform); continue; }
      if (!e.companion && !e.escort && !e.civilian?.pet) continue;
      const model = e.civilian?.pet === 'dog' ? e.civilian.model ?? 'amb.dog' : e.escort ? e.escort.child ? 'npc.brother' : e.appearance?.asset ?? e.civilian?.model ?? (e.archetype.startsWith('npc.') && e.archetype !== 'npc.escort' ? e.archetype : 'npc.civilian-man-a') : 'char.corgi';
      if (e.escort && !e.escort.child && !this.humans.has(model)) void this.loadHuman(model);
      if (e.civilian?.pet === 'dog' && !this.pets.has(model)) { this.loadPet(model); continue; }
      const prototype = e.civilian?.pet === 'dog' ? this.pets.get(model)! : e.escort ? e.escort.child ? this.child : this.humans.get(model) ?? this.humans.get('npc.civilian-man-a')! : this.dog;
      const drawnModel = e.civilian?.pet === 'dog' ? model : prototype.userData.assetId ?? model;
      let hero = this.heroes.get(e.id);
      if (hero && hero.model !== drawnModel) { this.remove(hero.root); hero.humanAnimator?.dispose(); hero.badge?.remove(); this.heroes.delete(e.id); hero = undefined; }
      if (!hero) {
        const root = prototype.clone(true); if (e.civilian?.pet) { const pack = root.getObjectByName('packSocket'); if (pack) pack.visible = false; }
        const legs = ['legFL', 'legFR', 'legBL', 'legBR', 'legL', 'legR'].map(name => root.getObjectByName(name)).filter((n): n is Object3D => !!n);
        const badge = e.escort ? document.createElement('div') : null;
        if (badge) { badge.dataset.escortId = String(e.id); badge.style.cssText = 'position:fixed;pointer-events:none;transform:translate(-50%,-100%);background:#292537;color:#fff0cc;border:2px solid #d8bd74;border-radius:50%;padding:5px 9px;font:700 18px system-ui;z-index:6'; document.querySelector('#game')!.appendChild(badge); }
        hero = { model: drawnModel, humanAnimator: e.escort ? new NpcAnimator(root) : undefined, animator: e.escort ? null : new QuadrupedAnimator(root), root, legs, head: root.getObjectByName('head'), tail: root.getObjectByName('tail'), badge, source: e.escort || e.civilian?.pet === 'dog' ? prototype.userData.placeholder ? 'placeholder' : 'glb' : this.dogSource, moving: false, tick: -1, x: e.transform.x, z: e.transform.z }; this.heroes.set(e.id, hero); this.add(root);
      }
      if (hero.tick !== this.world.tick) { hero.moving = e.motion?.moving ?? Math.hypot(hero.x - e.transform.x, hero.z - e.transform.z) > .001; hero.x = e.transform.x; hero.z = e.transform.z; hero.tick = this.world.tick; }
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      hero.root.visible = !e.hidden && e.companion?.state !== 'hide'; hero.root.position.set(presented.x, presented.y - (e.escort || e.civilian?.pet === 'dog' ? .7 : .3), presented.z); hero.root.rotation.set(0, presented.yaw, 0);
      const down = e.escort?.state === 'downed' || e.escort?.state === 'dead' || this.world.tick < (e.escort?.knockedUntil ?? 0) || e.civilian?.state === 'down' || e.civilian?.state === 'rising';
      if (down && hero.animator) { hero.root.rotation.z = Math.PI / 2; hero.root.position.y = .25; }
      const motion = e.motion ?? this.motion.sample(e.id, this.world.tick, e.transform.x, e.transform.z);
      const time = Math.max(0, this.world.tick + alpha - 1) / 60, distance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60);
      const warn = e.companion?.warn;
      if (hero.animator) hero.animator.update(time, motion.speed, distance, warn && { stage: warn.stage, toward: this.world.entities.get(warn.threat)?.transform ?? null });
      else hero.humanAnimator!.update(time, motion.speed, distance, down);
      if (hero.badge && e.escort) {
        this.point.set(e.transform.x, hero.root.position.y + civilianHeight(hero.model) + .15, e.transform.z).project(camera);
        style(hero.badge, 'left', `${(this.point.x + 1) / 2 * innerWidth}px`); style(hero.badge, 'top', `${(1 - this.point.y) / 2 * innerHeight}px`); style(hero.badge, 'display', Math.abs(this.point.x) <= 1 && Math.abs(this.point.y) <= 1 ? '' : 'none');
        attribute(hero.badge, 'data-order', e.escort.order); attribute(hero.badge, 'data-state', e.escort.state); attribute(hero.badge, 'aria-label', `Escort ${e.escort.state}`); text(hero.badge, e.escort.state === 'downed' ? '+' : e.escort.state === 'cover' ? '◆' : e.escort.order === 'wait' ? 'Ⅱ' : '↑');
      }
    }
    this.cars.count = cars; if (cars) this.cars.instanceMatrix.needsUpdate = true;
    const threat = this.world.entities.get(this.threatId);
    style(this.bark, 'display', this.world.tick < this.barkUntil && threat ? '' : 'none');
    if (threat) { this.point.set(threat.transform.x, .7, threat.transform.z).project(camera); const length = Math.hypot(this.point.x, this.point.y) || 1; style(this.bark, 'left', `${(this.point.x / length * .4 + .5) * innerWidth}px`); style(this.bark, 'top', `${(.5 - this.point.y / length * .4) * innerHeight}px`); text(this.bark, `🐾 ${Math.abs(this.point.x) > Math.abs(this.point.y) ? this.point.x > 0 ? '→' : '←' : this.point.y > 0 ? '↑' : '↓'}`); }
  }
  /** Scene Lab probe: the presented corgi/escort figure of an entity. */
  heroRoot(id: number): Group | undefined { return this.heroes.get(id)?.root; }
  /** Scene Lab probe: the corgi animator's current clip. */
  heroClip(id: number): string | undefined { return this.heroes.get(id)?.animator?.clip; }
  gunMeshes() { return this.civilians.gunMeshes(); }
  heldProps() { return this.civilians.heldProps(); }
  drawnCorpses() { return this.civilians.drawnCorpses(); }
  shotMuzzle(id: number, direction: { x: number; y?: number; z: number }) { return this.civilians.shotMuzzle(id,direction); }
  muzzle(id: number) { return this.civilians.muzzle(id); }
  spout(id: number) { return this.civilians.spout(id); }
  snapshot() { return { civilians: this.civilians.snapshot(), heroes: [...this.heroes].map(([id, h]) => ({ id, source: h.source, clip: h.animator?.clip ?? h.humanAnimator?.currentClip, model: h.model, position: h.root.position.toArray(), head: h.head?.getWorldPosition(this.point.clone()).toArray() ?? null, nodes: ['root', 'body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR', 'packSocket'].filter(name => !!h.root.getObjectByName(name)), facing: this.facing(h) })), cars: this.cars.count }; }
  /** Rendered body facing on the ground (radians, sim yaw convention): tail -> head in world space, so any model or animation flip shows up. */
  private facing(h: Hero): number | null {
    if (!h.head || !h.tail) return null;
    h.root.updateWorldMatrix(true, true); const head = h.head.getWorldPosition(new Vector3()), tail = h.tail.getWorldPosition(new Vector3());
    return -Math.atan2(head.z - tail.z, head.x - tail.x);
  }
  dispose(): void { this.off(); this.bark.remove(); for (const h of this.heroes.values()) { h.humanAnimator?.dispose(); h.badge?.remove(); } this.heroes.clear(); this.civilians.dispose(); for (const root of this.placeholders) disposeCharacter(root); this.cars.geometry.dispose(); (this.cars.material as MeshLambertNodeMaterial).dispose(); this.cars.dispose(); void this.registry.dispose(); this.clear(); }
}
