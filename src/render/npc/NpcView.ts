// World-anchored badges and transient bark messages adapt Bruno InteractivePoints.js/Bubble.js (MIT).
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, Vector3, type Camera, type Object3D, type Material } from 'three/webgpu';
import { AssetRegistry } from '../../assets/registry';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { Materials } from '../Materials';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder, createCorgiPlaceholder } from './placeholders';
import { CivilianCrowd } from './CivilianCrowd';
import { QuadrupedAnimator } from '../characters/QuadrupedAnimator';
import { MotionPresentation } from '../characters/MotionPresentation';
import { MotionPhase } from '../characters/MotionPhase';
import { NpcAnimator } from '../characters/NpcAnimator';
interface Hero { humanAnimator?: NpcAnimator; animator: QuadrupedAnimator | null; root: Group; legs: Object3D[]; head: Object3D | undefined; tail: Object3D | undefined; badge: HTMLElement | null; source: string; moving: boolean; tick: number; x: number; z: number }
/** NPC presentation owns its resources and HUD; sim state is consumed but never modified. */
export class NpcView extends Group {
  private readonly civilians: CivilianCrowd;
  private readonly heroes = new Map<number, Hero>();
  private readonly registry: AssetRegistry;
  private dog!: Group;
  private human!: Group;
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
  constructor(readonly world: SimWorld, readonly materials: Materials) {
    super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.name = 'npcs'; this.civilians = new CivilianCrowd(world, materials); this.add(this.civilians);
    this.cars = new InstancedMesh(new BoxGeometry(4, 1.2, 1.6), materials.unique('survivorRed'), 32); this.cars.count = 0; this.cars.castShadow = this.cars.receiveShadow = true; this.cars.frustumCulled = false; this.add(this.cars);
    this.bark.setAttribute('role', 'status'); this.bark.setAttribute('data-corgi-warning', ''); this.bark.style.cssText = 'position:fixed;display:none;pointer-events:none;color:#ffcd63;background:#292537;border:2px solid #ffcd63;border-radius:14px;padding:8px;font:700 16px system-ui;z-index:7'; document.querySelector('#game')!.appendChild(this.bark);
    this.off = world.events.on('corgi.bark', event => { if (event.type === 'corgi.bark') { this.barkUntil = event.tick + 180; this.threatId = event.threatId; this.bark.dataset.direction = `${event.direction.x},${event.direction.z}`; } });
  }
  setQuality(tier: 'high' | 'low'): void { this.civilians.setQuality(tier); }
  async init(): Promise<void> {
    await this.civilians.init(); const loaded = await this.registry.loadAsset('char.corgi');
    this.dog = loaded.userData.placeholder ? createCorgiPlaceholder() : loaded as Group; this.dogSource = loaded.userData.placeholder ? 'placeholder' : 'glb'; if (loaded.userData.placeholder) this.placeholders.push(this.dog);
    this.human = createCivilianPlaceholder(); this.placeholders.push(this.human);
    for (const root of [this.dog, this.human]) root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      if (root === this.human && !Array.isArray(node.material) && node.material.name === 'keep_veins') node.visible = false;
      const remap = (old: Material) => {
        const color = (old as import('three').MeshBasicMaterial).color ?? new Color('#e5d9b9');
        const material = this.materials.fromColor(`npc:${old.name}:${old.side}`, old.name === 'emi_eyes' ? new Color('#302539') : color); material.side = old.side; material.userData.sharedPalette = true; return material;
      };
      const old = node.material; node.material = Array.isArray(old) ? old.map(remap) : remap(old); if (root === this.human || this.dogSource === 'placeholder') for (const m of Array.isArray(old) ? old : [old]) m.dispose(); node.castShadow = node.receiveShadow = true;
    });
  }
  update(camera: Camera, alpha = 1): void {
    this.civilians.update(alpha, camera); let cars = 0;
    for (const [id, hero] of this.heroes) if (!this.world.entities.get(id)) { this.remove(hero.root); hero.badge?.remove(); this.heroes.delete(id); }
    for (const e of this.world.entities.iterate()) {
      if (e.traffic || e.convoy) { this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(e.transform.x, .6, e.transform.z); this.cars.setMatrixAt(cars++, this.transform); continue; }
      if (!e.companion && !e.escort && !e.civilian?.pet) continue;
      let hero = this.heroes.get(e.id);
      if (!hero) {
        const root = (e.escort ? this.human : this.dog).clone(true); if (e.civilian?.pet) { const pack = root.getObjectByName('packSocket'); if (pack) pack.visible = false; }
        const legs = ['legFL', 'legFR', 'legBL', 'legBR', 'legL', 'legR'].map(name => root.getObjectByName(name)).filter((n): n is Object3D => !!n);
        const badge = e.escort ? document.createElement('div') : null;
        if (badge) { badge.dataset.escortId = String(e.id); badge.style.cssText = 'position:fixed;pointer-events:none;transform:translate(-50%,-100%);background:#292537;color:#fff0cc;border:2px solid #d8bd74;border-radius:50%;padding:5px 9px;font:700 18px system-ui;z-index:6'; document.querySelector('#game')!.appendChild(badge); }
        hero = { humanAnimator: e.escort ? new NpcAnimator(root) : undefined, animator: e.escort ? null : new QuadrupedAnimator(root), root, legs, head: root.getObjectByName('head'), tail: root.getObjectByName('tail'), badge, source: e.escort ? 'placeholder' : this.dogSource, moving: false, tick: -1, x: e.transform.x, z: e.transform.z }; this.heroes.set(e.id, hero); this.add(root);
      }
      if (hero.tick !== this.world.tick) { hero.moving = e.motion?.moving ?? Math.hypot(hero.x - e.transform.x, hero.z - e.transform.z) > .001; hero.x = e.transform.x; hero.z = e.transform.z; hero.tick = this.world.tick; }
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      hero.root.visible = !e.hidden && e.companion?.state !== 'hide'; hero.root.position.set(presented.x, presented.y - (e.escort ? .7 : .3), presented.z); hero.root.rotation.set(0, presented.yaw, 0);
      if (e.escort?.child) hero.root.scale.setScalar(.7);
      const down = e.escort?.state === 'downed' || e.escort?.state === 'dead' || e.civilian?.state === 'down' || e.civilian?.state === 'rising';
      if (down && hero.animator) { hero.root.rotation.z = Math.PI / 2; hero.root.position.y = .25; }
      const motion = e.motion ?? this.motion.sample(e.id, this.world.tick, e.transform.x, e.transform.z);
      const time = Math.max(0, this.world.tick + alpha - 1) / 60, distance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60);
      const warn = e.companion?.warn;
      if (hero.animator) hero.animator.update(time, motion.speed, distance, warn && { stage: warn.stage, toward: this.world.entities.get(warn.threat)?.transform ?? null });
      else hero.humanAnimator!.update(time, motion.speed, distance, down);
      if (hero.badge && e.escort) {
        this.point.set(e.transform.x, e.escort.child ? 1.25 : 1.8, e.transform.z).project(camera);
        hero.badge.style.left = `${(this.point.x + 1) / 2 * innerWidth}px`; hero.badge.style.top = `${(1 - this.point.y) / 2 * innerHeight}px`; hero.badge.style.display = Math.abs(this.point.x) <= 1 && Math.abs(this.point.y) <= 1 ? '' : 'none';
        hero.badge.dataset.order = e.escort.order; hero.badge.dataset.state = e.escort.state; hero.badge.setAttribute('aria-label', `Escort ${e.escort.state}`); hero.badge.textContent = e.escort.state === 'downed' ? '+' : e.escort.state === 'cover' ? '◆' : e.escort.order === 'wait' ? 'Ⅱ' : '↑';
      }
    }
    this.cars.count = cars; if (cars) this.cars.instanceMatrix.needsUpdate = true;
    const threat = this.world.entities.get(this.threatId);
    this.bark.style.display = this.world.tick < this.barkUntil && threat ? '' : 'none';
    if (threat) { this.point.set(threat.transform.x, .7, threat.transform.z).project(camera); const length = Math.hypot(this.point.x, this.point.y) || 1; this.bark.style.left = `${(this.point.x / length * .4 + .5) * innerWidth}px`; this.bark.style.top = `${(.5 - this.point.y / length * .4) * innerHeight}px`; this.bark.textContent = `🐾 ${Math.abs(this.point.x) > Math.abs(this.point.y) ? this.point.x > 0 ? '→' : '←' : this.point.y > 0 ? '↑' : '↓'}`; }
  }
  /** Scene Lab probe: the presented corgi/escort figure of an entity. */
  heroRoot(id: number): Group | undefined { return this.heroes.get(id)?.root; }
  snapshot() { return { civilians: this.civilians.snapshot(), heroes: [...this.heroes].map(([id, h]) => ({ id, source: h.source, clip: h.animator?.clip, position: h.root.position.toArray(), head: h.head?.getWorldPosition(this.point.clone()).toArray() ?? null, nodes: ['root', 'body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR', 'packSocket'].filter(name => !!h.root.getObjectByName(name)) })), cars: this.cars.count }; }
  dispose(): void { this.off(); this.bark.remove(); for (const h of this.heroes.values()) h.badge?.remove(); this.heroes.clear(); this.civilians.dispose(); for (const root of this.placeholders) disposeCharacter(root); this.cars.geometry.dispose(); (this.cars.material as MeshLambertNodeMaterial).dispose(); this.cars.dispose(); void this.registry.dispose(); this.clear(); }
}
