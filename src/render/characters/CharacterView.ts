import { BoxGeometry, Color, Group, Mesh, Quaternion, Vector3, type Material } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../assets/manifest.json';
import { atLeast, type AssetDef } from '../../assets/types';
import { palette, type PaletteToken } from '../../data/palette';
import { characterNodes } from '../../data/survivor';
import { batchRigidParts } from './batchRigidParts';
import type { GearTier, SurvivorState, SurvivorVariant } from '../../data/survivor';
import type { Materials } from '../Materials';
import type { PaletteMaterial } from '../PaletteMaterial';
import { KeyframeAnimator, type RidePose } from './KeyframeAnimator';
import { disposeCharacter, loadCharacter } from './rig';
import { alignSkeleton } from './skin';
import { skinClips } from './clips';
import { LimbIK } from './LimbIK';
import { RiderContacts } from './RiderContacts';

type LoadedCharacter = Awaited<ReturnType<typeof loadCharacter>> & { assetId: string; animator: KeyframeAnimator; gear: Group[]; sockets: Record<'LEFT' | 'RIGHT', { socket: import('three').Object3D; hand: import('three').Object3D }> };
/** Hero hierarchy presentation. Cosmetic variants share identical sim state and attachment rules. */
export class CharacterView extends Group {
  private readonly characters = new Map<SurvivorVariant, LoadedCharacter>();
  private variant: SurvivorVariant = 'female';
  private tier: GearTier = 0;
  private readonly facingTarget = new Quaternion();
  private readonly facingAxis = new Vector3(0, 1, 0);
  private facingTime = -1;
  private turn = 0;
  private readonly bloodMaterials: PaletteMaterial[] = [];
  /** `outfit` picks the hero model set: L1 v2 plays the courier (E19), later levels the survivor. Same rig and clips. */
  /** Both couriers share the fitted skinned rig and clips; skin=0 keeps the release fallback. */
  skinned = false;
  private readonly riders = new Map<SurvivorVariant, { arms: [LimbIK, LimbIK]; legs: [LimbIK, LimbIK]; soleHeight: number }>();
  private readonly lastContacts = new RiderContacts();
  private readonly contactTarget = new Vector3();
  private readonly pole = new Vector3();
  private readonly contactRotation = new Quaternion();
  private readonly gripRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  private readonly riderLean = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -.7);
  private readonly riderGaze = this.riderLean.clone().invert();
  private readonly mountOffset = new Vector3();
  private readonly transitionOffset = new Vector3();
  private readonly lastPresented = new Vector3();
  private readonly lastPresentedRotation = new Quaternion();
  private readonly transitionRotation = new Quaternion();
  private contactHistory = false;
  private rideAttached = false;
  private contactEvaluation = -1;
  private readonly appliedOffset = new Vector3();
  private readonly appliedRotation = new Quaternion();
  cpuMs = 0;
  get skinActive(): boolean { return this.riders.has(this.variant); }
  /** Held gear remains stowed until the hands have released the bicycle. */
  get rideWeight(): number { return this.characters.get(this.variant)?.animator.rideWeight ?? 0; }
  async init(materials: Materials, bloodFeedback = false, low = false, outfit: 'survivor' | 'courier' = 'survivor', skin = false): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const variant of ['female', 'male'] as const) {
      const id = `char.${outfit}-${variant}`, def = (manifest as AssetDef[]).find(asset => asset.id === id);
      let isSkin = false;
      const character = await loadCharacter(variant, async () => {
        if (!def || !atLeast(def.status, 'integrated')) {
          const reason = def ? `status ${def.status}` : 'missing manifest entry';
          throw new Error(reason);
        }
        const skinned = skin && outfit === 'courier';
        const scene = (await loader.loadAsync('/' + (skinned ? def.glb.replace(/\.glb$/, '.skin.glb') : low ? def.lods?.lod1 ?? def.glb : def.glb).replace(/^public\//, ''))).scene;
        if (skinned && alignSkeleton(scene).length) isSkin = true;
        return scene;
      }, def?.dimensions.y);
      isSkin &&= character.source === 'glb';
      this.skinned ||= isSkin;
      if (character.source === 'placeholder') console.info(JSON.stringify({ type: 'asset.placeholder', id, reason: character.reason }));
      const vertexMaterial = materials.fromVertexColors(`character:${variant}`);
      vertexMaterial.bloodCoverage.value = 0; vertexMaterial.userData.sharedPalette = true;
      if (bloodFeedback) this.bloodMaterials.push(vertexMaterial);
      const boundaries = [...new Set([...characterNodes, ...(def?.requiredNodes ?? []), ...(def?.animatedNodes ?? []), ...(def?.sockets ?? [])])];
      batchRigidParts(character.model, boundaries, vertexMaterial, source => {
        const token = source.name.replace(/^pal_/, '') as PaletteToken;
        return ['survivorRed', 'backpackTeal', 'picketWhite'].includes(token) ? new Color(palette[token]) : (source as import('three').MeshStandardMaterial).color;
      });
      const oldMaterials = new Set<Material>(), replacements = new Map<Material, Material>();
      character.model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const remap = (source: Material): Material => {
          if (source === vertexMaterial) return source;
          if (source.name === 'pal_vertexColor') { oldMaterials.add(source); return vertexMaterial; }
          let replacement = replacements.get(source);
          if (replacement) return replacement;
          const token = source.name.replace(/^pal_/, '') as PaletteToken;
          if (['survivorRed', 'backpackTeal', 'picketWhite'].includes(token)) replacement = bloodFeedback ? materials.unique(token) : materials.get(token);
          else replacement = materials.fromColor(`${variant}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          replacement.userData.sharedPalette = true;
          if (bloodFeedback) this.bloodMaterials.push(replacement as PaletteMaterial);
          oldMaterials.add(source); replacements.set(source, replacement); return replacement;
        };
        object.material = Array.isArray(object.material) ? object.material.map(remap) : remap(object.material);
        object.castShadow = object.receiveShadow = true;
      });
      for (const material of oldMaterials) material.dispose();
      const gear: Group[] = [];
      const attachment = (tier: number, parent: import('three').Object3D, size: [number, number, number], position: [number, number, number], token: PaletteToken): void => {
        const group = new Group(); group.name = `gear-tier-${tier}`; const mesh = new Mesh(new BoxGeometry(...size), materials.get(token));
        mesh.material.userData.sharedPalette = true; mesh.castShadow = true; mesh.position.set(...position); group.add(mesh); parent.add(group); gear.push(group); group.userData.tier = tier;
      };
      // Cumulative gear: bag straps/pouch; pads/holster; vest/cap; heavier armor and mask.
      attachment(1, character.rig.backpackSocket, [0.12, 0.15, 0.3], [-0.13, -0.1, 0], 'backpackTeal');
      for (const side of ['L', 'R'] as const) {
        attachment(2, character.rig[`shin${side}`], [0.14, 0.12, 0.14], [0.07, -0.03, 0], 'uiDark');
        attachment(2, character.rig[`arm${side}`], [0.14, 0.1, 0.17], [0, -0.05, 0], 'uiDark');
      }
      attachment(2, character.rig.hip, [0.09, 0.18, 0.08], [0.02, -0.07, 0.22], 'woodWarm');
      attachment(3, character.rig.torso, [0.12, 0.19, 0.27], [0.12, 0.1, 0], 'uiDark');
      attachment(3, character.rig.head, [0.23, 0.055, 0.4], [0, 0.14, 0], 'survivorRed');
      attachment(4, character.rig.torso, [0.14, 0.25, 0.37], [0.16, 0.08, 0], 'policeBlue');
      attachment(4, character.rig.head, [0.08, 0.11, 0.16], [0.18, 0.005, 0], 'uiDark');
      const pilot = isSkin;
      if (pilot) {
        const r = character.rig;
        this.riders.set(variant, { arms: [new LimbIK(r.armL, r.foreArmL, r.handL), new LimbIK(r.armR, r.foreArmR, r.handR)],
          legs: [new LimbIK(r.legL, r.shinL, r.footL), new LimbIK(r.legR, r.shinR, r.footR)],
          soleHeight: r.footL.getWorldPosition(this.scratchA).y - r.root.getWorldPosition(this.scratchB).y });
      }
      this.characters.set(variant, { ...character, assetId: isSkin ? `${id}.skin` : id, animator: new KeyframeAnimator(character.rig, pilot ? skinClips : undefined), gear, sockets: { LEFT: { socket: character.rig.weaponSocketL, hand: character.rig.handL }, RIGHT: { socket: character.rig.weaponSocketR, hand: character.rig.handR } } }); this.add(character.model);
    }
    this.makeParcel(materials);
  }
  update(pose: SurvivorState, tick: number, alpha: number, ride?: RidePose): void {
    const started = performance.now();
    const before = this.characters.get(pose.variant)?.animator.evaluations;
    if (this.variant !== pose.variant) { this.contactEvaluation = -1; this.contactHistory = false; this.rideAttached = false; }
    this.variant = pose.variant; this.tier = pose.gearTier;
    for (const [variant, character] of this.characters) {
      character.model.visible = variant === pose.variant;
      for (const gear of character.gear) gear.visible = gear.userData.tier <= pose.gearTier;
      if (character.model.visible) character.animator.update(pose, tick, alpha, this.turn, ride);
    }
    // E19 story: the courier parcel sits between her hands while she carries it.
    const character = this.characters.get(this.variant);
    if (this.parcel) this.parcel.visible = !!pose.carrying && !!character && !ride; // riding: the parcel rides in the cargo box (BicycleView)
    if (this.parcel?.visible && character) {
      this.updateMatrixWorld(true);
      const l = character.rig.handL.getWorldPosition(this.scratchA), r = character.rig.handR.getWorldPosition(this.scratchB);
      this.parcel.position.copy(this.worldToLocal(l.add(r).multiplyScalar(.5))); this.parcel.position.y += .04;
    }
    if (this.characters.get(pose.variant)?.animator.evaluations !== before) this.cpuMs = performance.now() - started;
  }
  /** Seat and limb contacts are applied after the mixer. Mount/dismount fades
   * use the presentation clock; the bike and survivor simulation never change. */
  applyRideContacts(contacts?: RiderContacts): void {
    const character = this.characters.get(this.variant), rider = this.riders.get(this.variant);
    if (!rider || !character) return;
    const started = performance.now(), weight = character.animator.rideWeight;
    if (this.contactEvaluation === character.animator.evaluations) {
      this.position.add(this.appliedOffset);
      this.quaternion.copy(contacts && weight >= 1 ? contacts.orientation : this.appliedRotation);
      if (contacts && weight >= 1) this.seatPelvis(contacts.seat, -.04);
      return;
    }
    this.contactEvaluation = character.animator.evaluations;
    this.appliedOffset.copy(this.position).multiplyScalar(-1);
    if (!!contacts !== this.rideAttached) {
      // The sim seats/exits instantly. Start the visual transfer at the last
      // presented position, including the parked-bike capsule clearance.
      this.transitionOffset.copy(this.contactHistory ? this.lastPresented : this.position).sub(this.position);
      this.transitionRotation.copy(this.contactHistory ? this.lastPresentedRotation : this.quaternion);
      this.rideAttached = !!contacts;
    }
    this.position.addScaledVector(this.transitionOffset, contacts ? 1 - weight : weight);
    if (contacts) this.quaternion.copy(this.transitionRotation).slerp(contacts.orientation, weight);
    else if (weight > 0) this.quaternion.slerp(this.transitionRotation, weight);
    if (contacts) {
      for (const name of ['seat', 'handL', 'handR', 'footL', 'footR'] as const) this.lastContacts[name].copy(contacts[name]);
      this.lastContacts.orientation.copy(contacts.orientation);
    }
    if (contacts && weight > 0) {
      this.updateMatrixWorld(true); character.rig.hip.getWorldPosition(this.scratchA);
      this.mountOffset.copy(contacts.seat).sub(this.scratchA); this.mountOffset.y -= .04;
      this.position.addScaledVector(this.mountOffset, weight);
    }
    if (weight > 0) {
      character.rig.torso.quaternion.slerp(this.riderLean, weight);
      character.rig.head.quaternion.premultiply(this.contactRotation.identity().slerp(this.riderGaze, weight));
      this.updateMatrixWorld(true);
      const c = this.lastContacts, scale = this.scale.y;
      this.contactRotation.copy(c.orientation).multiply(this.gripRotation);
      for (const [i, side] of (['L', 'R'] as const).entries()) {
        // The clamped weapon socket lies inside the mitten's curled fingers.
        this.contactTarget.copy(character.rig[`weaponSocket${side}`].position).multiplyScalar(character.rig.handL.getWorldScale(this.scratchA).y).applyQuaternion(this.contactRotation);
        this.contactTarget.multiplyScalar(-1).add(c[`hand${side}`]);
        this.pole.set(-.3, -.5, side === 'L' ? -1 : 1).applyQuaternion(c.orientation);
        rider.arms[i].solve(this.contactTarget, this.pole, this.contactRotation, weight);
        this.contactTarget.set(0, rider.soleHeight * scale, 0).applyQuaternion(c.orientation).add(c[`foot${side}`]);
        this.pole.set(1, 0, side === 'L' ? -.15 : .15).applyQuaternion(c.orientation);
        rider.legs[i].solve(this.contactTarget, this.pole, c.orientation, weight);
      }
      this.updateMatrixWorld(true);
    }
    this.appliedOffset.add(this.position); this.appliedRotation.copy(this.quaternion);
    this.lastPresented.copy(this.position); this.lastPresentedRotation.copy(this.quaternion); this.contactHistory = true;
    this.cpuMs += performance.now() - started;
  }
  /** Riding: moves the whole figure so its pelvis lands on `target` (world, the saddle) after this frame's pose update. */
  seatPelvis(target: Vector3, lift = 0): void {
    const character = this.characters.get(this.variant); if (!character) return;
    this.updateMatrixWorld(true); character.rig.hip.getWorldPosition(this.scratchA);
    this.position.x += target.x - this.scratchA.x; this.position.z += target.z - this.scratchA.z; this.position.y += target.y + lift - this.scratchA.y;
    this.updateMatrixWorld(true);
  }
  /** Solve the arms after seating: keep the authored limb lengths and place each palm on its grip. */
  holdHandlebar(left: Vector3, right: Vector3): void {
    const character = this.characters.get(this.variant); if (!character) return;
    for (const [side, grip] of [['L', left], ['R', right]] as const) {
      const arm = character.rig[`arm${side}`], forearm = character.rig[`foreArm${side}`], hand = character.rig[`hand${side}`];
      this.updateMatrixWorld(true);
      const target = arm.parent!.worldToLocal(grip.clone()).sub(arm.position);
      const a = forearm.position.length(), b = hand.position.length(), d = Math.max(.0001, Math.min(a + b - .0001, target.length()));
      const axis = target.clone().normalize(), along = (a * a + d * d - b * b) / (2 * d);
      const bend = new Vector3(0, -1, 0).addScaledVector(axis, axis.y).normalize();
      const elbow = axis.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      arm.quaternion.setFromUnitVectors(forearm.position.clone().normalize(), elbow.clone().normalize());
      const lower = axis.multiplyScalar(d).sub(elbow).applyQuaternion(arm.quaternion.clone().invert());
      forearm.quaternion.setFromUnitVectors(hand.position.clone().normalize(), lower.normalize());
    }
    this.updateMatrixWorld(true);
  }
  private parcel: Group | null = null;
  private readonly scratchA = new Vector3();
  private readonly scratchB = new Vector3();
  /** Cardboard parcel with the teal depot tape (matches the clerk's hand prop). */
  private makeParcel(materials: Materials): void {
    const group = new Group(); group.name = 'carried-parcel'; group.visible = false;
    const box = new Mesh(new BoxGeometry(.3, .24, .26), materials.fromColor('parcel:card', new Color('#b98a55')));
    const tape = new Mesh(new BoxGeometry(.31, .045, .08), materials.fromColor('parcel:tape', new Color('#2aa198'))); tape.position.y = .12;
    for (const mesh of [box, tape]) { mesh.castShadow = true; group.add(mesh); }
    this.parcel = group; this.add(group);
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; }
  /** Presentation heading eases aim changes while the sim keeps its exact hit direction. */
  /** `striking` snaps the body onto the attack direction (QA1-06: strikes read side-on when the
   * 6 rad/s locomotion turn lags a 0.27 s jab); locomotion keeps the bounded turn. */
  face(yaw: number, time: number, striking = false, frame?: Quaternion): void {
    if (frame) { this.quaternion.copy(frame); this.facing = yaw; this.facingTime = time; this.turn = 0; return; }
    // Facing is tracked as a scalar heading. Reading it back from `rotation.y` (an XYZ Euler decomposed from the
    // slerped quaternion) wraps beyond +-90 deg, which made the turn rate flip sign and the courier wobble while walking
    // diagonally (PO: walk micro-vibration).
    if (this.facingTime < 0 || time < this.facingTime) this.facing = yaw;
    const dt = Math.max(0, time - this.facingTime);
    let delta = Math.atan2(Math.sin(yaw - this.facing), Math.cos(yaw - this.facing));
    if (!striking && Math.abs(delta) < .006) delta = 0;
    this.turn = Math.abs(delta) > .12 ? Math.sign(delta) : 0;
    const amount = Math.abs(delta) > 0 ? Math.min(1 - Math.exp(-(striking ? 60 : 24) * dt), (striking ? 40 : 6) * dt / Math.abs(delta)) : 1;
    this.facing += delta * amount; this.quaternion.setFromAxisAngle(this.facingAxis, this.facing); this.facingTime = time;
  }
  private facing = 0;
  /** Held views borrow these nodes; CharacterView retains ownership of the rig. */
  /** Rig node of the visible variant (kick trails follow the foot). */
  node(name: keyof LoadedCharacter['rig']) { return this.characters.get(this.variant)?.rig[name]; }
  socket(side: 'LEFT' | 'RIGHT') { return this.characters.get(this.variant)!.sockets[side]; }
  getState() {
    const character = this.characters.get(this.variant);
    return { modelId: character?.assetId, position: this.position.toArray(), orientation: this.quaternion.toArray(), yaw: this.facing, pelvis: character?.rig.hip.getWorldPosition(this.scratchA).toArray() ?? null, bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, variant: this.variant, gearTier: this.tier, animation: character?.animator.state, clip: character?.animator.clip, missingClips: character?.animator.missingClips ?? 0,
      evaluations: character?.animator.evaluations ?? 0, skinned: this.skinActive, cpuMs: this.cpuMs, rideWeight: character?.animator.rideWeight ?? 0, sources: [...this.characters].map(([variant, c]) => ({ variant, source: c.source, reason: c.reason })) };
  }
  dispose(): void { for (const character of this.characters.values()) disposeCharacter(character.model); this.parcel?.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); }); this.parcel = null; this.characters.clear(); this.riders.clear(); this.bloodMaterials.length = 0; this.clear(); }
}
