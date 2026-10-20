import { gunCarryElevation, gunHoldOffset, longGunHolds, mountedGunHold } from './characters/GunAim';
import { meleeChains } from '../data/meleeCombos';
import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, RingGeometry, SphereGeometry, Vector3, type Object3D, type WebGPURenderer, type Material } from 'three/webgpu';
import { actionIconUrl } from '../assets/icons';
import { catalog, action } from '../data/actions/catalog';
import { l4 } from '../data/l4';
import { AssetRegistry, type PlaceholderLog } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import type { CharacterView } from './characters/CharacterView';
import type { Side } from '../data/actions/schema';
import type { PaletteMaterial } from './PaletteMaterial';

interface LoadedActionAsset { model: Object3D; source: 'glb' | 'placeholder'; reason: string | null }
const sides = ['LEFT', 'RIGHT'] as const;
const restTilt = 0.9;
const holsters = { back: { rot: [0, 0, 2.2] as const, pos: [-0.14, 0.02, 0] as const }, hip: { rot: [0, 0, -0.3] as const, pos: [0.02, -0.05, 0.2] as const } };

/** Selected-side telegraph; fixed geometry buffers and reusable projectile meshes.
 * The ribbon update is adapted from Bruno Trails.js (MIT): reuse positions, update in place.
 * Gameplay sockets/VFX/SFX hooks come from ActionDef and combat events, never render state. */
export class ActionView extends Group {
  private readonly registry: AssetRegistry;
  private readonly placeholders: PlaceholderLog[] = [];
  private readonly prototypes = new Group();
  private readonly assets = new Map<string, LoadedActionAsset>();
  private readonly heldMaterials = new Map<Material, Material>();
  private readonly bloodMaterials: PaletteMaterial[] = [];
  private readonly held: Partial<Record<Side, { id: string; model: Object3D; holder: Group; tilt: number }>> = {};
  private readonly pickups = new Map<number, Object3D>();
  /** Same drawn paving height field used by vehicles; sim support height is the fallback. */
  ground: ((x: number, z: number) => number | null) | null = null;
  private readonly pickupRingGeometry = new RingGeometry(.58, .63, 48).rotateX(-Math.PI / 2);
  private readonly pickupRingMaterial = new MeshBasicNodeMaterial({ color: '#ffd166', transparent: true, opacity: .9, depthWrite: false, side: DoubleSide });
  private readonly geometry = new BufferGeometry();
  private readonly positions = new Float32Array(256 * 18);
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffd166', depthWrite: false, side: DoubleSide });
  private readonly indicator = new Mesh(this.geometry, this.material);
  private readonly projectileGeometry = new SphereGeometry(0.1, 8, 6);
  private readonly projectileMaterial = new MeshBasicNodeMaterial({ color: '#ffb849' });
  private readonly projectiles: Mesh[] = [];
  private readonly socketPosition = new Vector3();
  private readonly handPosition = new Vector3();
  private readonly gripPosition = new Vector3();
  private readonly trailGeometry = new BufferGeometry();
  private readonly trailPositions = new Float32Array(16 * 18);
  private readonly trailMaterial = new MeshBasicNodeMaterial({ color: '#fff0ba', transparent: true, opacity: .75, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  private readonly trail = new Mesh(this.trailGeometry, this.trailMaterial);
  /** Roundhouse ribbon state: unwrapped bat-tip heading around the courier, sampled every frame. */
  private readonly arc = { id: -1, start: 0, angle: 0, raw: 0, inner: .5, outer: 1.2, y: .9, until: -1 };
  private readonly trailHistory = Array.from({ length: 16 }, () => ({ tick: -Infinity, tip: new Vector3(), grip: new Vector3() }));
  private trailCursor = 0;
  private trailTick = -1;
  private trailAttack = -1;
  private trailVertices = 0;
  private offset = 0;
  private maxHeight = 0;
  private targetMarkerId: number | null = null;
  private cue: { origin: number[]; range: number; opacity: number } | null = null;
  private gunUntil = -1;
  private gunId = '';
  private gunSide: Side = 'LEFT';
  private readyTick = -1;
  private readonly gunDirection = { x: 1, z: 0 };
  private carryYaw = 0;
  private raiseId = -1;
  private raiseYaw = 0;
  /** Shot-time presentation intent (sim events can arrive between rendered frames). */
  aimGun(direction: { x: number; z: number }): void {
    this.gunSide = this.world.combat!.runner.loadout.state.selectedSide;
    this.gunId = this.world.combat!.runner.loadout.current(this.gunSide).id;
    Object.assign(this.gunDirection, direction); this.gunUntil = this.world.tick + 24;
  }
  muzzle(out: Vector3): Vector3 | null {
    const held = this.held[this.world.combat?.runner.loadout.state.selectedSide ?? this.selected];
    const muzzle = held?.model.getObjectByName('muzzle');
    if (!muzzle || !held?.holder.visible) return null;
    muzzle.updateWorldMatrix(true, false); return muzzle.getWorldPosition(out);
  }
  private selected: Side = 'LEFT';
  private shape = 'cone';
  /** PO 10-12: the yellow/cyan melee sector on the ground is not wanted in normal play; debug (?debug) or ?aimcone=1 brings it back. */
  showCone = false;
  private landing = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld, private readonly character: CharacterView, private readonly materials: Materials, renderer: WebGPURenderer) {
    super(); this.prototypes.visible = false; this.add(this.prototypes); this.registry = new AssetRegistry((event) => this.placeholders.push(event), { renderer, materials });
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3)); this.geometry.setDrawRange(0, 0); this.indicator.frustumCulled = false; this.indicator.renderOrder = 2; this.add(this.indicator);
    this.trailGeometry.setAttribute('position', new BufferAttribute(this.trailPositions, 3)); this.trailGeometry.setDrawRange(0, 0); this.trail.frustumCulled = false; this.trail.renderOrder = 3; this.add(this.trail);
    for (let i = 0; i < 32; i++) { const mesh = new Mesh(this.projectileGeometry, this.projectileMaterial); mesh.visible = false; this.projectiles.push(mesh); this.add(mesh); }
  }
  private readonly loading = new Map<string, Promise<void>>();
  /** Loads the carried actions, pickups on the ground and the L1 essentials in parallel; every other
   * weapon model loads on first equip/pickup instead of competing with the start. */
  async init(): Promise<void> {
    const loadout = this.world.combat?.runner.loadout, needed = new Set(['weapon.fists', 'weapon.kick', 'weapon.bat']);
    if (loadout) for (const side of sides) for (const slot of loadout.state[side].rack) needed.add(slot.id);
    for (const entity of this.world.entities.iterate()) if (entity.pickup && 'actionId' in entity.pickup) needed.add(entity.pickup.actionId);
    // perf-w6: the L4 quartermaster issues the machine gun on the alarm tick (no pickup entity). Loading it on first
    // equip compiled its six held materials inside the alarm frame (92 ms render at low/4x CPU).
    if (this.world.missions?.l4) needed.add(l4.machineGun.id);
    const defs = Object.values(catalog);
    await Promise.all(defs.filter(def => needed.has(def.id)).map(def => this.load(def)));
  }
  /** Loading warm-up: a held-material clone of every loaded weapon not drawn now (rack weapons not in hand, issued guns)
   * at `at`, so their courier-fill materials compile behind the loading card instead of on the first equip. */
  prewarmHeld(at: Vector3): () => void {
    const group = new Group(); group.position.copy(at);
    for (const asset of this.assets.values()) {
      const clone = asset.model.clone(true);
      clone.traverse(node => { if (node instanceof Mesh) node.material = Array.isArray(node.material) ? node.material.map(m => this.heldMaterials.get(m) ?? m) : this.heldMaterials.get(node.material) ?? node.material; });
      group.add(clone);
    }
    if (!group.children.length) return () => {};
    this.add(group); group.updateMatrixWorld(true);
    return () => group.removeFromParent();
  }
  private load(def: (typeof catalog)[string]): Promise<void> {
    if (this.registry.definition(def.viewAssetId).nonModel) return Promise.resolve();
    let pending = this.loading.get(def.viewAssetId);
    if (!pending) { pending = this.registry.loadAsset(def.viewAssetId).then(model => this.register(def, model)); this.loading.set(def.viewAssetId, pending); }
    return pending;
  }
  /** Model for an action, or null while it is still streaming in (the load is started on demand). */
  private model(def: (typeof catalog)[string]): Object3D | null {
    if (this.registry.definition(def.viewAssetId).nonModel) return null;
    const asset = this.assets.get(def.viewAssetId); if (asset) return asset.model;
    void this.load(def); return null;
  }
  private register(def: (typeof catalog)[string], model: Object3D): void {
    if (this.assets.has(def.viewAssetId)) return;
    {
      model.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const remap = (source: Material): Material => {
          const material = this.materials.fromColor(`action:${def.viewAssetId}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          const heldMaterial = this.materials.fromColor(`action-held:${def.viewAssetId}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          heldMaterial.movingFigure.value = 1; heldMaterial.heroFigure.value = 1;
          heldMaterial.userData.sharedPalette = true;
          this.heldMaterials.set(material, heldMaterial);
          if (!this.bloodMaterials.includes(heldMaterial)) this.bloodMaterials.push(heldMaterial);
          material.userData.sharedPalette = true;
          if (!this.bloodMaterials.includes(material)) this.bloodMaterials.push(material);
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material); node.castShadow = node.receiveShadow = true;
      });
      const grip = model.getObjectByName('grip')!; model.updateMatrixWorld(true); grip.getWorldPosition(this.gripPosition); model.position.sub(this.gripPosition);
      const log = this.placeholders.find((e) => e.id === def.viewAssetId);
      if (this.world.scenario === 'L1' && ['weapon.bat', 'weapon.crowbar', 'weapon.machete'].includes(def.id)) this.prototypes.add(model);
      this.assets.set(def.viewAssetId, { model, source: model.userData.placeholder ? 'placeholder' : 'glb', reason: log?.reason ?? null });
    }
  }
  /** Six vertices form a thick ribbon segment; all buffers are allocated once. */
  private segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, width = 0.035): void {
    this.maxHeight = Math.max(this.maxHeight, ay, by);
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
    const x = -dz / length * width, z = dx / length * width;
    if (this.offset + 18 > this.positions.length) return;
    const p = this.positions; let i = this.offset;
    p[i++] = ax + x; p[i++] = ay; p[i++] = az + z; p[i++] = ax - x; p[i++] = ay; p[i++] = az - z; p[i++] = bx + x; p[i++] = by; p[i++] = bz + z;
    p[i++] = bx + x; p[i++] = by; p[i++] = bz + z; p[i++] = ax - x; p[i++] = ay; p[i++] = az - z; p[i++] = bx - x; p[i++] = by; p[i++] = bz - z; this.offset = i;
  }
  private circle(x: number, z: number, radius: number, from = 0, angle = Math.PI * 2): void {
    for (let i = 0; i < 48; i++) { const a = from + angle * i / 48, b = from + angle * (i + 1) / 48; this.segment(x + Math.cos(a) * radius, 0.04, z + Math.sin(a) * radius, x + Math.cos(b) * radius, 0.04, z + Math.sin(b) * radius); }
  }
  /** Rig node a non-selected weapon rides on: melee on the back, guns on the hip. */
  private holsterMount(category: string): Object3D | null {
    if (category !== 'melee' && category !== 'ranged') return null;
    return this.character.node(category === 'ranged' ? 'hip' : 'torso') ?? null;
  }
  update(): void {
    this.targetMarkerId = null;
    this.updatePickups();
    const combat = this.world.combat, player = this.world.entities.get(1); if (!combat || !player) return;
    if (!player.weapons) {
      for (const held of Object.values(this.held)) held.holder.removeFromParent();
      this.offset = 0; this.geometry.setDrawRange(0, 0); this.trailGeometry.setDrawRange(0, 0); return;
    }
    const loadout = combat.runner.loadout;
    // Draw the selected weapon in the dominant hand and hide the other slot.
    const selectedSide = loadout.state.selectedSide, aiming = selectedSide === this.gunSide && loadout.current(selectedSide).id === this.gunId && this.world.tick <= this.gunUntil && action(loadout.current(selectedSide).id).category === 'ranged' && !player.riding && player.health.current > 0;
    const selectedId = loadout.current(selectedSide).id;
    if (this.held[selectedSide]?.id !== selectedId || selectedSide !== this.selected) {
      this.readyTick = -1;
      if (!aiming) this.gunUntil = -1;
    }
    const gun = action(loadout.current(selectedSide).id).category === 'ranged';
    // L10 manned minigun: both hands on the spade grips, facing the aim; the carried weapon is not drawn (holders hidden below).
    const gunner = !!this.world.mountedGun?.mounted && player.health.current > 0;
    if (gunner) {
      this.readyTick = -1; this.gunUntil = -1;
      this.character.aimGun(this.world.mountedGun!.aim, 0, .995, true, 0, mountedGunHold);
    } else if (gun && !player.riding && this.character.rideWeight === 0 && player.health.current > 0) {
      const age = this.gunUntil < 0 ? Infinity : this.world.tick - (this.gunUntil - 24);
      const input = this.world.inputFrame;
      const fire = selectedSide === 'LEFT' ? input.left : input.right;
      const aimingInput = !!input.aim && (!!input.pointerTarget || input.aimSource === 'keyboard' || input.aimSource === 'touch' || fire.down || fire.held);
      const dt = this.readyTick < 0 || this.world.tick < this.readyTick ? 1 / 60 : Math.max(0, this.world.tick - this.readyTick) / 60;
      this.readyTick = this.world.tick;
      if (aimingInput && input.aim && age !== 0) {
        const yaw = Math.atan2(this.gunDirection.z, this.gunDirection.x);
        const delta = Math.atan2(Math.sin(Math.atan2(input.aim.z, input.aim.x) - yaw), Math.cos(Math.atan2(input.aim.z, input.aim.x) - yaw));
        const next = yaw + delta * (1 - Math.exp(-18 * dt));
        this.gunDirection.x = Math.cos(next); this.gunDirection.z = Math.sin(next);
      }
      // Keep the whole grip/barrel frame rigid in the palm. Lower the arm, never
      // rotate a gun independently through the fingers. Ease back to low ready.
      const release = Math.max(0, Math.min(1, (age - 12) / 24));
      const shotWeight = aiming || age < 36 ? 1 - release * release * (3 - 2 * release) : 0;
      const pending = combat.runner.running[selectedSide];
      const raising = pending?.def.category === 'ranged' && !pending.resolved;
      const preparation = combat.runner.gunReady.ticks / 6;
      const progress = raising ? Math.min(1, (6 - (pending.activeAt - pending.started) + this.world.tick - pending.started) / 6) : preparation;
      const raiseWeight = progress * progress * (3 - 2 * progress);
      const weight = Math.max(raiseWeight, shotWeight);
      if (raising) Object.assign(this.gunDirection, pending.aim);
      const direction = this.handPosition.set(1, 0, 0).applyQuaternion(this.character.quaternion);
      if (raising && pending.id !== this.raiseId) { this.raiseId = pending.id; this.raiseYaw = this.carryYaw; }
      const facing = raising ? this.raiseYaw : Math.atan2(direction.z, direction.x), target = Math.atan2(this.gunDirection.z, this.gunDirection.x);
      const heading = facing + Math.atan2(Math.sin(target - facing), Math.cos(target - facing)) * weight;
      this.carryYaw = heading;
      direction.set(Math.cos(heading), 0, Math.sin(heading));
      const recoil = age > 0 && age < 8 ? Math.sin(Math.PI * age / 8) * .035 : 0;
      // Long stocks/tubes extend behind the palm. Hold them outside the
      // shoulder line instead of letting the stock sweep through torso/head.
      const asset = action(selectedId).viewAssetId, lateral = gunHoldOffset(asset);
      this.character.aimGun(direction, gunCarryElevation(asset) * (1 - weight), .995 - recoil, weight > .001, lateral, longGunHolds[asset]);
    }
    const striking = Object.keys(combat.runner.running).length > 0;
    for (const side of sides) {
      const def = action(loadout.current(side).id); let held = this.held[side];
      if (held?.id !== def.id) { const model = this.model(def); if (!model) { if (held) held.holder.visible = false; continue; } held?.holder.removeFromParent(); const clone = model.clone(true), holder = new Group();
        // Pickups keep the ordinary world materials; only carried instances receive the courier fill.
        clone.traverse(node => { if (node instanceof Mesh) node.material = Array.isArray(node.material) ? node.material.map(m => this.heldMaterials.get(m) ?? m) : this.heldMaterials.get(node.material) ?? node.material; });
        holder.add(clone); held = { id: def.id, model: clone, holder, tilt: 0 }; this.held[side] = held; }
      const prop = def.category === 'melee' || def.category === 'ranged' || (def.category === 'throwable' && held.model.userData.placeholder !== true);
      const inHand = side === selectedSide, mount = inHand ? this.character.socket('RIGHT')?.socket ?? null : this.holsterMount(def.category);
      if (mount && held.holder.parent !== mount) mount.add(held.holder);
      const pose = inHand ? null : holsters[def.category === 'ranged' ? 'hip' : 'back'];
      if (pose) { held.holder.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]); held.holder.position.set(pose.pos[0], pose.pos[1], pose.pos[2]); }
      else {
        // Melee rests tilted away from the body; gun pitch belongs to the arm pose.
        held.tilt += ((striking || aiming ? 0 : def.category === 'melee' ? restTilt : 0) - held.tilt) * .25;
        if (aiming && def.category === 'ranged') held.tilt = 0;
        held.holder.rotation.set(0, 0, held.tilt); held.holder.position.set(0, 0, 0);
      }
      held.holder.scale.setScalar(inHand ? longGunHolds[def.viewAssetId]?.scale ?? 1 : 1);
      held.holder.visible = !gunner && inHand && !!mount && prop && !player.riding && this.character.rideWeight === 0 && !['weapon.fists', 'weapon.kick'].includes(def.id) && !(held.model.userData.placeholder === true && def.category === 'ability');
    }
    this.selected = loadout.state.selectedSide; const state = loadout.state[this.selected], def = action(loadout.current(this.selected).id), origin = player.transform;
    this.cue = null; this.shape = def.aimIndicator; this.offset = 0; this.maxHeight = 0; this.material.color.set(this.selected === 'LEFT' ? '#ffd166' : '#44ffe0'); this.material.transparent = true; this.material.opacity = def.aimIndicator === 'line' ? .18 * Math.max(0, (this.gunUntil - this.world.tick) / 24) : 1;
    const aim = state.aim, angle = Math.atan2(aim.z, aim.x), halfArc = def.arc * Math.PI / 360;
    if (def.aimIndicator === 'line') {
      const muzzle = aiming ? this.muzzle(this.socketPosition) : null;
      if (muzzle) {
        const range = combat.query.clearDistance(muzzle, this.gunDirection, Math.min(4, def.range));
        this.cue = { origin: muzzle.toArray(), range, opacity: this.material.opacity };
        // Short, tapered and translucent; occlusion uses the same walls/fences as hitscan.
        for (let i = 0; i < 8; i++) {
          const a = range * i / 8, b = range * (i + 1) / 8;
          this.segment(muzzle.x + this.gunDirection.x * a, muzzle.y, muzzle.z + this.gunDirection.z * a,
            muzzle.x + this.gunDirection.x * b, muzzle.y, muzzle.z + this.gunDirection.z * b, .012 * (1 - i / 8));
        }
      }
    }
    else if (def.aimIndicator === 'cone') {
      if (this.showCone) this.circle(origin.x, origin.z, def.range, angle - halfArc, halfArc * 2);
      if (this.showCone) for (let sign = -1; sign <= 1; sign += 2) { const edge = halfArc * sign; this.segment(origin.x, 0.04, origin.z, origin.x + Math.cos(angle + edge) * def.range, 0.04, origin.z + Math.sin(angle + edge) * def.range); }
    } else if (def.aimIndicator === 'arc') {
      const dx = state.aimPoint ? state.aimPoint.x - origin.x : aim.x * def.range, dz = state.aimPoint ? state.aimPoint.z - origin.z : aim.z * def.range;
      const distance = Math.hypot(dx, dz), scale = distance > def.range ? def.range / distance : 1;
      this.landing.x = origin.x + dx * scale; this.landing.z = origin.z + dz * scale;
      const time = Math.hypot(this.landing.x - origin.x, this.landing.z - origin.z) / (def.projectile?.speed ?? 12);
      const gravityHeight = 0.5 * (def.projectile?.gravity ?? 9.81) * time * time;
      for (let i = 0; i < 32; i++) { const a = i / 32, b = (i + 1) / 32; this.segment(origin.x + dx * scale * a, (0.7 + gravityHeight * a) * (1 - a), origin.z + dz * scale * a, origin.x + dx * scale * b, (0.7 + gravityHeight * b) * (1 - b), origin.z + dz * scale * b); }
      this.circle(this.landing.x, this.landing.z, def.splash?.radius ?? def.effect?.radius ?? 1);
    } else this.circle(origin.x, origin.z, def.range);
    const command = this.world.controls.snapshot()?.attack;
    const target = command ? this.world.entities.get(command.id) : null;
    if (target?.faction === 'infected' && target.health.current > 0 && !target.hidden && !target.infected?.hidden) { this.targetMarkerId = target.id; this.circle(target.transform.x, target.transform.z, .5); }
    // Persistent zone silhouettes; hot fire, smoke, lure and shield share their authored radius.
    for (const zone of combat.effects.zones) this.circle(zone.x, zone.z, zone.radius);
    this.geometry.setDrawRange(0, this.offset / 3); this.geometry.getAttribute('position').needsUpdate = true;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = combat.projectiles[i], mesh = this.projectiles[i];
      // Gun rounds already have a fast pooled VFX streak. Keep these body meshes
      // for rockets/throwables, rather than also drawing the MG as slow orange balls.
      mesh.visible = !!p && (p.attack.def.category !== 'ranged' || !!p.attack.def.splash);
      if (p) mesh.position.set(p.x, p.y, p.z);
    }
    this.updateTrail();
  }
  /** Rest each authored model on its broad side, with its lowest drawn vertex on the paving.
   * Pickup presentation is independent of the player's carried weapons, including an empty rack. */
  private updatePickups(): void {
    for (const entity of this.world.entities.iterate()) if (entity.pickup && 'actionId' in entity.pickup) {
      let pickup = this.pickups.get(entity.id);
      if (!pickup) {
        const def = action(entity.pickup.actionId), source = this.model(def);
        if (!source) continue;
        const rest = new Group(); rest.add(source.clone(true));
        const bounds = new Box3().setFromObject(rest, true), size = bounds.getSize(new Vector3());
        // The thin axis is perpendicular to the broad resting face. This covers both
        // long +X guns/blades and upright +Y tools without a shared floating pose.
        if (size.z <= size.x && size.z <= size.y) rest.rotation.x = Math.PI / 2;
        else if (size.x <= size.y) rest.rotation.z = Math.PI / 2;
        bounds.setFromObject(rest, true);
        rest.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
        const group = new Group(), marker = new Mesh(this.pickupRingGeometry, this.pickupRingMaterial);
        marker.position.y = .018; if (entity.pickup.surfaceY !== undefined) marker.scale.setScalar(.5); group.add(rest, marker); pickup = group;
        this.pickups.set(entity.id, pickup); this.add(pickup);
      }
      const { x, z } = entity.transform;
      pickup.position.set(x, entity.pickup.surfaceY ?? this.ground?.(x, z) ?? this.world.districts?.pavingHeight(x, z) ?? 0, z);
      pickup.rotation.y = entity.transform.yaw;
    }
    for (const [id, model] of this.pickups) {
      const pickup = this.world.entities.get(id)?.pickup;
      if (!pickup || !('actionId' in pickup)) { model.removeFromParent(); this.pickups.delete(id); }
    }
  }
  /** Short ribbon from actual authored weapon-tip history, including overhead planes. */
  private updateTrail(): void {
    // Weapon swings trail from grip to tip; unarmed kicks (QA1-06) trail the striking foot so they read at distance.
    const kick = (a: { def: { id: string }; combo: number }) => a.def.id === 'weapon.kick' || (a.def.id === 'weapon.fists' && /kick/.test(meleeChains['weapon.fists'][a.combo] ?? ''));
    const attack = Object.values(this.world.combat!.runner.running).find(a => a.def.category === 'melee' && (!['weapon.fists','weapon.kick'].includes(a.def.id) || kick(a)));
    const tick = this.world.tick;
    if (attack && attack.id !== this.trailAttack) { this.trailAttack = attack.id; for (const point of this.trailHistory) point.tick = -Infinity; }
    if (attack?.style === 'roundhouse' || this.arc.until > tick) { this.updateArc(attack, tick); return; }
    if (attack && tick !== this.trailTick && tick >= attack.activeAt - 3 && tick < attack.recoveryAt + 8) {
      const model = this.held[attack.side]?.model, foot = kick(attack), tip = foot ? this.character.node('footR') : model?.getObjectByName('tip'), grip = foot ? this.character.node('shinR') : model?.getObjectByName('grip');
      if (tip && grip) { this.character.updateMatrixWorld(true); const point = this.trailHistory[this.trailCursor++ % 16]; point.tick = tick; tip.getWorldPosition(point.tip); grip.getWorldPosition(point.grip); }
    }
    this.trailTick = tick; this.trailVertices = 0;
    let previous: ActionView["trailHistory"][number] | undefined;
    for (let i = 0; i < 16; i++) {
      const point = this.trailHistory[(this.trailCursor + i) % 16];
      if (tick - point.tick > 9) continue;
      if (previous) {
        const fraction = .5 + .45 * Math.min(1, (tick - previous.tick) / 9);
        this.handPosition.lerpVectors(previous.grip, previous.tip, fraction); this.gripPosition.lerpVectors(point.grip, point.tip, fraction);
        for (const vertex of [this.handPosition, previous.tip, point.tip, this.handPosition, point.tip, this.gripPosition]) { vertex.toArray(this.trailPositions, this.trailVertices * 3); this.trailVertices++; }
      }
      previous = point;
    }
    this.trail.visible = this.trailVertices > 0; this.trailGeometry.setDrawRange(0, this.trailVertices); this.trailGeometry.getAttribute('position').needsUpdate = true;
  }
  /** Bat roundhouse (00 §6.2): one wide, smooth ribbon that follows the bat tip round the courier through the spin,
   * tapering at its tail and fading out over a few ticks of the follow-through. */
  private updateArc(attack: { id: number; side: 'LEFT' | 'RIGHT'; activeAt: number; recoveryAt: number; style?: 'roundhouse' } | undefined, tick: number): void {
    const arc = this.arc, origin = this.character.position, tip = attack && this.held[attack.side]?.model.getObjectByName('tip'), grip = attack && this.held[attack.side]?.model.getObjectByName('grip');
    this.trailVertices = 0;
    if (attack?.style === 'roundhouse' && tip && grip && tick >= attack.activeAt - 1 && tick < attack.recoveryAt + 2) {
      this.character.updateMatrixWorld(true); tip.getWorldPosition(this.handPosition); grip.getWorldPosition(this.gripPosition);
      const raw = Math.atan2(this.handPosition.z - origin.z, this.handPosition.x - origin.x);
      if (arc.id !== attack.id) { arc.id = attack.id; arc.start = arc.angle = arc.raw = raw; }
      arc.angle += Math.atan2(Math.sin(raw - arc.raw), Math.cos(raw - arc.raw)); arc.raw = raw;
      arc.outer = Math.max(1.3, Math.hypot(this.handPosition.x - origin.x, this.handPosition.z - origin.z) * 1.15);
      arc.inner = Math.max(.35, Math.min(arc.outer - .35, Math.hypot(this.gripPosition.x - origin.x, this.gripPosition.z - origin.z)));
      arc.y = this.handPosition.y * .6 + this.gripPosition.y * .4; arc.until = attack.recoveryAt + 8;
    }
    const fade = arc.id === attack?.id && tick < (attack?.recoveryAt ?? 0) + 2 ? 1 : Math.max(0, (arc.until - tick) / 6);
    // The sweep turns clockwise from above (atan2 falls), so the tail lies at larger angles than the head.
    const span = Math.min(Math.abs(arc.angle - arc.start), Math.PI * 1.75) * fade, sign = arc.angle < arc.start ? 1 : -1, n = 15;
    if (span > .05) for (let i = 0; i < n; i++) {
      const a = arc.angle + sign * span * i / n, b = arc.angle + sign * span * (i + 1) / n;
      const ta = 1 - i / n, tb = 1 - (i + 1) / n, ia = arc.outer - (arc.outer - arc.inner) * ta, ib = arc.outer - (arc.outer - arc.inner) * tb;
      const ox = origin.x, oz = origin.z, y = arc.y;
      const quad = [[ox + Math.cos(a) * ia, y, oz + Math.sin(a) * ia], [ox + Math.cos(a) * arc.outer, y, oz + Math.sin(a) * arc.outer], [ox + Math.cos(b) * arc.outer, y, oz + Math.sin(b) * arc.outer],
        [ox + Math.cos(a) * ia, y, oz + Math.sin(a) * ia], [ox + Math.cos(b) * arc.outer, y, oz + Math.sin(b) * arc.outer], [ox + Math.cos(b) * ib, y, oz + Math.sin(b) * ib]];
      for (const v of quad) { this.trailPositions.set(v, this.trailVertices * 3); this.trailVertices++; }
    }
    this.trailTick = tick;
    this.trail.visible = this.trailVertices > 0; this.trailGeometry.setDrawRange(0, this.trailVertices); this.trailGeometry.getAttribute('position').needsUpdate = true;
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; }
  /** Scene Lab checks the visible gun in every state, including low ready. */
  gunMeshes(): { entity: number; geometry: import('three').BufferGeometry; matrix: import('three').Matrix4 }[] {
    const held = this.held[this.selected], result: { entity: number; geometry: import('three').BufferGeometry; matrix: import('three').Matrix4 }[] = [];
    if (!held?.holder.visible || action(held.id).category !== 'ranged') return result;
    held.model.updateWorldMatrix(true,true);
    held.model.traverse(node => { if (node instanceof Mesh) result.push({ entity:1,geometry:node.geometry,matrix:node.matrixWorld }); });
    return result;
  }
  getState() {
    this.character.updateMatrixWorld(true);
    const attachments = (['LEFT', 'RIGHT'] as const).map((side) => {
      const nodes = this.character.socket('RIGHT'), held = this.held[side];
      if (!nodes) return { side, actionId: held?.id, visible: false, iconUrl: null, socket: null, holstered: false, handDistance: 0, gripDistance: 0, attached: false, source: undefined, sockets: [] as string[] };
      nodes.socket.getWorldPosition(this.socketPosition); nodes.hand.getWorldPosition(this.handPosition);
      held?.model.getObjectByName('grip')?.getWorldPosition(this.gripPosition);
      const def = held && action(held.id), asset = def && this.assets.get(def.viewAssetId);
      return { side, actionId: held?.id, visible: held?.holder.visible ?? false, iconUrl: def ? actionIconUrl(def.iconId) : null, barrel: held ? new Vector3(1, 0, 0).transformDirection(held.model.matrixWorld).toArray() : null, up: held ? new Vector3(0, 1, 0).transformDirection(held.model.matrixWorld).toArray() : null, muzzle: held?.model.getObjectByName('muzzle')?.getWorldPosition(new Vector3()).toArray() ?? null, socket: nodes.socket.name, holstered: side !== this.selected, handDistance: side === this.selected ? this.socketPosition.distanceTo(this.handPosition) : 0, gripDistance: side === this.selected ? this.gripPosition.distanceTo(this.socketPosition) : 0, attached: !!held?.holder.parent, source: asset?.source, sockets: def ? ['grip', def.category === 'ranged' ? 'muzzle' : 'tip'].filter((name) => held?.model.getObjectByName(name)) : [] };
    });
    return { aimCue: this.cue, targetMarker: this.targetMarkerId === null ? null : { id: this.targetMarkerId, radius: .5 }, trailVertices: this.trailVertices, bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, indicator: { selectedSide: this.selected, shape: this.shape, visibleSides: [this.selected], vertices: this.offset / 3, maxHeight: this.maxHeight, landing: { ...this.landing } }, attachments, placeholders: this.placeholders };
  }
  dispose(): void { for (const held of Object.values(this.held)) held.holder.removeFromParent(); void this.registry.dispose(); this.geometry.dispose(); this.material.dispose(); this.trailGeometry.dispose(); this.trailMaterial.dispose(); this.projectileGeometry.dispose(); this.projectileMaterial.dispose(); this.pickupRingGeometry.dispose(); this.pickupRingMaterial.dispose(); this.pickups.clear(); this.clear(); }
}
